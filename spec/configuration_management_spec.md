# Tirion — Configuration Management Spec

## Purpose

This spec covers the management surfaces for Tirion's configuration and
reference data: the catalog of Vendors, MaterialSpecs, Users, ProcessTypes,
and ProcessTypeSubStatus values that the rest of the system references.

These are foundational records, not operational data. They are referenced by
Parts, BOMs, Routing Templates, Work Orders, and audit logs throughout the
system. Their lifecycle is distinct from operational data:

- Operational data (Projects, WOs, Batches) flows through the system and
  reaches terminal states (Complete, Cancelled, Archived)
- Configuration data is long-lived; it accumulates over time, occasionally
  gets edited, occasionally gets deactivated, but rarely reaches a terminal
  state in the same sense

The system's design philosophy applies here as elsewhere: permissive
operations that preserve audit trails, soft-delete to preserve historical
references, no surprise behaviors.

---

## Scope

Five configuration surfaces:

1. **Vendors** — companies and suppliers we order from
2. **MaterialSpecs** — material specifications referenced by Parts and Supply Order Lines
3. **Users** — system users with role assignments
4. **ProcessTypes** — the catalog of process steps available for routing templates
5. **ProcessTypeSubStatus** — per-process sub-status options

Each surface is described in its own section below. Common patterns shared
across all five are documented first.

---

## Common Surface Pattern

All five configuration surfaces follow a consistent UX pattern:

### Grid View

- Sortable, filterable list of records
- Active records by default; "Show Inactive" toggle reveals deactivated records
- Inactive records visually distinct (heavily de-emphasized or strikethrough)
- "Add New" button in the header (where applicable per the Creation Pattern
  section below)
- Inline editing for low-stakes fields (display labels, notes — same pattern
  as Parts Master grid)
- Click a row to open the record's detail modal

### Detail Modal

- Slide-in panel or modal showing the full record
- All fields visible; editable fields support inline edit per permission rules
- Action buttons: Save, Cancel, Deactivate (where applicable)
- Audit log section (collapsible, default collapsed) showing change history
  for this record
