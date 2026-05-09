# Tirion — Receiving Lens Spec

## Purpose

The Receiving Lens supports the receipt of purchased materials and components
arriving from vendors. The receiver records what arrived, allocates it to the
Work Orders that have been waiting for it, surfaces exceptions back to
Purchasing when arrivals don't match orders, and triggers downstream routing
for satisfied WOs.

The Supply Order is the receiver's primary entity. Tirion's other process
lenses operate on Work Orders directly; receiving operates on Supply Orders
because that's the natural unit of physical arrival — vendors ship Supply
Orders, not WOs. The Receiving Lens grid provides WO-level context for
allocation decisions, but the action surface for satisfaction is the Supply
Order modal.

---

## Visibility Rules

A Production Row appears in the Receiving Lens when ALL of the following
are true:

- WOStatus = `Open`
- The WO has at least one associated SupplyOrderLineAllocation
- The WO's Receive WorkOrderStep is Incomplete (not yet Complete or Skipped)
- Parent Project is Active (not Archived)
- WO is not Cancelled

A Production Row leaves this lens when:

- The Receive step is marked Complete (all allocations satisfied), OR
- The WO is Cancelled (terminal — excluded from operational visibility)

Cancelled WOs are excluded from this lens entirely. Their associated
SupplyOrderLineAllocations may still exist for vendor record keeping but the
WOs themselves do not surface here.

---

## Two Workflow Patterns

The Receiving Lens supports two distinct workflows, both initiated from the
Supply Order modal accessed via the WO side panel.

### Workflow 1: Full-Line Satisfaction (Standard Case)

The most common case: a Supply Order Line arrives in full (or the final
shipment of a partial sequence completes the line).

1. Receiver selects any WO connected to the arriving line, opens the side
   panel, navigates to the Supply Order
2. In the Supply Order modal, receiver clicks "Mark Line Fulfilled" on the
   relevant Supply Order Line
3. System satisfies all WOs allocated to that line in one atomic action
4. One combined Distribution Popup fires showing each satisfied WO and its
   next routing destination
5. Receiver physically routes the items per the popup's instructions
6. Receiver closes the popup; satisfied WOs leave the Receiving Lens

### Workflow 2: Partial Allocation (Exception Case)

When material trickles in across multiple shipments and the receiver must
manually decide which WOs to satisfy:

1. Receiver records partial qty received on the Supply Order Line via the
   modal
2. Recording partial qty does NOT auto-satisfy any WO — the system tracks
   "received but not yet allocated" material
3. Receiver navigates back to the Receiving Lens grid for full WO context
   (due dates, batches, customers, downstream processes) — context the
   Supply Order modal can't surface
4. Receiver clicks individual WO rows in the Receiving Lens grid to mark
   them received (allocates received material to that WO)
5. Each WO satisfaction triggers an individual Distribution Popup for that WO
6. When the final shipment arrives, receiver clicks "Mark Line Fulfilled" —
   any remaining unsatisfied WOs on the line are auto-satisfied with their
   distribution popups firing in a combined display

---

## The Supply Order Modal

The Supply Order modal is the primary surface for receiving actions. Opened
from the Receiving Process-Specific Section in any WO's side panel.

### Modal Header

- Vendor name
- Supply Order ID
- Status (Ordered / Partial Received / Closed)
- Order Date
- Tracking Reference (if any)
- Supply Order ETA (line-level ETA propagation source — see ETA Management
  below)

### Lines Section

Each Supply Order Line displayed with:

| Field | Notes |
|-------|-------|
| Part / Material | Item being ordered |
| Ordered Qty | From Supply Order — read-only |
| Received Qty | Cumulative received-to-date |
| Allocated Qty | Total received qty that has been allocated to specific WOs |
| Unallocated Qty | Computed: Received − Allocated. Material physically present but not yet assigned to a WO |
| Status | Awaiting / Partial Received / Fulfilled |
| Exception Indicator | Visible if line has an active Exception flag (see Exception Mechanism) |
| Allocations Sub-list | Per-WO breakdown — see below |

### Per-Line Allocations Sub-list

