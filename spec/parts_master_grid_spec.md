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

---

## View Modification Model

Users frequently modify the active View's state in the course of
using the grid: applying a filter to answer a specific question,
adding a sort, hiding a column they don't need at the moment.
These ad-hoc modifications are valuable for interrogation but
may not warrant updating the saved View definition — sometimes
the user wants to explore without committing, sometimes the
modifications are exactly what should be saved, and sometimes
they should be captured as a new derived View.

The View Modification Model documents how the grid tracks and
resolves divergence between the active View's session state and
its saved state.

### Dirty State Detection

The grid compares the active View's current state against its
saved state on every state change (column visibility change,
column reorder, sort change, filter change). If any of the
comparable fields differ from the saved values, the View is
considered modified ("dirty").

Comparable fields:
- visibleColumns (array contents and order)
- defaultSort (sort stack contents and order)
- filters (filter array contents)

The comparison is by value, not by mutation history. If a user
adds a filter and then clears it, the resulting state matches
the saved state and the View is not modified. This produces the
intuitive behavior where the modified indicator reflects actual
divergence from the saved configuration.

Dirty state is session-only — it lives in the user's grid view,
not in the View record. Reloading the page or switching to
another View resets the dirty state by loading the saved
configuration fresh.

### Modified Indicator

When the active View is modified, a small dot appears next to
the View name in the View switcher dropdown trigger. The dot is
a minimal visual indicator with established convention in other
software (text editors, design tools) where it signals
"unsaved changes."

Adjacent to the View switcher (when the View is modified), the
three resolution actions surface — Save, Save as new, and
Revert — as accessible affordances. These are documented in
the next subsections.

### Save

The Save action overwrites the saved View with the current
session state. The View's visibleColumns, defaultSort, and
filters fields are updated to match what the user is currently
seeing.

Save is destructive on a shared resource: Views are shared
across all users, and saving over a View affects everyone who
uses it. The action therefore requires a confirmation gate
before committing.

**Confirmation dialog:**

  Overwrite "[View Name]"?

  This will replace the saved columns, sort, and filters with
  your current view state. Other users will see this change
  next time they load this view.

  [Cancel]  [Save]

Where [View Name] is the active View's name, substituted at
display time. Clicking Save commits the update; clicking
Cancel closes the dialog without changes. The dialog can also
be dismissed via Escape (equivalent to Cancel).

On successful save, the modified indicator clears (the View is
no longer dirty since session state now equals saved state).
The grid continues to show the current configuration; nothing
visually changes except the indicator.

**Master View exception:**

When the active View is Master View (isLocked: true), Save is
disabled. The user cannot overwrite the locked baseline. The
action either is hidden, grayed out, or surfaces a tooltip
explaining "Master View cannot be saved over; use Save as new
to capture this configuration."

Users wanting to preserve their modifications to Master must
use Save as new to create a new derived View.

### Save as New

Save as new captures the current session state as a new View,
leaving the active View's saved state unchanged.

**Interaction:**

Clicking Save as new transforms the View switcher's name
display into an inline text input. The input is focused, ready
for the user to type a name. Pressing Enter creates the new
View; pressing Escape cancels the action and restores the
View switcher's name display.

Validation surfaces inline as the user types or on Enter:

- **Empty name:** "Name is required" — Enter does nothing
  until a name is entered
- **Length exceeds 30 characters:** "Name must be 30 characters
  or fewer" — Enter does nothing until the name is shortened
- **Name conflicts with existing View:** "A View named '[X]'
  already exists" — Enter does nothing until the name is changed

On valid Enter, the new View is created with:
- name: the entered text
- isDefault: false
- isLocked: false
- visibleColumns / defaultSort / filters: the current session
  state

The newly created View becomes the active View. The View
switcher dropdown now shows it as the current selection. The
modified indicator clears (session state equals saved state of
the new View).

Save as new is available from any View — Master or
user-created, modified or unmodified. From Master, it's the
primary mechanism for creating derived Views.

### Revert

Revert discards the user's ad-hoc modifications and restores
the active View's saved state. After Revert, the modified
indicator clears.

Revert is not gated by a confirmation dialog in Rev 1. The user
loses their session work with the click but can immediately
re-apply changes if needed; the action is reversible by user
action even though it's not undoable by a system mechanism.

This trades a friction-vs-safety choice toward less friction. If
user feedback in practice surfaces accidental Reverts losing
meaningful work, a confirmation gate can be added in Rev 1.5.

