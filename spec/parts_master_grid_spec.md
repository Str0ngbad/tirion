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
| partType | Type | Part.partType | enum | "Part" or "Assembly" |
| procurementCategory | Proc | Part.procurementCategory.categoryCode | string | Nullable; compact display with categoryName on hover; filter UI shows both |
| isActive | Active | Part.isActive | boolean | Soft-delete indicator |

**Material:**

| Column ID | Display Name | Source | Type | Notes |
|-----------|--------------|--------|------|-------|
| materialName | Material | Part.materialSpec.materialName | string | Nullable |
| materialForm | Form | Part.materialSpec.form | string | Nullable; separate column for filter purposes |
| stockSize | Stock Size | Part.stockSize | string | Nullable; free text |
| blankLength | Length | Part.blankLength | decimal | Nullable |

**Vendor & Purchasing:**

| Column ID | Display Name | Source | Type | Notes |
|-----------|--------------|--------|------|-------|
| defaultVendorName | Vendor | Part.defaultVendor.vendorName | string | Nullable |
| vendorPartNumber | Vendor Part# | Part.vendorPartNumber | string | Nullable |

**Manufacturing:**

| Column ID | Display Name | Source | Type | Notes |
|-----------|--------------|--------|------|-------|
| processTypes | Routing | Derived: process types in routing | chips | ProcessTypeChip[]; non-sortable; filterable via include/exclude matrix; compact display with full template name and process list on hover |
| machineCycleTime | Cycle Time | Part.machineCycleTime | int | Nullable; minutes per part |
| numberOfSetups | Setups | Part.numberOfSetups | int | Nullable |

**Inventory:**

| Column ID | Display Name | Source | Type | Notes |
|-----------|--------------|--------|------|-------|
| stockCount | Stock | Part.stockCount | int | Defaults to 0; see "Stock Count Type" note below |
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
| partCostUpdatedAt | Cost Updated | Part.partCostUpdatedAt | datetime | Nullable; auto-managed |

**Relations:**

| Column ID | Display Name | Source | Type | Notes |
|-----------|--------------|--------|------|-------|
| usedInCount | Used In | Derived: count of BOM records where this Part is a child | int | Read-only; surfaces the count of parent assemblies that reference this Part as a child. Useful for identifying parts considered for deactivation. |

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
| chips | By aggregate string (alphabetical) | Non-sortable for processTypes (list has no natural sort key); sort behavior applies to any future sortable chips column |

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

---

## Column-Header Menu

Each column header surfaces a small chevron icon adjacent to the
column name. The chevron is always visible (not hover-conditional)
so the affordance is discoverable on every header. Right-click on
the column header opens the same menu as clicking the chevron.

The menu's items vary based on the column's current state and the
column's sort eligibility. Items are organized into three groups
separated by dividers:

### Sort Options

