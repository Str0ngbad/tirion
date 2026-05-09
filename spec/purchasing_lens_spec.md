# Tirion — Purchasing Lens Spec

## Purpose

The Purchasing Lens is where buyers manage material procurement for Production
Rows that require purchasing. By the time a Production Row appears here, stock
fulfillment has already been evaluated — everything in this lens genuinely needs
to be ordered or has material whose on-hand status needs to be confirmed.

The lens is a decision-support view. The buyer scans demand, checks material
availability, updates sub-status, and creates Supply Orders. It is not a data
entry form.

---

## Visibility Rules

A Production Row appears in the Purchasing Lens when ALL of the following
are true:
- WOStatus = `Open` (the WO has been confirmed via Batching)
- Active Purchase WorkOrderStep is Incomplete (not yet Complete or Skipped)
- Parent Project is Active (not Archived)
- WO is not Cancelled

A Production Row leaves this lens when:
- The Purchase step is marked Complete (Supply Order submitted), OR
- The Purchase step is Skipped (fulfilled from stock — handled in Stock
  Fulfillment, not here), OR
- The WO is Cancelled (terminal state — excluded from operational visibility)

Cancelled WOs are excluded from this lens entirely. They do not appear in
the grid even with filters.

---

## Row Model

Each row represents a Production Row — a Production Batch when batched,
a standalone Work Order when unbatched. This is consistent with all
execution lenses.

---

## Purchase Step State Model

The Purchase WorkOrderStep follows the standard three-state model:

| State | Meaning |
|-------|---------|
| Incomplete | Purchase step active — demand exists, work in progress |
| Blocked | Exception — cannot proceed. Explicit blocker record required |
| Complete | Supply Order submitted. Row moves to Receiving Lens |

Everything between Incomplete and Complete is communicated via Sub-Status.
Sub-status transitions are manual — the buyer updates as they work.

---

## Purchasing Sub-Status

Sub-status provides buyer context within the Incomplete state. Validated
dropdown per the purchasing sub-status vocabulary. Free text overflow
available. Never drives state transitions.

| Sub-Status | Meaning |
|------------|---------|
| (blank) | No action taken yet — stock check not performed |
| Stock Checked — No Material | Physically verified not on hand. Needs to be ordered |
| RFQ Pending | Quote requested from vendor. Awaiting response |
| Quote Received | Vendor responded. Buyer evaluating |
| Order Placed | Supply Order submitted to vendor. ETA recorded |
| Delayed | ETA passed or revised. Note field captures context |

**Material check workflow:**
When a Production Row enters the Purchasing Lens, the buyer's first action is
to verify whether material is already on hand. This is a physical check — the
system cannot validate it in Rev 1 without the full material handling model.
The buyer updates sub-status to "Stock Checked — No Material" to signal that
the check has been performed and ordering is required. Rows without this
sub-status set are visibly distinguishable as unchecked — blank sub-status
means the check has not happened yet.

---

## Grid Columns

| Column | Notes |
|--------|-------|
| Production Row ID | Batch ID or WO ID |
| Part Number | |
| Part Name | |
| Material Specification | From Part's MaterialSpec |
| Stock Size | From MaterialSpec — sortable |
| Procurement Type | Make / Buy / MakeBuy |
| Vendor (effective) | Display per order of precedence: WO-level override > Part's Default Vendor (see Side Panel section for full precedence rules) |
| Priority | Global priority — MAX of member WOs for batch |
| Due Date | Earliest due date — MIN of member WOs for batch |
| Demand Quantity | Total demand for this Production Row |
| Cumulative Quantity | Total open demand for this PartID across all Production Rows regardless of purchasing status. Awareness tool — not a decision driver |
| Purchase State | Incomplete / Blocked / Complete |
| Sub-Status | Validated dropdown + free text overflow |
| Project ID | WO rows only |
| Projects | Batch rows — condensed list of Project IDs |
| Supply Order Reference | Supply Order ID if one exists for this row |
| ETA | From associated Supply Order if created |
| Indicators | Row Indicators per `terminology_lock.md` Cluster 9: Red Flag (Blocker), Yellow Flag (Definition Change Flag), White Flag (Supply Order Exception). Display order: Red → Yellow → White |

---

## Default Grouping and Sort

Default grouping: Material Specification + Vendor. Within each group, sort
by Priority then Due Date.

This surfaces the "what do I need to order from each vendor for this material"
question that drives daily purchasing decisions — the same organizational
pattern as the original spreadsheet workflow.