### Switching Views

Switching to a different View via the View switcher dropdown
always loads the destination View's saved state. Any ad-hoc
modifications to the previously-active View are discarded.

This is documented as a deliberate design choice rather than a
side effect: each View represents a defined frame for asking a
specific question, and switching Views should enter that
frame's defined state. Carrying ad-hoc filters or column
changes across View switches would produce confusing behavior
where a View shows unexpected state based on what the user
was looking at previously.

Users who want their modifications preserved should Save or
Save as new before switching Views.

### Master View Specific Behavior

The Master View has the following modification behavior:

| Action | Behavior on Master View |
|--------|-------------------------|
| Modify (any of sort, filter, columns) | Permitted in session; modified indicator appears |
| Save | Disabled; cannot overwrite the locked baseline |
| Save as new | Permitted; creates a derived View from current state |
| Revert | Permitted; restores Master to its baseline (every column, partNumber asc, no filters) |
| Switching away | Permitted; ad-hoc modifications discarded |

Master View serves as the canonical "show everything" starting
point. Users discover the system's capabilities by working with
Master, then capture useful configurations via Save as new for
reuse.

---

## Columns Picker

The Columns picker is the comprehensive control for managing
column visibility and ordering. It complements the column-header
menu's "Hide column" option (which hides a single column from
the current surface) by providing a single place to see all
available columns, restore hidden columns, and reorder the
full column set.

The picker operates on session state — changes made in the
picker flow through the View Modification Model. Modifying
visibility or order marks the active View as modified (a small
dot appears on the View switcher); the changes persist into
the View definition only when the user explicitly saves via
Save or Save as new.

### Button and Popover

The picker is accessed via a button in the toolbar labeled with
a columns icon and the text "Columns". Click opens a popover
anchored to the button.

The popover displays a vertically-scrolling list of all columns
in the inventory. Approximately 11 columns fit in the popover's
viewport at a typical size; the remaining columns are accessed
by scrolling within the popover. The popover does not expand to
fit all content — it has a defined viewport height, and
overflow scrolls.

### Row Layout

Each row in the picker represents one column and has three
elements:

- **Checkbox** — visible state. Checked means the column is
  currently visible in the grid; unchecked means hidden.
- **Drag handle** — small icon (typically a grip pattern) used
  to drag the row to a new position.
- **Column display name** — the column's display name from the
  inventory (e.g., "Part Number", "Stock", "Proc").

The drag handle is positioned to the left of the row content
(matching common convention); the checkbox is adjacent to the
column name.

### List Order

The picker shows columns in the active View's current column
order. This order is the same as the order columns appear in
the grid (left to right in the grid corresponds to top to
bottom in the picker).

Hidden columns remain at their position in the order even
though they are not displayed in the grid. The picker is the
single source of truth for the View's complete column order;
hiding a column does not move its row in the picker, only its
checkbox changes. This produces stable row positions in the
picker that users learn over time — even after toggling
visibility, columns remain at their familiar positions.

Reordering via drag changes both the picker row order and the
grid column order simultaneously. The picker and grid always
reflect the same underlying order.

### Drag-to-Reorder

Users reorder columns by dragging rows within the picker. The
interaction follows standard vertical-list drag-and-drop:

- Hover on a row reveals the drag affordance (cursor change
  when over the drag handle, or row-level cursor change
  depending on implementation)
- Click-and-hold on the drag handle (or row, per
  implementation) picks up the row
- During drag, visual feedback shows the row's current floating
  position and indicators for valid drop locations (a line
  between rows showing where the dragged row will land if
  dropped)
- Release commits the new order

Drag-to-reorder works on any row regardless of its current
visibility state. Reordering a hidden column changes where it
would appear if made visible later, without changing what the
grid currently displays.

Reordering marks the View as modified (the View Modification
Model handles the rest — modified indicator appears on the
View switcher, Save / Save as new / Revert actions become
available).

### Visibility Toggle

Clicking a checkbox toggles the column's visibility in the
grid. Toggling has immediate effect — the grid updates as the
user clicks. The column appears or disappears at its current
ordered position.

Toggling visibility marks the View as modified.

### Master View Interaction

When the active View is Master View, the picker behaves
identically to its behavior with any other View:

- Master View shows all columns visible by default, so all
  checkboxes start checked
- Users can uncheck checkboxes to hide columns in session
- Hiding columns marks Master View as modified
- Save is disabled on Master View (consistent with the View
  Modification Model); Save as new captures the modified
  column visibility into a new derived View
