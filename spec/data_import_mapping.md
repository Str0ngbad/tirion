# Data Import Mapping Spec — Phase 1E

## 1. Purpose

This spec documents the Phase 1E one-off import of the user's prior-shop CSV data into the Tirion
development and test database. The import is not a user-facing feature; it is a developer-run
migration script that seeds the Parts library, BOM hierarchy, Vendor list, and routing templates
from four CSV files exported from the user's prior Google Sheets production tool.

The user-facing spreadsheet import capability (for ongoing or third-party use) is a separate Phase 2
concern with different requirements, a different scope, and its own spec. The Phase 1E import
described here is a one-time data migration.

The CSVs were prepared by the user before this work began. Two columns — Part Model Location and
Part Drawing Location — were deliberately omitted during that preparation step for IP-protection
reasons. Those columns do not appear in the CSV files and are not imported. The schema's
`Part.modelLink` and `Part.drawingLink` fields remain null after import; the user populates them
via the Parts Master UI if and when needed.

The user's prior tool was a Google Sheets workbook with data validation rules. Some of the data
drift documented below — particularly vendor name casing variations — traces to Google Sheets'
case-insensitive validation accepting strings that would not match a case-sensitive comparison.
These discrepancies are resolved by the vendor normalization map described in Section 3.

---

## 2. Source Files and Scope

The four source CSV files are located in the project root. Their full filenames are:

| File | Dimensions | Content |
|---|---|---|
| `Master Production Tool (Split on 09-16-25) - Part Master.csv` | 1893 rows × 33 cols | Part library: parts, materials, vendors, routing flags, costs |
| `Master Production Tool (Split on 09-16-25) - Assembly Master.csv` | 434 rows × 18 cols | Assembly parts and routing flags |
| `Master Production Tool (Split on 09-16-25) - Assembly Designer.csv` | 2386 rows × 10 cols | BOM edges (parent assembly → child part/assembly) |
| `Master Production Tool (Split on 09-16-25) - Vendor Master.csv` | 131 rows × 8 cols | Vendor contact records |

### Stub row handling at import time

Each CSV contains rows that are not real data and are skipped at import:

- **Part Master**: 43 rows are blank or junk (no Internal Part Number value). Skipped at import.
  Net real parts: 1850.
- **Assembly Master**: 63 rows have zero BOM rows in Assembly Designer. Per user decision, these
  represent historical assemblies no longer in production and are skipped at import.
  Net real assemblies: 371.
- **Assembly Designer**: 34 rows are stubs — header artifacts (rows whose Type value is the column
  heading text "DO NOT EDIT TOP ROW") and rows with NaN in the Type column. Skipped at import.
  Net real BOM edges: 2352.
- **Vendor Master**: 44 rows have a null Vendor Name (reserved IDs in the 188+ range). Skipped at
  import. Net real vendors: 87.

---

## 3. Pre-Built Normalization Maps

Two normalization CSV files must be filled in by the user before the import script runs. The
script reads these maps to resolve raw CSV values to schema-shaped data. The normalization CSV
files themselves are generated in a subsequent commit from the actual data; this section specifies
their shape and rules.

### 3.1 Material Normalization Map

**File:** `/data-import/material_normalization.csv`

**Purpose:** The Part Master CSV's `Material` column is a free-text field with approximately 103
distinct values. These values inconsistently combine material grade and material form in a single
string (e.g., "1018 Flat", "1.5" sq steel", ".25" wall Steel Square Tube"). The `MaterialSpec`
schema model stores `materialName` and `form` as separate fields with a composite unique constraint
`@@unique([materialName, form])`. This map resolves each distinct CSV value to a `(materialName,
form)` pair.

**Shape:**

```
csv_material_value,material_name,form,notes
1018 Flat,1018,Flat,
12L14,12L14,Unspecified,
.25" wall Steel Square Tube,Steel,Square Tube,size moves to Stock Size
HR,Hot Rolled Steel,Unspecified,abbreviation expanded
autom,Aluminum,Unspecified,typo
```

**Rules:**

- Rows with an empty `material_name` value mean "no MaterialSpec for Parts with this Material
  value." Parts with unmapped material values import with `materialSpecId` null.
- The `notes` column is for the user's reference during the fill-in pass. It is not consumed by the
  import script.
- The form value `Unspecified` is used when the CSV value contains only a grade or material name
  with no shape information. The script does not invent forms.
