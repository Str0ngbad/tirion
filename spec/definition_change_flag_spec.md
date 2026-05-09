# Tirion — Definition Change Flag Spec

## Purpose

The Definition Change Flag system surfaces the impact of definition-layer
edits to active Work Orders, persistently, so decisions about how to handle
the impact can be made by the people closest to the affected work — at the
time and place they have the context to decide.

The system addresses a fundamental tension in the tool's design philosophy
(captured in Principle 10): **definition changes do not automatically cascade
into work in progress.** This is the right default — auto-cascading would
introduce data integrity issues, mid-flight surprises, and lost context.

But "no automatic cascade" does not mean "no decision to make." When an
engineer edits a Part, BOM, or Routing Template, downstream impact may be
real and may need to be reconciled. The Definition Change Flag system makes
this reconciliation visible, persistent, and accountable.

The design is deliberately conservative about automation. The engineer who
makes a definition change is not the right person to decide what should
happen to active WIP — they lack the operational context (current step state,
material status, customer commitments, downstream dependencies) that lives
with the people executing the work. The system's job is to surface the
question; humans answer it.

---

## Operational Position

This system does not have a dedicated view. It operates as a cross-cutting
mechanism that surfaces in many places:

- **Edit-time dialogs** in Parts Master, BOM Editor, and Routing Template
  Editor — appearing whenever a definition change has downstream impact
- **Flag indicators** on Work Order rows in Project View, Operations Lens,
  and process lenses
- **Side panel section** for Pending Definition Changes on each affected
  Work Order
- **Resolution actions** initiated from the side panel, executed via
  workflows specific to each change type

---

## Hard Rules — Foundational

| # | Rule |
|---|------|
| DCF-1 | Definition changes do not automatically cascade to Work Orders. The flag system surfaces the impact for human resolution |
| DCF-2 | Every definition change with downstream impact requires acknowledgment via the edit-time dialog before it can save |
| DCF-3 | Cosmetic-only field changes (Part Name, Description, Notes, Inventory Location) do not trigger flags or dialogs. They save like any other edit |
| DCF-4 | Each affected entity receives its own flag. Flags are per-entity, per-change. One BOM edit affecting 12 WOs produces 12 flags. If those WOs include batched members, the batch entity is also flagged (see Batch Propagation below) |
| DCF-5 | Each flag is resolved independently (subject to batch propagation rules). Resolution of one flag does not affect resolution of others, except via the explicit batch parent-child relationship |
| DCF-6 | Resolution requires a note. No silent resolution |
| DCF-7 | Resolution permissions: Manager and Admin can resolve flags. Lead can view. Operator can see flag indicators but cannot resolve |
| DCF-8 | Flag-triggering changes affecting a batched WO flag both the batch entity and all batch member WOs. Resolution at the batch level applies atomically to all members. Per-member resolution requires removing the WO from the batch first |

---

## What Triggers a Flag

### Part Field Changes

When a Part record is edited via Parts Master, the following fields trigger
flags on affected open Work Orders if changed:

| Field | Flag Triggered | Notes |
|-------|---------------|-------|
| `defaultVendorId` | Yes | Affects Purchase step on WOs |
| `materialSpecId` | Yes | Affects material identity throughout WO history |
| `routingTemplateDefinitionId` | Yes | Treated as a Routing Template Change flag (separate type) |
| `blankLength` | Yes | Affects material consumption math |
| `procurementType` | Yes | Behavioral — affects which process types apply |
| `partName` | No | Cosmetic — display only |
| `description` | No | Cosmetic |
| `inventoryLocation` | No | Display only |
| `notes` | No | Cosmetic |

**Note on `stockCount`:** Stock count is not a Part field subject to Principle 10
or the flag system. It is a real-time operational value managed via the
Reconcile Stock modal (Stock Fulfillment, Distribution, Parts Master) and
behaves like Project Due Date — informational reflection, not a definition.
Edits to stock count never trigger flags.

**Note on `isActive`:** Part deactivation is a separate workflow. A Part
cannot be deactivated while it has open Work Orders (per Parts Master spec).
This means deactivation cannot trigger the flag system — by the time a Part
is deactivatable, no open WOs reference it.

**Note on inactive vendors:** If a Part's `defaultVendorId` references a
vendor that has been deactivated, the system errors at the time the Part
edit is attempted. The user must address the underlying issue (reactivate
the vendor or pick a different active one) before the Part edit can save.
Therefore, Accept Change resolutions cannot result in setting an inactive
vendor on a WO.

### BOM Changes

When a BOM relationship is edited via BOM Editor, the following changes
trigger flags:

| Change Type | Flagged Entities |
|-------------|-----------------|
| **Quantity Changed** | Each affected child WO under each affected parent WO |
| **Component Added** | Each affected parent Assembly WO |
| **Component Removed** | Each affected parent Assembly WO AND each affected child WO of the removed component |
| **Component Replaced** | Treated as Removal + Addition. Two flags created per affected parent Assembly WO (one for the removal of the old child, one for the addition of the new) |
| **Display Order Changed** | No flag — display order is cosmetic |

### Routing Template Changes