---

## Supply Order Creation

The buyer selects one or more Production Rows and clicks "Create Supply Order."
This opens a Supply Order draft populated with those rows.

**Draft contents:**
- Vendor (auto-populated from Default Vendor on the Part record — editable)
- ETA (nullable — buyer enters if known)
- Tracking Number (nullable)
- Order Reference (nullable — PO number, Amazon order ID, etc.)
- Line items: one per selected Production Row, showing Part Number, Part Name,
  Material Spec, Stock Size, Quantity (editable), Unit Cost (editable)

**Draft behavior:**
- All fields editable before confirming
- 90% of orders require no edits — auto-populate covers the common case
- Buyer confirms: Supply Order created, linked to selected Production Rows
  via SupplyOrderLineAllocation
- Sub-status on each linked Production Row updates to Order Placed
- ETA recorded on Production Row

**Multiple Production Rows per Supply Order:**
A single Supply Order can cover multiple Production Rows — for example, all
WOs for a given material from the same vendor. The buyer selects all relevant
rows before opening the draft. The draft shows them as line items.

---

## Side Panel — Process-Specific Section

The shared Detail Panel structure (per `detail_panel_spec.md`) handles
Header, Status, Routing Detail, Dependency Context, Batch Context, Pending
Definition Changes, Blocker Section, WO-level Notes, and Actions.

This lens's Process-Specific Section content (rendered between Routing Detail
and Dependency Context per the shared structure):

| Field | Editability | Notes |
|-------|-------------|-------|
| Procurement Sub-Status | Editable per step state and permission | Per ProcessTypeSubStatus seed (Quoted, Ordered, Awaiting Confirmation, etc.) |
| Vendor (effective) | Editable | Display order of precedence: WO-level vendor override > Part's Default Vendor. See Vendor Display Order below |
| Associated Supply Order(s) | Read-only reference; clickable | Supply Order(s) covering this WO. Click to open the Supply Order modal — same modal accessed from the Receiving Lens. Buyer can review the Supply Order, edit ETAs, set/clear Line Exceptions, etc. |
| Supply Order Line Exceptions | Read-only display | If any associated Supply Order Line has `hasException = true`, displays a list with: Line item, exception note, who flagged it, when. Click an exception entry to open the Supply Order modal scoped to that line. The buyer can clear the exception from the modal once resolved with the vendor |
| ETA | Editable | From associated Supply Order if one exists; editable for buyer notes pre-Supply-Order |
| Vendor Details (collapsed by default) | Read-only | Vendor contact, lead time, last cost — reference data |
| Purchase History (collapsed by default) | Read-only | Previous Supply Orders for this Part/Material |
| Process Notes | Editable, append-only | Free text; timestamped and attributed; newest at top. Scoped to the Purchasing step |

**Material Substitutions:** deferred to Rev 2 entirely. Not displayed in
Rev 1.

### Vendor Display Order of Precedence

When displaying the vendor for a Production Row in the Purchasing Lens grid
or the side panel, the system uses the following order of precedence:

1. **WO-level vendor override** — if set via the side panel for this specific
   procurement, this is the displayed vendor
2. **Part's Default Vendor** — used when no WO-level override exists
3. **None displayed** — if neither is set (rare; surfaces as a data
   completeness issue for the buyer to resolve)

When a Default Vendor is changed on a Part record (via Parts Master edit),
the Definition Change Flag system surfaces the impact on open WOs in the
Purchasing Lens. Resolving the flag (Accept Change) updates the WO's
displayed vendor unless a WO-level override is already in place. WO-level
overrides take precedence over flag resolutions — the override is the
explicit per-procurement decision and is not silently overwritten.

---

## Exception Visibility

Supply Order Line Exceptions (per `receiving_lens_spec.md`) are flagged at
receiving time when arrived material has problems. The visibility model for
exceptions in the Purchasing Lens reflects the typical lifecycle:

### Default Case: Exception After Purchase Complete

In the most common case, an exception is flagged after the buyer has already
submitted the Supply Order — the Purchase step is Complete and the WO has
left the Purchasing Lens. The exception surfaces operationally via:

- **Blocker on the affected WO** (created by the receiver when flagging the
  exception) — visible as Red Flag indicator on Operations Lens, Project View,
  and Receiving Lens rows
- **Receiving Lens Process-Specific Section** of the side panel — shows the
  exception details for the WO