- Reference counts displayed where relevant (e.g., for a Vendor: "12 active
  Parts reference this vendor as Default Vendor")

### Audit Logging

Every create, edit, and deactivation action writes an AuditLog entry capturing:
- Action type
- Acting user
- Timestamp
- Changed fields (before/after for edits)

### Soft Delete (Deactivation)

No hard deletes in Rev 1. Records have an `isActive` boolean field; setting
this to false hides the record from active selection but preserves all
historical references and audit trail integrity.

This approach preserves foreign key referential integrity automatically: a
WO referencing a deactivated Vendor in audit logs continues to resolve
correctly because the Vendor record still exists in the database.

### Permissions

| Surface | Manager | Admin |
|---------|---------|-------|
| Vendors | View, Add, Edit, Deactivate | All |
| MaterialSpecs | View, Add, Edit, Deactivate | All |
| Users | — | All |
| ProcessTypes | — | View only (locked in Rev 1) |
| ProcessTypeSubStatus | — | All |

Operators and Leads have no access to configuration surfaces. Manager/Admin
distinction matters primarily for User management and ProcessType management
in Rev 1; these are the only surfaces where the role distinction creates
different UI access.

---

## Creation Pattern

Configuration records can be created in two ways:

### In-Context Creation (Pattern B)

Vendors and MaterialSpecs are primarily created from within the Parts Master
Part Form workflow. When a buyer or engineer is editing a Part and needs to
set a Default Vendor or MaterialSpec that doesn't exist yet, an "Add New"
affordance appears inline:

- Inline "Add New [Vendor/MaterialSpec]" option in the relevant dropdown
- Selecting it opens a quick-create modal with required fields only
- Saving the new record returns to the Part Form with the new value selected
- Full record details can be edited later via the dedicated configuration
  surface

This pattern reflects how operations actually work in small shops: vendors
get added when an order needs to go to one, not in advance during a setup
phase.

**Routing Templates do NOT use Pattern B.** Although Routing Templates are
also referenced from the Part Form, they are higher-stakes than Vendors and
MaterialSpecs — a Routing Template defines an entire production sequence,
requires careful step ordering, and has Edit-Time Dialog implications when
edited later. Quick-creating from the Part Form risks creating templates
too casually. Routing Templates are managed via the dedicated Routing
Template Editor surface (see `routing_template_editor_spec.md`); the Part
Form provides selection of existing templates and a "View / Edit in Routing
Template Editor" navigation link, but does not support in-context creation.

### Dedicated Surface Creation (Pattern A)

Users and ProcessTypeSubStatus are created exclusively via their dedicated
configuration surfaces. These records are deliberate system configuration
done by an Admin, not operational adds during normal work.

Routing Templates also use Pattern A despite being referenced from the
Part Form — see explanation in Pattern B above. Routing Template creation
and editing is via the dedicated Routing Template Editor surface (see
`routing_template_editor_spec.md`). Routing Templates are not part of
this Configuration Management spec — they have their own dedicated spec.

ProcessTypes are not creatable in Rev 1 (locked seed list — see ProcessType
section below).

---

## Vendor Management

### Purpose

Vendors are the companies and suppliers Tirion orders materials and parts
from. Vendors are referenced as the Default Vendor on Parts and as the
recipient of Supply Orders.

### Schema

Existing schema per `schema.md`:

```prisma
model Vendor {
  vendorId    Int      @id @default(autoincrement())
  vendorName  String   @unique
  contactInfo String?
  leadTimeDays Int?
  notes       String?
  isActive    Boolean  @default(true)

  // Relations
  parts          Part[]
  supplyOrders   SupplyOrder[]
}
```

### Grid Columns

| Column | Notes |
|--------|-------|
| Vendor Name | Required, unique |
| Contact Info | Display only — name, phone, email as free text |
| Lead Time (Days) | Reference for buyer planning |
| Default Vendor For | Count of active Parts referencing this vendor |
| Open Supply Orders | Count of Supply Orders in Ordered or Partial Received state |
| Active | Soft-delete indicator |

### Detail Modal Fields

All grid columns plus:
- Notes (free text)
- Audit log (collapsible)
- Reference list: which Parts use this vendor as Default Vendor (clickable
  links to those Parts)

### Creation

Two paths:
1. **Inline from Part Form** (primary): when editing a Part's Default Vendor
   field, "Add new vendor" inline option opens a quick-create modal with
   Vendor Name (required) and Contact Info (optional). New vendor is selected
   and Part Form continues
2. **From Vendors surface** (administrative): "Add New Vendor" button in
   header opens a full create modal

### Editing

All fields editable by Manager or Admin via the detail modal or inline grid
edit (for low-stakes fields).

When a vendor is edited and the change affects the displayed vendor on open
WOs (e.g., Vendor Name change), the Definition Change Flag system surfaces
the impact per `definition_change_flag_spec.md`. Note: the Vendor record
itself doesn't trigger flags directly — flags trigger when the Default Vendor
is changed on a Part record. Vendor name/contact edits propagate via display
only.

### Deactivation Rules

A Vendor can be deactivated only when:
- No active Part references this Vendor as Default Vendor
- The user must reassign Default Vendor on those Parts first, OR deactivate
  those Parts

Open Supply Orders do not block Vendor deactivation in Rev 1 — historical
Supply Orders remain attached to the deactivated vendor record. The vendor
just can't be used for new orders.

The deactivation modal lists all blocking references and provides links to
resolve them. The "Deactivate" button is disabled until references are
cleared.

### Audit

Vendor create/edit/deactivate logged via standard AuditLog entries.

---

## MaterialSpec Management

### Purpose

MaterialSpecs define material types and specifications used in production:
"1018 Steel Bar 1.5\" Round", "6061-T6 Aluminum Plate 0.5\"", etc. They are
referenced by Parts (the material the part is made from) and by Supply Order
Lines (raw material orders).

### Schema

Existing schema per `schema.md`:

```prisma
model MaterialSpec {
  materialSpecId   Int      @id @default(autoincrement())
  materialName     String   @unique
  description      String?
  defaultVendorId  Int?
  isActive         Boolean  @default(true)

  // Relations
  parts                Part[]
  supplyOrderLines     SupplyOrderLine[]
  defaultVendor        Vendor?  @relation(fields: [defaultVendorId], references: [vendorId])
}
```

### Grid Columns

| Column | Notes |
|--------|-------|
| Material Name | Required, unique (e.g., "1018 Steel Bar 1.5\" Round") |
| Description | Free text |
| Default Vendor | Reference to Vendor record (nullable) |
| Used By | Count of active Parts referencing this MaterialSpec |
| Active | Soft-delete indicator |

### Detail Modal Fields

All grid columns plus:
- Audit log (collapsible)
- Reference list: which Parts use this MaterialSpec (clickable links)

### Creation

Two paths:
1. **Inline from Part Form** (primary): when editing a Part's Material field,
   "Add new material spec" inline option opens a quick-create modal with
   Material Name (required), Description (optional), Default Vendor (optional)
2. **From MaterialSpecs surface** (administrative): "Add New" button

### Editing

All fields editable by Manager or Admin. When a MaterialSpec is edited and
the change affects open WOs (e.g., changes to Material Name displayed on the
Part), the Definition Change Flag system surfaces the impact.

### Deactivation Rules

A MaterialSpec can be deactivated only when:
- No active Part references this MaterialSpec
- The user must reassign Material on those Parts first, OR deactivate those
  Parts

Historical Supply Order Lines referencing the MaterialSpec do not block
deactivation. The MaterialSpec just can't be used for new Parts.

---

## User Management

### Purpose

Users represent system actors. In Rev 1, users are identified manually via
selection at the top of the screen (no authentication). The system records
the active user in audit logs and uses the user's role to filter UI access
and permissions.

### Rev 1 Authentication Model

**Manual user selection.** A dropdown at the top of the screen lets the user
identify who they are. The selection is preserved across pages within a
session. Audit logs record the selected user as the actor for all actions.

Rev 1 does NOT have:
- Password authentication
- Email-based identity
- Active session tracking
- Multi-factor authentication
- Permissions beyond role assignment

This model is appropriate for trusted shop floor environments where
deception is not the threat model. Authentication is Rev 2 work.

### Schema

```prisma
model User {
  userId               Int      @id @default(autoincrement())
  userName             String   @unique
  displayName          String
  role                 UserRole
  isActive             Boolean  @default(true)
  defaultStation       String?  // optional, for Operators
  // ... timestamps and other standard fields

  // Relations
  assignedProcessTypes UserProcessTypeAssignment[]
  // ... audit log relations
}

enum UserRole {
  Operator
  Lead
  Manager
  Admin
}

model UserProcessTypeAssignment {
  userId         Int
  processTypeId  Int

  user           User         @relation(fields: [userId], references: [userId])
  processType    ProcessType  @relation(fields: [processTypeId], references: [processTypeId])

  @@id([userId, processTypeId])
}
```

The `UserProcessTypeAssignment` junction table assigns Operators and Leads
to specific ProcessTypes (which lenses they have execution access to).
Managers and Admins implicitly have access to all ProcessTypes.

### Grid Columns

| Column | Notes |
|--------|-------|
| User Name | Unique system identifier |
| Display Name | What appears in UI and audit logs |
| Role | Operator / Lead / Manager / Admin |
| Assigned Process Types | For Operators and Leads — list (e.g., "Machining, Assembly") |
| Default Station | For Operators — optional |
| Active | Soft-delete indicator |

### Detail Modal Fields

All grid columns plus:
- Audit log (collapsible)
- Recent activity summary (Rev 2 — Rev 1 just shows the audit log)

### Creation

Admin only. "Add New User" button in header opens a create modal with:
- User Name (required, unique)
- Display Name (required)
- Role (required, dropdown)
- Assigned Process Types (required for Operator/Lead, hidden for Manager/Admin)
- Default Station (optional, shown for Operator only)

### Editing

Admin only. All fields editable.

### Role Assignment Rules

- A user has exactly one role at a time
- Role determines permissions across all surfaces
- Only an Admin can assign or change roles
- **Lockout prevention:** an Admin cannot change their own role to non-Admin
  if they are the only active Admin in the system. The system validates this
  at save time and blocks the action with explanatory text.

### Deactivation Rules

Users can be deactivated at any time. No reference-based blocks (users are
referenced in audit logs throughout the system; preserving the user record
preserves audit integrity).

When a user is deactivated:
- They cannot be selected as the active user (removed from the user
  selection dropdown)
- Open WOs with that user assigned (Operator Assignment, etc.) retain the
  assignment with a visual indicator showing the user is inactive
- Audit log entries continue to display the user's name correctly
- The same lockout prevention applies: an Admin cannot deactivate themselves
  if they are the only active Admin

### Audit

User create/edit/deactivate logged via standard AuditLog entries. Role
changes are particularly important and audit entries capture the role
before/after.

---

## ProcessType Management

### Purpose

ProcessTypes define the catalog of process steps available for routing
templates. The Rev 1 seed list covers the standard manufacturing flow:
Purchase, Receive, Machine, Weld, Blacken, Paint, 3D Print, Assemble,
Distribution.

### Rev 1 Constraint: ProcessTypes Are Locked

**ProcessTypes cannot be added, edited, or deactivated in Rev 1.**

The seed list is fixed at system initialization. The dedicated ProcessTypes
surface in Rev 1 is **view-only** — Admins can see what's defined but cannot
modify.

The reason: each ProcessType has potential hardcoded behaviors elsewhere in
the system (Purchase ProcessType drives Purchasing Lens behavior, Receive
drives Receiving workflow, Assemble triggers Assembly Lens routing logic,
etc.). Adding a new ProcessType requires a development pass to determine:
- Which lens it appears in (or whether a new lens is needed)
- What grid columns the lens shows
- What actions are available in that lens
- What side panel content (Process-Specific Section) it has

Treating ProcessTypes as user-configurable in Rev 1 would create empty
ProcessTypes with no operational meaning. Better to keep the seed list
fixed and add ProcessType configuration as a deliberate Rev 2+ feature
when paired with the development work to make new types meaningful.

### Schema

```prisma
model ProcessType {
  processTypeId   Int      @id @default(autoincrement())
  processCode     String   @unique  // e.g., "MACHINE", "ASSEMBLE"
  processName     String   @unique  // display label
  description     String?
  isActive        Boolean  @default(true)

  // Relations
  subStatuses             ProcessTypeSubStatus[]
  routingTemplateSteps    RoutingTemplateStep[]
  workOrderSteps          WorkOrderStep[]
  userAssignments         UserProcessTypeAssignment[]
}
```

### Rev 1 Seed List

The following ProcessTypes are seeded at system initialization:

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

**StockFulfillment is NOT a ProcessType.** Stock Fulfillment is a planning
gate, not a routing process. It does not appear in routing templates or as
a step on WOs.

**Inspect and Finish are NOT Rev 1 ProcessTypes.** Earlier drafts included
these as seed types but they have been dropped from Rev 1 entirely. They
lack execution lenses in Rev 1, which would create orphaned process types
that routing templates could reference but no surface could operationalize.
Quality inspection workflows and finishing operations may be added in Rev 2
alongside lens definitions.

### ProcessTypes With and Without Execution Lenses

Five of the nine Rev 1 ProcessTypes have dedicated execution lenses:
Purchasing, Receiving, Machining, Assembly, Distribution. The remaining
four (Weld, Blacken, Paint, 3D Print) appear in routing templates and
WO routing displays but are managed via Operations Lens / Project View
rather than dedicated lenses:

- **Weld, Paint:** Performed by computer-illiterate operators; management
  mediates state updates verbally
- **Blacken:** Outside-vendor process; management updates state based on
  shipping/receiving knowledge
- **3D Print:** Rev 2 dedicated lens planned; managed by management in
  Rev 1

All nine ProcessTypes are anchor-eligible in Operations Lens and Project
View per `anchor_filter_spec.md`. Anchor + filter serves as the substitute
working surface for the four non-lens processes in Rev 1.

### Grid (View-Only in Rev 1)

| Column | Notes |
|--------|-------|
| Process Code | Unique system identifier |
| Process Name | Display label |
| Description | Free text |
| Sub-Statuses | Count of associated ProcessTypeSubStatus entries |
| Used in Templates | Count of Routing Templates referencing this ProcessType |

### Detail View

Click a ProcessType to view (not edit) its full record and associated
sub-statuses. The sub-statuses for that ProcessType are managed via the
ProcessTypeSubStatus surface (which IS editable — see next section).

### Rev 2 Considerations

Future revisions may unlock ProcessType management with paired development
work to make new ProcessTypes operationally meaningful. Until then, treat
the Rev 1 surface as a reference catalog.

---

## ProcessTypeSubStatus Management

### Purpose

ProcessTypeSubStatus values are optional descriptive sub-states that
operators can apply to a WO step within a process. They provide context
about what's happening within a state (e.g., a Machine step in "Started"
state can have sub-status "Setup" or "Running").

