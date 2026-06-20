# Batching Lens — Implementation Handoff

**Mockup locked:** 2026-06-20  
**Spec:** `spec/batching_lens_spec.md`  
**Mockup source:** `app/mockups/batching/`  
**Phase:** Rev 1, Stage 8 (Production Batching)

This document is the consolidated handoff from the mockup track to the
implementation track for the Batching Lens. It stands alone — the reader
does not need to have followed the session log. Reference the spec as the
authoritative source on business rules; reference this document for gaps,
decisions made during mockup iteration, and implementation guidance.

---

## 1. Surface Overview

The Batching Lens is the final planning gate before work becomes visible
on the shop floor. Planners organize released-from-Stock-Fulfillment WOs
(status `Unreleased` + `stockFulfillmentReviewedAt` set) into production
batches, set Planned Quantities, and confirm the draft — transitioning WOs
from `Unreleased` to `Open` and making them visible in execution lenses.

The surface is organized around two phases of context:

- **Phase 1 — Candidate workspace:** the set of `Unreleased+reviewed` WOs
  available for batching. Planners combine same-PartID candidates by dragging
  chips between composition cells.
- **Phase 2 — Active Production Rows:** Open WOs and Open batches shown as
  de-emphasized context rows beneath candidates. Case 1 Open rows also accept
  new candidate chips as draft additions.

The Batching Lens uses a draft-then-confirm model. No state transitions
commit until the planner explicitly confirms. Exiting without confirming
discards all draft placements.

**In scope for Rev 1:** full candidate workspace, drag-based chip composition,
lock/unlock model, view modes (Batching / Qty Planning / All), multi-select
toolbar, Auto-Batch with WIP tier, Open row context and Case 1 drop targets,
Available headroom constraint, Reset Draft with confirmation modal, Confirm
Draft.

**Out of scope for Rev 1:** Case 3 confirmation prompt, "Include Started WIP"
Auto-Batch tier (Phase 2.5), Definition Change Flag indicators, full Case
2/3 inline coverage messages.

Read `spec/batching_lens_spec.md` in full before implementing. The hard rules
(BL-1 through BL-19) and the Quantity Rules (Cases 1, 2, 3) are load-bearing.

---

## 2. Spec Gaps to Backfill Before Implementation Begins

These items exist in the locked mockup but are not yet addressed in
`spec/batching_lens_spec.md`. The implementation track must backfill each
(with user approval) before building.

### 2.1 Project column removed

**What the spec says:** lists a "Projects" column (batch rows) and a
"Project ID" column (WO rows) in the Grid Columns table.

**What the mockup uses:** neither column exists. Project identity is encoded
directly on every chip: `topLevelRef` on candidate chips, `BatchID` on batch
chips. The chip already tells the planner which project+line item each WO
belongs to.

**Why:** the column carried zero information not already visible on the chips
in the same row's Composition cell. Removing it recovered horizontal space
for the columns that carry distinct information.

**What the implementation track must do:** update the spec's Grid Columns
table to remove the Project/Project ID column and document the rationale.

### 2.2 Completed column removed

**What the spec says:** does not explicitly list a "Completed" column, but
the `CompletedQty` field is referenced in the Quantity Rules (Case 2).

**What the mockup uses:** a Completed column was added and then removed. The
CompletedQty value moved to the Open chip (line 2 of the 2-line chip layout).
The `mockCompletedQty` data field is preserved in `_data.ts` (it still feeds
the `mockHeadroom` derivation) but no standalone column exists.

**What the implementation track must do:** confirm the spec does not list
Completed as a visible column. If it does, update to reflect the chip-inline
placement.

### 2.3 Headroom column removed — replaced by "Available" on chip

**What the spec says:** the spec may reference headroom as a calculable value
in the Quantity Rules but does not describe a Headroom column.

**What the mockup used:** a Headroom column was added during Phase 2 build
and later removed when it was found to serve no purpose (value already on the
chip). The final chip format uses "Available" (not "Headroom") as the label.

**What the implementation track must do:** use "Available" as the label
throughout the real implementation. Do not use "Headroom" in any user-visible
text.

### 2.4 Open chip 2-line layout

**What the spec says:** the Composition Column section describes chip anatomy
as Project Number + Top-Level Reference + Demand Quantity. Single-line
implied.

**What the mockup uses:** Open row chips (on the Open WO or Open Batch rows
themselves, not on candidate chips) use a 2-line layout:

```
Line 1:  ProjectNumber · TopLevelRef        (Open WO chip)
         BatchID                            (Open Batch chip, e.g. "B004")
Line 2:  Available: N
```

The Available value on line 2 uses three color states:
- Case 3 → `text-red-500` (terminal; no new members accepted regardless of value)
- Draft chips present → `#0EA5E9` sky-500 (live update as chips are added/removed)
- No draft chips → `text-muted-foreground` (muted, no signal)

The "Available:" label text stays neutral muted in all states. Only the
numeric value receives color.

**What the implementation track must do:** update the spec's Composition
Column chip anatomy to describe the 2-line Open chip format. The candidate
chip (home chip in a candidate row) remains single-line; only Open row chips
are 2-line.

### 2.5 Batch ID format: OPEN-BATCH-NNN → BN

**What the spec says:** if the spec references batch IDs, it likely uses a
long format (e.g., `OPEN-BATCH-001`).

**What the mockup uses:** short format — `B1` through `B6` (or `BN` for any
N). The batch ID is the display label in the Open chip and in audit console
messages.

**Why:** 14-character IDs were visually excessive in the chip and table cells
where they appeared.

**What the implementation track must do:** the real implementation uses
database-assigned batch IDs. Whatever format is chosen should be short enough
to fit a chip. The short `BN` format is the mockup reference; real IDs may
differ (e.g., `BAT-0001`).

