# Tirion — WO Split Spec

## Purpose

WO Split is a Manager/Admin primitive that divides one Work Order into two WOs.
The original WO continues with reduced demand and its existing state intact;
a new WO is created with the carved-off demand and fresh routing progress.

WO Split is the system's mechanism for desynchronizing state across a portion
of work — when a manager needs to handle some units of a WO differently than
others. The split is permissive about the resulting state (managers shape it
within bounds), but the system enforces conservation rules so that no demand
or completed quantity is created or destroyed by the act of splitting.

The split closes out the original WO at its current production state: the
original ends up with Demand at or below its CompletedQty, effectively
wrapping it up. The remaining demand transfers to the new WO, which starts
fresh and proceeds through normal execution.

---

## Where Split Lives

WO Split is one of five Manager/Admin edit primitives (Loss, Rollback,
Return to Stock, WO Split, Cancel). It is also one of four Resolution
Types for Blockers (per `blocker_spec.md`).

**As a primitive:** triggered from the Manager/Admin Primitives section of
the side panel (per `detail_panel_spec.md`). Available from any management
view (Project View, Operations Lens) where the side panel is active.

**As a Blocker resolution:** triggered from the Blocker Section of the side
panel when resolving a Blocker on a WO with a quantity issue. The split
mechanic is identical; the Blocker is auto-resolved when the split commits.

---

## Eligibility Rules

A WO is eligible for Split when ALL of the following are true:

| Condition | Reason |
|-----------|--------|
| WOStatus = `Open` | Unreleased WOs have no progress to split around; Cancelled is terminal |
| WO is not an Assembly | Splitting Assembly WOs has cascading implications on child WOs that are out of scope for Rev 1 |
| WO is not in a Batch | Batched WOs share state; splitting a member would desync the batch. Manager must remove from batch first |
| User has Manager or Admin role | Split is a management action |

A WO is NOT eligible for Split when:

- WOStatus = `Unreleased` — no progress to split around. The manager has
  other tools for adjusting Unreleased WOs (cancel + reissue, edit demand
  pre-release).
- WOStatus = `Complete` — Complete WOs cannot be split directly. To split
  a Complete WO, the manager must first apply a Blocker to revert the WO to
  Open (Blocked) state. The Blocker provides the audit trail explaining
  why the Complete WO needed to be reopened. After Blocker creation, Split
  is available; the Blocker remains on the original WO post-split (the
  manager resolves it separately via standard Blocker workflows).
- WOStatus = `Cancelled` — terminal state.
- WO is an Assembly (`partType = Assembly`) — see Rev 2 Backlog.
- WO is a member of a Batch — manager must unbatch first via Batch Editor.

When eligibility fails, the Split action surfaces an explanatory message
indicating which condition blocks the action and (where applicable) the path
to resolve (e.g., "Apply a Blocker first" or "Remove from Batch [ID] first").

---

## Validation Rules (Hard Constraints)

The split modal enforces these constraints. The Confirm button is disabled
when any constraint is violated, with explanatory text indicating which rule
is unsatisfied.

| # | Rule | Reason |
|---|------|--------|
| WS-1 | New WO Demand > 0 | Split must carve off at least one unit |
| WS-2 | New WO Demand + Adjusted Demand on Original = Original pre-split Demand | Demand is conserved — the split does not create or destroy demand |
| WS-3 | Adjusted Demand on Original > 0 | Split must leave demand on the original; otherwise it's effectively a deletion, which uses the Cancel primitive |
| WS-4 | Adjusted Demand on Original ≤ Adjusted CompletedQty on Original (or Original CompletedQty is null) | Protects the original from being put into under-production Blocker state by the split. The split closes out the original at its current production |
| WS-5 | New WO CompletedQty + Adjusted CompletedQty on Original = Original pre-split CompletedQty | CompletedQty is conserved — the split does not create or destroy completed work |
| WS-6 | Both WOs: Planned Quantity ≥ Demand | Standard PQ rule; PQ is independently set per WO with no conservation requirement across the split |
| WS-7 | Note has been entered | Required for all primitives — captures the rationale for the split |

**Note on WS-4:** The rule allows `Adjusted Demand = Adjusted CompletedQty`
(perfect close-out) and `Adjusted Demand < Adjusted CompletedQty` (over-
production on original, handled at Distribution as overage). The rule
prevents `Adjusted Demand > Adjusted CompletedQty` on the original because
that would mean the original WO needs MORE production than it currently
has — which is the under-production condition that triggers a Blocker. The
split's purpose is to enable forward progress, not to manufacture new
problems on the original.

