# Tirion — Blocker Spec (Creation and Resolution)

## Purpose

Blockers are the primary exception mechanism in Tirion. They represent
situations where work cannot proceed due to an external or internal issue.
All blockers require explicit creation, explicit resolution, and a note at
both events.

Normal flow is implicit. Blockers surface the exceptions.

---

## Blocker Lifecycle

A blocker progresses through three possible states:

```
   Open  →  Pending Resolution  →  Resolved
     │            │
     │            └── (optional intermediate state — Manager/Admin uses to claim ownership)
     │
     └─────────────────────→  Resolved (direct path)
```

| State | Meaning | Derivation |
|-------|---------|------------|
| Open | Blocker exists; no one has formally claimed it | `pendingAt = null AND resolvedAt = null` |
| Pending Resolution | Manager/Admin has acknowledged and is actively working on it | `pendingAt IS NOT NULL AND resolvedAt = null` |
| Resolved | Blocker has been resolved with a resolution type and note | `resolvedAt IS NOT NULL` |

**Pending Resolution is optional.** A blocker can transition Open → Resolved
directly. Pending Resolution exists for cases where:
- Multiple managers are looking at the same blocker and one wants to claim ownership
- Resolution will take time and needs to be visible as "in progress" rather than "Open"
- Audit trail benefits from showing who picked up the blocker and when

---

## Blocker Creation

### Who Can Create Blockers
- Operators: can block work in their own process lens / station
- Managers and Admins: can block from any view

### What Can Be Blocked
- A Work Order (when unbatched)
- A Production Batch (when the WO is batched — the blocker applies to the batch)
- Exception: Assembly blockers apply only to the assembly's own routing steps,
  not to its child WOs

### Required Inputs
- Note (required — no silent blockers)
- Category: Local or Escalated (optional classification, defaults to Local)

### Behavior on Creation

Atomic transaction:
1. Entity state set to Blocked
2. If the WO is batched: the Batch state is set to Blocked
3. Blocker record created with:
   - `entityType` (WorkOrder | Batch)
   - `entityId`
   - `processTypeId` (the process where the block was raised)
   - `category` (Local | Escalated)
   - `createdByUserId`
   - `createdAt`
   - `note`
   - `preBlockerState` — see below
4. AuditLog entry written

### preBlockerState Capture

At blocker creation, the system captures `preBlockerState` — the state of the
blocked entity's affected step at the moment of blocker creation. This typically
captures the WorkOrderStep state of the active step (e.g., `Ready`, `Started`).

This value is used at resolution time:
- For `Cleared` resolution: the entity's affected step state is restored to
  `preBlockerState`
- For other resolution types: `preBlockerState` is recorded in audit but may
  not be the post-resolution state (since the resolution restructures things)

