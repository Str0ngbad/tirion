# Tirion — Parts Master Spec

## Purpose

The Parts Master is the primary configuration view for all parts and assemblies in the
system. It is the source of truth for what things are, how they're made, and where they
come from. Every Work Order traces back to a record here.

This view serves two distinct user modes:
- **Configuration** — adding new parts, editing definitions, assigning routing templates
- **Interrogation** — answering operational questions about the part library using filters

Both modes matter. The filter capability is not secondary — it is a core feature that
allows users to answer questions the system designer didn't anticipate.

---

## Row Model

Each row represents one Part or Assembly. Parts and Assemblies share the same grid.
`partType` distinguishes them visually with a subtle background tint difference —
Parts and Assemblies use slightly different dark tones. The crescent pattern is
reserved for process type identity in execution lenses and is not used here.

---

## Grid Columns

Visible by default, ordered left to right:

| Column | Source | Editable Inline | Notes |
|--------|--------|-----------------|-------|
| Part Number | `partNumber` | No | Unique identifier |
| Part Name | `partName` | No | |
| Type | `partType` | No | 'Part' or 'Assembly' — icon or pill |
| Material | `materialSpec.materialName` | No | Blank for assemblies |
| Stock Size | `stockSize` | No | Sortable; blank when no MaterialSpec assigned |
| Vendor | `defaultVendor.vendorName` | No | Blank if none assigned |
| Procurement | `procurementType` | No | Make / Buy / MakeBuy |
| Inventory Location | `inventoryLocation` | **Yes** | Inline edit appropriate here |
| Stock Count | `stockCount` | **Yes** | Inline edit for audit use |
| Active | `isActive` | No | Shown as icon/toggle; edit via form |
| Routing | derived from assigned RoutingTemplate | No | Read-only process type pills showing assigned template steps |

**Notes on routing column:** Display as a compact sequence of process type color
pills — one per step in the assigned template. Each pill uses the ProcessType's
assigned color. Shows the part's routing at a glance without opening the form.
The color-coding visual system supports approximately 8 ProcessTypes effectively.
Beyond that, color differentiation becomes unreliable — a design constraint to
be aware of when adding new ProcessTypes.

**Additional columns available via the Views system** (hidden by default; shown
when included in a saved View):

| Column | Source | Sortable | Filterable | Notes |
|--------|--------|----------|------------|-------|
| Vendor Part Number | `vendorPartNumber` | Yes | Yes | |
| Bin Min | `binMin` | Yes | Yes (range) | |
| Bin Max | `binMax` | Yes | Yes (range) | |
| Model | `modelLink` | No | No | Clickable link, opens in new tab |
| Drawing | `drawingLink` | No | No | Clickable link, opens in new tab |
| Cost | `partCost` | Yes | Yes (range) | |
| Cost Last Updated | `partCostUpdatedAt` | Yes | No | |
| Machine Cycle Time | `machineCycleTime` | Yes | Yes (range) | Minutes per part |
| Number of Setups | `numberOfSetups` | Yes | Yes (range) | |

---

## Filter Bar

Filters appear above the grid. All filters are additive (AND logic).

**Available filters:**

| Filter | Type | Field |
|--------|------|-------|
| Part / Assembly | Toggle or select | `partType` |
| Active / Inactive / Both | Toggle | `isActive` (default: Active only) |
| Vendor | Dropdown | `defaultVendorId` |
| Material | Dropdown | `materialSpecId` |
| Stock Size | Dropdown | `stockSize` |
| Routing Includes / Excludes Process | Matrix (per-process include/exclude) | routing template steps |

**Routing include/exclude matrix:** Each ProcessType can independently be set to include, exclude, or leave unconstrained. "Include" filters to parts whose routing template contains at least one step of that ProcessType. "Exclude" filters to parts whose routing template contains no steps of that ProcessType. Multiple ProcessType constraints combine via AND. See spec/parts_master_grid_spec.md for the full operator definition and query construction details.

**Sort:**
- Default sort: Part Number ascending (configuration and general use)
- Inventory Location sort: available as a prominent second option for inventory
  reconciliation workflows
- All column headers sortable

---

## Creating a New Part

Triggered by an "Add Part" button in the header area. Opens the Part Form in
create mode. A blank row is not added to the grid — entry happens entirely in
the form.

**Required fields on creation:**
- Part Number (must be unique)
- Part Name
- Part Type (Part or Assembly)
- Procurement Type