### 2.6 Singleton redefinition — Open work as disqualifier

**What the spec says (BL-3):** "A WO is in the hidden singleton queue when:
WOStatus = Unreleased AND `stockFulfillmentReviewedAt IS NOT NULL` AND No
other WO of the same PartID exists in either Unreleased+reviewed OR Open
state."

The spec's definition is consistent with the mockup's final definition, but
the mockup iterated through a broken definition first.

**The locked definition (mockup and spec agree):**

A PartID group is a true singleton (auto-locked, hidden by default) only when:
1. Exactly one candidate WO exists for the PartID, AND
2. No Open work (Open WO or Open batch) exists for the PartID in the lens.

If condition 2 fails (Open work exists), the single candidate is a
**non-singleton**: it is unlocked by default and visible in the Batching view
so the planner can decide to add it to the existing Open production run.

**Implementation note:** `PART_IDS_WITH_OPEN_WORK` (a precomputed `Set<number>`
in `page.tsx`) drives this check. Compute it once at session init from
`OPEN_WOS` and `OPEN_BATCHES`. In the real implementation, derive this from
the database query that fetches Open WOs and Open batches for the lens.

**What the implementation track must do:** verify the spec's hard rule BL-3
matches this definition exactly. If not, update the spec. The key invariant:
a candidate with any Open work for its PartID is never hidden.

### 2.7 Lock state model (replaces Confirm Toggle)

**What the spec says:** the spec describes a "Confirm Toggle" per row —
default ON, becomes inactive when chip moves away. This model was superseded
during mockup iteration.

**What the mockup uses:** a **Lock state** per row (`lockedWoIds: Set<number>`
in `BtSessionState`), with the Confirm Toggle entirely removed.

**How lock state works:**

| Condition | Default lock state |
|-----------|-------------------|
| True singleton (1 candidate, no Open work) | Locked |
| Non-singleton candidate | Unlocked |

