#!/usr/bin/env python3
"""
generate-import-maps.py

Generates the two normalization map CSVs for the Phase 1E one-off import:
  data-import/material_normalization.csv
  data-import/vendor_normalization.csv

Run from the project root:
  python scripts/generate-import-maps.py

The script is intentionally a one-shot starting point. Re-running it
overwrites any manual edits to the output files. Back up before regenerating.

See spec/data_import_mapping.md Section 3 for file shape and rules.
"""

import csv
import re
import sys
from collections import Counter
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).parent.parent
PART_MASTER_CSV = ROOT / "Master Production Tool (Split on 09-16-25) - Part Master.csv"
VENDOR_MASTER_CSV = ROOT / "Master Production Tool (Split on 09-16-25) - Vendor Master.csv"
OUT_DIR = ROOT / "data-import"
MATERIAL_OUT = OUT_DIR / "material_normalization.csv"
VENDOR_OUT = OUT_DIR / "vendor_normalization.csv"

# ---------------------------------------------------------------------------
# Part Master column indices (0-based)
# ---------------------------------------------------------------------------
PM_PART_NUMBER_IDX = 0
PM_MATERIAL_IDX = 8
PM_VENDOR_IDX = 10

# ---------------------------------------------------------------------------
# Recognized form keywords
# Compound forms are checked before single forms (longest match wins).
# ---------------------------------------------------------------------------
COMPOUND_FORMS = [
    "Square Tube",
    "Square Tubing",
    "Round Tube",
    "Round Tubing",
    "Rectangular Tube",
    "Rectangular Tubing",
    "Rect Tubing",
    "Rect Tube",
    "Angle Iron",
    "Bar Stock",
]
SINGLE_FORMS = [
    "Flat",
    "Round",
    "Square",
    "Hex",
    "Tube",
    "Tubing",
    "Sheet",
    "Plate",
    "Bar",
    "Rod",
    "Angle",
    "Channel",
    "Pipe",
]
ALL_FORMS = COMPOUND_FORMS + SINGLE_FORMS
COMPOUND_FORMS_LOWER: dict[str, str] = {f.lower(): f for f in COMPOUND_FORMS}
SINGLE_FORMS_LOWER: dict[str, str] = {f.lower(): f for f in SINGLE_FORMS}
ALL_FORMS_LOWER: dict[str, str] = {f.lower(): f for f in ALL_FORMS}

# Abbreviated compound form aliases: map common abbreviations to canonical names.
# These appear in the source data but are not standard form names.
COMPOUND_FORMS_LOWER["sqr tube"] = "Square Tube"
COMPOUND_FORMS_LOWER["sqr tubing"] = "Square Tubing"
ALL_FORMS_LOWER["sqr tube"] = "Square Tube"
ALL_FORMS_LOWER["sqr tubing"] = "Square Tubing"

# Size-prefix regex: starts with a decimal number (e.g. .25, .125) OR an
# integer followed by a quote (e.g. 1"), optionally followed by wall/thick/OD/ID.
# This deliberately excludes bare integers like "1018" or "6061".
SIZE_PREFIX_RE = re.compile(
    r'^((?:\d*\.\d+|\d+["\'])["\']*\s*(?:wall|thick|OD|ID)?\s*)',
    re.IGNORECASE,
)

# Known form abbreviations: tokens that look like material names but are
# actually abbreviated forms (e.g. "Sqr" for Square). H3 returns blank if the
# inferred material_name matches one of these.
FORM_ABBREVS_LOWER = {"sqr", "rect", "rnd", "hex", "sq"}


# ---------------------------------------------------------------------------
# Material heuristics
# ---------------------------------------------------------------------------

def canonical_form(token: str) -> str | None:
    """Return canonical form string for a token, or None if not recognized."""
    return ALL_FORMS_LOWER.get(token.strip().lower())