**All other fields nullable on creation.** Users can add MaterialSpec, Vendor,
Routing Template, and other details later by reopening the form.

---

## Opening the Part Form

Clicking any row in the grid opens the Part Form for that record.

### Surface Pattern

The Part Form is a side panel that opens at approximately 33% of the viewport
width when a user clicks a row in the Parts grid. The grid is pushed to the
remaining ~67% rather than overlaid; the grid stays interactive while the panel
is open. A selected-row indicator (left-edge accent and subtle background tint)
marks which Part the panel is currently showing.

This pattern differs from the modal-overlay pattern used by the Configuration
surfaces (Vendor, MaterialSpec, User, Sub-Status detail modals). The Part Form
is a long-lived navigation surface, not a one-shot edit modal — users frequently
click between Parts while the panel is open, scroll between sections, and use the
panel as a working context for cross-surface navigation (per ADR-013).

Rationale:
- The grid stays interactive so the user can navigate to a different Part by
  clicking another row, without the open-close-reopen cycle of modal-based editing.
- The side panel pattern is intended to be the canonical long-lived navigation
  surface for surfaces with similar interaction patterns — initially the Part Form,
  eventually the execution lenses' detail views.
- Single-column layout within the panel is an accepted trade-off for the narrower
  width; horizontal scroll on the grid for wide Views is also accepted.

The panel and the grid scroll independently. The grid scrolls vertically and
horizontally as needed for its content; the panel scrolls vertically as needed for
its content. Neither scroll position affects the other.

### Click-to-Section Navigation

When a user clicks a specific column in a Parts grid row, the Part Form opens
(or stays open) and scrolls to the section of the form that corresponds to that
column. The column-to-section mapping is:

| Grid Column | Form Section |
|-------------|--------------|
| Material, Stock Size | Material & Vendor |
| Default Vendor, Vendor Part Number | Material & Vendor |
| Routing Template, Routing chip column | Routing Template |
| Bin Min, Bin Max, Inventory Location, Stock Count | Inventory |
| Model, Drawing | Documentation |
| Cost, Cost Last Updated | Cost |
| Machine Cycle Time, Number of Setups | Manufacturing |
| Part Number, Part Name, Description, all other columns | Header (top) |

Each form section has a stable HTML id used by the click-to-scroll behavior. The
mapping is declared per surface; when execution lenses adopt the same side panel
pattern, they will declare their own column-to-section maps.

When the panel is closed and the user clicks any column other than identification
columns (Part Number, Part Name), the panel opens scrolled to the relevant section
rather than at the top.

---

## Edit-Time Dialog (Definition Change Flag System)

Whenever a Part definition is edited and the change has downstream impact, an
acknowledgment dialog appears before saving. This is the Parts Master surface
of the Definition Change Flag system (see `definition_change_flag_spec.md`).

### When the Dialog Appears

The dialog appears when EITHER:
1. The Part is referenced by other definition records (BOM rows, etc.)
2. The Part has open Work Orders that would be affected
3. The Part has stock count > 0

If none of the above apply, the change saves silently like any other definition
edit.

### Fields That Trigger Flags

| Field | Triggers Flag | Notes |
|-------|---------------|-------|
| `defaultVendorId` | Yes | Affects Purchase step on WOs |
| `materialSpecId` | Yes | Affects material identity throughout WO history |
| `routingTemplateDefinitionId` | Yes | Treated as Routing Template Change flag (separate type) |
| `stockSize` | Yes | Affects material consumption / procurement planning |
| `blankLength` | Yes | Affects material consumption math |
| `procurementType` | Yes | Behavioral — affects which process types apply |
| `partName` | No | Cosmetic — display only |
| `description` | No | Cosmetic |
| `inventoryLocation` | No | Display only |
| `notes` | No | Cosmetic |

Cosmetic-only field changes save without dialog and without flag creation.

`stockCount` is not subject to the flag system — it is operational, not definition,
and modifications go through the Reconcile Stock workflow.

`isActive` cannot be set to false while the Part has open Work Orders (per existing
Soft Delete rule); therefore deactivation cannot trigger flags.

The nine fields added during mockup work (`vendorPartNumber`, `binMin`, `binMax`,
`modelLink`, `drawingLink`, `partCost`, `partCostUpdatedAt`, `machineCycleTime`,
`numberOfSetups`) are reference, inventory threshold, pricing, and operational metric
data — not Part identity. Changes to these fields do **not** trigger the Definition
Change Flag system regardless of downstream impact.