- Where the CSV value encodes size information (e.g., `.25" wall`), the size belongs in
  `Part.stockSize`, not in the MaterialSpec. The map documents this intent in the `notes` column;
  the size extraction happens at import time in the script, not via the map itself.

### 3.2 Vendor Normalization Map

**File:** `/data-import/vendor_normalization.csv`

**Purpose:** The Part Master CSV's `Vendor` column contains both Vendor Master entries (sometimes
with casing drift caused by Google Sheets' case-insensitive validation) and ad-hoc vendor name
strings that were never added to the Vendor Master. This map resolves each distinct CSV vendor
string to a canonical vendor name. The import script uses the canonical name to either match an
existing `Vendor` record or create a new one.

**Shape:**

```
csv_vendor_string,canonical_vendor_name,action,notes
Industrial Bearing,Industrial Bearing,map_to_existing,
Bluestar,BlueStar,map_to_existing,casing fix
Metals4u,Metals4U,map_to_existing,casing fix
Vevor,Vevor,promote,
vevor.com,Vevor,map_to_existing,same vendor — two CSV spellings
Genesis,Genesis,promote,22 parts use this vendor
emisupply.com,EMI Supply,promote,one-off ad-hoc vendor name
,,,blank — Parts with no Vendor import with defaultVendorId null
```

**Action values:**

- `map_to_existing` — the CSV vendor string resolves to a vendor that already exists in the Vendor
  Master. The `canonical_vendor_name` matches an existing `Vendor.vendorName` after casing or
  spelling correction.
- `promote` — the CSV vendor string refers to a vendor that does not exist in the Vendor Master and
  should be created during import. The `canonical_vendor_name` becomes the new `Vendor.vendorName`.
  Per user decision during Phase 1E planning, promoted vendors are created with just the name; all
  other metadata fields (`contactInfo`, `location`, `website`, `notes`) are left null and the user
  populates them via the Parts Master UI after import.
- `drop` — the CSV vendor string maps to no vendor. The Part imports with `defaultVendorId` null.
- `import_only` — the vendor name exists in the Vendor Master but is not referenced by any Part in
  the Part Master CSV. The vendor record is created during import; no Part is assigned to it. The
  user can populate vendor metadata and assign Parts via the Parts Master UI after import.

CSV vendor strings that have no entry in the map are treated as unmapped values. The import script
logs them in the end-of-run report and imports the affected Parts with `defaultVendorId` null.

---

## 4. Part Master Column Mapping

`Part.partType` is set to `"Part"` for all rows imported from the Part Master. `Part.isActive`
defaults to `true`. `Part.routingTemplateDefinitionId` is assigned per Section 6 (routing template
synthesis), not per any single CSV column.

| CSV Column | Disposition | Schema Target | Notes |
|---|---|---|---|
| Internal Part Number | Import | `Part.partNumber` | Skip rows where this is blank |
| Part Name | Import | `Part.partName` | |
| Part Model Location | Drop | — | Withheld for IP protection; `Part.modelLink` stays null |
| Part Drawing Location | Drop | — | Withheld for IP protection; `Part.drawingLink` stays null |
| Location | Import | `Part.inventoryLocation` | |
| Vendor Part ID | Import | `Part.vendorPartNumber` | |
| Stock Size | Import | `Part.stockSize` | |
| Length | Import | `Part.blankLength` | Convert to `Decimal`; skip blank values |
| Material | Import via map | `Part.materialSpecId` | Resolve via material normalization map (Section 3.1) |
| Category | Import via lookup | `Part.procurementCategoryId` | Normalize per Section 5 |
| Vendor | Import via map | `Part.defaultVendorId` | Resolve via vendor normalization map (Section 3.2) |
| Alt. Vendor Part ID | Drop | — | Schema has no alt-vendor concept |
| Alt. Vendor | Drop | — | Schema has no alt-vendor concept |
| Machine | Import (drives routing) | — | See Section 6 |
| (Unnamed: 14) | Drop | — | Header artifact — abandoned process column with no values |
| Weld | Import (drives routing) | — | See Section 6 |
| Blacken | Import (drives routing) | — | See Section 6 |
| Paint | Import (drives routing) | — | See Section 6 |
| Material Cost | Import | `Part.partCost` | Strip `$` and `,` before `Decimal` parse |
| Min. Bin Size | Drop | — | Stale data not worth bringing forward |
| Full Bin Size | Drop | — | Stale data not worth bringing forward |
| Inventory | Import | `Part.stockCount` | Treat blank as `0` |
| Date that Cost was last updated | Import | `Part.partCostUpdatedAt` | Parse as `DateTime` |
| Exception | Drop | — | Feature never adopted operationally |
| Exception Notes | Drop | — | Goes with Exception; both dropped |
| Lathe Y/N | Drop | — | Process no longer tracked in Tirion |
| Tim's notes | Drop | — | Development annotations accumulated during prior-tool use; not data |
| Used in Assembly | Drop | — | Computable from BOM at query time |
| Fusion: Machine Cycle Time | Import | `Part.machineCycleTime` | |
| Fusion: Number of Setups | Import | `Part.numberOfSetups` | |
| Order Quantity for Items Below Minimum to be Filled | Drop | — | Derived value; not a Rev 1 field |
| Total Cost to Produce | Drop | — | Derived value; not a Rev 1 field |
| Cost / .65 | Drop | — | Pricing-with-margin derivation; not a Rev 1 field |

