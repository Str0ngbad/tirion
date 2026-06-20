# Mockup Track Session Log

This file records design exploration done on the Tirion mockup
track. The mockup track is a parallel workstream to the
implementation track: it builds functional HTML/React mockups to
validate spec ergonomics, surface design questions, and explore
patterns before implementation work commits to them.

Each entry below documents a session's exploration — what surfaces
were touched, what design decisions emerged, what's recommended
for implementation, and what stays mockup-only.

This file is the mockup track's record. Implementation track
decisions go in DEVIATIONS.md when those decisions land in code
that ships.

Entries are ordered most recent first.

---

## Session: Batching Lens — Phase 2 Drag Restore + Available Label + Column Polish (2026-06-20)

### Commits in this session

1. `fix(mockup): restore drag on draft chips and fix open-row-to-open-row state collision`
2. `refactor(mockup): revise open chip format to Available label with value-only color`
3. `refactor(mockup): remove vestigial headroom column from table`
4. `refactor(mockup): equalize column widths for visual balance`

### Bugs fixed

**BUG-6 — Open-row-to-open-row state collision (dual render).** The prior session's `moveChip` cleanup fix covered candidate→candidate drags that exited an Open row via `moveChip`. It did NOT cover the case where a draft chip was dragged from one Case 1 Open row directly onto a different Case 1 Open row (same partId), which routes through `addChipToOpenRow`. Before the fix, `addChipToOpenRow` set `chipHome[candidateWoId] = newHostId` AND added the chip to `openRowChips[newHostId]`, but left `openRowChips[oldHostId]` intact. Result: chip rendered in both Open rows simultaneously. Fix: `addChipToOpenRow` now inspects `chipHome[candidateWoId]` before writing and removes the chip from any prior Open row's `openRowChips` entry.

**BUG-7 — Draft chips non-draggable (prior workaround reversed).** The prior session set `isAnchoredRoot={true}` on draft chips in `OpenCompositionCell` as a preventive workaround for the tandem-drag bug. With BUG-4 (moveChip cleanup) and BUG-6 (addChipToOpenRow cleanup) both fixed, the state is now consistent regardless of drag path. The workaround is removed: draft chips use `isAnchoredRoot={false}` and are fully draggable — back to their home candidate row, or to another eligible Case 1 Open row. The click-to-remove button wrapper is also removed; drag is now the sole interaction for repositioning a draft chip.

### Structural changes

**Headroom column removed.** The Headroom column (blank for all rows — value moved to chip in prior session) served no display purpose. Column header, `<col>` entry, and blank `<td>` cells in both `CandidateRow` and `OpenProductionRow` are removed. Column count 11 → 10: Select | Lock | Composition | Part # | Part Name | Demand | Planned | Priority | Due Date | Routing. `colSpan` updated to 10.

**Open chip label: "Hdrm:" → "Available:"** Chip line 2 now reads `Available: N` where only the numeric value `N` receives color (red for case3; bright blue `#0EA5E9` when draft chips present; muted otherwise). The "Available:" label text stays neutral muted in all states. Internal variables renamed `headroom`/`headroomChanged` → `available`/`availableChanged` in `OpenProductionRow`. Data field `mockHeadroom` unchanged.

**Column spacing adjusted.** Composition: 150 → 170px. Part Name: 180 → 200px (max-w updated to 184px). Priority: 96 → 60px (single digit; prior width was excessive). Total ~1124px — no horizontal scroll at 1280px.

### Known data issue (deferred)

**Open Batch B004 (partId 1951, PB-M Base Assembly) has `mockActiveStepIndex: 3`.** B004 uses `tmpl_assembly` (Prep/Assembly/QC, 3 steps, valid indices 0–2). Index 3 is out of bounds — RoutingPills renders no highlighted pill. The batch is case3 so the out-of-bounds index does not cause a crash (all pills render muted anyway), but the QC pill should be highlighted. Not fixed in this session; flag for a future data-cleanup commit.

### Manual Test Guide (Phase 2 refresh — 2026-06-20)

Navigate to `http://localhost:3000/mockups/batching` (dev server on port 3000).

**Prerequisite:** Click "Reset Draft" if any chips have been moved.

**Columns visible (10 total):** Select | Lock | Composition | Part # | Part Name | Demand | Planned | Priority | Due Date | Routing. No Project, Completed, or Headroom columns.

**Spot-check Part Names.** Walk `app/mockups/batching/_data.ts` Open WOs and Batches to verify the rendered table matches:
- partId 1942 → Part # "Tailstock Brake Assembly", Part Name "Tailstock Brake Assembly"
- partId 1948 → Part # "58-17-0-00", Part Name "Photo Eye Kit Assembly"
- partId 2035 → Part # "18-01-3-00", Part Name "CW 10.5in Cutter Plate Assembly"

All parts in the batching lens are Assembly type → all Routing cells show Prep / Assembly / QC pills.

---

**Scenario 1 — Case 1 drop + Available live update on chip**

- **Part:** Part # `58-17-0-00` / "Photo Eye Kit Assembly"
- **Candidate WOs (Batching view):** two rows — chip `10030.08 / Qty: 1` and `10489.01 / Qty: 1`
- **Open rows visible for this part:** Open WO 50011 (case1, Available: 6, all pills muted) · Open WO 50002 (case2, available: 1, Assembly pill highlighted)

Steps:
1. Drag either Photo Eye Kit candidate chip onto Open WO 50011 (case1). Row highlights green.
2. On drop: draft chip appears in 50011's Composition cell. Chip line 2 updates: `Available: 5` in bright blue `#0EA5E9`.
3. Source candidate row shows "Drafted → 10030.08".
4. Open WO 50002 (case2) stays greyed during drag — drop blocked.
5. **Drag the draft chip from Open WO 50011 back to the candidate row.** Chip returns home; source row chip reappears; Available returns to 6 (blue disappears).

---

**Scenario 2 — Case 2 blocked drop**

- **Part:** Part # `55-10-0-00` / "PB-M Wrap Around Drive Assembly (standard height columns)"
- **Candidate WO:** one row — chip `10030.02 / Qty: 1`
- **Open rows visible:** Open WO 50007 (case2, Available: 3, Assembly pill highlighted) · Open Batch B005 (case2, Available: 4, Assembly pill highlighted)

Steps:
1. Begin dragging the candidate chip. Verify both case2 Open rows stay greyed — drop targets not highlighted.
2. Attempt to drop on either Open row → chip returns home.

---

**Scenario 3 — Case 3 blocked drop + red Available value on chip**

- **Part:** Part # `18-01-3-00` / "CW 10.5in Cutter Plate Assembly"
- **Candidate WOs:** two rows — `10121.03 / Qty: 1` and `10412.02 / Qty: 1`
- **Open rows visible:** Open WO 50005 (case3, `Available: 3` in **red**, QC pill highlighted) · Open WO 50012 (case1, `Available: 5` muted, all pills muted)

Steps:
1. Verify 50005's chip shows `Available: 3` in red with QC pill highlighted.
2. Begin dragging a candidate chip. 50005 (case3) stays greyed; 50012 (case1) highlights green.
3. Drop on 50012 → draft chip appears; 50012 chip updates `Available: 4` in blue.
4. Attempt drop on 50005 → chip snaps back to source.

---

**Scenario 4 — Multi-host heuristic (Auto-Batch WIP tier)**

- **Part:** Part # "Tailstock Brake Assembly" / "Tailstock Brake Assembly"
- **Open rows visible:** Open WO 50001 (case1, Jul 15) · Open Batch B001 (case1, Jul 12) · Open WO 50013 (case3, Aug 15 — greyed during drag)

Steps:
1. Switch Auto-Batch to "Include Unstarted WIP" tier.
2. Click "Auto-Batch."
3. Verify both Tailstock Brake Assembly candidate chips land on Open WO 50001 (latest case1 due date). Chip line 2: `Available: 6` → `Available: 4` in blue (after 2 draft chips with qty 1 each).

---

**Scenario 5 — Draft chip drag between two Case 1 Open rows**

- **Part:** Part # `59-16-3-00` / "1 inch PB-M End Stop Assembly"
- **Candidate WOs:** two rows — `10030.07 / Qty: 1` and `10489.02 / Qty: 1`
- **Open rows visible:** Open WO 50008 (case1, Available: 8) · Open Batch B003 (case1, Available: 7)

Steps:
1. Drag `10030.07` chip onto Open WO 50008. Drop → draft chip appears. 50008 shows `Available: 7`.
2. **Drag the draft chip from 50008 onto Open Batch B003.** Drop → chip appears in B003; 50008 Available restores to 8 (blue disappears); B003 shows `Available: 6` in blue.
3. Verify: chip appears in exactly ONE place (B003). No duplicate in 50008 or the candidate row.

---

**Scenario 6 — No-duplication check**

Steps:
1. Drag any candidate chip onto a Case 1 Open row. Drop succeeds.
2. Verify: candidate row shows "Drafted →". Open row Composition shows ONE draft chip (not two).
3. Drag the draft chip back to the candidate row. Home row chip reappears; Open row draft clears.
4. Verify: chip appears in exactly one place at all times.

---

### Spec gaps — for implementation handoff

| Gap | Description |
|-----|-------------|
| Project column removed | Spec lists Project(s) column; removed as redundant. Update spec. |
| Completed column removed | Spec lists Completed column; removed (covered by chip Available). Update spec. |
| Headroom column removed | Spec may list Headroom column; moved to chip line 2. Update spec. |
| Open chip 2-line layout | Spec shows single-line chip. Now 2-line with Available inline. Update spec chip format. |
| "Available" label | Spec may reference "Headroom" as the column/field label. Implementation should use "Available." |
| Batch ID format | Spec may reference OPEN-BATCH-NNN format. Implementation should use short BN format. |
| B004 activeStepIndex | Open Batch B004 has mockActiveStepIndex: 3 but tmpl_assembly only has 3 steps (0–2). Fix in data before implementation. |

---

## Session: Batching Lens — Phase 2 Chip Duplication Fix + Column Restructure (2026-06-19)

### Commits in this session

1. `fix(mockup): resolve chip duplication on candidate-to-Open-row drop`
2. `refactor(mockup): remove Project column`
3. `refactor(mockup): remove Completed column (data field preserved for Headroom derivation)`
4. `feat(mockup): shorten Batch ID format and expand Open chip to 2-line layout with Headroom`
5. `fix(mockup): apply whitespace-nowrap to Part Number and Due Date cells`
6. `fix(mockup): correct out-of-bounds mockActiveStepIndex on Assembly Open WO 50005`

### Bugs fixed

**BUG-4 — Chip duplication on candidate-to-Open-row drop.** Root cause: draft chips in `OpenCompositionCell` were rendered with `isAnchoredRoot={false}` on `ProjectChip`, making them draggable via `useDraggable`. When dragged back to a candidate row, `handleDragEnd` routed through `moveChip`, which updated `chipHome[candidateWoId]` but did NOT clean up `openRowChips[openHostId]`. Result: `chipHome` pointed the chip home (renders chip in candidate row) while `openRowChips` still listed it (renders chip in Open row draft). Both chips share the same dnd-kit id (`chip-{woId}`), so both responded to drag events in tandem — producing the "two chips move together" symptom. Scroll while holding a chip produced a third render (DragOverlay restoring). Fixes: (a) `moveChip` in `_data.ts` now cleans up `openRowChips` when a chip's previous host was an Open row host; (b) draft chips in `OpenCompositionCell` use `isAnchoredRoot={true}` so `useDraggable` is disabled — removal is click-only.

**BUG-5 — `mockActiveStepIndex: 3` out-of-bounds on Assembly Open WO 50005.** Cover Panel (Open WO 50005) is an Assembly type using `tmpl_assembly` (3 steps: Prep/Assembly/QC, valid indices 0–2). `mockActiveStepIndex: 3` is out of bounds; no pill was highlighted. Fixed: `3 → 2` (QC, the final step). Open Batch 60004 (End Cap Left, `tmpl_lathe`, 4 steps) was verified correct — index 3 = Inspect, the final step.

### Structural changes

**Project column removed.** Project identity is already encoded in every chip (Project Number + TopLevelRef for WO chips; BatchID for batch chips). The column carried zero additional information for the planner. Removed from header, candidate rows, and Open rows. `colSpan` updated from 13 → 12.

*Spec gap: `spec/batching_lens_spec.md` lists a Project(s) column. Implementation handoff will need the spec updated to reflect the removal and its rationale.*

**Completed column removed.** With Headroom now shown directly on the Open chip, the planner no longer needs CompletedQty as a separate scan value. Column removed. `mockCompletedQty` data field stays in `_data.ts` (feeds `mockHeadroom` derivation). `colSpan` updated to 11.

*Spec gap: `spec/batching_lens_spec.md` lists a Completed column. Implementation handoff will need the spec updated.*

**Final column count: 11** — Select | Lock | Composition | Part # | Part Name | Demand | Planned | Headroom | Priority | Due Date | Routing.

### New features

**Open chip 2-line layout with Headroom.** Open WO and Open Batch chips now render two lines:
- Line 1: `ProjectNumber · TopLevelRef` (WO chip) or `BatchID` (batch chip)
- Line 2: `Qty: N   Hdrm: M`

Headroom color rules on chip: Case 3 → red (terminal, no new members); Case 1/2 with draft additions → bright blue `#0EA5E9` (live update); Case 1/2 without additions → muted. Headroom column cell on Open rows is now blank (value is on the chip).

**Batch ID shortened: `OPEN-BATCH-00N` → `BN`.** 14-char IDs → 4-5 chars. Batch data in `_data.ts` updated for all 6 Open Batches (B001–B006). Placement notes and AuditLog console messages update automatically.

**Part Number and Due Date wrapping fixed.** `whitespace-nowrap` applied to both cells in candidate rows and Open rows. Previously: Part Numbers like `12-08-1-01` wrapped mid-hyphen; dates like `Aug 29, 26` wrapped to 3 lines.

### Manual Test Guide (updated for Phase 2 column restructure)

Navigate to `http://localhost:3000/mockups/batching` (dev server on port 3000).

**Prerequisite:** Click "Reset Draft" if any chips have been moved. All chips should be at home.

**Columns visible:** Select | Lock | Composition | Part # | Part Name | Demand | Planned | Headroom | Priority | Due Date | Routing. No Project or Completed columns.

---

**Scenario 1 — Case 1 drop + Headroom live update on chip**

- **Part:** 58-17-0-00 / Photo Eye Kit
- **Candidate WOs:** `10030.08 / Qty: 1` and `10489.01 / Qty: 1`
- **Open rows visible:** Open WO 50011 (case1) chip shows `10030 · 10030.08 / Qty: 4  Hdrm: 6`; Open WO 50002 (case2) chip shows `10489 · 10489.01 / Qty: 4  Hdrm: 1`

Steps:
1. Drag either Photo Eye Kit candidate chip onto Open WO 50011 (case1). Row highlights green.
2. On drop: chip appears in Open row's Composition cell. Open WO 50011 chip line 2 updates: `Qty: 4  Hdrm: 5` (Hdrm in bright blue).
3. Source candidate row shows "Drafted → 10030.08".
4. Open WO 50002 (case2) stays greyed during drag — drop blocked.
5. Click the draft chip in 50011's Composition cell to remove it. Headroom returns to 6 (blue disappears).

---

**Scenario 2 — Case 2 blocked drop**

- **Part:** 55-10-0-00 / PB-M Wrap Around Drive Assembly
- **Candidate WO:** `10030.02 / Qty: 1`
- **Open rows:** Open WO 50007 (case2) chip shows `Qty: 5  Hdrm: 3`; Open Batch B005 (case2) chip shows `B005 / Qty: 6  Hdrm: 4`

Steps:
1. Begin dragging the candidate chip. Verify both case2 Open rows stay greyed.
2. Attempt to drop on either → chip returns home.

---

**Scenario 3 — Case 3 blocked drop + red Headroom on chip**

- **Part:** 18-01-3-00 / CW 10.5in Cutter Plate Assembly
- **Candidate WOs:** `10121.03 / Qty: 1` and `10412.02 / Qty: 1`
- **Open rows:** Open WO 50005 (case3) chip shows `Qty: 1  Hdrm: 3` in **red**; QC pill highlighted. Open WO 50012 (case1) chip shows `Qty: 1  Hdrm: 5` (no red).

Steps:
1. Verify 50005's chip line 2 shows `Hdrm: 3` in red. ← BUG-5 fix: QC pill (index 2) now highlighted.
2. Begin dragging a candidate chip. 50005 (case3) stays greyed; 50012 (case1) highlights green.
3. Drop on 50012 → draft chip appears; 50012's chip updates `Qty: 1  Hdrm: 4` (blue).
4. Attempt drop on 50005 → chip snaps back.

---

**Scenario 4 — Multi-host heuristic (Auto-Batch WIP tier)**

- **Part:** Tailstock Brake Assembly
- **Open rows:** WO 50001 (case1, Jul 15) · Batch B001 (case1, Jul 12) · WO 50013 (case3, Aug 15 — excluded)
- **Expected:** Auto-Batch (WIP tier) picks WO 50001 (latest case1 due date).

Steps:
1. Switch Auto-Batch to "Include Unstarted WIP" tier.
2. Click "Auto-Batch."
3. Verify both Tailstock Brake Assembly candidate chips land on Open WO 50001. Chip line 2: `Qty: 2  Hdrm: 6` (blue).

---

**Scenario 5 — No-duplication verification (BUG-4 fix)**

