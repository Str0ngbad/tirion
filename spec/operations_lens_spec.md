# Tirion — Operations Lens Spec (Foreman View)

## Purpose

The Operations Lens provides a real-time, high-level view of production flow across
the shop. It enables foreman-level decisions about load balancing, bottlenecks, and
coordination without requiring deep navigation into individual process lenses.

This view shows reality, not a schedule. Filters define the operational context.
The system does not enforce a concept of "today."

---

## Visibility Rules

A Production Row appears in the Operations Lens when ALL of the following
are true:
- WOStatus IN (`Open`, `Complete`)
- Parent Project is Active or Complete (not Archived)
- WO is not Cancelled

**Open WOs** are the operational focus — work that's in flight. **Complete
WOs** are shown for a configurable retention window after completion (provides
context for "what just finished"); after the window, Complete WOs are hidden
by default but accessible via filter.

A Production Row leaves this lens when:
- The WO is Cancelled (terminal state — excluded from operational visibility), OR
- The WO is Complete and outside the retention window (still accessible via
  "Show All Complete" toggle)

Cancelled WOs are excluded from this lens entirely. Unreleased WOs are
excluded — they have not yet entered execution.

---

## Row Model

Each row represents a **Production Batch** (primary) or a lone **Work Order**
(fallback when unbatched). Batches are the primary execution unit.

Rows are grouped by Current Process. Within each group, default sort order is:
**Blocked → Ready → Priority (ascending) → Due Date (ascending)**

---

## Grid Columns

| Column | Notes |
|--------|-------|
| Reference ID | Batch ID or WO ID |
| Part / Assembly Name | |
| Priority | Global integer |
| Due Date | |
| Project Due Date | Earliest due date among projects in this batch/WO |
| Planned Quantity | What will be produced |
| Demand Quantity | What is required |
| Current State | Ready, In Progress, Blocked, etc. |
| Sub-State | Free text operator context |
| Last Activity Date | Most recent state change |
| Current Step | First routing column — colored process type cell |
| Next Step | Second routing column |
| Subsequent Steps | Up to 3 more columns (5 total including Current) |
| Batch / WO ID | Reference field |
| Indicators | Row Indicators per `terminology_lock.md` Cluster 9: Red Flag (Blocker), Yellow Flag (Definition Change Flag), White Flag (Supply Order Exception). Display order: Red → Yellow → White |
| Assembler Review Flag Indicator | Distinct icon if Assembly WO has open Assembler Review Flag (Assembly WOs only) |

---

## Routing Grid

The routing columns are the signature feature of this view. They provide
forward-looking visibility of where work is going without requiring navigation
to individual lenses.

**Rules:**
- Forward-only — completed steps are not shown
- First column = Current Step (where work is now)
- Subsequent columns = next steps in sequence
- Maximum 5 routing columns total
- Each cell is color-coded by ProcessType (same color palette as process type
  indicators throughout the system)
- White/low-emphasis cell = Distribution step
- Empty/gray cell = no further steps at that position

The crescent left-edge color pattern identifies the current process type on each row.

---

## Filtering

### Default Mode (Global Operations)

Default view is constrained to keep the grid scannable. Shows rows where ANY of:
- Priority ≤ threshold (configurable)
- Due Date within window (configurable)
- State = Blocked

This surfaces the work that needs attention without showing everything.

### Project Focus Mode

Activated by selecting a Project ID. Overrides all default filters.
Shows all batches/WOs contributing to that project regardless of priority or date.
Used for coordination and delivery readiness checks.

### Additional Filters (available but not default)
- Filter by Current Process
- Filter by State (Blocked only, Ready only, etc.)
- Priority threshold adjustment
- Due Date window adjustment
- Show All Complete (extend Complete WO visibility beyond default retention window)
- **Pending Definition Changes** — show only rows with open Definition Change Flags
- **Open Supply Order Exceptions** — show only rows with active Supply Order Line Exceptions
- **Open Assembler Review Flags** — show only Assembly rows with open Assembler Review Flags. Useful for managers performing review sweeps before project archival or as routine quality oversight

