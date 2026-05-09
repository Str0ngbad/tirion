# Tirion — Database Schema

## Overview

23 tables organized into four layers:
- **Definition Layer** — Parts, BOM, Routing Templates, lookup tables. Project-agnostic. The source of truth for what things are and how they're made.
- **Execution Layer** — Projects, Work Orders, Work Order Steps, Batches, Blockers, Definition Change Flags. Where production state lives.
- **Procurement / Receiving Layer** — Supply Orders, Supply Order Lines, Supply Order Line Allocations, Receipts, Receipt Lines.
- **Supporting Tables** — Users, Audit Log, Audit Action lookup.

This is the post-Stage-6 / post-reconciliation schema, incorporating all decisions
locked through Stage 5, Stage 6 schema validation, and the Definition Change Flag
spec finalized during reconciliation.

---

## Core Concepts

**Parts and Assemblies share one table.** The `partType` field distinguishes them.
An Assembly is a Part that has children in the BOM table. A Part is a leaf node with
no children. Both get Work Orders. Both have Routing Templates.

**BOM is project-agnostic.** The BOM table defines parent/child relationships between
Parts at the definition level. When a project is compiled, the system walks this tree
and generates a mirrored Work Order tree. The BOM does not change per project.

**WorkOrderSteps.state is derived for 'Ready'.** A step becomes Ready when all steps
with a lower stepIndex on the same Work Order are Complete. This is computed by
application logic on every upstream step completion — never set directly by a user.

**Batch state is authoritative.** When a Work Order has a batchId, the Batch state
drives what execution lenses display. Individual WO step states still update internally.

**WO Status carries release visibility.** WOStatus has four values: `Unreleased`,
`Open`, `Complete`, `Cancelled`. Unreleased WOs are visible only in planning views
(Stock Fulfillment, Batching Lens, Project Creation View, Project View). Open WOs
are visible in operational views. Complete WOs are visible in operational views as
project context. Cancelled WOs are excluded from operational views by default
(visible via explicit toggle in Project View).

**Stock Fulfillment and Batching are two distinct gates.** WOs progress through
both:

```
Compile → Unreleased → [Stock Fulfillment Release] → Unreleased+reviewed → [Batching Confirm] → Open → Execution
                              │
                              └→ Fulfill from Stock → Complete (skips both gates)
```

The transition `Unreleased → Open` happens via Batching Confirm, not directly via
Stock Fulfillment Release. Stock Fulfillment Release sets `stockFulfillmentReviewedAt`
on Pass-Through WOs (making them visible to Batching) but keeps WOStatus as
Unreleased. Batching Confirm transitions WOStatus to Open. Fulfilled WOs (Fulfill
from Stock) bypass both gates and go directly Unreleased → Complete via Skipped
steps.

**Project Due Date cascades to all WOs.** `WorkOrder.dueDate` is denormalized from
`Project.dueDate` for query efficiency. Editing a Project's Due Date updates all member
WOs in a single atomic transaction.

**Definition changes do not auto-cascade to WIP.** When a Part, BOM, or Routing Template
is edited, affected open WOs receive `DefinitionChangeFlag` records that surface the
question for human resolution. The flag system is the mechanism by which Principle 10
surfaces deferred reconciliation decisions. Cosmetic field changes do not trigger flags.

**All state changes write to AuditLog** in the same database transaction.

---

## Definition Layer

### Parts

All parts and assemblies. Single table, distinguished by `partType`.

```prisma
model Part {
  partId          Int               @id @default(autoincrement())
  partNumber      String            @unique
  partName        String
  partType        PartType          // 'Part' | 'Assembly'
  description     String?
  defaultVendorId             Int?
  materialSpecId              Int?
  routingTemplateDefinitionId Int?
  blankLength                 Decimal?  // length of raw material consumed per piece; nullable
  procurementType             ProcurementType  // 'Make' | 'Buy' | 'MakeBuy'
  inventoryLocation           String?   @unique  // enforced unique; default sort field for Parts Master
  stockCount                  Decimal?  @default(0)  // current on-hand count; core for distribution and stock fulfillment
  isActive                    Boolean   @default(true)
  notes                       String?

  // Relations
  defaultVendor     Vendor?           @relation(fields: [defaultVendorId], references: [vendorId])
  materialSpec      MaterialSpec?     @relation(fields: [materialSpecId], references: [materialSpecId])
  routingTemplate   RoutingTemplateDefinition? @relation(fields: [routingTemplateDefinitionId], references: [routingTemplateDefinitionId])
  bomParent         BOM[]             @relation("ParentPart")
  bomChild          BOM[]             @relation("ChildPart")
  workOrders        WorkOrder[]
}

enum PartType {
  Part
  Assembly
}

enum ProcurementType {
  Make
  Buy
  MakeBuy
}
```

**Rules:**
- `routingTemplateDefinitionId` references the template this part uses. Nullable — a part may exist before a template is assigned.
- Assembly parts may not be assigned a template containing Purchase or Receive steps. Enforce at assignment time.
- `blankLength` applies to Parts with a MaterialSpec. Null for Assemblies and purchased components.
- `isActive = false` is a soft delete. Inactive parts remain on historical records.

---

### BOM

Defines parent/child relationships between Parts. One row per parent/child pair.

```prisma
model BOM {
  bomId         Int   @id @default(autoincrement())
  parentPartId  Int
  childPartId   Int
  quantity      Decimal
  displayOrder  Int   // display order within parent assembly

  // Relations
  parentPart  Part  @relation("ParentPart", fields: [parentPartId], references: [partId])
  childPart   Part  @relation("ChildPart", fields: [childPartId], references: [partId])
}
```

**Rules:**
- `parentPartId` must reference a Part where `partType = Assembly`.
- A Part can appear as a child in multiple assemblies (reuse across products).
- A Part cannot appear as a child of itself, transitively (no circular BOM references).
  Enforced at the application layer via full ancestry traversal on every Add Component.
- A Part cannot appear as a direct child of the same parent more than once.
  Enforced at the form layer.
- `displayOrder` controls display order in the BOM Editor and in Project View tree
  visualization. Distinct from `WorkOrderStep.stepIndex` (execution sequence) — the
  rename clarifies the difference.

---

### RoutingTemplateDefinition

A named, reusable routing preset. The source of truth for how a category of parts
is produced. Parts reference a definition; WorkOrderSteps are generated from it
as a snapshot at WO creation time.

```prisma
model RoutingTemplateDefinition {
  routingTemplateDefinitionId Int     @id @default(autoincrement())
  templateName                String  @unique
  description                 String?
  isActive                    Boolean @default(true)

  // Relations
  steps RoutingTemplateStep[]
  parts Part[]
  workOrders WorkOrder[]  // WOs reference the template they were generated from (snapshot)
}
```

**Rules:**
- Template names must be unique.
- `isActive = false` retires a template. Parts referencing it are not affected —
  their existing WOs continue. New WO generation from an inactive template is blocked
  at Project Compilation time.
- Editing a template triggers a confirmation screen showing how many parts reference
  it and a warning that changes apply to future Work Orders only.
