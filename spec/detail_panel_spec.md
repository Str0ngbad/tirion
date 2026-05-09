# Tirion — Detail Panel Spec (Side Panel)

## Purpose

Focused context and actions for the selected Production Row (Work Order or
Production Batch). Used as the persistent shared side panel across all
operational views (Project View, Operations Lens, execution lenses, Batching
Lens).

The detail panel surfaces information and actions appropriate to the current
context. Operators see what they need to act on the row. Managers see
additional management actions and resolution surfaces.

---

## Behavior

- Shared across views. The same panel structure renders regardless of which
  lens the user came from
- Default open at header — collapsible sections expand on demand
- Icons or section navigation jump to specific sections
- The row's identity is always visible at the top — clear which WO or Batch
  is being viewed
- Closes on row deselection, navigation away, or explicit dismiss

---

## Section Structure

The panel is organized into the following sections, displayed in order from
top to bottom:

1. **Header** — Always visible
2. **Status** — Always visible
3. **Routing Detail** — Collapsible, default expanded. Routing steps are
   clickable in management views to drive Process-Specific Section content
4. **Process-Specific Section** — Always visible. Content driven by lens
   context (in process lenses) or by routing step selection (in management
   views). See dedicated section below
5. **Dependency Context** — Collapsible (Assembly / parent / child relationships)
6. **Batch Context** — Visible when row is batched
7. **Pending Definition Changes** — Visible when row has open Definition Change Flags
8. **Blocker Section** — Visible when row has Open or Pending Resolution blocker
9. **Notes** — Always visible (WO-level notes scoped to the WO as a whole)
10. **Actions** — Always visible (filtered by user permissions and row state)

---

## Header

Always visible at top of panel.

| Field | Notes |
|-------|-------|
| Production Row Identifier | Batch ID or WO ID with type indicator |
| Part Number / Part Name | |
| Project Reference | Top-Level Reference (e.g., "98324.02") for unbatched WOs; condensed Project list for batched |
| WOStatus | Unreleased / Open / Complete / Cancelled |
| Indicators | Row Indicators per `terminology_lock.md` Cluster 9: Red Flag (Blocker), Yellow Flag (Definition Change Flag), White Flag (Supply Order Exception). Display order: Red → Yellow → White. Hover and click behaviors per Cluster 9 definition |

---

## Status

Always visible.

| Field | Notes |
|-------|-------|
| Current Step / State | The active routing step and its execution state |
| Sub-Status | Operator context within state (free text, optional) |
| Started At | Timestamp of step start (if Started) |
| Last Activity | Most recent state change timestamp |
| Priority | Global integer; editable inline (Manager+) |
| Due Date | Denormalized from Project Due Date |

---

## Routing Detail

Collapsible, default expanded.

Shows the full routing sequence for the WO:
- Each step listed in order with its state (Waiting / Ready / Started / Complete / Skipped / Blocked)
- Current step visually emphasized
- Skipped steps shown distinctly (greyed with skip indicator)
- Sub-status displayed per step where set
- Click to navigate to the relevant process lens for that step

For Assembly WOs: dependencies on child WOs are surfaced under Dependency
Context, not here.

### Clickable Steps in Management Views

In management views (Project View, Operations Lens), each routing step is
clickable. Clicking a step sets that step as the **selected step** for the
Process-Specific Section below — the section's content swaps to show that
step's process-specific data.

- The currently selected step is visually marked (border, background tint, or
  similar treatment)
- Default selection on panel open: the WO's active step
- Click any other step (Waiting, Started, Complete, Skipped) to swap the
  Process-Specific Section to that step's view
- A "Reset to Active Step" affordance returns selection to the active step
  if the user has navigated away

In process lenses (Purchasing, Machining, Assembly, Distribution, Receiving),
routing steps are NOT clickable for section-swapping. The lens itself
constrains the Process-Specific Section to that lens's process. The routing
steps remain clickable for navigation purposes (jump to that step's lens),
which is existing behavior.

---

## Process-Specific Section

Always visible. The content of this section is one of the per-process
sections defined in the respective lens specs (Purchasing, Receiving,
Machining, Assembly, Distribution).

### Which Section Displays

**In a process lens** (Purchasing Lens, Machining Lens, Assembly Lens,
Distribution Lens, Receiving Lens):
- The section always displays content for the lens's own process type,
  regardless of the WO's active step
- A buyer in the Purchasing Lens sees Purchasing fields even for WOs whose
  active step is Machining (enables pre-emptive procurement planning)
- A machinist in the Machining Lens sees Machining fields even for WOs not
  yet in machining (enables pre-emptive setup planning)

**In a management view** (Project View, Operations Lens):
- The section displays content for the WO's currently selected step (set by
  clicking a step in Routing Detail)