When a Routing Template is edited via Routing Template Editor, or when a
Part's `routingTemplateDefinitionId` is changed, flags are created on every
open WO that uses the affected template (or, in the case of Part field
change, on every open WO for that Part).

| Change Type | Flagged Entities |
|-------------|-----------------|
| Template steps added, removed, or reordered | Every open WO whose `routingTemplateDefinitionId` matches the edited template |
| Part's routing template assignment changed | Every open WO for that Part |

---

## Flag Eligibility — Which WOs Get Flagged

A Work Order is "affected" and receives a flag when ALL of the following
are true:

1. The WO references the changed entity (Part, BOM relationship, or
   Routing Template)
2. The WO is in a non-terminal state — `WOStatus = Unreleased`, `Open`, or
   `Complete`
3. The WO is not Archived (its parent Project is Active or Complete, not
   Archived)
4. The WO is not Cancelled

**WOs in Cancelled state do not receive flags.** They are not active and
their definition references are historical.

**Complete WOs DO receive flags.** A change might prompt the manager to
revisit a completed Assembly's status (e.g., Component Added to a Complete
Assembly is a real BOM mismatch that should be surfaced for review).

**Unreleased WOs DO receive flags.** A change to a definition before the
WO has been released to execution still creates a question — the manager
may want to apply the change before release rather than after.

---

## Batch Propagation

Production Batches group WOs that share identical Part identity and
routing. By definition, batch members share all definition-derived
attributes — Part fields, BOM relationships, routing template. Therefore
any flag-triggering change affecting a batched WO affects every member
of the batch identically.

The system models this by creating flags at both levels:
- **Batch flag** — a flag on the Batch entity, representing the change's
  impact on the batch as a unit
- **Member flags** — a flag on each batch member WO, with `parentFlagId`
  referencing the batch flag

### Why both levels

Resolution typically happens at the batch level. The manager makes one
decision (e.g., "Accept Change for routing template") and it applies to
every member atomically. The batch flag is the natural surface for this
decision because the change affects all members uniformly.

