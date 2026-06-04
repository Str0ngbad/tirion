#!/usr/bin/env python3
"""
generate-form-resolution.py

Generates /data-import/material_mixed_form_resolution.csv.

Reads the user-completed material_normalization.csv and the Part Master CSV,
then produces a per-Part resolution file for two categories of rows:

  1. DISAMBIGUATION rows — csv_material_values where the map's notes flag the
     row as "Mixed" or "separate pass". For each Part using that material value,
     the script applies stock-size heuristics to suggest a form. The user fills
     in user_resolved_form.

  2. SIZE-TRANSPLANT rows — csv_material_values where the map's notes flag
     "size moves to Stock Size". The form is already resolved in the map; this
     file lets the user verify the transplant logic before the import script runs.

Run from the project root:
  python scripts/generate-form-resolution.py

Output: data-import/material_mixed_form_resolution.csv

See spec/data_import_mapping.md for context.
"""

import csv
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).parent.parent
MATERIAL_MAP = ROOT / "data-import" / "material_normalization.csv"
PART_MASTER_CSV = ROOT / "Master Production Tool (Split on 09-16-25) - Part Master.csv"
OUT_PATH = ROOT / "data-import" / "material_mixed_form_resolution.csv"

# ---------------------------------------------------------------------------
# Part Master column indices (0-based)
# ---------------------------------------------------------------------------
PM_PART_NUMBER_IDX = 0
PM_PART_NAME_IDX = 1
PM_STOCK_SIZE_IDX = 6
PM_LENGTH_IDX = 7
PM_MATERIAL_IDX = 8

# ---------------------------------------------------------------------------
# Row-category detection
# ---------------------------------------------------------------------------

def is_size_transplant(notes: str) -> bool:
    """Row has 'size moves to Stock Size' (or close variants) in the notes."""
    return bool(re.search(r'size\s+moves?\s+to\s+stock\s+size', notes, re.IGNORECASE))


def is_disambiguation(notes: str) -> bool:
    """
    Row needs per-Part form disambiguation. Detects 'mixed' or 'separate pass'
    patterns in the user-written notes, excluding 'leave null'/'disregard' rows.
    """
    if re.search(r'\b(disregard|leave null)\b', notes, re.IGNORECASE):
        return False
    return bool(re.search(r'\b(mixed|separate pass)\b', notes, re.IGNORECASE))


# ---------------------------------------------------------------------------
# Size-prefix extraction (mirrors generate-import-maps.py logic)
# ---------------------------------------------------------------------------

SIZE_PREFIX_RE = re.compile(
    r'^((?:\d*\.\d+|\d+["\'])["\']*\s*(?:wall|thick|OD|ID)?\s*)',
    re.IGNORECASE,
)


def extract_size_from_material_value(csv_material_value: str) -> str:
    """Extract the leading size prefix from a csv_material_value, or '' if none."""
    m = SIZE_PREFIX_RE.match(csv_material_value.strip())
    return m.group(1).strip() if m else ""


# ---------------------------------------------------------------------------
# Stock-size heuristics
# ---------------------------------------------------------------------------

# Two-dimension regex: captures both numeric values (handles leading decimals)
TWO_DIM_RE = re.compile(
    r'(\d*\.?\d+)["\']?\s*[xX×]\s*(\d*\.?\d+)',
)

# Three-dimension regex
THREE_DIM_RE = re.compile(
    r'\d["\']?\s*[xX×]\s*\d["\']?\s*[xX×]\s*\d',
)


