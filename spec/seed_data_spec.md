# Tirion — Seed Data Spec

## Purpose

This spec consolidates all bootstrap data required for a fresh Tirion install
to function. The seed defines records that must exist in the database before
any operational use is possible — primarily lookup tables (ProcessTypes,
ProcessTypeSubStatus, AuditAction) and minimal initial records (an admin
user).

The seed is **idempotent** — running it multiple times produces the same end
state. This is essential because the seed will be re-run when adding new
seed entries (e.g., a new ProcessTypeSubStatus value) without duplicating
existing records.

## Source of Truth

This spec is the canonical reference for what the seed must contain. It
synthesizes content from:
- `configuration_management_spec.md` — ProcessTypes and ProcessTypeSubStatus
- `schema.md` — AuditAction lookup table
- General system requirements — initial admin user

If any conflict exists between this spec and the source specs, **the source
specs are authoritative.** This document exists for the build-phase
consultant's convenience; updates flow from source to here, not the other
way.

---

## Implementation Approach

The seed lives in `prisma/seed.ts` (Prisma's standard convention). It is
invoked via `npx prisma db seed`. Use the `upsert` pattern for every record
to ensure idempotency:

```typescript
await prisma.processType.upsert({
  where: { processCode: 'PURCHASE' },
  update: {},
  create: { processCode: 'PURCHASE', processName: 'Purchase', description: 'Material or part procurement' }
});
```

The `update: {}` clause is intentional — when re-running, the seed should
NOT overwrite any user edits to existing records (e.g., admin-renamed
display labels). Only newly-added seed entries get created.

---

## Section 1: ProcessTypes

Per `configuration_management_spec.md`, ProcessTypes are locked in Rev 1
(view-only). Nine seed entries.

| processCode | processName | Description |
|-------------|-------------|-------------|
| PURCHASE | Purchase | Material or part procurement |
| RECEIVE | Receive | Receipt of purchased material |
| MACHINE | Machine | Machining operations |
| WELD | Weld | Welding operations |
| BLACKEN | Blacken | Outside-vendor chemical blackening |
| PAINT | Paint | Painting and coating operations |
| PRINT_3D | 3D Print | Additive manufacturing |
| ASSEMBLE | Assemble | Assembly of components |
| DISTRIBUTION | Distribution | Final routing to project / stock |

All seeded with `isActive = true`.

**Important:** StockFulfillment is NOT a ProcessType. It is a planning gate,
not a routing process. Do not seed it as a ProcessType.

**Inspect and Finish are NOT Rev 1 ProcessTypes.** Earlier drafts of the
spec corpus included these as seed types, but they have been dropped from
Rev 1 entirely. They lack execution lenses and would create orphaned
process types that routing templates could reference but no surface could
operationalize. They may be added in Rev 2 alongside lens definitions.

### Process Types vs. Execution Lenses

Five of the nine ProcessTypes have dedicated execution lenses in Rev 1:
Purchasing, Receiving, Machining, Assembly, Distribution. The remaining
four (Weld, Blacken, Paint, 3D Print) do not have dedicated lenses but ARE
anchor-eligible in management views (Operations Lens, Project View).

Operationally:
- **Weld and Paint** are performed by computer-illiterate operators;
  management mediates state updates verbally
- **Blacken** is performed by an outside vendor; management updates state
  based on shipping and receiving knowledge
- **3D Print** has a Rev 2 dedicated lens planned; in Rev 1, management
  handles state updates from Operations Lens / Project View

Anchor + filter in Operations Lens serves as the substitute working surface
for these four processes (see `anchor_filter_spec.md`).

---

## Section 2: ProcessTypeSubStatus

Per `configuration_management_spec.md`, sub-statuses are scoped per
ProcessType. Seed entries are user-editable post-installation (admins can
edit, deactivate, reorder).

### Purchase Sub-Statuses

| subStatusName | description | displayOrder |
|---------------|-------------|--------------|
| Material checked | Material verification (Rev 1 — material handling not yet separated) | 10 |
| RFQ Pending | Quote requested from vendor; awaiting response | 20 |
| Quote Received | Vendor responded; buyer evaluating | 30 |
| Ordered | Supply Order submitted to vendor | 40 |

### Receive Sub-Statuses

| subStatusName | description | displayOrder |
|---------------|-------------|--------------|
| Partial | Partial shipment received; awaiting remainder | 10 |
| Requested Update | Vendor contacted for shipment status update | 20 |
| Delayed | Vendor confirmed shipment delay | 30 |

### Machine Sub-Statuses

| subStatusName | description | displayOrder |
|---------------|-------------|--------------|
| Setup | Machine setup in progress | 10 |
| Running | Machining operation actively running | 20 |
| Complete | Machining complete; awaiting next step or QA | 30 |
| Hold for QA | Held pending quality inspection | 40 |
| Hold for Next Setup | Machinist finished portion; awaiting next station availability | 50 |

### Assemble Sub-Statuses

| subStatusName | description | displayOrder |
|---------------|-------------|--------------|
| Staging | Components being staged for assembly | 10 |
| Validate Fit | Trial assembly to validate component fit | 20 |
| In Assembly | Active assembly in progress | 30 |
| QA Review | Held for assembler review or quality check | 40 |

### Distribution, Weld, Blacken, Paint, 3D Print

No seed sub-statuses for these processes.

- **Distribution:** Primary state machine is sufficient.
- **Weld, Paint:** Performed by computer-illiterate operators; state
  changes mediated by management. Sub-statuses can be added later if
  shop's workflow benefits from them.
- **Blacken:** Outside-vendor process. Useful sub-statuses to add manually
  later for testing the admin add-sub-status workflow: "At Vendor",
  "Received" (intermediate sub-statuses while step is Started). Not seeded
  initially.
- **3D Print:** Rev 2 dedicated lens planned; sub-statuses defined at that
  time alongside lens design.

---

## Section 3: ProcurementCategory

Per `configuration_management_spec.md`, ProcurementCategory is an
admin-configurable lookup that replaces the former `ProcurementType` enum.
Five starting categories from the predecessor system are seeded at
initialization. Admins can edit, deactivate, or add categories post-install.

| categoryCode | categoryName | description | displayOrder |
|--------------|--------------|-------------|--------------|
| CTL | Cut to Length | Material cut to length by a vendor specifically for this Part | 1 |
| PO | Part Off | Material cut in-house from stocked material | 2 |
| P | Purchased | Finished purchased component | 3 |
| SM | Sheet Metal | Sheet metal stock | 4 |
| HW | Hardware | Fasteners, fittings, off-the-shelf components | 5 |

All seeded with `isActive = true`. Upsert key: `categoryCode`.

---

## Section 4: AuditAction Lookup

Per `schema.md`, AuditAction is a lookup table; new action types are added
via row inserts, not schema migrations. The full Rev 1 seed list:

### Step Actions
| actionName | category | description |
|------------|----------|-------------|
| StepStateChanged | Step | Generic step state transition (with before/after in payload) |
| StepSkipped | Step | Step transitioned to Skipped |
| InferredStepSkip | Step | Step marked Skipped by inference (out-of-sequence completion) |

### WO Actions
| actionName | category | description |
|------------|----------|-------------|
| WOStateChanged | WO | WOStatus transition (Unreleased → Open, Open → Complete, etc.) |
| WOCompleted | WO | WO status transition to Complete via standard execution |
| WOStockFulfillmentReleased | WO | Stock Fulfillment Release event — sets stockFulfillmentReviewedAt. WOStatus unchanged for Pass-Through WOs |
| WOBatchingConfirmed | WO | Batching Confirm event — transitions WOStatus from Unreleased to Open |
| ManagerSkipAndFulfill | WO | Project View recovery action — skip remaining steps and complete from stock |
| ReturnToStock | WO | Primitive 3 — Complete WO returned to start with stock increment |
| AssemblyCascadeSkip | WO | Descendant WO Skip-Completed via Assembly stock fulfillment cascade |
| AssemblyCascadeReverse | WO | Descendants un-Skip when Primitive 3 fires on a Stock-Fulfilled Assembly |
| WOSplit | WO | WO Split primitive applied — original adjusted, new WO created |
| WOCreatedViaSplit | WO | New WO created as a result of WO Split (distinguishes from compile-generated WOs) |
| WOQuantityAdjusted | WO | WO quantity field updated (used for split commits and other quantity edits) |
| WOCancelled | WO | Cancel primitive applied to leaf WO |
| WOReceiptSatisfied | WO | WO's Supply Order allocation marked satisfied via Receiving Lens grid (manual allocation during partial receipt) |
| WOEtaUpdated | WO | Per-WO ETA edited (independent of Supply Order Line ETA propagation) |
| RoutingResetByFlagResolution | WO | All WO steps regenerated from current routing template via Accept Change resolution |
| WOAttributeUpdatedByFlagResolution | WO | WO field updated to current Library value via Accept Change resolution |
| BOMComponentAddedViaFlagResolution | WO | New child WO subtree generated under parent Assembly via Component Added Accept Change resolution |

### Batch Actions
| actionName | category | description |
|------------|----------|-------------|
| BatchCreated | Batch | Production Batch created via Batching Lens |
| BatchDissolved | Batch | Batch dissolved (only one member remained) |
| BatchAdjustment | Batch | WO membership reshaped via Batch Adjustment Workspace |
| BatchMemberRemovedForFlagResolution | Batch | WO removed from batch to enable per-member flag resolution |

### Blocker Actions
| actionName | category | description |
|------------|----------|-------------|
| BlockerCreated | Blocker | Blocker created on a WO or Batch |
| BlockerPending | Blocker | Blocker transitioned to Pending Resolution |
| BlockerResolved | Blocker | Blocker resolved with type (Cleared, BatchAdjustment, RoutingRollback, WOSplit) |

### Project Actions
| actionName | category | description |
|------------|----------|-------------|
| ProjectCreated | Project | Draft Project created |
| ProjectCompiled | Project | Draft → Active via successful compilation |
| ProjectMetadataEdit | Project | Project Name, Customer Name, or Notes edited on Active Project |
| ProjectDueDateChanged | Project | Project Due Date edited (with cascade summary to N WOs) |
| ProjectTopLevelAdded | Project | New Top-Level Item added to Active Project |
| ProjectArchived | Project | Project transitioned to Archived (Active or Complete origin) |
| ProjectDraftDeleted | Project | Draft Project hard-deleted |

### Stock Actions
| actionName | category | description |
|------------|----------|-------------|
| StockFulfilled | Stock | WO completed via Fulfill from Stock |
| StockPassThrough | Stock | WO explicitly passed through in Stock Fulfillment |
| StockAutoPassThrough | Stock | WO auto-passed-through (lost candidacy or implicit at release) |
| StockReconciliation | Stock | Stock count adjusted via Reconcile Stock modal |
| StockFulfillmentReleased | Stock | Aggregate Release event (count of WOs released, scope) |
| StockAllocation | Stock | From-stock attribution on a Project View edit (combined WO state + stock decrement) |
| InventoryAdjusted | Stock | Direct inventory adjustment (Distribution Lens, Parts Master) |

### Supply Order Actions
| actionName | category | description |
|------------|----------|-------------|
| SupplyOrderLineFulfilled | SupplyOrder | Supply Order Line marked Fulfilled — satisfies all unsatisfied WOs allocated to it |
| SupplyOrderLinePartialReceipt | SupplyOrder | Partial qty received recorded on a Supply Order Line (does not satisfy WOs) |
| SupplyOrderLineExceptionSet | SupplyOrder | Exception flagged on a Supply Order Line by receiver |
| SupplyOrderLineExceptionCleared | SupplyOrder | Exception cleared on a Supply Order Line (typically by Purchasing after vendor resolution) |
| SupplyOrderLineETAUpdated | SupplyOrder | Supply Order Line ETA edited — propagates to all member WO ETAs in same transaction |

### Definition Actions
| actionName | category | description |
|------------|----------|-------------|
| PartCreated | Definition | New Part record created |
| PartUpdated | Definition | Part definition field edited |
| PartDeactivated | Definition | Part isActive set to false |
| BOMRowAdded | Definition | Component added to an assembly's BOM |
| BOMRowRemoved | Definition | Component removed from an assembly's BOM |
| BOMRowEdited | Definition | BOM quantity or displayOrder edited |
| RoutingTemplateCreated | Definition | New Routing Template Definition created |
| RoutingTemplateEdited | Definition | Existing template edited (steps added/removed/reordered) |
| RoutingTemplateRetired | Definition | Template isActive set to false |

### Flag Actions
| actionName | category | description |
|------------|----------|-------------|
| DefinitionChangeFlagCreated | Flag | New definition change flag created (one entry per affected entity) |
| DefinitionChangeFlagResolved | Flag | Flag resolved (Dismiss or AcceptChange) |
| DefinitionChangeFlagInheritedViaWOSplit | Flag | Original flag auto-resolved when flagged WO was split; new flags created on resulting WOs |
| DefinitionChangeFlagAutoResolvedViaBatchDissolution | Flag | Batch flag auto-resolved when batch was dissolved while flag was open |

### Configuration Actions
| actionName | category | description |
|------------|----------|-------------|
| VendorCreated | Configuration | New Vendor record created |
| VendorUpdated | Configuration | Vendor attribute fields edited |
| VendorDeactivated | Configuration | Vendor isActive set to false |
| VendorReactivated | Configuration | Vendor isActive restored to true |
| ProcurementCategoryCreated | Configuration | New ProcurementCategory record created |
| ProcurementCategoryUpdated | Configuration | ProcurementCategory attribute fields edited |
| ProcurementCategoryDeactivated | Configuration | ProcurementCategory isActive set to false |
| ProcurementCategoryReactivated | Configuration | ProcurementCategory isActive restored to true |

**Total AuditAction seed entries:** 67

All seeded with `isActive = true`. New action types added during Rev 1
build (or Rev 2+) are inserted via additional seed runs or admin tooling.

---

## Section 5: Initial Admin User

A fresh install needs at least one user with Admin role so someone can log
in and configure the system. Without this, the manual user selection
dropdown is empty and the system is unusable.

### Single Bootstrap Admin

| Field | Value |
|-------|-------|
| userName | admin |
| displayName | Admin |
| role | Admin |
| isActive | true |
| defaultStation | (null) |

The bootstrap admin can be renamed, supplemented, or replaced via the User
management surface after initial login. The seed should NOT overwrite an
admin user that already exists with this userName — `upsert` with `update: {}`
preserves any post-install changes.

### Considerations

- For local development, this seeded admin is sufficient
- For production deployments, the deployer should change the bootstrap
  admin's name and add real users immediately. The bootstrap admin is a
  scaffolding mechanism, not a production identity
- Rev 1 has no authentication; the bootstrap admin is identified by name
  selection in the user dropdown. Rev 2 authentication will require
  password setup at first login

---

## Section 6: What Is NOT Seeded

The seed is intentionally minimal. The following are NOT seeded — they
require deliberate user input:

- **Vendors** — created via Parts Master in-context creation (Pattern B)
  or via the Vendors configuration surface
- **MaterialSpecs** — same; Pattern B from Parts Master
- **Parts** — created via Parts Master
- **BOMs** — created via BOM Editor for Assembly Parts
- **Routing Templates** — created via Routing Template Editor
- **Projects** — created via Project Creation View
- **Work Orders** — generated from Projects via compilation
- **Supply Orders** — created via Purchasing Lens
- **Production Batches** — created via Batching Lens
- **Additional Users** — created via User management surface

The seed creates the catalog/lookup data; everything operational is created
by users through the appropriate surfaces.

---

## Implementation Notes

### Idempotency Strategy

Use `upsert` with empty `update: {}` for every seed record:

```typescript
// CORRECT — preserves user edits
await prisma.processTypeSubStatus.upsert({
  where: { processTypeId_subStatusName: { processTypeId, subStatusName: 'Setup' } },
  update: {},  // <-- intentionally empty
  create: { processTypeId, subStatusName: 'Setup', description: '...', displayOrder: 10 }
});
```

```typescript
// INCORRECT — overwrites user edits on every seed run
await prisma.processTypeSubStatus.upsert({
  where: { processTypeId_subStatusName: { processTypeId, subStatusName: 'Setup' } },
  update: { description: '...', displayOrder: 10 },  // <-- overwrites admin changes
  create: { processTypeId, subStatusName: 'Setup', description: '...', displayOrder: 10 }
});
```

### Seeding Order

Order matters because of foreign key dependencies:

1. ProcessTypes (no FK dependencies)
2. ProcessTypeSubStatus (depends on ProcessType)
3. AuditAction (no FK dependencies; can be parallel with above)
4. User (no FK dependencies)

### Re-Running the Seed

The seed should be safe to run at any time:
- After a fresh `prisma migrate reset`
- After adding new seed entries to this spec
- After a developer wipes their local database

The hooks system (per `BUILD_ROADMAP.md` Phase 0a) does not auto-run the
seed on commits. Re-running is manual: `npx prisma db seed`.

### Verification

After seeding, verify:
- All 9 ProcessTypes exist
- 16 ProcessTypeSubStatus entries exist (4 + 3 + 5 + 4 across the four
  process types with seed entries)
- All 67 AuditAction entries exist (63 original + 4 ProcurementCategory)
- All 5 ProcurementCategory entries exist
- One admin user with userName = "admin" exists

A simple verification script in `prisma/verify-seed.ts` can sanity-check
the counts. Optional but useful during development.

---

## Maintenance

When adding new lookup data during Rev 1 build:

1. Update the corresponding source spec (configuration_management_spec.md
   for sub-statuses, schema.md for AuditAction entries)
2. Update this spec to reflect the new entry
3. Update `prisma/seed.ts` with the new upsert call
4. Run `npx prisma db seed` to apply

The hooks system may automate some of this; otherwise it's a four-step
update.