But member-level flags exist so that:
- The audit trail per WO is complete (each WO's history shows the flag)
- Visibility per WO works (each member's row shows the flag indicator)
- If the batch is dissolved or members are split out, member flags
  persist and can be resolved individually

### Resolution Behavior

**Resolving the batch flag** atomically resolves all member flags in the
same transaction:
- Batch flag's `resolvedAt`, `resolvedByUserId`, `resolutionAction`,
  `resolutionNote` set
- Each member flag's resolution fields populated from the batch flag's
  values
- The resolution action (Dismiss or AcceptChange) executes once at the
  batch level, with effects propagating to all members
- All AuditLog entries written in the same transaction

**Resolving a member flag individually is blocked** while the WO is in
the batch. The system surfaces: "This WO is in Batch [ID]. Resolve at
the batch level, or remove from batch first to handle independently."

**To resolve members differently**, the manager must:
1. Open the Batch Editor
2. Remove the relevant WO(s) from the batch (or split the batch entirely)
3. Once removed, the member flag is resolvable independently
4. The remaining batch members continue to share the batch flag

### Visibility

A batched WO with an open flag shows the yellow flag indicator on its
row in all the same surfaces as solo WOs. The hover/click behavior
includes context that the flag is batch-shared:
- Hover tooltip: "Batched flag — N members affected. Resolve at batch
  level via Batch Editor"
- Side panel section identifies the batch context and offers a "Open
  Batch in Batch Editor" link

The Batch entity itself shows the flag indicator wherever batches are
displayed (Batch Editor, batched-row presentations in execution lenses,
etc.). Click navigates to the batch flag resolution surface.

### Hard Rules — Batch Propagation

| # | Rule |
|---|------|
| BATCH-1 | Flag-triggering changes affecting a batched WO flag the batch entity AND all member WOs |
| BATCH-2 | Resolution at the batch level applies atomically to all members in one transaction |
| BATCH-3 | Per-member resolution is blocked while the WO is in a batch. Manager must remove WO from batch first via Batch Editor |
| BATCH-4 | Member flags carry `parentFlagId` referencing the batch flag. Resolution propagates from parent to children atomically |
| BATCH-5 | If a batch is dissolved while flags are open, the batch flag is auto-resolved with note "Batch dissolved before resolution; member flags continue independently." Member flags' `parentFlagId` is cleared, and they become individually resolvable |
| BATCH-6 | If a single member is removed from a batch while flags are open (without dissolving the batch), that member's flag has its `parentFlagId` cleared and becomes individually resolvable. The batch flag and remaining member flags are unaffected |
| BATCH-7 | If a flagged WO is split via the WO Split primitive, both new WOs inherit a copy of the flag (same changeType, changedEntityId, changeAuditLogId, changeDescription, parentFlagId if applicable). The original flag is auto-resolved with note "Resolved via WO Split — see flags on resulting WOs [WO IDs]." |

---

## Edit-Time Dialog

When an engineer edits a definition that has downstream impact, an
acknowledgment dialog appears before the change can save.

### When the Dialog Appears

The dialog appears when EITHER:
1. The changed definition is referenced by other definition records
   (e.g., a Part used in BOMs of N assemblies, an Assembly used as a
   child in N other assemblies, a Template used by N Parts), OR
2. The changed definition has open Work Orders that would be affected

If the change has neither downstream definition references nor open WO
impact, the change saves silently like any other definition edit.

### Dialog Layout

A modal overlay on the editor, blocking save until acknowledged.

**Header:** "This change has downstream impact"

**Section 1 — Definition References** (always shown when the change has
references):

For Part edits:
- "[Part Name] is used in:"
- N assemblies (expandable list, virtualized if long)
- M Routing Templates (if applicable — i.e., a Material change might affect
  Parts using it via materialSpecId)

For BOM edits:
- "[Assembly Y] is used as a component in [N] other assemblies"
- Expandable list of parent assemblies

For Routing Template edits:
- "[Template Name] is assigned to [N] Parts"
- Expandable list of Parts

**Section 2 — WIP Impact** (shown only when open WOs are affected):

- "[N] open Work Orders will be flagged for review"
- Expandable list, virtualized if long, with columns:
  - WO ID
  - Project + Top-Level Reference (e.g., "20137.02")
  - Part Number
  - Current step (or "Unreleased" / "Complete")
  - WO Status
- For batched WOs: indicator that the WO is part of Batch [ID], with all
  members in the batch counted

**Section 3 — Stock Impact** (shown when relevant — Part edits where
stock may exist):

- "[N] units of [Part Name] are currently in stock"
- Reminder text: "Existing stock may need review for conformity to the
  new definition. Manually review and reconcile via Parts Master if needed."
- This section is informational only — there is no flag system for stock
  items. The dialog raises awareness; the manager handles stock conformity
  via the Reconcile Stock workflow

**Buttons:**
- **Cancel** — discards the change entirely
- **Confirm Change** — saves the change, creates flags, displays toast

### What the Dialog Does NOT Offer

The dialog has no "apply to WIP" option. The engineer cannot push changes
into Work Orders from this surface. Their choice is binary: save the
change (with flags created for downstream resolution) or cancel the change
(no save, no flags).

This is the foundational design choice of the flag system. Resolution
happens at the WO level, not at the definition level, by people with
operational context.

### On Confirm

Atomic transaction:
1. Definition change saves to database
2. AuditLog entry written for the definition change
3. One flag created per affected open WO, each referencing the AuditLog
   entry of the underlying change
4. Toast displayed: "Change saved. [N] WOs flagged for review."

If the change has zero open WO impact (only definition references), no
flags are created — the dialog served only an informational purpose.

---

## The DefinitionChangeFlag Record

A persistent record per (definition change × affected Work Order) pair.

### Schema

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
  createdByUserId     Int                // Engineer who made the change
  resolvedAt          DateTime?
  resolvedByUserId    Int?
  resolutionAction    FlagResolution?    // Dismiss | AcceptChange
  resolutionNote      String?            // Required when resolved

  // Relations
  parentFlag          DefinitionChangeFlag? @relation("FlagHierarchy", fields: [parentFlagId], references: [flagId])
  childFlags          DefinitionChangeFlag[] @relation("FlagHierarchy")
  changeAuditLog      AuditLog
  createdBy           User               @relation("FlagCreator")
  resolvedBy          User?              @relation("FlagResolver")
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

**Polymorphic affected entity:**
- `affectedEntityType = 'WorkOrder'`: standard WO flag, may be batch-member or solo
- `affectedEntityType = 'Batch'`: batch-level flag, parent of member flags

**Application layer enforces** that `affectedEntityId` references a valid
record of the type indicated by `affectedEntityType`. The database cannot
enforce this FK automatically (same pattern as `Blocker.entityType` /
`Blocker.entityId`).

**Parent-child relationship:**
- Solo WO flags have `parentFlagId = null`
- Batch flags have `parentFlagId = null`
- Batch member flags have `parentFlagId` set to the batch flag's `flagId`

### Flag Status (Derived)

Like Blocker status, flag status is derived from timestamps:
- **Open** when `resolvedAt = null`
- **Resolved** when `resolvedAt IS NOT NULL`

No separate status field is stored.

### What the Flag Captures

The flag is a record of a question, not a record of an answer. At creation,
it captures:
- What changed (entity type and ID, change type)
- What's affected (the WO)
- When and by whom the change was made
- A reference to the AuditLog entry for the underlying change (so the full
  context is recoverable)

At resolution, it captures:
- When and by whom it was resolved
- Which action was taken (Dismiss or AcceptChange)
- A note explaining the decision

---

## Flag Visibility

### On Work Order Rows

A WO with one or more open flags shows a yellow flag indicator in:
- **Project View** — small icon in the row, distinct from Blocker indicator
  (which is red/orange)
- **Operations Lens** — same indicator
- **Process lenses** (when WO appears in lens via active step) — same
  indicator

**Visual treatment:**
- Yellow flag icon
- Distinct from Blocker indicator (Blockers are red/orange; the system
  has a clear visual hierarchy where Blockers stop work, flags only
  request attention)
- No stacking — the indicator appears once even if a WO has multiple
  open flags. Hover reveals the count

### Hover Behavior

Hovering the flag indicator reveals a tooltip with:
- Count of open flags ("3 pending definition changes")
- Most recent change description ("Default vendor changed: Acme → Globex,
  3 days ago by Sarah")
- For users with permissions: a "View" link to open the side panel
  Pending Definition Changes section

**All users** can see the tooltip and audit log context, including operators.
Visibility is at the heart of this tool.

### Click Behavior

Clicking a flag indicator opens the WO's side panel and scrolls to the
Pending Definition Changes section.

---

## Side Panel — Pending Definition Changes Section

The shared side panel includes a "Pending Definition Changes" section,
visible whenever a WO has at least one open flag.

### Section Layout

For each open flag, an entry shows:
- **Change description** — human-readable summary
- **Change context** — when changed, who changed it, link to AuditLog
  entry for full detail
- **Resolution action(s)** — buttons for resolution paths available for
  this change type (Dismiss is always available; AcceptChange is conditional
  per change type)

For resolved flags (recently resolved, configurable retention period):
- Same display, with resolved indicator and the resolution note visible

### Permissions on Section Display

- **Operator:** can see the section and read all content. Cannot resolve
- **Lead:** same as Operator
- **Manager:** can see and resolve
- **Admin:** can see and resolve

---

## Resolution Workflows

### Dismiss Action (All Change Types)

Available for every flag.

**UI:**
- "Dismiss" button in the flag entry
- Opens a small modal
- Required: note explaining the decision
- Confirm / Cancel

**On Confirm:**
- Atomic transaction:
  - Flag's `resolvedAt`, `resolvedByUserId` set
  - `resolutionAction = Dismiss`
  - `resolutionNote` set
  - AuditLog entry written
- Flag indicator on WO updates (disappears if this was the last open flag)

**Hard rule:** Dismissal accepts drift between the WO's recorded state
and the current Library definition. The note must explain why this is
acceptable. The system does not validate the note's contents.

### Accept Change — Part Field Changes

Available for Part field flags (`PartFieldChanged` change type) and Part
routing template assignment changes (`PartRoutingChanged` change type).

**UI:**
- "Accept Change" button
- Opens a confirmation modal
- Body: "This will update the WO's [field] from [old value] to [new value]."
- For some fields, additional warnings displayed (see below)
- Required: note
- Confirm / Cancel

**On Confirm:**
- Atomic transaction:
  - WO's stored field value updated to current Library value
  - Flag resolved (`resolvedAt`, `resolvedByUserId`, `resolutionAction = AcceptChange`, `resolutionNote`)
  - AuditLog entries written
- Flag indicator on WO updates

**Field-specific behavior:**

For `defaultVendorId`:
- WO's reference updated to current Library value
- If WO has an active SupplyOrder for the old vendor: warning surfaced
  ("WO has [N] active material allocations under previous vendor. Review
  supply orders separately.")
- The system does not modify the supply orders themselves

For `materialSpecId`:
- WO's reference updated
- If material has been ordered or received: warning surfaced
- For mid-flight WOs: the system records the change; the manager handles
  physical reconciliation (likely Return to Stock + reissue, or rollback)

For `blankLength`:
- WO's reference updated
- For mid-flight WOs: warning if material has been ordered ("Updated
  blankLength may affect future material requirements. Review supply
  orders.")

For `procurementType`:
- WO's reference updated
- Warning if change affects routing applicability ("Procurement type change
  may affect process applicability. Review routing template assignment.")

**Inactive Vendor Edge Case:**
If Accept Change would result in setting a now-inactive vendor on the WO,
the action is blocked. Error message: "Cannot Accept Change — vendor
[Name] is inactive. Reactivate the vendor or update the Part to a
different active vendor before resolving this flag."

**Hard rule:** Accept Change updates the WO's stored field value to current
Library state. It does not undo work already done with the old value. The
manager handles physical reconciliation.

### Accept Change — Routing Template Changes

Available for `RoutingTemplateEdited` and `PartRoutingChanged` flags.

**Eligibility:**
- WO must NOT be in a Batch (must be removed from batch first)
- WO must NOT be Complete (must be reverted to Open first)

If either eligibility check fails, the Accept Change button is disabled
with explanatory text:
- "Cannot Accept Change — WO is in Batch [ID]. Remove from batch first
  via Batch Editor."
- "Cannot Accept Change — WO is Complete. Revert to Open first. The path
  depends on whether existing parts remain conforming to the new
  definition: use Return to Stock if parts are still usable, or use
  Rollback combined with adjusting CompletedQty into ScrapQty if parts
  are now obsolete. Once the WO is Open, Accept Change becomes available."

The system does not provide a single "Rollback to Scrap" action — the
manager composes existing primitives (Rollback step state, then adjust
CompletedQty / ScrapQty on the appropriate step) to achieve this. The
choice of path (Return to Stock vs. compose-to-scrap) is the manager's
judgment about whether existing parts are still conforming.

**UI:**
- "Accept Change" button (when eligible)
- Opens a confirmation modal
- Body explains the impact:
  - "This will replace the WO's routing with the current routing template."
  - "All current step progress will be reset. The first step will become
    Ready; all others will be Waiting."
  - "If the WO has progress that should carry over (e.g., a step you'd
    consider completed under the new routing), you must manually update
    step state after Accept Change."
- Warnings for active material allocations:
  - "WO has [N] active material allocations. The new routing may not have
    a Purchase step or may have different material requirements. Review
    supply orders separately."
- Required: note explaining the change rationale
- Confirm / Cancel

**On Confirm:**
- Atomic transaction:
  - Capture current step state in AuditLog (so history isn't lost)
  - Delete existing `WorkOrderStep` records for this WO
  - Generate new `WorkOrderStep` records from the current routing template
  - All new steps start in `Waiting` state
  - First step transitions to `Ready` immediately
  - Update WO's `routingTemplateDefinitionId` snapshot to current template
    version
  - Flag resolved
  - AuditLog entry for routing reset
- Flag indicator updates

**Hard rule:** Accept Change for routing template regenerates the WO's
steps from current template state. Step progress is not preserved
automatically. Manager handles step state reconciliation manually.

### Accept Change — BOM Quantity Changed

Available for `BOMQuantityChanged` flags.

**UI:**
- "Accept Change" button
- Opens a confirmation modal
- Body: "Update WO quantity from [old] to [new]?"
- Side effects displayed:
  - For increase: "Increased demand may trigger Blocker if a cascaded child
    WO ends up with CompletedQty < new Demand (under-production condition)."
  - For decrease: "Decreased demand may result in overage at Distribution
    if CompletedQty exceeds new Demand. Overage handled normally — not a
    Blocker condition."
  - "If this WO is itself an Assembly, demand will cascade to its children."
- Required: note
- Confirm / Cancel

**On Confirm:**
- Atomic transaction:
  - Update WO's `quantity` field to the new BOM-derived value
  - Cascade demand to children if this WO is an Assembly (per existing
    cascade rules in state model)
  - For cascaded WOs where new Demand > CompletedQty: the existing
    under-production Blocker trigger applies automatically — no special
    handling needed at the flag resolution level
  - For cascaded WOs where new Demand < CompletedQty: no Blocker is created.
    Overage is surfaced at Distribution per existing overage handling
  - Flag resolved
  - AuditLog entries written
- Flag indicator updates

### Accept Change — BOM Component Added

Available for `BOMComponentAdded` flags. Resolution generates the new
child WO subtree under the affected parent Assembly.

**UI:**
- "Accept Change" button
- Opens a focused workflow surface (a modal containing a Project-View-style
  preview of the affected parent's BOM tree, with a "+" affordance for
  the new component)
- Body shows:
  - Affected parent Assembly WO context (Project, Top-Level Reference,
    current state)
  - The BOM change context: "Component [Part X] qty [N] added to assembly
    [Part Y]"
  - The new child WO that will be generated (preview)
  - For Assembly children: the entire descendant subtree (preview)
- Validation:
  - New child Part must have an active Routing Template
  - All descendants in the BOM tree must have active Routing Templates
  - All descendants must be active Parts
  - No circular BOM reference (defensive)
- If validation fails: error screen with deep links (same pattern as
  Project Compilation failure)
- Required: note
- Confirm / Cancel

**On Confirm:**
- Atomic transaction:
  - Generate the new child WO subtree under the parent Assembly WO
  - New WOs created with `parentWoId` set to the parent Assembly WO ID
  - All new WOs created in `Unreleased` state
  - All new WO steps created in `Waiting` state
  - WO `dueDate` initialized from the Project's current Due Date
  - WO `priority` initialized from null
  - `routingTemplateDefinitionId` snapshot set from current template
  - **Blocker auto-creation:** If the parent Assembly WO is past Waiting
    (i.e., its first routing step is `Ready`, `Started`, or `Complete`,
    OR the WO itself is `Complete`):
    - Automatic Blocker created on the parent Assembly WO
    - `processTypeId` = parent's first routing step's process type
    - `category` = `Local`
    - `preBlockerState` = parent's first step's current state
    - System-generated note: "BOM change added child component(s) [Part X
      qty N]; assembly readiness invalidated. New child WOs: [WO IDs].
      Resolve once new children complete."
  - Flag resolved
  - AuditLog entries written for all changes
- Flag indicator updates
- Toast confirms: "Added [Part X] qty [N] to Assembly [Y]. [N] new Work
  Orders generated. Parent Assembly Blocker created (if applicable)."

**Hard rule:** Component Added Accept Change only handles ONE flag at a
time, on ONE affected parent Assembly WO. Multiple parents flagged for
the same change resolve independently.

**Hard rule:** Component Added resolution always uses current Library
state — it generates the WO subtree using the BOM and Routing Templates
as they exist at resolution time, not at flag creation time. If the BOM
has been further edited since the flag was created, the resolution may
differ from what was originally surfaced.

### BOM Component Removed (No Accept Change Action)

`BOMComponentRemoved` flags are resolved differently because the resolution
involves Cancelling existing child WOs, which is a separate action — not
the flag's responsibility.

**UI:**
- Only "Dismiss" is offered as an explicit resolution action
- Body explains the recovery path:
  - "Removing this component from the parent Assembly's BOM means the
    existing child WO(s) for [Part X] are no longer required."
  - "To remove the child WO(s): use the Cancel action on each affected
    child WO. This is a separate action available in the WO side panel."
  - "Once child WOs are Cancelled, dismiss this flag with a note explaining
    what was done."
- Required: note
- Confirm / Cancel

**Resolution flow in practice:**
1. Manager sees `BOMComponentRemoved` flag on parent Assembly WO
2. Manager navigates to affected child WO(s) (linked from flag context)
3. Manager Cancels each child WO via the Cancel primitive (see below)
4. Manager returns to parent Assembly's flag and Dismisses with note:
   "Cancelled child WOs [IDs] per BOM removal."

**Hard rule:** BOM Component Removed flag resolution does not provide
automated cancellation. The manager uses the Cancel primitive on each
child WO independently.

---

## Cancel — A New Primitive

The Definition Change Flag system surfaces the need for Cancel as a
general WO action, not just for flag resolution. Cancel becomes the fifth
edit primitive (alongside Loss, Rollback, Return to Stock, and WO Split).

### When Cancel Is Available

Cancel is available on any leaf WO (a WO with no descendants in any state
other than Cancelled) under the following conditions:
- WO is in `Unreleased`, `Open`, or `Complete` state
- All descendants (if any exist) are already `Cancelled`
- User has Manager or Admin permission

### Where Cancel Lives

- **WO Side Panel — Actions section** (primary surface)
- Project View row right-click menu (secondary)
- Operations Lens row right-click menu (secondary)
- NOT in process lenses (operator-facing surfaces)

### Cancel Workflow

1. User initiates Cancel on a WO
2. Eligibility check:
   - Is this WO a leaf (no non-Cancelled descendants)?
   - If not, error: "Cannot cancel — this WO has [N] active descendants:
     [WO IDs]. Cancel descendants first (leaf-first order)."
3. If eligible, shared confirmation+note modal opens:
   - Header: WO ID, Part Number, current state
   - Action: "Cancel WO [ID]"
   - Side effects displayed:
     - "WO will be removed from operational views"
     - "Parent Assembly readiness will recalculate (was N/M, becomes N/(M-1))"
     - If this Cancel resolves a definition change flag: "This Cancel
       satisfies the BOM change flag on parent Assembly [ID]"
   - Required: note
   - Confirm / Cancel
4. On Confirm, atomic transaction:
   - WO transitions to `Cancelled` state
   - WOStateChanged AuditLog entry written
   - If the WO was in a Batch: removed from Batch (Batch's totalQuantity
     and other derived fields recompute; Batch dissolves if only one
     member remains)
   - Parent Assembly's readiness math automatically recomputes
   - **No automatic Blocker on parent.** Cancellation reduces parent's
     denominator (was N/M, becomes N/(M-1)); this is consistent with
     parent's readiness — no inconsistency to block on
5. Toast confirms: "Cancelled WO [ID]."

### Cancellation State Implications

A `Cancelled` WO:
- Hidden from execution lenses (Operations Lens, process lenses) by default
- Hidden from Project View by default (visible via "Show Cancelled" toggle)
- Excluded from Cumulative Demand calculations
- Excluded from Assembly readiness math (parent's count decrements)
- Excluded from Project Status auto-transition logic (Project completes
  when all non-Cancelled WOs are Complete)
- Excluded from Stock Fulfillment candidate queries
- Cannot be Returned to Stock (nothing to return)
- Cannot be Skip-and-Fulfilled (terminal state)
- Cannot be unCancelled in Rev 1 (one-way; Rev 2 may add un-Cancel
  workflow)
- AuditLog history preserved
- Visible in archived Project's read-only historical view

### Hard Rules — Cancel

| # | Rule |
|---|------|
| CAN-1 | Cancel is available only on leaf WOs (no non-Cancelled descendants) |
| CAN-2 | Cancel is a Manager/Admin action |
| CAN-3 | Cancel requires a note (no silent cancellation) |
| CAN-4 | Cancel is one-way in Rev 1 (no un-Cancel workflow) |
| CAN-5 | Cancelled WOs are excluded from operational visibility, readiness math, demand calculations, and project status logic |
| CAN-6 | Cancellation in a Batch automatically removes the WO from the Batch (with Batch dissolution if only one member remains) |
| CAN-7 | Cancellation does NOT trigger an automatic Blocker on the parent Assembly. Reduction of parent's denominator is consistent with no work being needed |

---

## Hard Rules — Resolution Behavior

| # | Rule |
|---|------|
| RES-1 | Each flag is resolved independently. Resolution of one does not propagate to others |
| RES-2 | Resolution actions: Dismiss (always available) and AcceptChange (conditional per change type) |
| RES-3 | All resolutions require a note. No silent resolution |
| RES-4 | Accept Change uses current Library state at resolution time, not at flag creation time. The flag captures the question; the Library answers it |
| RES-5 | Accept Change for fields updates the WO's stored value. It does not undo work already done with the old value. Manager handles physical reconciliation |
| RES-6 | Accept Change for routing templates regenerates the WO's steps. Step progress is not preserved automatically |
| RES-7 | Accept Change for routing templates is blocked when WO is in a Batch (must remove first) or Complete (must be reverted to Open first via Return to Stock or composed Rollback + ScrapQty adjustment). The path depends on the manager's judgment about whether existing parts remain conforming |
| RES-8 | Accept Change for BOM Component Added generates new child WO subtree atomically. If parent is past Waiting, an automatic Blocker is created on the parent |
| RES-9 | BOM Component Removed does not provide automated Cancel. The manager uses the Cancel primitive on each affected child WO independently, then dismisses the parent's flag with a note |
| RES-10 | Accept Change resolutions cannot result in invalid state (e.g., setting an inactive vendor). Such resolutions are blocked with explanatory error |

---

## Permissions

| Action | Operator | Lead | Manager | Admin |
|--------|----------|------|---------|-------|
| See flag indicator on WOs | ✓ | ✓ | ✓ | ✓ |
| See flag context (audit log on hover, side panel) | ✓ | ✓ | ✓ | ✓ |
| Trigger flag creation (via definition edit) | — | — | ✓ | ✓ |
| Resolve flags (Dismiss or AcceptChange) | — | — | ✓ | ✓ |
| Cancel WO (independently of flags) | — | — | ✓ | ✓ |

Definition edits in Parts Master, BOM Editor, and Routing Template Editor
are Manager/Admin actions per those specs. The flag system inherits this
permission model — engineers do not edit definitions in Tirion (Rev 1
assumes engineering work happens elsewhere; Tirion captures the production-
side implications).

---

## Schema Implications

This system requires the following schema additions to be applied during
Stage 6 reconciliation:

| Addition | Notes |
|----------|-------|
| `DefinitionChangeFlag` table | Per the schema definition above |
| `DefinitionChangeType` enum | 6 values per spec |
| `FlagResolution` enum | 2 values: Dismiss, AcceptChange |
| `WOStatus.Cancelled` value | Added back to WOStatus enum (was removed in initial Stage 6 pass) |
| AuditAction lookup additions | DefinitionChangeFlagCreated, DefinitionChangeFlagResolved, WOCancelled, RoutingResetByFlagResolution |

The `Cancelled` value re-addition to `WOStatus` is required by this spec
and by the Cancel primitive. Visibility filters across all view specs
need to exclude Cancelled by default.

---

## Reconciliation Pass — Specs Affected

This spec creates ripple effects in other specs that need updates during
the reconciliation pass:

- **`parts_master_spec.md`** — Edit-Time Dialog section; flag-triggering
  field list; Cancel as a general primitive (not specific to flag system,
  but introduced here)
- **`bom_editor_spec.md`** — Edit-Time Dialog section; flag-triggering
  change types
- **`routing_template_editor_spec.md`** — Edit-Time Dialog section
- **`project_view_spec.md`** — Flag indicator on rows; "Show Cancelled"
  toggle; visibility rule update for Cancelled exclusion; Cancel primitive
  in side panel
- **`operations_lens_spec.md`** — Flag indicator on rows; visibility rule
  update for Cancelled exclusion
- **`assembly_lens_spec.md`** — Visibility rule update for Cancelled;
  readiness math excludes Cancelled
- **All execution lens specs** — Visibility rule update for Cancelled
- **`detail_panel_spec.md`** — Pending Definition Changes section in side
  panel structure
- **`batch_editor_spec.md`** — Batch flag display and resolution surface;
  batch flag visibility; batch dissolution behavior when flags are open;
  member flag handling on batch member changes
- **`system_intent_and_rules.md`** — Principle 10 connection: "The
  Definition Change Flag system is the mechanism by which Principle 10
  surfaces deferred reconciliation decisions"
- **`state_model.md`** — Cancelled state added to Object 2 (WO); Cancelled
  transitions documented
- **`schema.md`** — DefinitionChangeFlag table, enums, Cancelled re-added,
  AuditAction additions
- **`terminology_lock.md`** — Cancel primitive added to Cluster 5
  (Procedural Verbs); Definition Change Flag added to vocabulary

---

## Design Notes

- The fundamental design choice is conservatism about automation. The
  system surfaces what changed and what's affected; humans decide what
  to do. This is more honest than partial automation and matches Tirion's
  broader philosophy of empowering users to make decisions rather than
  relying on the system to automate all of them

- Flags are per-WO because resolution context is per-WO. A change affecting
  12 WOs may have 12 different correct resolutions depending on each WO's
  state, customer commitments, and operational reality. Aggregating
  resolution at the change level would force false uniformity

- Edit-time acknowledgment dialogs serve a forcing-function purpose. Even
  when a definition change has no WIP impact, the dialog ensures the
  engineer sees what other definition records reference the thing being
  changed. This is part of making engineers aware of the dependency graph
  they're operating in. The cost is small (one dialog per change with
  references); the benefit is changed engineer behavior over time

- The system does not try to undo work done with old values. When a
  Material Spec change is Accepted on a WO that has already machined
  parts from old material, the WO's recorded material is updated; the
  physical parts in the bin are still old material. The manager's
  resolution note captures what's actually happening. This is an honest
  data model: it represents what the data should be, while leaving
  physical reality to humans

- **For Complete WOs affected by definition changes, the manager judges
  whether the as-built remains acceptable.** If yes, Dismiss the flag with
  a note. If the as-built is no longer conforming, the manager must address
  the existing parts before applying the change — either Return to Stock
  (when parts remain usable somewhere) or compose existing primitives
  (Rollback + adjust CompletedQty / ScrapQty) to scrap the parts when they
  are obsolete. Rev 1 does not provide a single "Scrap" action — the
  composition of existing primitives gives the manager full control over
  how the data reflects what was physically done

- The edit-time dialog's Stock Impact section surfaces existing inventory
  counts because stock items are also affected by definition changes —
  not just WIP. A material change might mean existing stock parts are
  no longer usable for new orders. The system raises awareness; the
  manager handles stock conformity via the existing Reconcile Stock
  workflow. This is a Rev 1 deliberate scope limit — Rev 2 may add a
  formal stock review mechanism

- **Batch propagation reflects the underlying reality** that batched WOs
  share all definition-derived attributes. A change to one member's Part
  affects all members identically, so resolution at the batch level is
  the natural unit of decision. Per-member resolution requires explicit
  batch dissolution because differing per-member resolutions imply the
  members are no longer truly identical and shouldn't be batched together

- The Component Added Accept Change workflow that auto-creates a Blocker
  when parent Assembly is past Waiting is the right behavior because the
  inconsistency is mechanical — it can be detected deterministically,
  and forcing the manager to manually create the Blocker would be friction
  without value. The manager already has to resolve the Blocker; they
  don't need to also create it

- BOM Component Removed deliberately does NOT provide automated
  cancellation. Cancellation has real consequences (parts may have been
  produced, material allocated, customer commitments made) that the
  manager must face individually per child WO. Forcing leaf-first manual
  cancellation is friction that prevents bulk-cancellation accidents

- The Cancel primitive is a fifth edit primitive, not just a flag
  resolution mechanism. It belongs in the WO action vocabulary alongside
  Loss, Rollback, Return to Stock, and WO Split. The flag system is one
  trigger for using it; managers can also use it for their own reasons

- Resolution requires a note for the same reasons blocker resolution
  requires a note: forces articulation of what was decided and why.
  Creates an audit trail with semantic content, not just timestamps

- The "operator can see flag indicators and audit logs but cannot resolve"
  permission model is intentional. Operators benefit from visibility (they
  may need to escalate to a Manager when they encounter a flagged WO);
  resolution is a Manager-level decision because it commits the system
  to a particular handling of the change

---

## Open Items for Reconciliation Pass

The following items from this spec touch other specs and should be
reviewed during the post-Stage-7 reconciliation pass:

- **Parts Master spec:** Edit-Time Dialog details; field-by-field flag
  triggering rules
- **BOM Editor spec:** Edit-Time Dialog details; change-type-specific
  flag triggering
- **Routing Template Editor spec:** Edit-Time Dialog details
- **Project View spec:** Flag indicator visual treatment; "Show Cancelled"
  toggle in view-shaping controls; Cancel primitive surfacing
- **Operations Lens spec:** Flag indicator visual treatment; Cancelled
  exclusion in default visibility filter
- **Assembly Lens spec:** Cancelled exclusion in readiness math; Cancelled
  exclusion in visibility filter
- **All execution lenses:** Cancelled exclusion in visibility filter
- **Detail Panel spec:** Pending Definition Changes section in side panel
  structure; Cancel action in WO Actions section
- **System Intent and Rules:** Principle 10 mechanism documented
- **State Model (Object 2 — Work Order):** Cancelled state added; Cancel
  transitions documented
- **Schema:** DefinitionChangeFlag table; Cancelled re-added to WOStatus;
  AuditAction additions; visibility rule updates
- **Terminology Lock:** Cancel primitive added; Definition Change Flag
  vocabulary added

---

## Rev 2 Backlog

- **Reissue primitive** — generate a replacement WO at the same BOM
  position with current Library definitions. Would address the Routing
  Template Change "Cancel + reissue" workflow more cleanly
- **Stock Items Pending Review** — extend the flag mechanism to stock
  items affected by definition changes. When a Part field change affects
  stock, generate a stock-flag that lets managers record per-stock-batch
  decisions about conformity (use as-is, segregate for legacy orders,
  scrap). Currently Rev 1 surfaces stock counts in the edit-time dialog
  but does not create persistent stock flags
- **Bulk flag resolution** — when a definition change affects many WOs in
  similar state, allow Manager to bulk-resolve with a shared note (with
  per-WO override)
- **Definition Change Inbox view** — aggregated view of all open flags
  across the system, sortable by change type, age, urgency
- **Un-Cancel workflow** — restore a Cancelled WO to its previous state
  (rare but legitimate use case)
- **Engineering review queue** — flags routed to engineering for
  acknowledgment before being released to managers (in shops with
  formalized engineering change processes)
- **Server-side persistence of flag resolution preferences** — manager-
  level defaults (e.g., "always Dismiss cosmetic-vendor changes")
- **Bulk Cancel** — cancellation tooling for large-scale project termination
  scenarios (currently Rev 1 requires per-WO leaf-first manual cancellation)

