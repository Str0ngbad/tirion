# Tirion — Production Batching Lens Spec

## Purpose

The Production Batching Lens is the second planning gate after Stock Fulfillment
and the final gate before work becomes visible on the shop floor. It is a planning
workspace for organizing released-from-Stock-Fulfillment Work Orders into Production
Batches, setting Planned Quantities, and confirming WOs into execution.

This lens uses a draft-then-confirm model. The planner shapes the work — batching,
setting quantities, choosing what to confirm — and nothing enters execution until
the planner explicitly confirms.

The Batching Confirm event transitions WOStatus from `Unreleased` to `Open`. This
is the critical state transition that makes WOs visible to execution lenses,
Operations Lens, and Project View as operational work.

---

## Operational Sequence

```
Project Created → Stock Fulfillment Pass → Batching Lens → Execution Lenses
                                                  │
                                          (Batching Confirm: Unreleased → Open)
```

A Work Order appears in the Batching Lens only after Stock Fulfillment has
released it (set `stockFulfillmentReviewedAt`). Stock Fulfillment release does
not transition WOStatus — released-from-fulfillment WOs remain `Unreleased` until
Batching Confirm transitions them to `Open`.

This is the per-WO model: WOs progress individually through Stock Fulfillment
and Batching gates. Projects do not "clear" Batching as a unit. Each WO is its
own progression.

---

## Visibility Rules

The Batching Lens shows PartID context for any Part that has work in flight,
not just batching candidates. This serves both purposes of the lens:
- **Batching:** identifying Unreleased+reviewed WOs that can be combined
- **Coordination awareness:** seeing what's already in execution for a Part so
  the planner can recognize coordination opportunities

### PartID Surfacing

The Batching Lens surfaces a PartID when ANY of the following exist for that
PartID:
- An Unreleased + reviewed WO (`WOStatus = Unreleased` AND
  `stockFulfillmentReviewedAt IS NOT NULL`)
- An Open WO or Open batch (`WOStatus = Open`)

When a PartID is surfaced, ALL related WOs across both states are shown
together as one PartID context block. The planner sees the full landscape for
that Part.

When all of a PartID's WOs leave both Unreleased+reviewed and Open states
(e.g., they all transition to Complete or Cancelled), the PartID's surface area
in this lens collapses.

### Row Treatment Within a Surfaced PartID

| WO State | Treatment in Batching Lens |
|----------|---------------------------|
| Unreleased + reviewed | Moveable candidate — planner can combine, add to existing Open batches/WOs, or leave standalone |
| Open (standalone WO or batch) | Active Production Row — context AND add-target for new candidates per Quantity Rules |
| Complete | Not shown (terminal — outside the planning surface) |
| Cancelled | Not shown (terminal — outside the planning surface) |
| Unreleased + NOT reviewed | Not shown (still in Stock Fulfillment) |

### Hidden Singleton Queue

A WO is in the hidden singleton queue when:
- WOStatus = Unreleased
- `stockFulfillmentReviewedAt IS NOT NULL`
- No other WO of the same PartID exists in either Unreleased+reviewed OR Open
  state

In other words: the WO is genuinely alone — no related WOs to combine with, no
related Open work to coordinate timing with. There is nothing for the planner
to decide between, and surfacing the row would add noise without value.

Hidden singletons are tracked in the system but excluded from the default
candidate view. They are accessible via an explicit "Show hidden singletons"
toggle, allowing the planner to confirm singletons proactively when desired.

### Surfacing Behavior

When a new Unreleased+reviewed WO arrives for a PartID that has either:
- An existing hidden singleton for that PartID, OR
- An existing Open WO or Open batch for that PartID,

the PartID immediately surfaces in the active list with all related WOs
visible together.

When a planner Confirms a candidate (transitions Unreleased → Open) and no
other Unreleased+reviewed WOs remain for that PartID:
- If any Open WOs of that PartID still exist → the PartID context remains
  visible (showing the now-confirmed WO joining the Open landscape)
- If no other WOs of that PartID exist anywhere → PartID surface collapses

When a previously-paired Unreleased+reviewed WO is the last one and its only
candidacy partner was just Confirmed (now Open), the WO does NOT return to
the hidden queue — Open WO presence keeps the PartID visible.