**Hard rule:** preBlockerState is captured atomically with blocker creation.
It is immutable after creation. This ensures the system can faithfully restore
state on Cleared resolution even if other state changes have happened in the
meantime (which they shouldn't, since the entity is Blocked).

### UI Access
- Accessible from any process lens side panel via "Create Blocker" action
- "Create Blocker / Resolve Blocker" control is always visible in the panel
  when a row is selected — operators should never have to hunt for it

---

## Pending Resolution Transition

A Manager or Admin can transition an Open blocker to Pending Resolution to
signal active ownership.

### Required Inputs
- Note (optional — context about what's being investigated or who's owning it)

### Behavior
- `pendingAt` set to current timestamp
- `pendingByUserId` set to acting user
- Entity remains in Blocked state
- AuditLog entry written

### UI Access
- "Mark Pending Resolution" button in the side panel for any Open blocker
- Available to Manager and Admin only
- Operators see the status change but cannot trigger it

### Transition Reversibility

Pending Resolution can be reverted to Open if the claiming user changes their
mind or hands off:
- `pendingAt` cleared to null
- `pendingByUserId` cleared to null
- AuditLog entry written
- Available to the user who set Pending Resolution OR any Manager/Admin

---

## Blocker Resolution

### Resolution Types

**1. Cleared**
The issue is resolved with no structural change to the WO or batch.
- Resolution note required
- Entity's affected step state restored to `preBlockerState`
- If WO is batched: Batch state restored to its pre-blocker state
- Available to: Operators (their station only), Managers, Admins

**2. Batch Adjustment**
The blocked batch is restructured — WOs are reassigned to other batches or
left unbatched — until the blocked batch reaches a valid state.
- Uses the Batch Adjustment Workspace (see below)
- Available to: Managers and Admins only
- Only applies when the blocked entity is a Batch

**3. Routing Rollback**
The blocked entity's routing is rolled back — all downstream steps reset to
Waiting.
- Resolution note required
- All steps with a higher stepIndex than the blocked step return to Waiting
- Upstream steps administratively marked complete (no false production logs
  created)
- Available to: Managers and Admins only

**4. WO Split**
The blocked WO is divided into two WOs to isolate the issue from the
remainder.
- Uses the WO Split workflow (see WO Split section)
- Available to: Managers and Admins only
- The blocker resolves as the split commits; one of the resulting WOs may
  carry forward the blocked state if the issue persists on that portion

### Resolution Workflow (All Types)
1. User selects resolution type
2. User performs required actions for that type (workspace, split workflow, etc.)
3. User enters resolution note (required)
4. User submits
5. Atomic transaction:
   - Resolution-type-specific state changes execute
   - Blocker `resolvedAt` set, `resolvedByUserId` set, `resolutionType` set,
     `resolutionNote` set
   - Entity transitions out of Blocked state per resolution type
   - AuditLog entries written
6. Panel closes and returns to originating view, refreshed

### Resolution from Pending Resolution

A blocker in Pending Resolution can resolve directly without first reverting
to Open. The resolution workflow is identical regardless of starting state
(Open or Pending Resolution).

The audit trail captures both transitions: who marked Pending and who
resolved (which may be the same user or different users).

---

## Schema Fields

The Blocker record carries the following fields relevant to lifecycle:

```prisma
model Blocker {
  blockerId           Int            @id @default(autoincrement())
  entityType          String         // 'WorkOrder' | 'Batch'
  entityId            Int
  processTypeId       Int
  category            BlockerCategory @default(Local)
  preBlockerState     String         // Captured at creation; e.g., 'Ready', 'Started'
  note                String         // Required at creation
  createdByUserId     Int
  createdAt           DateTime       @default(now())
  pendingAt           DateTime?
  pendingByUserId     Int?
  resolvedAt          DateTime?
  resolvedByUserId    Int?
  resolutionType      ResolutionType?
  resolutionNote      String?

  // Relations omitted for brevity — see schema.md
}

enum BlockerCategory {
  Local
  Escalated
}

enum ResolutionType {
  Cleared
  BatchAdjustment
  RoutingRollback
  WOSplit
}
```

Status (Open / Pending Resolution / Resolved) is derived from the timestamps
per the Blocker Lifecycle table above. No separate status field is stored.

---

## Batch Adjustment Workspace

The Batch Adjustment Workspace is the manager workflow for resolving a blocker
on a blocked batch by reshaping which WOs belong to it until the draft state
is valid, then confirming the result.

### Entry Conditions
- Blocked entity must be a Batch (not a single WO)
- User must have Manager or Admin role
- Not available from operator station views

### Core Design Decisions (Locked)
- The workspace maintains a working draft. No change is committed until
  final confirmation.
- If the user exits before confirming, all provisional changes are discarded.
- Demand moves immediately with each draft WO reassignment (live validation).
- Current quantity stays fixed for every affected batch during the session
  and is used as the validation reference.
- A blocked batch becomes submittable when its draft demand ≤ its fixed
  current quantity, OR when it is fully dissolved.
- If the blocked batch fully dissolves, one resulting WO must inherit the
  blocked batch's current quantity.
- Routing history must not be falsified. When a new batch is positioned at
  a later routing step, upstream steps are administratively treated as complete
  without creating false production logs.

### Interaction Model

The Batch Adjustment Workspace should reuse the chip-based Composition Column
interaction model defined in the Batching Lens spec to maintain mental-model
consistency. Specifically:
- Chips represent member WOs
- Drag-and-drop between containers (batches and standalone destinations)
- Bright blue signaling for draft modifications
- Aggressive ineligibility greying during placement

See the Batching Lens spec (Composition Column section) for the canonical
interaction definition. Differences specific to Batch Adjustment (e.g.,
restructuring existing members rather than placing new candidates) should be
documented in this section but maintain the underlying interaction primitives.

### Workspace Layout

**Blocked Batch Header**
- Batch ID, Part/Assembly ID, Priority, Due Date
- Planned Qty, Current Qty, Original Demand Qty, Draft Demand Qty
- Current Process, validity indicator
- Existing blocker notes (read-only)

**Affected WO List**
All WOs currently in the blocked batch. Each row shows:
- WO ID, demand qty, project ID, due date, priority
- Current draft location (chip placement)
- Move/edit control

**Destination Areas**
- Existing eligible batches (same PartID, unstarted)
- Eligible unbatched WOs
- Empty row (create new batch destination)

### Validation
- Blocked batch is submittable when draft demand ≤ current quantity
- All affected batches must show current qty, original demand, and draft demand
  as the user edits so the valid end state is always visible
- Final confirmation screen shows all resulting changes before commit

---

## WO Split

WO Split is both a Resolution Type for blockers and a standalone management
action. The full WO Split workflow specification is in `wo_split_spec.md`.

This section captures the blocker-resolution-specific aspects:

### When Used as Blocker Resolution
- The blocked WO is divided into two new WOs per the WO Split mechanic
  defined in `wo_split_spec.md`
- The split allows isolating the blocking issue to one of the resulting WOs
  while the other can proceed
- The Blocker on the original WO is auto-resolved as part of the split
  commit transaction (`resolutionType = WOSplit`, resolution note = the
  user's split note)
- The new WO does NOT inherit the Blocker. New blockers on the new WO (if
  any) fire via existing triggers based on the new WO's state
- If the original WO had multiple open Blockers, only the Blocker that
  triggered the split resolution is resolved by this action

### When Used as Standalone Action
- Available outside blocker resolution context for managers/admins who need
  to split a WO for any reason (partial completion, isolating defects,
  redistribution of work)
- Same underlying mechanics; no blocker resolution side effect
- Initiated from the Manager/Admin Primitives section of the side panel

See `wo_split_spec.md` for the complete specification including eligibility
rules, validation constraints, draft view workflow, and inheritance rules.

---

## Cancel Primitive — Reference

The Cancel primitive (introduced via the Definition Change Flag system) is a
fifth WO state-changing action available to Manager/Admin on leaf WOs. While
Cancel is not a Blocker resolution type, it is a related management action
that may be used in conjunction with blocker workflows.

For example: a manager facing a blocked WO that should not have been issued
in the first place may:
1. Use the Cancel primitive on the blocked WO directly
2. The Cancel transitions WOStatus to Cancelled, which is a terminal state
3. The Blocker on the now-Cancelled WO is auto-resolved with system-generated
   note: "Auto-resolved: WO Cancelled."

See `definition_change_flag_spec.md` for the full Cancel specification.

---

## Auto-Created Blockers

The system automatically creates blockers in specific scenarios where data
inconsistency is detected. These follow the same Blocker lifecycle but are
created without explicit user action.

### Component Added Flag Resolution on Past-Waiting Parent

When a Component Added Definition Change Flag is resolved via Accept Change
on a parent Assembly WO that is past its first routing step's Waiting state
(i.e., its first step is Ready, Started, or Complete, OR the WO itself is
Complete):

- Automatic Blocker created on the parent Assembly WO
- `entityType = WorkOrder`
- `entityId = parent Assembly WO ID`
- `processTypeId = parent's first routing step's process type`
- `category = Local`
- `preBlockerState = parent's first step's current state`
- `createdByUserId = system user ID` (or the user who resolved the flag,
  with note attribution)
- System-generated note: "BOM change added child component(s) [Part X qty N];
  assembly readiness invalidated. New child WOs: [WO IDs]. Resolve once new
  children complete."

The blocker is then resolved by a manager via standard blocker workflows
(typically Cleared once the new child WOs complete and the assembly is
genuinely ready, or Pending Resolution while waiting).

### Demand Increase Creating Under-Production Condition

When a BOM Quantity Change is resolved via Accept Change and the resulting
cascaded new Demand on a child WO exceeds that WO's CompletedQty (under-
production condition):

- The existing under-production Blocker rule fires automatically (per Object 1
  Completion Rules in `state_model.md`)
- This is not a special flag-resolution behavior — it is the standard system
  response to any condition where Demand > CompletedQty on a WO past its
  production phase

No new logic is needed for this — the standard rule handles it. This section
exists only to document the connection between Demand-increase flag resolutions
and the resulting Blocker conditions.

**Note:** The opposite case (Demand decrease below CompletedQty, resulting in
over-production) does NOT create a Blocker. Over-production is handled at
Distribution as overage routing to stock. Only under-production (insufficient
CompletedQty to satisfy current Demand) is a Blocker condition.

---

## Logging

All blocker events are written to AuditLog:
- Blocker creation: entity, process, category, note, user, timestamp,
  preBlockerState
- Pending Resolution transition: user, timestamp, optional note
- Pending Resolution revert (if applicable): user, timestamp
- Resolution: resolution type, note, user, timestamp, before/after state,
  attached resolution-specific records (split WO IDs, batch adjustments, etc.)
- All batch reassignments during workspace sessions
- Final confirmation of workspace sessions
- Auto-created blocker events: include source context (flag ID, etc.)

---

## Hard Rules

| # | Rule |
|---|------|
| BLK-1 | Blockers require a note at creation. No silent blockers |
| BLK-2 | Blockers require a resolution note. No silent resolution |
| BLK-3 | Pending Resolution is optional — blockers can resolve directly from Open |
| BLK-4 | Pending Resolution is Manager/Admin only. Operators cannot trigger this transition |
| BLK-5 | preBlockerState is captured atomically at blocker creation and is immutable |
| BLK-6 | Cleared resolution restores entity step state to preBlockerState |
| BLK-7 | Resolution types: Cleared (any role on own station), BatchAdjustment (Manager/Admin, batch only), RoutingRollback (Manager/Admin), WOSplit (Manager/Admin) |
| BLK-8 | Auto-created blockers (e.g., from Component Added flag resolution) follow the same lifecycle and resolution workflows as user-created blockers |
| BLK-9 | A blocker on a WO that gets Cancelled is auto-resolved with system-generated note |
| BLK-10 | Routing history must not be falsified. RoutingRollback marks downstream steps Waiting; upstream "completed" steps are administrative only and do not generate false production logs |

---

## Design Notes

- The "Create Blocker / Resolve Blocker" control should always be visible in
  the side panel when a row is selected. Operators should never search for it.

- The workspace model for Batch Adjustment is intentional — users are shaping
  a valid end state, not executing a sequence of system commands. The draft-
  then-confirm pattern matches the mental model of the task.

- Resolution notes are not optional. Every resolved blocker has a note
  explaining what was done. This is the audit trail for exception management.

- Pending Resolution exists primarily for visibility and ownership. In small
  shops with one or two managers, it may rarely be used (managers just resolve
  directly). In larger shops or for blockers requiring extended investigation,
  it provides clear signal that someone is on it.

- preBlockerState capture is critical for clean Cleared resolution. Without
  it, the system would have to guess what state to restore, which gets
  ambiguous if multiple state changes happened around the blocker creation
  time. Capturing at creation guarantees fidelity.

- Auto-created blockers from the Definition Change Flag system are a deliberate
  bridge between definition changes and operational consequences. The flag
  surfaces the change; the auto-blocker surfaces the operational impact when
  applying the change creates inconsistency. Both follow Tirion's principle
  of surfacing decisions to humans rather than auto-resolving.

- WO Split as a resolution type is conservative — most blockers don't need
  splitting. But for cases where a portion of a batch or WO has progressed
  fine and a portion is genuinely blocked, splitting is the cleanest path
  to unblock the unaffected portion.

---

## Open Items for Reconciliation Pass

- **Schema:** confirm Blocker table has all fields per Schema Fields section
  above (preBlockerState, pendingAt, pendingByUserId, resolutionType including
  WOSplit value)
- **State Model:** confirm Object 5 (Blocker) reflects three-state lifecycle
  (Open / Pending Resolution / Resolved)
- **Terminology Lock:** confirm "Pending Resolution" is in vocabulary
- **WO Split spec:** drafted as `wo_split_spec.md` — references reconciled
  during reconciliation pass
- **Definition Change Flag spec:** confirm cross-references to auto-created
  blocker scenarios are mutually consistent
- **Batch Editor spec:** confirm Batch Adjustment Workspace reuses the
  chip-based Composition Column interaction model from Batching Lens
- **All execution lens specs:** confirm Pending Resolution surfaces correctly
  (likely shows same Blocked indicator as Open blockers; hover reveals state)
