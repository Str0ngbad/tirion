# Tirion — State Model

This document defines every state an object can be in, every valid transition,
who can trigger it, and what the system does automatically versus what requires
human action.

This document is locked. All view specs, API logic, and UI behavior must
conform to the transition rules defined here. If a downstream spec reveals
a genuine conflict, resolve it by updating this document first.

---

## Universal Rules

These rules apply to every state-bearing object in the system without exception.

1. Every state change records the acting user and a timestamp. No anonymous
   state changes anywhere in the system.
2. Every state change writes to AuditLog in the same database transaction.
3. Pre-blocker state is always stored at blocker creation and surfaced to the
   resolving user as the suggested outcome state.
4. On any blocker resolution, the resolving user specifies the outcome state.
   The system surfaces pre-blocker state as the default. The user may accept
   or override. The system does not automatically determine post-resolution state.
5. Sub-status never drives state transitions. It is operator context only.

---

## Object 1 — Work Order Step

The most complex state model in the system. All other execution state derives
from or responds to Work Order Step state.

### States

| State | Meaning |
|-------|---------|
| Waiting | Prerequisites not yet met. Step cannot be worked |
| Ready | All prerequisites met. Work can begin |
| Started | Work actively in progress |
| Complete | Step finished. CompletedQty and ScrapQty recorded where required |
| Skipped | Step bypassed without execution. Used in Stock Fulfillment workflow (Fulfill from Stock cascades all routing steps to Skipped) |
| Blocked | Cannot proceed. Explicit blocker record exists |

### Transition Rules

| From | To | Trigger | Who | System Action |
|------|----|---------|-----|---------------|
| — | Waiting | WO created via Project Compilation, Add Top-Level Item, or Component Added flag resolution | System | All steps created in Waiting |
| Waiting | Ready | All lower-index steps on same WO are Complete OR Skipped | System | Derived automatically. Never set by user. Timestamp recorded |
| Waiting | Skipped | Fulfill from Stock action on the WO | System | All routing steps on the WO transition to Skipped in same atomic transaction. Also fires on Assembly cascade-skip from Stock Fulfillment |
| Ready | Waiting | Upstream step rolled back from Complete | System | Automatic. Never set by user. Timestamp recorded |
| Ready | Started | Operator begins work | Operator+ | Records `startedAt`, acting user |
| Ready | Complete | Operator marks complete (Started not required) | Operator+ | Records CompletedQty, ScrapQty, `completedAt`, acting user. Triggers Ready derivation on next step. If final step, triggers WO completion transaction |
| Ready | Blocked | Issue arises before starting | Operator+ | Creates Blocker record with note, category, `preBlockerState = Ready`, `createdAt`, acting user. Step → Blocked |
| Started | Complete | Operator marks complete | Operator+ | Same as Ready → Complete |
| Started | Blocked | Issue arises during work | Operator+ | Creates Blocker record with note, category, `preBlockerState = Started`, `createdAt`, acting user. Step → Blocked |
| Complete | Ready | Routing Rollback — this is the first incomplete step after rollback | Manager, Admin | All steps with higher stepIndex → Waiting. Timestamp and acting user recorded |
| Complete | Waiting | Routing Rollback — this is not the first incomplete step | Manager, Admin | Timestamp and acting user recorded |
| Skipped | Waiting | Return to Stock primitive (cascade reverse) | Manager, Admin | Used when Assembly Return to Stock is applied; descendant Skipped steps revert to Waiting |
| Blocked | Ready or Started | Blocker resolved (Cleared) | Manager, Admin, Operator (Cleared only) | Step state restored to `preBlockerState`. Records `resolvedAt`, resolution type, resolution note, acting user |
| Blocked | (varies) | Blocker resolved (other resolution types) | Manager, Admin | Resolution-type-specific state changes per blocker_spec.md |

**Skipped is functionally equivalent to Complete for downstream Ready derivation.**
A step is Ready when all lower-index steps are Complete OR Skipped. This means
Fulfill-from-Stock cascade-skips correctly satisfy downstream prerequisites
without producing parts via the standard process.

### Assembly-Specific Rules