A WO returns to the hidden singleton queue only when it becomes truly alone
(no other Unreleased+reviewed and no Open WOs of the same PartID exist).

### Excluded from Batching Lens

- WOStatus = `Complete` or `Cancelled` — terminal states, outside the planning surface
- WOs with `stockFulfillmentReviewedAt = null` — still in Stock Fulfillment
- WOs in Archived Projects

**Hard rule:** Visibility in the Batching Lens is per-WO and per-PartID, never
per-Project. A Project may have some WOs visible in Batching, others still in
Stock Fulfillment, others already Open in execution, and others Cancelled — all
simultaneously.

---

## Stock Fulfillment Pass-Through Model

Released-from-Stock-Fulfillment WOs arrive in Batching with their fulfillment
decisions already recorded:

| Stock Fulfillment Outcome | Batching Visibility |
|--------------------------|---------------------|
| Fulfill from Stock | NOT in Batching (WOStatus = Complete; bypassed both gates) |
| Pass Through (explicit) | Visible in Batching as candidate or hidden singleton |
| Auto-Pass-Through (lost candidacy) | Visible in Batching as candidate or hidden singleton |
| Non-candidate at release time | Visible in Batching as candidate or hidden singleton |

Fulfilled WOs do NOT pass through Batching. They go directly Unreleased →
Complete via Skipped steps in the Stock Fulfillment workflow. They are visible
in Operations Lens and Project View as completed project context.

All other WOs that reached Stock Fulfillment Release pass through Batching.

---

## Scope

- Applies to all Part types (Make, Buy, MakeBuy) and Assemblies
- Batches group same-PartID WOs only — Assemblies batch with same-Assembly WOs
- Batches may span multiple Projects
- This is Production Batching — grouping same-PartID WOs for consolidated execution
- Process Batching (grouping any parts for a shared single process step,
  cross-PartID) is a separate Rev 2 concept

---

## The Planning Workspace

The Batching Lens is a live draft workspace. The planner organizes Unreleased+
reviewed WOs — assigning them to batches or leaving them standalone — before
confirming the draft. No state transitions are committed until the planner
confirms.

**What can be moved:**

Open Production Rows (Open WOs and Open batches) and their members cannot be
moved themselves in this lens. Only Unreleased+reviewed candidates can be moved
— combined with each other, added to Open batches/WOs as new members per the
Quantity Rules, or left standalone.

Restructuring Open work (changing batch composition, splitting batches, etc.)
uses the Batch Adjustment Workspace via the Blocker workflow, not this lens.

**Draft behavior:**
- All batch assignments and quantity changes are provisional until confirmed
- Exiting without confirming discards all provisional changes
- On confirm: all Production Rows toggled for confirmation transition WOStatus
  from Unreleased to Open and enter execution lenses

---

## Row Types

| Row Type | Description |
|----------|-------------|
| New WO Row | Unreleased+reviewed WO from a recent Stock Fulfillment session — moveable, pending planning decisions. May be a batch candidate or hidden singleton |
| Active Production Row | Open WO or Open batch — context AND add-target for new candidates per Quantity Rules. Cannot be moved or restructured here |

---

## Visual Language

| Element | Signal |
|---------|--------|
| Row shading | Part type — Parts and Assemblies use different row shading (consistent with Parts Master) |
| Font color — standard | Active Production Rows already in execution |
| Font color — distinct | New WOs from the current planning session |
| Greyed out | Rows that are not valid batch targets for the currently selected WO |
| Active in Production indicator | Visual flag on any PartID that has existing WIP in execution lenses |
| Yellow flag indicator | WO has open Definition Change Flag (see Flag Visibility below) |
| Red flag indicator | WO is Blocked or has open Blocker (consistent with system-wide blocker treatment) |

---

## Batch Candidacy and Eligibility

### Batch Candidacy (PartID Surfacing Trigger)

A WO has batch candidacy when at least one other WO of the same PartID exists
in either Unreleased+reviewed state or Open state. Candidacy is the trigger
for PartID surfacing in this lens (see Visibility Rules above).

When candidacy exists, all related WOs of that PartID are shown together —
giving the planner full context across both planning and execution states.

### Batch Eligibility (Combination Constraint)

The constraints on what combinations the planner can make depend on the
target's state:

**Combining two Unreleased+reviewed WOs into a new batch:**
- PartID matches
- Routing Template is identical
- Neither WO is already assigned to a batch (always true for Unreleased)

(Unreleased WOs cannot have process progress or purchasing activity by
definition of their state — those constraints are not separately enforced.)

**Adding an Unreleased+reviewed WO to an existing Open Production Row
(Open WO or Open batch):**
- PartID matches
- Routing Template is identical
- The target's activity state determines coverage rules — see Quantity Rules
  section below for Cases 1, 2, and 3

These rules govern what combinations the planner can make. The candidacy rule
governs what's visible in the first place.

---

## Composition Column (Column A)

The leftmost column of the Batching Lens grid is the Composition Column — a
specialized column unique to this lens that serves as the planner's working
canvas for draft batch composition.

Each row in the grid has a cell in the Composition Column that acts as a
**container** for chips representing Unreleased+reviewed candidate WOs.

### Column Population by Row Type

| Row Type | Composition Column Contents |
|----------|----------------------------|
| Unreleased+reviewed candidate | Contains the row's own home chip by default. Receives additional chips when the planner drags candidates onto this row |
| Open standalone WO | Empty by default. Receives chips when the planner drags candidates onto this row |
| Open batch (Active Production Row) | Empty by default. Existing members of the Open batch are NOT shown as chips — they cannot be moved and don't need to be reasoned about here. Receives chips when the planner drags candidates onto this row |

Open batch members are not represented as chips because:
- They cannot be moved (Open WOs can only have new candidates added to them)
- The Open batch itself is the unit of reasoning, not its members
- Chip-free Open rows keep the workspace focused on what the planner can affect

### Chip Anatomy

A chip represents one Unreleased+reviewed candidate WO. Each chip displays:
- **Background color:** the WO's parent Project Color
- **Project Number + Top-Level Reference:** e.g., "98324.02"
- **Demand Quantity:** the WO's quantity

Chips are interactive UI tokens — they can be grabbed and dragged at any
time during the draft. Chips are persistent throughout a session.

### Chip Home

Each candidate WO has a "home" — its own row's Composition Column cell. When
the lens is first opened, every Unreleased+reviewed candidate's chip is in
its home cell.

When a chip is dragged elsewhere, the home row displays a small note in its
Composition Column cell ("Drafted to Batch [target identifier]" or similar)
in place of the chip. This signals the WO has been placed in the draft. The
home row remains at full visual strength (no de-emphasis) — the placement
note is sufficient indication.

### Multiple Chips in One Cell

When two or more chips share a Composition Column cell (whether on a candidate
row or an Open row), the row enters a **draft batch state**:
- The chips are visually grouped/stacked within the cell
- All chips are individually selectable and draggable
- The row's display columns reflect the proposed batch composition (see
  Bright Blue Signaling below)
- The row is reasoned about as a draft batch from this point until either
  confirmation or further chip movement reduces it back to standalone

A row in draft batch state with the candidate's home chip plus N additional
chips is treated as a draft batch of (N+1) members at confirmation. A
candidate row whose home chip has been dragged away and which contains 2+
other chips is the same draft batch — minus its original home WO, which has
been placed elsewhere.

### Bright Blue Signaling

When a row's draft state modifies its display values (Demand Quantity, Priority,
Due Date, etc.), the modified values display in **bright blue**.

This applies to:
- Candidate rows that received additional chips (their Demand Quantity increases
  beyond their own; Priority becomes MAX; Due Date becomes MIN — all shown in
  bright blue if changed)
- Open rows that received chips (their Demand Quantity, Priority, Due Date show
  the post-confirmation values in bright blue if different from current)

Values that don't change remain in standard color. The bright blue immediately
signals "this value will change if the draft is confirmed."

---

## Interaction Model

### Drag-Based Composition

The primary interaction is dragging chips between Composition Column cells.

**Picking up a chip:**
The planner clicks and holds a chip to begin a drag. As soon as the drag
begins, the system evaluates eligibility for every Composition Column cell on
the visible grid.

**Drop target highlighting:**
- Eligible target cells: highlighted (e.g., subtle green outline or fill)
- Ineligible rows: **fully greyed out** (entire row, not just the cell). The
  planner cannot interact with greyed-out rows during the drag