- Revert restores Master View to its baseline (every column
  visible in inventory order)

### Dismissal

The popover closes when the user clicks outside it. There is
no explicit close button; the popover follows the same
dismissal pattern as the column-header filter popovers.

Closing the popover does not commit or discard changes — all
changes were already applied to the session state in real time
as the user toggled or dragged. The popover is a control
surface, not a transactional one. Reopening the popover shows
the current session state of the View.

### Restoring Hidden Columns

The picker is the primary mechanism for restoring a hidden
column to the grid. A user who hid a column via the
column-header menu's "Hide column" option reopens the picker,
finds the column's row (at its familiar position), and clicks
its checkbox to make it visible again.

The column-header menu does not have an "unhide" option for
hidden columns (because the hidden column's header is not
visible to display a menu). The picker is therefore the
required path back from hidden to visible.

---

## Active Filters Chrome

When one or more filters are active on the current View, an
Active Filters chrome area appears in the toolbar immediately
before the Active Sorts chrome. This area surfaces the active
filter state in a single persistent location regardless of
which columns are currently visible.

The chrome's existence addresses a specific operational
problem: a user can apply a filter to a column, then hide
that column via the column-header menu or the Columns picker.
Without the chrome, the filter remains active but has no
visual representation in the grid (the funnel icon on the
column header is gone since the column itself is hidden). The
user sees a filtered result set without an obvious indication
of why certain rows are absent. The Active Filters chrome
ensures that all active filters remain visible regardless of
which columns are shown.

### Visibility

The Active Filters chrome appears only when at least one
filter is active. When no filters are active, the chrome area
is hidden — the toolbar is more compact.

This matches the Active Sorts pattern (hidden when no sort is
active, visible when at least one sort is active).

### Layout

The chrome area is labeled "Active Filters:" followed by a
horizontal sequence of pills, one per active filter. Pills
display in the order filters were added to the View.

Toolbar order, left to right:

[View switcher] [Columns picker] [Active Filters] [Active Sorts]

When both Active Filters and Active Sorts are visible, they
sit adjacent in the toolbar. The visual distinction between
them (different labels, slightly different pill styling if
desired) keeps them legible without explicit separation.

### Pill Content

Each pill displays a plain-language description of the active
filter, the same description used in the column-header funnel
icon's hover tooltip. Examples:

- "Material contains 'alum'"
- "Stock greater than 50"
- "Cost between $10 and $100"
- "Cost Updated after 2026-01-01"
- "Material is any of: 6061 Aluminum, 304 Stainless"

For descriptions that exceed the pill's display width, the
pill truncates with ellipsis and the full description shows
on hover. The truncation threshold is implementation-defined
based on visual density preferences.

### Pill Affordance

Each pill has a close (×) affordance that removes the filter
when clicked. Clicking the × removes that filter from the
View's filters array. If the filter is the last remaining
active filter, the Active Filters chrome disappears.

Clicking elsewhere on the pill (the description text) opens
the column's filter popover, allowing the user to modify the
filter. This is parallel to clicking the column-header
funnel icon when the column is visible — the filter is
editable from either entry point. When the user commits the
modified filter via Apply, the pill updates to reflect the
new description.

### Routing Filter Pill

The Routing filter is structurally different from other
filters: its data is the include/exclude matrix rather than
a single operator/value pair. The pill description adapts to
the matrix's complexity:

- For 1-2 active rules (include or exclude states), the pill
  lists each rule verbosely: "Routing: includes Machine,
  excludes Distribution"
- For 3 or more active rules, the pill uses a compact count
  form: "Routing: 3 active rules" with the full breakdown on
  hover

This adapts to typical operational usage — most Routing
filters are 1-2 rules; many-rule filters are atypical but
supported.

### Interaction with Modified State

Like all filter-related actions, modifying a filter via the
Active Filters chrome (clicking × to remove, or clicking a
pill to open and edit) flows through the View Modification
Model. The View becomes modified; the Save / Save as new /
Revert actions surface as appropriate.

---

## View Management Modal

The View Management Modal is the administrative surface for
managing the View library. It complements two other View
surfaces: the View switcher (for picking a View to use) and
the View Modification Model (for capturing modifications to
the active View). The modal is where users see all Views,
rename them, and remove non-Master Views.

### Access

The modal is opened from the View switcher dropdown via a
"Manage Views..." item at the bottom of the dropdown list. This
placement is discoverable (users opening the dropdown to switch
Views see the management option), does not add toolbar chrome,
and matches the common convention for "manage the list of
things this dropdown contains."