def match_form_at_end(tokens: list[str]) -> tuple[list[str] | None, str | None]:
    """
    Find a recognized form at the tail of a token list.
    Tries compound (last 2 tokens) before single (last 1 token).
    Returns (remaining_material_tokens, form) or (None, None) on no match.
    """
    if len(tokens) >= 2:
        tail = (tokens[-2] + " " + tokens[-1]).lower()
        if tail in COMPOUND_FORMS_LOWER:
            return tokens[:-2], COMPOUND_FORMS_LOWER[tail]

    if tokens:
        tail = tokens[-1].lower()
        if tail in SINGLE_FORMS_LOWER:
            return tokens[:-1], SINGLE_FORMS_LOWER[tail]

    return None, None


def apply_material_heuristics(value: str) -> tuple[str, str, str]:
    """
    Apply heuristics to a raw Material CSV value.
    Returns (material_name, form, notes). Empty strings mean 'leave blank for user.'

    Heuristic order per spec/data_import_mapping.md (generation prompt Section 1):
      H1: two-token split, second token is a recognized form keyword
      H2: single token that is not itself a form keyword → grade/name, Unspecified form
      H3: size-prefix composite → strip prefix, apply form-at-end matching to remainder
      H4: unknown → all blank
    """
    v = value.strip()
    tokens = v.split()

    # H1: exactly two tokens, second is a recognized form
    if len(tokens) == 2:
        form = canonical_form(tokens[1])
        if form:
            return tokens[0], form, ""

    # H2: single token
    if len(tokens) == 1:
        if not canonical_form(tokens[0]):
            # Not a form keyword — treat as a material grade or name
            return tokens[0], "Unspecified", ""
        # Single form keyword with no material name (e.g., bare "Tube")
        return "", "", ""

    # H3: starts with a size descriptor
    m = SIZE_PREFIX_RE.match(v)
    if m:
        remainder = v[m.end():].strip()
        rem_tokens = remainder.split()
        if rem_tokens:
            mat_tokens, form = match_form_at_end(rem_tokens)
            if form is not None and mat_tokens:  # non-empty material required
                mat_name = " ".join(mat_tokens)
                # Reject if inferred material looks like a form abbreviation
                if mat_name.lower() not in FORM_ABBREVS_LOWER:
                    return mat_name, form, "size moves to Stock Size"
            # Single-token remainder that is a material grade (not a form keyword)
            if len(rem_tokens) == 1 and not canonical_form(rem_tokens[0]):
                if rem_tokens[0].lower() not in FORM_ABBREVS_LOWER:
                    return rem_tokens[0], "Unspecified", "size moves to Stock Size"

    # H4: unknown — leave blank for the user
    return "", "", ""


# ---------------------------------------------------------------------------
# Vendor helpers
# ---------------------------------------------------------------------------

def normalize_vendor_fuzzy(name: str) -> str:
    """Normalize vendor name for variant detection (not for display)."""
    n = name.lower()
    n = re.sub(r"['\",.]", "", n)             # strip apostrophes, quotes, commas, dots
    n = re.sub(r"\.(com|net|org|io)$", "", n) # strip domain TLDs
    for suffix in (" inc", " corp", " llc", " labs", " co", " ltd"):
        if n.endswith(suffix):
            n = n[: -len(suffix)]
            break
    return n.strip()


def find_vm_variant(csv_str: str, vm_names: list[str]) -> str | None:
    """
    Return a Vendor Master name that looks like a variant of csv_str, or None.
    Detects prefix/suffix containment after normalization (e.g., "Bambu" ~ "Bambu Labs").
    Requires both normalized strings to be >= 4 chars to prevent short acronyms
    (e.g., "AME", "ABS") from spuriously matching longer strings.
    Called only after exact and case-insensitive matching have already failed.
    """
    norm = normalize_vendor_fuzzy(csv_str)
    if not norm:
        return None
    for vm in vm_names:
        vm_norm = normalize_vendor_fuzzy(vm)
        if not vm_norm or norm == vm_norm:
            # vm_norm == norm would have been caught by case-insensitive match
            continue
        # Both sides must be at least 4 chars to avoid acronym false positives
        if min(len(norm), len(vm_norm)) < 4:
            continue
        if norm in vm_norm or vm_norm in norm:
            return vm
    return None


# ---------------------------------------------------------------------------
# CSV readers
# ---------------------------------------------------------------------------