- The first step of an Assembly WO is Ready only when all child WOs are Complete
- Subsequent Assembly steps follow the standard rule — all lower-index steps Complete
- If a child WO's completion is reversed for any reason, any Assembly WO whose
  first step had derived Ready based on that child's completion automatically
  reverts to Waiting
- Assembly blockers apply only to the Assembly's own routing steps — child WOs
  are not affected

### Completion Rules

- CompletedQty must meet or exceed Demand Quantity to proceed without intervention
- If CompletedQty falls below Demand, a blocker is created
- Scrap never satisfies demand — only good CompletedQty counts
- CompletedQty is nullable at Purchase and Receive steps
- CompletedQty is required at all other process steps
- Work may transition directly from Ready to Complete without passing through Started

### Rollback Rules

- When a step is rolled back, the first incomplete step derives as Ready
- All steps downstream of the rollback point return to Waiting
- Example: Part is in Machining (Started). Rollback to Purchasing.
  Purchasing: Complete → Ready. Machining: Started → Waiting.
  All steps between Purchasing and Machining → Waiting.

### Sub-Status

Sub-status is a validated dropdown per ProcessType with a free text overflow
field. Never drives state transitions. Always optional — blank is valid.
Filterable and sortable in all lenses.

The canonical seed list lives in `seed_data_spec.md`. Summary of Rev 1
sub-status values:

| Process | Sub-Status Values |
|---------|------------------|
| Purchase | Material checked, RFQ Pending, Quote Received, Ordered |
| Receive | Partial, Requested Update, Delayed |
| Machine | Setup, Running, Complete, Hold for QA, Hold for Next Setup |
| Assemble | Staging, Validate Fit, In Assembly, QA Review |
| Distribution | (no seed sub-statuses) |

Sub-status values are stored in `ProcessTypeSubStatus` and admin-configurable
without code changes (admins can add, edit, deactivate, reorder per
`configuration_management_spec.md`).

---

## Object 2 — Work Order

WO status carries release visibility AND terminal state. WOStatus has four
values reflecting the Compile → Stock Fulfillment → Batching → Execution flow
plus the Cancel terminal action.

### States

| State | Meaning |
|-------|---------|
| Unreleased | WO exists; has not yet been confirmed via Batching. Includes both pre-Stock-Fulfillment and post-Stock-Fulfillment-pre-Batching WOs (distinguished by `stockFulfillmentReviewedAt`) |
| Open | WO has been confirmed via Batching; visible to execution lenses |
| Complete | All steps complete (or all Skipped via Fulfill from Stock). Final step completion triggers this transactionally |
| Cancelled | WO has been administratively retired via Cancel primitive. Replaces prior status. One-way in Rev 1 |

### Transition Rules

| From | To | Trigger | Who | System Action |
|------|----|---------|-----|---------------|
| — | Unreleased | Project Compilation OR Add Top-Level Item OR Component Added flag resolution | System | WO created. All steps created in Waiting |
| Unreleased | Unreleased + reviewed | Stock Fulfillment Pass-Through decision OR Stock Fulfillment Release | System | `stockFulfillmentReviewedAt` set; WOStatus unchanged. WO becomes visible to Batching |
| Unreleased + reviewed | Open | Batching Confirm | Manager, Admin (or planner with batching role) | WOStatus transitions to Open. WO becomes visible to execution lenses. If part of a batch: batchId set in same transaction |
| Unreleased | Complete | Fulfill from Stock | Planner, Manager, Admin | All routing steps transition to Skipped; WOStatus to Complete. Stock count decremented. Bypasses both Stock Fulfillment Release and Batching Confirm |
| Open | Complete | Final WorkOrderStep marked Complete | System | Transactional — WO status and final step complete together. Records `completedAt`, acting user |
| Complete | Open | Any step rolled back from Complete | System | WO returns to Open. Timestamp and acting user recorded |
| Complete | Open | Return to Stock primitive (Primitive 3) | Manager, Admin | WO returns to Open with all steps reset to Waiting. Stock count incremented. Cascade reverse if Assembly with Skipped descendants |
| Unreleased | Cancelled | Cancel primitive | Manager, Admin | WOStatus set to Cancelled. Removed from operational visibility. Leaf-only constraint enforced |
| Open | Cancelled | Cancel primitive | Manager, Admin | WOStatus set to Cancelled. Removed from operational visibility. Leaf-only constraint enforced. If batched: removed from batch (batch dissolves if member count drops to 1) |
| Complete | Cancelled | Cancel primitive | Manager, Admin | WOStatus set to Cancelled. Removed from historical-context visibility. Leaf-only constraint enforced |