**Note on the New WO:** the new WO has no validation against under-production
at split commit. The new WO defaults to CompletedQty = 0 with all routing
fresh, so by default new WO Demand > 0 and CompletedQty = 0 — under-production
condition exists but is the natural state for a new WO that hasn't started
production yet. The new WO progresses normally through execution; no Blocker
is auto-created at split commit. If the manager manually adjusts the new
WO's CompletedQty during the draft to a non-zero value that creates an
inconsistency (e.g., entering CompletedQty without updating step states),
the existing under-production Blocker rule applies after split commit.

---

## Inheritance Rules

The new WO inherits the following from the original:

| Field | Inherited | Notes |
|-------|-----------|-------|
| `partId` | Yes | Same Part — split is for same-Part WOs only |
| `projectId` | Yes | Same Project |
| `parentWoId` | Yes | If original is a child component, new WO is also a child of the same parent Assembly. If original is top-level, new WO is also top-level (with new topLevelIndex — see below) |
| `topLevelIndex` | NO — fresh assignment | If original is top-level, new WO gets next available topLevelIndex per existing Add Top-Level Item logic |
| `routingTemplateDefinitionId` | Yes | Same routing template snapshot |
| `priority` | Yes | New WO inherits original's priority; manager can adjust post-split via standard inline edit |
| `dueDate` | Yes | Denormalized from Project; same Project means same due date |
| `WOStatus` | Always Open | New WO is always Open at creation, regardless of any other state inheritance — the new WO has fresh routing progress |
| `stockFulfillmentReviewedAt` | Yes (current timestamp if not already set) | Logically the new WO has been reviewed at the moment of split |
| `batchId` | NO | Split is blocked while batched; new WO is unbatched |

The new WO does NOT inherit:

- **Routing step progress** — new WO's WorkOrderSteps are created fresh.
  First step transitions to Ready immediately; all others are Waiting.
- **CompletedQty** — defaults to 0 unless manager explicitly assigns during
  the draft (subject to WS-5 conservation rule)
- **ScrapQty** — always starts at 0 for the new WO
- **Blockers** — new WO has no blockers at creation. If a blocker condition
  exists on the new WO post-commit (e.g., manually assigned CompletedQty
  creates inconsistency), the existing Blocker triggers fire normally
- **SupplyOrderLineAllocations** — new WO has no allocations. Material
  allocations remain attached to the original WO. If the new WO needs
  procurement, manager handles separately via Purchasing Lens / Supply Order
  management

The new WO inherits the following from any parent context (consistent with
inheritance from original):

- **Definition Change Flags** — if the original WO had open Definition
  Change Flags at split time, the new WO inherits a copy of each flag (same
  `changeType`, `changedEntityType`, `changedEntityId`, `changeAuditLogId`,
  `changeDescription`, `parentFlagId`). The original's flags remain attached
  to the original. Per `definition_change_flag_spec.md` BATCH-7.

---

## The Split Workflow

### Initiation

Manager clicks the Split action in the Manager/Admin Primitives section of
the WO's side panel. This is available from Project View, Operations Lens, and
any other management view that surfaces the side panel.

If triggered from a Blocker resolution context (Blocker Section in the side
panel, Resolution Type = WO Split), the workflow is the same except the
Blocker is auto-resolved when split commits.

The system performs eligibility checks. If the WO is ineligible, the modal
explains why and offers no further action.

If eligible, the system enters Draft View Mode.

### Draft View Mode

The current management view (Project View, Operations Lens, or other) enters
a special draft state:

- **All other rows grey out** and become non-interactive
- **The original WO row remains fully emphasized**
- **A new draft row is inserted directly below the original** representing
  the new WO being created — also fully emphasized
- The two emphasized rows display alongside each other as a paired unit

The new draft row inherits display from the original (same Part, same Project,
etc.) with the following editable fields:

| Field | Default | Editable | Validation |
|-------|---------|----------|-----------|
| Demand | (empty — manager enters) | Yes | Per WS-1 and WS-2 |
| CompletedQty | 0 | Yes | Per WS-5 |
| Planned Quantity | Equal to Demand once entered | Yes | Per WS-6 |