Under each line, a sub-list shows every WO with an allocation against this
line:

| Field | Notes |
|-------|-------|
| WO ID | The allocated WO |
| Project + Top-Level Reference | Context for the receiver |
| Allocated Qty | The WO's portion of the Supply Order Line |
| Status | Awaiting / Satisfied — visually distinct (e.g., green for Satisfied) |
| Satisfaction Date | When this WO was satisfied (if applicable) |

### Modal Actions

| Action | Where | When Available | Effect |
|--------|-------|----------------|--------|
| Mark Line Fulfilled | Per line | Always (unless line already Fulfilled) | Satisfies all unsatisfied WOs on this line; fires combined Distribution Popup |
| Record Partial Receipt | Per line | When line not yet Fulfilled | Updates Received Qty without satisfying any WO. Used for partial shipments |
| Set Line Exception | Per line | Always | Opens Exception modal; flags the line for Purchasing follow-up |
| Clear Line Exception | Per line | When Exception is set | Opens Clear Exception modal; removes flag with resolution note |
| Update Line ETA | Per line | Always | Updates Supply Order Line ETA. **Always propagates to all member WO ETAs** (per spec decision; see ETA Management) |

---

## Marking WO Satisfaction from the Lens Grid

When the receiver navigates to the Receiving Lens grid (typically during
Workflow 2 partial allocation):

### Grid Display

The grid surfaces WOs awaiting receipt with full operational context:

| Column | Notes |
|--------|-------|
| WO ID | |
| Part / Material | What this WO needs |
| Required Qty | The WO's allocation |
| Project | Project context |
| Top-Level Reference | Project structure context |
| Customer | Pulled from Project metadata |
| Due Date | Pulled from Project; helps prioritize allocation |
| Batch | If WO is batched, shows batch ID and member count |
| Next Process | What this WO does after receiving (helps receiver understand routing) |
| Supply Order Line | Source line for this WO's allocation |
| Line Status | Status of the source Supply Order Line (Awaiting / Partial / Fulfilled) |
| Unallocated Available | Of the Line's received-but-unallocated material, the qty available |
| Indicators | Row Indicators per `terminology_lock.md` Cluster 9: Red Flag (Blocker), Yellow Flag (Definition Change Flag), White Flag (Supply Order Exception). Display order: Red → Yellow → White |
| Action | "Mark Received" button — see Action below |

### Mark Received Action

Clicking "Mark Received" on a WO row in the Receiving Lens grid:

1. Marks this WO's allocation as satisfied (allocated qty consumed from the
   Line's unallocated pool)
2. Fires the Distribution Popup for this WO showing its next routing
   destination
3. Receiver routes the material per the popup
4. Receiver closes the popup; the WO leaves the Receiving Lens

The system does NOT prevent the receiver from marking WOs received when
unallocated material is insufficient to cover the WO's allocation. Per
Tirion's "permissive system, thoughtful manager" principle, all changes are
auditable but not constrained. If the receiver makes an allocation error,
the audit trail captures it and downstream processes (or other receivers)
will surface the issue.

---

## ETA Management

ETAs exist at two levels:

- **Supply Order Line ETA**: when the line is expected to be received
- **Per-WO ETA**: when each WO is expected to receive its allocation

Both are independently editable. Per-WO ETAs are not derived from the
Supply Order Line ETA — they are separate attributes that may legitimately
diverge (e.g., a Line ETA of "next Tuesday" but specific WO ETAs of "this
Friday for WO A, next week for WO B" if material is being released to WOs
in stages).

### Line ETA Propagation Rule

Per the focused design session decision: **updating the Supply Order Line
ETA always propagates to all associated member WO ETAs.**

When the receiver updates a Line ETA in the Supply Order modal:
- All WOs allocated to this line have their ETA updated to match
- AuditLog entries written for each WO's ETA change
- The propagation happens atomically with the Line ETA save