- Default selection on panel open: the WO's active step
- Manager can click any step to view that step's section data

### Editability Rules

The Process-Specific Section's editable fields follow uniform rules across
all process types and views:

| Step State | Editability |
|-----------|-------------|
| Active (Ready or Started) | Editable, subject to user permission |
| Future (Waiting) | Editable, subject to user permission — enables pre-planning |
| Future (Ready, but not the active step on the WO) | Editable, subject to user permission |
| Complete | Read-only (preserves historical record of what was actually done) |
| Skipped | Read-only (step was bypassed; no production data to edit) |

Permission rules apply on top:
- Operators: edit fields in their station's lens only (where station = process type)
- Lead: edit fields in their assigned process types (defined per Lead role)
- Manager / Admin: edit fields in any process type they have visibility to

The system permits editing per the table above; permissions filter further.
Read-only fields display the same UI but with edit affordances disabled.

### Empty State Display

When viewing a future step's section and the data is genuinely absent (the
step hasn't been worked yet and no pre-planning data has been entered):

- Editable fields display empty/placeholder state
- Read-only computed fields display "Not yet started" or similar
- The section structure is fully visible — fields are present, just empty
- Field labels and descriptions remain visible to support pre-planning entry

### Process Notes Convention

Each process section may include a Process Notes field (per its lens spec).
Process Notes are:

- Free text
- Append-only display (newest at top)
- Each note timestamped and attributed to the user who entered it
- No edit-after-save (preserves audit trail)
- Scoped to the process step (a Machining process note is about machining,
  not about the WO as a whole)

This is distinct from the WO-level Notes section (item 9 in the section
structure), which holds notes that apply to the WO as a whole rather than
to any particular step.

The split-by-process model lays groundwork for future cross-step note
visibility surfacing (e.g., indicators showing notes exist on previous steps)
and integration with external messaging systems (Rev 2+).

### Section Definitions

The actual content of each process-specific section (fields, labels,
defaults, sub-status options) is defined in the corresponding lens spec:

- **Purchasing fields**: see `purchasing_lens_spec.md`
- **Receiving fields**: see `receiving_lens_spec.md`. Note: the Receiving
  Process-Specific Section is intentionally minimal — the primary action
  surface for receiving is the Supply Order modal accessed from this
  section, not the section itself. The Supply Order is the receiver's
  natural primary entity (vendors ship Supply Orders, not WOs)
- **Machining fields**: see `machining_lens_spec.md`
- **Assembly fields**: see `assembly_lens_spec.md`
- **Distribution fields**: see `distribution_lens_spec.md`

The Operations Lens does not define its own process section — it is a
management view that displays whichever process section is selected per
the rules above.

---

## Dependency Context

Collapsible.

For Assembly WOs:
- Component readiness fraction (e.g., "11/15") with breakdown
- List of child WOs grouped by state (Complete, In Progress, Waiting,
  Cancelled if any)
- Cancelled children are visible but visually de-emphasized
- Click a child WO to switch panel context to that child

For component WOs:
- Parent Assembly reference
- Click to switch context to parent

---

## Batch Context

Visible only when the Production Row is batched.

| Field | Notes |
|-------|-------|
| Batch ID | |
| Member count | Total members; non-Cancelled count if any are Cancelled |
| Top 3 members | WO ID, Qty, Project, Due Date, Parent — expandable to full list |
| Batch state | Same as Production Row state when batched |
| Batch Priority | MAX of non-Cancelled members |
| Batch Due Date | MIN of non-Cancelled members |

Batch state is authoritative — no member-specific states displayed in the
panel while batched. Member display is for context only.

Quick action: "Open in Batch Editor" navigates to the Batch Editor surface.

---

## Pending Definition Changes

Visible only when the row (WO or Batch) has at least one open Definition
Change Flag.

For each open flag, display:

| Field | Notes |
|-------|-------|
| Change description | Human-readable summary (e.g., "Default vendor changed: Acme → Globex") |
| Change context | When changed, who changed it |
| Audit log link | Click to view the underlying definition change in full |
| Resolution buttons | Dismiss / Accept Change (latter conditional per change type) |

For batched WOs: indicator that the flag is batch-shared, with link to
"Resolve at batch level" via the Batch Editor.