This is consistent with the existing rule that flag triggers are scoped to fields
that affect Part identity (Material Spec, Default Vendor, Routing Template, Stock
Size, Blank Length).

### Dialog Layout

A modal overlay on the Part form, blocking save until acknowledged.

**Header:** "This change has downstream impact"

**Section 1 — Definition References** (always shown when the Part has references):
- "[Part Name] is used in:"
- N assemblies (expandable list, virtualized if long)
- M Routing Templates (where applicable)

**Section 2 — WIP Impact** (shown only when open WOs are affected):
- "[N] open Work Orders will be flagged for review"
- Expandable list with WO ID, Project + Top-Level Reference, Part Number,
  current step, status
- Batched WOs indicate batch context

**Section 3 — Stock Impact** (shown when stock > 0):
- "[N] units of [Part Name] are currently in stock"
- Reminder: existing stock may need review for conformity to the new definition

**Buttons:** Confirm Change / Cancel

The dialog has no "apply to WIP" option. The user's only choices are confirm
(saves the change, creates flags for affected open WOs) or cancel (discards
the change entirely).

### Definition Change Flag Dialog — Operationalized

When the user clicks Save on the Part Form, the system evaluates two conditions:

1. Did any of the definition fields change? Definition fields are:
   materialSpecId, defaultVendorId, routingTemplateDefinitionId, stockSize,
   blankLength.

2. Does this Part have any downstream impact? Downstream impact means at least
   one of:
   - The Part is referenced as a child in at least one BOM record
   - The Part has at least one open Work Order
   - The Part has stockCount > 0

If BOTH conditions are true, the Definition Change Flag Dialog is presented before
the save commits. The dialog shows three count cards summarizing the impact:
- Parent Assemblies count (the BOM child references)
- Open WO count (production currently using this Part definition)
- Stock count (inventory based on this Part definition)

The dialog requires the user (Manager role or above) to acknowledge the change
before the save proceeds. The dialog can be canceled, which discards the save
attempt and returns to the Part Form with edits intact.

If EITHER condition is false (no definition fields changed, OR the Part has no
downstream impact), the save commits silently without the dialog. Non-definition
field changes (Name, Description, Notes, vendorPartNumber, modelLink, drawingLink,
partCost, machineCycleTime, numberOfSetups, binMin, binMax) never trigger the
dialog regardless of Part impact.

The dialog parallels the Routing Template Editor's Edit-Time Dialog (which has
analogous logic for routing template definition changes affecting open WOs). Both
dialogs share approximately 80% of design language but operate on different data.
Implementation is encouraged to consolidate these into a shared component (e.g.,
an `ImpactDialog` taking data sources as props) rather than building them separately.

### Inactive Vendor Edge Case

If `defaultVendorId` is being set to an inactive vendor, the system errors at
save time (before the dialog). The user must address the underlying issue before
the Part edit can save. This means Accept Change resolutions on resulting flags
cannot result in setting an inactive vendor on a WO.

### On Confirm

Atomic transaction:
1. Definition change saves
2. AuditLog entry written for the underlying change
3. One flag created per affected open WO
4. For batched WOs: batch flag created and member flags reference it
5. Toast: "Change saved. [N] WOs flagged for review."

### Hard Rules

- **PM-DCF-1:** No definition change silently affects open Work Orders. The user
  must always acknowledge the impact before saving.
- **PM-DCF-2:** Cosmetic-only field changes save without dialog and without flag
  creation.
- **PM-DCF-3:** Stock impact is informational only — there is no flag system for
  stock items in Rev 1. Manager handles stock conformity via Reconcile Stock.

---

## Cancel Primitive

The Cancel primitive (introduced via Definition Change Flag spec) is a Manager/Admin
action available on leaf Work Orders. While Parts Master is not the primary surface
for Cancel (which lives in WO side panels in Project View, Operations Lens), the
Parts Master Part Form may display a "[N] WOs Cancelled" reference in the Part's
WO history section as informational context.

See `definition_change_flag_spec.md` for the full Cancel specification.

---

## Part Form — Sections

### Header (always visible)
- Part Number
- Part Name
- Part Type (pill/badge — not editable after creation without Admin override)
- Active toggle
- Created date (read-only)