Sub-statuses are scoped per ProcessType — Purchasing sub-statuses don't
apply to Machining and vice versa.

### Schema

```prisma
model ProcessTypeSubStatus {
  processTypeSubStatusId Int      @id @default(autoincrement())
  processTypeId          Int
  subStatusName          String
  description            String?
  displayOrder           Int      @default(0)
  isActive               Boolean  @default(true)

  // Relations
  processType            ProcessType  @relation(fields: [processTypeId], references: [processTypeId])

  @@unique([processTypeId, subStatusName])
}
```

The `displayOrder` field controls the order sub-statuses appear in operator
dropdowns within their lens.

### Rev 1 Seed List

The following sub-statuses are seeded at system initialization. They are
**not protected** — admins can edit, reorder, or deactivate them after the
fact, treating them the same as user-added sub-statuses.

**Purchase:**
- Material checked (covers material verification in Rev 1, since material
  handling is not separated until later Revs)
- RFQ Pending
- Quote Received
- Ordered

(Partial Received and Closed are tracked at the Supply Order level, not as
WO sub-statuses.)

**Receive:**
- Partial
- Requested Update
- Delayed

(Awaiting and Received are redundant with the primary state machine. Other
issues — refusals, discrepancies — are uncommon and handled via Blockers
rather than enumerated as sub-statuses.)