Steps:
1. Drag a candidate chip onto a Case 1 Open row. Drop succeeds.
2. Verify: candidate row shows "Drafted →". Open row shows ONE draft chip.
3. Verify: there is no duplicate chip in the candidate row. The chip does NOT appear in both places.
4. Click the draft chip to remove it (click-only; chip is not draggable). Candidate row chip returns.

---

### Spec gaps — for implementation handoff

| Gap | Description |
|-----|-------------|
| Project column removed | Spec lists Project(s) column; mockup removes it as redundant. Update spec to remove the column and document rationale. |
| Completed column removed | Spec lists Completed column; mockup removes it as covered by chip Headroom. Update spec. |
| Open chip 2-line layout | Spec shows single-line chip. Mockup uses 2-line with Headroom inline. Update spec chip format. |
| Batch ID format | Spec may reference OPEN-BATCH-NNN format. Implementation should use short BN format. |

---

## Session: Batching Lens — Phase 2 Verification Fixes + Data Display (2026-06-19)

### Commits in this session

1. `fix(mockup): remove nested <tr> wrapper from OpenProductionRow`
2. `refactor(mockup): redefine singleton to include Open work for PartID`
3. `feat(mockup): add Routing pill active-step highlight for Case 2/3 Open rows`
4. `feat(mockup): add Completed column to right of Routing`
5. `feat(mockup): add Headroom column between Planned and Priority`
6. `refactor(mockup): drop 'Show Only Actionable' toggle, hide non-actionable Case 2 rows implicitly`
7. `refactor(mockup): remove Active in Production indicator from Open rows`
8. `fix(mockup): allow scroll to reach bottom of candidate table`
9. `docs(mockup): regenerate Manual Test Guide with Part Numbers and verified heuristic data`

### Bugs fixed

**BUG-1 — Nested `<tr>` hydration error.** `OpenProductionRow` was wrapped in a `<tr style={{display:"contents"}}>` inside `renderCandidateGroupWithOpenRows`, producing a `<tr>` directly nested inside a `<tr>`. This violates the HTML table model, causes React hydration errors, and may corrupt dnd-kit collision detection. Fix: removed the outer wrapper entirely; `isGreyedOut` prop passed directly to the inner `OpenProductionRow` which applies `opacity-30 pointer-events-none` on its own `<tr>`.

**BUG-2 — "Include Unstarted WIP" Auto-Batch tier unreachable.** The prior singleton definition (`partWOs.length === 1`) treated any single-candidate partId as a true singleton, auto-locking it. Partids with exactly one candidate WO but existing Open work were locked and invisible to the "Include Unstarted WIP" tier (which places candidate singletons onto matching Case 1 Open rows). Fix: new singleton definition: `partWOs.length === 1 && !partIdsWithOpenWork.has(partId)`. Candidates with Open hosts are now non-singletons → unlocked by default → visible in Batching view → reachable by the WIP tier. `PART_IDS_WITH_OPEN_WORK` (module-level constant, avoids TDZ on `INITIAL_CANDIDATE_GROUPS`) drives both `liveGroups` and `computeDefaultLockState`.

**BUG-3 — Production state label bleeding into Part Name cell.** The `stateLabel` span ("Open", "In Progress", "Final Step") injected colored text into the Part Name cell, creating ambiguous proximity to the part name. Fix: removed the state label entirely. Replaced by routing pill active-step highlight (see below).

### New features

**Routing pill active-step highlight (Case 2/3).** `RoutingPills` now accepts `activeStepIndex?: number | null`. When non-null, the pill at that index renders `border-foreground/40 bg-white text-black`; all other pills stay muted. Open WOs and Open Batches supply `mockActiveStepIndex`. Case 1 passes `null` (no active step → all pills muted). This encodes production state visually without needing a text label.

**Completed column.** Added to the right of Routing in the Open row table. Case 2: shows `mockCompletedQty`. Case 1 / Case 3: dash. Candidate rows: blank. Tells the planner how many units are already done in the current production run.

**Headroom column.** Added between Planned and Priority. For Open rows: `mockHeadroom - sum(draft chip quantities)`. Updates live in bright-blue `#0EA5E9` when chips are dragged onto the row. Case 3 always shown in red (signals: terminal step, no new members accepted regardless of numeric headroom). Candidate rows: blank. Informs drop decisions without requiring the planner to do mental subtraction.

**Non-actionable Case 2 rows hidden implicitly.** Case 2 Open rows with `mockHeadroom <= 0` are hidden from the Open row table automatically. Case 1 and Case 3 always visible. The "Show Only Actionable" toggle is removed — the behavior is now always-on. This simplifies the filter bar and removes a decision the planner should never need to reverse.

**Active in Production indicator removed from Open rows.** The amber Activity icon on Open row Part # cells was redundant — every Open row is by definition "Active in Production." Removed from `OpenProductionRow`. Icon remains on candidate rows (where it signals "this partId has open work elsewhere").

### Singleton redefinition — design rationale

The old singleton definition treated any partId with one candidate WO as unbatchable. This was correct when "batchable" meant "can be combined with another WO of the same part," but became wrong when Open rows entered the model. A candidate WO with a matching Open host isn't truly unbatchable — it should be visible so the planner can decide to add it to the existing production run.

New rule: a partId group is a true singleton (unbatchable) only if:
1. Exactly one candidate WO exists for the partId, AND
2. No Open work (WO or batch) exists for the partId in the lens.

If either condition fails, the group is a non-singleton and appears unlocked in the Batching view.

### Data coverage — 5 demo scenarios

The seeded data supports these specific scenarios for manual testing. Part Numbers and Part Names are as rendered in the UI (sourced from MOCK_PARTS via real data).

| Scenario | Part Number | Part Name | Candidate WOs | Key Open rows |
|----------|-------------|-----------|---------------|---------------|
| 1 — Case 1 drop | 58-17-0-00 | Photo Eye Kit | 10030.08 (qty 1) · 10489.01 (qty 1) | WO 50011 (case1, headroom 6) · WO 50002 (case2, headroom 1, blocked) |
| 2 — Case 2 blocked | 55-10-0-00 | PB-M Wrap Around Drive Assembly | 10030.02 (qty 1) | WO 50007 (case2, headroom 3) · Batch 60005 (case2, headroom 4) |
| 3 — Case 3 blocked | 18-01-3-00 | CW 10.5in Cutter Plate Assembly | 10121.03 (qty 1) · 10412.02 (qty 1) | WO 50005 (case3, headroom 3 red) · WO 50012 (case1, headroom 5) |
| 4 — Multi-host heuristic | Tailstock Brake Assembly | Tailstock Brake Assembly | 10121.04 (qty 1) · 10412.01 (qty 1) | WO 50001 (case1, Jul 15) · Batch 60001 (case1, Jul 12) · WO 50013 (case3, Aug 15) |
| 5 — Headroom live update | 18-01-3-00 | CW 10.5in Cutter Plate Assembly | 10121.03 (qty 1) | WO 50012 (case1, headroom 5) |

Non-actionable hidden demo: Part Number 52-31-0-00 (PB-M Lower Column 2.0) — Open WO 50009 (case2, headroom 0) is hidden by the implicit filter. Only the candidate WO is visible, with the amber Activity icon on the Part # cell.

### Heuristic rule — locked definition

The "Include Unstarted WIP" Auto-Batch tier follows this rule when multiple Open rows exist for the same partId:

1. **Case 1 only** — Case 2 and Case 3 Open rows are never auto-batch targets (`isEligibleOpenTarget` returns false for case2/3). Only case1 rows enter the candidate pool.
2. **Latest dueDate among case1** — the row with the most recent dueDate is preferred.
3. **Tiebreak: lowest openHostId** — deterministic when two case1 rows share a dueDate.

**Scenario 4 verification:** For Tailstock Brake Assembly, the candidate pool after rule 1 is: WO 50001 (case1, Jul 15) and Batch 60001 (case1, Jul 12). WO 50013 (case3, Aug 15) is excluded — it has the latest date but is case3. Among the two case1 options, WO 50001 (Jul 15) beats Batch 60001 (Jul 12). **Expected pick: Open WO 50001.**

### Manual Test Guide

Navigate to `http://localhost:3000/mockups/batching` (dev server on port 3000).

**Prerequisite:** Click "Reset Draft" if any chips have been moved. All chips should be at home (Composition cells showing one anchor chip each).

---

**Scenario 1 — Case 1 drop**

- **Part Number:** 58-17-0-00
- **Part Name:** Photo Eye Kit
- **Candidate WOs:** two rows — chip `10030.08 / Qty: 1` (project 10030) and `10489.01 / Qty: 1` (project 10489)
- **Open rows visible:** Open WO 50001 label `10489.01 / Qty: 4` (case2, headroom 1, QC pill highlighted) and Open WO 50011 label `10030.08 / Qty: 4` (case1, headroom 6, all pills muted)
- **Expected outcome:** Drag either Photo Eye Kit candidate chip onto the Open WO 50011 row (case1). Row highlights green during drag. On drop: Demand on 50011 increments, Headroom decreases to 5 (bright blue `#0EA5E9`). Open WO 50002 (case2) should stay greyed during drag — drop blocked.

Steps:
1. Click "Auto-Batch Candidates" (Candidates Only tier) → Photo Eye Kit WOs batch together, a guest chip appears.
2. Drag the guest chip onto the de-emphasized Open WO 50011 row.
3. Verify: Demand increments; Headroom column shows 5 in bright blue; Completed shows "—" (case1).
4. Drag the chip back home to reset.

---

**Scenario 2 — Case 2 blocked drop**

- **Part Number:** 55-10-0-00
- **Part Name:** PB-M Wrap Around Drive Assembly (standard height columns)
- **Candidate WO:** one row — chip `10030.02 / Qty: 1` (project 10030)
- **Open rows visible:** Open WO 50007 chip `10030 · 10030.02 / Qty: 5  Hdrm: 3` (case2, Assembly pill highlighted) and Open Batch B005 chip `B005 / Qty: 6  Hdrm: 4` (case2, Assembly pill highlighted)
- **Expected outcome:** Both case2 Open rows are visible with their routing pill highlighted. During drag of the candidate chip, both case2 rows stay greyed (30% opacity, `pointer-events-none`). Drop is blocked — chip snaps back home. This confirms the locked rule: case2 rows are visible for context but accept no new drops.

Steps:
1. Begin dragging the `10030.02 / Qty: 1` chip from the PB-M Wrap Around Drive Assembly row.
2. Observe: both Open rows for this part (50007 and 60005) are greyed — NOT highlighted green.
3. Attempt to drop on either Open row → chip returns home.

---

**Scenario 3 — Case 3 blocked drop**

- **Part Number:** 18-01-3-00
- **Part Name:** CW 10.5in Cutter Plate Assembly
- **Candidate WOs:** two rows — chip `10121.03 / Qty: 1` (project 10121) and `10412.02 / Qty: 1` (project 10412)
- **Open rows visible:** Open WO 50005 label `10412.02 / Qty: 1` (case3, Headroom 3 in **red**, QC pill highlighted) and Open WO 50012 label `10121.03 / Qty: 1` (case1, Headroom 5, all pills muted)
- **Expected outcome:** During drag, WO 50005 (case3) stays greyed — drop blocked. WO 50012 (case1) highlights green — eligible. Drop on 50012 succeeds; drop on 50005 snaps back.

Steps:
1. Begin dragging a CW 10.5in Cutter Plate Assembly chip.
2. Verify: 50005 (case3) is greyed out; 50012 (case1) is highlighted green.
3. Drop on 50012 → Demand increments; Headroom 5→4 (blue); Completed "—".
4. Attempt drop on 50005 → chip snaps back.

---

**Scenario 4 — Multi-host heuristic (Auto-Batch WIP tier)**

- **Part Number:** Tailstock Brake Assembly
- **Part Name:** Tailstock Brake Assembly
- **Candidate WOs:** two rows — chip `10121.04 / Qty: 1` (project 10121) and `10412.01 / Qty: 1` (project 10412)
- **Open rows visible:** Open WO 50001 chip `10030 · 10030.04 / Qty: 2  Hdrm: 8` (case1, Jul 15) · Open WO 50013 chip `10412 · 10412.01 / Qty: 2  Hdrm: 4` (case3, Aug 15, red Hdrm) · Open Batch B001 chip `B001 / Qty: 5  Hdrm: 6` (case1, Jul 12)
- **Expected outcome:** Switch Auto-Batch to "Include Unstarted WIP" tier and run. Heuristic candidate pool = case1 rows only: WO 50001 (Jul 15) and Batch 60001 (Jul 12). WO 50013 (case3, Aug 15) excluded despite having the latest date. Among case1: WO 50001 (Jul 15 > Jul 12) wins. **Both candidate chips should land on Open WO 50001.**

Steps:
1. Click the chevron on the Auto-Batch button → select "Include Unstarted WIP."
2. Click "Auto-Batch."
3. Verify: both Tailstock Brake Assembly candidate chips appear in Open WO 50001's Composition cell. Headroom on 50001 updates: 8 − 2 = 6 (blue).
4. Open WO 50013 stays empty (case3 excluded from heuristic).
5. Open Batch 60001 stays empty (case1 but earlier date than 50001).

---

**Scenario 5 — Headroom live update**

- **Part Number:** 18-01-3-00
- **Part Name:** CW 10.5in Cutter Plate Assembly
- **Candidate WO:** chip `10121.03 / Qty: 1` (project 10121)
- **Open row:** Open WO 50012 label `10121.03 / Qty: 1` (case1, Headroom **5**, all pills muted)
- **Expected outcome:** Drag candidate chip onto 50012. Headroom column updates from 5 to 4 in bright blue `#0EA5E9` instantly. Remove chip → Headroom returns to 5 (no blue, value reverts).

Steps:
1. Drag a CW 10.5in Cutter Plate Assembly chip onto the Open WO 50012 row (case1).
2. Observe Headroom column on 50012: value changes to 4, rendered in bright blue.
3. Click the × on the draft chip to remove it.
4. Observe: Headroom column returns to 5, blue coloring disappears.

---

**Bonus — Non-actionable hidden (PB-M Lower Column 2.0)**

- **Part Number:** 52-31-0-00
- **Part Name:** PB-M Lower Column 2.0
- Scroll to the bottom of the Batching view. The PB-M Lower Column 2.0 row should appear with an amber Activity icon (⚡) on the Part # cell, indicating it has Open work.
- Its sole Open row (WO 50009, case2, headroom 0) is hidden by the implicit filter — no de-emphasized row appears beneath it.
- The candidate chip is draggable (it is a non-singleton because of the Open work), but no eligible case1 Open row exists to receive it.

---

### Deferred items

- **Case 2/3 full UX:** Inline coverage messages, Case 3 confirmation prompt when a planner does try to drop.
- **Headroom negative state:** If a planner drags more chips than headroom allows (headroom goes negative), the mockup shows a negative number in blue. No blocking or warning UX — deferred.
- **Auto-Batch WIP tier — heuristic documented but not enforced in UI:** The heuristic rule (case1 only, latest dueDate, lowest ID tiebreak) is implemented in `autoBatchCandidates`. No UI hint tells the planner which Open row was selected or why. A "WIP assigned to: [row]" confirmation would help — deferred.

### Known issues for next iteration

