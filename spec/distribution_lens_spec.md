# Tirion — Distribution Lens Spec

## Purpose

The Distribution Lens manages the final disposition of completed supply produced
by Work Orders or Production Batches. It is the last step in the production
routing sequence before parts reach their destination.

The operator's task is simple: confirm produced quantity and distribute completed
parts to their correct destinations (projects or stock).

---

## Visibility Rules

A Production Row appears in the Distribution Lens when ALL of the following
are true:
- WOStatus = `Open`
- All routing steps are Complete (current step position = total steps)
- Parent Project is Active (not Archived)
- WO is not Cancelled

A Production Row leaves this lens when:
- The Distribution action is confirmed (all parts routed; WOStatus
  transitions to Complete), OR
- The WO is Cancelled (terminal state — excluded from operational visibility)

Cancelled WOs are excluded from this lens entirely. Only fully complete items
that are still Open enter this lens — nothing in-progress appears here.

---

## Row Model

| Row Type | Description |
|----------|-------------|
| WO Row | Individual work order fully complete |
| Batch Row | Production batch fully complete |

Child WOs under a batch are hidden from this lens — the batch is the unit of work.

---

## Grid Columns

| Column | Notes |
|--------|-------|
| Part Number | |
| Part Name | |
| WO / Batch ID | |
| Inventory Location | Current stock location (reference) |
| In Stock Quantity | Current known stock level prior to distribution |
| Total Quantity Produced | Good, distributable units (scrap excluded) |
| Demand Quantity | Total demand across all projects requiring this part |
| Priority | |
| Due Date | |
| State | Complete or Blocked |
| Flag Indicator | Row Indicators per `terminology_lock.md` Cluster 9: Red Flag (Blocker), Yellow Flag (Definition Change Flag). White Flag (Supply Order Exception) does NOT apply in this lens — distributors act on Blockers when material had issues, not on the upstream Supply Order Exception itself. Display order: Red → Yellow |

**In Stock Quantity** is a reference field providing passive inventory visibility.
It allows the operator to notice and flag discrepancies while distributing.
The Reconcile Stock action in the side panel uses the shared modal pattern
defined in Stock Fulfillment spec — same UX, same audit logging.

---

## Distribution Rules

**If Produced Quantity ≥ Total Demand:**
1. System allocates quantities to projects in priority order
2. Excess supply routes to stock
3. Operator confirms the distribution breakdown
4. Row is marked Complete and removed from the lens

**If Produced Quantity < Total Demand:**
1. Row is marked Blocked
2. Note required explaining the shortage
3. Escalated to management for resolution
4. Resolution options: split demand, adjust WOs, issue new supply order

---

## Completion Action

When the operator marks a row Complete:
1. Produced quantity confirmed
2. Distribution mappings executed (parts routed to project bays / stock)
3. Stock quantities updated
4. Row removed from Distribution Lens
5. AuditLog entry written

---

## Blocked State

A row enters Blocked when produced quantity is insufficient to satisfy total demand.

Required on blocking:
- Note describing the shortage context

Management resolution options:
- Split demand across available supply
- Adjust WO demand quantities
- Issue a new production order for the shortfall

---

## Side Panel — Process-Specific Section

The shared Detail Panel structure (per `detail_panel_spec.md`) handles
Header, Status, Routing Detail, Dependency Context, Batch Context, Pending
Definition Changes, Blocker Section, WO-level Notes, and Actions.

This lens's Process-Specific Section content (rendered between Routing Detail
and Dependency Context per the shared structure):

| Field | Editability | Notes |
|-------|-------------|-------|
| Distribution Breakdown | Read-only | List of destination projects with quantities allocated to each. Read-only summary; the completion modal handles workflow context |
| Parent Ancestry | Read-only | Full ancestry chain (top-level → intermediate → immediate parent). See Ancestry Tree Display below |
| Stock Remainder | Read-only | Quantity going to stock after demand is satisfied (if any) |
| In Stock Quantity | Read-only display | Reference field showing current stock count for this Part — enables operator to notice discrepancies |
| Reconcile Stock | Action button | Opens shared Reconcile Stock modal per Stock Fulfillment spec. Available when operator notices In Stock Quantity discrepancy |
| Process Sub-Status | Editable per step state and permission | Per ProcessTypeSubStatus seed. May not apply meaningfully to Distribution; left in for consistency |
| Process Notes | Editable, append-only | Free text; timestamped and attributed; newest at top. Scoped to the Distribution step |

### Ancestry Tree Display

For child component WOs, the Parent Ancestry field displays the full lineage
from top-level down to this WO. This provides distributors with the
operational context needed to physically route parts to the correct
sub-assembly bay.

Display format (breadcrumb-style chain):

> Project 98324.02 (top-level: "Pump Frame Assembly") → Sub-Assembly "Bearing
> Carrier" (WO #341) → Sub-Assembly "Inner Race Assembly" (WO #498) → THIS WO

Rules:
- For top-level WOs (no parent): displays just the project and top-level
  reference
- For first-level child WOs: displays project + top-level + immediate parent
- For deeper nesting: displays full chain
- For WOs distributing to stock: chain ends in "→ Stock" instead of a parent
  reference
- Chain elements are **display-only in Rev 1** — not clickable for navigation.
  Distribution role has no operational reason to navigate the ancestry chain
  during their workflow

### Reconcile Stock Action

When the operator notices a discrepancy between the displayed In Stock
Quantity and the actual physical count, the Reconcile Stock action opens
the shared Reconcile Stock modal. Modal behavior is defined in
`stock_fulfillment_view_spec.md` and reused here for consistency.

The reconciliation is optional — the operator is not required to reconcile
during distribution but has the tool available when discrepancies are
noticed.

---

## Design Notes

- Distribution is the lightest lens in the system. Most rows should be a simple
  confirm action. The UI should reflect that simplicity.
- The In Stock Quantity field is passive context — it should be visually
  de-emphasized compared to Produced Quantity and Demand Quantity, which are
  the operationally active values.
- Blocked rows are the exception. They should be visually prominent and clearly
  communicate that management action is needed.
- The inventory reconciliation action is opportunistic — it happens when the
  operator notices something while distributing, not as a required workflow step.

---

## Open Design Questions

- **Stock quantity updates in Rev 1** — in Rev 1 without the full material handling
  model, "stock quantities updated" on completion means updating the `stockCount`
  field on the Part record. In Rev 2, this feeds the full OnHand / Allocated /
  Available model. Confirm this is the correct Rev 1 approach before Phase 7 build.
