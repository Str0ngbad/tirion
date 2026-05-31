# Parts Master Grid

## Purpose

The Parts Master Grid is the primary surface for querying,
interrogating, and navigating the Parts library. It supports the
spreadsheet-parity interrogation pattern that operations users
depend on: filtering to answer ad-hoc operational questions, sorting
to identify patterns, and viewing structured subsets of parts data
for specific workflows.

The grid is the entry point to Part-level work — clicking a row
opens the Part Form (a side panel; see parts_master_spec.md Surface
Pattern subsection) where individual Parts are inspected and edited.
The grid stays interactive while the Part Form is open, allowing
users to navigate between Parts without closing the panel.

The grid supports a Views system: named, saved configurations of
column visibility, order, sort, and filters that can be shared
across the team. Users can build and save Views for common
operational questions ("Material Audit", "Inventory Check",
"No Routing Flagged"), modify a View on the fly without saving,
or revert ad-hoc changes back to the saved state.

---

## Scope and Boundaries

This spec covers:
- The full column list available in the Parts Master Grid
- Column display conventions (compact display with hover-tooltip for
  full context)
- Sort and filter behaviors per column data type
- The column-header menu pattern (sort, filter, hide via per-column
  chevron)
- The Views system: data model, CRUD operations, default View
  concept, lockout-prevention rules
- The Columns picker (session-level column visibility and ordering
  override)
- The View modification model (dirty state, Save / Save as new /
  Revert)
- The View Management modal
- Implementation recommendations and open questions

This spec does NOT cover:
- Part-level CRUD, validation, or business logic — see
  parts_master_spec.md
- The Part Form's behavior, sections, or fields — see
  parts_master_spec.md
- The Definition Change Flag system — see
  definition_change_flag_spec.md
- Cross-surface navigation patterns — see ADR-013

---

## Column System

### Column Display Conventions

Some columns display a compact representation by default and surface
the full context via hover-tooltip. This pattern keeps the grid dense
while preserving access to readable labels.

Columns using compact-with-tooltip display:

| Column | Compact Display | Hover Tooltip |
|--------|-----------------|---------------|
| procurementCategory | categoryCode (e.g., "CTL") | categoryName (e.g., "Cut to Length") |
| processTypes (Routing) | ProcessTypeChip[] (color + processCode) | Full template name plus ordered list of processName values |

The filter UI for these columns must surface both the compact and
the full forms, because users selecting filter values benefit from
seeing the readable label rather than just the code. For example,
the procurementCategory filter popover lists each option as "CTL —
Cut to Length" rather than just "CTL".

This convention may extend to additional columns in subsequent Rev
work. The principle: when a column has a stable short identifier
and a longer readable label, the grid shows the short identifier
with the readable label on hover; filter UIs show both.

### Column Inventory