**Machine:**
- Setup
- Running
- Complete
- Hold for QA
- Hold for Next Setup (machinist finished their portion; awaiting next
  station availability)

**Assemble:**
- Staging
- Validate Fit
- In Assembly
- QA Review

**Distribution:**
- No seed sub-statuses. Primary state machine is sufficient.

Admins can add sub-statuses to any ProcessType post-installation as shop
conventions emerge.

### Grid View

The grid is grouped by ProcessType. Each group shows that ProcessType's
sub-statuses with:

| Column | Notes |
|--------|-------|
| Sub-Status Name | Unique within ProcessType |
| Description | Free text |
| Display Order | Numeric, controls dropdown ordering |
| Used By | Count of WO steps currently set to this sub-status |
| Active | Soft-delete indicator |

### Creation

Admin only. "Add New Sub-Status" button within each ProcessType group opens
a create modal:
- Sub-Status Name (required, unique within ProcessType)
- Description (optional)
- Display Order (auto-incremented, editable)

The ProcessType is implicit from which group's "Add" button was clicked.

### Editing

Admin only. All fields editable.

### Deactivation Rules

Sub-statuses can be deactivated freely. No reference-based blocks.

When a sub-status is deactivated:
- It is hidden from new selection in operator dropdowns
- WO steps currently set to the deactivated sub-status retain the value with
  a visual indicator showing the sub-status is inactive