### Cancellation Rules

- **Leaf-only constraint:** Cancel is available only on WOs whose descendants are all Cancelled (or who have no descendants). The user must walk the BOM tree leaf-first to cancel an Assembly.
- **One-way in Rev 1:** Cancel cannot be reversed. An un-Cancel workflow is Rev 2.
- **Visibility exclusion:** Cancelled WOs are excluded from execution lenses, Operations Lens, Project View (by default; toggleable), Stock Fulfillment, Batching Lens, and all readiness/demand calculations.
- **Schema persistence:** Cancelled WOs remain in the database for audit and historical reference. They are not deleted.
- **Auto-resolution of related records:**
  - If the Cancelled WO had an open Blocker: the Blocker is auto-resolved with system note "Auto-resolved: WO Cancelled."
  - If the Cancelled WO had open Definition Change Flags: flags become moot; resolution status follows from the Cancel transaction's audit
  - If the Cancelled WO was in a Batch: removed from Batch in the same transaction; batch derived values recompute

### Batched WO Rules

- When an Open WO has a batchId, Batch state is authoritative for process lens display
- WO status still updates internally and fires transactionally on completion
- Individual WO states are not displayed independently in process lenses while batched
- Distribution applies at the Production Row level — the Batch when batched,
  the WO when unbatched
- Cancelled members are excluded from batch derived values (Demand, Priority, Due Date)

---

## Object 3 — Production Batch

All member WOs share the same state at all times. They move as one unit.

### States

| State | Meaning |
|-------|---------|
| Open | Batch confirmed. Work not yet complete |
| Complete | All member WOs Complete |
| Blocked | Cannot proceed. Explicit blocker record exists |
| Dissolved | Membership dropped to one. Batch no longer exists |

### Transition Rules

| From | To | Trigger | Who | System Action |
|------|----|---------|-----|---------------|
| — | Open | Planner confirms batch in Batching Lens | Manager, Admin (permissions Rev 2) | BatchID generated. Member WOs linked. Batch becomes Production Row in all lenses. Member WOs inherit Batch state |
| Open | Complete | All member WOs Complete | System | Transactional — fires when last member WO final step completes. Records `completedAt`, acting user |
| Complete | Open | Any member WO step rolled back | System | Batch returns to Open. Timestamp recorded |
| Open | Blocked | Blocker created on Batch | Operator+ | Blocker record created. `preBlockerState = Open`. Production Row → Blocked |
| Blocked | Open | Blocker resolved | Manager, Admin, Operator (Cleared only) | User specifies outcome state. Pre-blocker state surfaced as default. Records `resolvedAt`, resolution note, acting user |
| Open or Complete | Dissolved | Member count drops to one | System | Batch dissolves. Remaining WO becomes standalone Production Row |

### Batch Integrity Rules

- All member WOs always share the same state — there are no mixed states within a Batch
- State changes apply to the Batch and are inherited by all members simultaneously
- If operational reality requires member WOs to diverge, a Batch split is required
  before the system will reflect different states
- Batch priority = MAX priority among member WOs — re-derived when membership changes
- Batch due date = MIN due date among member WOs — re-derived when membership changes
- User permissions for batch confirmation are Rev 2 — Rev 1 uses basic user selection

---

## Object 4 — Blocker

### States

| State | Meaning | Derivation |
|-------|---------|-----------|
| Open | Created. Not yet acknowledged or acted on | `pendingAt = null AND resolvedAt = null` |
| Pending Resolution | Deliberately acknowledged. Waiting for external condition to resolve | `pendingAt IS NOT NULL AND resolvedAt = null` |
| Resolved | Closed via explicit resolution type with note | `resolvedAt IS NOT NULL` |