---

## 5. Category Normalization

The Part Master `Category` column has approximately 10 distinct raw values arising from
inconsistent casing and trailing whitespace applied to five underlying categories, plus the `3D`
code for additive manufacturing parts. The import script trims whitespace and case-folds before
matching.

The four `ProcurementCategory` seed names are from commit `1c3b7fd`: Stock Cut, Pre-Cut,
Purchased, Sheet Metal.

| Raw CSV value(s) | Canonical ProcurementCategory | Notes |
|---|---|---|
| `PO`, `po` | Stock Cut | |
| `CTL`, `CTL ` (trailing space) | Pre-Cut | |
| `P`, `p`, `P ` (trailing space) | Purchased | |
| `SM` | Sheet Metal | |
| `HW` | Purchased | HW (hardware) folds into Purchased per user decision |
| `3D` | Purchased | Category itself is Purchased; the 3D Print process is driven by routing synthesis (Section 6.3), not by this field |
| (blank) | — | Part imports with `procurementCategoryId` null |

---

## 6. Routing Template Synthesis

Routing templates are synthesized from the Y/N process flag columns in the Part Master and
Assembly Master CSVs, combined with the Category column for the 3D Print special case. The
synthesis is deterministic and produces one `RoutingTemplateDefinition` per unique ordered process
shape.

### 6.1 Implicit steps

Every Part template starts with the `Purchase` and `Receive` steps (in that order) and ends with
the `Distribution` step. These are not driven by any CSV column.

Every Assembly template starts with either `Assemble` or `Weld` (per rule 6.4) and ends with
`Distribution`. Assembly templates do not include `Purchase` or `Receive`.

### 6.2 Middle steps from CSV flags

For Parts, the middle steps come from the `Machine`, `Weld`, `Blacken`, and `Paint` columns in CSV
column order. CSV column order matches manufacturing sequence: forming → joining → surface
treatment → coating. Each flag set to `"Y"` produces one step:

- Machine = Y → `Machine` step
- Weld = Y → `Weld` step
- Blacken = Y → `Blacken` step
- Paint = Y → `Paint` step

The step order in the synthesized template preserves this CSV column order.

### 6.3 3D Print exclusivity

For Parts where `Category = 3D`, the routing is fixed as:

```
Purchase → Receive → 3D Print → Distribution
```

Any `Machine`, `Weld`, `Blacken`, or `Paint` flags on a 3D Print Part are ignored for routing
synthesis purposes. The user's prior tool used `Category = 3D` as the encoding for the 3D Print
process; in Tirion, `3D Print` is a real `ProcessType` and the flag columns are bypassed for these
Parts.

If any 3D Print Parts also have `Machine`, `Weld`, `Blacken`, or `Paint` flags set to `"Y"`, the
import script reports them in the end-of-run output for the user's manual review. The synthesis
ignores those flags; the report surfaces them for awareness and potential post-import correction.

### 6.4 Assembly Weld-replaces-Assemble rule

For Assemblies, the first operative step is normally `Assemble`. If `Weld = Y` on the Assembly,
the first step is `Weld` instead — there is no separate `Assemble` step in the welded-assembly
template. Other flags (`Machine`, `Blacken`, `Paint`) still apply after `Weld`.

