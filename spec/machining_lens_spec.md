# Tirion — Machining Lens Spec

## Purpose

The Machining Lens supports execution of machining work orders in a priority-driven
shop environment. It allows machinists and production managers to identify ready work,
execute operations, record completion quantities, and escalate blockers.

Machining operates as a priority-driven queue, not a rigid schedule. Machinists
choose work by balancing part priority, machine availability, setup efficiency,
unattended runtime, and operator bandwidth.

---

## Primary Users

- **Machinist** — executes work and reports completion
- **Lead Machinist** — may adjust machine assignments or time estimates
- **Production Manager** — manages priorities and resolves blockers

---

## Visibility Rules

A Production Row appears in the Machining Lens when ALL of the following
are true:
- WOStatus = `Open`
- Active routing step has `processType = Machine`
- Active step state is not Complete and not Skipped
- Parent Project is Active (not Archived)
- WO is not Cancelled

A Production Row leaves this lens when:
- The Machine step is marked Complete (advances to next step), OR
- The Machine step is Skipped (e.g., cascade-skip from upstream Fulfill from
  Stock — handled in Stock Fulfillment, not here), OR
- The WO is Cancelled (terminal state — excluded from operational visibility)

Cancelled WOs are excluded from this lens entirely.

---

## Row Model

Each row represents a Work Order (or Production Batch) at the Machining
process step. The Production Batch is the unit when the WO is batched; the
WO is the unit when standalone.

---

## Grid Columns

| Column | Notes |
|--------|-------|
| Part Number | |
| Part Name | |
| Project ID | |
| Quantity | WO quantity |
| Raw Material Specification | From Part's MaterialSpec |
| Material Allocated | Whether material is reserved for this WO |
| Material ETA | If material not yet received |
| Purchasing / Receiving Status | Upstream state context |
| Machine Required | From Part or operator entry |
| Machine Assignment | Which machine is assigned |
| Setup Time Estimate | Engineering estimate; operator may revise |
| Machining Time Estimate | Engineering estimate; operator may revise |
| Priority | Global WO priority |
| Due Date | |
| Process State | Waiting / Ready / Started / Complete / Blocked |
| Process Sub-Status | Free text operator context |
| Flag Indicator | Row Indicators per `terminology_lock.md` Cluster 9: Red Flag (Blocker), Yellow Flag (Definition Change Flag). White Flag (Supply Order Exception) does NOT apply in this lens. Display order: Red → Yellow |

The left-edge crescent color identifies this as a Machining row (consistent
process type color throughout the system).

---

## Process State Model

| State | Meaning |
|-------|---------|
| Waiting | Prior routing steps not yet complete |
| Ready | All prior steps complete; work can begin |
| Started | Machining in progress |
| Complete | Machining step finished; quantity recorded |
| Blocked | Cannot proceed — blocker created |

---

## Operator Actions

**State transitions (in grid or side panel):**
- Ready → Started (begin setup/machining)
- Started → Complete (opens completion dialog)
- Started → Blocked (opens blocker creation)

**Sub-status updates:**
- Free text field updated directly in grid or side panel
- Common values: Setup, Running, Complete, Hold for QA, Hold for Next Setup
  (per `seed_data_spec.md` Machine sub-status seed)
- These do not trigger state changes — they are operator context within a state

---

## Completion Dialog

When marking a step Complete, the operator must enter:
- **Quantity Completed** — good parts produced
- **Quantity Scrapped** — defective parts (logged but do not satisfy demand)

**Validation:**
- CompletedQty must meet or exceed WO demand quantity
- ScrapQty cannot satisfy demand — only good parts count
- If production stops mid-run due to issues, use Blocked state instead of Complete

---

## Side Panel — Process-Specific Section

The shared Detail Panel structure (per `detail_panel_spec.md`) handles
Header, Status, Routing Detail, Dependency Context, Batch Context, Pending
Definition Changes, Blocker Section, WO-level Notes, and Actions.

This lens's Process-Specific Section content (rendered between Routing Detail
and Dependency Context per the shared structure):

| Field | Editability | Notes |
|-------|-------------|-------|
| Machine Required | Read-only | From routing template snapshot. Optional — may be blank. See Design Note below |
| Machine Assignment | Editable per step state and permission | Specific machine within the Machine Required type. Optional — may be blank |
| Setup Time Estimate (Engineering) | Read-only | From routing template snapshot |
| Setup Time Estimate (Operator Revision) | Editable | Stored alongside engineering estimate; never overwrites it. Both are persisted |
| Machining Time Estimate (Engineering) | Read-only | From routing template snapshot |
| Machining Time Estimate (Operator Revision) | Editable | Same pattern as Setup Time |
| Operator Assignment | Editable | Optional — who's running this WO |
| Process Sub-Status | Editable | Per ProcessTypeSubStatus seed |
| Engineering Notes | Read-only | From routing template snapshot |
| Previous Production History (collapsed by default) | Read-only | How many of this Part have been made before, when, by whom |
| Process Notes | Editable, append-only | Free text; timestamped and attributed; newest at top. Scoped to the Machining step |

**Revision Information:** dropped from Rev 1. Adds value only alongside
features that aren't in Rev 1 scope (formal engineering change control).

### Design Note: Optional Machine Fields

Machine Required and Machine Assignment are optional fields. They may be
blank without preventing any operational action.

These fields exist now to enable progressive data collection that supports
future scheduling models. The system architecture is designed to eventually
handle a spectrum of scheduling approaches:

- **Job-shop traditional** (current dominant mode): work flows through
  available machines as operators choose; assignment is informal
- **Machine-time-block scheduling**: specific machines are reserved for
  specific WOs in specific time windows; assignment is formal and
  schedule-driven
- **Blended modes**: some machines treated as time-block resources, others
  as job-shop pool; some WOs scheduled tightly, others flexibly

Capturing Machine Assignment data when it's available (even when not
strictly required) provides the historical signal that future scheduling
features can build on. This is intentional foundation work — not all small
shops need it now, but the data path exists when they're ready.

---

## Blocker Model

If machining cannot continue due to an external issue (tool failure, material defect,
missing drawing, design issue, etc.), the row enters Blocked state.

Creating a blocker requires:
- A note describing the issue (required)
- Category: Local or Escalated

Clearing a blocker requires a resolution note. See `blocker_spec.md` for full
blocker creation and resolution workflows.

---

## Configurable Lens Component

The Machining Lens is the first process lens built and establishes the pattern for
all other process execution lenses. The base lens component is configurable by
ProcessType — other lenses (Purchasing, Receiving, Assembly, Distribution) render
through the same component with process-specific column additions.

Machining-specific additions beyond the base lens:
- Machine Required column
- Machine Assignment column
- Setup Time Estimate column
- Machining Time Estimate column
- Previous quantities produced in side panel
- Operator assignment in side panel

---

## Design Notes

- Visual density is a feature. Machinists scan for their next job — the grid
  must be readable at a glance.
- Process state is communicated with icons or colored indicators, not just text.
- Completed rows are greyed out or hidden (toggle available).
- Blocked rows show a clear warning indicator — they should not blend in.
- The routing step indicator (crescent left edge) uses the Machining process
  type color consistently.
- Setup and cycle time estimates serve as planning reference, not enforcement.
  The system captures both original estimates and operator revisions for
  future improvement of estimates over time.