The original WO row's editable fields (in draft):

| Field | Default | Editable | Validation |
|-------|---------|----------|-----------|
| Adjusted Demand | (computed live as Original Demand minus New WO Demand) | Read-only — derived from new WO Demand input | Per WS-2, WS-3, WS-4 |
| Adjusted CompletedQty | (computed live as Original CompletedQty minus New WO CompletedQty) | Read-only — derived from new WO CompletedQty input | Per WS-5 |
| Planned Quantity | Original PQ | Yes | Per WS-6 (PQ ≥ Adjusted Demand) |

The Note field is always visible and required.

### Live Validation

As the manager types in editable fields, the system recomputes:
- Adjusted Demand on original (= Original Demand − New WO Demand)
- Adjusted CompletedQty on original (= Original CompletedQty − New WO CompletedQty)
- Whether all hard constraints (WS-1 through WS-7) are satisfied

If any constraint is violated, the Confirm button is disabled. An explanation
is visible (e.g., "Original Adjusted Demand (8) cannot exceed Adjusted
CompletedQty (5)" or "Note required").

When all constraints are satisfied, the Confirm button is enabled.

### Bright Blue Signaling

Following the Batching Lens convention, fields whose values would change as
a result of the split display in **bright blue**:
- Original WO's Adjusted Demand (was Original Demand, now lower)
- Original WO's Adjusted CompletedQty (if changed)
- Original WO's Adjusted Planned Quantity (if changed)
- All editable fields on the new WO row

This makes the impact of the draft immediately scannable.

### Confirm

Clicking Confirm initiates an atomic transaction:

1. Original WO's `quantity` field updated to Adjusted Demand
2. Original WO's `completedQty` field updated to Adjusted CompletedQty (if
   manager adjusted it during draft)
3. Original WO's `plannedQuantity` field updated (if manager adjusted)
4. New WO record created with all inherited fields + Demand, CompletedQty,
   PlannedQuantity from draft
5. New WO's WorkOrderStep records generated fresh from the routing template
   (first step Ready, all others Waiting)
6. New WO's `stockFulfillmentReviewedAt` set to current timestamp
7. Definition Change Flags on original WO copied to new WO (per BATCH-7)
8. AuditLog entries written:
   - `WOSplit` action on original WO (records: split-off quantity, new WO
     ID, note, before/after Demand and CompletedQty values)
   - `WOQuantityAdjusted` on original WO
   - `WOCreatedViaSplit` for new WO (records: source WO ID, inherited
     fields, initial state)
   - `DefinitionChangeFlagInheritedViaWOSplit` for any flags copied to
     new WO
9. If split was initiated as Blocker resolution: Blocker on original WO
   resolved with `resolutionType = WOSplit`, `resolutionNote = [user's
   split note]`, AuditLog entry for Blocker resolution

After commit:
- Draft View Mode exits
- View refreshes to show both WOs in their post-split state
- Other rows return to full visibility
- Toast confirms: "Split complete. Original WO [ID] adjusted to Demand [X];
  new WO [ID] created with Demand [Y]."

### Cancel

Clicking Cancel discards the draft. No state changes occur. Draft View Mode
exits and the original view returns to normal. No AuditLog entries are
written for cancelled splits.

---

## Post-Split State Considerations

Both WOs proceed through normal execution after the split. The following
behaviors apply naturally without special handling:

### Original WO Post-Split

- Continues with its existing state (current step state, batch membership
  if applicable... wait, batched is blocked — disregard, no batch)
- Existing Blockers continue (split does not auto-resolve unrelated Blockers
  on the original)
- Existing Definition Change Flags continue
- Existing SupplyOrderLineAllocations continue
- Continues to be visible in whatever execution lens is appropriate to its
  current step

If the original's Adjusted Demand equals its CompletedQty exactly, the
manager can mark the WO Complete via standard step completion. The system
does not auto-Complete the WO — that's a manager decision via existing
workflow.

If the original's Adjusted Demand is less than its CompletedQty, the WO
will surface overage at Distribution per the standard overage handling.

### New WO Post-Split

- Appears in execution lenses immediately (WOStatus = Open, first step Ready)
- Operator can begin work on the first step using standard execution flow
- If manager assigned CompletedQty during the draft, the new WO's recorded
  CompletedQty is non-zero but routing steps are all fresh — this is an
  inconsistency the existing system handles via Blocker triggers if applicable