- Open Work Orders generated from a previous version of this template are flagged
  for review (flagging mechanism is a Rev 2 feature — the principle is established now).

---

### RoutingTemplateStep

Ordered steps belonging to a RoutingTemplateDefinition. One row per step.

```prisma
model RoutingTemplateStep {
  routingTemplateStepId       Int     @id @default(autoincrement())
  routingTemplateDefinitionId Int
  stepIndex                   Int     // 1-based, ordered execution sequence
  processTypeId               Int

  // Relations
  templateDefinition  RoutingTemplateDefinition @relation(fields: [routingTemplateDefinitionId], references: [routingTemplateDefinitionId])
  processType         ProcessType               @relation(fields: [processTypeId], references: [processTypeId])
}
```

**Rules:**
- Maximum 10 steps per template.
- Steps must be contiguous and 1-based (1, 2, 3...).
- Templates assigned to Assembly parts may not include Purchase or Receive steps.
  Enforce at template assignment time on the Part record.

---

### MaterialSpec

Raw material specifications. Referenced by Parts.

```prisma
model MaterialSpec {
  materialSpecId  Int     @id @default(autoincrement())
  materialName    String  // e.g. '1018 CRS', '6061-T6'
  form            String  // e.g. 'Flat Bar', 'Round', 'DOM Tubing'
  stockSize       String  // e.g. '.25 x 2', '2" OD x 1.5" ID' — free text, human-readable
  unitOfMeasure   String  // 'in' | 'ft' | 'each'
  isActive        Boolean @default(true)

  // Relations
  parts Part[]
}
```

**Notes:**
- `stockSize` is free text to accommodate varied material forms without over-engineering.
- `unitOfMeasure` drives how quantities are displayed in purchasing and receiving.

---

### Vendor

Suppliers of purchased parts and raw materials.

```prisma
model Vendor {
  vendorId    Int     @id @default(autoincrement())
  vendorName  String
  contactInfo String?
  isActive    Boolean @default(true)
  notes       String?

  // Relations
  parts        Part[]
  supplyOrders SupplyOrder[]
}
```

---

### ProcessType

Master list of all process types available for routing templates and lenses.
Configurable — new process types can be added without code changes.

```prisma
model ProcessType {
  processTypeId   Int     @id @default(autoincrement())
  processCode     String  @unique  // e.g., "MACHINE", "ASSEMBLE"
  processName     String  @unique  // display label
  description     String?
  isActive        Boolean @default(true)

  // Relations
  routingTemplateSteps   RoutingTemplateStep[]
  workOrderSteps         WorkOrderStep[]
  blockers               Blocker[]
  subStatuses            ProcessTypeSubStatus[]
  userAssignments        UserProcessTypeAssignment[]
}
```

**Seed data (Rev 1 — 9 ProcessTypes; see `seed_data_spec.md` for canonical
list):**

| processCode | processName | description |
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

**Notes:**
- ProcessTypes are locked in Rev 1 — view-only via the configuration surface.
  See `configuration_management_spec.md`.
- Five of the nine ProcessTypes have dedicated execution lenses (Purchasing,
  Receiving, Machining, Assembly, Distribution). The other four (Weld,
  Blacken, Paint, 3D Print) appear in routing templates but are managed
  via Operations Lens / Project View with anchor + filter support.
- Inspect and Finish are NOT Rev 1 ProcessTypes (no execution lenses
  defined; would create orphaned types).
- StockFulfillment is NOT a ProcessType — it is a planning gate, not a
  routing process.
- The configurable lens component uses `processCode` (or `processTypeId`) to
  filter WO rows per lens.
- The color-coding visual system supports approximately 8-10 ProcessTypes
  effectively. The 9 Rev 1 ProcessTypes are within this range. Beyond ~10,
  color differentiation becomes unreliable — a design constraint relevant
  for future ProcessType additions in Rev 2+.

---

### ProcessTypeSubStatus

Validated sub-status vocabulary per ProcessType. Replaces free-text approach
on WorkOrderStep.subStatus with a constrained dropdown plus a free-text
overflow field.

```prisma
model ProcessTypeSubStatus {
  processTypeSubStatusId Int      @id @default(autoincrement())
  processTypeId          Int
  subStatusName          String   // e.g., "Setup", "Running"
  description            String?
  displayOrder           Int      @default(0)  // order in dropdown
  isActive               Boolean  @default(true)

  // Relations
  processType    ProcessType     @relation(fields: [processTypeId], references: [processTypeId])
  workOrderSteps WorkOrderStep[]

  @@unique([processTypeId, subStatusName])
}
```

**Notes:**
- Each ProcessType has its own set of valid sub-status values.
- Operators select from the dropdown via `WorkOrderStep.subStatusId`.
- For text that doesn't fit the dropdown vocabulary, operators use the free-text
  overflow field on WorkOrderStep (`subStatusNote`).
- Sub-status is operator context within a step state — never drives state transitions.
- `isActive = false` retires a sub-status without deleting historical references.

**Seed data (Rev 1 — see `seed_data_spec.md` for canonical list):**

The canonical seed list lives in `seed_data_spec.md`. Summary:
- **Purchase:** Material checked, RFQ Pending, Quote Received, Ordered (4 entries)
- **Receive:** Partial, Requested Update, Delayed (3 entries)
- **Machine:** Setup, Running, Complete, Hold for QA, Hold for Next Setup (5 entries)
- **Assemble:** Staging, Validate Fit, In Assembly, QA Review (4 entries)
- **Distribution:** No seed sub-statuses

Total: 16 ProcessTypeSubStatus seed entries.

---

## Execution Layer

### Project

A customer order. Top-level container for all related Work Orders.

```prisma
model Project {
  projectId          Int           @id @default(autoincrement())
  projectNumber      String        @unique  // e.g. '10102.01' — user-entered, format conventions are organizational
  projectName        String
  customerName       String?
  dueDate            DateTime?
  status             ProjectStatus @default(Draft)
  notes              String?
  createdAt          DateTime      @default(now())
  creatorUserId      Int
  lastEditedAt       DateTime      @default(now())
  lastEditedUserId   Int

  // Relations
  workOrders   WorkOrder[]
  creator      User        @relation("ProjectCreator", fields: [creatorUserId], references: [userId])
  lastEditedBy User        @relation("ProjectLastEditor", fields: [lastEditedUserId], references: [userId])
}

enum ProjectStatus {
  Draft
  Active
  Complete
  Archived
}
```

**Rules:**
- New Projects default to `Draft`. Compilation transitions Draft → Active in an
  atomic transaction with WO generation.
- Active → Complete is automatic when the last WO becomes Complete. No manual
  Complete action.
- Complete → Archived is manual via Project Archive. Archive may also be initiated
  on Active Projects (with stronger confirmation that surfaces incomplete WO counts);
  this transitions Active → Archived directly.
- Drafts are hard-deleted on confirm (no soft-delete state). AuditLog captures
  the deletion event.
