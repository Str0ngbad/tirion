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
| Stock Size | `materialSpec.stockSize` | No | Sortable |
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
| Stock Size | Dropdown | `materialSpec.stockSize` |

**Deferred filter (Rev 2):**
- **Includes Process** — filter to parts whose assigned routing template contains
  a specific ProcessType. Example: "show all parts that include Blacken." Requires
  a join through RoutingTemplate. High operational value but deferred.

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

Clicking any row in the grid opens the Part Form for that record. The form takes
up most of the screen — this is the primary editing surface. The grid remains
visible but de-emphasized behind it. Full-screen slide-in panel from the right
is preferred.

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
- Stock Size (auto-populated from selected MaterialSpec, read-only here —
  stock size is a property of the MaterialSpec, not typed per part)
- Default Vendor (searchable dropdown → Vendors table)

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

### Inventory
- Inventory Location (text, editable)
- Stock Count (numeric, editable)

These fields are also available as inline edits in the grid. The form shows
them here for completeness and for users working in the form context.

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