def infer_form_from_stock_size(stock_size: str) -> tuple[str, str]:
    """
    Apply stock-size pattern heuristics to suggest a form.
    Returns (suggested_form, heuristic_name).
    Both empty if no confident match.

    Heuristic order:
      1. OD / ID patterns → Round Tube
      2. D-suffix (without OD/ID) → Round
      3. wall qualifier (without OD/ID) → Square Tube
      4. Gauge designation → Sheet
      5. Hex designation → Hex Bar
      6. Three-dim with × → Flat
      7. Two-dim with ×, equal dims → Square Bar
      8. Two-dim with ×, unequal dims → Flat
      9. Single-dim or unrecognized → blank (indeterminate)
    """
    s = stock_size.strip()
    if not s:
        return "", "blank stock size"

    su = s.upper()

    has_od = bool(re.search(r"\bOD\b", su))
    has_id = bool(re.search(r"\bID\b", su))
    has_wall = bool(re.search(r"\bWALL\b", su))
    has_d_suffix = bool(re.search(r"\d[\"']?\s*D\b", su))

    # 1. Tube patterns
    if has_od or has_id:
        return "Round Tube", "OD/ID pattern"

    # 2. D-suffix → Round (solid rod/bar)
    if has_d_suffix:
        return "Round", "D suffix"

    # 3. Wall qualifier without OD/ID → Square Tube
    #    (Round tubes tend to appear as OD x wall; square/rect tubes just show wall)
    if has_wall:
        return "Square Tube", "wall qualifier (no OD/ID)"

    # 4. Gauge → Sheet
    if re.search(r"\b(ga|gauge|gage)\b", s, re.IGNORECASE):
        return "Sheet", "gauge designation"

    # 5. Hex → Hex Bar
    if re.search(r"\bhex\b|\bAF\b", s, re.IGNORECASE):
        return "Hex Bar", "hex designation"

    # 6. Three dimensions → Flat
    if THREE_DIM_RE.search(s):
        return "Flat", "triple-dim pattern"

    # 7–8. Two dimensions
    m = TWO_DIM_RE.search(s)
    if m:
        try:
            d1 = float(m.group(1))
            d2 = float(m.group(2))
        except ValueError:
            return "", "no heuristic match (parse error)"
        if abs(d1 - d2) < 0.0001:
            return "Square Bar", "equal-dim square pattern"
        else:
            return "Flat", "two-dim pattern"

    # 9. Single dimension or unrecognized
    return "", "no heuristic match (single-dim or unrecognized)"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    if not MATERIAL_MAP.exists():
        sys.exit(f"ERROR: {MATERIAL_MAP} not found")
    if not PART_MASTER_CSV.exists():
        sys.exit(f"ERROR: {PART_MASTER_CSV} not found")

    # ── Read normalization map ────────────────────────────────────────────────
    disambig_set: dict[str, dict] = {}   # csv_material_value → map row
    transplant_set: dict[str, dict] = {} # csv_material_value → map row
    ambiguous_notes: list[tuple[str, str]] = []  # (value, notes) for uncertain detection

    with open(MATERIAL_MAP, encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            val = row["csv_material_value"]
            notes = row["notes"].strip()

            if is_size_transplant(notes):
                transplant_set[val] = row
            elif is_disambiguation(notes):
                disambig_set[val] = row
            elif notes and not re.search(r'\b(disregard|leave null)\b', notes, re.IGNORECASE):
                # Non-empty notes that don't match any known pattern
                ambiguous_notes.append((val, notes))

    print(f"Disambiguation values: {len(disambig_set)}")
    for v in sorted(disambig_set):
        print(f"  {v!r}")

    print(f"\nSize-transplant values: {len(transplant_set)}")
    for v in sorted(transplant_set):
        print(f"  {v!r}")

    if ambiguous_notes:
        print(f"\nAMBIGUOUS NOTES (detection uncertain — not included in output):")
        for v, n in ambiguous_notes:
            print(f"  {v!r}: {n!r}")

    # ── Read Part Master ──────────────────────────────────────────────────────
    all_flagged = set(disambig_set) | set(transplant_set)
    pm_rows: list[dict] = []

    with open(PART_MASTER_CSV, encoding="utf-8-sig", newline="") as fh:
        reader = csv.reader(fh)
        next(reader)  # skip header
        for row in reader:
            if not row or not row[PM_PART_NUMBER_IDX].strip():
                continue
            mat = row[PM_MATERIAL_IDX].strip() if len(row) > PM_MATERIAL_IDX else ""
            if mat not in all_flagged:
                continue
            pm_rows.append({
                "part_number": row[PM_PART_NUMBER_IDX].strip(),
                "part_name": row[PM_PART_NAME_IDX].strip() if len(row) > PM_PART_NAME_IDX else "",
                "material": mat,
                "stock_size": row[PM_STOCK_SIZE_IDX].strip() if len(row) > PM_STOCK_SIZE_IDX else "",
                "length": row[PM_LENGTH_IDX].strip() if len(row) > PM_LENGTH_IDX else "",
            })

    print(f"\nTotal Parts matched in Part Master: {len(pm_rows)}")

    # ── Build output rows ─────────────────────────────────────────────────────
    out_rows: list[dict] = []
    stats: dict[str, int] = {}

    for pm in pm_rows:
        mat = pm["material"]
        stock = pm["stock_size"]
        length = pm["length"]

        if mat in disambig_set:
            suggested_form, heuristic_name = infer_form_from_stock_size(stock)
            if not suggested_form and not stock and length:
                # Try length as fallback when stock size is blank
                suggested_form, heuristic_name = infer_form_from_stock_size(length)
                if suggested_form:
                    heuristic_name = f"{heuristic_name} (from length)"
            out_rows.append({
                "csv_material_value": mat,
                "part_number": pm["part_number"],
                "part_name": pm["part_name"],
                "stock_size": stock,
                "length": length,
                "suggested_form": suggested_form,
                # Pre-fill user_resolved_form when the heuristic is confident.
                # Equal-dim → Square Bar and two-dim → Flat are reliable per user
                # confirmation; D-suffix, OD/ID patterns similarly unambiguous.
                # Blank suggested_form stays blank — user resolves manually.
                "user_resolved_form": suggested_form,
                "heuristic_match": heuristic_name,
                "notes": "",
            })
            bucket = heuristic_name if suggested_form else f"blank: {heuristic_name}"
            stats[bucket] = stats.get(bucket, 0) + 1

        elif mat in transplant_set:
            map_row = transplant_set[mat]
            form = map_row["form"]
            size_content = extract_size_from_material_value(mat)
            heuristic_match = (
                f"size transplant from map: {size_content}" if size_content
                else "size transplant from map"
            )
            out_rows.append({
                "csv_material_value": mat,
                "part_number": pm["part_number"],
                "part_name": pm["part_name"],
                "stock_size": stock,
                "length": length,
                "suggested_form": form,
                "user_resolved_form": form,
                "heuristic_match": heuristic_match,
                "notes": "size content will be assigned to Part.stockSize at import time",
            })

    # Sort: csv_material_value asc, then part_number asc
    out_rows.sort(key=lambda r: (r["csv_material_value"].lower(), r["part_number"]))

    # ── Write output CSV ──────────────────────────────────────────────────────
    fieldnames = [
        "csv_material_value",
        "part_number",
        "part_name",
        "stock_size",
        "length",
        "suggested_form",
        "user_resolved_form",
        "heuristic_match",
        "notes",
    ]
    with open(OUT_PATH, "w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        writer.writerows(out_rows)

    # ── Report ────────────────────────────────────────────────────────────────
    print(f"\n=== OUTPUT SUMMARY ===")
    print(f"Total rows written: {len(out_rows)}")
    disambig_rows = [r for r in out_rows if r["csv_material_value"] in disambig_set]
    transplant_rows = [r for r in out_rows if r["csv_material_value"] in transplant_set]
    print(f"  Disambiguation rows: {len(disambig_rows)}")
    print(f"  Size-transplant rows: {len(transplant_rows)}")
    print(f"\nHeuristic match distribution (disambiguation rows):")
    for key, count in sorted(stats.items(), key=lambda x: -x[1]):
        print(f"  {count:3d}  {key}")
    print(f"\nWritten to: {OUT_PATH}")

    print(f"\n--- First 15 rows ---")
    for r in out_rows[:15]:
        print(
            f"  [{r['csv_material_value']!r:35s}] "
            f"{r['part_number']:20s} "
            f"ss={r['stock_size']!r:20s} "
            f"sug={r['suggested_form']!r:12s} "
            f"h={r['heuristic_match']!r}"
        )


if __name__ == "__main__":
    main()