- Archived Projects are read-only. No state changes, metadata edits, or operational
  actions are possible. Un-archive is a Rev 2 feature.

---

### WorkOrder

One row per part-in-BOM-position per project. Mirrors the BOM tree at the project level.

```prisma
model WorkOrder {
  workOrderId                 Int       @id @default(autoincrement())
  projectId                   Int
  partId                      Int
  parentWoId                  Int?      // FK to WorkOrder — mirrors BOM hierarchy; null for top-level
  routingTemplateDefinitionId Int       // snapshot of which template generated this WO at compile time
  topLevelIndex               Int?      // suffix value (1, 2, 3...) for top-level WOs; null for non-top-level WOs
  quantity                    Decimal
  priority                    Int?      // global integer; lower number = higher priority; nullable
  dueDate                     DateTime  // denormalized from Project.dueDate; cascades on Project edit
  eta                         DateTime? // per-WO ETA, independently editable; receives propagated updates from Supply Order Line ETA edits
  status                      WOStatus  @default(Unreleased)
  batchId                     Int?      // FK to ProductionBatch; null if unbatched
  stockFulfillmentReviewedAt  DateTime? // stamped when WO has a Stock Fulfillment decision recorded
  notes                       String?
  createdAt                   DateTime  @default(now())

  // Relations
  project         Project           @relation(fields: [projectId], references: [projectId])
  part            Part              @relation(fields: [partId], references: [partId])
  parentWO        WorkOrder?        @relation("WOHierarchy", fields: [parentWoId], references: [workOrderId])
  childWOs        WorkOrder[]       @relation("WOHierarchy")
  routingTemplate RoutingTemplateDefinition @relation(fields: [routingTemplateDefinitionId], references: [routingTemplateDefinitionId])
  batch           ProductionBatch?  @relation(fields: [batchId], references: [batchId])
  steps           WorkOrderStep[]
  supplyOrderAllocations SupplyOrderLineAllocation[]
}

enum WOStatus {
  Unreleased
  Open
  Complete
  Cancelled
}
```

**Rules:**
- `parentWoId` mirrors the BOM `parentPartId` relationship at the execution level.
  When a Part appears in multiple BOM positions in the same project, multiple WOs
  are generated — one per BOM row — each with its own `parentWoId`.
- `parentWoId` is mutable post-compilation — Component Added flag resolution can
  create new child WOs under existing parents; Cancel reduces a parent's denominator
  in readiness math.
- Top-level WOs have `parentWoId = null` and a non-null `topLevelIndex`.
- `topLevelIndex` is the suffix used to display Top-Level References (e.g., "20137.01"
  combines `Project.projectNumber` + "." + zero-padded `topLevelIndex`).
- Top-Level Indexes are sequentially assigned and immutable. The next available index
  is computed from the maximum existing topLevelIndex on the Project, plus one.
  Suffixes are never reused even if a top-level item was deleted from a Draft.
- `routingTemplateDefinitionId` snapshots which template generated this WO. Updated
  at `RoutingTemplateEdited` flag Accept Change resolution to point to current template.
- `priority` is global and nullable — set at the WO level (or via Project Compilation
  with a project-level Priority value as starting point). Null priority is meaningful
  ("not yet prioritized").
- `dueDate` is denormalized from `Project.dueDate`. Editing Project.dueDate cascades
  to all member WOs in a single atomic transaction with a single AuditLog entry.
- `status = Unreleased` is the initial state at compile or at Add-Top-Level-Item time.
  Unreleased WOs without `stockFulfillmentReviewedAt` set are visible in Stock Fulfillment.
  Unreleased WOs WITH `stockFulfillmentReviewedAt` set are visible in Batching Lens.
- `status = Open` is set when the WO is confirmed via the Batching Lens. The
  transition is one-way; an Open WO cannot return to Unreleased.
- `status = Complete` is set transactionally when the final WorkOrderStep completes,
  OR via Fulfill from Stock (which transitions Unreleased → Complete with all steps
  Skipped, bypassing both Stock Fulfillment Release and Batching Confirm).
- `status = Cancelled` is set via the Cancel primitive (Manager/Admin action). Available
  only on leaf WOs (no non-Cancelled descendants). Cancellation is one-way in Rev 1.
  Cancelled WOs are excluded from operational visibility, readiness math, demand
  calculations, and Project Status auto-transition logic.
- `batchId` is set when the WO is confirmed into a ProductionBatch via the Batching Lens.
- `stockFulfillmentReviewedAt` is stamped when the planner records a decision in
  Stock Fulfillment (Fulfill, explicit Pass Through, auto-Pass-Through, cascade-skip,
  or implicit decision at release time for non-candidates).

---

### WorkOrderStep

One row per routing step per Work Order. Generated from RoutingTemplate at WO creation.

```prisma
model WorkOrderStep {
  workOrderStepId        Int         @id @default(autoincrement())
  workOrderId            Int
  processTypeId          Int
  stepIndex              Int         // matches RoutingTemplateStep.stepIndex
  state                  StepState   @default(Waiting)
  subStatusId            Int?        // FK to ProcessTypeSubStatus
  subStatusNote          String?     // free-text overflow alongside the validated dropdown
  assignedUserId         Int?
  startedAt              DateTime?
  completedAt            DateTime?
  completedQty           Decimal?
  scrapQty               Decimal?
  notes                  String?

  // Relations
  workOrder     WorkOrder             @relation(fields: [workOrderId], references: [workOrderId])
  processType   ProcessType           @relation(fields: [processTypeId], references: [processTypeId])
  subStatus     ProcessTypeSubStatus? @relation(fields: [subStatusId], references: [processTypeSubStatusId])
  assignedUser  User?                 @relation(fields: [assignedUserId], references: [userId])
}

enum StepState {
  Waiting
  Ready
  Started
  Complete
  Blocked
  Skipped
}
```

**Critical rules:**
- `state = Ready` is NEVER set directly. It is computed: all steps with lower `stepIndex`
  on the same WO must be `Complete`. Application logic sets this on every upstream completion.
- `state = Waiting` is restored to all steps with higher `stepIndex` when any step is
  rolled back from Complete (routing rollback rule).
- `state = Skipped` is set when a step is deliberately bypassed. Primary use cases:
  Fulfill from Stock (all steps marked Skipped with note "Fulfilled from stock"),
  Assembly cascade-skip (descendants of a stock-fulfilled Assembly), and Project
  View inferred-skip on out-of-sequence completion. Skipped steps require a note
  (captured in `notes` or via AuditLog), are visible in WO history, and never imply
  work was performed.
- Completion requires `completedQty` and `scrapQty` to be recorded.
- For most processes: `completedQty` must meet or exceed WO `quantity`. Scrap cannot
  satisfy demand. CompletedQty falling below Demand creates a blocker.
- For Purchase and Receive steps: `completedQty` is nullable (raw materials may not
  have a discrete count until cut).
- `subStatusId` is constrained to ProcessTypeSubStatus rows for this step's processType
  (validated at the application layer).
- `subStatusNote` provides free-text overflow for context that doesn't fit the
  dropdown vocabulary.
