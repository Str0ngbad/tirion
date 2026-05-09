# Tirion — Anchor Filter Spec

## Purpose

The Anchor + Filter system is a view-shaping mechanism that lets a user
focus on a specific process step across all WOs in a management view.
Selecting an anchor causes the routing display to align that step
vertically across rows; selecting a filter narrows the visible rows based
on that anchored step's state.

The system serves managers and planners who think in terms of "show me
everything that's about to be machined" or "show me what's stuck waiting
for assembly to be ready." Without it, comparing WOs at the same point
in their routing requires manual visual scanning.

The Anchor Filter system is a Rev 1 capability of the **Project View** and
the **Operations Lens**. It does not apply to operational lenses (Purchasing,
Machining, etc.) — those are already inherently process-anchored to their
own process type.

---

## Anchor Selection

The user selects an anchor from a dropdown in each view's view-shaping
controls. Ten selections in Rev 1:

| Selection | Behavior |
|-----------|----------|
| None | No anchor active; routing displays in default inline mode |
| Purchase | Anchor on the Purchase step |
| Receive | Anchor on the Receive step |
| Machine | Anchor on the Machine step |
| Weld | Anchor on the Weld step |
| Blacken | Anchor on the Blacken step |
| Paint | Anchor on the Paint step |
| 3D Print | Anchor on the 3D Print step |
| Assemble | Anchor on the Assemble step |
| Distribution | Anchor on the Distribution step |

Anchor selection is per-view-session — not persisted across sessions in
Rev 1. A user opening Project View finds it in None mode by default.
Re-selecting on each session is acceptable for Rev 1.

**Hard rule:** Only one anchor can be active at a time. The user cannot
anchor on multiple processes simultaneously.

**Hard rule:** All 9 Rev 1 ProcessTypes are anchor-eligible. This includes
ProcessTypes without dedicated execution lenses (Weld, Blacken, Paint,
3D Print) — see Design Notes section.

**Hard rule:** Inspect and Finish are not Rev 1 ProcessTypes and therefore
not anchor options. This may change in later revisions if those processes
are added.

---

## Visual Behavior of Anchor Active

When an anchor is selected (anything other than None), the routing display
in each view changes:

### Routing Grid Column Alignment

The routing grid column reorganizes so the anchored step appears in the
same vertical position across all rows, regardless of where it falls in
each WO's individual routing.

**Example without anchor (default inline routing):**
```
Row 1: Purchase → Receive → Machine → Distribution
Row 2: Purchase → Receive → Assemble → Distribution
Row 3: Receive → Machine → Distribution
```

**Same rows with Machine anchor:**
```
Row 1: Purchase → Receive → [Machine] → Distribution
Row 2: Purchase → Receive →    ___    → Assemble → Distribution
Row 3:        Receive    → [Machine] → Distribution
```

The Machine column is vertically aligned across rows where it appears.
Rows where the anchored process doesn't appear in routing display the full
routing path without alignment to that column (de-emphasized — see Row
Treatment below).

### Routing Path Display

In Rev 1, the full routing path is always displayed when an anchor is
active. Pre-anchor and post-anchor step counts are NOT configurable —
no "show only N steps before/after anchor" feature.

This is a Rev 1 simplification. The number of process steps is small enough
(5 ProcessTypes maximum) that displaying the full path remains scannable.

If future revisions add many more ProcessTypes (Rev 2+), pre/post step
limiting may become valuable.

### Anchored Step Visual Emphasis

The anchored step, where it appears in each row's routing, is visually
emphasized:
- Bolder column treatment (background highlight, thicker border, or similar)
- Step state still visible (Ready, Started, Complete, Skipped, Blocked)

The visual emphasis makes the anchored step the visual centerpiece of the
routing display, supporting the user's mental model of "this is what I'm
focused on."

---

## Filter Selection

A separate dropdown adjacent to the anchor selector offers anchor-relative
filters. Filters are mutually exclusive — the user selects one or none, not
multiple.

Five filter options in Rev 1:

| Filter | Definition |
|--------|------------|
| None | No anchor-relative filtering. Default. Rows shown per other view filters |
| Anchor Pending | Anchored step exists on this WO and is not Complete (Waiting / Ready / Started / Blocked). Excludes Skipped and Complete |
| Ready for Anchor | All prerequisites for the anchored step are Complete or Skipped. The anchored step itself is in Ready, Started, or Blocked state (explicitly NOT Waiting) |
| Blocked for Anchor | Anchored step exists on this WO and at least one prerequisite step is not Complete or Skipped. The anchored step itself is in Waiting state |
| Includes Anchor | Anchored process appears anywhere in this WO's routing, regardless of state. Broadest filter |