### Layout

The modal displays a table listing all Views in the system,
with one row per View. The table has the following columns:

| Column | Notes |
|--------|-------|
| Name | View name; inline-editable on click for non-locked Views |
| Default | Indicator (e.g., a checkmark or "Default" label) showing which View is currently the system default |
| Locked | Indicator showing whether this View is locked; Master View shows a lock icon, others are blank |
| Delete | Action button or icon; disabled for the locked View (Master) |

Row order: the default View (Master View in Rev 1) appears at
the top, with all other Views below sorted alphabetically by
name. This matches the order used in the View switcher dropdown.

### Inline Rename

Clicking a non-locked View's name in the table puts that cell
into edit mode: the name becomes a text input focused for
immediate typing.

Validation:
- Empty name: "Name is required" — Enter does nothing until
  a name is entered
- Length exceeds 30 characters: "Name must be 30 characters
  or fewer"
- Name conflicts with another existing View: "A View named
  '[X]' already exists"

Validation is the same as Save as new in the View Modification
Model; the error messages should be consistent across both
surfaces.

Commit behavior:
- Pressing Enter commits the rename if valid
- Pressing Escape cancels the edit and reverts to the original
  name
- Clicking outside the edit cell treats it as Enter (commits
  if valid; surfaces error if invalid)

On successful rename, the table updates to show the new name
in its alphabetical position. The renamed View fires a
ViewUpdated audit event.