- All state changes write to AuditLog in the same transaction.

---

### ProductionBatch

Groups identical PartID Work Orders for consolidated execution. Batch is the primary
execution unit in downstream lenses when WOs are batched.

```prisma
model ProductionBatch {
  batchId           Int           @id @default(autoincrement())
  partId            Int
  totalQuantity     Decimal       // sum of member WO quantities
  plannedQuantity   Decimal?      // planner overage target; null = use totalQuantity
  priority          Int?          // inherited: max priority among member WOs
  dueDate           DateTime?     // inherited: earliest due date among member WOs
  currentStepIndex  Int           @default(1)
  status            BatchStatus   @default(Planned)
  createdAt         DateTime      @default(now())

  // Relations
  part      Part        @relation(fields: [partId], references: [partId])
  memberWOs WorkOrder[]
}

enum BatchStatus {
  Planned
  Active
  Complete
  Blocked
}
```

**Rules:**
- All member WOs must share the same `partId` and identical routing.
- WO eligibility for batching: `partId` matches, routing identical, WO not started,
  no purchasing or receiving activity recorded, not already in a batch.
- `priority` and `dueDate` are re-derived whenever member WOs change.
- Batch dissolves if only one member WO remains.
- Member WOs link to batch via `WorkOrder.batchId`.
- `plannedQuantity` is the overage target set during Batching. Must be ≥ totalQuantity.
  Optional — null means the operative quantity is totalQuantity.
- Named `ProductionBatch` deliberately — Process Batching (cross-PartID, single shared
  process step) is a separate future concept (Rev 2).

---

### Blocker

Records a blocker on a Work Order or Production Batch. Polymorphic entity reference.

```prisma
model Blocker {
  blockerId        Int               @id @default(autoincrement())
  entityType       BlockerEntityType // 'WorkOrder' | 'Batch'
  entityId         Int               // ID of the blocked WorkOrder or ProductionBatch
  processTypeId    Int               // which step is blocked
  category         BlockerCategory   @default(Local)
  preBlockerState  StepState         // captured at creation; surfaces as suggested default on Cleared resolution
  createdByUserId  Int
  createdAt        DateTime          @default(now())
  pendingAt        DateTime?         // set when transitioned to Pending Resolution
  pendingByUserId  Int?              // user who marked it Pending Resolution
  resolvedAt       DateTime?
  resolvedByUserId Int?              // user who resolved it
  resolutionType   ResolutionType?
  resolutionNote   String?

  // Relations
  processType ProcessType @relation(fields: [processTypeId], references: [processTypeId])
  createdBy   User        @relation("BlockerCreator", fields: [createdByUserId], references: [userId])
  pendingBy   User?       @relation("BlockerPending", fields: [pendingByUserId], references: [userId])
  resolvedBy  User?       @relation("BlockerResolver", fields: [resolvedByUserId], references: [userId])
}

enum BlockerEntityType {
  WorkOrder
  Batch
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

**Status derivation (not a stored field):**
- Status `Open` when `pendingAt = null` AND `resolvedAt = null`
- Status `Pending Resolution` when `pendingAt IS NOT NULL` AND `resolvedAt = null`
- Status `Resolved` when `resolvedAt IS NOT NULL`

**Rules:**
- `entityType` + `entityId` together identify the blocked entity. The database cannot
  enforce this FK automatically — application logic must validate entityId against the
  correct table based on entityType.
- Blocking a batched WO blocks the Batch (entityType = Batch, entityId = batchId).
- Assembly blockers use entityType = WorkOrder and apply only to the assembly's own
  routing steps, not its children.
- `preBlockerState` is required at creation. It captures the step's state immediately
  before the blocker so the system can surface it as the suggested default outcome on
  Cleared resolution. The user always specifies the actual outcome state — the system
  never auto-determines.
- Pending Resolution is a Manager/Admin-only transition. Requires a note.
- Work does not proceed in Pending Resolution. The blocked entity remains Blocked.
- Resolution requires a `resolutionNote`. No silent resolution.
- `resolutionType = WOSplit` is the Manager/Admin recovery action that splits the
  blocked WO into two records. The split workflow lives in the Batch Editor.
- All blocker creation, state transitions, and resolution events write to AuditLog.

---

### DefinitionChangeFlag

A persistent record per (definition change × affected entity) pair. Surfaces the
impact of definition-layer edits to active Work Orders for human resolution. The
flag system is the mechanism by which Principle 10 (definition changes don't
auto-cascade to WIP) surfaces deferred reconciliation decisions.

```prisma
model DefinitionChangeFlag {
  flagId              Int                @id @default(autoincrement())
  changeType          DefinitionChangeType
  changedEntityType   String             // 'Part' | 'BOM' | 'RoutingTemplate'
  changedEntityId     Int                // ID of changed Part / BOM row / Template
  affectedEntityType  String             // 'WorkOrder' | 'Batch'
  affectedEntityId    Int                // ID of affected WorkOrder or ProductionBatch
  parentFlagId        Int?               // FK to parent flag — set on member flags whose parent is a batch flag
  changeDescription   String             // Human-readable: "Default vendor changed from Acme to Globex"
  changeAuditLogId    Int                // FK to triggering AuditLog entry
  createdAt           DateTime           @default(now())
  createdByUserId     Int                // User who made the definition change
  resolvedAt          DateTime?
  resolvedByUserId    Int?
  resolutionAction    FlagResolution?    // Dismiss | AcceptChange
  resolutionNote      String?            // Required when resolved

  // Relations
  parentFlag          DefinitionChangeFlag? @relation("FlagHierarchy", fields: [parentFlagId], references: [flagId])
  childFlags          DefinitionChangeFlag[] @relation("FlagHierarchy")
  changeAuditLog      AuditLog              @relation(fields: [changeAuditLogId], references: [auditLogId])
  createdBy           User                  @relation("FlagCreator", fields: [createdByUserId], references: [userId])
  resolvedBy          User?                 @relation("FlagResolver", fields: [resolvedByUserId], references: [userId])
}

enum DefinitionChangeType {
  PartFieldChanged       // Vendor, material spec, blankLength, procurementType
  PartRoutingChanged     // routingTemplateDefinitionId on a Part
  RoutingTemplateEdited  // Template definition itself changed
  BOMQuantityChanged     // Quantity on existing parent/child relationship
  BOMComponentAdded      // New child added to a parent
  BOMComponentRemoved    // Child removed from a parent
}

