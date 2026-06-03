# Data Import — Phase 1E

This directory contains the normalization map files used by the Phase 1E
one-off import script.

## Files

- `material_normalization.csv` — maps the Part Master CSV's `Material` column
  values to `MaterialSpec` (`materialName` + `form`) pairs.
- `vendor_normalization.csv` — maps Part Master `Vendor` strings to canonical
  `Vendor` records, distinguishing existing-Vendor-Master entries from
  to-be-promoted vendors.

## Lifecycle

1. **Code generates** the map files via `scripts/generate-import-maps.py`,
   applying best-effort heuristics where possible. Rows where the heuristic
   was confident are pre-filled; rows where it was not are left blank.
2. **User reviews and completes** the maps — filling in blank target columns,
   correcting any wrong heuristic guesses, and setting `action` values on
   vendor rows where the action was left blank.
3. **Import script** (`scripts/import-prior-shop-data.ts`, not yet built)
   reads the completed maps and the source CSVs and performs the import per
   `spec/data_import_mapping.md`.

## Regenerating

`scripts/generate-import-maps.py` can be re-run, but it **overwrites** the
output files. If you have done manual review work, back up the files before
regenerating. The generation script is intended as a one-shot starting point,
not a repeated step.

## Reference

See `spec/data_import_mapping.md` Section 3 for the file shape specification
and Section 10 for the script architecture.