def read_part_master() -> tuple[Counter, Counter]:
    """
    Return (material_counter, vendor_counter) for non-stub Part Master rows.
    Stub rows (blank Internal Part Number) are skipped per spec Section 2.
    """
    mat_counter: Counter = Counter()
    vend_counter: Counter = Counter()

    with open(PART_MASTER_CSV, encoding="utf-8-sig", newline="") as fh:
        reader = csv.reader(fh)
        next(reader)  # skip header
        for row in reader:
            if not row or not row[PM_PART_NUMBER_IDX].strip():
                continue
            mat = row[PM_MATERIAL_IDX].strip() if len(row) > PM_MATERIAL_IDX else ""
            if mat:
                mat_counter[mat] += 1
            vend = row[PM_VENDOR_IDX].strip() if len(row) > PM_VENDOR_IDX else ""
            vend_counter[vend] += 1  # blank vendor included in count

    return mat_counter, vend_counter


def read_vendor_master() -> list[str]:
    """Return all non-null Vendor Name values from Vendor Master (in file order)."""
    names: list[str] = []
    with open(VENDOR_MASTER_CSV, encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            name = row.get("Vendor Name", "").strip()
            if name:
                names.append(name)
    return names


# ---------------------------------------------------------------------------
# Row generators
# ---------------------------------------------------------------------------

def generate_material_rows(mat_counter: Counter) -> tuple[list[dict], dict]:
    stats = {"h1": 0, "h2": 0, "h3": 0, "blank": 0}
    rows: list[dict] = []

    for value in sorted(mat_counter, key=lambda s: s.lower()):
        mat_name, form, notes = apply_material_heuristics(value)

        if mat_name:
            if notes == "size moves to Stock Size":
                stats["h3"] += 1
            elif form == "Unspecified":
                stats["h2"] += 1
            else:
                stats["h1"] += 1
        else:
            stats["blank"] += 1

        rows.append({
            "csv_material_value": value,
            "material_name": mat_name,
            "form": form,
            "notes": notes,
        })

    return rows, stats


def generate_vendor_rows(
    vend_counter: Counter, vm_names: list[str]
) -> tuple[list[dict], dict]:
    vm_exact: set[str] = set(vm_names)
    vm_lower: dict[str, str] = {}  # lowercase → canonical (first occurrence wins)
    for n in vm_names:
        k = n.lower()
        if k not in vm_lower:
            vm_lower[k] = n

    pm_vendors_lower = {v.lower() for v in vend_counter if v}

    stats = {"exact": 0, "casing": 0, "variant": 0, "promote": 0, "import_only": 0}
    rows: list[dict] = []

    for vend_str in sorted(vend_counter, key=lambda s: s.lower()):
        if not vend_str:
            rows.append({
                "csv_vendor_string": "",
                "canonical_vendor_name": "",
                "action": "drop",
                "notes": "no vendor assigned — Parts import with defaultVendorId null",
            })
            continue

        count = vend_counter[vend_str]

        if vend_str in vm_exact:
            rows.append({
                "csv_vendor_string": vend_str,
                "canonical_vendor_name": vend_str,
                "action": "map_to_existing",
                "notes": "",
            })
            stats["exact"] += 1

        elif vend_str.lower() in vm_lower:
            canonical = vm_lower[vend_str.lower()]
            rows.append({
                "csv_vendor_string": vend_str,
                "canonical_vendor_name": canonical,
                "action": "map_to_existing",
                "notes": "casing fix",
            })
            stats["casing"] += 1

        else:
            candidate = find_vm_variant(vend_str, vm_names)
            if candidate:
                rows.append({
                    "csv_vendor_string": vend_str,
                    "canonical_vendor_name": "",
                    "action": "",
                    "notes": f"possible variant of: {candidate}",
                })
                stats["variant"] += 1
            else:
                rows.append({
                    "csv_vendor_string": vend_str,
                    "canonical_vendor_name": vend_str,
                    "action": "promote",
                    "notes": f"{count} {'parts use' if count != 1 else 'part uses'} this",
                })
                stats["promote"] += 1

    # import_only: VM entries with no Part Master reference (case-insensitive)
    seen: set[str] = set()
    for vm_name in vm_names:
        if vm_name in seen:
            continue  # skip duplicates in VM (e.g., Bulloch appears twice)
        seen.add(vm_name)
        if vm_name.lower() not in pm_vendors_lower:
            rows.append({
                "csv_vendor_string": vm_name,
                "canonical_vendor_name": vm_name,
                "action": "import_only",
                "notes": "in Vendor Master, no Part references",
            })
            stats["import_only"] += 1

    rows.sort(key=lambda r: r["csv_vendor_string"].lower())
    return rows, stats


# ---------------------------------------------------------------------------
# CSV writer
# ---------------------------------------------------------------------------

def write_csv(path: Path, fieldnames: list[str], rows: list[dict]) -> None:
    with open(path, "w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        writer.writerows(rows)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    for src in (PART_MASTER_CSV, VENDOR_MASTER_CSV):
        if not src.exists():
            sys.exit(f"ERROR: source file not found: {src}")

    OUT_DIR.mkdir(exist_ok=True)

    print("Reading Part Master...")
    mat_counter, vend_counter = read_part_master()

    print("Reading Vendor Master...")
    vm_names = read_vendor_master()
    vm_unique = len(set(vm_names))
    vm_dupes = len(vm_names) - vm_unique

    # ── Material map ──────────────────────────────────────────────────────────
    print("\n=== material_normalization.csv ===")
    mat_rows, mat_stats = generate_material_rows(mat_counter)
    write_csv(MATERIAL_OUT, ["csv_material_value", "material_name", "form", "notes"], mat_rows)

    total_mat = len(mat_rows)
    h_total = mat_stats["h1"] + mat_stats["h2"] + mat_stats["h3"]
    print(f"  Distinct Material values:   {total_mat}")
    print(f"  H1 (two-token + form):      {mat_stats['h1']}")
    print(f"  H2 (grade/name only):       {mat_stats['h2']}")
    print(f"  H3 (size-prefix strip):     {mat_stats['h3']}")
    print(f"  Heuristic total:            {h_total}")
    print(f"  Blank (user fills in):      {mat_stats['blank']}")
    print(f"  Written to: {MATERIAL_OUT}")

    # ── Vendor map ────────────────────────────────────────────────────────────
    print("\n=== vendor_normalization.csv ===")
    vend_rows, vend_stats = generate_vendor_rows(vend_counter, vm_names)
    write_csv(VENDOR_OUT, ["csv_vendor_string", "canonical_vendor_name", "action", "notes"], vend_rows)

    total_vend = len(vend_rows)
    pm_distinct = len(vend_counter)
    pm_blank = vend_counter.get("", 0)
    print(f"  VM rows (non-null):         {len(vm_names)} ({vm_unique} unique{', ' + str(vm_dupes) + ' dup' if vm_dupes else ''})")
    print(f"  Distinct PM vendor strs:    {pm_distinct} (incl. {pm_blank} blank)")
    print(f"  Total output rows:          {total_vend}")
    print(f"  map_to_existing (exact):    {vend_stats['exact']}")
    print(f"  map_to_existing (casing):   {vend_stats['casing']}")
    print(f"  possible variant:           {vend_stats['variant']}")
    print(f"  promote:                    {vend_stats['promote']}")
    print(f"  import_only:                {vend_stats['import_only']}")
    print(f"  (blank/drop row):           1")
    print(f"  Written to: {VENDOR_OUT}")

    # ── Sample output ─────────────────────────────────────────────────────────
    print("\n--- First 10 rows of material_normalization.csv ---")
    for r in mat_rows[:10]:
        print(f"  {r['csv_material_value']!r:40s}  mat={r['material_name']!r:20s}  form={r['form']!r:20s}  notes={r['notes']!r}")

    print("\n--- First 10 rows of vendor_normalization.csv ---")
    for r in vend_rows[:10]:
        print(f"  {r['csv_vendor_string']!r:35s}  canonical={r['canonical_vendor_name']!r:30s}  action={r['action']!r:20s}  notes={r['notes']!r}")


if __name__ == "__main__":
    main()