- Historical use is preserved in audit logs

### Reordering

Display order can be changed via inline edit on the displayOrder field.
Operator dropdowns will update on next page load.

---

## Hard Rules Summary

| # | Rule |
|---|------|
| CM-1 | All five configuration surfaces use soft-delete (`isActive` boolean) — no hard deletes in Rev 1 |
| CM-2 | Vendor and MaterialSpec deactivation requires no active Part references — preserves Parts Library FK integrity |
| CM-3 | Definition Change Flag system handles WIP impact when configuration records are edited (per principle 10) |
| CM-4 | User deactivation cannot lock out the only active Admin — system enforces |
| CM-5 | ProcessTypes are locked in Rev 1 — view-only; no add/edit/deactivate |
| CM-6 | ProcessTypeSubStatus is scoped per ProcessType (FK constraint) |
| CM-7 | Vendors, MaterialSpecs accessible to Manager and Admin |
| CM-8 | Users, ProcessTypes, ProcessTypeSubStatus accessible to Admin only |
| CM-9 | In-context creation (Pattern B) is the primary path for Vendors and MaterialSpecs from the Part Form |
| CM-10 | Dedicated surface creation (Pattern A) is the only path for Users and ProcessTypeSubStatus |
| CM-11 | All configuration changes write AuditLog entries with actor, timestamp, and before/after where applicable |

