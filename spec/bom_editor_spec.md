# Tirion — BOM Editor Spec

## Purpose

The BOM Editor is a dedicated view for building and managing the Bill of Materials
for all assemblies. It shows the full recursive component tree for a selected assembly
and allows planners to add and remove components at any level.

The BOM is project-agnostic — changes here affect all future projects that call this
assembly. Existing Work Orders already generated from this BOM are not retroactively
affected (Principle 10).

---

## Entry Points

**Primary:** BOM Editor nav item — opens the view with no assembly selected.
User selects an assembly from the assembly selector to begin.

**Secondary:** "View in BOM Editor" link in the Part Form (visible only when the
part being viewed has `partType = Assembly`). Navigates to the BOM Editor with
that assembly pre-selected and its tree expanded.

---

## Assembly Selector

A persistent search bar in the editor chrome, always visible at the top of the view.
Lists all Parts where `partType = Assembly` and `isActive = true`.

- Search by Part Number or Part Name
- Selecting an assembly navigates to that assembly's BOM tree view
- No assembly selected = empty state with prompt to select one

---

## Component Tree Display

When an assembly is selected, its full BOM tree renders below the assembly identity
band. The tree is recursive — assemblies within assemblies expand to show their
own children.

### Assembly Identity Band

A band between the search chrome and the tree displays the selected assembly's
Part Number, Part Name, type badge, and direct component count. It provides
at-a-glance confirmation of which assembly is under edit.

### Tree Structure

Each node in the tree shows:

| Column | Notes |
|--------|-------|
| Component | Part Number (monospace, links to Part Form Sheet) + Part Name |
| Qty | Quantity of this component in its parent |
| Stock | The component's own `stockCount`; rendered red when 0 |
| Buildable | Assembly nodes only — see Operational Rollups below |
| Cost | Recursive cost rollup — see Operational Rollups below |
| Freshness | Cost data quality indicator — see Operational Rollups below |
| Location | The component's own `inventoryLocation` |

The BOM Editor's columns answer operational questions — can we build this assembly
today, and if not, why not. Structural part identity (Part Type, Procurement Type,
Material, Stock Size, Routing) is available on the Part Form Sheet, which opens
when the user clicks a Part Number. The tree's job is operational visibility;
the Sheet's job is part identity.

Assembly nodes are expandable/collapsible. Default state: root-level only. The
selected Assembly's immediate children are visible on load; sub-Assemblies render
their chevron in the collapsed position. The user expands sub-Assemblies on demand.
Bulk Expand All / Collapse All controls in the controls bar operate on the full tree.

Defaulting to fully-expanded would overwhelm the user on first open at typical
real-world depths (3–5). Defaulting to root-only matches the user's typical
interrogation pattern — start at the root, drill where attention is needed.

### Children Rendering Order

Children of an Assembly render in a fixed sort order applied at render time: all
Parts first (sorted alphabetically by Part Number), then all Assemblies (sorted
alphabetically by Part Number). The order is not user-controllable in Rev 1.

A bill of materials lists what goes into an assembly; the order of components is
informational, not procedural (procedural order is the concern of routing, not BOM).
Imposing a deterministic, scannable order — leaves before branches, alphabetical
within each group — aids reading and is consistent across reloads. User-controlled
ordering is a Rev 2 candidate; in Rev 1, the sort rule is sufficient.

### Visual Hierarchy

Indentation communicates nesting level. Each level indents further right.
A vertical line or subtle connector on the left edge traces the parent/child
relationship down the tree (standard tree UI pattern).

Leaf nodes (Parts with no children) are visually distinct from assembly nodes
— no expand control, slightly different row style.

### Operational Rollups

Three rollups are computed across the subtree at render time, in the client,
from per-node data returned by the BOM fetch endpoint:

- **Buildable** (Assembly nodes only): the minimum number of complete assemblies
  that could be produced from on-hand stock, computed recursively across all
  children, accounting for required quantities. Null stock is treated as 0.
  The recurrence is:
  `buildable(assembly) = floor( min over children of min(child.stock, child.buildable) / child.qty )`

- **Cost**: the sum of leaf-descendant cost × quantity, computed recursively.
  If any leaf descendant has no cost set, the rollup returns null and the column
  renders an amber dash.

- **Freshness**: a subtree scan summarizing cost data quality. An amber warning
  indicator surfaces if any leaf descendant lacks cost; a clock indicator surfaces
  if any leaf descendant's cost was last updated more than 6 months ago.

Rollups are computed client-side at Rev 1 scale (under 5,000 BOM edges per
assembly). If production scale exposes performance issues, a future Rev can
introduce a server-computed rollup endpoint or materialized cache.

---

## Edit-Time Dialog (Definition Change Flag System)