- Definition Change Flags inherited from original need separate resolution
  (manager treats them as new flags requiring decision)
- No SupplyOrderLineAllocations — manager handles procurement separately if
  needed

### Top-Level WO Split

If the original WO is top-level (`parentWoId = null`, `topLevelIndex` set):
- New WO is also top-level
- New WO gets next available topLevelIndex per existing Add Top-Level Item
  logic (the next sequentially available number, not reusing prior suffixes)
- Top-Level Reference display shows them as distinct items (e.g., original
  is "98324.02", new is "98324.07" if .07 is next available)
- Project Status auto-transition logic counts both as separate non-Cancelled
  WOs that must complete before Project transitions to Complete

### Child Component WO Split

If the original WO is a child component (`parentWoId` set):
- New WO is also a child of the same parent Assembly (same `parentWoId`)
- The parent Assembly's child WO count increases by one
- The parent Assembly's readiness math denominator increases by one (was
  N/M, becomes N/(M+1))
- This may change the parent Assembly's readiness state (if it was Ready
  with the original about to complete, it may now need both the original
  AND the new WO to complete before being Ready)

This is operationally honest — the parent Assembly literally needs both
produced pieces to make sense. The manager should be aware that splitting a
component creates a new dependency on the parent.

---

## Blocker Auto-Resolution When Split Initiated as Resolution

When the split is initiated from a Blocker resolution context (Resolution
Type = WO Split per `blocker_spec.md`):

- The Blocker on the original WO is auto-resolved as part of the split commit
  transaction
- `resolutionType = WOSplit`
- `resolutionNote` = the user's split note
- `resolvedAt` = split commit timestamp
- `resolvedByUserId` = the user who confirmed the split

The new WO does NOT inherit the Blocker. New blockers on the new WO (if any)
fire via existing triggers based on the new WO's state.

If the original WO had multiple open Blockers, only the Blocker that triggered
the split resolution is resolved by this action. Other Blockers on the original
remain open and require separate resolution.

---

## Permissions

| Action | Operator | Lead | Manager | Admin |
|--------|----------|------|---------|-------|
| See Split action in side panel | — | — | ✓ | ✓ |
| Initiate Split | — | — | ✓ | ✓ |
| Confirm Split | — | — | ✓ | ✓ |
| Cancel Split (during draft) | — | — | ✓ | ✓ |

Operators and Leads do not see the Split action. If they encounter a
situation requiring split, they escalate to a Manager.

---

## Hard Rules Summary

| # | Rule |
|---|------|
| WS-1 | New WO Demand > 0 |
| WS-2 | New WO Demand + Adjusted Demand on Original = Original pre-split Demand (Demand conservation) |
| WS-3 | Adjusted Demand on Original > 0 (split must leave demand on original) |
| WS-4 | Adjusted Demand on Original ≤ Adjusted CompletedQty on Original (or CompletedQty is null) — protects original from split-induced under-production Blocker |
| WS-5 | New WO CompletedQty + Adjusted CompletedQty on Original = Original pre-split CompletedQty (CompletedQty conservation) |
| WS-6 | Both WOs: Planned Quantity ≥ Demand (no conservation rule for PQ across split) |
| WS-7 | Note required for split commit |
| WS-8 | Split is blocked on Unreleased, Complete, Cancelled, Assembly, and Batched WOs |
| WS-9 | Complete WOs require a Blocker before split — provides audit trail and reverts WO to Open state for splitting |
| WS-10 | New WO is always Open with fresh routing progress (first step Ready, others Waiting) regardless of original's specific Open sub-state |
| WS-11 | New WO inherits Definition Change Flags as copies; original retains its own flags |
| WS-12 | New WO does NOT inherit Blockers, SupplyOrderLineAllocations, or routing progress |
| WS-13 | Split commits are atomic: original adjustments, new WO creation, step generation, flag copying, audit logging, and Blocker auto-resolution (if applicable) all in one transaction |
| WS-14 | Top-level WO split: new WO gets next available topLevelIndex; appears as a new top-level item |
| WS-15 | Child component WO split: new WO inherits same parentWoId, increasing parent Assembly's child count and modifying readiness math |

---

## Schema Implications