### Core Details
- Description (text area)
- Procurement Type (select: Make / Buy / MakeBuy)
- Blank Length (numeric, with unit label from MaterialSpec if assigned)
- Notes (text area)

### Material & Vendor
- Material Spec (searchable dropdown → MaterialSpecs table)
- Stock Size (`stockSize` — text input, nullable in the schema but required at
  the application layer when `materialSpecId` is populated. Displayed when a
  MaterialSpec has been selected; hidden or blank for Parts where
  `materialSpecId` is null — Assemblies, finished purchased components)
- Default Vendor (searchable dropdown → Vendors table)
- Vendor Part Number (`vendorPartNumber` — text input, free text. Displayed when
  `defaultVendorId` is populated; hidden or visually de-emphasized when no default
  vendor is set. Used by purchasing to identify the SKU when ordering. Nullable.)

### In-Context Creation (Material & Vendor)

When editing a Part's Material or Default Vendor field, the user can create new
MaterialSpec or Vendor records inline without leaving the Part Form.

**MaterialSpec inline creation:**
Invokes the cascade modal documented in configuration_management_spec.md
(MaterialSpec Management — Cascade Modal Behavior). The cascade modal in the Part
Form context is create-only. Full MaterialSpec edit and deactivation operations
require navigating to the MaterialSpec Management surface.

**Vendor inline creation:**
Invokes a minimal Vendor create modal with the following fields:
- vendorName (required)
- contactInfo (optional)
- leadTimeDays (optional)
- notes (optional)

The website and location fields are not exposed in the Part Form's in-context
Vendor creation. Users who want to populate those fields should navigate to the
Vendors surface. The reasoning: the Part Form in-context flow is optimized for
"I need to add this vendor so I can save this Part" workflows; the comprehensive
Vendor record can be filled in later.

Both creation paths add real records to the database via the standard Vendor and
MaterialSpec API endpoints. The new records are immediately available everywhere —
the Vendor list, the MaterialSpec cascade dropdowns on other Parts, etc.

### Documentation
- Model Link (`modelLink` — text input, URL. Light Zod URL validation (must be a
  valid URL if non-empty). Displayed as a clickable link in the Part Form and grid,
  opening in a new tab. Nullable.)
- Drawing Link (`drawingLink` — text input, URL. Same validation and display rules
  as Model Link. Nullable.)

### Routing Template
Shows the Routing Template currently assigned to this Part. The Part references
a template — it does not own individual steps. Editing steps requires navigating
to the Routing Template Editor.

**Display:**
- Assigned template name (or "No template assigned" if none)
- Template steps shown as read-only process type pills in sequence order
- Step numbers shown alongside each pill

**Actions available in this section:**
- **Change Template** — searchable dropdown of active Routing Templates.
  Selecting a new template triggers the Principle 10 confirmation if open
  WOs exist. Additionally shows how many other Parts reference the current
  template before confirming the reassignment.
- **View / Edit in Routing Template Editor** — navigates to the Routing
  Template Editor with the currently assigned template pre-selected.
  This is the only way to edit template steps — not available inline here.

**Validation on template assignment:**
- If the Part Type is Assembly and the selected template contains Purchase
  or Receive steps, assignment is blocked with an inline error:
  "This template includes purchasing steps and cannot be assigned to an
  Assembly part."

### Parent Assemblies (read-only)
List of assemblies that include this part as a component, derived from the
BOM table where this part appears as `childPartId`.

Each entry shows:
- Assembly Part Number + Name
- Quantity used in that assembly
- Link that opens the BOM Editor for that parent assembly

If no parents: "This part has no parent assemblies."

This section answers "where is this part used?" — high value for understanding
impact before editing a part definition.

### Bidirectional BOM Traversal

The Part Form's BOM-related sections support traversal in both directions of the
BOM hierarchy:

**Parent Assemblies section (all Parts):**
Shows the parent Assemblies that reference this Part as a child. Listed regardless
of Part type — Parts (leaf nodes) and Assemblies (which may themselves be children
of larger Assemblies) both show this section. Each row is clickable; clicking
navigates the side panel to the parent Assembly's Part Form without closing the
panel or losing context.

**Child Parts section (Assemblies only):**
Shows the Parts that this Assembly is composed of. Only displayed when the current
Part has partType: "Assembly". Each row is clickable; clicking navigates the side
panel to the child Part's Part Form.