### Filter Taxonomy

The filters form a hierarchy of progressively narrower scope:

```
Includes Anchor (broadest — all routing-includes)
  ├─ Anchor Complete (anchor exists and is Complete or Skipped)
  │     [no filter for this in Rev 1; covered by Includes Anchor minus Pending]
  └─ Anchor Pending (anchor exists, not yet Complete or Skipped)
       ├─ Ready for Anchor (prerequisites met)
       └─ Blocked for Anchor (prerequisites not met)
```

The user picks the filter matching their current focus:
- "What WOs include this process at all?" → Includes Anchor
- "What WOs still need this process done?" → Anchor Pending
- "What's actively ready or in progress at this process?" → Ready for Anchor
- "What's stuck before reaching this process?" → Blocked for Anchor

### Filter Activation Without Anchor

Filters are only meaningful with an anchor selected. If the user selects a
filter while anchor is None, the filter dropdown should be disabled or
hidden. The filter dropdown is enabled only when anchor ≠ None.

---

## Row Treatment

The system has different rules for rows where the anchored process does NOT
apply (the WO's routing doesn't include the anchored ProcessType).

### Anchor Active, Filter = None

Rows where the anchored process doesn't apply are shown with **de-emphasis**:
- Routing display shows full path without alignment to the anchor column
  (since there's no anchored step to align to)
- Row visually de-emphasized (lower contrast, lighter weight, or similar)
- Other row content (Project, Part, etc.) remains visible

This preserves BOM and project context when scanning. A planner anchored on
Machine should still see non-machined sub-assemblies in the project tree
without filtering them out.

### Anchor Active, Any Filter Selected

Rows where the anchored process doesn't apply are **excluded** entirely.
The user has actively narrowed scope to "anchored-step-relevant rows," and
non-applicable rows are out of scope by definition.

This applies to all four anchor-relative filters (Anchor Pending, Ready for
Anchor, Blocked for Anchor, Includes Anchor).

### Summary

| Anchor | Filter | Non-applicable rows |
|--------|--------|---------------------|
| None | (filter dropdown disabled) | Shown normally |
| Active | None | Shown with de-emphasis |
| Active | Any filter | Excluded |

---

## Behavior in Project View

The Project View Anchor + Filter implementation supports the full system
described above.

**Selector location:** view-shaping controls section, alongside the routing
mode toggle and other column controls.

**Default state:** Anchor = None on session start. Filter dropdown disabled
when anchor is None.

**Interaction with other Project View filters:**
- Anchor + Filter operates as additional filter criteria layered on top of
  Project Key filters and other view-shaping filters
- Show Complete / Show Cancelled / Show Unreleased toggles continue to
  apply
- Open Definition Change Flags / Open Supply Order Exceptions / Open
  Assembler Review Flags filters continue to apply
- Multiple filter dimensions can compose: e.g., "Anchor: Machine, Filter:
  Ready for Anchor, Show Complete: Off, Show Cancelled: Off" produces a
  scoped view of WOs ready for machining excluding Complete and Cancelled

**Anchor + sort interaction:**
The default sort by Project + Top-Level + BOM hierarchy continues to apply.
Anchor changes the visual layout of the routing column but does not change
row ordering. If the user prefers the standard Project hierarchy view with
just the visual alignment, they accept the current sort.

(If a future revision wants "sort by anchored step state" as an alternative
sort option, it can be added in Rev 2.)

---

## Behavior in Operations Lens

The Operations Lens Anchor + Filter implementation works the same way,
adapted to the lens's row model (Production Batches as primary rows, lone
WOs as fallback).

**Selector location:** view-shaping controls section.

**Default state:** Anchor = None on session start.

**Interaction with other Operations Lens features:**
- Default sort (Blocked → Ready → Priority → Due Date) continues
- Group-by-process grouping interacts with anchor selection: when an
  anchor is selected, the group containing the anchored process expands by
  default; other groups display per their normal collapsed/expanded state
- Filters compose with Open Definition Change Flags / Open Supply Order
  Exceptions / Open Assembler Review Flags / Show All Complete

**Anchor on Production Batches:**
Batch members share routing structure (same routing template required for
batching), so anchor application is straightforward — the batch's routing
is the anchored target, same as for any single WO.

---

## Hard Rules