The buyer becomes aware of the exception through these surfaces, not by
the row reappearing in the Purchasing Lens. The buyer follows up with the
vendor without the WO necessarily re-entering the Purchasing Lens.

### Re-entry via Routing Rollback

If a manager determines the exception requires re-procurement (defective
material, vendor sent the wrong thing, vendor refuses to ship correct
replacement, etc.), the manager resolves the WO's Blocker with **Routing
Rollback** as the resolution type (per `blocker_spec.md`).

Routing Rollback:
- Reverts the WO's Receive step from its current state back to Waiting
- Reverts the WO's Purchase step from Complete back to Incomplete
- Re-enters the WO in the Purchasing Lens via the standard visibility rule
- The Purchase Sub-Status typically resets to a buyer-set state for vendor
  follow-up (e.g., "Re-quoting" or similar)

This is the clean re-entry path for procurement re-work. No special
visibility logic in the Purchasing Lens is needed — the standard rule
"Purchase step Incomplete + WO Open + not Cancelled" handles re-entry
correctly.

### Edge Case: Exception While Purchase Step Still Incomplete

Less commonly, an exception may be flagged on a Supply Order Line while the
Purchase step on the affected WO is still Incomplete. This can happen when:

- A multi-line Supply Order has been partially submitted (some lines in
  Ordered state, others still being worked) and a problem arises on an
  already-Ordered line
- Buyer submits a Supply Order, then realizes a problem before any material
  arrives, and flags the exception preemptively

In these cases, the WO is already visible in the Purchasing Lens via the
standard visibility rule. The Exception Indicator column surfaces the
exception state on the row, and the side panel exception display provides
detail.

### Summary

| Scenario | Where the Buyer Sees the Exception |
|----------|-----------------------------------|
| Exception flagged after Purchase Complete (typical) | Blocker on the WO surfaces in Operations Lens, Project View, Receiving Lens. Buyer sees indicator there and follows up |
| Manager rolls back the Blocker | WO re-enters Purchasing Lens via standard visibility; standard exception display applies |
| Exception flagged while Purchase Incomplete (edge case) | Exception Indicator column on Purchasing Lens row; side panel exception display |

The Purchasing Lens does NOT include special-case visibility logic to
re-display Complete WOs solely because their Supply Order Line has an
exception. The Blocker mechanism + Routing Rollback workflow is the
operational path for re-procurement.

---

## Vendor Behavior and Principle 10

Each Part has a Default Vendor on its Part record. The buyer may override
vendor at the Production Row level for a specific Supply Order.

When a Default Vendor changes on a Part record, the Definition Change Flag
system surfaces the impact (see `definition_change_flag_spec.md`). The Parts
Master Edit-Time Dialog shows the affected open WOs (which include rows in
this lens with Purchase steps still Incomplete). On confirmation of the
edit, flags are created on each affected WO.

In this lens, affected rows display the yellow flag indicator. Hover reveals
the change context. The buyer can navigate to the WO side panel to see the
flag and (with Manager/Admin permission) resolve via Dismiss or Accept Change.

This applies regardless of the current sub-status of the affected rows —
whether a quote is out, an order is placed, or no action has been taken yet.
The flag is informational; the resolution is a separate Manager/Admin
decision per the flag's resolution workflow.

---

## Blocker Behavior

A Purchase step enters Blocked state when an exception prevents procurement
from proceeding. Standard blocker creation rules apply — note required,
category (Local / Escalated) selected.

Common purchasing blockers:
- Vendor cannot supply
- Material unavailable or backordered indefinitely
- Quote unacceptable, no alternative identified
- Waiting on engineering clarification before ordering

Resolution follows standard blocker resolution workflow. See blocker_spec.md.

---

## Design Notes

- The Purchasing Lens is a decision-support view. The buyer scans demand and
  acts. It should not feel like a data entry form.
- Grouping by Material + Vendor is the primary organizational pattern — this
  is what lets a buyer make one procurement decision that covers multiple
  Production Rows.
- Cumulative Quantity provides cross-order awareness. It may become less
  relevant as batching consolidates demand, but is cheap to surface and
  retained for Rev 1 evaluation.
- The Supply Order draft should feel fast. The common case is auto-populated
  and confirmed in seconds. Editing is available but should not be required
  for standard orders.
- Blank sub-status is visually distinct from "Stock Checked — No Material" —
  the buyer should be able to scan the grid and immediately identify unchecked
  rows.