The Master View's name cannot be edited; clicking its name has
no effect (or surfaces a brief explanation, e.g., "Master View
cannot be renamed").

### Delete

Each non-locked View has a delete action in the Delete column
(an X or trash icon). Master View shows the action disabled
(grayed out) with a tooltip explaining "Master View cannot be
deleted."

Clicking the delete action for a non-locked View opens a
confirmation dialog:

  Delete "[View Name]"?

  This will remove this View for all users. Anyone currently
  using this View will be moved to the Master View on their
  next refresh.

  [Cancel]  [Delete]

Where [View Name] is the View being deleted, substituted at
display time.

On confirm:
- The View is deleted from the database
- A ViewDeleted audit event fires
- The View Management Modal updates to remove the row
- Any user with this View currently active will be transitioned
  to Master View on their next page refresh (silent move; no
  error or notification — the View switcher will simply show
  Master selected instead)

On cancel: the dialog closes without changes; the View remains.

### Master View Display

Master View appears in the modal with these characteristics:
- Top of the table (always default)
- "Default" indicator visible in the Default column
- Lock icon in the Locked column
- Disabled delete action in the Delete column with tooltip
- Name not editable (clicking has no effect or shows
  explanation)

Master View is informational in this modal — users see it
exists and that it has special status, but cannot modify it
here.

### Dismissal

The modal closes when the user clicks outside the modal, presses
Escape, or clicks an explicit close button (×) in the modal's
header. All three are equivalent — there are no pending changes
to save or discard since rename and delete operations commit
immediately when confirmed.

Reopening the modal shows the current state of the Views library.

### Sync with Concurrent Changes

If another user modifies the Views library while the modal is
open (renames a View, deletes a View, etc.), the modal does
not automatically update — it shows a snapshot from when the
modal was opened. The user can close and reopen the modal to
see the current state. For Rev 1 this is acceptable; concurrent
rename/delete operations are rare in small-shop environments,
and the small risk of acting on stale data is bounded.

---

## Implementation Recommendations

These recommendations are starting points for the Phase 1B
Parts Master implementation track. They are sufficient to begin
work without re-deriving design decisions from this spec, but
they leave room for implementation-track judgment on details
not specified here.

### View Model Schema

The View model (documented in the Views System section) lands
as part of Phase 1B's Parts Master backend implementation. The
Prisma model:

  model View {
    viewId          Int      @id @default(autoincrement())
    name            String   @unique
    isDefault       Boolean  @default(false)
    isLocked        Boolean  @default(false)
    visibleColumns  Json
    defaultSort     Json
    filters         Json
  }

The three Json columns hold structured data; the application
layer validates shapes via Zod before persisting and parses
shapes on read. Prisma's Json type serializes to JSONB in
PostgreSQL.

Naming uniqueness is enforced by the database unique
constraint plus application-layer collision detection (the
P2002 helper pattern from lib/db/p2002.ts, when that helper is
extracted per the existing backlog entry).

### API Endpoints

The grid's Views system requires CRUD endpoints. The
recommended REST structure:

- GET /api/v1/views — list all Views (returns ordered array
  with default View first, others alphabetical)
- POST /api/v1/views — create a new View (used by Save as new)
- GET /api/v1/views/[id] — fetch a single View by ID
- PATCH /api/v1/views/[id] — update an existing View (used by
  Save and inline rename)
- DELETE /api/v1/views/[id] — delete a non-Master View

All mutating endpoints require X-User-Id; all use mutateWithAudit
for ViewCreated, ViewUpdated, or ViewDeleted audit logging as
appropriate.

Validation:
- POST and PATCH validate name (1-30 chars, unique check via
  P2002 detection)
- DELETE rejects requests targeting Views with isLocked: true
- Master View's name and isDefault and isLocked fields cannot
  be modified via PATCH; the service rejects such attempts

### Bootstrap Seed Implementation

The five seed Views (documented in the Views System section)
are added to prisma/seed.ts during Phase 1B:

- A new seedViews function upserts the five Views keyed on
  name. The upsert pattern matches seedProcurementCategories
  and other configuration entity seeding.
- Three new AuditActions land in the Views category alongside
  seedAuditActions.
- Verification log expectations update: Views: 5 (expected = 5)
  and AuditActions: 70 (was 67, +3 for Views).

### Filter Query Construction

Each filter operator maps to a specific Prisma where clause
construction. The mapping is mechanical but worth documenting
for implementation reference:

- **String contains/starts with/ends with**: Prisma string mode
  contains/startsWith/endsWith filters with mode: 'insensitive'
- **String equals/does not equal**: Prisma equals filter with
  mode: 'default' (case-sensitive)
- **Numeric operators**: Prisma equals, gt, gte, lt, lte
  filters; "between" uses gte + lte combination
- **Date operators**: Prisma equals, gt, lt filters on the
  datetime field; "between" uses gte + lte
- **Multi-select (is any of)**: Prisma in filter with the
  selected values array
- **is empty / is not empty**: Prisma equals null / not null
- **Routing include/exclude matrix**: per process type with
  "include" maps to a some clause on routing template steps
  requiring that process type; "exclude" maps to a none clause
  on routing template steps not requiring that process type;
  multiple constraints combine via AND in the where clause

The implementation should encapsulate filter-to-Prisma
translation in a helper (e.g., lib/grids/filter-builder.ts)
rather than scattering the logic across route handlers.

### Multi-Column Sort Query Construction

Prisma's orderBy accepts an ordered array of sort specifications.
Multi-column sort translates directly:

  orderBy: [
    { partNumber: 'asc' },
    { materialSpec: { materialName: 'asc' } },
    { stockSize: 'asc' }
  ]

Relation-based columns (materialName, defaultVendorName,
routingTemplate name, etc.) use nested Prisma syntax. The
column inventory's Source field tracks the join path for each
column.

Implementation should encapsulate sort-to-Prisma translation
similarly to filter translation, in a helper that takes the
ordered sort array and returns the Prisma orderBy clause.

### Chips Condense Toggle

The Parts Master Grid's Routing column displays
ProcessTypeChip[] in either condensed (color-only chip) or
expanded (color + process code text) form. The toggle between
forms is the same pattern documented in execution lens specs
(see operations_lens_spec.md and project_view_spec.md).

For Rev 1, the grid implements this toggle following the
established pattern. A toggle control in the toolbar (or via
the View's column display settings; implementation may choose)
switches the Routing column between condensed and expanded.
When chips are condensed, the routing legend (also documented
in execution specs) provides the color-to-process-type mapping
in the toolbar.

### Filter Object Validation

The Filter Object Shape (documented in the Views System
section) varies by operator. Implementation should use a
discriminated Zod union to validate each filter:

  const FilterSchema = z.discriminatedUnion('operator', [
    z.object({
      column: z.string(),
      operator: z.literal('contains'),
      value: z.string()
    }),
    z.object({
      column: z.string(),
      operator: z.literal('between'),
      value: z.object({ from: z.number(), to: z.number() })
    }),
    // ... and so on for each operator
  ]);

This ensures malformed filter objects cannot be persisted or
applied to queries.

### Component Reuse Across Surfaces

Several patterns documented in this spec recur across other
spec surfaces. Where reasonable, implementation should share
components:

- **ProcessTypeChip**: a single component used by the Routing
  column and by execution lens displays. Compact-mode dimensions
  should be standardized across surfaces.
- **Filter popover**: the per-data-type filter UIs can be
  reused by execution lens grids if they adopt similar
  filtering. For Rev 1 the Parts Master Grid is the only
  surface; future surfaces may share the implementation.
- **Sort priority chrome**: the Active Sorts pattern may apply
  to execution lens grids in the future. Shared implementation
  is preferred over parallel ones.

---

## Open Questions for Implementation Track

These are questions the spec does not resolve. They need
decisions during Phase 1B implementation or in subsequent Revs,
documented here so they are not re-derived from scratch when
they surface.

### Views Permissions Beyond Rev 1

Rev 1 has no permission gating on View operations: any user can
create, rename, or delete Views. The shop context is trusted,
and accountability is enforced via the ViewCreated, ViewUpdated,
and ViewDeleted audit log entries.

Rev 1.5+ may want admin-only delete (and possibly admin-only
rename) if accidental modifications to shared Views become a
real problem in practice. The data model already supports this
— adding a check on the user's role at the service layer is
additive.

Trigger for adding gating: user feedback during Rev 1 operation
surfaces specific incidents or near-incidents of accidental
destruction.

### Schema Evolution and Saved View Compatibility

Saved Views reference column identifiers in their
visibleColumns array and filter objects. If a future schema
change removes or renames a column identifier, existing saved
Views may reference identifiers that no longer exist.

Recommended behavior: a View referencing a column identifier
not in the current inventory silently omits that column from
the rendered grid. The View remains valid; the user sees a
View with fewer columns than expected.

Recommended migration approach: when schema changes rename or
remove column identifiers, a migration script also updates the
visibleColumns arrays in stored Views to match. The migration
pattern uses Prisma's raw SQL or a one-time script reading and
updating Json columns.

Decision needed: should renames update existing Views
automatically (silent migration), or surface affected Views to
admins for manual review? Rev 1 doesn't introduce schema
changes affecting column identifiers; Rev 2+ will.

### Performance at Scale

Mockup data has ~15 parts. Production datasets may grow to
thousands or more. Filter and sort performance at scale needs
validation, particularly for:

- Deep filter operators (text contains, date range) on large
  datasets — appropriate indexes likely needed
- Routing include/exclude matrix queries that join through
  routing template steps — query plan analysis worthwhile
- Multi-column sort with relation-based columns
  (materialName joins through MaterialSpec, defaultVendorName
  joins through Vendor) — query plan and index strategy
  worth attention

Recommended: when Phase 1B implementation completes the Parts
Master backend, run performance tests with seeded data at
realistic scale (5000+ parts, 100+ Views). Add indexes based
on observed slow paths.

### Live Sync for View Management Modal

The View Management Modal shows a snapshot of the Views library
from the time the modal was opened. Concurrent modifications by
other users are not reflected until the modal is closed and
reopened.

For Rev 1's small-shop context this is acceptable; live sync
is rarely needed when 3-5 users share a Views library. If
operational use surfaces concurrent-edit issues (rare in
practice but possible if multiple users administer Views
simultaneously), Rev 2+ can add live sync via WebSocket or
periodic refresh.

### Sticky Columns

Users have expressed interest in pinning Part Number and Part
Name columns to the left side of the grid during horizontal
scroll. This is operationally useful for wide Views where
scrolling to the right loses identification context.

Deferred to Rev 1.5+ as out of Rev 1 scope. Implementation
involves CSS-based column pinning (position: sticky with
z-index management) which is established but non-trivial work.

### Bulk Operations on Views

Rev 1 does not include bulk operations such as deleting
multiple Views at once or applying a column visibility change
to multiple Views. If shop admins want to maintain large View
libraries, bulk operations may be useful in Rev 2+.

### Duplicate View Action

Rev 1 does not include a Duplicate action in the View
Management Modal. Users replicate an existing View by switching
to it, making any small change to mark it modified, and using
Save as new. This works but is mildly awkward.

Rev 1.5+ may add an explicit Duplicate action if user feedback
indicates the current workaround is friction.

### Default View Configurability

Rev 1 hardcodes Master View as the default. Future revs may
allow admins to change which View is the default (relevant if
Master is no longer the only locked View, or if shops prefer
a different starting state).

The data model already supports this — the isDefault field is
separate from isLocked. The application layer enforces "Master
is always default" as a Rev 1 invariant; Rev 2 can relax this
invariant if needed.

Rev 2+ may add live sync if operational use surfaces a need.