The grid supports the following columns. Each column is identified
by a stable string identifier (used in Views' visible_columns array)
and sourced from a specific Part field or a derived computation.

**Identification:**

| Column ID | Display Name | Source | Type | Notes |
|-----------|--------------|--------|------|-------|
| partNumber | Part Number | Part.partNumber | string | Required, primary identifier |
| partName | Part Name | Part.partName | string | Required |
| description | Description | Part.description | string | Nullable |
| partType | Part Type | Part.partType | enum | "Part" or "Assembly" |
| procurementCategory | Procurement | Part.procurementCategory.categoryCode | string | Nullable; compact display with categoryName on hover; filter UI shows both |
| isActive | Active | Part.isActive | boolean | Soft-delete indicator |

**Material:**

| Column ID | Display Name | Source | Type | Notes |
|-----------|--------------|--------|------|-------|
| materialName | Material | Part.materialSpec.materialName | string | Nullable |
| materialForm | Form | Part.materialSpec.form | string | Nullable; separate column for filter purposes |
| stockSize | Stock Size | Part.stockSize | string | Nullable; free text |
| blankLength | Blank Length | Part.blankLength | decimal | Nullable |

**Vendor & Purchasing:**

| Column ID | Display Name | Source | Type | Notes |
|-----------|--------------|--------|------|-------|
| defaultVendorName | Default Vendor | Part.defaultVendor.vendorName | string | Nullable |
| vendorPartNumber | Vendor Part Number | Part.vendorPartNumber | string | Nullable |

**Manufacturing:**

| Column ID | Display Name | Source | Type | Notes |
|-----------|--------------|--------|------|-------|
| routingTemplate | Routing Template | Part.routingTemplateDefinition.name | string | Nullable; display name of template |
| processTypes | Routing | Derived: process types in routing | chips | Render as ProcessTypeChip[]; sortable by template name; compact display with full template name and process list on hover |
| machineCycleTime | Machine Cycle Time | Part.machineCycleTime | int | Nullable; minutes per part |
| numberOfSetups | Number of Setups | Part.numberOfSetups | int | Nullable |

**Inventory:**

| Column ID | Display Name | Source | Type | Notes |
|-----------|--------------|--------|------|-------|
| stockCount | Stock Count | Part.stockCount | int | Defaults to 0; see "Stock Count Type" note below |
| inventoryLocation | Location | Part.inventoryLocation | string | Nullable |
| binMin | Bin Min | Part.binMin | int | Nullable; threshold |
| binMax | Bin Max | Part.binMax | int | Nullable; threshold |

**Documentation:**

| Column ID | Display Name | Source | Type | Notes |
|-----------|--------------|--------|------|-------|
| modelLink | Model | Part.modelLink | url | Nullable; rendered as clickable link |
| drawingLink | Drawing | Part.drawingLink | url | Nullable; rendered as clickable link |

**Cost:**

| Column ID | Display Name | Source | Type | Notes |
|-----------|--------------|--------|------|-------|
| partCost | Cost | Part.partCost | decimal | Nullable; displayed in USD format |
| partCostUpdatedAt | Cost Last Updated | Part.partCostUpdatedAt | datetime | Nullable; auto-managed |

The grid renders columns in the order specified by the active View's
visible_columns array. Users can reorder columns via the Columns
picker (documented in a subsequent section); the new order persists
in the View when saved. Column identifiers are strings rather than
enums to support future schema additions (Rev 2 columns) without
breaking existing saved Views — a View referencing a column
identifier that doesn't yet exist would be silently omitted from
the rendered grid until that column is added.

#### Stock Count Type Note

The stockCount column documents its grid display type as int. The
underlying schema type is Decimal for Rev 2 forward-compatibility
(material handling in Rev 2 may require decimal stock values for
measured material like bar stock sold by the foot). Rev 1 enforces
integer-only values at the application layer: Zod validation on
Part create/update rejects non-integer values, the form input
accepts only whole numbers, and the grid renders without decimal
precision.

When Rev 2's material handling lands and decimal values become
operationally meaningful, the application-layer integer constraint
relaxes and the grid column type updates accordingly. No schema
migration is needed at that point — the schema is already
Decimal.

### Data Types and Sort Behavior

Each column has one of the following data types, which determines
its sort behavior and available filter operators:

| Type | Sort Behavior | Notes |
|------|---------------|-------|
| string | Alphabetical, case-insensitive, nulls last | Locale-aware comparison |
| int | Numeric ascending/descending, nulls last | |
| decimal | Numeric ascending/descending, nulls last | Precision preserved |
| boolean | true/false (or false/true) | |
| enum | By enum value order, nulls last | Display order matches enum order |
| datetime | Chronological ascending/descending, nulls last | |
| url | Alphabetical by URL string, nulls last | Treated as string for sort |
| chips | By aggregate string (alphabetical) | E.g., processTypes sorts by routing template name |

All columns support sort in both ascending and descending directions
via the column-header menu. Default sort direction varies by
column; some columns (partNumber) default to ascending, others
(stockCount, partCost) default to descending. Default sort
direction is documented per column in the View definition.

Nulls sort last by default in both directions. This means a column
sorted ascending shows non-null values from low to high, then null
values at the end; sorted descending shows non-null values from
high to low, then null values at the end. This is the typical
behavior for spreadsheet-style grids.

### Filter Operator Inventory

The available filter operators depend on column data type.

**string and url types:**

| Operator | Behavior |
|----------|----------|
| contains | Case-insensitive substring match |
| does not contain | Negation of contains |
| equals | Exact match (case-sensitive) |
| does not equal | Negation of equals |
| starts with | Case-insensitive prefix match |
| ends with | Case-insensitive suffix match |
| is empty | Value is null or empty string |
| is not empty | Negation of is empty |

**int and decimal types:**

| Operator | Behavior |
|----------|----------|
| equals | Exact match |
| does not equal | Negation |
| greater than | Strict comparison |
| greater than or equal | Inclusive comparison |
| less than | Strict comparison |
| less than or equal | Inclusive comparison |
| between | Inclusive range (e.g., 10–50) |
| is empty | Value is null |
| is not empty | Negation of is empty |

**boolean type:**

| Operator | Behavior |
|----------|----------|
| is true | Value is true |
| is false | Value is false |

**enum and standard chips types:**

| Operator | Behavior |
|----------|----------|
| is any of | Multi-select inclusion; value matches any selected option |

A single "is any of" operator is sufficient for categorical columns
with single-value fields (Material, Default Vendor, Part Type,
Procurement Category, etc.). Selecting the desired values is
equivalent in expressiveness to selecting values to exclude —
"show these three materials" and "exclude all materials except
these three" describe the same result set.

**datetime type:**

| Operator | Behavior |
|----------|----------|
| equals | Exact match (typically date-only comparison) |
| before | Strictly before specified date/time |
| after | Strictly after specified date/time |
| between | Inclusive range |
| is empty | Value is null |
| is not empty | Negation of is empty |

**Routing column (processTypes) — include/exclude matrix:**

The Routing column is a special case. Its data is a list of process
types per Part (the processes in that Part's routing), not a single
categorical value. Standard categorical operators ("is any of") are
insufficient because operationally meaningful questions like "show
parts whose routing does not include deburring" cannot be expressed
practically with include-only semantics — the user would need to
enumerate every other process type as included.

The Routing filter therefore uses a per-process-type include/exclude
matrix:

- Each of the 9 process types has its own row in the filter popover
- Each row offers three mutually exclusive states: include, exclude,
  or unconstrained
- A row in "include" state filters to Parts whose routing contains
  that process; a row in "exclude" state filters to Parts whose
  routing does not contain that process; "unconstrained" applies no
  filter for that process
- Multiple non-unconstrained rows combine via AND: a Part must
  satisfy every active include/exclude constraint to appear

This pattern is specific to the Routing column. Other categorical
columns (single-value enum or single-value chips) use "is any of"
only.
