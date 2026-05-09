# Tirion — BOM Editor Spec

## Purpose

The BOM Editor is a dedicated view for building and managing the Bill of Materials
for all assemblies. It shows the full recursive component tree for a selected assembly
and allows planners to add, remove, and reorder components at any level.

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

A searchable dropdown at the top of the view. Lists all Parts where
`partType = Assembly` and `isActive = true`.

- Search by Part Number or Part Name
- Selecting an assembly loads its full component tree below
- No assembly selected = empty state with prompt to select one

---

## Component Tree Display

When an assembly is selected, its full BOM tree renders below the selector.
The tree is recursive — assemblies within assemblies expand to show their
own children.

### Tree Structure

Each node in the tree shows:

| Field | Notes |
|-------|-------|
| Part Number | Monospace, links to Part Form |
| Part Name | |
| Part Type | Subtle indicator — Part or Assembly |
| Quantity | Quantity of this component in its parent |
| Procurement Type | Make / Buy / MakeBuy |
| Material | From MaterialSpec, if assigned |
| Stock Size | From MaterialSpec, if assigned |
| Routing (condensed) | Process type pills — same pattern as Parts Master |

Assembly nodes are expandable/collapsible. Default state: all levels expanded.
A "Collapse All / Expand All" toggle is available.

### Visual Hierarchy

Indentation communicates nesting level. Each level indents further right.
A vertical line or subtle connector on the left edge traces the parent/child
relationship down the tree (standard tree UI pattern).

Leaf nodes (Parts with no children) are visually distinct from assembly nodes
— no expand control, slightly different row style.

---

## Edit-Time Dialog (Definition Change Flag System)

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
| **Display Order Changed** | No flag — displayOrder is cosmetic | |

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
- **BE-DCF-2:** Display order changes are cosmetic and do not trigger the flag
  system or the dialog.
- **BE-DCF-3:** Component Replaced is modeled as Component Removed + Component
  Added. Two flags are created per affected parent Assembly WO and resolved
  independently.

---

## Actions

### Add Component to an Assembly

Available on any assembly node in the tree (including nested assemblies).
Triggered by an "Add Component" button or control on the assembly row.

Opens an inline form or small modal with:
- **Part** — searchable dropdown (all active Parts and Assemblies)
- **Quantity** — numeric input (required)
- **Display Order** — numeric input (defaults to next available position)

On save:
- New BOM row created (parentPartId = selected assembly, childPartId = selected part)
- Tree refreshes to show new component in position
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

### Remove Component

Available on any component row. Requires confirmation dialog before deletion.
If open WOs exist referencing this assembly, Principle 10 confirmation is
incorporated into or follows the removal confirmation.

Confirmation dialog states:
- Which part is being removed
- Which assembly it is being removed from
- If the component is itself an assembly with children: "This will remove
  [Assembly X] and all of its components from this assembly. The parts
  themselves will not be deleted."

On confirm: BOM row deleted. Tree refreshes.

### Reorder Components

Drag-and-drop reordering within a single parent assembly, or up/down controls
on each row. Reordering updates `displayOrder` values for affected siblings.

Reordering is scoped to siblings within the same parent — a component cannot
be dragged from one assembly into another assembly via this control.

If open WOs exist referencing this assembly, Principle 10 confirmation fires
before the reorder is saved.

### Edit Quantity

Inline edit on the Quantity field. Click to edit, confirm with Enter or
click away. Updates the BOM row quantity.

If open WOs exist referencing this assembly, Principle 10 confirmation fires
before the quantity change is saved.

---

## Navigating to a Component's Part Form

Every Part Number in the tree is a link. Clicking it opens the Part Form for
that part in a panel or navigates to it.

For assembly nodes: the Part Form link and the "View in BOM Editor" link
coexist. The Part Form link opens that assembly's own part details.
"View in BOM Editor" loads that assembly as the root of the tree in this view.

---

## Viewing Parent Context

When a user arrives via "View in BOM Editor" from a Part Form, the selected
assembly is the root. If the user wants to navigate up to a parent assembly,
they use the assembly selector to switch — there is no automatic "go up"
control in Rev 1.

A "Used In" indicator below the assembly selector shows how many assemblies
reference the current assembly as a component, with a count. Clicking it shows
a list of parent assemblies. This is read-only context — clicking a parent
loads it as the new root in the BOM Editor.

---

## Schema Note — displayOrder field

The BOM table uses `displayOrder` (not `stepIndex`) to control the display
order of children within a parent assembly. This is intentionally distinct
from `WorkOrderStep.stepIndex`, which controls execution sequence. The two
fields serve different purposes and must not be confused.

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