### Sort Options

The default sort is Blocked → Ready → Priority → Due Date as noted under Row
Model. Additional sort options available via column header click:

- **Readiness Deficiency** — sorts Assembly WOs by the magnitude of their
  readiness gap (e.g., "10/15 ready" sorts ahead of "11/15 ready" because
  4 components missing is more deficient than 4 missing). For non-Assembly
  rows, this sort is neutral. Useful for foremen identifying which
  assemblies are furthest from readiness vs. which are closest
- **Last Activity Date** — surfaces stale work (rows that haven't moved
  recently), useful for identifying neglected items
- **Project Due Date** — groups work by delivery commitment

---

## Anchor and Filter

Operations Lens supports the Anchor + Filter system per
`anchor_filter_spec.md`. The anchor selector is in the view-shaping controls
section.

**Selections:** None + 9 process anchors (Purchase, Receive, Machine, Weld,
Blacken, Paint, 3D Print, Assemble, Distribution). All Rev 1 ProcessTypes
are anchor-eligible.

**Filter options when anchor is active** (mutually exclusive):
- None
- Anchor Pending
- Ready for Anchor
- Blocked for Anchor
- Includes Anchor

See `anchor_filter_spec.md` for full filter taxonomy.

**Interaction with default sort:**
The Operations Lens default sort (Blocked → Ready → Priority → Due Date)
continues to apply when an anchor is active. Anchor changes the visual
layout of the routing column but not the row ordering. Combined with the
"Ready for Anchor" filter, this surfaces the most-actionable work for the
anchored process at the top of the list.

**Interaction with grouping:**
Default grouping (Current Process) interacts naturally with anchor selection:
the group containing the anchored process expands by default; other groups
display per their normal collapsed/expanded state. Managers anchored on
Weld see the Weld group expanded with welding-relevant rows clearly
visible.

**Anchor + filter as substitute working surface for non-lens processes:**
Weld, Blacken, Paint, and 3D Print do not have dedicated execution lenses
in Rev 1. The Operations Lens with anchor + filter serves as their
operational coordination surface — managers anchor on the relevant
process, filter to "Ready for Anchor" to see actionable work, and update
state via the side panel as work happens (typically based on verbal
operator updates for Weld/Paint or vendor knowledge for Blacken).

---

## Grouping

Default grouping: **Current Process**

Each process group is collapsible. Group header shows process name, row count,
and a count of Blocked rows within the group.

---

## Side Panel

Selecting a row opens the shared detail side panel (see `detail_panel_spec.md`).
From the Operations Lens, the panel provides context and links to the relevant
process lens — it does not provide execution controls. Execution happens in
the process-specific lenses.

The Operations Lens does not contribute its own Process-Specific Section
content. When a row is selected, the Process-Specific Section displays the
WO's currently selected step (defaulting to active step on panel open).

Per the Detail Panel spec, the routing steps in the Routing Detail section
are clickable in management views — the manager can click any step to swap
the Process-Specific Section to that step's view. This enables cross-process
visibility from the Operations Lens (e.g., looking at a WO currently in
Machining and clicking the Purchasing step to review what was ordered, or
clicking the upcoming Assembly step to preview that section's content).

Editability follows the standard rules per the Detail Panel spec — Complete
steps are read-only (historical preservation); active and future steps are
editable subject to permission.

---

## Key Outcomes

- Immediate visibility of shop load by process
- Identification of bottlenecks and blocked work
- Awareness of downstream pressure (upcoming steps)
- Support for rapid foreman decision-making without deep navigation

---

## Design Notes

- Must remain scannable at 200+ rows. Row density is a feature, not a problem.
- Routing columns must not visually dominate the primary state reading.
  State and priority are the most important columns — routing provides context.
- Color key for process types should be accessible from this view (legend or
  hover tooltip).
- The view should feel like a live production board, not a report.