For batch flags (when viewing a Batch row): list of all member flags for
context, with note that batch-level resolution applies atomically to all
members.

**Permissions:**
- Operator and Lead: see flags and read context, cannot resolve
- Manager and Admin: full resolution capability

When the user clicks Resolve (Dismiss or Accept Change), the resolution
modal opens per the workflow defined in `definition_change_flag_spec.md`.

---

## Blocker Section

Visible only when the row has an Open or Pending Resolution blocker.

| Field | Notes |
|-------|-------|
| Blocker status | Open / Pending Resolution |
| Created at, by | Timestamp and user |
| Note | Required at creation |
| Pending Resolution context | If applicable: pendingAt timestamp, pendingByUserId |
| Pre-blocker state | Captured at creation |
| Resolution actions | Available per user permissions and resolution-type eligibility |

Resolution actions per `blocker_spec.md`:
- Cleared (any role on own station)
- WO Split (Manager/Admin)
- Batch Adjustment (Manager/Admin, batch only)
- Routing Rollback (Manager/Admin)

---

## Notes

Always visible.

- WO-level notes (free text)
- Edit history visible (timestamps, attribution)
- Can be added or edited inline by users with permission

---

## Actions

Always visible. Filtered by user permissions and row state.

### Standard Actions (per row state)

For Open WOs in execution:
- State transitions (per the active step's process lens)
- Create Blocker / Resolve Blocker
- Add Note

For batched WOs:
- Open Batch in Batch Editor
- Standard state transitions apply at batch level

### Manager/Admin Primitives

Available to Manager/Admin only, conditional on row state and structural
constraints:

| Primitive | Conditions |
|-----------|-----------|
| Loss | Adjusts CompletedQty / ScrapQty on a step. Available when step has CompletedQty > 0 |
| Rollback | Reverts step state from Complete back to Started or Ready. Available on Complete steps |
| Return to Stock | Reverses Fulfill from Stock. Available on WOs with Skipped steps from stock fulfillment |
| WO Split | Divides WO into two. Available on WOs with progress (full conditions per WO Split spec) |
| **Cancel** | Sets WOStatus to Cancelled. Available only on leaf WOs (no non-Cancelled descendants). One-way in Rev 1 |

The Cancel action is the fifth primitive added via the Definition Change
Flag spec. See that spec for full Cancel workflow including:
- Leaf-only constraint enforcement
- Required note
- Side-effect display in confirmation modal (parent readiness recalc, batch
  removal, flag auto-resolution if applicable)
- AuditLog entries

---

## Permissions Summary

| Action | Operator | Lead | Manager | Admin |
|--------|----------|------|---------|-------|
| View panel | ✓ | ✓ | ✓ | ✓ |
| See flag indicators and context | ✓ | ✓ | ✓ | ✓ |
| Inline edits (notes, sub-status) | ✓ (own station) | ✓ | ✓ | ✓ |
| State transitions on own station | ✓ | ✓ | ✓ | ✓ |
| Create Blocker on own station | ✓ | ✓ | ✓ | ✓ |
| Resolve Blocker (Cleared) on own station | ✓ | ✓ | ✓ | ✓ |
| Pending Resolution transition | — | — | ✓ | ✓ |
| Resolve Blocker (other types) | — | — | ✓ | ✓ |
| Resolve Definition Change Flag | — | — | ✓ | ✓ |
| Edit Priority | — | — | ✓ | ✓ |
| Apply primitives (Loss, Rollback, Return to Stock, WO Split, Cancel) | — | — | ✓ | ✓ |

---

## Design Notes

- The panel is the canonical surface for row-level context and action. All
  operational lenses route through it for detailed work — no view re-implements
  this content
- Section visibility is conditional — sections only appear when relevant data
  exists (e.g., Pending Definition Changes only when flags are open). This keeps
  the panel scannable
- The Yellow Flag indicator (Definition Change Flag) and Red Flag indicator
  (Blocker) are visually distinct — Definition Change Flags are informational
  and decision-pending; Blockers stop work
- Operators see flags but cannot resolve them. This intentional limit prevents
  operators from making decisions that require Manager-level context, while
  still giving them visibility to escalate
- Cancel is intentionally placed alongside the other primitives in the Actions
  section — it's a Manager-level edit primitive, not a Blocker resolution and
  not a Definition Change Flag resolution. The Cancel is its own primitive
  that may be used in conjunction with flag resolution workflows
- The Batch Context section makes batch identity always visible; "Open in Batch
  Editor" gives one-click access to the batch's full editor surface for
  restructuring or per-member flag handling