This spec does not require new schema fields beyond what already exists. WO
Split uses existing fields:
- `WorkOrder.quantity` (modified on original, set on new WO)
- `WorkOrder.completedQty` (potentially modified on both)
- `WorkOrder.plannedQuantity` (potentially modified on both)
- `WorkOrder.parentWoId` (inherited)
- `WorkOrder.topLevelIndex` (fresh on new WO if top-level)
- `WorkOrder.routingTemplateDefinitionId` (inherited snapshot)
- `WorkOrder.stockFulfillmentReviewedAt` (set on new WO)

New AuditAction seed entries needed (additions to existing AuditAction lookup):
- `WOSplit` — the split action on the original WO
- `WOCreatedViaSplit` — distinguishes split-created WOs from compile-created
  WOs in audit trail
- (`WOQuantityAdjusted` and `DefinitionChangeFlagInheritedViaWOSplit` already
  exist or are part of the reconciliation pass schema additions)

These should be added to `schema.md` AuditAction seed table.

---

## Design Notes

- The split is intentionally narrow in scope. The system enforces conservation
  (Demand and CompletedQty totals preserved) and protects the original WO
  from split-induced Blocker state. Everything else is the manager's decision,
  with downstream rules (under-production Blocker, Distribution overage)
  handling consequences naturally

- The "permissive system, thoughtful manager" principle applies. The system
  doesn't try to validate every possible inconsistency the manager might
  create. If the manager assigns CompletedQty to the new WO that creates a
  Blocker condition, the system flags it post-commit via existing rules

- The Draft View Mode reuses the visual conventions established in Batching
  Lens (other rows greyed, focused rows fully emphasized, bright blue for
  modified values). This keeps the interaction model consistent across
  manager surfaces

- Splitting requires an Open WO with progress. The exclusion of Unreleased,
  Complete, and Cancelled WOs reflects the use cases: split is for taking a
  WO that's mid-execution and dividing it. WOs without progress (Unreleased)
  or with terminal status (Complete, Cancelled) require different tools

- The Complete-WO-via-Blocker requirement is intentional. It forces an
  explicit "I'm reverting this Complete WO into operational state because of
  [issue]" record before the split. Without the Blocker requirement, splits
  could be applied to Complete WOs silently, losing the audit context

- Assembly WO split exclusion is significant. Splitting an Assembly mid-
  flight has implications for child WOs (do they re-allocate? does the new
  Assembly need new child WOs generated?) that exceed Rev 1 scope. Managers
  who need to handle Assembly modifications use other primitives (Component
  Added flag resolution, Cancel + Component Added) per `definition_change_flag_spec.md`

- Batched WO split exclusion (manager must unbatch first) reflects the
  underlying principle that batches share state. Splitting a batched member
  would desynchronize the batch — and the only reason to split is to
  desynchronize state. So the system requires explicit unbatching first

- The new WO's WOStatus = Open is the only valid initial state. The new WO
  has fresh routing progress; it's by definition past planning (Stock
  Fulfillment, Batching Confirm). Treating it as anything other than Open
  creates inconsistency with its routing state

---

## Rev 2 Backlog

- **Assembly WO Split** — Splitting an Assembly mid-flight requires handling
  child WO implications (re-allocation? auto-generation of child WOs for the
  new Assembly?). Out of scope for Rev 1
- **Add WIP WO to Existing Batch** — currently batched WOs are formed only
  via Batching Lens Confirm or Batch Editor restructuring. Allowing a WIP
  WO (post-Batching-Confirm) to join an existing batch would smooth some
  workflows but adds complexity. Worth considering as a Rev 2 enhancement
- **SupplyOrderLineAllocation splitting** — Rev 1 allocations stay attached
  to the original WO. Rev 2 material handling improvements may include
  proportional or user-specified splitting of allocations
- **Split with state inheritance** — currently new WO always starts fresh.
  Future enhancement could allow the new WO to inherit specific routing
  progress states from the original (proportional inheritance, or user-
  specified state per step)

---

## Open Items for Reconciliation

- **Schema:** add `WOSplit` and `WOCreatedViaSplit` to AuditAction seed
- **Detail Panel spec:** Cancel and WO Split are both listed as Manager
  primitives; verify ordering and presentation
- **Blocker spec:** ensure WO Split as Resolution Type cross-references this
  spec (currently references "the WO Split workflow" which is now defined here)
- **Project View spec:** add WO Split to the State Edits triggers list
  (currently lists Cancel but not Split)