Sort options appear for all columns except the Routing column
(which is not sortable because its underlying data is a list of
process types with no natural sort key — see "Routing Column
Non-Sortable" note below).

| Menu Item | When Shown | Behavior |
|-----------|------------|----------|
| Sort ascending | Always (except Routing) | Sort by this column ascending, replacing any existing sort |
| Sort descending | Always (except Routing) | Sort by this column descending, replacing any existing sort |
| Add to sort | Only when another sort is already active AND this column is not currently in the sort | Adds this column to the existing sort stack as the next-priority sort. Direction defaults to ascending; user can change in the Active Sorts chrome |
| Clear sort | Only when this column is currently in the sort | Removes this column from the sort stack |

When a column is currently part of the sort, its header shows a
direction arrow (↑ ascending, ↓ descending) next to the column
name. The arrow is the column-level indication of sort state.
Priority (which column is primary, secondary, etc.) is shown in
the Active Sorts chrome rather than on the headers themselves —
this keeps headers compact and consolidates sort state in a
single place that remains visible even when columns scroll
off-screen or are covered by the Part Form panel.

### Filter

| Menu Item | When Shown | Behavior |
|-----------|------------|----------|
| Filter | Always | Opens the type-appropriate filter popover for this column (see Filter Operator Inventory) |

When a filter is active on a column, a funnel icon appears on the
column header adjacent to the column name. Hovering the funnel
shows a tooltip describing the active filter in plain language
(e.g., "Material contains 'Alum'"). The funnel disappears when
the filter is cleared.

### Visibility

| Menu Item | When Shown | Behavior |
|-----------|------------|----------|
| Hide column | Always | Hides this column in the active View. Re-adding the column requires opening the Columns picker (see Columns Picker section) |

### Routing Column Non-Sortable

The Routing column displays an unordered list of process types
(ProcessTypeChip[]). A list has no natural sort key — sorting by
"first chip alphabetically" or "number of chips" or "any chip
matching a given process" would each produce different orderings,
none of them clearly correct.

Users who want to sort by routing-related criteria filter by
routing presence/absence via the include/exclude matrix and sort
by a different column (e.g., materialName, materialForm, or
defaultVendorName).

The Routing column's header menu therefore omits the Sort
ascending, Sort descending, and Add to sort options. The Filter
and Hide column options behave normally.

---

## Active Sorts Chrome

When one or more sorts are active, the Active Sorts chrome area
appears in the grid toolbar. This area is placed adjacent to the
Columns picker (documented in a subsequent section) since both
are grid-configuration controls that manipulate the active
View's state.

The chrome area is labeled "Active Sorts" and displays the
current sort stack as a horizontal sequence of pills, ordered
from primary (leftmost) to least-priority (rightmost):

  Active Sorts: [① Material ↑] [② Length ↑] [③ Stock Size ↑]

Each pill displays:
- A priority number in a small circular badge (① = primary,
  ② = secondary, etc.)
- The column display name
- The current sort direction arrow (↑ ascending, ↓ descending)
- A close (×) affordance to remove this column from the sort

Pill interactions:
- Click on a pill's direction arrow toggles ascending/descending
  for that column
- Drag a pill horizontally to reorder it within the stack (changes
  priority; visual feedback during drag shows where the pill will
  land)
- Click the × on a pill removes that column from the sort entirely

When no sort is active, the Active Sorts area displays "No sort
applied" in muted text or collapses entirely (visual treatment is
an implementation detail that can be tuned based on density
preferences in practice).

### Priority Convention

Sort priority is 1-based with 1 = primary. The intuitive reading:
the column with priority 1 is the "first" or "most important"
sort, and ties within that primary column are broken by priority
2, then priority 3, and so on.

This is the convention used in the Active Sorts chrome's badge
numbers. Column headers themselves show only the direction arrow
(no priority badge) — priority lives exclusively in the chrome
area so it remains visible regardless of which columns are
on-screen.

### Visibility Through Layout Changes

The Active Sorts chrome stays in place even when the grid is
pushed to 67% width by the Part Form panel. This is structurally
important: as columns scroll off-screen or are covered by the
panel, the chrome area is the only persistent indicator of which
sorts are applied. Users can review and adjust their sort stack
without needing all sorted columns to be visible.

---

## Single-Click vs Menu Sort Interaction

### Single Click on Column Header

Clicking a column header (not the chevron, but the header text or
any non-chevron area) initiates the primary sort interaction:

- First click: sort by this column ascending, replacing any
  existing sort
- Second click on the same header: toggle to descending
- Third click on the same header: clear the sort entirely

This is the standard spreadsheet behavior for the primary header
interaction. It is fast and intuitive for single-column sort.

Single-click does not stack — it replaces. To stack sorts, users
use the chevron menu's "Add to sort" option, or the shift-click
shortcut.

### Shift-Click Shortcut

Shift-clicking a column header adds that column to the existing
sort stack. The new column is added as the next-priority sort
(secondary if the stack had one column, tertiary if two, etc.).
Direction defaults to ascending; users can toggle direction via
the Active Sorts chrome or by re-clicking the column header (a
shift-click on a column already in the sort toggles its
direction within the stack).

Shift-click is a power-user shortcut for users coming from
spreadsheet experience. The chevron menu's "Add to sort" option
is the primary discoverable path. Both produce the same result.

### Chevron Menu Options

The chevron menu options are documented in detail in the
Column-Header Menu section above. The "Sort ascending" / "Sort
descending" / "Add to sort" / "Clear sort" options in the menu
produce the same outcomes as the corresponding click and
shift-click interactions, but via an explicit, discoverable
affordance.

### Multi-Column Sort Storage

Multi-column sort is stored as an ordered array on the View. The
data model is documented in the Views System section (a
subsequent commit).

---

## Filter System

Filters are accessed via the column-header chevron menu's "Filter"
option, which opens a popover anchored to the column header. The
popover varies by column data type but follows a consistent
interaction model: the user picks an operator, enters or selects
values, clicks Apply to commit, or clicks Clear to remove any
existing filter on this column.

Filter state lives in the active View. Filters across columns
combine via AND only — every active filter must be satisfied for
a row to appear. (AND-only combination rule rationale is in the
Views System section.)