**Phase note:** The Definition Change Flag system is not active in Phase 1D Rev 1.
It depends on the WorkOrder entity (Phase 1C+ in build order). The BOM Editor's
mutation endpoints in Phase 1D commit changes directly without the dialog, the
impact aggregates, or AuditLog flag records. The behavior described below in this
section is the target state once the WorkOrder layer exists; Phase 1D implements
the BOM mutations themselves and leaves the flag layer for the phase that introduces
the WorkOrder model.

See the Phase 1C routing template editor spec for the analogous pattern: the
`flaggedWoCount` field in mutation responses is hardcoded to 0 in the build phase
and populates from real counts once WorkOrders exist.

Whenever a BOM change has downstream impact, an acknowledgment dialog appears
before saving. This is the BOM Editor surface of the Definition Change Flag
system (see `definition_change_flag_spec.md`).

### When the Dialog Appears

The dialog appears when EITHER:
1. The assembly being edited is referenced as a child in other assemblies' BOMs
2. The assembly has open Work Orders that would be affected
3. For component removal/replacement: the affected child also has open WOs

If none of the above apply, the change saves silently like any other BOM edit.

### Change Types and Flag Triggering

| Change Type | Flagged Entities | Notes |
|-------------|-----------------|-------|
| **Quantity Changed** | Each affected child WO under each affected parent WO | Cascades: child Demand changes |
| **Component Added** | Each affected parent Assembly WO | Resolution generates new child WO subtree |
| **Component Removed** | Each affected parent Assembly WO AND each affected child WO of the removed component | Resolution requires manual Cancel of children + Dismiss of parent flag |
| **Component Replaced** | Treated as Removal + Addition. Two flags created per affected parent Assembly WO | One for removal of old child, one for addition of new |

### Dialog Layout

A modal overlay on the BOM editor, blocking save until acknowledged.

**Header:** "This change has downstream impact"

**Section 1 — Definition References** (always shown when the assembly has parent
references):
- "[Assembly Y] is used as a component in [N] other assemblies"
- Expandable list of parent assemblies

**Section 2 — WIP Impact** (shown only when open WOs are affected):
- "[N] open Work Orders will be flagged for review"
- Expandable list with WO ID, Project + Top-Level Reference, Part Number,
  current step, status
- For Component Removed/Replaced: separate counts for affected parent WOs and
  affected child WOs
- Batched WOs indicate batch context

**Section 3 — Stock Impact** (shown when affected Part has stock > 0):
- For Component Removed: "[N] units of [removed Part] are currently in stock"
- For Component Replaced: stock counts for both the removed and added Parts
- Reminder: existing stock may need review for conformity

**Buttons:** Confirm Change / Cancel

The dialog has no "apply to WIP" option. The user's only choices are confirm
(saves the change, creates flags for affected open WOs) or cancel (discards
the change entirely).

### On Confirm

Atomic transaction:
1. BOM change saves
2. AuditLog entry written for the underlying change
3. Flags created per the change type's triggering rules
4. For batched WOs: batch flag created and member flags reference it
5. For Component Replaced: two flags created per affected parent (removal +
   addition)
6. Toast: "Change saved. [N] WOs flagged for review."

### Hard Rules

- **BE-DCF-1:** No BOM change silently affects open Work Orders referencing the
  modified assembly. The user must always acknowledge the impact before saving.
- **BE-DCF-2:** Component Replaced is modeled as Component Removed + Component
  Added. Two flags are created per affected parent Assembly WO and resolved
  independently.

---

## Actions

### Add Component to an Assembly

Available on any assembly node in the tree (including nested assemblies).
Triggered via the "Add Child" item in the Assembly row's ⋮ context menu.

Opens an inline input row appearing immediately below the Assembly row, indented
to the child level. The inline row contains:
- **Part** — searchable combobox (all active Parts and Assemblies)
- **Quantity** — numeric input (required, positive integer)

The new child appends to the assembly's child list; the backend assigns the
display position per the fixed sort rule (Parts first alphabetical, then
Assemblies alphabetical).

On save:
- New BOM row created (parentPartId = selected assembly, childPartId = selected part)
- Tree refreshes to show new component in its sorted position
- If open WOs exist referencing this assembly, Principle 10 confirmation fires
  before the save completes

**Validation:**
- A part cannot be added as a component of itself
- Circular references are not allowed at any depth — enforce via full ancestry
  traversal on every Add Component operation. This is a correctness requirement,
  not optional. See Hard Rule 17 in terminology_lock.md.
- A part that already exists as a direct child of this assembly cannot be added
  again. Duplicate children are blocked at the form level with an inline error.
  No warning-and-confirm path — duplicates are not permitted.
- Depth limits apply — see the Depth Limits section below.

### Remove Component