enum FlagResolution {
  Dismiss        // Accept drift; no system action
  AcceptChange   // Apply the change to the affected entity via change-type-specific workflow
}
```

**Status (derived):**
- `Open` when `resolvedAt = null`
- `Resolved` when `resolvedAt IS NOT NULL`

**Rules:**
- `affectedEntityType = 'WorkOrder'`: standard WO flag; may be batch-member or solo
- `affectedEntityType = 'Batch'`: batch-level flag, parent of member flags
- Application layer enforces that `affectedEntityId` references a valid record of
  the type indicated by `affectedEntityType`. Same polymorphic FK pattern as Blocker.
- Solo WO flags have `parentFlagId = null`. Batch flags have `parentFlagId = null`.
  Batch member flags have `parentFlagId` set to the batch flag's `flagId`.
- Resolution at the batch level applies atomically to all member flags in the same
  transaction (member flags inherit `resolutionAction` and `resolutionNote` from parent).
- Per-member resolution while WO is in batch is blocked. Manager must remove WO from
  batch first.
- If a batch is dissolved while flags are open, the batch flag is auto-resolved with
  system note. Member flags' `parentFlagId` is cleared and they become individually
  resolvable.
- If a single member is removed from a batch while flags are open (without dissolving),
  that member's `parentFlagId` is cleared and it becomes individually resolvable.
- If a flagged WO is split via WO Split primitive, both new WOs inherit copies of the
  flag (same `changeType`, `changedEntityId`, `changeAuditLogId`, `changeDescription`,
  `parentFlagId` if applicable). Original flag auto-resolved with system note pointing
  to new flag IDs.
- Cosmetic-only field changes (Part Name, Description, Notes, Inventory Location) do
  not create flags.
- Resolution requires a note. No silent resolution.
- All flag creation, propagation, and resolution events write to AuditLog.

---

## Procurement / Receiving Layer

### SupplyOrder

A procurement document representing intent to purchase from a vendor. Renamed from
`PurchaseOrder` in Stage 6 — "Supply Order" covers all procurement actions equally
(formal POs, Amazon orders, McMaster carts, vendor phone calls) without implying
formal PO paperwork.

```prisma
model SupplyOrder {
  supplyOrderId Int           @id @default(autoincrement())
  vendorId      Int
  status        SupplyOrderStatus @default(Draft)
  orderDate     DateTime?
  expectedEta   DateTime?
  trackingRef   String?       // tracking number, PO number, Amazon order ID, etc.
  notes         String?

  // Relations
  vendor    Vendor              @relation(fields: [vendorId], references: [vendorId])
  lines     SupplyOrderLine[]
  receipts  Receipt[]
}

enum SupplyOrderStatus {
  Draft
  RFQSent
  Ordered
  PartialReceived
  Closed
}
```

---

### SupplyOrderLine

One line per material/part within a Supply Order. The `workOrderId` direct FK has
been removed in Stage 6 — allocations to Work Orders are now tracked via the
`SupplyOrderLineAllocation` junction table to support raw material cases where one
Supply Order Line satisfies multiple WOs (one bar of stock cut into pieces for
multiple WOs).

```prisma
model SupplyOrderLine {
  supplyOrderLineId    Int       @id @default(autoincrement())
  supplyOrderId        Int
  partId               Int?      // for finished components; nullable for raw material lines
  materialSpecId       Int?      // for raw material lines
  orderedQty           Decimal
  receivedQty          Decimal   @default(0)
  unitCost             Decimal?
  notes                String?
  eta                  DateTime? // Supply Order Line ETA — propagates to member WOs on edit

  // Exception fields — populated when receiver flags an issue with this line
  hasException             Boolean   @default(false)
  exceptionNote            String?
  exceptionCreatedByUserId Int?
  exceptionCreatedAt       DateTime?
  exceptionResolvedNote    String?
  exceptionResolvedByUserId Int?
  exceptionResolvedAt      DateTime?

  // Relations
  supplyOrder    SupplyOrder                    @relation(fields: [supplyOrderId], references: [supplyOrderId])
  part           Part?                          @relation(fields: [partId], references: [partId])
  materialSpec   MaterialSpec?                  @relation(fields: [materialSpecId], references: [materialSpecId])
  allocations    SupplyOrderLineAllocation[]
}
```

**Notes:**
- A line references either a Part (finished component) or a MaterialSpec (raw material)
  — at least one must be non-null. Application layer validates this.
- `receivedQty` accumulates across all receiving actions against this line.
- The work-order-to-line relationship lives in `SupplyOrderLineAllocation`.
- `eta` is the Supply Order Line ETA. When updated, the change propagates to all
  member WO `eta` fields (per receiving spec rule). Per-WO `eta` edits do NOT propagate
  back up to this field.
- Exception fields support the receiving-time exception flagging mechanism. When
  `hasException = true`, the line is flagged for Purchasing follow-up. When
  resolved, the original exception fields are preserved alongside the resolution
  fields for audit trail.

---

### SupplyOrderLineAllocation

Junction table linking Supply Order Lines to Work Orders. One row per (line, WO)
allocation pair, with the per-WO allocated quantity.

```prisma
model SupplyOrderLineAllocation {
  supplyOrderLineAllocationId Int       @id @default(autoincrement())
  supplyOrderLineId           Int
  workOrderId                 Int
  allocatedQty                Decimal
  notes                       String?

  // Relations
  supplyOrderLine SupplyOrderLine @relation(fields: [supplyOrderLineId], references: [supplyOrderLineId])
  workOrder       WorkOrder       @relation(fields: [workOrderId], references: [workOrderId])
}
```

**Rules:**
- The sum of `allocatedQty` across allocations for a given line should not exceed
  the line's `orderedQty`. Validated at the application layer.
- One Supply Order Line can have multiple allocations (e.g., one bar of stock cut for
  three WOs). One Work Order can have multiple allocations (parts coming from multiple
  lines).

---

### Receipt and ReceiptLine — REMOVED in Rev 1

The Receipt and ReceiptLine entities have been removed from the Rev 1 schema
per the focused Receiving design session. Rev 1 does not track structured
receipt events as separate entities; receiving operations directly modify
SupplyOrderLine state, and the AuditLog provides the historical record of
those modifications.

If future revisions need shipment-level grouping (e.g., for vendor performance
analytics), a Receipt entity can be added then. Rev 1 prioritizes simplicity.

The slip/invoice reference field is also dropped from Rev 1 (it lived on
the Receipt entity). Receivers do not capture slip references as structured
data in Rev 1.

The refusal mechanism is also removed (it lived on ReceiptLine). Quality
problems are handled via the new Supply Order Line Exception mechanism +
Blockers on affected WOs. See `receiving_lens_spec.md`.

---

## Supporting Tables

### User

System users. Basic identity for action attribution and audit logging.
No authentication enforcement in Rev 1 — user selection is manual.

```prisma
model User {
  userId    Int       @id @default(autoincrement())
  userName  String    @unique
  role      UserRole  @default(Operator)
  isActive  Boolean   @default(true)

  // Relations
  assignedSteps    WorkOrderStep[]
  blockersCreated  Blocker[]       @relation("BlockerCreator")
  blockersPending  Blocker[]       @relation("BlockerPending")
  blockersResolved Blocker[]       @relation("BlockerResolver")
  projectsCreated  Project[]       @relation("ProjectCreator")
  projectsEdited   Project[]       @relation("ProjectLastEditor")
  flagsCreated     DefinitionChangeFlag[] @relation("FlagCreator")
  flagsResolved    DefinitionChangeFlag[] @relation("FlagResolver")
  auditLogs        AuditLog[]
}