### Common Interaction Model

Every filter popover, regardless of data type, follows the same
structure:

- **Header** showing the column name being filtered
- **Operator selector** (dropdown or radio buttons depending on
  options count) for choosing the filter operator
- **Value input area** that adapts to the chosen operator (one
  field for single-value operators, two fields for range
  operators, a multi-select list for multi-select operators, etc.)
- **Apply button** — commits the filter to the View's state,
  closes the popover, applies the filter to the grid
- **Clear button** — removes any existing filter on this column,
  closes the popover, restores unfiltered display for this column
- **Cancel button or popover close (×)** — closes the popover
  without applying changes; any pending value edits are discarded

Pressing Enter while focus is in a value input is equivalent to
clicking Apply. Pressing Escape is equivalent to Cancel.

The Apply-then-commit model means partial edits never affect the
grid. Users can experiment with operator choices and values
without seeing the grid filter and re-filter on every keystroke.

### Filter Indicators

When a filter is active on a column, a funnel icon appears on the
column header adjacent to the column name (also documented in the
Column-Header Menu section). Hovering the funnel displays a
tooltip describing the active filter in plain language. Examples:

- Text: "Material contains 'Alum'"
- Numeric: "Stock greater than 50"
- Range: "Cost between $10 and $100"
- Date: "Cost Updated after 2026-01-01"
- Multi-select: "Material is any of: 6061 Aluminum, 304 Stainless"
- Routing: "Routing includes Machine and excludes Distribution"

The funnel icon disappears when the filter is cleared via the
popover or via the column-header menu's "Clear filter" option
(which clears without opening the popover).

### Multi-Value Behavior

Multi-select operators (is any of) allow multiple selected values
natively — the user picks multiple options from the list, all
selected values are matched via implicit OR within the column.

Single-value operators (contains, equals, greater than, before,
etc.) accept exactly one value. The popover does not support
multiple filters of the same operator on the same column (e.g.,
"contains 'A' OR contains 'B'" is not expressible via the
standard filter UI). This is a deliberate simplification — users
who need OR-style behavior across multi-value text matching can
use a saved View as a pre-filtered subset and narrow from there,
or use the multi-select operator on a categorical column where
the OR semantics are native.

### Popover by Data Type

Each data type has a specific popover layout. The structure
follows the Common Interaction Model above; only the operator
selector and value input vary.

#### String and URL Columns

**Operator selector:** dropdown listing the eight string
operators (contains, does not contain, equals, does not equal,
starts with, ends with, is empty, is not empty).

**Value input:** single text input. Hidden for "is empty" and
"is not empty" operators (no value needed).

Default operator on first open: "contains".

#### Integer and Decimal Columns

**Operator selector:** dropdown listing the nine numeric
operators (equals, does not equal, greater than, greater than or
equal, less than, less than or equal, between, is empty, is not
empty).

**Value input:**
- For "equals", "does not equal", "greater than", "greater than
  or equal", "less than", "less than or equal": single numeric
  input
- For "between": two numeric inputs labeled "From" and "To"
  (inclusive range). Validation: "To" must be >= "From"; if
  invalid, the Apply button is disabled and an inline error
  message explains the constraint.
- For "is empty" and "is not empty": no value input

Default operator on first open: "equals".

#### Boolean Columns

**Operator selector:** two-option radio (is true / is false).
No separate value input; the operator IS the value.

Default operator on first open: "is true" (most boolean filters
in this grid are about "show me active records" style queries).

#### Enum and Standard Chips Columns

**Operator selector:** none — only one operator ("is any of") is
supported, so the operator selector is replaced by an inline
label "Show rows where {column} is any of:".

**Value input:** multi-select list showing all available values
for this column as checkboxes. Each list item shows the value's
display text. For columns using compact-with-tooltip display
(procurementCategory in particular), the list shows the full
context (e.g., "CTL — Cut to Length") so users can select by
meaning rather than abbreviation.

- Selected values are checked; deselected values are unchecked
- At least one value must be selected for the filter to apply
  (Apply button disabled when zero are selected)
- A "Select all" / "Deselect all" toggle in the popover header
  speeds up bulk operations

Default state on first open: all values deselected. (User must
pick at least one to apply.)

#### Datetime Columns

**Operator selector:** dropdown listing the six datetime
operators (equals, before, after, between, is empty, is not
empty).