Status is derived from timestamps. No separate status field is stored. This
matches the Definition Change Flag pattern and avoids redundant state
representation.

### Transition Rules

| From | To | Trigger | Who | Note Required | System Action |
|------|----|---------|-----|---------------|---------------|
| — | Open | Blocker created | Operator+ | Yes | Records entityType, entityId, processTypeId, category, `preBlockerState`, `createdAt`, acting user. Production Row → Blocked |
| Open | Pending Resolution | Manager acknowledges | Manager, Admin | Yes | Records `pendingAt`, acting user. Production Row remains Blocked |
| Pending Resolution | Open | Manager reactivates | Manager, Admin | Yes | Returns to Open. Production Row remains Blocked |
| Open | Resolved | Resolution action completed | Manager, Admin, Operator (Cleared only) | Yes | User specifies Production Row outcome state. Records resolution type, `resolvedAt`, acting user |
| Pending Resolution | Resolved | Resolution action completed | Manager, Admin | Yes | Same as above |

### Blocker Rules

- Every Blocker state change requires a note — no exceptions
- Production Row remains Blocked regardless of whether Blocker is Open or Pending Resolution
- Resolved is the only state where the Production Row can exit Blocked
- Pre-blocker state is stored at creation, surfaced as suggested outcome state at resolution
- No silent blocker creation. No silent blocker resolution.
- Assembly blockers apply only to the Assembly's own routing — not to child WOs
- **Auto-resolution scenarios:**
  - WO Cancel: if the Cancel primitive is applied to a WO with an open Blocker, the Blocker is auto-resolved with system-generated note "Auto-resolved: WO Cancelled."
  - Batch dissolution: if a batch with an active Blocker dissolves (member count drops to 1), the Blocker may transfer to the remaining WO depending on batch_editor_spec.md rules
- **Auto-creation scenarios** (from Definition Change Flag system):
  - Component Added flag resolution on past-Waiting parent Assembly: auto-Blocker on parent Assembly with system-generated note describing the BOM change and new child WO IDs
  - Demand Increase resulting in CompletedQty < new Demand: the standard under-production Blocker rule fires automatically (per Object 1 Completion Rules). Not a special Definition Change Flag behavior — just the standard system response to the resulting state
- **Note on over-production:** Demand Decrease resulting in CompletedQty > new Demand does NOT create a Blocker. Over-production is handled at Distribution as overage routing to stock. Only under-production (insufficient CompletedQty to satisfy current Demand) is a Blocker condition

### Resolution Types

**Cleared**
Issue resolved with no structural change. State returns to pre-blocker condition.
Available to Operators at their own station, Managers, Admins.

**WO Split**
Blocked WO divided into two. The manager specifies: the step the new WO starts
at (defaults to first step, set to Ready) and the outcome state for the original
WO (pre-blocker state surfaced as default, manager may override). Parent Assembly
WO demand relationships are preserved — parent sees combined demand of both
resulting WOs. Manager and Admin only. Rev 1 feature. Full implementation spec
to be developed before Phase 6 build.

**Batch Adjustment**
Blocked Batch restructured by reassigning member WOs to other batches or leaving
them unbatched. Uses Batch Adjustment Workspace. Manager and Admin only. Only
available when blocked entity is a Batch.

**Routing Rollback**
Blocked entity routing reset. All steps downstream of current step return to
Waiting. First incomplete step derives as Ready. Manager and Admin only.

**Demand Adjustment**
Deferred to Rev 2. In Rev 1, almost every WO has a parent Assembly dependency
making this resolution invalid in nearly all cases. Rev 2 rule: manager reduces
Demand Quantity to match actual production. Only available when no parent Assembly
WO depends on this WO's demand. Demand may only be adjusted downward.
Manager and Admin only.

### Batch Adjustment Workspace

A dedicated manager interface for restructuring a blocked Batch. Operates on a
working draft — no changes commit until manager explicitly confirms. Exiting
without confirming discards all provisional changes. Shows live demand validation
as WOs are reassigned so manager always sees whether current draft produces a
valid end state.