Lock immobility is enforced in both directions:
- Cannot drag OUT of a locked row (chip's current host is locked)
- Cannot drag INTO a locked row (target is locked)

Lock toggle is **disabled** when `chipHome[woId] !== woId` (chip donated
elsewhere — source row commits as part of the host's batch, not independently).

When a row is locked, `plannedQty[hostWoId]` is set to the row's current
demand. When unlocked, `plannedQty[hostWoId]` is deleted (loses edits —
this is intentional, matching the spec's Planned Quantity rules).

**What the implementation track must do:** update the spec to replace the
Confirm Toggle section with the Lock State model. The key behaviors to
document:

1. `computeDefaultLockState(wos)` — pure function, called at session init and
   on Reset Draft. Returns the default locked/unlocked set.
2. Lock toggle on source rows is disabled (source rows don't have independent
   confirmation; they confirm with their host's batch).
3. Confirm Draft action operates on visible locked host rows, not on toggled
   rows.

### 2.8 View modes (Batching / Qty Planning / All)

**What the spec says:** not described.

**What the mockup uses:** a three-way segmented control in the filter bar.

| View | Shows | Primary workflow |
|------|-------|-----------------|
| Batching | Unlocked rows only | Chip composition workspace |
| Qty Planning | Locked rows only | Planned Quantity editing |
| All | All rows | Combined view |

Default on load: **Batching**.

Key behaviors:
- Selection (multi-select checkboxes) clears on view switch.
- Confirm Draft is **disabled** in Batching view (no locked rows visible;
  tooltip explains). Enabled in QP and All when visible locked rows exist.
- Auto-Batch is **disabled** in QP view (no unlocked rows to batch; tooltip
  explains). Skips locked rows in All view.
- In QP view, Open Production Rows are visible only if they received draft
  chip additions (`openRowsVisibleInQP` derived set).

**What the implementation track must do:** add the view mode model to the
spec. Document the Confirm Draft / Auto-Batch disabled states and the Open
row visibility rule in QP view.

### 2.9 Multi-select toolbar

**What the spec says:** not described. The spec lists per-row lock toggle and
workspace-level "Confirm Draft" / "Show Hidden Singletons" actions only.

**What the mockup uses:** a floating sticky toolbar at the page bottom,
visible when 1+ rows are selected via the leftmost checkbox column.

Header checkbox selects/deselects all visible rows. Multi-select state is
`Set<number>` in component state; clears on view switch.

View-scoped toolbar actions:

| View | Actions |
|------|---------|
| Batching | Lock selected, Clear |
| Qty Planning | Unlock selected, Reset Planned to Demand, ×N Apply, +N Apply, Clear |
| All | All above (silently skips inapplicable rows) |

Toast confirms each action with count. Functions in `_data.ts`:
`lockMultiple`, `unlockMultiple`, `resetPlannedToDemand`,
`multiplyPlannedQty`, `addToPlannedQty`.

**What the implementation track must do:** add the multi-select toolbar to
the spec as a filter bar supplement. The `×N Apply` and `+N Apply` actions
support bulk Planned Quantity adjustments — document their validation rules
(Planned Qty ≥ Demand always enforced; `×N Apply` multiplies current Planned;
`+N Apply` adds N to each).

### 2.10 Auto-Batch: two-tier dropdown, not split-button

**What the spec says:** the spec lists "Auto-Batch Candidates" as a planner
action (as a split-button with a default tier in early mockup iterations).

**What the mockup uses:** a single full-click dropdown trigger. The entire
button area opens a dropdown — there is no default-execution primary area.
Selecting a tier from the dropdown both sets it and executes the batch
atomically.

Three options in the dropdown:

| Option | State | Notes |
|--------|-------|-------|
| Only Candidates | Always enabled when button enabled | Candidate-to-candidate batching |
| Include Unstarted WIP | Enabled by `autoBatchWipEnabled` predicate | Places candidates on Case 1 Open hosts; falls back to candidate-to-candidate |
| Include Started WIP | Always disabled | Phase 2.5; rendered as non-interactive `<div>` with strikethrough |

**Two separate enable predicates** (outer button is OR of both):

- `candidatesOnlyEnabled`: `filteredNonSingletonGroups.some(g => g.woIds.length >= 2)`
- `autoBatchWipEnabled`: at least one unlocked at-home candidate's PartID matches
  a Case 1 Open row PartID

**Why atomic execution:** a stale-state race exists if `setState(tier)` and
`handleAutoBatch()` are decoupled (state not yet updated when the batch runs).
The combined `handleSelectAndRunAutoBatch(tier)` eliminates this.

**What the implementation track must do:** update the spec's Planner Actions
table to describe the two-tier dropdown model. Document that the WIP tier's
"Include Started WIP" option is a Rev 1.5/Phase 2.5 placeholder.

### 2.11 Auto-Batch WIP tier precedence and all-or-nothing headroom

**What the spec says:** the spec describes adding candidates to Open rows in
the Quantity Rules section but does not describe Auto-Batch WIP tier
algorithm.

**The locked algorithm (from `autoBatchCandidates` in `_data.ts`):**

For each PartID group in the WIP tier:

1. **Find Case 1 Open host FIRST** — search `OPEN_WOS` and `OPEN_BATCHES`
   for any Case 1 entry with matching PartID. Sort by latest `dueDate` (nulls
   last), tiebreak by lowest `openHostId`.
2. **All-or-nothing headroom check** — compute `totalCandidateDemand` (sum of
   all candidate WO quantities for the PartID) and `available` (host's
   `mockHeadroom` minus existing draft demand on that host). If
   `totalCandidateDemand > available`, skip the entire PartID group (candidates
   stay home). No partial fills.
3. **If headroom ok** — place ALL candidates for the PartID onto the Open host.
4. **If no Case 1 host exists** — fall through to candidate-to-candidate
   batching (the "Only Candidates" logic).

**Why all-or-nothing:** partial fills leave a mix of placed and homeless
candidates for the same part, which is operationally confusing. Either the
whole group fits or it waits.

**What the implementation track must do:** add the WIP tier algorithm to the
spec as a formally documented heuristic. Key decision: the real implementation
needs to determine the "available headroom" from actual production data
(CompletedQty minus existing member demand) rather than the mockup's
`mockHeadroom` field.

### 2.12 Available headroom constraint on manual drag

**What the spec says:** the Quantity Rules describe Cases 1, 2, and 3 but do
not specify the drop-blocking UX when Case 1 available headroom would be
exceeded.

**What the mockup uses:** `isEligibleOpenTarget` accepts optional params
`candidateDemand`, `existingDraftWoIds`, `wos`. When provided:

```typescript
const existingDraftDemand = existingDraftWoIds
  .reduce((sum, id) => sum + (wos.find(w => w.woId === id)?.quantity ?? 0), 0);
const available = openHost.mockHeadroom - existingDraftDemand;
return candidateDemand <= available;
```

A host that would overflow is treated the same as Case 2/3 during drag: the
row greys out (`opacity-30 pointer-events-none`) and the drop is silently
rejected.

Existing callers that omit the new params get prior behavior (case1 vs case2/3
check only).

**What the implementation track must do:** document the headroom constraint as
part of Case 1 eligibility. A Case 1 Open row is only an eligible drop target
when `candidateDemand ≤ (CompletedQty_headroom − existing_draft_demand)`.

### 2.13 Reset Draft — confirmation modal

**What the spec says:** "Reset Draft" is listed as a planner action with no
UX detail.

**What the mockup uses:** clicking Reset Draft opens a shadcn Dialog modal:

> "Reset Draft will return all chips to their home rows, restore default lock
> states (singletons locked, batch candidates unlocked), and clear all Planned
> Quantity edits. This cannot be undone."

Two buttons: Cancel (default focus, neutral) and Reset (destructive styling).

On Reset: chips returned home, lock states restored via
`computeDefaultLockState`, all `plannedQty` edits cleared.

**Enable condition:** button is enabled when any chip is not at home OR any
planned qty has been edited above demand.

**What the implementation track must do:** add the confirmation modal to the
spec. The modal's destructive framing is intentional — Reset is irreversible
in a session and the planner should be aware of what they lose.

### 2.14 Planned Quantity — unlocked rows show "—"

**What the spec says:** "Planned Quantity — Optional. If not set, Demand
Quantity is the operative quantity."

**What the mockup uses:** the Planned Qty column shows `"—"` for unlocked
rows and an editable input for locked rows. The input defaults to the
current demand at the moment of locking. Bright blue when edited above
demand (new signal — analogous to the draft composition signal).

**Why:** Planned Qty is a quantity planning decision. Requiring planners to
set it before the batching composition is settled (while the row is unlocked)
is premature. Lock first, plan quantity second.

**What the implementation track must do:** add the lock-gated Planned Qty
visibility rule to the spec. The two-phase model (compose in Batching view →
plan quantity in QP view) is a core workflow pattern.

### 2.15 Root WO chip immobility

**What the spec says (BL-16):** "Chips are persistent during a session and
can be moved freely between any eligible Composition Column cells." This is
true for guest chips, but the spec does not describe the root chip constraint.

**What the mockup uses:** the root chip (the chip whose `woId` matches the
host row's `woId`) is permanently anchored to its home cell when the row has
2+ chips. dnd-kit's `disabled` option is used. When the row is standalone
(1 chip), the root chip remains at home by definition of being a root.

```typescript
// In ProjectChip:
isAnchoredRoot={wo.woId === hostWoId && chips.length >= 2}
```

Guest chips (woId ≠ hostWoId, or the home chip of any row after Auto-Batch)
are freely draggable.

**Why:** without root immobility, a planner could drag the host chip out of
a row that already has guests, creating an ambiguous state (guests remain but
the host identity moved). The rule eliminates this invalid state class.

**What the implementation track must do:** add the root chip immobility rule
to the spec as a constraint on the interaction model. The practical effect:
initial state drag is non-functional — planners must use Auto-Batch or
the click-to-select fallback to form the first draft batch before any chip
becomes draggable.

### 2.16 "Show Only Actionable" filter — implicit always-on for headroom-zero Case 2

**What the spec says:** "Show Only Actionable Production Rows" is listed as
an off-by-default filter toggle.

**What the mockup uses:** a permanent implicit rule — Case 2 Open rows with
`mockHeadroom <= 0` are always hidden. The explicit "Show Only Actionable"
toggle is removed. This simplifies the filter bar and removes a decision the
planner should never need to reverse (why would a planner want to see a Case 2
row with zero headroom?).

Case 1 and Case 3 rows are always visible regardless.

**What the implementation track must do:** update the spec's Filter Bar table
to remove "Show Only Actionable Production Rows" as a toggle. Instead, add it
as an implicit display rule: Case 2 Open rows with insufficient headroom for
any current candidate are hidden. The spec's BL-12 covers the underlying rule;
update it to reflect the always-on application.

### 2.17 Parent column → Part Number hover tooltip

**What the spec says:** Grid Columns table does not explicitly list a Parent
column.

**What the mockup used (then removed):** a Parent column showing the immediate
parent's part number was added, then removed entirely. Ancestry data moved to
a native `title` tooltip on the Part Number cell.

**Current state:** Part Number cell carries a `title` attribute with the
ancestry path (closest ancestor first, format: `Part Number — Part Name` per
line). Top-level WOs have no tooltip (plain text cell).

The `parentPartName` and `ancestryPath` fields remain on `BtWorkOrder` — the
tooltip still consumes them.

**What the implementation track must do:** confirm the spec does not list a
Parent column. The ancestry context is preserved via tooltip; no column
addition needed.

### 2.18 B004 Open Batch out-of-bounds `mockActiveStepIndex`

**Known data issue (not a spec gap):** Open Batch B004 (partId 1951, PB-M
Base Assembly) has `mockActiveStepIndex: 3`. B004 uses `tmpl_assembly`
(Prep/Assembly/QC, 3 steps, valid indices 0–2). Index 3 is out-of-bounds;
no routing pill is highlighted for B004. The batch is `case3` so no crash
occurs, but the QC pill should be highlighted.

**What the implementation track must do:** fix the `mockActiveStepIndex` from
3 → 2 (QC) in `_data.ts` before implementation begins. This is a data
cleanup, not a spec change.

---

## 3. Phase 1 Architecture

Phase 1 is the candidate-only workspace. All WOs are `Unreleased` +
`stockFulfillmentReviewedAt` set. No Open rows exist.

### `BtWorkOrder` type

```typescript
type BtWorkOrder = {
  woId: number;
  projectId: number;
  projectNumber: string;
  projectColor: ProjectColor | null;
  topLevelRef: string;        // e.g. "10121.04"
  partId: number;
  partNumber: string;
  partName: string;
  partType: "Part" | "Assembly";
  quantity: number;           // demand
  priority: number;           // 1–5
  dueDate: string | null;
  routingTemplateId: string;
  status: "Unreleased";
  stockFulfillmentReviewedAt: string;
  parentPartName: string | null;
  ancestryPath: Array<{ partNumber: string; partName: string }>;
};
```

### `BtSessionState`

```typescript
type BtSessionState = {
  chipHome: Record<number, number>;        // woId → hostWoId
  lockedWoIds: Set<number>;
  plannedQty: Record<number, number>;      // hostWoId → planned (locked rows only)
  openRowChips: Record<number, number[]>;  // openHostId → [candidateWoId, ...]
  autoBatchTier: "candidates-only" | "include-unstarted-wip";
};
```

### Key derived values

**`getDerivedRowValues(hostWoId, chipHome, wos, state)`** — computes
`totalDemand`, `maxPriority`, `minDueDate` for a candidate host row.
Returns per-value change flags so the caller knows which values to color
bright blue.

**`isEligibleTarget(targetHostWoId, dragWoId, state, wos)`** — the candidate
eligibility gate. Four rules in priority order:
1. Chip can always return to its own home row (`targetHostWoId === dragWoId`)
2. Chip currently at home cannot move to any non-home target (root immobility)
3. Target with root chip absent (shell row) is ineligible except for Rule 1
4. PartID must match between drag chip and target host

**`computeDefaultLockState(wos)`** — returns the initial and post-reset
`lockedWoIds` set. Singletons (1 candidate, no Open work for the PartID) →
locked. Non-singletons → unlocked.

### Candidate group computation

```typescript
// In _data.ts:
// Groups all visible WOs by partId
// Filters out groups that are singletons (1 WO + no Open work)
// Returns BtCandidateGroup[] { partId, woIds[] }
export function computeCandidateGroups(wos, lockedWoIds, viewMode, ...)
```

The `filteredNonSingletonGroups` value in `page.tsx` is the UI's working
candidate list.

---

## 4. Phase 1 Visual Patterns

### Composition cell

Each candidate row's Composition cell (`CompositionCell`) is a droppable
dnd-kit target. It renders:
- **Home chip present:** `ProjectChip` for each chip in the cell.
- **Chip moved away (shell row):** `Drafted → {topLevelRef}` placement note
  in muted italic text.
- **Drop highlight during drag:** `bg-emerald-500/15 ring-1 ring-emerald-500/50` on the eligible cell.
- **Click-to-select highlight:** `bg-sky-500/10 ring-1 ring-sky-500/50` on
  eligible cells when a chip is selected.

### `ProjectChip` anatomy (candidate chip, single-line)

```
⚓? {topLevelRef} / Qty: {N}
```

- **Anchor icon** (`Anchor`, `h-3 w-3`, `strokeWidth={3}`, `opacity-70`):
  shown when `isRoot` is true. Signals the chip is anchored to this row.
- **Background:** `PROJECT_COLOR_MAP[projectColor]?.hex` or `bg-muted` for null color.
- **Text color:** derived from color map (`meta.text` — white or black for contrast).
- Root chips use `isAnchoredRoot={true}` on multi-chip cells, disabling
  dnd-kit drag (`disabled` prop). Guest chips are freely draggable.

### Bright blue signal color: `#0EA5E9` (sky-500)

Used for all "draft state changed this value" signals throughout the surface:

- Demand, Priority, Due Date when modified by chip composition
- Available value on Open chips when draft additions exist
- Planned Qty input when edited above demand

This specific hex is used inline (`style={{ color: "#0EA5E9" }}`) rather than
a Tailwind class because Tailwind's `sky-500` maps to the same value but the
exact hex needs to be precise for the "draft change" semantic.

**Color discipline:** `#0EA5E9` has one meaning in this surface — "this value
will change if the draft is confirmed." Do not use it for any other signal.

### Row de-emphasis during drag

Ineligible rows during drag: `opacity-30 pointer-events-none` on the entire
`<tr>`. Applied as a conditional className on the row element, not on
individual cells. This ensures the entire row (including text) greys out
uniformly.

### Group boundary dividers

Two-tier hierarchy in the candidate table:
- **PartID group boundary:** `border-t-2 border-border`
- **WO-to-WO within a group:** `border-t border-border/50`

Planners distinguish group boundaries from intra-group rows at a glance.

### Activity icon

`Activity` icon (from `lucide-react`, amber color) on the Part Number cell
of any candidate row where `PART_IDS_WITH_OPEN_WORK.has(partId)`. Signals
Open production work exists for this PartID. Uses `shrink-0` so it is never
clipped by Part # truncation.

### Part Number column: 128px, truncating

The Part # `<col>` is 128px. The cell uses:

```tsx
<td style={{ maxWidth: 128 }}>
  <span className="flex items-center gap-1 min-w-0">
    <span className="truncate">{partNumber}</span>
    {hasOpenWork && <Activity className="shrink-0 h-3.5 w-3.5 text-amber-500" />}
  </span>
</td>
```

Part Name column: 192px (max-w-[192px] via `style`). The budget accounts for
the Activity icon's ~18px footprint, which would otherwise push 10-char part
numbers into truncation at the previous 110px width.

Part Number cell tooltip: `title` attribute with full part number + ancestry
path. Always shows the untruncated value on hover.

---

## 5. Phase 2 Architecture Additions

Phase 2 adds Open Production Rows — standalone Open WOs and Open batches —
as de-emphasized context rows beneath candidates, with Case 1 rows accepting
candidate chip drops.

### New types

**`BtOpenWO`** — standalone Open WO (IDs 50001–50015 in seeded data)

```typescript
type BtOpenWO = {
  openWoId: number;
  partId: number;
  mockProductionState: "case1" | "case2" | "case3";
  mockHeadroom: number;        // mockup-only; derived from real step-state
  mockActiveStepIndex: number | null;
  mockCompletedQty: number;
  // ... plus project, part, routing fields
};
```

**`BtOpenBatch`** — Open batch (IDs 60001–60006 in seeded data)

```typescript
type BtOpenBatch = {
  batchId: string;             // e.g. "B001"
  openBatchWoId: number;       // acts as the host ID (60000-range)
  memberWoIds: number[];
  memberProjectNums: string[];
  mockProductionState: "case1" | "case2" | "case3";
  mockHeadroom: number;
  mockActiveStepIndex: number | null;
  mockCompletedQty: number;
  // ... plus part, routing fields
};
```

### `BtSessionState` additions for Phase 2

```typescript
openRowChips: Record<number, number[]>;
// openHostId → [candidateWoId, ...] — draft additions to Open rows
```

The `openRowChips` map tracks which candidate chips have been dragged onto
which Open row hosts. Used for:
- Rendering draft chips in `OpenCompositionCell`
- Computing Available live updates (`mockHeadroom - existing draft demand`)
- Including Open row additions in Confirm Draft scope

### `isEligibleOpenTarget` — Case 1 with headroom gate

```typescript
export function isEligibleOpenTarget(
  openHostId: number,
  openWos: BtOpenWO[],
  openBatches: BtOpenBatch[],
  candidateDemand: number = 0,
  existingDraftWoIds: number[] = [],
  wos: BtWorkOrder[] = []
): boolean
```

Returns `true` only when:
1. The Open host is `case1` (not case2 or case3)
2. When `candidateDemand > 0`:
   `candidateDemand ≤ (mockHeadroom − existingDraftDemand)`

Case 2 and Case 3 Open rows always return `false`.

### `addChipToOpenRow` — state update for drop onto Open row

Before writing the new host, `addChipToOpenRow` inspects `chipHome[candidateWoId]`
and removes the chip from any prior Open row's `openRowChips` entry. This
prevents the "dual render" bug (BUG-6) where a chip appeared in two Open row
cells simultaneously.

```typescript
export function addChipToOpenRow(
  state: BtSessionState,
  candidateWoId: number,
  newHostId: number
): BtSessionState
```

### `moveChip` — cleanup for draft chip dragged off an Open row

`moveChip` now checks whether the chip's previous host was an Open row (using
`OPEN_ROW_HOST_IDS`). If so, it cleans up `openRowChips[prevHostId]` before
updating `chipHome`. This prevents the "two chips move together" bug (BUG-4).

---

## 6. Phase 2 Visual Patterns

### Open Production Row styling

Open rows use de-emphasized styling to signal "context, not the work being
planned":

```
bg-muted/5 text-muted-foreground/70
```

Applied to the entire `<tr>`. Open rows are never interactive during a drag
(except Case 1 rows, which highlight eligible for drop).

### Open row chip (2-line, crescent-style)

Open row chips differ from candidate chips:
- **Left border accent** (`border-l-4`) using project color for standalone
  Open WOs; neutral border for batch chips.
- **2-line layout** (see section 2.4).
- **Not draggable.** Open row chips are rendered with `isAnchoredRoot={true}`
  — they are permanent context, never moved.

### Routing pill active-step highlight

`RoutingPills` accepts `activeStepIndex?: number | null`:
- `null` (Case 1) — all pills muted (no active step)
- Index N — pill at index N renders `border-foreground/40 bg-white text-black`; all others stay muted

Open WOs and Open batches supply `mockActiveStepIndex`. This visually encodes
production state without a text label — replacing the removed state label
that previously injected colored text into the Part Name cell.

### Case 1 drop highlight vs. Case 2/3 grey

During drag of a candidate chip:
- Case 1 Open row (eligible): highlighted green (`bg-emerald-500/15 ring-1 ring-emerald-500/50`)
- Case 2/3 Open row (ineligible): `opacity-30 pointer-events-none` — same
  grey treatment as any other ineligible candidate row

The visual distinction between "highlighted Case 1" and "greyed Case 2/3"
gives the planner immediate read on which Open rows can accept additions.

### Available live update on Open chip

When a draft chip is dragged onto a Case 1 Open row:

```
Available: N
```

The N value updates live as `mockHeadroom - sum(draft chip quantities)` and
renders in `#0EA5E9` sky-500 (the draft-change signal color). On chip
removal, the value reverts to `mockHeadroom` and the color returns to muted.

Case 3 Open rows always render the Available value in `text-red-500`,
regardless of draft state.

### "Orphan Open rows" section

Open rows for PartIDs with no visible candidate rows in the current filter
render in a separate collapsible "Open Production Only" section below the
candidate table. This keeps them accessible as context without mixing them
into the candidate workspace.

---

## 7. Mockup-Only Patterns — Do Not Carry Forward

### `mockProductionState`, `mockHeadroom`, `mockActiveStepIndex`, `mockCompletedQty`

These fields exist exclusively in the mockup to simulate production state
without actual execution data. In the real implementation:

- `mockProductionState` → derived from the WO's actual step state (whether
  any steps have been started or completed)
- `mockHeadroom` → `CompletedQty - sum(non-Cancelled member demand)`
  for Case 2; a large constant for Case 1; irrelevant for Case 3
- `mockActiveStepIndex` → the index of the currently active `WoStep` row
- `mockCompletedQty` → the `completedQty` field on the active `WoStep`

The real implementation queries this data from `WoStep` and related tables,
not from mock flags.

### BOM walk at module init (`buildBtWOs`)

The mockup generates all candidate WOs by walking BOM trees at module
initialization from `SF_PROJECTS` and `MOCK_PARTS`. The real implementation
reads existing WO records from the database — WOs are generated at Project
compile time and flow through Stock Fulfillment.

### Module-level session state

All draft state (`BtSessionState`) lives in React `useState`. It resets on
hard page reload. The real implementation persists confirmed batches to the
database via Prisma transactions; draft state may use a combination of
client-side state and server-side draft records (TBD per spec).

### `OPEN_WOS` and `OPEN_BATCHES` seeded data

Seeded in `_data.ts` to represent a realistic shop floor landscape. Key
deviations from real data:
- `mockHeadroom: 1` on Open WO 50001 (was 8) — lowered specifically to
  demonstrate the headroom-exceeded test scenario (2 candidates × qty 1 =
  demand 2 > available 1 → auto-batch abstains).
- `mockActiveStepIndex: 3` on Open Batch B004 — out-of-bounds bug (see 2.18).
- All IDs in 50000–60999 ranges are synthetic; real IDs are database-assigned.

### Routing template assignment via `defaultTemplateId(partType, partId)`

Routing templates are deterministically assigned by `(partType, partId % 3)`.
In the real implementation, each Part has a single assigned Routing Template
from the Routing Template Editor.

### Mock current user

No user authentication. All Confirm Draft actions are attributed to a
hardcoded user in console output. The real implementation uses the
authenticated user's identity.

---

## 8. Deferred Items

### Case 2/3 inline coverage messages

Case 2 and Case 3 Open rows grey out during drag — the planner cannot drop on
them. There is no inline explanation of *why* the drop is blocked or what the
planner should do instead. Deferred pending execution lens mockups when real
step-state data exists.

### Case 3 confirmation prompt

The spec describes a prompt for Case 3 drops:
> "Purchasing activity exists for this Production Row but no completed
> quantity has been recorded. Please verify the ordered material will cover
> the additional demand before confirming."

In the mockup, Case 3 rows are blocked unconditionally (no drop allowed). The
spec's Case 3 prompt behavior is deferred to the real implementation, where
actual step-state data makes the distinction meaningful.

### "Include Started WIP" Auto-Batch tier

The third dropdown option ("Include Started WIP") is rendered as a disabled
non-interactive `<div>` with strikethrough. It requires Case 2/3 selection
logic and real execution data. Phase 2.5 work.

### Definition Change Flag indicators

The spec describes yellow flag indicators for WOs with open Definition Change
Flags. Not built in the mockup. The real implementation adds flag indicators
when the Definition Change Flag system is implemented.

### Auto-Batch WIP placement notification

When the WIP tier places candidates on an Open host, no UI feedback identifies
which Open row was selected or why. A "WIP assigned to: [row label]"
confirmation element would help the planner understand the heuristic result.
Deferred — low priority for Rev 1.

### Headroom negative state / overflow indicator

If a planner drags more chips than headroom allows, the mockup shows a
negative Available value in blue. No blocking or warning UX beyond the visual
exists. The real implementation should consider whether to block at-zero
(hard cap) or warn (soft cap with confirmation). Deferred.

---

## 9. Implementation Dependencies

### Shared components

**`ProjectChip` / `ProjectChipOverlay`** — at
`app/mockups/_shared/project-chip.tsx`. This component should move to
`components/ui/` or `components/batching/` in the real implementation. It
accepts:

```typescript
type Props = {
  woId: number;
  projectNumber: string;
  topLevelRef: string;
  demandQty: number;
  color: ProjectColor | null;
  isAtHome: boolean;
  isRoot: boolean;
  isAnchoredRoot: boolean;  // disables drag when true
};
```

`ProjectChipOverlay` is the DragOverlay clone — identical layout but not
connected to dnd-kit's draggable system. Required for the drag overlay
rendering.

**`ProjectIdPill`** — at
`app/mockups/project-creation/_components/project-id-pill.tsx`. The Batching
Lens does not directly use `ProjectIdPill` on its own surface, but the
component is a shared primitive. Per the Project Creation handoff, it must
move to `components/ui/` or `components/project/` in the real implementation.

### `@dnd-kit/core` dependency

dnd-kit (`@dnd-kit/core`, `@dnd-kit/utilities`) is already installed. The
Batching Lens is the first surface to use it. `PointerSensor` with a 5px
activation constraint and `KeyboardSensor` are both configured.

The 5px activation constraint prevents accidental drag starts on chip click
(which triggers the click-to-select fallback instead). Do not lower this
threshold.

### Database schema implications

The real implementation needs these fields confirmed before building:

- `WorkOrder.stockFulfillmentReviewedAt` — the field that distinguishes
  Batching candidates from non-released WOs
- `WoStep.completedQty` — source of Case 2 headroom calculation
- `Batch` entity — new entity created at Batching Confirm for multi-WO groups
- `WoStatus` transition `Unreleased → Open` — the Batching Confirm event

Verify each against `spec/schema.md` before implementing.

---

## 10. Color Discipline

Two color restrictions are load-bearing for the Batching Lens.

### Project color → chips only

Project color (from `PROJECT_COLOR_MAP`) renders only in `ProjectChip`
backgrounds and Open row chip left-border accents. No other element in the
Batching Lens uses project color for background, border, or text.

This was violated during Stock Fulfillment mockup iteration (row tint) and
caught during review. The Batching Lens was built with this discipline from
the start — no violations occurred — but the pattern bears documenting because
new candidate rows, header elements, and filter chips are all tempting
locations for "helpfully" adding project color.

### `#0EA5E9` → draft-change signal only

Sky-500 (`#0EA5E9`) has exactly one meaning in the Batching Lens: "this
value will change if the draft is confirmed." It appears on:
- Demand, Priority, Due Date cells when modified by chip composition
- Available value on Open chips when draft additions are present
- Planned Qty input when edited above demand

Do not use sky-500 for any other UI purpose (hover states, selection rings,
active filter indicators, etc.). The signal loses meaning if it appears in
non-draft contexts.

---

## 11. Manual Test Guide

Navigate to `http://localhost:3000/mockups/batching` (dev server on port 3000).

**Prerequisites:**
- Click "Reset Draft" and confirm if any chips have been moved.
- All chips should be at home (each Composition cell showing one anchor chip).

**Column count (10):** Select | Lock | Composition | Part # | Part Name |
Demand | Planned | Priority | Due Date | Routing

---

### Scenario 1 — Case 1 manual drop + Available live update

- **Part:** `58-17-0-00` / Photo Eye Kit Assembly
- **Candidates:** `10030.08 / Qty: 1` and `10489.01 / Qty: 1`
- **Open rows:** WO 50011 (case1, Available: 6, all pills muted) · WO 50002 (case2, blocked)

Steps:
1. Drag either Photo Eye Kit candidate chip onto Open WO 50011 (case1). Row
   highlights green during drag.
2. Drop → draft chip appears in 50011's Composition cell. Chip line 2:
   `Available: 5` in `#0EA5E9`.
3. Source candidate row shows "Drafted → 10030.08".
4. Open WO 50002 (case2) stays greyed during drag — drop blocked.
5. Drag the draft chip from 50011 back to the candidate row. Chip returns
   home; 50011 Available restores to 6 (blue disappears).

---

### Scenario 2 — Case 2 blocked drop

- **Part:** `55-10-0-00` / PB-M Wrap Around Drive Assembly
- **Candidate:** `10030.02 / Qty: 1`
- **Open rows:** WO 50007 (case2) · Batch B005 (case2)

Steps:
1. Begin dragging the candidate chip. Both case2 rows stay greyed — NOT green.
2. Attempt drop on either → chip snaps back home.

---

### Scenario 3 — Case 3 blocked + red Available on chip

- **Part:** `18-01-3-00` / CW 10.5in Cutter Plate Assembly
- **Candidates:** `10121.03 / Qty: 1` · `10412.02 / Qty: 1`
- **Open rows:** WO 50005 (case3, `Available: 3` in red, QC pill highlighted)
  · WO 50012 (case1, Available: 5, pills muted)

Steps:
1. Verify WO 50005 chip shows `Available: 3` in `text-red-500`, QC pill highlighted.
2. Begin drag. WO 50005 (case3) stays greyed; WO 50012 (case1) highlights green.
3. Drop on 50012 → draft chip appears; `Available: 4` in sky-500.
4. Attempt drop on 50005 → chip snaps back.

---

### Scenario 4 — Auto-Batch WIP tier precedence

- **Part:** Tailstock Brake Assembly / Tailstock Brake Assembly
- **Candidates:** `10121.04 / Qty: 1` · `10412.01 / Qty: 1`
- **Open rows:** WO 50001 (case1, Jul 15) · Batch B001 (case1, Jul 12) ·
  WO 50013 (case3, Aug 15)

Steps:
1. Click "Auto-Batch" → dropdown opens. Click "Include Unstarted WIP."
2. Verify both Tailstock candidate chips land on Open WO 50001 (latest
   case1 due date). Batch B001 (earlier date) stays empty.
3. WO 50013 (case3) stays empty — excluded from WIP tier.

**Expected: WO 50001 selected (Jul 15 > Jul 12; WO 50013 excluded as case3)**

---

### Scenario 5 — Headroom constraint — Auto-Batch abstains

- **Part:** Tailstock Brake Assembly (same part as Scenario 4)
- **Condition:** Open WO 50001 has `mockHeadroom: 1`, candidates total demand 2

Steps:
1. Ensure Reset Draft applied. Run "Include Unstarted WIP" Auto-Batch.
2. Verify Tailstock candidates are NOT placed on any Open row (demand 2 > available 1).
3. If `woIds.length >= 2`, verify they batch candidate-to-candidate instead.

---

### Scenario 6 — Draft chip drag between two Case 1 Open rows

- **Part:** `59-16-3-00` / 1 inch PB-M End Stop Assembly
- **Candidates:** `10030.07 / Qty: 1` · `10489.02 / Qty: 1`
- **Open rows:** WO 50008 (case1, Available: 8) · Batch B003 (case1, Available: 7)

Steps:
1. Drag `10030.07` chip onto Open WO 50008. Drop → chip in 50008, `Available: 7`.
2. Drag the draft chip from 50008 onto Batch B003. Drop → chip moves to B003;
   50008 Available restores to 8 (blue disappears); B003 shows `Available: 6`.
3. Verify: chip appears in exactly ONE place (B003 only — no duplicate in 50008
   or the candidate row).

---

### Scenario 7 — Lock / view mode / Planned Qty

Steps:
1. Verify Batching view (default) shows unlocked candidate rows. Singletons hidden.
2. Manually lock a non-singleton row via the Lock toggle. Row disappears from
   Batching view.
3. Switch to Qty Planning view. Locked row is now visible. Planned Qty input
   shows current demand value. Confirm Draft button is now enabled.
4. Edit Planned Qty above demand → value turns sky-500.
5. Switch back to Batching view → locked row is gone again.
6. Click Reset Draft → confirm modal appears. Click Reset. All chips home, lock
   states restored to defaults, Planned Qty edits cleared.

---

## 12. Known Open Issues

### B004 `mockActiveStepIndex: 3` out of bounds

Open Batch B004 (partId 1951, PB-M Base Assembly) has `mockActiveStepIndex: 3`
but `tmpl_assembly` has only 3 steps (indices 0–2). The QC pill should be
highlighted but is not. Not a crash — B004 is case3 so all pills render muted
anyway. Fix: change `mockActiveStepIndex: 3 → 2` in `_data.ts`. Noted in
section 2.18; fix before implementation review.

### Headroom constraint not reflected in toast or audit log

When Auto-Batch (WIP tier) abstains due to headroom overflow, there is no
toast or audit log entry. The candidates silently stay home. If the planner
does not notice, they may not understand why the WIP tier "did nothing" for
that part. A future improvement: a summary line in the toast ("3 PartIDs
skipped — Available headroom exceeded").

### Singleton re-evaluation is not live

If a candidate is confirmed (moved to Open) mid-session and the remaining
partner candidate would become a true singleton as a result, the mockup does
not re-evaluate singleton status live. The partner candidate remains in the
Batching view. The real implementation should re-derive singleton status on
every state change.

### "Show Unbatchable Parts" toggle (singletons) label vs. spec

The toggle label used throughout the mockup is "Show Unbatchable Parts"
(not "Show Hidden Singletons" as the spec describes). The rationale:
"Unbatchable" is more immediately understood by a planner than "Hidden
Singleton." Update the spec label to match.

---

## 13. File Inventory

### `app/mockups/batching/`

| File | Purpose |
|------|---------|
| `_data.ts` | All mock data and business logic: `BtWorkOrder`, `BtOpenWO`, `BtOpenBatch`, `BtSessionState`, `BtCandidateGroup` types; `ROUTING_TEMPLATES`; `ALL_BT_WOS` (BOM walk across 4 projects); `OPEN_WOS` (15 Open WOs, IDs 50001–50015); `OPEN_BATCHES` (6 Open batches, IDs 60001–60006, B001–B006); `INITIAL_SESSION_STATE`; pure state functions: `getDerivedRowValues`, `getOpenRowDerivedValues`, `isEligibleTarget`, `isEligibleOpenTarget`, `moveChip`, `addChipToOpenRow`, `toggleLock`, `lockMultiple`, `unlockMultiple`, `resetPlannedToDemand`, `multiplyPlannedQty`, `addToPlannedQty`, `updatePlannedQty`, `confirmDraft`, `autoBatchCandidates`, `resetDraft`; helper functions: `getChipsInCell`, `getOpenRowHostIds`, `getPartIdsWithOpenWork`, `computeDefaultLockState` |
| `page.tsx` | The entire Batching Lens: DndContext setup, DragOverlay, state management, all row types (`CandidateRow`, `OpenProductionRow`, `OpenCompositionCell`), toolbar (Auto-Batch dropdown, Confirm Draft, Reset Draft, view mode segmented control, filters), multi-select toolbar, Reset Draft modal, empty states |

### `app/mockups/_shared/`

| File | Purpose |
|------|---------|
| `project-chip.tsx` | `ProjectChip` (candidate chip, draggable) and `ProjectChipOverlay` (DragOverlay clone). Shared across Batching Lens. Move to `components/ui/` or `components/batching/` in implementation. |