**Value input:**
- For "equals", "before", "after": single date picker
- For "between": two date pickers labeled "From" and "To"
  (inclusive range). Validation: "To" must be on or after "From";
  Apply disabled when invalid.
- For "is empty" and "is not empty": no value input

Default operator on first open: "after".

Time-of-day is not surfaced in the date pickers for Rev 1 — date
filters operate at day granularity (a "before 2026-05-31" filter
matches anything with a timestamp before midnight UTC on that
date). Time-of-day precision can be added in Rev 2 if
operationally needed.

#### Routing Column (Special Case)

The Routing column's filter popover differs structurally from
other categorical filters because its data is a list of process
types per Part, not a single value.

**Layout:** the popover shows a table with one row per process
type (9 rows total for the current Rev 1 ProcessType set). Each
row has:

- The process type's display label (with the ProcessTypeChip
  color for quick visual identification)
- A three-option radio: Include / Exclude / Unconstrained

Rows can be set independently. The user can mark Machine as
Include, Distribution as Exclude, and leave the other seven as
Unconstrained. The filter applies as follows:

- A row in "Include" state requires the Part's routing to
  include that process type
- A row in "Exclude" state requires the Part's routing to NOT
  include that process type
- A row in "Unconstrained" state applies no filter for that
  process type

Multiple non-unconstrained rows combine via AND: a Part must
satisfy every active include/exclude constraint to appear in the
results.

**Apply behavior:** the Apply button commits the entire matrix
state to the View's filters. If all rows are Unconstrained
(effectively no filter), Apply removes any existing Routing
filter from the View.

**Clear behavior:** the Clear button resets all rows to
Unconstrained and removes the Routing filter from the View.

**Default state on first open:** all rows Unconstrained.

The Routing filter popover is wider than other filter popovers
to accommodate the 9-row matrix. This is an accepted visual
trade-off — the matrix UI is the right pattern for the data
shape, and Routing is the only column requiring this width.

---

## Views System

A View is a saved configuration of column visibility, ordering,
sort, and filters. Views are named and shared across all users.
Users switch between Views via a dropdown in the toolbar; users
can create new Views by saving an ad-hoc configuration, and they
can modify existing Views (with one exception, the Master View,
documented below).

The Views system enables the spreadsheet-parity interrogation
pattern: common operational questions get encoded as Views,
reused by the whole team, and refined over time. A "Material
Audit" View answers "show me parts grouped by material with
relevant context"; an "Inventory Check" View answers "show me
parts ordered by stock level"; the Master View answers "show me
everything I might need to see."

### View Model

Each View stores the following:

| Field | Type | Notes |
|-------|------|-------|
| viewId | Int | Primary key |
| name | String | 1-30 characters, unique across the system, free text |
| isDefault | Boolean | Marks the View as the system default (loaded on first grid open) |
| isLocked | Boolean | Marks the View as locked — cannot be deleted, cannot be saved over |
| visibleColumns | Json | Ordered array of column IDs (e.g., ["partNumber", "partName", "materialName", ...]) |
| defaultSort | Json | Ordered array of { column: string, direction: "asc" \| "desc" }. Primary sort first. |
| filters | Json | Array of filter objects (shape varies by operator type; see Filter Object Shape below) |

The Json columns hold structured data that varies in shape; the
application layer parses and validates these values. Prisma's
Json type stores them as JSONB in PostgreSQL.

The schema migration for this model lands when Phase 1B Parts
Master implementation begins. This spec describes the model;
implementation builds it.

### Filter Object Shape

Each filter object in the filters array describes a single active
filter:

    {
      column: string,         // the column ID being filtered
      operator: string,       // the operator name
      value: any              // shape depends on operator type
    }

Value shape by operator type:
- String/URL operators (contains, equals, etc.): string
- "is empty" / "is not empty" / "is true" / "is false": no value
  field (or null)
- Numeric single-value operators (greater than, etc.): number
- Numeric "between": { from: number, to: number }
- Date single-value: ISO date string (YYYY-MM-DD)
- Date "between": { from: string, to: string }
- Multi-select "is any of": array of selected values
- Routing include/exclude matrix: object mapping process type IDs
  to "include" | "exclude" | "unconstrained" (or omitted entries
  treated as unconstrained)

The application layer enforces the value shape per operator at
the API layer (Zod validation) and the service layer (parsing
before query construction).

### Naming Constraints

Names must be 1-30 characters and unique across the system. Names
are free text — whitespace, special characters, and unicode are
all permitted. Two Views cannot share a name; the View Management
modal surfaces this constraint with an inline validation message
when a user attempts to rename to a conflicting value.