If the receiver wants to update individual WO ETAs differently (e.g., one
WO is expedited beyond the line's general ETA), they edit the WO's ETA
directly in the WO's side panel or row inline edit. Per-WO edits do not
propagate up to the Line ETA — the Line ETA remains the receiver's general
expectation, individual WOs can vary.

### Per-WO ETA Edit Surfaces

- WO row inline edit in the Receiving Lens grid
- Side panel ETA field
- Project View row inline edit (managers updating ETAs from the planning
  surface)

Edits in any surface fire AuditLog entries.

---

## Exception Mechanism (Supply Order Line Level)

When a Supply Order Line arrives with problems (cut-too-short, damaged,
wrong item, vendor sent something different than ordered):

### What the Receiver Does

1. Does NOT mark the line Received or Fulfilled (would falsify the audit
   trail with "received what was ordered" when reality differs)
2. Sets a Line Exception via the Supply Order modal
3. Creates Blockers on the affected WOs separately (per `blocker_spec.md`)
   to handle operational consequences

### Set Exception Modal

- Single text field: Exception note (required) — describes what's wrong
- Confirm / Cancel
- On confirm:
  - Line's `hasException` flag set to true
  - Exception note, creator, timestamp recorded
  - AuditLog entry written
  - Visual indicator appears on the line in the modal and on the lens grid
- After confirm: receiver creates Blockers on affected WOs with operational
  details

### Clear Exception Modal

Available to anyone (typically Purchasing after resolving with the vendor):

- Single text field: Resolution note (required) — describes what was done
- Confirm / Cancel
- On confirm:
  - Line's `hasException` flag set to false
  - Resolution note, resolver, resolution timestamp recorded
  - Original exception note and timestamp preserved in audit trail
  - AuditLog entry written
  - Visual indicator removed
- After confirm: Purchasing typically continues working with vendor (e.g.,
  updates ETA, places replacement order, etc.) via standard Purchasing Lens
  workflows

### Exception vs. Blocker Distinction

- **Exception** is procurement-side signal at the Supply Order Line level —
  flags the line for Purchasing follow-up, doesn't directly block work
- **Blocker** is operational-side mechanism at the WO level — stops the WO
  in Blocked state pending resolution

A receiver dealing with a problematic shipment typically creates both: the
Exception communicates to Purchasing that there's a vendor issue to address;
the Blockers prevent downstream work on the affected WOs until the issue is
resolved.

The Receiving spec explicitly does NOT use a "refusal" mechanism. Quality
problems become Blockers + Line Exceptions, not refused receipts.

---

## Distribution Popup

After a receipt action satisfies one or more WOs, a popup fires showing the
next routing destination for each satisfied WO. This pattern is shared with
the Distribution Lens completion modal (see `distribution_lens_spec.md`).

### Single WO Satisfied (Workflow 2 partial allocation)

Popup shows:
- WO ID + Part Number
- Next Routing Step (process type + specific station if assigned)
- Physical Destination (station / project bay / stock)
- Confirm / Close

### Multiple WOs Satisfied (Workflow 1 line fulfilled)

Combined popup shows:
- Per-WO list with WO ID, Part Number, Next Routing Step, Physical Destination
- Grouped by destination station (so receiver can stage the whole shipment
  efficiently)
- Confirm All / Close

The popup is a routing aid — it does not require interaction beyond
acknowledgment. The state changes (WO satisfaction, step advancement) have
already committed when the popup fires.

---

## Side Panel — Process-Specific Section

The shared Detail Panel structure (per `detail_panel_spec.md`) handles
Header, Status, Routing Detail, Dependency Context, Batch Context, Pending
Definition Changes, Blocker Section, WO-level Notes, and Actions.

This lens's Process-Specific Section content (rendered between Routing Detail
and Dependency Context per the shared structure) is intentionally minimal —
the primary action surface is the Supply Order modal:

| Field | Editability | Notes |
|-------|-------------|-------|
| Associated Supply Order | Read-only reference | Click to open Supply Order modal |
| Supply Order Line(s) | Read-only display | Per allocation: line item, ordered qty, received-to-date, this WO's allocated qty, satisfaction status |
| Receipt Status | Read-only computed | "Awaiting receipt" / "Satisfied" derived from this WO's allocation state |
| Putaway Destination | Read-only computed | Where this material routes (next station / project bay / stock) — derived from Part's routing template |
| Per-WO ETA | Editable per step state and permission | Editable independently of Supply Order Line ETA |
| Process Sub-Status | Editable per step state and permission | Per ProcessTypeSubStatus seed |
| Process Notes | Editable, append-only | Free text; timestamped and attributed; newest at top. Scoped to the Receiving step |