Per user note: a small number of Assemblies will be exceptions to this heuristic — welded
assemblies that should still carry a separate `Assemble` step, or assembled assemblies with some
welding component. The synthesis cannot detect these cases from the CSV data. The user will
identify and correct them manually after import using the Routing Template Editor.

### 6.5 Template naming

Synthesized templates use the `ProcessType.processName` values from the seed — not the CSV column
names — joined with ` + ` for multi-step middles. The implicit `Purchase`, `Receive`, and
`Distribution` steps are omitted from the template name to avoid every Part template name starting
with "Purchase + Receive."

Examples:

| Shape (middle steps only) | Template name |
|---|---|
| Parts — no middle steps | `Purchase Only` |
| Parts — Machine | `Machine` |
| Parts — Machine + Paint | `Machine + Paint` |
| Parts — Machine + Weld + Paint | `Machine + Weld + Paint` |
| Parts — Category = 3D | `3D Print` |
| Assemblies — no flags | `Assemble` |
| Assemblies — Weld = Y, no others | `Weld` |
| Assemblies — Weld = Y, Paint = Y | `Weld + Paint` |

The user accepts that template names may need editing post-import for operational clarity. The
synthesis is deterministic; renames are a post-import refinement step.

### 6.6 Template construction

The import script clusters Parts and Assemblies by their effective routing shape — the ordered
list of `ProcessType` names after applying all rules above. For each unique shape, one
`RoutingTemplateDefinition` is created with the appropriate `RoutingTemplateStep` rows. All
Parts and Assemblies sharing that shape are assigned to that template via
`Part.routingTemplateDefinitionId`.

The user's data is expected to produce roughly 8–15 distinct templates after clustering. The
actual count is confirmed during script execution when the routing cluster summary is printed in
the end-of-run report.

---

## 7. Assembly Master Column Mapping

`Part.partType` is set to `"Assembly"` for all rows imported from the Assembly Master.
`Part.isActive` defaults to `true`. Assemblies have no `materialSpecId`, no `defaultVendorId`,
and no `procurementCategoryId` — those fields are Part-specific and remain null. `Part.partCost`
for Assemblies is null at import; cost for assemblies is derived as the sum of children's cost ×
quantity.

Assembly Master rows with zero BOM rows in Assembly Designer (63 records) are skipped per user
decision. They represent historical assemblies no longer in use.

| CSV Column | Disposition | Schema Target | Notes |
|---|---|---|---|
| Assembly ID | Import | `Part.partNumber` | |
| Assembly Name | Import | `Part.partName` | |
| Machine | Import (drives routing) | — | See Section 6 |
| Tumble | Drop | — | Retired process type; not in Tirion's ProcessType seed |
| Weld | Import (drives routing) | — | Applies Weld-replaces-Assemble rule (Section 6.4) |
| Blacken | Import (drives routing) | — | See Section 6 |
| Paint | Import (drives routing) | — | See Section 6 |
| Location | Drop | — | URL field pointing to prior-tool's Google Drive; not relevant to Tirion's schema |
| Exploded View Link | Drop | — | Per user decision |
| Material Cost | Drop | — | Derived for assemblies (sum of children); not stored directly |
| Assembly Model Location | Drop | — | Per user decision |
| Assembly Drawing Location | Drop | — | Per user decision |
| Inventory Location | Drop | — | Only 17 assemblies have this set; assemblies are not typically stocked |
| Referenced in Assembly Designer | Drop | — | Computable from BOM at query time |
| Price Expiry | Drop | — | Derived for assemblies |
| Role | Drop | — | Derivable from Part Number pattern; Phase 2+ feature |
| Family | Drop | — | Derivable from Part Number pattern; Phase 2+ feature |
| (Unnamed: 17) | Drop | — | Header artifact |

---

## 8. Assembly Designer BOM Mapping

| CSV Column | Disposition | Schema Target | Notes |
|---|---|---|---|
| Assembly ID | Resolve to `Part.partId` | `BOM.parentPartId` | Lookup by `partNumber` |
| Assembly Name | Drop | — | Denormalized; resolved via `partId` |
| Part ID | Resolve to `Part.partId` | `BOM.childPartId` | Lookup by `partNumber` |
| Part Name | Drop | — | Denormalized |
| Type | Drop | — | Denormalized; `partType` is on the resolved `Part` record |
| Quantity | Import | `BOM.quantity` | Parse as `Decimal` |
| Cost | Drop | — | Projection of Part Master cost data; not stored on BOM edges |
| Price Expiry | Drop | — | Projection of Part Master data |
| Location | Drop | — | Projection of Part Master data |
| Child ID | Drop | — | Derivable from Part Number per user decision |