---

## Object 5 — Supply Order

Rev 1: A lightweight reference record. Not a primary workflow object.
No state model required in Rev 1.

### Rev 1 Behavior

- Created manually by buyer as a grouping reference for orders sharing
  characteristics (same vendor, same shipment, same ETA)
- ETA is always editable — every change logged to AuditLog with user and timestamp
- Tracking number is nullable — when present, surfaced visually in Receiving
- No workflow logic depends on Supply Orders in Rev 1
- Production Row is the primary object in both Purchasing and Receiving lenses
- Supply Order association on a Production Row is reference only

### Rev 2 Foundation

Supply Order table and SupplyOrderLineAllocation junction table exist in Rev 1
schema. Full Supply Order workflow, partial receipt management, and vendor
performance tracking activate in Rev 2 without structural rework.

---

## Object 6 — Receipt (Receive WorkOrderStep)

Rev 1: Receiving is the completion event for the Receive WorkOrderStep.
It is not a separate workflow object — it follows the standard WorkOrderStep
state model with the following specific rules.

### Receiving-Specific Rules

- Receiver marks the Receive step Complete
- At completion, receiver may: confirm qty entered by purchasing, update qty,
  or leave qty null
- CompletedQty is nullable at Receive steps — no enforcement in Rev 1
- Standard timestamp and acting user recorded on completion
- Delayed or exception scenarios use standard blocker creation

### Rev 2 Foundation

Receipt table exists in Rev 1 schema as a reference record. Full Receipt
workflow with partial receipts, refused quantity tracking, putaway confirmation,
and vendor performance activates in Rev 2.

---

## Object 7 — Project

### States

| State | Meaning |
|-------|---------|
| Active | Project is in progress |
| Complete | All top-level Assembly WOs Complete. Eligible for archiving |
| Archived | Removed from active operations |

### Transition Rules

| From | To | Trigger | Who | System Action |
|------|----|---------|-----|---------------|
| — | Active | Project created | Manager, Admin | WO tree generated from BOM. All WOs created Open |
| Active | Complete | All top-level Assembly WOs Complete | System | Derived. Project eligible for archiving |
| Complete | Active | Any WO rolled back from Complete | System | Project returns to Active |
| Active or Complete | Archived | Manager archives project | Manager, Admin | All associated WOs removed from active process queues. WOs in Batches removed — if Batch drops to one member, dissolves. All archival actions logged. Requires explicit confirmation |

### Project Archival Rules

- Requires explicit manager confirmation before executing
- Not available to Operators
- System does not attempt to resolve or account for WIP already in progress
  at time of archival — that is an operational responsibility
- Category B mid-WIP structural changes (adding, removing, replacing parts
  on an in-progress project) are now in Rev 1 scope via the Definition
  Change Flag system. See Object 8 below and `definition_change_flag_spec.md`.

---

## Object 8 — Definition Change Flag

A persistent record per (definition change × affected entity) pair. Surfaces
the impact of definition-layer edits to active Work Orders or Production
Batches for human resolution by Manager/Admin.

### States

| State | Meaning | Derivation |
|-------|---------|-----------|
| Open | Created. Not yet resolved | `resolvedAt = null` |
| Resolved | Closed via resolution action with note | `resolvedAt IS NOT NULL` |

Status is derived from timestamp. No separate status field is stored.

### Transition Rules

| From | To | Trigger | Who | Note Required | System Action |
|------|----|---------|-----|---------------|---------------|
| — | Open | Definition edit confirmed (Parts Master, BOM Editor, Routing Template Editor) with affected open entities | System | No (note captured at resolution) | One flag created per affected entity. Records changeType, changedEntityType, changedEntityId, affectedEntityType, affectedEntityId, parentFlagId (for batch members), changeAuditLogId, createdAt, createdByUserId |
| Open | Resolved | User selects Dismiss or Accept Change | Manager, Admin | Yes | Records resolutionAction, resolutionNote, resolvedAt, resolvedByUserId. For Accept Change: change-type-specific side effects execute in same transaction |

### Flag Rules

- Flags are created at definition edit confirmation; no Open → Open
  transitions exist