Remove is initiated from the parent Assembly's ⋮ context menu via "Remove
Children." Selecting this enters a multiselect mode: each child row gains a
checkbox; an action bar appears below the parent's row showing "Remove Selected
(N)" and "Cancel." The user selects one or more children, then confirms via the
action bar.

Confirmation surfaces a dialog listing all selected children with their Part
Number, Part Name, and current quantity. The user confirms or cancels. On confirm,
all selected BOM edges are removed in a single transaction.

Removing all children of an Assembly is allowed and leaves the Assembly with zero
components (a valid state, equivalent to a newly created Assembly before any
components are added).

Leaf (Part) rows have no ⋮ menu. Remove for a Part must be initiated from its
parent Assembly.

If open WOs exist referencing this assembly, Principle 10 confirmation is
incorporated into or follows the removal confirmation.

### Edit Quantity

Inline edit on the Quantity field. Click to edit, confirm with Enter or
click away. Updates the BOM row quantity.

Setting quantity to 0 in the inline edit field is treated as a remove: a
confirmation dialog asks whether to remove the component from the BOM. If
confirmed, the BOM edge is deleted (equivalent to Remove Component). If
cancelled, the edit is discarded and the original quantity is restored.

If open WOs exist referencing this assembly, Principle 10 confirmation fires
before the quantity change is saved.

### Depth Limits

BOM trees have two depth thresholds:

- **Soft limit (6):** when an Add Component action would result in a total
  subtree depth of 6, 7, or 8 (measured from the deepest root ancestor of the
  parent Assembly down through the proposed child's deepest descendant), the
  frontend surfaces a dismissible warning dialog. The user can confirm and
  proceed. The backend does not block this case.

- **Hard limit (8):** when an Add Component action would result in a total
  subtree depth greater than 8, both the frontend and backend reject the
  operation. The frontend surfaces a blocking dialog explaining the limit. If
  the request reaches the backend (e.g., via a non-UI client), the backend
  rejects with a structured error containing the computed depth and the limit.

Depth is measured by walking up from the parent Assembly's ancestry to find the
maximum ancestor depth, plus walking down from the proposed child's subtree to
find the child's maximum descendant depth, summing the two. A depth-1 component
on a root assembly is depth 1; a child of that component is depth 2; and so on.

The user's real-world maximum (informed by sanitized data from the prior shop
tool) is depth 5. The soft limit at 6 leaves headroom; the hard limit at 8
reflects the visual capacity of the tree zone at typical viewport widths (beyond
8 levels of indentation, Part Names truncate too aggressively to be useful).

---

## Navigating to a Component's Part Form

Every Part Number in the tree is a link. Clicking it opens the Part Form Sheet
for that part as a side panel, pushing the tree to occupy the remaining width.
The Part Form Sheet opens scrolled to the Parent Assemblies section, giving
immediate context for which assemblies use this part.

For assembly nodes, the Part Form Sheet includes a "View in BOM Editor" link
that loads that assembly as the new root in the tree.

---

## Parent Assembly Navigation

The BOM Editor does not surface parent-assembly references for the currently
selected Assembly. Parent-assembly navigation — viewing which Assemblies use
the current Part or Assembly as a component — happens via the Part Form Sheet's
Parent Assemblies section. The user opens the Sheet by clicking the Part Number
of any node in the tree, including the root Assembly's identity band.

This separation keeps the BOM Editor focused on the downward structure of a
single Assembly. The upward navigation (what uses this Part) lives on the Part
Form Sheet, where it benefits from the Sheet's full part-identity context.

---

## Schema Note — displayOrder field removed

The schema's `displayOrder` column on the BOM model is removed in Rev 1. The
rendered child order is determined by the fixed sort rule (Parts first by Part
Number alphabetical, then Assemblies by Part Number alphabetical); no per-record
ordering field is needed.

If a future Rev introduces user-controlled child ordering, the column can be
reintroduced via a schema migration at that time.

---

## Empty States

- No assembly selected: "Select an assembly above to view and edit its components."
- Assembly selected but no components yet: "[Assembly Name] has no components.
  Add the first component to get started." + Add Component button.

---

## Design Notes

- The BOM Editor is a planning and configuration tool, not an execution view.
  It should feel deliberate — changes here affect the template all future
  projects build from. The UI should not feel as fast/loose as a spreadsheet.
- Destructive actions (remove component) always require confirmation.
- The tree can get deep. Performance and visual clarity matter for assemblies
  with many levels. Collapse/expand controls are important for navigating
  large structures.
- Part Number links to Part Form preserve the principle that routing lives at
  the part level — users can jump to routing from here without a separate
  navigation step.
- Circular reference detection via full ancestry traversal is a hard requirement.
  Performance on deep trees should be monitored but never used as a reason to
  skip the check.