Rows with `Type = NaN` and stub rows (e.g., "DO NOT EDIT TOP ROW" header artifacts) are skipped.
Net real BOM edges after filtering: 2352.

Referential integrity of the Assembly Designer data is clean — during the mapping session it was
confirmed that every referenced Part ID and Assembly ID exists in its respective Master file. No
orphan-handling logic is required in the import script.

The `BOM` schema model has no `displayOrder` field (removed in commit `74cd90e`). The import does
not preserve any CSV ordering for child rows; children render per the fixed Parts-first
alphabetical sort at the tree-fetch endpoint.

---

## 9. Vendor Master Mapping

`Vendor.isActive` defaults to `true`. `Vendor.leadTimeDays` is null at import. Some vendor notes
contain prose lead-time information ("2-3 month lead times," "next day delivery"); the user
populates `leadTimeDays` as a structured field via the Parts Master UI after import.

Vendor Master rows with a null `Vendor Name` (44 rows; reserved IDs in the 188+ range) are
skipped.

| CSV Column | Disposition | Schema Target | Notes |
|---|---|---|---|
| Vendor ID | Drop | — | Schema uses auto-incrementing IDs; the CSV's numeric IDs are not preserved |
| Vendor Name | Import | `Vendor.vendorName` | Skip rows where this is null |
| Vendor Location | Import | `Vendor.location` | |
| Primary Contact | Concatenate to contactInfo | `Vendor.contactInfo` | Formatted as `Name: <value>` |
| Email | Concatenate to contactInfo | `Vendor.contactInfo` | Formatted as `Email: <value>` |
| Phone | Concatenate to contactInfo | `Vendor.contactInfo` | Formatted as `Phone: <value>` |
| Website | Import | `Vendor.website` | |
| Notes | Import | `Vendor.notes` | Preserved as-is; contains operational knowledge about vendor behavior |

The `contactInfo` field is assembled by concatenating the non-null components of Primary Contact,
Email, and Phone, each on its own line:

```
Name: <Primary Contact>
Email: <Email>
Phone: <Phone>
```

If all three source columns are null, `contactInfo` is stored as null. If only some are populated,
only the populated lines appear. The concatenation is performed at import time; the field is a
single text block in the schema.

---

## 10. Script Architecture

### 10.1 Entity ordering

The import has implicit foreign-key dependencies. The script processes entity types in this order:

1. **Vendor** — depends on nothing. Import first (direct Prisma write).
2. **ProcurementCategory** — already seeded (commit `1c3b7fd`). No import action; the script
   reads existing rows by `categoryName`.
3. **ProcessType** — already seeded. No import action; the script reads existing rows by
   `processName`.
4. **MaterialSpec** — depends on nothing in the CSV data; `materialName` and `form` come from the
   normalization map. Import second (direct Prisma write).
5. **RoutingTemplateDefinition** (and `RoutingTemplateStep` rows) — synthesized from CSV data.
   Depends on `ProcessType` being present (seeded). Import third (API-driven).
6. **Part** (type `"Part"`) — depends on `Vendor`, `MaterialSpec`, `ProcurementCategory`, and
   `RoutingTemplateDefinition`. Import fourth (API-driven).
7. **Part** (type `"Assembly"`) — depends on `RoutingTemplateDefinition`. Import fifth (API-driven,
   separated from Parts for clarity; they could be interleaved but keeping them separate simplifies
   logging).
8. **BOM** — depends on all Parts and Assemblies being present. Import last (API-driven).

### 10.2 API-driven vs. direct-seed

Per the consultant-user decision during Phase 1E planning, the import uses two strategies:

- **API-driven**: Parts, Assemblies, BOM edges, and RoutingTemplateDefinitions. These go through the
  existing REST endpoint validation pipelines — cycle detection, depth enforcement, FK
  pre-validation, name collision handling. The import run serves double duty as integration
  validation of the API surface.
- **Direct-seed** (Prisma writes): Vendors and MaterialSpecs. These are simple entities with no
  interesting validation beyond name uniqueness. Direct writes are faster and the validation
  surface is already adequately tested via existing verify scripts.

`ProcurementCategory` and `ProcessType` are pre-seeded and require no import action.