- Resolution requires a note. No silent resolution.
- Permissions: Manager and Admin can resolve. Lead can view. Operator can
  see indicator but cannot resolve.
- Cosmetic field changes (Part Name, Description, Notes, Inventory Location)
  do not create flags.
- Each flag is resolved independently (subject to batch propagation).

### Batch Propagation Rules

- Flag-triggering changes affecting a batched WO create flags at both batch
  level and member level
- Member flags carry `parentFlagId` referencing the batch flag
- Resolution at batch level applies atomically to all members
- Per-member resolution requires removing WO from batch first
- Batch dissolution mid-flag auto-resolves the batch flag and frees member
  flags for individual resolution
- WO Split inheritance: both new WOs from a split inherit copies of the flag

### Auto-Resolution Scenarios

- **WO Split:** Original flag auto-resolved; new flags created on resulting
  WOs
- **Batch dissolution:** Batch flag auto-resolved; member flags become
  individually resolvable
- **WO Cancel:** Flags on Cancelled WOs become moot; resolution via Cancel
  audit context

See `definition_change_flag_spec.md` for full specification including
resolution-type-specific workflows.

---

## Schema Changes Identified During State Model Build

The following changes to `schema.md` were identified during this process.
All must be applied during Stage 6 Schema Validation.

| # | Change | Reason |
|---|--------|--------|
| 1 | Remove `Cancelled` from `WOStatus` enum | No cancellation workflow in Rev 1 |
| 2 | Add `preBlockerState` field to `Blocker` record | Required for correct Cleared resolution |
| 3 | Replace `PurchaseOrderLine.workOrderId` FK with `SupplyOrderLineAllocation` junction table | One Supply Order Line must be able to satisfy multiple WOs |
| 4 | Rename `PurchaseOrder` table to `SupplyOrder` and all related fields | PO terminology is misleading for high-mix shop context |
| 5 | Add `ProcessTypeSubStatus` configuration table | Validated sub-status vocabulary per ProcessType |
| 6 | Update `WorkOrderStep.subStatus` to FK on `ProcessTypeSubStatus` | Replaces free text with validated dropdown |
| 7 | Add `WorkOrderStep.subStatusNote` String nullable | Free text overflow field alongside validated dropdown |
| 8 | Add `pendingAt` DateTime nullable to `Blocker` | Timestamp for Pending Resolution state change |

---

## Hard Rules Summary

| # | Rule |
|---|------|
| 1 | Every state change records acting user and timestamp — no anonymous state changes |
| 2 | Every state change writes to AuditLog in the same transaction |
| 3 | Ready state is never set directly — always computed |
| 4 | WO completion is transactional — final step and WO status update together |
| 5 | Assembly first step Ready only when all child WOs are Complete |
| 6 | If a child WO completion is reversed, dependent Assembly first steps revert to Waiting |
| 7 | CompletedQty falling below Demand creates a blocker |
| 8 | Scrap never satisfies demand |
| 9 | CompletedQty is nullable at Purchase and Receive steps only |
| 10 | Work may go Ready → Complete without passing through Started |
| 11 | Rollback sets first incomplete step to Ready, all downstream steps to Waiting |
| 12 | All member WOs in a Batch share the same state at all times |
| 13 | Batch dissolves if membership drops to one WO |
| 14 | Blocking a batched WO blocks the Batch, not the individual WO |
| 15 | Every Blocker state change requires a note — no exceptions |
| 16 | Pending Resolution is not resolved — work cannot proceed |
| 17 | On any blocker resolution, user specifies outcome state — system does not auto-determine |
| 18 | Pre-blocker state is always surfaced as suggested outcome state at resolution |
| 19 | Demand Adjustment is deferred to Rev 2 |
| 20 | Project Archival requires explicit manager confirmation |
| 21 | Project Archival does not attempt to resolve in-progress WIP |
| 22 | Supply Orders are reference records in Rev 1 — no workflow logic depends on them |
| 23 | ETA on Supply Order is always editable — every change logged with user and timestamp |
| 24 | Sub-status never drives state transitions |
| 25 | Blank sub-status is always valid |