enum UserRole {
  Operator
  Lead
  Manager
  Admin
}
```

---

### AuditAction

Lookup table defining all valid AuditLog action types. Adding a new action type is
a row insert, not a schema migration.

```prisma
model AuditAction {
  auditActionId   Int     @id @default(autoincrement())
  actionName      String  @unique  // e.g. 'StepStateChanged', 'StockFulfilled'
  category        String  // 'WO' | 'Step' | 'Batch' | 'Blocker' | 'Project' | 'Stock' | 'Receipt' | 'Definition'
  description     String?
  isActive        Boolean @default(true)

  // Relations
  auditLogs AuditLog[]
}
```

**Seed data (initial action types — refine during build):**

| actionName | category | description |
|------------|----------|-------------|
| StepStateChanged | Step | Generic step state transition (with before/after in payload) |
| StepSkipped | Step | Step transitioned to Skipped |
| InferredStepSkip | Step | Step marked Skipped by inference (out-of-sequence completion) |
| WOStateChanged | WO | WOStatus transition (Unreleased → Open, Open → Complete, etc.) |
| WOCompleted | WO | WO status transition to Complete via standard execution |
| WOStockFulfillmentReleased | WO | Stock Fulfillment Release event — sets `stockFulfillmentReviewedAt`. WOStatus unchanged for Pass-Through WOs |
| WOBatchingConfirmed | WO | Batching Confirm event — transitions WOStatus from Unreleased to Open |
| ManagerSkipAndFulfill | WO | Project View recovery action — skip remaining steps and complete from stock |
| ReturnToStock | WO | Primitive 3 — Complete WO returned to start with stock increment |
| AssemblyCascadeSkip | WO | Descendant WO Skip-Completed via Assembly stock fulfillment cascade |
| AssemblyCascadeReverse | WO | Descendants un-Skip when Primitive 3 fires on a Stock-Fulfilled Assembly |
| BatchCreated | Batch | Production Batch created via Batching Lens |
| BatchDissolved | Batch | Batch dissolved (only one member remained) |
| BatchAdjustment | Batch | WO membership reshaped via Batch Adjustment Workspace |
| WOSplit | WO | WO Split primitive applied — original adjusted, new WO created |
| WOCreatedViaSplit | WO | New WO created as a result of WO Split (distinguishes from compile-generated WOs) |
| WOQuantityAdjusted | WO | WO quantity field updated (used for split commits and other quantity edits) |
| BlockerCreated | Blocker | Blocker created on a WO or Batch |
| BlockerPending | Blocker | Blocker transitioned to Pending Resolution |
| BlockerResolved | Blocker | Blocker resolved with type (Cleared, BatchAdjustment, RoutingRollback, WOSplit) |
| ProjectCreated | Project | Draft Project created |
| ProjectCompiled | Project | Draft → Active via successful compilation |
| ProjectMetadataEdit | Project | Project Name, Customer Name, or Notes edited on Active Project |
| ProjectDueDateChanged | Project | Project Due Date edited (with cascade summary to N WOs) |
| ProjectTopLevelAdded | Project | New Top-Level Item added to Active Project |
| ProjectArchived | Project | Project transitioned to Archived (Active or Complete origin) |
| ProjectDraftDeleted | Project | Draft Project hard-deleted |
| StockFulfilled | Stock | WO completed via Fulfill from Stock |
| StockPassThrough | Stock | WO explicitly passed through in Stock Fulfillment |
| StockAutoPassThrough | Stock | WO auto-passed-through (lost candidacy or implicit at release) |
| StockReconciliation | Stock | Stock count adjusted via Reconcile Stock modal |
| StockFulfillmentReleased | Stock | Aggregate Release event (count of WOs released, scope) |
| StockAllocation | Stock | From-stock attribution on a Project View edit (combined WO state + stock decrement) |
| SupplyOrderLineFulfilled | SupplyOrder | Supply Order Line marked Fulfilled — satisfies all unsatisfied WOs allocated to it |
| SupplyOrderLinePartialReceipt | SupplyOrder | Partial qty received recorded on a Supply Order Line (does not satisfy WOs) |
| SupplyOrderLineExceptionSet | SupplyOrder | Exception flagged on a Supply Order Line by receiver |
| SupplyOrderLineExceptionCleared | SupplyOrder | Exception cleared on a Supply Order Line (typically by Purchasing after vendor resolution) |
| SupplyOrderLineETAUpdated | SupplyOrder | Supply Order Line ETA edited — propagates to all member WO ETAs in same transaction |
| WOReceiptSatisfied | WO | WO's Supply Order allocation marked satisfied via Receiving Lens grid (manual allocation during partial receipt) |
| WOEtaUpdated | WO | Per-WO ETA edited (independent of Supply Order Line ETA propagation) |
| InventoryAdjusted | Stock | Direct inventory adjustment (Distribution Lens, Parts Master) |
| PartCreated | Definition | New Part record created |
| PartUpdated | Definition | Part definition field edited |
| PartDeactivated | Definition | Part isActive set to false |
| BOMRowAdded | Definition | Component added to an assembly's BOM |
| BOMRowRemoved | Definition | Component removed from an assembly's BOM |
| BOMRowEdited | Definition | BOM quantity or displayOrder edited |
| RoutingTemplateCreated | Definition | New Routing Template Definition created |
| RoutingTemplateEdited | Definition | Existing template edited (steps added/removed/reordered) |
| RoutingTemplateRetired | Definition | Template isActive set to false |
| WOCancelled | WO | Cancel primitive applied to leaf WO |
| BatchMemberRemovedForFlagResolution | Batch | WO removed from batch to enable per-member flag resolution |
| DefinitionChangeFlagCreated | Flag | New definition change flag created (one entry per affected entity) |
| DefinitionChangeFlagResolved | Flag | Flag resolved (Dismiss or AcceptChange) |
| DefinitionChangeFlagInheritedViaWOSplit | Flag | Original flag auto-resolved when flagged WO was split; new flags created on resulting WOs |
| DefinitionChangeFlagAutoResolvedViaBatchDissolution | Flag | Batch flag auto-resolved when batch was dissolved while flag was open |
| RoutingResetByFlagResolution | WO | All WO steps regenerated from current routing template via Accept Change resolution |
| WOAttributeUpdatedByFlagResolution | WO | WO field updated to current Library value via Accept Change resolution |
| BOMComponentAddedViaFlagResolution | WO | New child WO subtree generated under parent Assembly via Component Added Accept Change resolution |

---

### AuditLog

Immutable record of all state-changing actions. Written in the same transaction
as the action it records.

```prisma
model AuditLog {
  auditLogId      Int       @id @default(autoincrement())
  entityType      String    // 'WorkOrder' | 'WorkOrderStep' | 'Batch' | 'Blocker' | etc.
  entityId        Int
  auditActionId   Int       // FK to AuditAction lookup
  changedByUserId Int
  timestamp       DateTime  @default(now())
  previousValue   Json?     // state before the action
  newValue        Json?     // state after the action
  note            String?   // optional user-supplied note (drift correction, blocker resolution, etc.)

  // Relations
  action    AuditAction @relation(fields: [auditActionId], references: [auditActionId])
  changedBy User        @relation(fields: [changedByUserId], references: [userId])
}
```

**Rules:**
- AuditLog is append-only. No updates or deletes.
- Every state change on WorkOrderStep, WorkOrder, ProductionBatch, Blocker,
  Project, Part, BOM, RoutingTemplate, Stock, and Receipt must produce an AuditLog
  entry.
- `previousValue` and `newValue` store JSON snapshots of the changed fields.
- `auditActionId` references AuditAction lookup — adding a new action type is a row
  insert in AuditAction, not a schema migration.
- `note` captures user-supplied context. Required for blocker resolutions and
  state-affecting Project View edits; optional elsewhere.

---

## Table Creation Order

Prisma manages migrations, but the dependency order is:

1. User
2. ProcessType
3. ProcessTypeSubStatus
4. AuditAction
5. Vendor
6. MaterialSpec
7. Part
8. BOM
9. RoutingTemplateDefinition
10. RoutingTemplateStep
11. Project
12. ProductionBatch
13. WorkOrder
14. WorkOrderStep
15. Blocker
16. SupplyOrder
17. SupplyOrderLine
18. SupplyOrderLineAllocation
19. Receipt
20. ReceiptLine
21. AuditLog
22. DefinitionChangeFlag

(AuditLog and DefinitionChangeFlag have a circular dependency — flags reference an
auditLogId, but DefinitionChangeFlagCreated audit entries reference the flag. Migration
must create both tables before either can be populated. Application logic writes flag
+ AuditLog entry in the same transaction.)

---

## Key Derived Values (Not Stored — Computed)

These values are computed by application logic, not stored as fields:

| Value | Computation |
|-------|------------|
| WorkOrderStep Ready state | All steps with lower stepIndex on same WO are Complete or Skipped |
| Assembly WO readiness fraction | COUNT of child WOs where status IN (Complete) / COUNT of child WOs where status != Cancelled. Cancelled descendants are excluded from both numerator and denominator |
| ProductionBatch.priority | MAX(priority) across non-Cancelled member WorkOrders |
| ProductionBatch.dueDate | MIN(dueDate) across non-Cancelled member WorkOrders |
| Blocker status (Open / Pending / Resolved) | Derived from `pendingAt` and `resolvedAt` timestamps |
| DefinitionChangeFlag status (Open / Resolved) | Derived from `resolvedAt` timestamp |
| Top-Level Reference display | `Project.projectNumber + "." + zero-padded WorkOrder.topLevelIndex` |
| Cumulative Demand for a PartID | SUM(quantity) across visible Open WOs for this Part. Excludes Cancelled WOs |
| Project Status auto-transition | Active → Complete when all non-Cancelled member WOs are Complete |
| Stock Fulfillment per-WO model | Per-WO release via Stock Fulfillment Release button; no Project-level gate (Model 1). Sets `stockFulfillmentReviewedAt` |
| Batching Confirm transition | Sets WOStatus from Unreleased to Open. Second gate; WOs cannot reach Open without passing through Batching Lens (or via Fulfill from Stock direct to Complete) |
| WO appears in Stock Fulfillment | WOStatus = Unreleased AND stockFulfillmentReviewedAt = null AND Stock ≥ Demand AND Project not Archived |
| WO appears in Batching Lens (visible) | WOStatus = Unreleased AND stockFulfillmentReviewedAt IS NOT NULL AND has batch candidacy (multiple WOs for same Part exist in queue) |
| WO appears in Batching Lens (hidden queue) | WOStatus = Unreleased AND stockFulfillmentReviewedAt IS NOT NULL AND no batch candidacy |
| WO appears in execution lenses (Purchasing, Receiving, Machining, etc.) | WOStatus = Open AND step prerequisite gating satisfied |
| WO appears in Operations Lens | WOStatus = Open OR Complete (excludes Unreleased and Cancelled) |
| WO appears in Project View | WOStatus IN (Unreleased, Open, Complete) — Cancelled excluded by default; toggle reveals |

---

## Rev 2 Schema Extensions (Do Not Build — Reference Only)

These fields and tables are intentionally omitted from Rev 1. Noted here so the
Rev 1 schema is built with awareness of what comes next.

- **Material Handling:** `onHandQty`, `allocatedQty` on MaterialSpec or a new
  MaterialInventory table. Allocation records linking WOs to material reservations.
  Receipt OnHand updates and per-WO material allocations.
- **Process Batching:** A separate `ProcessBatch` table for cross-PartID groupings
  around a single shared process step (blackening runs, raw material purchases).
  Reserved `Receipt.sourceType = ProcessBatch` value already added.
- **Revision Management:** `PartRevision` table, revision tracking on BOM rows,
  revision reference on WorkOrders.
- **Per-lens priority:** Additional priority fields or a priority override table
  allowing process-specific priority separate from global WO priority.
- **Top-Level Item modification on Active Projects:** Removing existing Top-Level
  Items and editing quantities on existing Top-Level Items.
- **Un-archive workflow:** Reverting an Archived Project to Active.
- **Un-Cancel workflow:** Reverting a Cancelled WO to a previous state.
- **Reversal of fulfillment:** Workflow for un-doing a Fulfill from Stock action.
- **Server-side persistence of user UI preferences:** Column visibility, sort
  defaults, filter presets per user.
- **Stock Items Pending Review:** Extension of the Definition Change Flag mechanism
  to stock items affected by Part definition changes. Per-stock-batch decisions
  about conformity (use as-is, segregate for legacy orders, scrap).
- **Reissue primitive:** Generate a replacement WO at the same BOM position with
  current Library definitions. Cleaner alternative to manual Cancel + manual
  reissue for routing template changes.
- **Permission granularity:** A permissions system distinguishing actions within
  a role (e.g., "Lead can view but not edit Project metadata").

---

## Stage 6 Change Summary

This section documents what changed in Stage 6 relative to the prior schema.
Useful for review and for confirming all queued changes were applied.

| # | Change | Source |
|---|--------|--------|
| 1 | `WOStatus` enum: removed `Cancelled`, added `Unreleased` | state_model |
| 2 | `WorkOrder.status` default changed from `Open` to `Unreleased` | Project Creation spec |
| 3 | `Blocker.preBlockerState` field added (StepState, required) | state_model |
| 4 | Renamed `PurchaseOrder` → `SupplyOrder` (table + all references) | OQ-012 |
| 5 | Renamed `POStatus` → `SupplyOrderStatus` enum | OQ-012 |
| 6 | Removed `PurchaseOrderLine.workOrderId` FK | OQ-012 |
| 7 | Added `SupplyOrderLineAllocation` junction table | OQ-012 |
| 8 | Renamed `PurchaseOrderLine` → `SupplyOrderLine` and added nullable `partId`/`materialSpecId` | OQ-012 |
| 9 | `ProcessTypeSubStatus` table added | state_model |
| 10 | `WorkOrderStep.subStatus` (free text String) replaced with `subStatusId` FK to ProcessTypeSubStatus | state_model |
| 11 | `WorkOrderStep.subStatusNote` String? added (free-text overflow) | state_model |
| 12 | `Blocker.pendingAt` DateTime? added | state_model |
| 13 | `Blocker.pendingByUserId` Int? FK to User added | Stage 6 decision |
| 14 | `Blocker.resolvedByUserId` Int? FK to User added | Stage 6 decision |
| 15 | `ResolutionType` enum: added `WOSplit` value | terminology lock |
| 16 | `StepState` enum: added `Skipped` value | OQ-013 |
| 17 | `WorkOrder.routingTemplateDefinitionId` snapshot field added (required) | OQ-001 |
| 18 | `Receipt.sourceType` ReceiptSourceType field added (default `SupplyOrder`) | OQ-005 |
| 19 | `ReceiptSourceType` enum added (`SupplyOrder \| ProcessBatch`) | OQ-005 |
| 20 | `ProjectStatus` enum: added `Draft` value | Project Creation spec |
| 21 | `Project.status` default changed from `Active` to `Draft` | Project Creation spec |
| 22 | `Project.creatorUserId` Int FK to User added (required) | Project Creation spec |
| 23 | `Project.lastEditedUserId` Int FK to User added (required) | Project Creation spec |
| 24 | `Project.lastEditedAt` DateTime added (default now) | Project Creation spec |
| 25 | `WorkOrder.priority` changed from required Int to nullable Int? | Project Creation spec |
| 26 | `WorkOrder.topLevelIndex` Int? added | Project Creation spec |
| 27 | `WorkOrder.dueDate` clarified as denormalized from Project (cascade-on-edit) | Project Creation spec |
| 28 | `WorkOrder.stockFulfillmentReviewedAt` DateTime? added | Stock Fulfillment spec |
| 29 | `BOM.stepIndex` renamed to `BOM.displayOrder` | BOM Editor spec |
| 30 | `ProductionBatch.plannedQuantity` Decimal? added | Batching Lens spec |
| 31 | `AuditAction` lookup table added | Stage 6 decision |
| 32 | `AuditLog.action` String replaced with `auditActionId` FK to AuditAction | Stage 6 decision |
| 33 | `AuditLog.note` String? added (user-supplied context) | Stage 6 decision |

Total: 33 changes applied during Stage 6.

---

## Reconciliation Pass Change Summary

Additional changes applied during the post-Stage-7 reconciliation pass, primarily
to support the Definition Change Flag system and the Cancel primitive.

| # | Change | Source |
|---|--------|--------|
| R1 | `WOStatus` enum: `Cancelled` value added back | Definition Change Flag spec |
| R2 | `DefinitionChangeFlag` table added | Definition Change Flag spec |
| R3 | `DefinitionChangeType` enum added (6 values) | Definition Change Flag spec |
| R4 | `FlagResolution` enum added (Dismiss, AcceptChange) | Definition Change Flag spec |
| R5 | `User` model: added `flagsCreated` and `flagsResolved` relations | Definition Change Flag spec |
| R6 | AuditAction seed: 10 new action types added for flag and Cancel events | Definition Change Flag spec + Cancel primitive |
| R7 | Core Concepts: WO Status documentation expanded for Cancelled and second-gate model | Definition Change Flag spec + Batching second-gate clarification |
| R8 | Core Concepts: new section on definition changes not auto-cascading to WIP | Definition Change Flag spec |
| R9 | WorkOrder rules: `parentWoId` documented as mutable post-compilation | Definition Change Flag spec |
| R10 | WorkOrder rules: Open transition documented as occurring at Batching Confirm (not Stock Fulfillment Release) | Batching second-gate clarification |
| R11 | WorkOrder rules: `Cancelled` state documented with eligibility, exclusions, one-way constraint | Cancel primitive |
| R12 | Key Derived Values: visibility rules for all lenses updated for Cancelled and Batching gate | Reconciliation |
| R13 | Key Derived Values: Assembly readiness math excludes Cancelled descendants | Cancel primitive |
| R14 | Key Derived Values: ProductionBatch derived fields exclude Cancelled members | Cancel primitive |
| R15 | Key Derived Values: Cumulative Demand excludes Cancelled WOs | Cancel primitive |
| R16 | Key Derived Values: Project Status auto-transition counts only non-Cancelled WOs | Cancel primitive |
| R17 | Table creation order updated to include DefinitionChangeFlag (with note on circular AuditLog dependency) | Reconciliation |
| R18 | WorkOrderStep Ready state: includes Skipped as upstream completion | State Model + reconciliation |

Total Reconciliation Pass: 18 changes applied.

---

## Receiving Design Session Change Summary

Additional changes applied during the focused Receiving design session,
simplifying the schema by removing structured receipt event tracking and
adding the Supply Order Line Exception mechanism plus per-WO/per-Line ETA
fields.

| # | Change | Source |
|---|--------|--------|
| RD1 | `Receipt` entity REMOVED | Receiving design session |
| RD2 | `ReceiptLine` entity REMOVED | Receiving design session |
| RD3 | `ReceiptSourceType` enum REMOVED (no longer needed) | Receiving design session |
| RD4 | `SupplyOrderLine.eta` DateTime? added | Receiving spec — Line-level ETA with propagation to member WOs |
| RD5 | `SupplyOrderLine.hasException` Boolean default false added | Receiving spec — Line Exception mechanism |
| RD6 | `SupplyOrderLine.exceptionNote` String? added | Receiving spec |
| RD7 | `SupplyOrderLine.exceptionCreatedByUserId` Int? added | Receiving spec |
| RD8 | `SupplyOrderLine.exceptionCreatedAt` DateTime? added | Receiving spec |
| RD9 | `SupplyOrderLine.exceptionResolvedNote` String? added | Receiving spec |
| RD10 | `SupplyOrderLine.exceptionResolvedByUserId` Int? added | Receiving spec |
| RD11 | `SupplyOrderLine.exceptionResolvedAt` DateTime? added | Receiving spec |
| RD12 | `SupplyOrderLine.receiptLines` relation removed (Receipt entity gone) | Receiving design session |
| RD13 | `WorkOrder.eta` DateTime? added | Receiving spec — per-WO ETA, independently editable |
| RD14 | AuditAction seed: `ReceiptCreated` and `ReceiptLineRecorded` REMOVED | Receiving design session |
| RD15 | AuditAction seed: 7 new action types added for receiving operations (`SupplyOrderLineFulfilled`, `SupplyOrderLinePartialReceipt`, `SupplyOrderLineExceptionSet`, `SupplyOrderLineExceptionCleared`, `SupplyOrderLineETAUpdated`, `WOReceiptSatisfied`, `WOEtaUpdated`) | Receiving spec |

Total Receiving Design Session: 15 changes applied. Schema now reflects all
locked decisions through Stage 5, Stage 6, Stage 7, the post-Stage-7
reconciliation, and the Receiving design session.

The schema is build-ready.