*(No carry-over known issues. Part # wrap, Due Date wrap, Completed column off-edge, and out-of-bounds activeStepIndex were all addressed in the Phase 2 column restructure session above.)*

---

## Session: Batching Lens — Phase 2 Complete (2026-06-18)

### Commits in this session

1. `feat(mockup): synthesize Open Production Rows and Cases 2/3 flag data`
2. `feat(mockup): render Open rows with chips and de-emphasized styling`
3. `feat(mockup): generalize chip immobility for Open chips and extend root WO rule`
4. `feat(mockup): wire Quantity Rules Case 1 — drag candidate onto Open row`
5. `feat(mockup): refine view-mode behavior for Open rows (QP visibility derived)`
6. `feat(mockup): extend Confirm Draft scope to Open rows with draft additions`
7. `feat(mockup): replace Auto-Batch with three-tier dropdown`
8. `feat(mockup): add Show Only Actionable Production Rows filter`
9. `feat(mockup): add Active in Production indicator on Part Number cells`
10. `docs(mockup): MOCKUP_TRACK entry for Phase 2 completion`

### Phase 2 scope

Phase 2 introduced Active Production Rows (Open WOs and Open batches) as visible context and drop targets. Key behaviors:

- **Open row rendering:** De-emphasized rows (`bg-muted/5 text-muted-foreground/70`) with crescent-style Open chips (border-l-4 left-bar styling, project color for standalone WOs, neutral border for batches). Static — not draggable.
- **Quantity Rules Case 1:** Drag candidate onto Open row → chip joins cell, Demand + Priority + Due Date auto-update in bright blue. Case 2/3 drops blocked (row greyed during drag, `isEligibleOpenTarget` returns false).
- **View mode — QP:** Open rows visible in QP only if they received draft chip additions. Dynamic — appears/disappears as chips are added/removed via `openRowsVisibleInQP` derived set.
- **Confirm Draft:** Extended to atomically include candidate WOs targeted at Open rows. Toast surfaces "M Open rows extended." and tooltip details scope.
- **Three-tier Auto-Batch:** "Only Candidates" (Phase 1 behavior), "Include Unstarted WIP" (Phase 2, places singleton candidates onto matching Case 1 Open rows by partId), "Include Started WIP" (disabled, Phase 2.5).
- **Show Only Actionable filter:** Toggle on filter bar. Hides Case 2 Open rows with insufficient `mockHeadroom` (≤ 0). Case 1 always actionable; Case 3 always shown for context.
- **Active in Production indicator:** Amber `Activity` icon on Part Number cells for PartIDs with any Open work (Open WO or Open Batch). Appears on candidate rows AND Open rows for the same partId.
- **Orphan Open rows section:** Open rows for partIds with no visible candidate rows in the current view/filter render in a separate "Open Production Only" section below candidates.

### Data synthesized

- `OPEN_WOS`: 15 standalone Open WOs (IDs 50001–50015) across partIds 1908, 1922, 1929, 1942, 1948, 1951, 1954, 1967, 2035, 2063, 2066, 2219. Mix of case1 (10), case2 (3, headroom 0–3), case3 (2).
- `OPEN_BATCHES`: 6 Open batches (IDs 60001–60006) for partIds 1942, 1948, 1951, 1954, 2063, 2066. Mix of case1 (3), case2 (2), case3 (1).
- `openRowChips` added to `BtSessionState` — tracks draft candidate additions to Open rows.
- `showOnlyActionable` and `autoBatchTier` added to `BtSessionState`.

### Deferred items

- **Cases 2 and 3 full UX:** Inline coverage messages, Case 3 confirmation prompt. Deferred pending execution lens mockups when real step-state data exists.
- **Auto-Batch: Include Started WIP:** Disabled. Requires Case 2/3 selection logic and execution data (Phase 2.5).
- **Definition Change Flags:** Not in Phase 2 scope.
- **`mockProductionState` and `mockHeadroom`:** Mockup-only flags; derived from real step-state in Rev 1 implementation.

---

## Session: Batching Lens — Visual Polish Pass (Phase 1 complete)
**Date:** 2026-06-18
**Surface:** `/app/mockups/batching/`, `/app/mockups/_shared/project-chip.tsx`, `/app/mockups/project-creation/_components/project-list.tsx`, `/app/mockups/vendors/_components/vendor-grid.tsx`, `/components/ui/badge.tsx`
**Status:** Phase 1 complete

### Pill shape — cross-surface rounded rectangle
Changed all pill-shaped text labels from oval (`rounded-full` / `rounded-4xl`) to rounded-rectangle (`rounded-md`). Scope:

- `ProjectChip` (batching composition chips) and its `DragOverlay` clone
- shadcn `Badge` component (`rounded-4xl` → `rounded-md`), propagating to all status badges (Draft/Active/Pass/issues) across the tool
- Project Creation status filter chips and customer filter chips
- Vendors open-supply-order count badge

**Not changed** (intentionally circular): active indicator dots (`h-2 w-2`), toggle thumb/track, color swatches, step-number circles, progress bars, column-filter radio controls. `ProjectIdPill` was already `rounded` — no change needed. Routing step pills were already `rounded` — no change needed.

Verified at 3× zoom: filter chips in Project Creation read as clearly rectangular, not oval.

### Dividing line contrast
Two-tier hierarchy established in the Batching candidate table:
- PartID group boundary: `border-t-2 border-border` (was `border-t-2 border-muted-foreground/20` — far too faint)
- WO-to-WO within group: `border-t border-border/50` (was `border-t border-border/40`)

Planners can now clearly distinguish group boundaries from intra-group row separators.

### Routing column width
Step pill container changed from `flex-wrap` to `flex-nowrap`. Routing column width widened from 190px to 260px. Typical 3–5 step routings now render inline on one row at normal compact height.

### Lock toggle position
Lock toggle moved from rightmost column to immediately after the select checkbox (column 2). Both user-action affordances now group on the left; all data columns are to the right. Column count stays at 11.

### Phase 1 visual polish status
Phase 1 mockup visual polish is now complete. The deferred items (pill shape, dividing lines) from the prior session have been addressed.

---

## Session: Batching Lens — Alignment, Anchor Escalation, Parent Column Removal
**Date:** 2026-06-18
**Surface:** `/app/mockups/batching/`, `/app/mockups/_shared/project-chip.tsx`
**Status:** Phase 1 active (mid-phase)

### Chip wrap fix
The anchored root chip was wrapping "Qty: N" onto a second line when the anchor
icon was present. Fixed by adding `whitespace-nowrap` to the chip's outer div.
The icon was also moved from the right side to the left side of the text, which
reads more naturally (icon → identifier → quantity).

### Anchor icon escalation
Previous iteration landed at `strokeWidth={2.5}`. At chip size (≈24px tall) that
still read as thin. Escalated to `strokeWidth={3}` with size `h-3 w-3` (12px) and
`opacity-70`. At zoomed view the anchor icon is clearly bold and readable. Stopping
the escalation here — Pin or custom SVG not needed.

### Parent column → Part Number hover
Removed the Parent column entirely. Ancestry data (closest ancestor first, top-level
last, format `Part Number — Part Name` per line) moves to a native `title` tooltip on
the Part Number cell. For top-level WOs (no parent), no tooltip — the cell renders as
plain text. This frees one full column of horizontal real estate.

The `parentPartName` and `ancestryPath` fields remain on `BtWorkOrder` — the tooltip
still consumes them.

### Column alignment
Applied conventional table alignment across all columns:
- **Right-aligned:** Demand, Planned, Priority, Due Date (numeric/temporal)
- **Left-aligned:** Part #, Part Name, Project(s) (text)
- **Centered:** Select checkbox, Lock toggle (narrow indicator/action)
- Headers match their respective cell alignment

### Column spacing
Uniform `px-4` horizontal padding applied to all columns (was `px-2`). Colgroup
widths redistributed: Part# 120px (up from 110), Part Name 180px (up from 160) to
absorb the freed space from the removed Parent column. Table reads as evenly
composed at desktop scale.

### Spec gaps / deferred items
None arising from this session. Pill shape (rounded vs oval) and dividing line
contrast remain deferred per prior session.

---

## Session: Batching Lens — Root WO Rule, Eligibility Fix, Visual Polish
**Date:** 2026-06-17
**Surface:** `/app/mockups/batching/`
**Status:** Phase 1 active (mid-phase)

### Root WO rule

Every candidate row has exactly one root WO — the WO whose home the row is.
The root WO chip is permanently anchored to its home row and cannot be dragged
away. Only guest chips (chips that have been moved to a host by Auto-Batch or
a prior manual move) are draggable.

**Why this matters:** without the root rule, users could drag the host chip out
of a row that already has guests, creating an ambiguous state where the host
identity moved but the row still existed. The root rule eliminates this class of
invalid state.

**Consequence — shell rows:** a row whose chip moved away is a "shell." Shell
rows accept only their own root returning home (Rule 1), never a different chip.
Shells display "Drafted → [topLevelRef]" as before.

**Practical workflow under the new rule:**

1. Initial load: all chips at home (roots). No chip is draggable yet.
2. "Auto-Batch Candidates" programmatically moves guest chips to hosts (bypasses
   eligibility — this is by design; Auto-Batch is the entry point).
3. After Auto-Batch, guest chips (those at a non-home host) have `cursor-grab`
   and can be dragged to other valid hosts or back home.
4. Root chips (WO ID = host row ID) always have `cursor-default` — drag
   disabled via dnd-kit's `disabled` option.

### Eligibility re-derive (bug fix)

`isEligibleTarget` rewritten from first principles. The unified rule:

1. **Rule 1:** chip can always return to its own home row
   (`targetHostWoId === dragWoId` → true).
2. **Root immobility:** chip currently at home (`currentHost === dragWoId`)
   → false for all non-home targets.
3. **Shell exclusion:** target row with root chip absent
   (`chipHome[target] !== target`) → false; only Rule 1 can override this.
4. **PartID match:** target must share the drag chip's PartID.

The prior code had a `if (currentHost === targetHostWoId) return true` shortcut
before PartID validation. This allowed dropping a chip on its current host
(trivially true), but caused incorrect de-emphasis of same-PartID home rows
in default state by conflating the home-row path with peer-row eligibility.

### Root WO visual marker

Root chips display a small `Anchor` icon (h-2.5 w-2.5, opacity-50, `aria-hidden`)
inset at the right end of the chip (inline with `/ Qty: N`). Chip tooltip adds
"(root — anchored)" suffix for root chips. No color or shadow change — the icon
is sufficient visual signal at the chip scale.

Verified: host rows show exactly 1 anchor SVG in the composition cell; shell
rows and guest chips show 0.

### Column changes

- **WO ID column removed.** Replaced by **Parent column** (immediate parent's
  part number). Top-level project line-item WOs show "—". Hover tooltip shows
  the full ancestry path (part numbers from top-level to parent, "›"-separated).
- **Parent data added to `BtWorkOrder`:** `parentPartNumber: string | null` and
  `ancestryPath: string[]`, threaded through the recursive `buildBtWOs` BOM walk.

### ProjectChip: flattened to single-line

Layout changed from `flex-col py-1` (stacked) to `flex-row items-center gap-1 py-0.5`
(inline). Content: `topLevelRef / Qty: N [⚓?]` on one line. Significant row
height reduction; more rows visible per viewport. DragOverlay overlay also
updated to the inline layout.

### Filter and label cleanup

- **Part/Assembly filter removed** from filter bar. `filterPartType` state and
  all usages deleted. Parts and Assemblies remain mixed in the table.
- **"Hidden Singletons" → "Unbatchable Parts"** everywhere: toggle aria-label,
  toggle visible label, count bar text, table section header, variable count
  references.
- **"Pri" → "Priority"** column header spelled out in full.

### Column spacing condensed

`colgroup` widths recalibrated to absorb the Parent column without overflow:
checkbox 36→32, composition 150→140, parent 90 (new), part# 120→110, part name
180→160, demand 70→60, planned 90→80, priority 60→64, due date 100→92,
project(s) 100→90, routing 200→190, lock 60→48.

### Spec gaps / deferred items

- **Pill shape (rectangle with rounded corners):** deferred. Evaluate flattened
  single-line pill first before committing to shape change.
- **Dividing line contrast:** deferred alongside pill shape. Both will land as
  one "visual polish" follow-up iteration.

### Prior behavior note

Root chip immobility means **initial state drag is non-functional.** The
intended workflow is: use Auto-Batch first to form draft batches, then drag
guest chips to adjust. Click-to-select (selectedChipWoId) also requires Auto-
Batch first, as it uses the same eligibility gate. This is a deliberate design
constraint from the root WO rule, not an oversight.

### Verified behaviors (Playwright)

- Initial state: Batching view, unlocked rows, chips single-line with anchor
  icon on root chips ✓
- Auto-Batch: forms draft batches; host rows show root chip (`cursor-default`)
  + guest chip(s) (`cursor-grab opacity-90`) ✓
- Root chip has `cursor-default`, guest chip has `cursor-grab` — confirmed by
  class inspection of a multi-chip cell ✓
- Anchor SVG count in composition cell: host rows = 1, shell rows = 0 ✓
- Parent column shows parent part numbers; "—" for top-level WOs ✓
- Priority column header fully spelled out ✓
- "Show Unbatchable Parts" toggle label ✓
- No hydration errors after colgroup whitespace fix ✓

---

## Session: Batching Lens — Lock State Architecture + View Modes + Multi-Select
**Date:** 2026-06-17
**Surface:** `/app/mockups/batching/`
**Status:** Phase 1 active (mid-phase)

### Architectural change: Lock state replaces Confirm toggle

The Confirm Toggle model (ON/OFF per row, gating commit) conflated two
distinct planner workflows: composition decisions and quantity planning.
This session replaces it entirely with a **Lock state** per row plus
**View Modes** that surface each workflow independently.

**Prior Confirm toggle pattern is superseded.** The Phase 1 session log below
referenced a Confirm Toggle with default-ON state. Disregard that model —
it no longer exists in the codebase.

### State model

`BtSessionState.confirmToggles` removed. Replaced by:
- `lockedWoIds: Set<number>` — which rows are locked
- `plannedQty[hostWoId]` — now only meaningful for locked rows (null = unlocked row)

**Default lock states on page load:**
- Singletons → **Locked** (chips at home, no composition decision needed)
- Multi-WO candidates → **Unlocked** (composition decision pending)

`computeDefaultLockState(wos)` computes initial and reset lock state from the
WO list. Called at `buildInitialSessionState` and `resetDraft`.

**Lock toggle disabled** when `chipHome[woId] !== woId` (source row — chip
donated elsewhere). Source rows commit as part of their host's batch.

**Lock immobility** enforced in `isEligibleTarget`:
- Cannot drag OUT of a locked row (chip's current host is locked)
- Cannot drag INTO a locked row (target is locked)

### View modes

Three-way segmented control (Batching | Qty Planning | All) added to the
filter bar. View mode composes with all existing filters.

- **Batching**: shows unlocked rows only. Composition workspace.
- **Qty Planning (QP)**: shows locked rows only. Quantity planning workspace.
- **All**: shows all rows.

Default view on load: **Batching**.

Selection clears on view switch.

### Planned Qty column behavior change

Previously: shown as editable for all Part-type rows.

Now:
- **Locked rows**: editable input, default value = current demand total.
  Bright blue when > demand (new signal meaning, analogous to composition signal).
- **Unlocked rows**: shows "—" (no value).

When locking a row (via toggle or multi-select), `plannedQty[hostWoId]` is
set to the row's current demand. When unlocking, `plannedQty[hostWoId]` is
deleted (loses edits — matches spec).

### Workspace-level button behavior changes

**Confirm Draft (N):**
- N = sum of chip counts in **visible locked host rows** only.
- Disabled in Batching view (no locked rows visible). Tooltip explains.
- Enabled in QP and All views when visible locked rows exist.
- `confirmDraft()` now accepts `visibleLockedHostWoIds: Set<number>` from the UI.

**Auto-Batch Candidates:**
- Disabled in QP view (no unlocked rows to batch). Tooltip explains.
- Skips locked rows entirely (lock immobility respected in auto-batcher).

**Reset Draft:**
- Now opens a confirmation modal before executing.
- Modal text: "Reset Draft will return all chips to their home rows, restore
  default lock states (singletons locked, batch candidates unlocked), and
  clear all Planned Quantity edits. This cannot be undone."
- Cancel (default focus) and Reset (destructive styling) buttons.
- On Reset: chips home, lock states restored to defaults via
  `computeDefaultLockState`, planned qty edits cleared.
- Enabled when any chip is not at home OR any planned qty edited above demand.

### New UI: per-row selection + multi-select toolbar

Leftmost narrow column added with per-row checkboxes. Header checkbox
selects/deselects all visible rows. Selection state is `Set<number>` in
component state. Clears on view switch.

**Multi-select toolbar** — floating sticky bar at page bottom, visible when
1+ rows selected. View-scoped actions:

| View | Actions |
|------|---------|
| Batching | Lock selected, Clear |
| Qty Planning | Unlock selected, Reset Planned to Demand, ×N Apply, +N Apply, Clear |
| All | All above (silently skips inapplicable rows) |

Toast confirms each action with count. `lockMultiple`, `unlockMultiple`,
`resetPlannedToDemand`, `multiplyPlannedQty`, `addToPlannedQty` functions
added to `_data.ts`.

### Empty states

View-specific messages distinguish "items exist in other state-axis" from
"no items at all":

| View | Items in other state | No items |
|------|----------------------|----------|
| Batching | "All candidates are locked. Switch to Quantity Planning…" | "No candidates yet." |
| Qty Planning | "No locked rows yet. Lock candidates in Batching view to plan quantities." | "No candidates yet." |
| All | "No candidates match the current filters." | "No candidates yet." |

### Spec gaps logged

No new spec gaps beyond existing BT-GAP-01 through BT-GAP-04. The Lock
state model is a deliberate design change (supersedes the Confirm toggle
which was the prior gap area). The view mode design is new and has no
direct spec counterpart — it should be added to `spec/batching_lens_spec.md`
before implementation work begins on the Batching Lens.

### Verified behaviors (Playwright)

- Initial load: Batching view default, multi-WO candidates unlocked and visible,
  singletons hidden, Confirm Draft (0) disabled, Auto-Batch enabled ✓
- QP view (empty): "No locked rows yet. Lock candidates in Batching view to
  plan quantities." empty state ✓
- Manual lock in Batching: row disappears from Batching, appears in QP ✓
- Planned Qty: unlocked rows show "—", locked row shows editable input at demand ✓
- Planned Qty bright blue when edited above demand ✓
- Reset Draft modal: opens on click, Cancel dismisses, Reset executes with toast ✓
- Multi-select toolbar: appears on row checkbox, shows QP actions in QP view ✓
- Auto-Batch in Batching view: batches 101 candidates into 49 draft batches,
  demand aggregates in bright blue, source rows show "Drafted →", toast confirms ✓
- Auto-Batch disabled tooltip in QP view ✓
- Confirm Draft (0) disabled in Batching view ✓

### Screenshots captured

- `batching-01-initial.png` — initial Batching view load
- `batching-02-qp-empty.png` — QP view empty state
- `batching-04-qp-with-locked-row.png` — locked row in QP view with Planned Qty
- `batching-05-planned-qty-blue.png` — Planned Qty input at 5 (> demand 1, bright blue)
- `batching-07-reset-modal.png` — Reset Draft confirmation modal
- `batching-08-multiselect-toolbar.png` — multi-select toolbar in QP view
- `batching-09-auto-batch.png` — post-auto-batch Batching view with draft batches

---

## Session: Batching Lens — Auto-Batch + Data Fix
**Date:** 2026-06-14
**Surface:** `/app/mockups/batching/`
**Status:** Phase 1 active

### Data correctness fix (routing template model)

The original Phase 1 build synthesized routing template assignments so that
some partIds had *different* templates across projects — e.g., partId 1942
got `tmpl_mill` from project 10121 and `tmpl_lathe` from project 10412.
This was structurally invalid: by spec definition, a partId has exactly one
routing template. The mismatch was a demo artifact, not a real data shape.

**Fix:** Routing templates are now assigned purely by `defaultTemplateId(partType, partId)`,
giving every partId a single consistent template regardless of which project the WO
belongs to. The eligibility check in `isEligibleTarget` no longer compares routing
templates — partId match alone is the eligibility criterion, which is the operationally
meaningful rule.

The three mock templates (`tmpl_mill`, `tmpl_lathe`, `tmpl_assembly`) remain; different
partIds still use different templates, which is correct. The ineligibility grey-out still
fires — it just reflects partId mismatch only, not the synthetic template-mismatch demo.

**Implementation handoff note:** The Phase 1 session log below referenced "routing template
mismatch demo" as a Phase 1 feature. Disregard that framing — the correct model is
partId-based eligibility only.

### New actions: Auto-Batch Candidates + Reset Draft

**Auto-Batch Candidates button** — single click combines all eligible visible candidates
into draft batches by partId. One draft batch per partId group with 2+ eligible members;
singletons stay home. Host row = lowest WO ID in the group (deterministic). Chips that
are manually placed on Open Production Rows are excluded from the reshuffle (Phase 2
forward-compatibility; in Phase 1 no Open rows exist so this branch never fires but the
code path is correct). Auto-batched and manually created draft batches look identical —
no visual distinction.

**Reset Draft button** — returns all chips home unconditionally, including any placed on
Open rows. This is broader than auto-batch's exclusion: Reset Draft is "start over from
scratch," so it overrides all placements including operationally significant ones.

**Button enabled states:**
- Auto-Batch: enabled when `filteredNonSingletonGroups` has any group with 2+ visible members
- Reset Draft: enabled when any chip is not at home

**Phase 2 forward-compatibility:**  `autoBatchCandidates` accepts an `openRowHostWoIds: Set<number>`
parameter. In Phase 1 the caller passes an empty set. When Open rows arrive in Phase 2,
populate this set with their host WO IDs and the exclusion logic works automatically.

---

## Session: Batching Lens Phase 1 Mockup
**Date:** 2026-06-14
**Surface:** `/app/mockups/batching/`
**Status:** Superseded by session above

### What was built

Full Phase 1 candidate-only workspace for the Batching Lens mockup:

- **Chip-based composition model** — each candidate WO has a home chip in its own Composition Column cell. Chips are draggable via @dnd-kit (already installed; no new dependency added) with a 5px PointerSensor activation constraint and DragOverlay. Click-to-select keyboard fallback also implemented: click a chip to select it (sky-blue ring + count bar indicator), then click any highlighted eligible cell to place.
- **Draft batch state** — 2+ chips composited in one cell → demand sums, priority takes MAX, due date takes MIN. Changed values render in signal-blue `#0EA5E9`. The hosting row's cell shows all chips stacked.
- **Aggressive grey-out** during drag — rows ineligible for the dragged chip drop to 30% opacity and are pointer-events-none.
- **Sky-blue highlight** on eligible drop targets during click-to-select mode.
- **Confirm Toggle** per row (default ON; deactivates when home chip has moved away).
- **Confirm Draft** atomically confirms all toggled-ON rows, displaying a toast: "Confirmed N WOs (X draft batches, Y standalone). Open in execution lenses."
- **Hidden Singletons** — partIDs with exactly 1 candidate WO are hidden by default behind "Show Hidden Singletons" toggle button.
- **Routing template mismatch demo** — first 3 multi-project Part-type partIds get split across `tmpl_mill` and `tmpl_lathe`, making inter-row drag ineligible. Remaining shared partIds use consistent templates and are draggable to each other.
- **Filters** — project select, Part/Assembly toggle group, part# / name search.

**New files:**
- `app/mockups/batching/_data.ts` — BOM walk, WO generation, session state logic
- `app/mockups/batching/page.tsx` — full page component with DnD, click-to-select, and all interactions
- `app/mockups/_shared/project-chip.tsx` — `ProjectChip` (draggable) and `ProjectChipOverlay` (DragOverlay clone)

### Design decisions made

1. **`ProjectChip` is distinct from `ProjectIdPill`** — different lifecycle (draggable, confirmed state), different layout (two-line pill with topLevelRef + Qty), different role. Created as `_shared/project-chip.tsx`, not extending the existing pill.
2. **Click-to-select eligibility highlight is sky-blue** (`bg-sky-500/10 ring-sky-500/50`) — distinct from drag-hover emerald green. Differentiating the two interactions visually was important for clarity.
3. **Placement note text** in vacated cells reads "Drafted → {targetRef}" — a terse label that communicates where the chip went without needing a tooltip.
4. **Singleton detection is live** — recomputed from visible WOs after confirms. When the last partner WO in a pair is confirmed, the remaining WO becomes a singleton and migrates to the hidden row automatically.
5. **Assembly rows** get `bg-muted/30` background tint and hide the Planned Qty column (shows "—") since assemblies use demand-based qty.

### Spec gaps logged

1. **BT-GAP-01: Confirm Toggle inactive UX** — spec says toggle is "inactive" when home chip moves away, but doesn't specify whether inactive = hidden, disabled, or visually greyed. Implemented as: toggle button hidden (no-op column) with the visual indicator showing "chip moved" state instead. Implementation track should clarify.
2. **BT-GAP-02: Click-to-select scope** — spec describes the drag interaction in detail but only mentions click-to-select as a fallback without specifying: should ineligible rows be greyed-out during selection the same way they are during drag? Implemented: yes, greyed-out during selection is NOT done (only highlight on eligible cells). Could go either way.
3. **BT-GAP-03: Planned Qty field initialization** — spec says Planned Qty defaults to Demand but doesn't say whether the field is pre-filled or shown as placeholder. Implemented: placeholder = demand value, field is empty until user types.
4. **BT-GAP-04: Draft batch confirmation granularity** — spec says "Confirm Draft" is atomic across all toggled-ON rows. No guidance on partial failure (e.g., if a row's WO transitions to a non-Unreleased state mid-session). Not relevant for mockup but implementation track needs to handle.

### Verified behaviors

- Page load: 101 visible candidate rows (non-singleton multi-WO groups)
- Show Hidden Singletons: exposes 202 singleton WOs
- Chip placement via click-to-select: chip moves to target cell, demand aggregates in blue, "Drafted →" note appears in source cell
- Confirm Draft: "Confirmed 303 WOs (1 draft batch, 301 standalone). Open in execution lenses." toast; workspace shows "All candidates confirmed."
- Routing template mismatch: first-3 mismatched groups only highlight home cell when selected (ineligible inter-row placement correctly blocked)

### Screenshots

- `batching-01-initial.png` — initial loaded state
- `batching-02-draft-batch-blue.png` — draft batch with blue demand value
- `batching-03-confirm-toast.png` — confirmation toast and empty workspace

---

## 2026-06-13 — Stock Fulfillment View — Surface Lock

**Surfaces touched:** /app/mockups/stock-fulfillment/ — documentation and lock pass

**Mockup commits:** no code changes this session (all code landed in iteration passes)

### Scope

This session produces the implementation handoff documentation for the Stock
Fulfillment View. The surface iterated across three passes before reaching
this lock; the committed code reflects all three passes.

**Iteration arc at a glance:**

*Initial build* — core view structure: Project Header strip with Candidates /
Pending Release counts and per-project Release button; Global Release button;
candidate table with Fulfill / Pass Through / Reconcile Stock actions; set
semantics (`computeProjectStats`, `computeCandidates`); Assembly cascade;
auto-pass-through; inline expansion for cross-project competition; BOM DFS
pre-order as default sort.

*Iteration Pass 2 (commit `7509097`)* — corrected `pendingReleaseCount` to
`unreleasedCount - candidateCount`; removed project-color row tinting (color
belongs only in `ProjectIdPill`); added Cumulative Demand column (candidates
only, amber when > stock); replaced "BOM Position" with "Parent" column
(immediate parent `partNumber`, hover for full ancestry); expansion rows
filtered to candidates only; active header filter ring; per-project Release
button label simplified to "Release Project [Number]" with no embedded count.

*Iteration Pass 3 (commits `81cc63e`, `73a1575`, `e8d55ff`)* — Location
column (sourced from `inventoryLocation`); Location as 4th sort key within
BOM sibling groups (`locationSortedProject()` DFS traversal); Competing-only
toggle replacing the summary text; toggle composes with project filter via AND;
Global Release scopes to project filter; per-project Release ignores toggle;
Playwright verification results filled in.

### Surface status

**Locked for implementation.** Handoff document:
`mockup_track/stock_fulfillment_handoff.md`.

### Spec gaps

All identified spec gaps — including every gap surfaced across the three
iteration passes — are captured in the handoff doc. They are not duplicated
here.

---

## 2026-06-13 — Stock Fulfillment View — Iteration Pass 3

**Surfaces touched:** /app/mockups/stock-fulfillment/ — third iteration pass
adding Location-based sibling sort and Competing-only toggle filter.

**Mockup commits:**
- `81cc63e` — feat(mockup): add Location as fourth sort key within BOM sibling groups
- `73a1575` — feat(mockup): replace candidate summary with Competing-only filter toggle
- `e8d55ff` — docs: fill in Playwright verification results for SF iter 3

### Scope

Two changes supporting the planner's physical pull workflow:

1. **Location sort as 4th sort key** — within BOM sibling groups (same `parentWoId`),
   candidates now sort by `inventoryLocation` ascending (nulls last), then `bomOrder`
   for stability. Top-level WOs (`.01`, `.02`, …) keep their reference `bomOrder`
   sequence. The sort is tree-aware: `locationSortedProject()` in `_data.ts` performs
   a DFS traversal per project with location-based sibling ordering rather than a
   flat comparator. Handles both candidate-parent and orphan-root cases (where the
   Assembly parent has no stock and isn't a candidate itself).
   Plain string sort used per spec direction; natural sort deferred unless real bin
   codes expose ordering problems.

2. **Competing-only toggle** — replaces the "N candidates across M projects" summary
   text. When on, candidate rows filter to only WOs where cumulative demand > stock
   (the amber rows). Composes with project filter via AND. Empty state shows
   "No competing candidates. Toggle off to see all rows." when no amber rows exist
   in scope. Per-project Release button is unaffected by the toggle (project-level
   affordance, not list-filtered). Global Release scopes to the current project
   filter only (toggle doesn't change release scope — toggle filters the candidates
   view, not the Pending Release set).

### Spec gaps logged here (not in spec/stock_fulfillment_view_spec.md)

- **Location sort**: The spec (`spec/stock_fulfillment_view_spec.md`) is silent on
  sort order within sibling groups. The `bomOrder` DFS traversal was the prior
  implicit sort. Location-within-siblings is a mockup addition — should be validated
  with real bin code data before implementation locks this behavior.

- **Competing-only filter**: Not in spec. The spec describes the candidate list and
  filtering by project, but has no toggle for competing/amber-only rows. This is a
  UX addition surfaced from the two-phase cognitive workflow described in the prompt.
  Needs spec review and formal addition before implementation.

- **Per-project Release vs. toggle**: The decision that per-project Release ignores
  the Competing-only toggle (releases the full project's Pending Release set) is a
  mockup-level judgment call. The spec does not address this interaction; it should
  be made explicit in the spec before implementation.

### Verification results (Playwright)

All key assertions passed:
- Toggle visible in toolbar, summary text gone ✓
- Toggle off (default): all candidates shown ✓
- Toggle on (all projects): only amber rows visible — 8 rows across 4 projects ✓
- Toggle on + project filter 10030 (AND composition): 3 amber rows for 10030 only ✓
- Per-project Release with toggle on: released 98 WOs (full Pending Release set, not scoped to toggle), button disabled, candidates intact ✓
- Fulfill competing row: auto-passes duplicate competitor across project; candidate count decrements correctly ✓
- Empty state: after fulfilling all competing rows in 10030 scope, "No competing candidates. Toggle off to see all rows." renders ✓
- Cross-project auto-pass: fulfilling 10030's Photo Eye Cable Assembly auto-passed 10489's (stock depleted) ✓

---

## 2026-06-13 — Stock Fulfillment View — Iteration Pass 2

**Surfaces touched:** /app/mockups/stock-fulfillment/ — second iteration pass
addressing six reviewer findings.

**Mockup commits:**
- `7509097` — fix+feat: all six items combined (see breakdown below)

### Scope

Six findings addressed in this session:

1. **Candidates/Pending Release set semantics** — `pendingReleaseCount` was
   previously `reviewedAt !== null` (decided WOs only). Corrected to
   `unreleasedCount - candidateCount` so the invariant
   `Candidates + Pending Release = total Unreleased` holds continuously.
   `releaseProject` and `releaseAll` now exclude candidate WOs so candidates
   persist in the view while Pending Release WOs release to Open.
   Project headers now disappear when `unreleasedCount = 0` (not just when
   candidates = 0). Per-Project Release button simplified to
   "Release Project [Number]", disabled when `pendingReleaseCount = 0`.
   Global button: "Release All Pending (N)".

2. **Row shading** — removed `style={{ backgroundColor: colorMeta.tintRgba }}`
   from candidate table rows. Project color renders only in `ProjectIdPill`.
   Assembly rows get `bg-muted/10`, Part rows no background.

3. **Cumulative Demand column** — added between Stock and Due Date. Value is
   sum of `quantity` across candidate WOs only for the same `partId`. Renders
   in `text-amber-500` when cumulative > stock. Non-candidate demand excluded
   (goes to procurement regardless of planner decisions; adding noise without
   supporting action).

4. **Parent column** — replaced "BOM Position" with "Parent". Shows immediate
   parent assembly's `partNumber` (monospace). Top-level WOs render `—`.
   Hover tooltip shows full ancestry chain (closest ancestor first) using
   shadcn/ui `Tooltip`. All non-top-level WOs get the tooltip; the tooltip
   adds the part name even for single-ancestor cases.

5. **Expansion row cleanup** — now filters to candidates only via
   `getCompetingCandidates()`. Columns align with parent table (Project,
   Parent, Part Number, Part Name, Demand, Stock, Cumul. Demand, Due Date,
   Actions). Fulfill and Pass Through buttons on each expansion row; no
   Reconcile (stock reconciliation is a Part-level action covered by the
   parent row). Empty-state message when no other candidates exist.
   `getCompetingWos` renamed to `getCompetingCandidates` and now accepts the
   candidate list rather than full state.

6. **Active filter visual** — clicking a Project Header sets the project
   filter and shows a ring + "Filtered" label on that header. Clicking again
   clears it.

### Spec gaps / notes for implementation handoff

- **BOM Position → Parent**: The spec still says "BOM Position" column. This
  was a spec wording issue — the actionable info is the immediate parent, with
  deeper context via hover. The spec should be updated before real
  implementation references it.

- **Stale-state capture in handlers** (fixed in this pass for `handlePassThrough`
  via functional setState; `handleFulfill` and `handleReconcileConfirm` use
  derived values from the pre-action state which is acceptable since those
  handlers don't chain). Mockup-level issue; real implementation uses server
  actions so this pattern doesn't apply.

- **Header active-filter UX**: Clicking a header filters to that project AND
  the dropdown select stays at "All Projects" (not synced). If the user
  clears filter via the header (click again), the select returns to "All
  Projects" automatically. This is fine for a mockup but the real
  implementation should use a single filter state source.

### Verification results (Playwright)

All key assertions passed:
- Invariant holds on load: C+P=U for all 4 projects ✓
- No project-color inline style on candidate rows (tintedCount=0) ✓
- Top-level WOs show `—` in Parent column ✓
- Amber fires correctly: Tailstock Brake Assembly cumDemand=2 > stock=1 ✓
- Expansion: only competing candidate (10412) shown, 2 buttons, no Reconcile ✓
- Fulfill from expansion triggers auto-pass-through on 10121 Tailstock ✓
- Pass Through: C-1, P+1, invariant maintained ✓
- Per-Project Release: pending→0, button disabled, candidates unchanged ✓
- Active filter: ring styling, "Filtered" label, header/rows scoped ✓

---

## 2026-06-11 — Project Creation View — Surface Lock

**Surfaces touched:** /app/mockups/project-creation/ — final iteration pass before
implementation handoff.

**Mockup commits:**
- `bdb58d3` — fix: auto-focus Project Number on new Draft using projectName guard
- `3768835` — feat: retune Project Color palette to 13-color full-spectrum set
- `7324b74` — refactor: replace Project Color row tint with Project ID pill treatment

### Scope

Three focused changes completing the Project Creation surface:

1. **Project Number auto-focus** — new Drafts auto-focus the Project Number
   field on load. Guard added to prevent the focus from firing on existing
   Drafts with a projectName already set (guard: `!project.projectName`).

2. **Palette retune** — the 11-color palette from the prior session was
   replaced with a 13-color full-spectrum set. Added: Red, Yellow, Green,
   Light Green. Removed: Teal, Cyan, Indigo, Violet, Magenta, Electric Blue.
   Rationale: the prior palette excluded the warm half of the spectrum; the
   new palette covers the full hue wheel with better visual distinctness.
   Updated seeded color assignments: 17559→orange, 10256→blue, 10236→null,
   10121→green, 10030→brown.

3. **ProjectIdPill migration** — row tint + breadcrumb chip replaced with a
   unified `ProjectIdPill` component. The pill renders the Project Number
   as a solid-color pill when color is set, or as plain monospace text when
   color is null. Applied wherever Project Number is rendered: Project List
   rows, Draft Editor breadcrumb, Active Summary header. This is a reusable
   cross-surface UI primitive — its location at
   `_components/project-id-pill.tsx` is mockup-local; the implementation
   track should move it to the shared component directory.

### Surface status

**Locked for implementation.** The Project Creation View mockup is complete.
Handoff document: `mockup_track/project_creation_handoff.md`.

### Spec gaps

Project Color and the `ProjectIdPill` pattern are not in
`project_creation_view_spec.md`. A full list of gaps and what the
implementation track needs to backfill is captured in the handoff doc.

---

## 2026-06-10 — Project Creation View — Iteration Pass

**Surfaces touched:** /app/mockups/project-creation/ — iteration on all three
surfaces from the prior session.

**Mockup commits:**
- `7720780` — fix: delete icon contrast on Project List and Draft Editor rows
- `554f666` — feat: Add New Project wiring (session store + empty Draft state)
- `ccf5199` — feat: Project Color attribute with curated palette picker

### Scope

Four focused changes:

1. **Delete icon contrast** — raised resting opacity from `/40` to `/70` on
   Trash2 row actions in Project List and Draft Editor top-level items table.
   `/40` on a near-black background fails WCAG AA for icon controls (3:1
   minimum); `/70` passes. Hover retains `text-destructive` for maximum
   contrast.

2. **Add New Project wiring** — module-level session store added to `_data.ts`
   (`getSessionProjects` / `setSessionProjects` / `createNewProject`).
   Module scope persists across Next.js SPA navigations, so list page and
   detail page share project state without Zustand. New project IDs are
   synthesized monotonically starting at projectId=6 / projectNumber=17560.
   Empty Draft state in the editor: auto-focus on Project Number, always-
   visible validation banner (neutral empty-state message when no items),
   BOM Tree Preview section always renders (empty-state placeholder when
   no items). Project Number uniqueness validation on blur against all
   projects in the session store.

3. **Project Color** — see design decisions below.

4. **Persistent issue-resolution helper** — identified as a cross-surface
   pattern held for Rev 1.5+. Documented in `DEFERRED.md` (newly created).
   Not built in this pass.

### Design decisions made

**1. Session store via module scope (not Zustand / URL params)**

The mockup's prior architecture used isolated useState on each page, seeded
from INITIAL_PROJECTS. This worked for the five seeded projects (which never
change) but broke for new projects (created on list page, not visible on
detail page).

Decision: add a module-level `_sessionProjects` variable in `_data.ts`.
Module scope persists across client-side navigations in a Next.js SPA session.
Both page.tsx files initialize from `getSessionProjects()` and detail page
syncs back via `setSessionProjects()` in `updateProject()` and `onDeleteDraft()`.

The sync happens imperatively inside state updater functions (acceptable
side-effect pattern for a mockup). In production, this would be Zustand,
React Query, or a proper store. Module-scope state is a mockup-track shortcut
with a clear comment noting the real-world replacement.

**2. ID synthesis starting at 17560**

New projects created within the session get numeric IDs starting at 17560
(one above the highest seeded projectNumber). IDs are monotonically
incrementing per session. The code has an explicit comment that this is
mock-only; real implementation uses database auto-increment.

**3. Project Color — palette choices**

The palette excludes green, amber, and red ranges (reserved for status
indicators: active/pass/complete, warning/draft, error/fail respectively).
Also excludes rose/crimson (could read as status-red).

Final 11-color palette:
- Blue (#3b82f6) — professional neutral
- Teal (#14b8a6) — blue-green, clearly not status
- Cyan (#06b6d4) — bright but blue, not green
- Indigo (#6366f1) — dark blue-purple
- Violet (#8b5cf6) — lighter purple
- Purple (#a855f7)
- Magenta (#d946ef) — fuchsia
- Pink (#ec4899) — clearly pink, not red
- Brown (#92400e) — dark warm, not status amber
- Slate (#64748b) — cool grey, higher opacity (15/28%) to ensure visibility
- Electric Blue (#38bdf8) — the "look at me" high-attention option

Seeded assignments: 17559→blue, 10256→violet, 10236→null (demonstrates
no-color), 10121→electric, 10030→teal.

**4. Color application: tints on list rows, chip in headers**

Row tints (12% opacity at rest, 22% on hover) applied via inline style.
Hover tracking via `hoveredRowId` state in project-list — needed because
Tailwind's `hover:bg-*` classes don't override inline `backgroundColor`.
Uncolored rows keep the original `hover:bg-muted/50` Tailwind class.

Chip in `[id]/page.tsx` breadcrumb chrome (2.5px circle) when color is set.
Color field in Draft Editor header grid (swatch trigger + dropdown picker).
Color field in Active Summary header — the only editable affordance this
pass; `onChange` prop threaded through from detail page.

**5. Active Summary's only editable affordance**

The read-only notice was updated to say "Project Color is editable" while
all other fields remain Phase 8. This makes the color picker the deliberate
exception — it doesn't change project operational data, so adding it to the
"read-only this pass" surface doesn't compromise the Phase 8 scope gate.

**6. Spec gap: Project Color is not in `project_creation_view_spec.md`**

The Color attribute was introduced in this mockup pass and has no spec
equivalent. Per mockup track convention, the spec is NOT edited in mockup
track sessions — the gap is recorded here, and the spec will be backfilled
separately by the user.

The attribute is conceptually optional metadata (like Notes) that doesn't
affect compilation, WO generation, or any lifecycle transitions. It is
purely a workspace-organization affordance for the planner.

**7. Persistent issue-resolution helper — explicitly held**

The user identified this cross-surface pattern during the iteration cycle:
three surfaces (Compile Failure Screen, Definition Change Flag inspection,
Deactivation blocker resolution) all present a bounded list of fixable issues,
each requiring navigation away from the list to resolve. Rev 1's solution is
"navigate away, fix, navigate back" — the list context is lost each time.

This is documented in `DEFERRED.md` with the problem statement, three
surfaces, and directional design thinking (pinnable overlay with detach-to-
window option). The design starting point for Rev 1.5+ is to derive the
common shape across all three surfaces before building anything.

### Recommendations for implementation

- **Session store pattern** — module scope works for a mockup but is not
  the implementation recommendation. Use Zustand, React Query, or server-
  state (RSC + Server Actions) for cross-page state in production.
- **Project Color** — optional field on Project record. If persisted to
  the database, a simple `color: varchar(20)` column with the union of
  color names as a CHECK constraint. The hex/tint values belong in the
  frontend color map (not the database). The palette can be tuned or
  extended without a migration.
- **Row tinting** — the 12/22% opacity values work on the current dark
  theme. On a light theme, these percentages would likely need to be higher
  (~20/35%) for the tint to be visible. Color tinting should be tested at
  both theme modes if a light mode is ever added.
- **Uniqueness validation** — the mockup validates Project Number uniqueness
  on blur against the session store. Real implementation validates against
  the database (the unique constraint on `Project.projectNumber` covers the
  persistence layer, but the UX inline error needs an API call on blur or
  a server action).

### Open questions for implementation track

- **Color in API responses** — should color be included in the Project
  resource response? Likely yes, as a nullable string field. The API
  convention is camelCase, so `color: "blue" | null`.
- **Palette extensibility** — the 11-color palette is fixed in the mockup.
  Should users be able to add custom colors? Not for Rev 1; flag for Rev 2
  if the constraint becomes a pain point in user testing.
- **Color in cross-surface references** — the chip is only added to the
  `[id]/page.tsx` breadcrumb in this pass. When Project Number links appear
  in other execution lenses (Project View, Operations Lens, etc.), those
  surfaces should show the chip too. The implementation should share a
  `ProjectColorChip` component from a common location.

### Mockup-only details

- **Module-scope session store** — not a production pattern. No Zustand,
  no persistence, no multi-tab consistency.
- **Specific opacity values (12/22%)** — visually tuned for the dark theme;
  may need adjustment for light mode or different background colors.
- **ColorPicker popover positioning** — uses `absolute left-0 top-9` with a
  fixed width. In production, a Radix Popover or similar primitive handles
  viewport edge detection and positioning.
- **`drop-shadow` on check icon in swatch** — Tailwind utility for readability
  against saturated backgrounds. Fine for a mockup; production may use a
  different approach (white stroke or composite shadow).

---

## 2026-06-08 — Project Creation View (Project List, Draft Editor, Active Summary)

**Surfaces touched:** /app/mockups/project-creation/ — three surfaces:
Project List (landing/default), Draft Editor (editing + compile flow),
Active Project Summary (read-only).

**Mockup commits:**
- `8a87120` — initial scaffold: _data.ts with five seeded projects, WO
  generation, template assignment, all three surface components
- `afc38e9` — fix: ALWAYS_ASSIGN_PARTS ensures clean-compile projects
  resolve routing templates despite real data having `routingTemplate: null`

### Scope of exploration

This session built the Project Creation View — the surface where users
define new manufacturing projects (linking customers to BOM top-level
items), manage them as Drafts (editing header fields and top-level
items), compile a Draft into an Active Project (validating all BOM
parts have active routing templates, then generating Work Orders), and
view an Active Project's summary.

The session used the same real-data integration from the BOM Editor
session: all five seeded projects use real Part IDs and BOM trees from
the existing mockup dataset. Five projects were seeded with specific
validation scenarios:

- **17559 Wireless Probe Package — Cell 3** (Draft, single top-level,
  clean compile — 19-08-0-00)
- **10256 Customer A Trunnion — Q2 Build** (Draft, single top-level,
  clean compile — 22-15-0-00)
- **10236 Bridgeport Upgrade — Floor 2** (Draft, single top-level,
  surfaces two failure types: 22-06-1-00 has no template; 22-06-2-00
  has no template; 22-06-0-00 has an inactive template)
- **10121 PB-M Cell 2024-Q4** (Active, 6 top-level parts, 101 WOs)
- **10030 PB-M Wrap Drive Integration** (Active, 8 top-level parts,
  162 WOs)

The session established the compile flow end-to-end: validation runs
as a BOM tree walk, failures produce a Compile Failure Screen with
resolution deep links, a clean validation triggers WO generation and
transitions the project to Active.

### Design decisions made

**1. Validation at module init via ALWAYS_ASSIGN_PARTS**

The real mockup data has `routingTemplate: null` on many leaf parts
(assembly components), which would cause every project to fail
validation even for projects intended to compile cleanly. The
resolution: at module init, walk the BOM trees of the clean-compile
and Active projects to collect all part IDs, then create an
ALWAYS_ASSIGN_PARTS Set. `resolvePartTemplate()` returns an active
default template (102 for Assemblies, 101 for Parts) for any part in
that Set, bypassing the null in real data.

Specific overrides are still modeled via TEMPLATE_OVERRIDE_MAP for the
three parts in 10236 that should show failures (two mapped to null for
"no template", one mapped to inactive template 103).

**Why this approach:** the alternative (patching all real data to add
routing templates) would have lost the ability to model the failure
scenarios that make 10236 meaningful. The ALWAYS_ASSIGN_PARTS approach
keeps real data intact while defining which projects are "clean" at
the mockup level.

**Implication for implementation:** real database validation logic
checks `RoutingTemplate` assignments on each Part record directly; no
ALWAYS_ASSIGN_PARTS equivalent needed. This is a mockup-only shim.

**2. Compile flow with three Compile button states**

The Compile button has three states based on project completeness and
validation:

- **Disabled** (grey, with tooltip): missing required header fields
  (customer, due date, or no top-level items). Cannot attempt compile.
- **Amber/warn outline**: all required fields present, but at least one
  validation failure exists. Clicking shows the Compile Failure Screen.
- **Primary enabled**: all required fields present, all validation
  passes. Clicking triggers the 800ms compile simulation then
  transitions to Active.

The compile button text is "Compile →" in warn state (prompts the user
to proceed despite warnings) and "Compile →" in clean state. This
distinction was implemented by changing the visual style rather than
the text.

**Implication:** this three-state pattern fits any action that has
hard blocks (missing required data) and soft warnings (fixable-but-
valid-to-proceed issues). Not a general pattern for all buttons — only
for actions that have both.

**3. Compile Failure Screen as a full surface replacement, not overlay**

When the Compile button is clicked with validation failures, the Draft
Editor body is replaced entirely by the Compile Failure Screen (not a
modal Dialog overlaying the Editor). The Screen shows:

- Count header: "Compilation cancelled — N validation issues must be
  resolved"
- Per-failure list: part number, part name, failure reason label, BOM
  path breadcrumb, deep link to resolution surface
- Footer: "Return to Editor" button

Resolution deep links:
- no-template → `/mockups/parts?partId=X` (Open Part form → Routing
  Template section)
- part-inactive → `/mockups/parts?partId=X` (Open Part form)
- circular → `/mockups/bom-editor/X` (Open BOM Editor)
- template-inactive → dead-end annotation "Routing Template Editor
  — not yet built" (no link because the Routing Template Editor
  mockup does not support this navigation yet)

**Implication:** template-inactive failures have a dead-end annotation
in the mockup. When the Routing Template Editor mockup gains this
resolution path, the `getDeepLink()` function needs the `template-
inactive` case updated to a real href.

**4. BOM Tree Preview in Draft Editor**

The Draft Editor shows a BOM Tree Preview section (below the top-level
items table) that visualizes the full BOM tree for each top-level item
with per-node validation indicators. This preview:

- Reuses the same `validateTree()` logic used by the compile flow
- Shows CheckCircle2 (pass) or AlertCircle (fail) per node with the
  failure reason label
- "Fix" deep links on fail nodes (same resolution deep links as the
  Compile Failure Screen)
- Has Expand All / Collapse All / Reset controls
- Failure nodes show a dead-end annotation ("not yet built") when the
  resolution surface isn't available

The BOM Tree Preview mirrors the expandable tree pattern from the BOM
Editor mockup (hybrid expandable, chevron per sub-assembly).

**5. Active Project Summary is read-only (Phase 8 note)**

The Active Summary surface is intentionally read-only. All edit
affordances are absent. A sky-blue notice banner reads:

> "Active Project — read-only view. Work order management and
> execution details will be available in Phase 8 of the Project View
> build."

Progress bars (per project and per top-level item) show 0% since all
generated WOs are Unreleased. "All N Work Orders are Unreleased" note
provides context.

Quick Navigation links (to WO grid, Routing Steps, Blockers, etc.)
appear as inert text with "— not yet built" annotations.

**6. Part search relevance ranking (from BOM Editor, confirmed here)**

The PartSearchCombobox in the Draft Editor uses the same
relevance-ranked search established in the BOM Editor:
exact → prefix → substring → edit-distance on same-length prefix,
on Part Number first, Part Name second. Confirmed this is the right
pattern for any part-selection combobox in the system.

**7. TypeScript strict mode: discriminated union for ValidationResult**

`ValidationResult` is a discriminated union:
```typescript
type ValidationResultPass = { status: "pass" };
type ValidationResultFail = { status: "fail"; reason: ValidationFailureReason; templateName?: string };
type ValidationResult = ValidationResultPass | ValidationResultFail;
```

Accessing `reason` requires narrowing to `ValidationResultFail`.
Components that need to display failure details import
`ValidationResultFail` and cast after narrowing. This pattern avoids
`as any` and keeps the compiler helpful throughout the validation
rendering path.

**8. Lucide icon `title` prop — must wrap in `<span title>`**

Lucide React icons do not accept a `title` prop. Attempting to pass
`title="..."` produces a TypeScript error. The correct pattern is:
```tsx
<span title="Tooltip text">
  <AlertCircle className="h-4 w-4" />
</span>
```
This applies throughout the mockup wherever an icon needs a tooltip.
Already documented in BOM Editor history; confirmed as the pattern
for all mockup surfaces.

### Recommendations for implementation

- **Compile flow** as a server-side transaction: validate all parts
  against their RoutingTemplate assignments (with database-backed
  resolution), then within a single transaction generate all WOs
  (with steps, per `state_model.md`), write an AuditLog entry, and
  transition the project to Active. Validation is fast and should run
  before the transaction is opened.

- **Three compile-button states** (hard-blocked, warn-but-clickable,
  clean) as the canonical pattern for actions with both required-data
  gates and fixable-warning conditions.

- **Compile Failure Screen** as a full surface replacement with
  resolution deep links per failure reason. When the Routing Template
  Editor gains a URL-addressable per-template route, wire the
  `template-inactive` deep link.

- **BOM Tree Preview** in the Draft Editor (or an equivalent live
  validation summary). Users should know before compiling which parts
  will fail and why. The preview makes the Compile Failure Screen less
  surprising and accelerates the fix loop.

- **Active Summary as a Phase 8 stub.** The surface exists and is
  reachable; it shows accurate WO counts and 0% progress for
  Unreleased. Full execution detail (per-WO status, step completion,
  blockers) is Phase 8 work.

- **Validation logic as pure functions in `/lib`** (no component or
  database imports). The `validateTree()`, `validatePart()`, and
  `validateProject()` functions are testable in isolation and reused
  by both the Preview and the Compile flow.

- **WO generation as a recursive BOM tree walk.** Walk each
  top-level item's BOM tree; create one WO per node; create steps per
  routing template; assign `Unreleased` status to all WOs, `Waiting`
  status to all steps. This is the spec's compile behavior.

### Open questions for implementation track

- **WO reference format:** the mockup generates WO references as
  `projectNumber.NN` (e.g., "17559.01"). The spec in
  `project_creation_view_spec.md` should specify the exact format for
  implementation. If it's different, adjust.

- **Compile concurrency:** if two users compile the same Draft
  simultaneously, the second write should either detect the state
  change (409 Conflict) or be idempotent. The mockup doesn't model
  this. Real implementation needs a concurrency decision.

- **WO count capping:** Project 10030 generates 162 WOs from 8 top-
  level items. At scale, a large project might generate 500+. CLAUDE.md
  notes that Prisma transactions exceeding ~50 rows may need chunking.
  The WO generation transaction should account for this.

- **Template-inactive resolution flow:** currently a dead-end in the
  mockup. When the Routing Template Editor mockup (or real
  implementation) supports routing a user to a specific template's
  edit form, the deep link in both the Compile Failure Screen and the
  BOM Tree Preview validation indicators needs to be wired up.

- **Draft auto-save vs explicit save:** the Draft Editor uses auto-
  save on every field change (via the `update()` helper bumping
  `lastEditedAt`). Real implementation should match this behavior with
  an auto-save API call (debounced) or a Save button. Spec may be
  silent on this; worth clarifying.

### Mockup-only details

- **ALWAYS_ASSIGN_PARTS shim** — not needed in implementation; real
  database has proper RoutingTemplate assignments per Part.
- **800ms compile simulation** — real compile may be faster or slower
  depending on project size; the delay is mockup UX only.
- **State isolation between pages** — because the mockup uses page-
  level useState initialized from INITIAL_PROJECTS, navigating away
  from [id]/page.tsx and back resets project state. A compiled project
  appearing as Active on the list requires the compile to have updated
  the parent page state before navigating. This is a mockup architecture
  limitation; real implementation uses a shared database.
- **Active Summary 0% progress** — all generated WOs are Unreleased
  so progress bars show 0%. The mockup has no mechanism to advance WO
  status; this is expected.

---

## 2026-06-02 — BOM Editor (read-only tree, real-data integration, editing operations)

**Surfaces touched:** /app/mockups/bom-editor/ (search-driven
landing, expandable tree visualization, editing operations,
validation systems), /app/mockups/parts/_data.ts (real-data
integration replacing MOCK_PARTS)

**Mockup commits:** approximately 12-15 commits in sequence:
- BOM Editor surface + read-only tree visualization
- Real data integration: 1893 Parts + 434 Assemblies + 2341 BOM
  edges, sanitized customer names, generated cost freshness dates
- Architecture polish: push-tree layout for Part Form Sheet,
  persistent search in chrome, route collapse from two routes to
  one, shared Part Form Sheet via cross-mockup import
- Commit 2a: row tinting bumps, tree width tightening, root row at
  top of tree, sort rule (Parts above Assemblies, alphabetical),
  inline qty edit
- Followup: 0-as-remove confirmation gate
- Sticky column headers + tree width fix
- Commit 2b: ⋮ menu, Add Child inline-input flow, Remove Children
  multiselect mode, cycle detection with chain display, depth
  validation, audit logging
- Evaluation fixes: ⋮ menu position, edit-distance threshold,
  relevance ranking, duplicate Add error, cycle icon UX, depth
  thresholds adjusted to 6/8, ESC unwinding stack
- Edit-distance prefix matching
- Tooltip on cycle icon + pointer-events fix

### Scope of exploration

This session built out the BOM Editor — a standalone surface for
viewing and editing BOM (Bill of Materials) relationships. The BOM
Editor is structurally different from prior mockups: it visualizes
a graph (Parts and Assemblies as nodes, BOM edges with quantities
as edges), supports tree traversal in both directions, and gates
edits through cycle and depth validation.

The session also included substantial real-data integration. The
mockup's MOCK_PARTS was replaced with sanitized data from the
user's prior shop: 1893 Parts, 434 Assemblies, and 2341 BOM edges
representing actual machine builds. Customer names were anonymized;
costs and freshness dates were generated. The Parts grid, BOM
Editor, Part Form Sheet, and all dependent surfaces now operate on
this real-shape data.

By session end, the BOM Editor supports:
- Read-only tree visualization with hybrid expandable structure
- Operational rollups (cost, buildable count, freshness indicators)
  computed recursively over subtrees
- Search-driven Assembly selection with persistent search in chrome
- Cross-mockup integration with Part Form Sheet (full form, scrolled
  to relevant section on open, push-tree layout)
- Editing operations: inline qty edit with confirmation, Add Child
  with cycle/depth validation, multiselect Remove with confirmation
- Mode exclusivity (one edit at a time per Assembly; navigation
  remains available; in-progress edits discard on navigation away)
- ESC unwinding via modal stack (most recently activated closes first)

### Design decisions made

**1. Hybrid expandable tree visualization (not flat-list-with-
navigation)**

Question: how should the BOM tree be visualized — as a flat list
of immediate children (one level at a time, click sub-Assembly to
navigate into it) or as an expandable tree (show whole tree
inline, expand/collapse sub-Assemblies)?

Options considered: flat list with breadcrumb navigation;
expandable tree (default collapsed, expand-on-click); always-fully-
expanded tree.

Decision: hybrid expandable tree. Sub-Assemblies show a chevron
that expands them inline. "Expand all" / "Collapse all" toggles
for bulk operations. Default state shows only the immediate
children of the root Assembly.

Reasons: at typical depths (3-5), the user benefits from seeing
the full structure. At deeper depths, expand-collapse lets them
focus. Flat list would have required excessive navigation for
common workflows. Fully-expanded would have overwhelmed the user
on first open.

Implication: tree visualization handles arbitrary depth.
Validation thresholds (soft at 6, hard at 8) reflect visual
capacity, not engineering capacity. The execution lenses (Projects
especially) inherit this pattern.

**2. Search-driven landing collapsed into editor chrome**

Question: should the BOM Editor have a separate landing page (for
Assembly selection) and an editor page (for working on an
Assembly's BOM)?

Options considered: separate routes for landing and editor (two-
page model); single route with persistent search in chrome.

Decision: single route. /mockups/bom-editor renders the editor
with empty body if no Assembly is selected. The search is
persistent in the chrome. /mockups/bom-editor/[id] renders the
same chrome plus that Assembly's tree.

Reasons: switching between Assemblies is a common workflow; making
it require navigation back to a landing page adds friction. The
search bar in chrome handles all entry points uniformly. The
landing's "what Assembly do I want to look at?" question is now
always one search box away.

Implication: the Parts Master and execution lenses can follow a
similar pattern — persistent search in chrome for entity selection,
empty-state landing when no entity is selected.

**3. Push-tree layout (not push-chrome) for Part Form Sheet**

Question: when the Part Form Sheet opens (from a Part Number
click), should it push the page chrome aside or only push the
tree?

Decision: push only the tree. Chrome (search bar, page header,
Assembly identity) stays full-width above. The tree compresses to
~67%, the Sheet takes ~33% on the right. Both scroll independently.

This pattern matches what we established in /mockups/parts: chrome
above stays put; body content reflows around side panels. The
execution lenses will use the same pattern.

**4. Bidirectional BOM traversal via clickable rows**

Question: should the user be able to navigate the BOM tree by
clicking rows, and if so, in which directions?

Decision: yes, bidirectional. Click a Part's Part Number → opens
Part Form Sheet showing that Part's data, scrolled to Parent
Assemblies section. From Part Form Sheet, click a parent row in
the Parent Assemblies section → that parent becomes the Sheet's
focus. Combined with the Sheet's Child Parts section (for
Assemblies), full BOM tree walkable.

This was the breakthrough on tree navigation — the surface isn't
just for viewing one Assembly's BOM; it's for traversing the BOM
graph by clicking, with the Part Form Sheet showing each node's
full context.

**5. Sort rule: Parts above Assemblies, alphabetical within**

Question: in what order should children of an Assembly be
displayed?

Decision: Parts above Assemblies. Within each group, alphabetical
by Part Number. Applied at render time, not stored in data.

Reasons: BOM order isn't semantically meaningful (no "build this
first, then this" — that's routing). Parts-above-Assemblies
matches habitual organization in the real data and aids scanning
(leaves before branches). Alphabetical-within keeps consistent
positioning across reloads.

Implication: future Rev might add drag-and-drop reordering with
persisted custom order; for Rev 1, the sort rule is sufficient.

**6. Operational rollups as first-class data, not just structure**

Question: should the BOM Editor show only the structural
relationships, or include computed operational data?

Decision: include both. Each row shows the part's identity
(structure) AND its operational state (own stock, buildable
rollup for Assemblies, cost rollup, freshness, location).

The Buildable rollup is particularly significant — for an
Assembly, it answers "how many of this Assembly could we build
right now from on-hand stock?" computed by minimum across all
descendants, weighted by quantities, treating null stock as 0.

Reasons: this answers operational questions inline ("what could
we ship from stock today?") without requiring a separate report
or aggregation surface. The user noted this feature was a
limitation in the prior tool; surfacing it here uses the BOM
Editor as analysis surface, not just structural editor.

**7. Cycle detection on add, visible-but-disabled in combobox**

Question: how should cycle prevention be surfaced — block at
Save? Filter from search results? Show but disable?

Decision: show cycle-creating candidates in the combobox but
render them as disabled (greyed text + red error icon). Hover the
icon for tooltip, click the icon for the chain display dialog.

This preserves information (user sees the Part exists) while
preventing the cycle. The dialog with chain becomes a learning
moment — the user understands WHY the Part can't be used here
(the chain through the tree that creates the cycle).

Alternative would have been: pre-filter cycle-creators out of
results (less informative); or let users select and block at Save
with the dialog (more friction).

**8. Depth validation: soft warning at 6, hard block at 8**

Question: at what depth should the system warn or block?

Decision: soft warning when proposed depth would be 6, 7, or 8.
Hard block when proposed depth would be 9 or greater.

These thresholds reflect the visual capacity of the interface:
beyond depth 6, the tree zone constrains Part Names with
truncation; beyond depth 8, the tree zone becomes too narrow to
read. Engineering capacity (PostgreSQL recursive CTEs handle
depth 20+ without issue) is not the binding constraint.

The user's real-data maximum is depth 5, so the soft warning rarely
fires on legitimate edits. When it does, the user can confirm
intent or restructure.

**9. Mode exclusivity with navigation still available**

Question: when one Assembly is in an editing mode (Add Child,
Remove Children), what can the user do?

Decision: editing on OTHER Assemblies is blocked (their ⋮ menus
disabled). But navigation — chevrons on other Assemblies, search
in chrome, Part Form Sheet opens — remains available. Navigation
away from the page silently discards in-progress edits.

This matches "Add Child means start adding a child; don't undo
my pending work just because I clicked the wrong button" reasoning.
Navigation is non-destructive; explicit Cancel or Save resolves
the edit.

**10. ESC unwinding via most-recently-activated stack**

Question: when multiple modal/mode states are active (e.g., Add
Child open AND Part Form Sheet open), which closes first on ESC?

Decision: most recently activated closes first. Implementation
uses a stack — each modal/mode pushes on activation, ESC pops the
top.

shadcn Dialogs handle their own ESC via Radix; the custom stack
only manages non-Dialog dismissibles (Sheet, Add mode, Remove
mode). This separation works in practice because users perceive
"close what I opened most recently" regardless of underlying
mechanism.

**11. Search results ranked by relevance**

Question: when the user types in the Part Number combobox, what
order should results appear in?

Decision: exact match > prefix > substring > edit-distance, on
Part Number first, then Part Name. Within tier, secondary sort by
Part Number.

This was a real bug fix discovered in evaluation: typing exact
Part Numbers initially produced results buried behind fuzzy
matches. The relevance ranking puts the user's most likely
intended candidate at top.

Implication: any search-with-fuzzy-match in the system should
apply the same ranking. Worth establishing as a pattern.

**12. Edit-distance: compare against same-length prefix**

Question: when the user types a partial Part Number (e.g.,
"41-02-1-"), should it match candidates like "41-02-0-XX" via
edit-distance?

Decision: compare the search string to the candidate's prefix of
equal length to the search. Edit-distance 1 between "41-02-1-"
and "41-02-0-" yields match for any candidate starting with
"41-02-0-..."

The naive full-string edit-distance treated the candidate's
additional characters as insertions, inflating distance past
threshold. The prefix-comparison rule reflects the user's mental
model: "I'm searching for Part Numbers starting like this."

**13. Real data integration — full dataset with sanitization**

Question: should the mockup use real data, fabricated data, or a
curated subset?

Decision: full real dataset from the user's prior shop, with
sanitization for customer names. 1893 Parts + 434 Assemblies +
2341 BOM edges. Costs from real data; cost-last-updated dates
regenerated for plausible freshness distribution.

Reasons: the Pattern E filter system was designed for spreadsheet-
scale interrogation; using 1893 Parts validates the system at
real-world scale. Curation would have created arbitrary cutoffs.
Fabrication would have lost authenticity (real BOMs have
irregular structure that's hard to invent).

Customer-identifying Assembly names anonymized ("Hines 3-column"
→ "Customer A 3-column" with consistent letter per customer).
Technical product names and component supplier names kept as-is.

**14. Sticky column headers on scroll**

Question: when the BOM tree (or Parts grid) is scrolled
vertically through many rows, where do the column headers go?

Decision: sticky to the top of the scroll container. Implemented
at the `th` element level (not `thead`) because `position: sticky`
on `thead` is unreliable across browsers. `th`-level sticky is
the standard pattern.

This was applied to both the BOM Editor's tree and the Parts
Master grid as a consistent treatment.

### Recommendations for implementation

- **Hybrid expandable tree** for any tree-shaped visualization
  (BOM Editor, Projects execution view). Default collapsed except
  root; expand/collapse per node; bulk Expand all / Collapse all
  toggles.

- **Search-driven chrome on landing surfaces.** The search bar is
  always available, not behind navigation. Empty-state body when
  no entity is selected.

- **Push-tree layout pattern** for any side-panel-over-list
  surface. Chrome stays full-width above; body content (tree,
  grid, etc.) compresses to make room for the panel; both scroll
  independently. Inherits from Parts Master.

- **Bidirectional BOM traversal.** Click any Part to open its
  Sheet, scrolled to the relevant section (Parent Assemblies for
  most contexts). Click any parent or child row to navigate the
  Sheet to that record. BOM graph traversal as primary
  interaction.

- **Sort rule: Parts above Assemblies, alphabetical within.**
  Applied at render. Sort key: partType (Part first), then
  partNumber.

- **Operational rollups on Assemblies:** cost (sum recursive),
  buildable (min recursive, null stock = 0), freshness
  (descending: missing > stale (>6mo) > healthy). Computed on-the-
  fly; not persisted.

- **Cycle detection prevents save (combobox-level), error icon
  surfaces chain on demand.** Don't let the user proceed with a
  cycle; do give them the information about why on request.
  Validation as pure functions in /lib for reuse.

- **Depth thresholds: soft warn at 6, hard block at 8.** Visual
  capacity, not engineering. The schema's max depth (or whatever
  the engineering limit is) is separate.

- **Mode exclusivity within a single user's session.** One edit at
  a time per Assembly; navigation remains available. Real
  implementation should consider how this maps to multi-user
  (last-write-wins? optimistic locking? explicit save conflicts?).

- **ESC unwinding via most-recently-activated stack.** Either
  custom hook coordinating shadcn Dialog primitives or pure custom
  stack. shadcn Dialogs' built-in ESC is cooperative.

- **Search ranking: exact > prefix > substring > edit-distance, on
  Part Number then Part Name.** Apply consistently across any
  fuzzy-search affordance in the system.

- **Edit-distance: same-length prefix comparison.** Search "X"
  matches candidate "X..." with substring; matches "Y..." (where
  "Y" is edit-distance N from "X") if the candidate's prefix of
  length |X| is distance ≤ threshold from X.

- **Sticky column headers at `th` level**, not `thead`. Reliable
  across browsers; Parts grid and BOM Editor both use this
  pattern.

- **Cross-mockup component reuse pattern.** The Part Form Sheet is
  imported across mockups. Implementation should share via a
  proper shared location (e.g., /app/_components/part-form-sheet/).
  Same applies to: ProcessTypeChip, PROCESS_TYPE_META, MOCK_PARTS,
  ProcessTypeLegend, edit-distance utilities, and now Part Form
  Sheet itself. Multiple components are load-bearing across
  surfaces.

### Open questions for implementation

- **BOM relationship persistence in database.** The mockup
  represents BOM as denormalized arrays (`childParts`,
  `parentAssemblies`) on each MockPart. Real schema uses a BOM
  table with FK to Part. Queries for tree traversal use recursive
  CTEs. Performance at scale needs validation.

- **Concurrent editing.** Multiple users editing different
  Assemblies' BOMs simultaneously: presumably fine. Multiple users
  editing the SAME Assembly's BOM: needs decision. Optimistic
  locking? Last-write-wins? Real-time sync (Liveblocks,
  Y.js)? The mockup doesn't model this.

- **In-flight edit recovery.** Mockup discards on navigation away.
  Real implementation may want auto-save drafts or warn-on-leave.
  User preference is "discard, but I can navigate freely" — match
  in implementation.

- **Buildable rollup performance.** With real data at 2300+
  parts/assemblies and a full subtree calculation, the rollup is
  fast enough in-memory in the mockup. With database queries +
  network, this could be expensive. Caching strategy?
  Materialized view? On-demand calculation?

- **Cycle detection at scale.** Mockup's cycle check is O(N) walk
  of proposed child's subtree. Real-world scale (10k+ parts)
  should remain fast but worth confirming.

- **Real-time updates.** If User A adds a child to Assembly X
  while User B is looking at X's BOM, does B see the update?
  Real-time sync, polling, or refresh-on-action?

- **Audit log retention and query.** Per-Assembly audit entries
  accumulate; how is this surfaced operationally? Filtering by
  date range? Export? Implementation needs to decide retention.

- **Stock count source-of-truth.** The mockup has stock counts on
  Parts (set by the Receiving lens in production). The buildable
  rollup reads these counts; the cost rollup reads costs. Both
  are computed values, but the inputs come from different
  operational surfaces. Implementation needs to define the data
  flow.

- **Sub-assembly stock-on-hand.** The mockup allows Assemblies to
  carry their own stock count (e.g., pre-built sub-assemblies in
  stock). The rollup logic accounts for this but the spec on how
  this works operationally is thin. Worth clarifying.

- **Part Form Sheet as shared component.** Cross-mockup import
  works in mockup but Parts and BOM Editor both depend on it.
  Implementation should lift to a shared location with proper
  API. The "Open in Parts Master" link suggests the canonical
  edit surface is Parts grid; BOM Editor uses the same Sheet
  for context viewing.

### Mockup-only refinements

- **Specific row tinting values** (`bg-muted/80` for Parts) —
  visually tuned; not spec language. Implementation matches for
  consistency but pixel-perfect equivalence not required.

- **Specific tree zone width** (`w-[424px]`) — visually tuned to
  fit Location column next to Part Form Sheet at 1440px viewport.
  Implementation should match the principle (data columns visible
  with side panel open) but exact value may shift.

- **Specific column widths and ordering** in the data zone (Type,
  Qty, Stock, Buildable, Cost, Freshness, Location) — chosen for
  the mockup; implementation should validate based on the real
  operational queries users ask of this surface.

- **Open in Parts Master link wording and position** — currently
  in a strip above the Part Form Sheet; can be relocated.

- **Cycle icon visual** (lucide AlertCircle, text-destructive
  color) — implementation should keep an iconographic standard
  but specific icon library/icon may shift.

- **ESC stack vs alternative dismissal patterns** — the stack-
  based approach worked but other patterns (focus-based, last-
  registered modal) are also valid; implementation may choose.

- **Real-data values** — costs, dates, stock counts, etc. The
  mockup uses real-but-sanitized data; production uses live data
  from the actual operational systems.

- **Search ranking and edit-distance precise rules** — the
  ranking tiers and prefix-comparison rule are documented above
  and should be respected, but specific tie-breaking and edge
  cases may shift in implementation.

- **Specific tree max-depth thresholds (6/8)** — these are
  intentional design choices for Rev 1; future Revs may adjust
  based on user feedback or operational reality.

---

## 2026-05-31 — Part Form side panel and Definition Change Flag

**Surfaces touched:** /app/mockups/parts/ (Part Form side panel,
Material & Vendor / Routing / Parent Assemblies / Inventory /
Child Parts sections, Definition Change Flag dialog)

**Mockup commits:** approximately 6 commits in sequence:
- "part form as push-grid side panel" (1.6a)
- "independent scroll for parts grid and side panel" (scroll fix)
- "selected-row indicator on parts grid"
- "part form material and vendor section"
- "part form routing, parents, inventory sections"
- "part form definition change flag and child parts"

### Scope of exploration

This session built out the Part Form — the side panel that opens
when a user clicks a row in the Parts grid. Part Form is the hub
where most other configuration surfaces are referenced (Materials,
Vendors, Routing Templates, BOM relationships) and where the
Definition Change Flag system operates on the Parts side (parallel
to the Routing Template Editor's edit-time dialog on the
Templates side).

The session started with a layout overhaul (replacing the wide
overlay Sheet from prior work with a narrower push-grid side panel)
to establish the side-panel pattern that execution lenses will
inherit. From there, the form's six sections were built out
incrementally: Header and Core Details (already done), Material &
Vendor with in-context creation (cascade modal + Vendor create
modal both local to the Parts mockup), Routing Template with
Change Template dropdown, Parent Assemblies and (for Assemblies)
Child Parts with click-to-navigate behavior, Inventory with bin
thresholds, and finally the Definition Change Flag dialog that
gates Save when definition fields change with downstream impact.

By session end, the Part Form is functionally complete. Every
field the spec describes is present and interactive. BOM tree
traversal works in both directions. In-context creation works for
both Materials and Vendors. The Definition Change Flag dialog
fires correctly based on field-change-plus-impact gating logic.

### Design decisions made

#### 1. Side panel pattern (not modal overlay) for Part Form

**Question:** Should the Part Form open as a wide overlay (the earlier
implementation) or a narrower side panel that pushes the grid?

**Options considered:**
- Keep the wide overlay (current)
- Narrow side panel that overlays grid
- Narrow side panel that pushes grid to ~67% width

**Decision:** Push-grid side panel at ~33% width.

Reasons: (a) consistency with execution lenses that will use the same
pattern, (b) the grid stays interactive while the panel is open (user
can click another row to navigate to a different Part), (c) the user's
"click data column to scroll panel to relevant section" workflow requires
the panel to be a long-lived navigation surface, not a one-shot modal.

The standalone-best design would have been a centered sub-window with
tiled sections, but consistency across surfaces wins for Rev 1. If the
panel pattern proves too constraining at 33%, the user can adjust width.

**Implication:** all form sections use single-column layout (no
side-by-side fields). The grid scrolls horizontally for wide Views
even with the panel open — accepted trade-off.

#### 2. Click-data-column scrolls panel to corresponding section

**Question:** When a user clicks a specific column in a grid row,
should the panel just open at the top, or scroll to a section relevant
to that column?

**Options considered:**
- Open at top always
- Scroll to relevant section based on which column was clicked

**Decision:** Scroll to the relevant section. The mapping (Material
column → Material & Vendor section; Routing column → Routing Template
section; etc.) reduces friction for "I want to look at this specific
aspect of this part" workflows. Without it, the user opens the panel
and scrolls manually every time.

**Implication:** each section has a stable HTML id; column-to-section
map drives the scroll behavior; clicking a row's data cell passes the
column ID up to the panel. This pattern is specced for execution lenses
too; establishing it here as the canonical implementation.

#### 3. Bidirectional BOM traversal — Parents on all, Children on Assemblies

**Question:** Should Assemblies show their parent assemblies (where
they're used) or their child parts (what they're made of)?

**Options considered:**
- Parents only for both (simpler)
- Children only for Assemblies (replaces Parents semantics)
- Both Parents AND Children where applicable (most thorough)

**Decision:** Both. Parts show only Parents (Parts are leaves; they have
no children). Assemblies show both Parents (most assemblies are
sub-assemblies in something larger) and Children (what they're made of).
All rows in both sections are clickable, enabling full BOM tree traversal
via the panel.

**Implication:** operationally significant — a user looking at a
sub-assembly can navigate up to the parent or down to a component without
leaving the panel. The BOM is the relational backbone of the system; the
panel respects that.

#### 4. In-context creation: local cascade modal and Vendor create modal

**Question:** When the user is creating or editing a Part and needs a new
MaterialSpec or Vendor that doesn't exist yet, how do they create one
without leaving the form?

**Options considered:**
- Navigate to the Material Specs or Vendors mockup (high friction)
- Modal that imports from those mockups (cross-mockup coupling)
- Local modals within the Parts mockup (decoupled)

**Decision:** Local modals. The MaterialSpec cascade modal in Parts is
create-only (the full edit functionality lives in the MaterialSpec
Management surface). The Vendor create modal in Parts is minimal (name +
contact + lead time + notes, skipping website and location that belong in
full Vendor Management). Both modals add to Parts' local MOCK_* arrays;
no propagation to other mockup surfaces.

**Implication:** spec language for in-context creation needs to specify
what subset of the full fields are exposed and what the data persistence
semantics are (presumably real Vendor and MaterialSpec records, available
everywhere). Mockup track preserves decoupling; implementation track
resolves to single shared records.

#### 5. Definition Change Flag — Parallel dialog, not shared

**Question:** The Routing Template Editor has an edit-time dialog with
count cards (Parts/WOs/Stock); should the Parts side use the same
component or a parallel one?

**Options considered:**
- Lift the EditTimeDialog to a shared location and parameterize the data source
- Build a parallel DefinitionChangeFlagDialog inside the Parts mockup

**Decision:** Parallel. The two dialogs share ~80% design language but
operate on different data (Routing Template's dialog shows Parts using the
template + WOs running templates; Parts' dialog shows BOM references +
WOs producing this Part + this Part's stock). Parameterizing for shared
use would add complexity to both consumers. Parallel-similar is the cost
of mockup decoupling we chose to accept.

**Implication:** implementation may choose to share these via a generic
ImpactDialog component that takes data sources as props. That's an
implementation-track decision; both mockup implementations exist as
reference.

#### 6. Save gates through dialog only when definition fields AND impact

**Question:** When does the Definition Change Flag dialog fire?

**Options considered:**
- Fire whenever any field changes
- Fire only when definition fields change
- Fire only when definition fields change AND the Part has downstream impact

**Decision:** When BOTH conditions are true at Save time: (a) a
definition field changed (Material Spec, Default Vendor, Routing Template,
Stock Size, Blank Length), and (b) the Part has any downstream impact
(parents > 0 OR open WOs > 0 OR stock > 0).

Otherwise Save commits silently. Non-definition field changes (Name,
Description, Notes, etc.) never trigger the dialog regardless of impact.
Definition-field changes on Parts with zero impact (draft Parts, freshly
created Parts) also commit silently.

**Implication:** matches the Routing Template Editor's gating logic and
keeps the dialog meaningful — it only appears when there's something real
to confirm.

#### 7. Stock Size as free text deferred to Rev 2

**Question:** Should Stock Size be a structured field (combobox of known
sizes per MaterialSpec) or free text?

**Options considered:**
- Structured combobox (sizes defined per MaterialSpec)
- Free text

**Decision:** Free text for Rev 1. Material handling is undergoing broader
rework in Rev 2; Stock Size structure belongs in that work. Mockup uses a
simple text input.

#### 8. Bin Min/Max validation as warning, not block

**Question:** When Bin Max < Bin Min (an unusual configuration), should
the form prevent Save or just warn?

**Options considered:**
- Block Save with a validation error
- Show a warning but allow Save

**Decision:** Warn but allow. Trust the user with tools — they may
legitimately set values that look unusual. The warning surfaces the
concern; the user decides.

#### 9. Inline edit on grid + form edits stay in sync

**Question:** Stock Count and Inventory Location are inline-editable in
the grid AND editable in the form's Inventory section. Should edits in
one surface reflect in the other?

**Options considered:**
- Independent state (grid and form diverge until a Save/Reload)
- Bidirectional sync (both surfaces share the same record in memory)

**Decision:** Bidirectional sync. Both surfaces operate on the same
MockPart record in memory; changes in either reflect immediately in the
other. The grid is the fast path for single-field edits; the form is the
comprehensive edit context.

#### 10. Routing Template editor navigation as link, not overlay

**Question:** How does the user access the Routing Template Editor from
the Part Form's Routing Template section?

**Options considered:**
- Navigation link to /mockups/routing-templates/[id]
- Overlay that opens the editor over the Part Form

**Decision:** Navigation link for the mockup. Long-term, the user prefers
this to open as an overlay over the Part Form (avoiding context loss). For
the mockup, link navigation is acceptable; the overlay redesign is flagged
for implementation-track consideration.

### Recommendations for implementation

- **Side panel pattern** (push-grid at ~33%) for Part Form and execution
  lenses. The grid remains interactive; the panel updates on row clicks.
- **Click-to-section navigation** from grid columns to form sections
  (column-to-section mapping declared per surface).
- **Bidirectional BOM traversal** — both Parents and Children shown where
  applicable, both clickable, both navigate the panel.
- **In-context creation** for MaterialSpec and Vendor from the Part Form.
  Real implementation should create records in the shared database; the
  cascade modal and Vendor create modal can be reused across surfaces (BOM
  Editor, etc.) that need similar in-context creation.
- **Definition Change Flag dialog** with the trigger logic (definition
  fields AND impact). Three count cards parallel to the Routing Template
  Editor's dialog. Implementation may share a generic ImpactDialog
  component between the two.
- **Selected-row indicator** on the grid when the panel is open (left-edge
  accent + subtle background tint).
- **Stock Count and Location bidirectional sync** between grid inline-edit
  and form field edits.
- **All section ID anchors** stable across surface versions (the
  click-to-scroll behavior depends on these).

### Open questions for implementation track

- **In-context creation persistence:** the mockup's local modals add to
  local data; production should create real records via the same Vendor /
  MaterialSpec API endpoints. Permissions and validation rules need to
  match the full-surface CRUD.
- **Cascade modal vs full MaterialSpec management:** the Parts cascade
  modal is create-only. Should the same component support edit mode in
  this context, or is editing always done via the MaterialSpec Management
  surface? (Mockup decoupling meant we sidestepped this; implementation
  has to choose.)
- **Routing Template Editor as overlay vs page:** flagged as a user
  preference; defer to implementation track's UX evaluation. Pattern would
  affect multiple surfaces.
- **Definition Change Flag dialog generalization:** Parts and Routing
  Templates have parallel dialogs. Worth a shared ImpactDialog component?
  If so, what's the API?
- **BOM data model in the database:** Parts have `parentAssemblies` and
  `childParts` as denormalized arrays in the mockup. The actual schema uses
  BOM records; the form needs to read both directions efficiently (parent
  assemblies via BOM table joined where childPartId = this part; child
  parts via BOM table where parentPartId = this part).
- **Open WOs query:** the dialog shows open WOs targeting this Part.
  Production query joins WorkOrder → Part with status filtering.
  Performance implications at scale.
- **Stock Size structure (Rev 2):** flagged for the material handling
  rework. Until then, free text.

### Mockup-only refinements

- **33% panel width as starting value** — visually tuned; not a spec
  requirement.
- **Bin Min/Max as Rev 2 fields** — defined in mockup, deferred in
  implementation schema until Rev 2 lands.
- **Cascade modal create-only** — full edit mode lives in MaterialSpec
  Management; deliberately not replicated.
- **Vendor create modal minimal fields** — full Vendor Management surface
  owns the comprehensive Vendor record.
- **Parallel implementation of Definition Change Flag dialog and Routing
  Template Editor edit-time dialog** — not a shared component;
  implementation may choose to share.
- **Stock Size free-text** — Rev 2 work.

---

## 2026-05-30 — Parts Master Pattern E exploration

**Surfaces touched:** Parts Master grid (`/app/mockups/parts/`); Routing Templates grid (`/app/mockups/routing-templates/`) — incidentally affected by ProcessTypeChip width change
**Mockup commits:**
- `34f2533` — narrower compact chips, parts grid legend + toggle (1.5a)
- `8a3a352` — parts views foundation and full column system (1.5b)
- `4a8609a` — column-header menus replace filter bar (1.5c)
- `b3810da` — parts views modification and management (1.5d)
- `7b267e8` — trim view management modal to essential columns (polish)

### Scope of exploration

This session explored a substantial extension to the Parts Master grid: a Views system that lets users define and switch between saved configurations of column visibility, sort, and filters. The exploration was motivated by the user's design principle that the grid should support spreadsheet-parity interrogation — users should be able to answer ad-hoc questions about the parts data without requiring developer intervention or exporting to external tools.

The session expanded scope significantly beyond the original spec across four dimensions: the fixed filter bar described in the spec was replaced with column-header-driven sort, filter, and hide controls; approximately thirteen additional columns were defined covering Rev 2 schema fields and operationally meaningful data not surfaced in the original spec; a full Views CRUD system was added (switcher, modification UI, management modal); and filter operators were defined per column data type, with the Routing column gaining include/exclude filter semantics that go beyond the spec's deferred Rev 2 "Includes Process" filter.

This scope expansion was deliberate. The Parts grid is core to operational interrogation work — it is where shop staff answer questions like "which parts use this material?" or "which parts have no routing and are still open?" — and the user's position is that investing in a capable grid pays off across every workflow that references the parts library. The implementation track will evaluate scope against Rev 1 capacity before committing to all of it.

The session concluded with a polish pass (commit `7b267e8`) that trimmed the View Management modal to its essential columns after an initial version was too wide and surfaced columns that were editorial concerns rather than management concerns. This trim illustrates the mockup track's value: the over-wide modal was built, reviewed visually, and corrected in the same session rather than surfacing post-implementation.

### Design decisions made

#### 1. Pattern E (named Views) over Pattern A (column toggles only)

**Question:** Should column visibility be ad-hoc per-session adjustments, or should it support saved, named configurations?

**Options considered:**
- Pattern A: a column picker with session-only state — visible columns reset on page reload
- Pattern E: named, persistent Views with column visibility, sort, and filters combined
- Hybrid: Pattern A in Rev 1, Pattern E deferred to Rev 2

**Decision:** Pattern E for Rev 1.

The hybrid would have produced a half-feature that users would find frustrating: they would invest effort configuring columns and filters, close the tab, and have to rebuild from scratch the next time. Pattern A alone would have required users to reconstruct their preferred view configuration every session, which conflicts with the design principle that the grid should be a durable operational tool rather than a scratch surface. Pattern E lets common operational questions ("Material Audit", "Inventory Check", "No Routing Flagged") get encoded once and reused by the whole team.

**Implication:** requires a Views data model (name, visible columns with order, default sort, filter array, default flag), a View switcher UI, a modification UI, and a management modal. Substantially more implementation work than Pattern A, justified by alignment with the "interrogate freely" design principle.

#### 2. Views are shared across users, not per-user

**Question:** Should each user maintain their own set of Views, or do Views exist at the system level and are visible to all users?

**Options considered:**
- Per-user: each user has their own Views; other users' Views are not visible
- Shared: Views exist at the system level; all users see and use the same set
- Hybrid: shared base Views with per-user overlays (personal Views layered on top of system Views)

**Decision:** Shared.

In a small-shop context (six to ten users), workflow overlap is significant. If a shop manager builds a "Material Audit" View, every operator benefits from it being available without having to recreate it. The cost of reinventing Views per-user outweighs the benefit of personalization at this scale. Shared Views also keep the implementation materially simpler: one Views table, no user→views junction, no merging logic between system and personal Views.

**Implication:** any user with grid access sees the same set of Views. Creating, editing, and deleting Views may warrant permission gating (documented as an open question below); the mockup assumes any user can do these operations.

#### 3. Column-header menus replace the filter bar

**Question:** Where do filters live in the UI?

**Options considered:**
- Keep the inline filter bar as described in spec (input row beneath the column headers)
- Replace with column-header menus (spreadsheet pattern: click a header chevron to sort, filter, or hide that column)
- Hybrid: quick-filter shortcuts inline plus header menus for full control

**Decision:** Full column-header menu replacement.

Reasons: consistency (one filter pattern, one place to look rather than two), discoverability (every column exposes the same affordances via the same interaction), space efficiency (no chrome row above the grid devoted to filter UI, which matters on dense grids), and parity with spreadsheet tools the user is migrating from. The inline filter bar requires users to locate the right input field in a separate UI zone; the header menu puts the filter affordance on the column itself, which is the natural association.

**Implication:** every column header has a hover-visible chevron menu trigger and supports right-click. Active filters are indicated by a funnel icon on the header with a hover tooltip describing the active filter. Filter popovers are type-specific (text operators for string columns, range operators for numeric and date columns, multi-select for categorical columns, etc.).

#### 4. AND-only filter combination

**Question:** Should multiple active filters combine via AND only, or should the system support OR with visual grouping (e.g., "material = Aluminum OR material = Steel")?

**Options considered:**
- AND only: all active filters must be satisfied simultaneously
- AND + OR with grouping: user can specify which filters combine with OR

**Decision:** AND only for Rev 1.

AND matches the "narrow down to answer my question" mental model the user articulated — each additional filter further restricts the result set. OR adds significant UX complexity (grouping UI, filter relationship visualization, precedence rules) for what is likely a minority of operational questions. If users need OR-style behavior, they can save a View that pre-filters to a relevant subset and then narrow from there; alternatively they can compare across two Views. This can be revisited if operational feedback reveals common questions that require OR.

#### 5. Routing column filter supports include AND exclude semantics

**Question:** Should the Routing filter support both "contains process X" and "does NOT contain process X"?

**Options considered:**
- Include-only: filter to parts whose routing includes a specific process (matches the spec's deferred "Includes Process" Rev 2 filter)
- Include + exclude: filter to parts whose routing includes a specific process, or explicitly exclude parts whose routing includes a specific process

**Decision:** Include + exclude.

The user's existing spreadsheet allows both operations; including this in Rev 1 maintains parity with the tool being replaced. The UI is a two-radio-column layout per process type: one column for "exclude" (parts whose routing includes this process are hidden), one for "include" (show only parts whose routing includes this process), mutually exclusive per row, default neither (unconstrained). This design makes it visually clear that include and exclude are mutually exclusive for any given process type.

**Implication:** the spec's "Includes Process" filter, originally deferred to Rev 2, is brought into Rev 1 with expanded semantics (include + exclude). The implementation track should evaluate this against Rev 1 scope; if include-only is more tractable, it is still a net advancement over the original spec.

#### 6. View carries columns + sort + filters; user can override any ad-hoc

**Question:** What exactly does a View persist, and what can the user change without modifying the saved View?

**Decision:** A View saves visible columns (with order), default sort (column + direction), and a filter array. The user can change any of these ad-hoc without dirtying the saved View definition: column visibility via a Columns picker control (session-level overlay on the View's column list), sort via clicking column headers, filters via column-header menus.

When the user makes ad-hoc changes that diverge from the saved View, the View switcher shows a "modified" indicator. The user can then: Save (overwrites the saved View with current state), Save as new (creates a new View with current state, prompting for a name inline), or Revert (discards ad-hoc changes, restores saved View state).

Rationale: trust the user with tools. They should be able to interrogate freely — adding a filter or sorting a column mid-session — without ceremony. They should also be able to preserve a configuration they have built up if it's worth keeping. The modified indicator is the minimal signal needed to close the loop between "this is what I saved" and "this is what I'm currently looking at."

#### 7. Save (overwrite) requires confirmation; Save as new and Revert do not

**Question:** Which modification actions need confirmation gates?

**Decision:** Save (overwrite) gets a confirmation dialog; Save as new and Revert do not.

Save (overwrite) is destructive on a shared resource — it replaces a View that all users rely on. The confirmation dialog explicitly mentions that other users will see the change, which is important because Views are shared (decision 2). Save as new is additive (creates a new View, no existing View is harmed). Revert discards the user's own ad-hoc changes and restores the saved state, which is low-stakes — the user can immediately re-apply any changes they discarded.

#### 8. Switching Views resets ad-hoc changes

**Question:** When the user switches to a different View, do their ad-hoc filters and column changes persist into the new View, or does the new View start clean?

**Decision:** Reset. Switching to a View loads that View's saved columns, sort, and filters fresh, discarding any ad-hoc changes from the previous View.

A View represents a defined frame for asking a specific question; switching to a new View should enter that frame's defined state. If the user wants filters to persist across Views, they should save those filters into the View before switching. The alternative — carrying ad-hoc state across View switches — would produce confusing behavior where the "Inventory Check" View shows filters from "Material Audit" that the user forgot they had active.

#### 9. "All Parts" default View shows every column

**Question:** What does the default View show when the user first opens the grid?

**Decision:** Every column. The user's design principle is "show everything and let them remove what they don't need." Discovering that a column exists is harder than hiding a column you don't need.

**Implication:** the All Parts View has approximately twenty-three columns at full build-out (including Rev 2 columns) and produces horizontal scroll at typical viewport widths. The user accepts horizontal scroll as the cost of complete visibility by default. In the mockup, the full column set with realistic content is demonstrated; the scroll behavior is intentional.

#### 10. Sparse Views size to content, not container width

**Question:** When a View has few columns (e.g., a focused View with four or five columns), should the columns stretch to fill the full container width, or should they pool to the left with the right side of the container empty?

**Options considered:**
- Stretch: columns expand to fill the container (similar to some table frameworks' default behavior)
- Pool left: columns take their natural width; right side of container is empty space

**Decision:** Pool to the left.

Stretching produces excessive horizontal gaps between columns when the column count is low — a three-column View at 1400px would produce columns that are ~450px wide each, which hurts scannability. Pooling to the left keeps columns at their natural content-appropriate widths and leaves whitespace on the right, which is visually cleaner and matches the user's expectation from spreadsheet tools.

### Recommendations for implementation

These recommendations are specific enough that the implementation track can act on them without re-deriving context from this exploration.

- **Views data model:** a `views` table with columns: `name` (string), `is_default` (boolean), `visible_columns` (ordered JSON array of column identifiers), `default_sort` (JSON: `{column, direction}`), `filters` (JSON array of filter objects). Shared at the system level — no user foreign key.

- **Column-header menu UI:** each column header renders a hover-visible chevron (dropdown trigger) exposing: sort ascending, sort descending, clear sort, separator, filter (opens type-appropriate popover), separator, hide column. Right-click on header opens the same menu. Active sort direction is indicated by an arrow icon on the header.

- **Active filter indicators:** when a column has an active filter, a funnel icon appears on the column header. Hovering the funnel shows a tooltip describing the active filter in plain language (e.g., "Material contains 'Alum'"). This is the primary mechanism for a user to know which columns are currently filtered without opening each column's menu.

- **Columns picker control:** a standalone button in the grid toolbar (separate from the Views system) that opens a panel listing all columns with checkboxes. This is the session-level column visibility override — changes here mark the View as "modified" but do not save to the View definition. The picker is the escape hatch when the user wants to temporarily add or remove a column without formally editing the View.

- **View modification UI:** when the active View's current state differs from its saved state, a "modified" badge appears on the View switcher. An adjacent dropdown exposes: Save (with confirmation dialog noting the shared-resource nature of the change), Save as new (opens an inline name input, Enter to confirm), Revert (restores saved state, no confirmation).

- **View management modal:** accessible from the View switcher. Shows a table of Views with: Name (editable inline), Default (radio selection — only one View can be default), Duplicate action, Delete action (gated — the current default View cannot be deleted; the last remaining View cannot be deleted). Column visibility, sort, and filters are not editable from this modal — those are set via the grid itself and then saved.

- **Rev 2 columns acknowledged in schema planning:** the columns explored in the mockup that go beyond the current Rev 1 schema — vendor part number, model link, drawing link, bin minimum/maximum, part cost, cost last updated, machine cycle time, number of setups, material form (as a separate field from material name) — should be planned as Rev 2 additive schema additions. Designing the Views column identifier system to accommodate these now (by treating column IDs as strings rather than enums) means the upgrade path is seamless.

- **Routing filter:** implement with include/exclude semantics as described in decision 5. The UI is a two-column radio matrix (exclude | include) per process type, mutually exclusive per row, default unconstrained.

- **AND-only filter combination** for Rev 1, as described in decision 4. No OR grouping, no filter precedence UI.

- **ProcessTypeChip width standardization:** the chip width reduction (from wider to narrower compact chips) in commit `34f2533` affected both the Parts Master grid and the Routing Templates grid. Any component using `ProcessTypeChip` in compact mode should inherit the narrower dimensions. Implementation should use a single shared component rather than duplicating the chip across views.

### Open questions for implementation track

These are infrastructure questions the mockup did not model and that the implementation track needs to decide.

- **Views persistence layer:** database table design, schema, and migrations for the Views system. The mockup uses in-memory state initialized from a seeded array. The implementation needs to decide on the schema (see recommendation above), handle the default View bootstrap, and define the API endpoints (`GET /api/v1/parts/views`, `POST`, `PATCH /api/v1/parts/views/:id`, `DELETE`).

- **Views permissions:** can any authenticated user create, edit, and delete Views, or is this an admin-only operation? The mockup assumes any user can do all View operations. In a small-shop context with trusted users this may be acceptable; however, a user accidentally deleting the shared "Inventory Check" View that the whole team relies on is a meaningful risk. Options: admin-only creation/deletion with any-user editing, or confirmation gates only (current mockup approach), or a locked "system Views" concept alongside user-creatable Views.

- **View versioning and schema evolution:** what happens when a column referenced in a saved View's `visible_columns` array is later removed or renamed (e.g., a Rev 2 schema change renames a field)? The mockup does not model this. A reasonable answer: the View silently omits column identifiers it does not recognize. A better answer may be a migration step when schema changes touch column identifiers. This needs a decision before Views are persisted.

- **Bootstrap state:** the mockup ships with several seeded Views (All Parts, Material Audit, Inventory Check, etc.). Production needs an answer for how an empty system gets its first Views — likely a database seed or an admin onboarding flow that creates default Views on first launch.

- **Performance at scale:** the mockup has approximately fifteen parts. Real datasets may have thousands. Filter and sort performance at scale needs validation, particularly for deep filter operators (text contains, date range, routing include/exclude with join semantics) on large datasets. Indexing strategies should be considered early if the parts table is expected to grow significantly.

- **Sticky columns:** deferred from this session (explicitly accepted by the user as out of scope for this round). The user flagged interest in pinning Part Number and Part Name columns during horizontal scroll, which would require sticky column implementation. Flagged here so it is not re-evaluated from scratch when revisited.

### Mockup-only refinements

These are things explored in the mockup that are NOT recommended for the implementation track to carry forward verbatim, or that are visual/dimensional decisions the implementation track can adjust without breaking design intent.

- **Specific chip dimensions:** the compact ProcessTypeChip is 16px wide at the reduced size. This is a visual tuning decision reached iteratively in the session, not a design language specification. Implementation should produce chips that feel compact and readable; exact pixel values can shift based on the font and spacing system in the production implementation.

- **Specific modal widths:** the View Management modal uses `max-w-lg`. The Columns picker popover uses a fixed width. These are reasonable starting points but are visual sizing decisions, not architectural constraints — the implementation team can adjust these based on the actual content that appears in the production UI.

- **Dummy data values:** the mockup uses approximately fifteen mock parts with realistic but fabricated field content. This data is for demonstration only. The production implementation uses real data from the database; no mockup data should be copied or referenced in the implementation.

- **Categorical filter exclude operator not implemented:** categorical filter popovers (e.g., Material filter with a list of material values) support "is any of" (include) but do not yet support "is none of" (exclude). This asymmetry was noted as a known limitation — the Routing filter has exclude semantics but general categorical filters do not. Documenting here so this is not re-explored from scratch; if the implementation track adds it, the Routing filter's include/exclude matrix is a good interaction pattern reference.

- **Light mode aesthetic:** the current mockup state is functional but visually unpolished. The user has noted interest in revisiting the visual design post-Rev 1 with specific design intent (typography, color system, spacing rhythm) rather than as a parity exercise against the current mockup. The mockup's visual state is not a target for the implementation; it is a functional skeleton.

---

## Cross-Surface Decisions

Design and implementation decisions that apply across multiple surfaces and are tracked here rather than inside a single session entry.

### Condense toggle as cross-surface viewing affordance

The Condense toggle (a shadcn Switch labeled "Condense") appears in
multiple mockup surfaces: the execution lens views (where it
originated), the Routing Template Library, and is planned for the
Parts Grid. The toggle controls whether ProcessTypeChip instances
render in compact mode (color swatch only) or normal mode (color
stripe with label).

Intent: surfaces that show routing step sequences in dense tabular
contexts benefit from a viewing-density control. Labeled chips are
more readable; compact chips fit more sequence detail in less
horizontal space. The toggle lets users choose per-surface based on
their current task.

Implementation choices made for Rev 1:
- The toggle is implemented as a shared component
  (/components/condense-toggle.tsx) for reuse across surfaces.
- Condense state is per-surface (each surface holds its own
  useState). Not currently a user-wide preference. Different
  surfaces declare different defaults: the Routing Template Library
  defaults to non-condensed (labeled chips); the Parts Grid will
  default to condensed (density at scale matters more there).
- If a global preference layer is wanted later, the per-surface
  useState can migrate to a shared hook without changing the
  component's API.
- Only the Sequence column (or equivalent) responds to condense.
  Other surface elements (legend bars, form fields, individual step
  cards in form UIs) always render at full label fidelity.

Discovered: Phase 2 Routing Template Library UI implementation.
First implementation: this commit. Next planned use: Parts Grid.

---

## Spec Gap: Location column missing from Stock Fulfillment candidate list

`spec/stock_fulfillment_view_spec.md` does not include an Inventory Location
column in the candidate table column list. During mockup iteration, Location
was added to support the physical pull step of fulfillment — planners need
to know where to walk. The data exists on Part and Assembly records
(`inventoryLocation` field) but the spec is silent on surfacing it.

**Gap:** The spec column list and column-placement rules need to be updated
to include Location (after Due Date, before Parent) with a note that null
values render as a dash and the purpose is operational pull-step support.

Discovered: Stock Fulfillment mockup iteration (Location column + expansion
row alignment pass).

---

## Session: Batching Lens — Mobility Bug Fix, Visual Refinements (2026-06-17)

### Commits in this session

1. `fix(mockup/batching): separate isRoot (visual) from isAnchoredRoot (drag-disable)` — Root WO mobility bug: all home-state chips were non-draggable, blocking manual batch formation entirely.
2. `fix(mockup/batching): increase anchor icon stroke weight to 2.5` — Anchor icon was too thin at default Lucide stroke weight.
3. `fix(mockup/batching): tighten composition cell height, center shell row text` — Shell rows were taller than needed and text was not vertically centered.
4. `feat(mockup/batching): parent column shows part name with ancestry tooltip` — Parent column displayed part number (opaque); changed to part name with closest-first tooltip.
5. `fix(mockup/batching): remove project filter from filter bar` — Project filter removed (see decision note below).

### Root WO mobility bug — root cause and fix

**Bug:** In `project-chip.tsx`, `useDraggable` was configured with `disabled: disabled || isRoot`. Since `isRoot` is true for every chip that is the root of its home row, and in the initial state every chip IS the root of its own row, all chips were non-draggable. Manual batch formation was impossible.

**Root cause:** A single prop (`isRoot`) was doing double duty: anchor icon display AND drag-disable control. The two semantics diverged: anchor display should fire whenever `wo.woId === hostWoId`; drag-disable should only fire when the root's row is in HOST state (root + guests present).

**Fix:** Introduced `isAnchoredRoot: boolean` — true when `wo.woId === hostWoId && chips.length >= 2`. Drag-disable keyed off `isAnchoredRoot`; `isRoot` retained for anchor icon display only. Same guard (`rowOccupancy > 1`) applied in `isEligibleTarget` in `_data.ts`.

**Design intent preserved:** Root chips in HOME state (row holds only the root, no guests) are fully draggable — that is the mechanism by which the planner pulls a root WO into another row to start a batch. Root chips in HOST state (row holds root + guests) are anchored and cannot be moved.

### Project filter removal — operational reasoning

The project filter was removed from the Batching Lens filter bar. Rationale: the batching lens is a cross-project composition surface. A planner forming batches needs to see WOs from multiple projects together in order to group them efficiently — e.g., two projects both needing the same machined part at similar priority should be visible in the same view so they can be co-batched. Filtering by project defeats this purpose.

The "All Projects" default was already the operative mode for any planner doing real batch composition; the filter existed as a UI affordance but was never operationally useful in the batching context. Removed to reduce filter bar noise and prevent unintentional narrowing.

If a future need arises to isolate one project's WOs within the batching lens (e.g., "show only P-1042's WOs so I can review what's been assigned"), that is a valid but secondary workflow that should be handled via a dedicated mode or toggle rather than the main filter bar.

### Deferred items

- **Pill shape visual polish:** chip shape and color-contrast refinements remain deferred to a dedicated visual polish iteration. No spec impact.