### 10.3 Idempotency and re-runs

The import script is idempotent in the sense that re-running it against a database that already
contains the imported data produces no changes and no errors. Each entity type uses a
lookup-or-create strategy:

- `Vendor`: lookup-or-create by `vendorName`
- `MaterialSpec`: lookup-or-create by `(materialName, form)`
- `RoutingTemplateDefinition`: lookup-or-create by `templateName`
- `Part`: lookup-or-create by `partNumber`
- `BOM`: check for existing `(parentPartId, childPartId)` before insert

The end-of-run report includes created vs. already-existed counts for each entity type, making
partial re-runs after failure easy to diagnose.

### 10.4 Error handling

Errors during import fall into three categories:

- **Validation errors from the API** — e.g., a Part referencing a non-existent `defaultVendorId`,
  a BOM edge that would create a cycle. These are data quality issues. The script logs the
  offending CSV row identifier and continues to the next row. The end-of-run report summarizes all
  such errors.
- **Missing normalization entries** — a CSV value not covered in the normalization map. The script
  logs the value, imports the affected Part with the relevant field null (`materialSpecId` or
  `defaultVendorId`), and continues. The end-of-run report lists all unmapped values so the user
  can update the maps and re-run.
- **Hard failures** — schema mismatches, database connection errors, missing normalization map
  files. The script aborts immediately and reports the error.

### 10.5 End-of-run report

The import script prints a structured report at the end of each run:

- Count of rows processed per source CSV
- Count of rows skipped per CSV (stub rows, blank IDs, childless assemblies)
- Count of entities created vs. already-existed, per entity type
- Routing template cluster summary: template name → count of Parts and Assemblies assigned
- List of 3D Print Parts that also had `Machine`, `Weld`, `Blacken`, or `Paint` flags set (per
  Section 6.3) — flagged for user review
- List of unmapped `Material` values (CSV values not present in the material normalization map)
- List of unmapped `Vendor` strings (CSV values not present in the vendor normalization map)
- List of validation errors with the offending CSV row identifier

---

## 11. Post-Import Manual Cleanup

The import populates the database with structurally valid data but is not the end state. The user
has identified the following manual cleanup work to be done via the running Tirion application
after import:

- **Routing template exceptions**: A small number of assemblies fall outside the
  Weld-replaces-Assemble synthesis heuristic (Section 6.4) — for example, assemblies that are
  predominantly welded but still require a distinct Assemble step, or assembled assemblies with
  incidental welding. These cannot be detected from the CSV data. The user will identify them via
  the Routing Template Editor and correct their template assignments.
- **Four new ProcessTypes** in Tirion that did not exist as first-class processes in the prior tool:
  - **Receive**: in the prior tool, receiving was an implicit part of Purchase. In Tirion, every
    Part's template has `Purchase → Receive` as the opening two steps.
  - **Assemble**: in the prior tool, there was no Assembly process — assemblies were just "made."
    In Tirion, every Assembly's template starts with Assemble (unless Weld replaces it per
    rule 6.4).
  - **3D Print**: encoded hackishly in the prior tool as Category=3D. In Tirion, it's a
    first-class ProcessType applied per the Section 6.3 rule.
  - **Distribution**: the implicit terminus on every template, Part or Assembly.

  All four are handled by the synthesis rules in Section 6 and require no manual import-time work.
  Operational refinement (e.g., a historical Assembly that should have used a different process
  combination) is the user's call post-import via template reassignment in the Parts Master UI.
- **3D Print Parts with conflicting flags**: Any Parts flagged in the end-of-run report as
  `Category = 3D` with additional process flags set will need manual review. The synthesis assigns
  them the `3D Print` template; the user decides whether any additional steps are warranted.
- **Vendor metadata for promoted vendors**: Vendors that did not exist in the Vendor Master and
  were created during import (the `promote` action in the vendor normalization map) are created
  with `vendorName` only. All other fields — `location`, `contactInfo`, `website`, `notes` — are
  null and the user populates them via the Parts Master UI as needed.
- **MaterialSpec `form` values marked `Unspecified`**: Where the material normalization map
  assigned `form = Unspecified` due to insufficient information in the CSV value, the user can
  refine these later using the Parts Master or accept the default.

This cleanup is expected and acknowledged as part of the import process. The import succeeds when
the imported data is structurally valid and passes the API validation pipeline; operational
refinement happens through the running Tirion application over time.