The 30-character limit keeps the View switcher dropdown compact;
names longer than 30 characters would either truncate or wrap the
dropdown into less-readable territory.

### The Master View

Exactly one View is permanently locked as the Master View. It is
the system's baseline configuration:

- **Name**: "Master View"
- **isLocked**: true
- **isDefault**: true (loaded on first grid open)
- **visibleColumns**: every column in the inventory, in inventory
  order
- **defaultSort**: [{ column: "partNumber", direction: "asc" }]
- **filters**: []

The Master View is:
- Always present (seeded; cannot be deleted)
- Always the default (cannot have its default status removed in
  Rev 1)
- Always locked (saves to this View are disabled; users must use
  Save as new to preserve a modified state)

Users can modify the Master View in their current session
(applying filters, sorts, hiding columns, etc.). These
modifications are session-only — they exist in the user's grid
state but do not write back to the View's stored configuration.
The Save action is disabled when the active View is Master; Save
as new is available for capturing the modifications into a new
derived View.

The Master View serves as the canonical starting point for
building new Views. A user wanting to create a focused View
switches to Master, applies the filters/sort/visibility they
want, then uses Save as new to capture the configuration with a
fresh name.

Future Rev work may relax the Master View constraints (e.g.,
allowing admins to modify the locked View). For Rev 1, the
locked-and-default invariant simplifies the model and provides a
reliable "show me everything" path that always works.

### View Switcher

The View switcher is a dropdown in the grid toolbar. The trigger
displays the active View's name; the dropdown opens to show all
Views.

Ordering in the dropdown:
1. The default View (Master View in Rev 1) appears at the top
2. All other Views below, sorted alphabetically by name

Selecting a different View from the dropdown loads that View's
configuration into the grid. Any ad-hoc modifications to the
previously-active View are discarded — switching to a new View
starts from that View's saved state.

Switching back to a previously-modified View loads its saved
state again; ad-hoc modifications do not persist across View
switches. (Users who want their modifications preserved should
use Save or Save as new before switching.)

This reset-on-switch behavior is documented in the View
Modification Model section (next commit) as a core design
decision rather than a side effect.

### Bootstrap (Seed Views)

The system seeds five Views on initialization. These provide a
useful starting set that demonstrates the Views system and
answers common operational questions out of the box.

| Name | isLocked | isDefault | Description |
|------|----------|-----------|-------------|
| Master View | true | true | Every column in inventory order; sort by partNumber asc; no filters |
| Material Audit | false | false | Columns: Part Number, Part Name, Material, Form, Stock Size, Length, Vendor. Filter: isActive=true. Sort by materialName asc |
| Inventory Check | false | false | Columns: Part Number, Part Name, Stock, Location, Bin Min, Bin Max. Filter: isActive=true. Sort by stockCount asc |
| No Routing Flagged | false | false | Columns: Part Number, Part Name, Type, Proc, Material, Vendor, Routing. Filter: processTypes is empty (no routing assigned). Sort by partNumber asc |
| Part Identification | false | false | Columns: Part Number, Part Name, Proc, Material, Form, Stock Size, Length, Vendor, Routing, Stock, Location, Model, Drawing, Active. No filters. Sort by partNumber asc |

Bootstrap rationale: a fresh system with no Views would require
the application to handle the empty case specially (no Views to
switch to, no default to load, no Master to start building
from). Seeding ensures the Views table is always non-empty after
initialization. The starter Views also demonstrate the system's
capability — new users see immediately that the grid supports
saved configurations for common workflows.

### Audit Logging

Three AuditActions track View lifecycle events:

- ViewCreated: fires when a new View is saved (via Save as new
  from the View Modification Model)
- ViewUpdated: fires when an existing non-locked View is saved
  via the Save action
- ViewDeleted: fires when a non-locked View is deleted via the
  View Management Modal

These actions are in a new "Views" AuditAction category, distinct
from the "Configuration" category that holds entity-management
audit actions. Views are a layer on top of Parts; the separate
category keeps the AuditLog filtering cleaner.

Operations that do not generate AuditLog entries in Rev 1:
- Session-only View modifications (sort, filter, hide column —
  the dirty state is not persisted, so no audit event)
- View switching (navigation, not mutation)
- Default View changes (Master is always default in Rev 1; this
  only matters when admins can change the default in future revs)

The Rev 1 audit model captures the persistent mutations: a View
was created, updated, or deleted. This is sufficient
accountability for a trusted-shop context where permission
gating is absent.