---

## Rev 2 Wishlist

- **Authentication system** — replace manual user selection with password-
  based authentication, session management, and optional MFA
- **ProcessType management** — unlock ProcessType add/edit/deactivate paired
  with the development work to make new ProcessTypes operationally meaningful
  (lens definitions, side panel content, etc.)
- **Email integration on User records** — enables @-mention messaging
  integration referenced in the Process Notes design
- **Vendor merge utility** — admin tool for consolidating duplicate Vendor
  entries that accumulate from in-context creation
- **MaterialSpec import / standard library** — pre-populated common material
  specs that admins can enable rather than recreating
- **Per-user permissions overrides** — currently permissions follow strictly
  from role; future could support per-user overrides for edge cases

---

## Schema Implications

The schema as documented in `schema.md` already supports this spec. No new
tables or columns are required. Notes:

- All five tables already have `isActive` boolean fields
- `UserProcessTypeAssignment` junction table exists per schema
- `ProcessTypeSubStatus` has the `displayOrder` field
- AuditAction enum already includes generic config actions (CREATE, EDIT,
  DEACTIVATE) that apply to all five surfaces

If during build it becomes apparent that distinct AuditAction values are
needed per surface (e.g., `VendorDeactivated`, `UserRoleChanged`), add them
to the seed list at that point. The current generic approach should suffice
for Rev 1.

---

## Design Notes

- The in-context creation pattern (Pattern B) for Vendors and MaterialSpecs
  reflects how operations actually work in small shops. Operators don't go
  set up vendors before doing work — they add a vendor when an order needs
  to go to one. The dedicated configuration surfaces exist for periodic
  admin cleanup, not for routine operational setup. Routing Templates are
  excluded from Pattern B because their creation is higher-stakes and
  benefits from focused attention in the dedicated editor.

- Soft-delete via `isActive` is the only deletion model in Rev 1. This
  preserves all foreign key references and audit log integrity automatically
  without requiring complex cascade rules. The cost is database growth from
  inactive records, which is negligible at the scale of small-shop
  manufacturing.

- ProcessType locking in Rev 1 is intentional and conservative. The
  alternative — letting admins create ProcessTypes that have no operational
  meaning — would be technically possible but functionally broken.
  ProcessTypes are too coupled to system behavior to be configured without
  paired development work.

- The Manager/Admin distinction is meaningful in only two surfaces in Rev 1:
  User management and ProcessType management. Elsewhere, both roles have
  the same access. This minimal distinction reflects the small-shop reality
  where most configuration tasks fall to whoever has the time, with Users
  and ProcessTypes treated as more sensitive system administration.

- The seed sub-statuses are educated starting points based on the existing
  lens specs, not protected system values. Admins should expect to refine
  the lists based on their shop's actual workflow vocabulary.

- Audit log integrity is preserved by never deleting any record. A WO
  completed two years ago with a now-deactivated user assigned still
  resolves correctly when the audit log is reviewed. This is critical for
  small-shop manufacturing where dispute resolution and customer audits
  may reference historical work.