This aggressive greying ensures focus on valid options and eliminates the
possibility of attempting an invalid drop.

A target cell is eligible when:
- PartID matches the dragged chip's WO
- Routing template matches
- For Open rows: the existing Open WO/batch is a valid add-target per the
  Quantity Rules section (Cases 1, 2, or 3)
- For candidate rows: per the simpler "two Unreleased+reviewed WOs combine"
  rule

**Releasing a chip:**
The chip drops into the target cell. The row's display values recompute and
bright-blue signal any changes. The source cell updates (if the chip moved
away from home, the source displays the placement note; if the chip moved
between non-home cells, the source's draft batch composition recalculates).

### Fallback Interaction (No Drag)

For accessibility, the planner can also:
1. Click a chip to select it
2. Click a target Composition Column cell to drop the chip there

Selection mode invokes the same eligibility highlighting/greying as drag mode.

### Returning a Chip Home

The planner can drag a chip back to its home cell at any time. The draft
batch on the source row recomputes (becoming standalone if member count drops
to 1).

### Effects on Source Rows When Chips Leave

When a chip is dragged out of a draft batch:
- If the source row was a draft batch with 3 chips and one is dragged out →
  source remains a draft batch with 2 chips
- If the source row was a draft batch with 2 chips and one is dragged out →
  source has only 1 chip remaining; row reverts to standalone draft state
  (or to the host's natural state if the remaining chip is the host's home
  chip)
- If the source row was an Open row with chips dragged in (e.g., 3 candidates
  added), removing one of those chips just reduces the proposed addition; the
  underlying Open batch is unchanged in current state — the draft adjustment
  shrinks

In all cases, bright blue values recompute to reflect the new draft state.

### Open Row Chip Removal

A chip dragged onto an Open row can be dragged back off it (returned home or
moved elsewhere). The Open row's existing state was never modified — only
the proposed addition is being adjusted.

---

## No Suggested Batches

The workspace does not generate suggested batches. It shows all visible Production
Rows for each PartID alongside new WOs, giving the planner full context to make
their own batching decisions. The routing context visible on each row provides
the information needed to make grouping decisions.

---

## Adding a New WO to an Existing Active Production Row — Quantity Rules

When a new WO is added to a Production Row that already has execution activity,
the following rules apply:

**Case 1 — No activity started (no purchasing submitted):**
Both Demand Quantity and Planned Quantity increase automatically by the new
member WO's demand. No prompt needed.

**Case 2 — Activity started, CompletedQty recorded:**
New total Demand Quantity must be ≤ CompletedQty already recorded. If covered,
the WO is added and demand updates. If not covered, the addition is blocked —
the system surfaces an inline message explaining the shortfall. The planner must
resolve through other means (new WO, split via Blocker workflow, etc.).

**Case 3 — Activity started, CompletedQty null (raw material case):**
Purchasing activity exists but no discrete quantity confirmed — typically raw
bar stock ordered but not yet cut. The system cannot validate coverage. The
planner may proceed but must confirm a prompt: "Purchasing activity exists for
this Production Row but no completed quantity has been recorded. Please verify
the ordered material will cover the additional demand before confirming."
This is a known Rev 1 blind spot resolved by Rev 2 material handling.

**Hard rule:** Planned Quantity is never used to validate whether an addition
is safe. Only CompletedQty is authoritative once work has started.

---

## Planned Quantity

Planned Quantity is set manually by the planner on each new Production Row
during the planning draft. It is an additional field alongside Demand Quantity,
not a replacement.

| Field | Meaning |
|-------|---------|
| Demand Quantity | Total demand across member WOs — what is required |
| Planned Quantity | What the planner intends to run — must be ≥ Demand Quantity |

**Rules:**
- Planned Quantity is optional — if not set, Demand Quantity is the operative quantity
- Planned Quantity is not available on Assembly Production Rows
- When a new WO is added to an unstarted Production Row, Planned Quantity
  increases automatically by the new member's demand (Case 1 above)
- Planned Quantity is set manually in all other cases — no auto-adjustment
- Planned Quantity ≥ Demand Quantity always enforced

---

## Derived Batch Values

These values re-derive automatically whenever batch membership changes:

| Value | Derivation |
|-------|-----------|
| Batch Demand Quantity | Sum of all non-Cancelled member WO demand quantities |
| Batch Priority | MAX priority among non-Cancelled member WOs |
| Batch Due Date | MIN due date among non-Cancelled member WOs |

---

## Confirm Toggle

Confirm toggles operate at the row level and reflect the chip-based
composition model.

### Where Toggles Live

**On draft batch rows (any row with 2+ chips):**
- The toggle confirms the entire draft batch
- On confirmation, all chips in the row's Composition Column cell become
  members of the resulting batch
- Each member WO transitions from Unreleased to Open in the same atomic
  transaction
- The batch entity (new or existing-extended) is committed

**On individual WO rows when the chip is at home:**
- The toggle confirms the WO as a standalone Production Row
- On confirmation, the single WO transitions from Unreleased to Open
- No batch is created

**Toggle state when chip has been moved away:**
- The home row's toggle becomes inactive — there is no work to confirm at
  this row because the WO will be confirmed elsewhere (with whichever
  batch it has been drafted into)
- The placement note in the Composition Column makes this clear visually
- If the chip returns home before draft confirmation, the toggle reactivates

### Toggle Defaults and Behavior

- Default state: ON — the planner opts out rather than in
- The common case is confirming everything; holding back is the exception
- Toggled ON → row's chips transition WOStatus from Unreleased to Open on
  draft confirmation, and the WOs enter execution lenses
- Toggled OFF → row remains in draft state for a future planning session;
  no chip transitions occur

### Terminology

The terminology "Confirm" is used here (rather than "Release") to avoid
confusion with the Stock Fulfillment Release. The two events are distinct:
- **Stock Fulfillment Release:** sets `stockFulfillmentReviewedAt`, makes WO
  visible to Batching. Does NOT transition WOStatus.
- **Batching Confirm:** transitions WOStatus from Unreleased to Open, makes
  WO visible to execution lenses.

### Assembly Rows

Assembly Production Rows follow the same confirm toggle behavior. The planner's
only responsibility with an Assembly is the batching decision. Once that is
resolved, the Assembly is confirmed immediately. Component readiness is managed
in the Assembly Lens after confirmation — it is not a consideration here.

### Hidden Singleton Confirmation

The "Show hidden singletons" toggle reveals the singleton queue. The planner
may then explicitly confirm singletons (transitioning them to Open) without
needing to wait for batch candidates to surface. Each singleton row uses the
standard at-home toggle behavior.

### Confirm Draft Action

The Confirm Draft action commits all rows whose toggles are ON in one atomic
transaction:
- Each draft batch is committed (batch entity created or extended; member WOs
  transition to Open)
- Each standalone confirmation transitions its WO to Open
- All AuditLog entries are written in the same transaction
- Rows with toggles OFF remain in draft state for a future planning session

**No recall after confirmation.** Once confirmed, Production Rows have WOStatus =
Open and are in execution. Changes to Open WOs use the Batch Adjustment Workspace
via the Blocker workflow, or other Project View primitives.

---

## Planner Actions

| Action | Description |
|--------|-------------|
| Drag chip to candidate row's Composition Column cell | Combines candidates into a draft batch (eligibility enforced in real time) |
| Drag chip to Open row's Composition Column cell | Adds candidate to an existing Open WO/batch as a draft addition (eligibility enforced per Quantity Rules) |
| Drag chip back to home cell | Returns the candidate to standalone draft state |
| Drag chip between non-home cells | Moves the candidate between draft batches |
| Click chip + click target cell | Fallback (no-drag) interaction with same eligibility evaluation |
| Set Planned Quantity | Set overage target on a draft Production Row (not available on Assembly rows) |
| Toggle Confirm (draft batch row) | Mark the entire draft batch for confirmation or hold |
| Toggle Confirm (at-home WO row) | Mark a standalone candidate for confirmation as a singleton or hold |
| Confirm Draft | Commit all draft changes atomically. All chips in toggled-ON rows transition to Open in their respective batch or standalone destinations |
| Show Hidden Singletons | Reveal the hidden singleton queue for explicit confirmation decisions |
| Show Only Actionable Production Rows | Filter to suppress non-actionable Open Production Rows (focus mode) |

---

## Grid Columns

| Column | Batch Row | WO Row | Notes |
|--------|-----------|--------|-------|
| **A. Composition Column** | ✓ | ✓ | Chip container — see Composition Column section. Empty for Open rows by default; contains home chip for candidate rows |
| Batch / WO ID | Batch ID | WO ID | |
| Part Number | ✓ | ✓ | |
| Part Name | ✓ | ✓ | |
| Member WOs | ✓ | | For Open batch rows: expandable list of existing member WOs. For draft batch state on candidate or Open rows: lists chip-members in proposed composition |
| Demand Quantity | ✓ | ✓ | Auto-derived. Bright blue if modified by draft chip composition |
| Planned Quantity | ✓ | ✓ | Editable. Not shown on Assembly rows. Bright blue if modified by draft state |
| Priority | ✓ | ✓ | MAX of non-Cancelled members for batch. Bright blue if modified by draft state |
| Due Date | ✓ | ✓ | MIN of non-Cancelled members for batch. Bright blue if modified by draft state |
| Projects | ✓ | | Condensed list of Project IDs |
| Project ID | | ✓ | |
| Routing | ✓ | ✓ | Template steps — compact pills |
| Confirm Toggle | ✓ | ✓ | ON by default. Inactive when WO row's chip has been moved away |
| Active in Production | ✓ | ✓ | Visual flag if PartID has existing WIP |
| Flag Indicator | ✓ | ✓ | Yellow flag if WO or batch has open Definition Change Flag |

---

## Filter Bar

Standard filter bar consistent with other operational views. Filters are
additive (AND logic).

| Filter | Notes |
|--------|-------|
| Project | Narrow to one Project's WOs |
| Part Type | Part / Assembly |
| PartID / Part Name | Search for a specific part |
| Active in Production | Show only PartIDs with existing WIP |
| Show Hidden Singletons | Reveal singleton queue (off by default) |
| Show Only Actionable Production Rows | Hide non-actionable Open Production Rows (off by default) |

Default grouping: by PartID. This surfaces all Production Rows — new and
active — for a given part in one place, giving the planner full context for
batching decisions.

### Show Only Actionable Production Rows — Filter Logic

When this filter is ON, Open Production Rows are hidden from the lens unless
they qualify as actionable for the current candidate set.

An Open Production Row is **actionable** when ANY of the following is true:
1. It has no started steps AND no purchasing activity recorded — meaning it's
   a valid add-target per Case 1 of the Quantity Rules (no coverage check needed)
2. Its active step has `CompletedQty IS NOT NULL` AND
   `(CompletedQty − sum of non-Cancelled member Demand) ≥ minimum candidate
   Demand for the same PartID` — meaning it has sufficient headroom for at
   least one current Unreleased+reviewed candidate per Case 2
3. Its active step has `CompletedQty IS NULL` AND purchasing activity exists
   — Case 3 territory, treated as actionable because the planner may verify
   coverage manually

An Open Production Row is **non-actionable** when:
- It has process progress AND
- `CompletedQty IS NOT NULL` (so headroom is calculable) AND
- Available headroom is insufficient for any current Unreleased+reviewed
  candidate's Demand for the same PartID

When the filter is ON, non-actionable Open Production Rows are hidden. When
OFF (the default), all Open Production Rows are shown for full PartID context.

The actionability evaluation is dynamic and re-runs whenever the candidate
set changes (new arrivals, confirmations, etc.). A row that becomes actionable
mid-session (e.g., a smaller candidate arrives that fits the headroom) appears
when the filter is on.

The filter does not affect Hidden Singleton visibility (handled by its own
toggle). It only narrows Open Production Row visibility.

**Hard rule:** When this filter is active, the lens still shows the PartID
context block for any PartID with at least one Unreleased+reviewed WO or any
actionable Open Production Row. PartIDs whose only Open Production Rows are
non-actionable AND who have no Unreleased+reviewed WOs disappear from the
lens entirely under this filter.

---

## Definition Change Flag Handling

Batched WOs and the Batches that contain them participate in the Definition Change
Flag system per `definition_change_flag_spec.md`.

**Batch flags:** When a flag-triggering definition change affects a batched WO,
the batch entity itself is flagged AND each member WO is flagged. Member flags
reference the batch flag via `parentFlagId`.

**Batch flag visibility:** A batch with an open flag shows the yellow flag
indicator on its row. Click the indicator to navigate to the Batch Editor batch
flag resolution surface (separate workflow — see Batch Editor spec).

**Resolution from this lens:**
- Batch-level resolution (Dismiss or Accept Change) applies atomically to all
  members. This happens in the Batch Editor, not directly in this lens
- Per-member resolution requires removing the WO from the batch first via the
  Batch Editor

**WO Split inheritance:** If a flagged WO is split via the WO Split primitive,
both new WOs inherit copies of the original flag. The original flag is
auto-resolved with system note pointing to new flag IDs.

**Batch dissolution mid-flag:** When a batch is dissolved (member count drops
to 1) while flags are open, the batch flag is auto-resolved with system note.
Member flags' `parentFlagId` is cleared and they become individually resolvable.

**Hard rule:** Per-member flag resolution is blocked while WO is in a batch.
Manager must remove WO from batch first via Batch Editor.

---

## Batch Dissolve

A batch dissolves if membership drops to one WO. The remaining WO becomes a
standalone Production Row. In this workspace, dissolve can only occur if a
newly created draft batch has one of its two founding WOs moved elsewhere
before the draft is confirmed.

If the batch had open flags at dissolution, the batch flag auto-resolves and
member flag's `parentFlagId` is cleared (becomes individually resolvable).

---

## Cancelled WO Handling

`Cancelled` is a top-level WOStatus value that replaces the prior status when
the Cancel primitive is applied. There is no "Open + Cancelled" or "Unreleased
+ Cancelled" — a Cancelled WO is simply Cancelled.

Cancelled WOs are excluded from all Batching Lens visibility. They do not
appear in the active list, the hidden singleton queue, Active Production
Rows, or anywhere else in this lens.

When a WO that is part of a draft batch is Cancelled (via the Cancel primitive
applied elsewhere — e.g., Project View side panel during a flag resolution
workflow), the affected batch handles the cancellation as follows:
- If the batch is still draft (not yet confirmed): the Cancelled WO is silently
  removed from the draft batch. If batch member count drops to 1, the batch
  dissolves
- If the batch is already confirmed (active in execution): handled via Batch
  Adjustment Workspace, not this lens

**Hard rule:** Cancelled WOs do not appear in the Batching Lens, even via
"Show Hidden Singletons" toggle. Cancellation removes the WO from Batching's
operational scope entirely.

---

## Hard Rules Introduced by This Spec

| # | Rule |
|---|------|
| BL-1 | Visibility in the Batching Lens is per-WO, never per-Project |
| BL-2 | A WO is visible only when WOStatus = Unreleased AND stockFulfillmentReviewedAt IS NOT NULL AND parent Project is Active AND WO is not Cancelled |
| BL-3 | Hidden singletons (WOs with no batch candidacy) are excluded from default view but accessible via toggle |
| BL-4 | When a new WO arrives that creates batch candidacy with a hidden singleton, both WOs surface in the active list together |
| BL-5 | Batching Confirm transitions WOStatus from Unreleased to Open. This is the second gate; WOs cannot reach Open without passing through this gate (or via Fulfill from Stock direct to Complete) |
| BL-6 | Confirmation is one-way — once a WO transitions to Open, it does not return to Unreleased |
| BL-7 | Existing Open WOs are shown as context but not editable in this lens. Restructuring uses Batch Adjustment Workspace |
| BL-8 | Batch Demand, Priority, and Due Date derive from non-Cancelled members only |
| BL-9 | Cancelled WOs are not visible in this lens, even via "Show Hidden Singletons" |
| BL-10 | Per-member Definition Change Flag resolution is blocked while WO is in a batch — manager must remove from batch first |
| BL-11 | Batch dissolution mid-flag auto-resolves the batch flag and frees member flags for individual resolution |
| BL-12 | The "Show Only Actionable Production Rows" filter hides Open Production Rows where the row has process progress AND insufficient CompletedQty headroom for any current Unreleased+reviewed candidate's Demand |
| BL-13 | The Composition Column (Column A) is the planner's working canvas. Each row's cell contains chips representing draft membership |
| BL-14 | Open rows have empty Composition Column cells by default. Their existing Open batch members are NOT shown as chips and cannot be moved here |
| BL-15 | Two or more chips in one Composition Column cell places the host row in draft batch state. Display values recompute and signal in bright blue |
| BL-16 | Chips are persistent during a session and can be moved freely between any eligible Composition Column cells, including back to home |
| BL-17 | When a chip leaves home, the home row's Composition Column displays a placement note in place of the chip; the row remains at full visual strength |
| BL-18 | Drag operations grey out ineligible rows entirely (full row, not just Composition Column cell). Greyed-out rows cannot be interacted with during the drag |
| BL-19 | Confirm Toggle on a draft batch row commits all chips in the cell as members; Confirm Toggle on an at-home WO row commits the WO as standalone; Confirm Toggle is inactive when the row's chip has been moved away |

---

## Design Notes

- The primary goal of this lens is control with speed — a planner should be
  able to process a session's worth of post-Stock-Fulfillment WOs in a focused
  workflow

- The draft model is intentional. The planner is shaping a valid work confirmation,
  not executing a sequence of system commands

- Active Production Rows shown as context should be visually de-emphasized
  relative to new WOs — they are reference, not the work being planned

- Real-time eligibility greying prevents invalid batch combinations without
  requiring the planner to remember the rules

- The confirm toggle default (ON) respects the planner's time — the common
  case is confirming everything. Holding back is the exception

- Assembly rows are visually distinct via row shading. Their confirmation
  behavior is identical to Part rows — batch decision made, confirm toggled,
  draft confirmed. No Planned Quantity field appears on Assembly rows

- The hidden singleton queue exists because surfacing solo WOs with no batching
  decision adds noise without value. The "Show Hidden Singletons" toggle gives
  the planner explicit control when they want to confirm singletons proactively
  rather than waiting for candidates to arrive

- The terminology "Confirm" (rather than "Release") avoids confusion with Stock
  Fulfillment's Release event. The two events are distinct gates with distinct
  semantics: Stock Fulfillment Release sets the reviewed marker; Batching Confirm
  transitions WOStatus to Open

- Per-WO model (not per-Project gate) means a Project's WOs can be in multiple
  states simultaneously: some still in Stock Fulfillment, some visible in Batching
  as candidates, some in the hidden singleton queue, some already confirmed and
  in execution. This mirrors operational reality — Projects don't progress as
  monolithic units

- **Visibility extends beyond combinability.** The lens surfaces all PartID
  context — including Open batches and WOs that an arriving Unreleased+reviewed
  WO cannot be directly combined with — so the planner can make informed
  decisions about coordinating production timing. Example: a planner seeing an
  Unreleased WO arrive for a PartID that has an Open batch already mid-execution
  might choose to place a hold on the Open batch (via Blocker) so the new WO
  can catch up and be processed together later. The Batching Lens does not
  provide tools for these coordination actions — they use existing primitives —
  but the visibility is what enables the planner to recognize the opportunity
  in the first place. The "Show Only Actionable Production Rows" filter exists
  for the alternate use case where the planner wants to focus narrowly on
  current batching decisions and suppress this broader context

---

## Open Items for Reconciliation Pass

- **Stock Fulfillment spec:** confirm Release semantics — sets `stockFulfillmentReviewedAt`,
  does not transition WOStatus
- **Schema:** confirm `WorkOrder.stockFulfillmentReviewedAt` field; confirm WOStatus
  transitions documented (Unreleased → Open at Batching Confirm)
- **Batch Editor / Batch Adjustment Workspace spec:** confirm batch flag resolution
  surface; confirm member removal workflow for per-member flag resolution.
  **Review for interaction-model consistency with this lens** — the chip-based
  Composition Column model defined here should be reused in the Batch Adjustment
  Workspace where appropriate, so the planner's mental model is consistent
  across both surfaces. Specifically, evaluate whether chip-based composition,
  bright-blue draft signaling, and aggressive ineligibility greying apply
  cleanly to Batch Adjustment workflows
- **Detail Panel spec:** confirm side panel for batch context includes batch flag
  section when applicable
- **Operations Lens / execution lenses:** confirm visibility filter (WOStatus = Open
  for execution; WOStatus IN (Open, Complete) for Operations Lens)
- **Project View:** confirm visibility includes Unreleased + reviewed WOs (so
  managers can see what's pending in Batching even before confirmation)