### Open Supply Order Action

Click the "Associated Supply Order" link to open the Supply Order modal.
This is the receiver's primary navigation path from a WO into the Supply
Order surface where most receiving actions happen.

---

## Receipt Number Tracking

Rev 1 does NOT track structured receipt events. There is no Receipt entity
in the schema; the slip/invoice reference is not captured as a structured
field.

This is a deliberate Rev 1 simplification. The audit log captures every
change to Supply Order Line state (received qty updates, satisfaction
events, exceptions), which provides the historical record without requiring
a separate Receipt entity.

If future revisions need shipment-level grouping (e.g., for vendor
performance analytics like "Vendor X consistently sends partial shipments"),
a Receipt entity can be added then. Rev 1 prioritizes simplicity.

---

## Material Substitutions

Out of scope for Rev 1. Receivers cannot substitute received material for
the originally-ordered material. If a vendor ships an alternate spec, the
receiver creates a Line Exception and Blockers on affected WOs, and a
manager handles the substitution decision via Definition Change Flag
workflows or other deliberate primitives.

Material Substitutions in Rev 2 may add a structured substitution mechanism
in this lens.

---

## Cancelled WO Handling

If a WO is Cancelled while it has active SupplyOrderLineAllocations:

- The WO disappears from the Receiving Lens immediately
- The associated SupplyOrderLineAllocations remain in the system (vendor
  relationship and historical allocation continue)
- The Supply Order Line's allocation list shows the Cancelled WO count
  reduced; remaining allocations unaffected
- If the Supply Order Line had only the Cancelled WO allocated, it becomes
  an orphaned line — the buyer must decide whether to cancel the line with
  the vendor (typically by setting an Exception with note about cancellation)
  or reallocate to another WO

The Receiving Lens does not automatically cancel Supply Orders or Lines when
their WOs are Cancelled. That remains a buyer/manager decision via
Purchasing Lens or Supply Order management.

---

## Definition Change Flag Handling

If an associated WO has an open Definition Change Flag (yellow flag indicator
visible on the row), the receiver should be aware that the WO's definition
has been updated since the order was placed.

The receiver does not resolve flags — that's a Manager/Admin action. But the
indicator signals that the receiver may want to coordinate with the manager
before satisfying the WO, especially if the flag indicates a material spec
change or vendor change that affects whether the arriving material is
appropriate.

For example: if the flag indicates a material spec change and the received
material conforms to the OLD spec, the manager may need to decide whether
to accept it (resolve flag with note about as-built status) or treat it as
a non-conforming receipt (Set Line Exception + create Blockers).

---

## Hard Rules

| # | Rule |
|---|------|
| RV-1 | Supply Order is the receiver's primary entity. Action happens in the Supply Order modal; the lens grid provides WO context for partial-allocation decisions |
| RV-2 | Marking a Supply Order Line "Fulfilled" satisfies all unsatisfied WOs on that line in one atomic action |
| RV-3 | Recording partial receipt does NOT auto-satisfy any WO. Receiver must explicitly satisfy WOs from the Receiving Lens grid |
| RV-4 | The system does NOT prevent allocation of more material than has been received. Auditable, not enforced |
| RV-5 | Quality problems become Blockers + Line Exceptions. There is no refusal mechanism in Rev 1 |
| RV-6 | Supply Order Line Exception is procurement-side signal; Blockers are operational-side mechanisms. Both may be used for the same incident |
| RV-7 | Updating a Supply Order Line ETA always propagates to all member WO ETAs |
| RV-8 | Per-WO ETA edits do NOT propagate up to the Supply Order Line ETA |
| RV-9 | Distribution Popup fires after every satisfaction action — single WO popup for partial-allocation satisfaction; combined popup for line-fulfilled satisfaction |
| RV-10 | Rev 1 does not track structured receipt events. No Receipt entity in schema |
| RV-11 | Rev 1 does not capture slip / invoice reference as a structured field |
| RV-12 | Cancelled WOs are excluded from the lens; their allocations remain attached to historical records |