Together, these sections enable full BOM tree traversal via the side panel: a user
can navigate up from a leaf Part to its parent Assembly, up again to a grandparent
Assembly, then down to a sibling component, all without leaving the panel. The BOM
is the relational backbone of the Part model; the panel respects that.

Implementation note: parent assemblies are queried as BOM records where this Part
is the child; child parts are queried as BOM records where this Assembly is the
parent. Both queries should be efficient for typical Part hierarchies (tens of
parents, tens of children).

### Manufacturing
- Machine Cycle Time (`machineCycleTime` — integer input, minutes per part for the
  dominant machining operation. Nullable.)
- Number of Setups (`numberOfSetups` — integer input, count of separate setups
  required to make the part. Nullable.)

### Inventory
- Inventory Location (text, editable)
- Stock Count (numeric, editable)
- Bin Min (`binMin` — integer input, minimum inventory threshold. Nullable.)
- Bin Max (`binMax` — integer input, maximum inventory threshold. Nullable.)
  - Application-layer rule: if both Bin Min and Bin Max are set and
    `binMax < binMin`, the UI surfaces a warning but does not block save
    (trust the user with tools).

Inventory fields (stockCount, inventoryLocation, binMin, binMax) are
inline-editable in the Parts grid and editable via the Part Form's Inventory
section. The two surfaces operate on the same record in memory: edits in the
grid reflect immediately in the open Part Form panel, and edits in the panel
reflect immediately in the grid row. The grid is the fast path for single-field
edits; the form is the comprehensive edit context.

### Cost
- Part Cost (`partCost` — decimal input, nullable. Uses `Decimal(10,2)` in the
  database to preserve currency precision. Supports values up to $99,999,999.99.)
- Cost Last Updated (`partCostUpdatedAt` — read-only display field. Auto-managed
  by the Part service layer when built in Phase 1B: any update path that writes a
  value to `partCost` which differs from the current value also sets
  `partCostUpdatedAt` to `NOW()`. Manual edits to `partCostUpdatedAt` are not
  exposed via the Part Form.)

---

## Inline Editing (Grid)

Only two fields support inline edit directly in the grid:
- **Inventory Location** — click to edit in place
- **Stock Count** — click to edit in place

All other edits require opening the Part Form. This protects data integrity
while keeping high-frequency operational updates fast.

**Operational fields vs. definition fields:**
Stock Count and Inventory Location are operational fields — they describe the
Part's current real-world state, not its definition. Changes to these fields:
- Do not trigger Principle 10 confirmation
- Cascade immediately to all views that reference this Part, including active
  Work Orders
- Reflect real-world state and are expected to change frequently

This is distinct from definition fields (MaterialSpec, Vendor, Routing Template,
Procurement Type) which do not cascade to open Work Orders and require
confirmation when open WOs exist.

**Inventory Location collision handling.** Inventory location is not enforced
unique. When a user enters or edits a location that is already assigned to
another active Part, a confirmation dialog appears showing which Part currently
uses that location. The user can confirm (proceeding with the duplicate
assignment, accepting that the bin holds multiple parts) or cancel (returning
to the previous value).

This posture reflects shop reality: bins sometimes hold more than one part type
when physical inventory infrastructure has not kept pace with the need for new
locations. Surfacing the conflict to the user — rather than enforcing uniqueness
at the database — keeps the user in control of the assignment decision while
flagging potential mistakes for review.

---

## Soft Delete Behavior

Setting `isActive = false` via the Active toggle marks the part inactive.
It does not delete the record.

- Inactive parts are hidden from the grid by default (filter default: Active only)
- Inactive parts remain on all historical Work Orders and BOM relationships
- Inactive parts can be reactivated via the form
- The Active/Inactive filter allows viewing inactive parts when needed
- Deactivating a Part with open Work Orders triggers Principle 10 confirmation

---

## Empty States

- No parts yet: "No parts found. Add your first part to get started." + Add Part button
- Filters return no results: "No parts match the current filters." + clear filters link

---

## Design Notes

- Part vs Assembly rows use a subtle background tint difference. The tint provides
  part type context even when the Type column is scrolled off screen horizontally.
- Routing step pills in the grid use ProcessType colors consistent with execution lenses.
- Default isActive filter hides inactive parts — the parts library will grow and
  inactive parts create noise.
- The Parent Assemblies section in the form is high-value for impact assessment
  before making definition changes.
- The color-coding system for routing steps supports approximately 8 ProcessTypes.
  This is a design constraint, not a hard system limit.