| # | Rule |
|---|------|
| AF-1 | Only one anchor can be active at a time |
| AF-2 | Anchor selections in Rev 1: None + 9 process anchors (Purchase, Receive, Machine, Weld, Blacken, Paint, 3D Print, Assemble, Distribution) — 10 total selections. All 9 Rev 1 ProcessTypes are anchor-eligible regardless of whether they have execution lenses. Inspect and Finish are not Rev 1 ProcessTypes |
| AF-3 | Anchor + Filter system applies to Project View and Operations Lens. Operational lenses (Purchasing, Receiving, etc.) do not have this system |
| AF-4 | Filter dropdown is disabled when anchor is None |
| AF-5 | Filters are mutually exclusive (only one filter or none) |
| AF-6 | Pre/post-anchor step count limiting is NOT a Rev 1 feature; full routing path is always displayed when an anchor is active |
| AF-7 | When anchor is active and no filter applied, non-applicable rows are de-emphasized (not excluded) |
| AF-8 | When anchor is active and any filter applied, non-applicable rows are excluded |
| AF-9 | Filter dropdown options form a hierarchy: Includes Anchor ⊃ Anchor Pending ⊃ {Ready for Anchor ∪ Blocked for Anchor} |
| AF-10 | Anchor selection is per-session; not persisted across sessions in Rev 1 |
| AF-11 | The anchored step is visually emphasized in the routing display where it appears |

---

## Schema Implications

This spec does not require schema changes. The Anchor + Filter system
operates entirely on display and query logic against the existing
WorkOrderStep and routing data:

- Anchor identification: match `WorkOrderStep.processTypeId` against
  the selected ProcessType
- Anchor Pending filter: WOs where the matching step exists and its state
  is not Complete and not Skipped
- Ready for Anchor filter: WOs where the matching step exists, all
  lower-stepIndex steps are Complete or Skipped, and the matching step's
  state is Ready, Started, or Blocked (not Waiting)
- Blocked for Anchor filter: WOs where the matching step exists and at
  least one lower-stepIndex step is not Complete or Skipped (matching
  step is in Waiting state)
- Includes Anchor filter: WOs where the matching step exists in routing
  at all

These are query-layer concerns, no new persisted state required.

---

## Design Notes

- The Anchor + Filter system is a power-user feature for managers and
  planners doing comparative analysis. New users may not need it; the
  default None mode keeps the view clean and approachable.

- **Anchor + filter as substitute working surface for non-lens processes.**
  All 9 Rev 1 ProcessTypes are anchor-eligible, including the four that
  lack dedicated execution lenses (Weld, Blacken, Paint, 3D Print). For
  these processes, anchor + filter in the Operations Lens serves as the
  substitute working surface — a manager can anchor on Weld with filter
  "Ready for Anchor" to see all WOs ready for welding, then update state
  via the side panel as work happens. Without dedicated lenses for these
  processes, anchor support is the operational mechanism that lets
  management coordinate non-lens work effectively.

- The decision to remove pre/post-anchor step count limiting (which was in
  the original anchor design) reflects the small Rev 1 ProcessType count
  (5 active types). With routing paths typically 3-5 steps long, pre/post
  limiting adds UI complexity without solving a real readability problem.

- The de-emphasis-vs-exclude rule for non-applicable rows reflects the
  different mental modes: anchor-without-filter is exploratory ("show me
  the structure"); anchor-with-filter is focused ("show me what matters
  for this step"). Different modes warrant different treatments.

- The filter taxonomy (Anchor Pending as a superset of Ready/Blocked for
  Anchor) enables progressive narrowing. A user can start with Anchor
  Pending to see all the work that still needs the anchored step, then
  narrow to Ready for Anchor or Blocked for Anchor depending on what they
  want to act on.

- Anchor + Filter for Operations Lens works particularly well with the
  existing Blocked-first sort. A manager anchored on Machine with filter
  "Ready for Anchor" sees actionable machining work; the same manager with
  filter "Blocked for Anchor" sees what's stuck and needs attention.

- The system intentionally does not introduce per-anchor visual styling
  (e.g., different colors for different anchors). The single "anchored
  step is emphasized" treatment is consistent regardless of which process
  is anchored. This keeps the visual vocabulary simple.

---

## Rev 2 Wishlist

- Persist anchor + filter selection per-user across sessions
- Pre/post-anchor step count limiting (when ProcessType count grows)
- Multiple simultaneous anchors (compound focus)
- Anchor-aware sort options (e.g., "sort by anchored step state ascending")
- Per-anchor visual styling for users who configure many views
- Integration with operational lens grids (would require rethinking lens
  semantics; deferred until clear use case emerges)