---

## Schema Implications

The schema changes resulting from this spec:

**Fields to remove** (per Rev 1 simplification):
- `Receipt` entity — REMOVE
- `ReceiptLine` entity — REMOVE
- Any `slipReference` / `slipNumber` fields — REMOVE
- Refusal-related fields if any exist on Receipt/ReceiptLine — REMOVE with the entities

**Fields to add** to `SupplyOrderLine`:
- `hasException Boolean @default(false)` — exception flag
- `exceptionNote String?` — note describing the exception
- `exceptionCreatedByUserId Int?` — who flagged it
- `exceptionCreatedAt DateTime?` — when it was flagged
- `exceptionResolvedNote String?` — resolution note
- `exceptionResolvedByUserId Int?` — who cleared it
- `exceptionResolvedAt DateTime?` — when it was cleared
- `eta DateTime?` — Supply Order Line ETA (separate from per-WO ETA)

**Fields to add** to `WorkOrder` (or verify already exist):
- `eta DateTime?` — per-WO ETA, independently editable

**AuditAction additions**:
- `SupplyOrderLineExceptionSet` — when a receiver flags a line
- `SupplyOrderLineExceptionCleared` — when someone clears the flag
- `SupplyOrderLineFulfilled` — when a line is marked fulfilled (satisfies WOs)
- `SupplyOrderLinePartialReceipt` — when partial receipt is recorded
- `WOReceiptSatisfied` — when a WO's allocation is satisfied via the lens grid
- `SupplyOrderLineETAUpdated` — line ETA edit (with cascade effect noted)
- `WOEtaUpdated` — per-WO ETA edit

---

## Design Notes

- The Supply Order modal as primary surface reflects how receiving actually
  works in shops. A truck arrives, the receiver works through what's on it,
  and they think in terms of "this Supply Order arrived, here's what was
  in it" — not "let me update each WO individually." The previous spec's
  WO-side-panel-only model was wrong; this dual model is right.

- The partial allocation workflow's friction (navigate to lens grid for
  context) is intentional. Partial allocation IS exception-territory; the
  receiver is making consequential decisions about who gets what. The extra
  navigation is reasonable cost for the operational context required to
  decide well.

- Trusting the user to allocate correctly (no system enforcement on
  over-allocation) is consistent with Tirion's "permissive system,
  thoughtful manager" philosophy. The audit trail captures every decision;
  if errors occur, they're surfaceable.

- The Line Exception + Blocker dual mechanism is intentional. They serve
  different audiences (Purchasing vs. operations) and have different
  semantics (signal vs. stop). Conflating them would either lose the
  procurement signal or lose the operational stop.

- ETA propagation defaulting to always-on is a UX convenience. The common
  case is "all WOs slip together because the Line slipped"; the exception
  case (per-WO ETA differs) is handled by editing per-WO directly. This
  avoids the friction of confirming propagation on every Line ETA edit.

- Dropping the Receipt entity is a real simplification. The cost is losing
  shipment-level grouping for analytics; the benefit is a much simpler
  schema and reasoning model. Rev 1 is right to defer.

- Rev 2 may invert the lens orientation: Supply Orders become the primary
  rows in the Receiving View with WO navigation when needed. This makes
  more sense once material handling is built and the Supply Order is fully
  decoupled from WO satisfaction. For Rev 1, WO-rows-with-Supply-Order-modal
  works.

---

## Rev 2 Wishlist

- **Receipt entity** for shipment-level tracking and vendor performance analytics
- **Supply-Order-primary view orientation** in the lens (instead of WO-primary)
- **Material substitution mechanism** allowing receivers to record substitutions
- **Slip / invoice reference capture** as structured field tied to receipt events
- **Multi-select WO satisfaction** in the Receiving Lens grid for batch allocation
- **Exception taxonomy** if generic Exception field proves insufficient (categories like Damaged, Wrong Item, Short Quantity, etc.)
