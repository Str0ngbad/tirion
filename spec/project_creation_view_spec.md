# Tirion — Project Creation View Spec

## Purpose

The Project Creation View is the home for all Project-level workflows. It serves
two related purposes:

**For Draft Projects:** the view is where planners create new Projects and trigger
Work Order generation from the BOM tree. Compilation is the all-or-nothing gate
that converts a Draft Project into an Active Project with a fully generated
Work Order tree.

**For Active Projects:** the view is where managers see project-level summary
information (WO completion progress, due dates, customer context) and edit
Project-level metadata (Project Name, Customer Name, Notes, Due Date). It is
also where Project Archival happens after a Project is Complete.

Both purposes share the principle that **Project-level concerns live here.**
WO-level edits (priority, state changes, drift correction) live in Project View
and the process lenses. This view is for things that affect the Project as a
whole.

This view is the entry point for all production demand — every Work Order in
the system originates here, and every Project's lifecycle bookends here
(creation through archival).

---

## Operational Sequence

```
Project Creation → Stock Fulfillment → Batching Lens → Execution Lenses
```

A successfully compiled Project produces a complete Work Order tree. Those
WOs then enter Stock Fulfillment for evaluation, then Batching for organization,
then execution lenses for production. This view is the chronological start of
that flow.

---

## Project Lifecycle

| State | Meaning |
|-------|---------|
| Draft | Created. Metadata being entered. No Work Orders exist. Not visible in any execution or planning lens. Editable in the Draft Editor surface of this view |
| Active | Successfully compiled. Full WO tree exists. Visible in execution lenses, Project View, and other operational views. Project metadata editable in the Active Project Summary surface of this view |
| Complete | All WOs in the Project are Complete. Project Status auto-transitions Active → Complete when the last WO completes. Eligible for archival |
| Archived | Manager archived. Removed from default operational and management views. Read-only historical record remains accessible via filter |

**Hard rule:** A Project transitions Draft → Active only through successful
compilation. There is no other path.

**Hard rule:** Once Active, a Project cannot return to Draft. Changes to
WOs in an Active Project happen via Project View (state edits), Batch Editor
(WO splits, batch manipulation), and Project Archival when the Project is
Complete — not through Draft re-entry.

**Hard rule:** Active → Complete is automatic. The system transitions Status
when the last WO becomes Complete. No manual Complete action exists.

**Hard rule:** Complete → Archived is manual. A manager initiates the
Archive action; Status does not auto-transition.

---

## Entry Points

**Primary:** Project Creation nav item — opens the view with the unified
Project list displayed (Drafts and Active Projects, see View Layout below).

**From a Draft Project row:** opens that Draft in the Editor for compilation.

**From an Active Project row:** opens that Project's Summary view for
project-level visibility and metadata editing.

**From a validation failure deep link** (when another user shared a Draft
with validation issues): opens the Draft directly to the failure context.

**From a Project Number link anywhere in the system:** when a Project Number
is clicked in any other view, it opens the Active Project's Summary in this
view. (Project View is the operational drilldown for the BOM tree; this view
is the project-metadata surface.)

---

## View Layout

The view has three primary surfaces:

1. **Project List** — the default landing surface, showing all Drafts and Active
   Projects with filters and sort. Archived Projects are accessible via filter
   but not shown by default
2. **Draft Editor** — the workflow for shaping and compiling a Draft Project
3. **Active Project Summary** — the surface for Active Project metadata,
   project-level state, and archival actions

Drafts and Active Projects share the list; opening a row routes to the
appropriate surface based on Project status.

---

## Project List

The unified list shows all Projects with status filterable. Default visibility
includes Drafts and Active Projects. Archived Projects are filterable in but
hidden by default.

| Column | Notes |
|--------|-------|
| Project Number | User-entered, unique |
| Project Name | |
| Customer Name | Nullable |
| Status | Draft / Active / Complete / Archived |
| Due Date | Project-level Due Date |
| Top-Level Count | Number of top-level Assemblies/Parts in the Project |
| Progress | For Active and Complete: WO completion progress (e.g., "47/52"). For Drafts: shows validation status (Pass / Fail / Not yet validated) |
| Created By | User who created the Project |
| Created At | |
| Last Edited By | User who last modified the Project |
| Last Edited At | |

**Default sort:** Last Edited At, descending.

**Filters:**
- Status (Draft / Active / Complete / Archived) — multi-select; default
  shows Draft + Active + Complete, hides Archived
- Customer Name — multi-select
- Date range filters on Due Date and Created At

**Actions on the list:**
- Add New Project (Manager, Admin only) — opens the Draft Editor with a
  blank Draft
- Open a row → routes to Draft Editor (if Draft) or Active Project Summary
  (if Active / Complete / Archived)
- Delete a Draft (Manager, Admin only) — two-click confirmation, hard delete

**View access:**
- Manager, Admin, Lead can view the list
- Operators do not have access to this view

---

## Creating a New Project

Triggered by "Add New Project" button. Opens the Project Editor with an empty
Draft. The Draft is created in the database immediately on entry to the
editor — no separate "save" action is required to persist the Draft itself.
Field-level changes are saved as the planner works (auto-save on field blur or
similar pattern).

This persistence model is what enables the escalation handoff workflow:
another user with view access can see the Draft and follow validation errors
to their source even if the original planner is not present.

**Required fields to compile:**
- Project Number (unique, user-entered)
- Project Name
- At least one top-level Assembly or Part with quantity ≥ 1

**Optional fields:**
- Customer Name (nullable per Hard Rule 7)
- Due Date
- Project-level Priority (nullable — see Decision Notes below)
- Notes

---

## Project Editor — Header Section

Always visible at the top of the Editor.

| Field | Type | Required for Compile | Notes |
|-------|------|---------------------|-------|
| Project Number | String | Yes | Unique. Format conventions are organizational — no system enforcement of format |
| Project Name | String | Yes | |
| Customer Name | String | No | Remains nullable to support Rev 2 stock fulfillment projects |
| Due Date | Date | No | |
| Project-Level Priority | Int | No | If set, applied uniformly as starting priority for all generated WOs. If null, generated WOs have null priority and require manual setting in operational views |
| Notes | Text | No | |

**Validation behavior:**
- Project Number uniqueness validated on field blur. Inline error if duplicate.
- All other fields validated only at Compile time.

---

## Project Editor — Top-Level Items Section

Below the header. The planner builds the project's deliverables here by adding
top-level Assemblies or Parts.

### Add Row

A searchable single-add control. The planner searches by Part Number or Part
Name, selects a Part or Assembly from active records, and enters a quantity.
On confirm, the item appears as a row in the Top-Level Items list.

**Search scope:**
- All active Parts and Assemblies
- Inactive Parts/Assemblies are not selectable
- Search results show Part Number, Part Name, Type (Part/Assembly), and a
  validation indicator if the item has known validation issues (no template
  assigned, template inactive)

### Top-Level Items List

| Column | Notes |
|--------|-------|
| Top-Level Reference | Auto-generated suffix combined with Project Number — e.g., 20137.01, 20137.02. Immutable once assigned |
| Part Number | |
| Part Name | |
| Type | Part or Assembly |
| Quantity | Editable inline. Must be ≥ 1 |
| Validation Indicator | Live status — Pass, Fail (with reason), or Pending Validation |
| Remove | Removes this top-level item from the Draft |

**Top-Level Reference behavior:**
- First top-level item added gets `.01`
- Subsequent items get `.02`, `.03`, etc.
- Suffix is auto-generated, immutable, and assigned at the moment the item is
  added to the Draft
- If a top-level item is removed, its suffix is not reused — the next added
  item gets the next sequential suffix
- The Top-Level Reference is the user-facing identifier for filtering and
  display in downstream views — it lets a planner isolate one branch of a
  multi-deliverable project for interrogation

**Hard rule:** Top-Level Reference is immutable once assigned. Removing and
re-adding a top-level item does not preserve its original suffix.

### BOM Tree Preview

Below the Top-Level Items list, an expandable tree shows the full implied
WO tree for the current Draft. Each top-level item is the root of one branch.
The tree walks through the BOM hierarchy and shows:

- Every Part/Assembly that would generate a WO on compilation
- Effective quantity at each node (rolled up from parent quantity × BOM child quantity)
- A validation indicator on each node (Pass / Fail with reason)
- Total WO count summary at the top of the preview

**Tree behavior:**
- Default state: collapsed at the top-level item level
- Expandable per branch
- "Expand All / Collapse All" toggle available
- Validation indicators visible at every level

The tree preview is the planner's primary tool for sanity-checking the project
before compiling. Wrong selections, unexpected component counts, and validation
issues are visible here before the planner commits to compilation.

---

## Live Validation

The Editor performs live validation as the Draft is built and re-validates
when the Editor is opened. The validation status is visible in three places:

1. The Validation Indicator column on each top-level item
2. The Validation Indicator on each node in the BOM Tree Preview
3. A summary banner at the top of the Editor: "All checks passed — ready to
   compile" or "N validation issues — see details"

### Validation Failure Conditions

A node fails validation if any of these are true:

1. The Part has no Routing Template assigned
2. The Part's assigned Routing Template is inactive (retired)
3. The Part itself is inactive
4. A circular BOM reference is detected during tree walk (defensive check —
   Hard Rule 17 prevents creation of circular BOMs, but compilation defensively
   re-validates)

**MaterialSpec being null is NOT a validation failure.** Many Parts legitimately
have no material assigned (e.g., purchased finished components, assemblies),
and material is a purchasing-time concern.

### Validation Errors and Deep Links

When a node fails validation, the indicator shows a brief reason ("No template
assigned", "Template inactive: Welded Assembly", "Part inactive", "Circular
reference").

Each failure indicator is a link to the source of the problem:

- "No template assigned" → links to the Part Form for that Part, scrolled to
  the Routing Template section
- "Template inactive" → links to the Routing Template Editor with the inactive
  template selected
- "Part inactive" → links to the Part Form for that Part
- "Circular reference" → links to the BOM Editor for the parent Assembly where
  the cycle was detected

**Escalation workflow:**
The planner who created the Draft may not have permission or knowledge to
fix the underlying issue. They escalate by sharing the Draft (in person, via
chat, etc.) — another user with view access (Lead, Admin) opens the Draft from
the list, sees the failure indicators, and follows the deep links to fix the
upstream Part Master or Routing Template Editor records. Once fixed, the
Draft re-validates automatically when next opened.

---

## Compile

The Compile action is the all-or-nothing gate. It converts a Draft Project
into an Active Project with a generated Work Order tree.

### Compile Button States

| Condition | Button State | Behavior |
|-----------|--------------|----------|
| Required fields incomplete | Disabled | Tooltip indicates what's missing |
| Validation has failures | Enabled but warns on click | Click triggers final validation, shows errors, does not compile |
| All checks pass, validation green | Enabled | Click triggers compilation |

### Compilation Behavior

On Compile click:

1. Final validation runs on the current Draft state. This is the locked
   all-or-nothing gate — even if live validation showed all-clear, the system
   re-runs the full check at compile time to defend against race conditions
   (e.g., a Part deactivated between validation and compile).

2. **If any validation fails:** Compilation is cancelled. No WOs are created.
   An error screen lists every failure with deep links. The Draft remains in
   Draft state, fully editable.

3. **If all validations pass:** A single database transaction:
   - Project status: Draft → Active
   - Walk the BOM tree from each top-level item
   - Generate one WorkOrder per unique Part-in-BOM-row position. When a Part
     appears in multiple BOM positions, multiple WOs are generated, one per
     parent-child relationship. Each WO has a single `parentWoId` reflecting
     its specific position in the tree
   - **All generated WOs are created in `Unreleased` state.** This is the
     state that suppresses WOs from execution-lens visibility until Stock
     Fulfillment and Batching have processed them
   - Generate WorkOrderSteps for each WO as a snapshot from the assigned
     RoutingTemplate
   - Snapshot `routingTemplateDefinitionId` onto each WorkOrder for Rev 2
     flagging support
   - Apply Project-Level Priority (if set) to all generated WOs as their
     starting priority. If null, WOs have null priority
   - Set each top-level WO's `topLevelIndex` to match the Top-Level Reference
     suffix (.01, .02, etc.)
   - Write AuditLog entries for: Project state change, every WO creation,
     every WorkOrderStep creation
   - All steps initialize in `Waiting` state (note: step state is moot while
     the WO is `Unreleased` — execution lenses query WOStatus first)
   - Commit transaction

4. On successful compile: the user remains on the Project Creation View. A
   toast notification confirms success: "Project [Number] compiled successfully.
   N Work Orders generated." The compiled Project disappears from the Draft
   list (since it is now Active). The WIP project status view that surfaces
   Active Projects may be added to this same screen as a future enhancement.

**Hard rule:** Compilation is atomic. No partial WO trees are ever created.
If any step of the transaction fails, the entire transaction rolls back and
the Project remains in Draft state.

### WO Generation Details

For each top-level item with quantity Q:

- The top-level Part/Assembly itself becomes a WO with quantity Q,
  `parentWoId = null`, `topLevelIndex` set to the suffix value
- The system walks the BOM tree from this Part
- For each BOM row encountered:
  - Effective Quantity = parent WO quantity × BOM row quantity
  - One WO is generated for that Part with `quantity = Effective Quantity`,
    `parentWoId = parent WO's ID`
  - If that Part is itself an Assembly, the walk continues recursively
  - If a Part appears in multiple BOM positions in the same project (e.g.,
    a fastener used in three sub-assemblies), multiple WOs are generated —
    one per BOM row — each with its own parent linkage. These WOs are
    eligible to batch together in the Batching Lens by virtue of sharing
    PartID and identical routing

**Hard rule:** Effective quantity rolls up multiplicatively through the BOM
tree from the top-level item's quantity. WOs are not subdivided per top-level
instance — one WO per Part-in-BOM-row, with quantity = total effective demand.

---

### Compiled WO State and Lifecycle

WOs created by compilation enter the system in `Unreleased` state. This state
serves a specific purpose: it suppresses the WO from visibility in execution
lenses (Purchasing, Operations Lens) and from any view that queries for
in-execution work, while still making the WO available to planning views
(Stock Fulfillment, Batching Lens, Project View).

**Why this gate exists:**
Most execution lenses are naturally gated by step prerequisite logic — a
Receive step is `Waiting` until Purchase is `Complete`, a Machine step is
`Waiting` until Receive is `Complete`, and so on. The natural prerequisite
chain prevents downstream lenses from seeing premature work without an
explicit state.

But Purchasing is the *first* step on most routings, so there is no upstream
step to gate it. Without an explicit state, every WO would appear in the
Purchasing Lens the moment it was compiled, before any planning had occurred.
The Operations Lens has the same problem in aggregate. The `Unreleased`
state closes this gap explicitly.

**Lifecycle summary** (full detail in OQ-014 Stock Fulfillment and Batching
Lens specs):

```
Compile → Unreleased
   │
   ├── Stock Fulfillment chooses "Fulfill from Stock"
   │      └── All steps Skipped → WO Complete
   │
   └── Stock Fulfillment passes through → WO remains Unreleased
          └── Appears in Batching Lens
                 └── Batching release confirmed → WO becomes Open
                        └── Visible in execution lenses (gated by step prereqs)
                               └── Final step Complete → WO Complete
```

**Hard rules:**
- Compilation creates WOs in `Unreleased` state
- Release is one-way — once a WO transitions to `Open`, it does not return to `Unreleased`
- Stock Fulfillment is the only path from `Unreleased` directly to `Complete`
- All step state on an `Unreleased` WO is operationally moot — no execution lens queries it

---

## Compile Failure Screen

When Compile is triggered but validation fails:

**Header:** "Compilation cancelled — N validation issues must be resolved"

**Body:** Grouped list of failures. For each failure:
- The Part Number and Part Name
- The failure reason
- The deep link to the resolution location
- The path in the BOM tree where this Part was encountered (e.g.,
  "Top Level: 20137.01 → Sub-Assembly: BRACKET-100 → Part: FAST-M5-12")

**Footer:** "Return to Editor" button. Project remains in Draft state.

The screen is shareable in the sense that the Draft itself persists — another
user with view access can open it from the Draft list and see the same
failures with the same deep links.

---

## Editing a Draft

A Draft Project is fully editable until compiled.

**Editable:**
- All header fields
- Top-Level Items list (add, remove, change quantity)
- Notes

**Editing a Draft does not require any special action** — fields auto-save
as the planner works. The Last Edited By and Last Edited At fields update
automatically.

**Concurrent editing:** Any Manager or Admin can edit any Draft. Last-write-wins.
The Last Edited By field communicates who most recently touched the Draft.
This is acceptable in Rev 1 because realistic concurrency is near-zero.

---

## Deleting a Draft

Available to Manager and Admin only. Two-click pattern:

1. Click "Delete Draft" button in the Editor header (or row action in the list)
2. Confirmation modal: "Delete Draft Project [Number]? This cannot be undone."
   with [Delete] and [Cancel] buttons
3. On Delete confirm: Project record is hard-deleted. AuditLog entry is
   written for the deletion event with user, timestamp, and a snapshot of the
   Project metadata at deletion time

**Hard rule:** Drafts are hard-deleted on confirm. There is no "Discarded"
state — abandoned Drafts are removed entirely from the database. The AuditLog
preserves the trail of what existed and who deleted it.

---

## Active Project Summary

When an Active or Complete Project is opened from the list, the view shows the
Active Project Summary surface. This is the read-mostly counterpart to the
Draft Editor — it shows project-level state, supports project-level edits,
and provides the Archive action for Complete Projects.

**The Summary surface shows:**

**Header section (always visible):**
- Project Number (read-only — locked once compiled)
- Project Name (editable)
- Status (Active / Complete / Archived)
- Created date and creator (read-only)
- Compiled date (read-only — when the Project transitioned Draft → Active)
- Customer Name (editable, nullable)
- Due Date (editable — see Editing Project Due Date below)
- Notes (editable)

**Progress section:**
- Total WO count
- WO completion progress: count of Complete WOs / total WOs (e.g., "47/52")
- Visual progress indicator
- Top-Level Item summary: each top-level Assembly/Part with its own
  completion progress (e.g., "20137.01 Top Assembly Y: 18/22 components
  complete"). This is a derived rolled-up count, not an expandable BOM
  tree — drilldown into the BOM happens in Project View
- "Add Top-Level Item" action (Manager/Admin only) — see workflow below

**Quick navigation:**
- "Open in Project View" — link to Project View filtered to this Project
  for operational drilldown
- "View Audit History" — opens the audit log for this Project's lifecycle
  events (creation, compilation, metadata edits, additions, archival)

**Cannot be edited from this surface:**
- Project Number (unique identifier, locked)
- Existing Top-Level Items (top-level Reference suffixes immutable, and
  removal of existing items is Rev 2)
- Existing top-level Item quantities (locked once compiled — quantity edits
  on existing top-level Items are Rev 2)
- WO-level state, priority, sub-status, qty, or other operational fields
  (those are edited in Project View)

The Active Project Summary is read-mostly. The available edits are
Project-level metadata and adding new Top-Level Items. WO-level edits happen
in Project View. Operational state belongs in operational lenses.

---

## Editing Active Project Metadata

The following fields are editable on Active and Complete Projects (not on
Archived):

| Field | Behavior on edit |
|-------|------------------|
| Project Name | Direct field edit, autosaves on blur |
| Customer Name | Direct field edit, autosaves on blur |
| Notes | Direct field edit, autosaves on blur |
| Due Date | Cascades to all WOs — see below |

**All edits write AuditLog entries** capturing field, old value, new value,
user, and timestamp. Project Name, Customer Name, and Notes edits are
displayed in the project history but do not affect WO-level data.

### Editing Project Due Date

Project Due Date represents the date the Project is expected to deliver. Each
WO in the Project shares this Due Date — `WorkOrder.dueDate` denormalizes the
Project's Due Date for query efficiency.

**When Project Due Date changes:**
1. The Project's Due Date field updates
2. Every WO in the Project has its `dueDate` updated to the new value in the
   same atomic transaction
3. A single AuditLog entry is written: action type `ProjectDueDateChanged`,
   capturing old date, new date, count of WOs cascaded, user, timestamp

**Hard rule:** Project Due Date updates cascade to all WOs in a single atomic
transaction. The cascade produces one AuditLog entry, not one per WO.

**Note:** This is not an exception to Principle 10 (definition changes don't
cascade to WIP). Project Due Date is a *Project attribute*, and WO Due Date
is a denormalized reflection of that attribute, not a definition-layer field.
The cascade is the WOs catching up to the Project's new state, not a
definition change propagating into WIP.

**Confirmation:** The Due Date edit confirmation modal shows the count of WOs
that will be updated and asks for explicit confirmation. This is a substantial
operational change (potentially affecting due-date-driven sort and priority
across many views) and warrants explicit acknowledgment.

---

## Adding a Top-Level Item to an Active Project

Active Projects (not yet Complete or Archived) support adding new top-level
Items mid-flight. This handles the common case of a customer adding to their
order after the Project has been compiled and execution has begun.

**Why this is supported in Rev 1:**
The use case is genuine and common. Removing the option would force planners
to either archive the existing Project and start over (losing history and
context) or to create a separate Project for the addition (fragmenting the
customer's order across Projects). Both are worse than supporting in-place
addition.

**What is NOT supported in Rev 1:**
- Removing existing Top-Level Items from an Active Project
- Changing quantity on existing Top-Level Items
- Adding to Complete or Archived Projects
- Adding to Drafts (use the Draft Editor's standard top-level item selector)

These constraints exist because they raise structural questions (what
happens to existing in-progress WOs from the affected branches?) that are
out of Rev 1 scope. They are queued as Rev 2 features.

### Workflow

1. Manager opens the Active Project Summary
2. Clicks "Add Top-Level Item" action
3. Modal opens — searchable Part/Assembly selector identical to the Draft
   Editor's top-level item add control:
   - Search by Part Number or Part Name
   - Filtered to active Parts and Assemblies
   - Validation indicators visible if the selected item has known issues
   - Quantity input
4. Manager confirms the addition
5. Validation runs — same checks as initial compilation:
   - Selected Part has an active Routing Template
   - All descendants in the BOM tree have active Routing Templates
   - All descendants are active Parts
   - No circular BOM reference (defensive)
6. **If validation fails:** addition is cancelled. Error screen shows failures
   with deep links (same pattern as Draft compilation failure). Project is
   unchanged
7. **If validation passes:** atomic transaction:
   - Generate the new WO subtree from this top-level Item
   - All new WOs created in `Unreleased` state
   - All new WO steps created in `Waiting` state
   - New top-level WO gets the next available `topLevelIndex` (max existing +
     1; suffixes are not reused)
   - WO `dueDate` initialized from the Project's current Due Date
   - WO `priority` initialized from null (managers set per-WO priority in
     Project View)
   - AuditLog entry written: action type `ProjectTopLevelAdded`, capturing
     Project ID, new top-level Reference, new WO count, user, timestamp,
     and the snapshot of the addition
8. Toast confirms: "Added [Part Number] qty [N] to Project [Number] as
   [Top-Level Reference]. [N] new Work Orders generated. They are now in
   Stock Fulfillment."

### Visibility of Added WOs

The newly-generated WOs:
- Appear in **Stock Fulfillment** as candidates (where Stock ≥ Demand) or
  as non-candidates pending decision (where Stock < Demand)
- Are NOT visible in Batching Lens, Operations Lens, or execution lenses
  until released (transitioned from Unreleased to Open)
- Are visible in **Project View** under appropriate planning-state visual
  treatment, alongside the Project's existing WOs

The planner who handles Stock Fulfillment can choose to release the new
WOs immediately (along with any other decided WOs in their session) or
hold them for additional consideration.

**Hard rule:** Top-Level Item additions to an Active Project follow the same
compilation-validation rules as initial Project compilation. All-or-nothing —
invalid additions are blocked with deep-link errors, the Project is unchanged.

**Hard rule:** Top-Level Item additions are atomic — same transaction
guarantees as initial compilation. New WOs all enter Unreleased state,
all steps Waiting, ready for Stock Fulfillment evaluation.

**Hard rule:** Top-Level Index suffixes are sequentially assigned and
immutable. Adding `.03` doesn't shift `.01` or `.02`. The next available
suffix is computed from the maximum existing topLevelIndex on the Project
(plus one), even if earlier indexes were never assigned (e.g., if a Draft
had `.02` deleted before compilation, the post-compile Project has `.01`
and `.03` only, and the next addition becomes `.04`).

**Hard rule:** Active state archival of a Project does not affect the
ability to add Top-Level Items beforehand — but Archive is a one-way
transition, and added Items would themselves be archived if Archive
happens after the addition.

---

## Project Archive

Project Archive is the manager-driven action that retires a Project from
active operations. Archive applies to Active and Complete Projects.
Archived Projects are removed from default views but remain accessible as
read-only historical records.

**Why Active Project archival is supported:**
Real-world Projects sometimes die mid-execution — customer cancels, contract
falls through, business priorities shift. Forcing managers to fake-complete
remaining WOs to enable archival would corrupt the audit trail. Allowing
direct archival of incomplete Projects preserves the truthfulness of the
historical record.

**Eligibility:**
- **Complete Projects:** Archive available, standard confirmation
- **Active Projects:** Archive available, stronger confirmation that surfaces
  what's being abandoned (counts of incomplete WOs, blockers, etc.)
- **Draft Projects:** Archive not applicable. Drafts are deleted instead
- **Already-Archived Projects:** Archive not applicable

A Project becomes Complete automatically when every WO in the Project has
`status = Complete`. The Status transitions Active → Complete without
manual action.

### Archive Workflow

1. Manager opens an Active Project Summary
2. Clicks "Archive Project" action
3. Confirmation modal varies by Project Status:

   **For Complete Projects:**
   "Archive Project [Number]? This will remove the Project from active views.
   A read-only historical view will remain accessible." with [Archive] and
   [Cancel] buttons

   **For Active Projects:**
   "Archive Project [Number]? This Project has [N] WOs that are not Complete:
   [N1] Unreleased, [N2] Open, [N3] Blocked. Archiving will remove the Project
   from active views without completing remaining work. WO state and any open
   blockers will be preserved as a snapshot of the Project at archive time.
   This action cannot be undone." with [Archive] and [Cancel] buttons

4. On confirm:
   - Project Status: → Archived
   - Project disappears from default Project list (still accessible via
     Status filter set to "Archived")
   - Project becomes invisible in operational views (Project View, Operations
     Lens, execution lenses, Batching Lens, Stock Fulfillment all filter
     out Archived by default)
   - All WOs preserved in their pre-archive state — no automatic state
     transitions, no closing of blockers
   - The Project, all its WOs, and all associated state (steps, blockers,
     batch references, audit history, etc.) remain in
     the database in a read-only posture — no further edits are possible
   - AuditLog entry written: action type `ProjectArchived`, with user,
     timestamp, and a snapshot of WO state at archival (counts by status,
     open blocker count, etc.)

### Archived State — What's Preserved

Archive intentionally preserves the Project's state at the moment of
archival:
- WO statuses stay as-is (Unreleased, Open, Complete, Blocked all preserved)
- Open blockers stay open in the historical record (auto-resolving them
  would create a fake-clean audit trail)
- Step states preserved
- Batch memberships preserved (though no further batching activity is
  possible)
- All AuditLog history is retained

This is a snapshot, not a cleanup. Future users looking at the Archived
Project's historical view see exactly what the Project was when archival
happened — including unresolved exceptions. This is operationally honest.

### Read-Only Historical View

After archival, the Project Summary remains accessible via the list (when
Archived is shown via filter). Project View can be filtered to show
Archived Projects, displaying the BOM tree in its final state (whatever
state that was). This is the historical record — useful for retrospective
analysis, customer documentation, and dispute resolution.

**Hard rule:** Archived Projects are read-only. No state changes, metadata
edits, or operational actions are possible on Archived Projects. To modify
an Archived Project, an Admin would need to un-archive it (a Rev 2 feature
not specified here).

**Hard rule:** Archive is a one-way action in Rev 1. There is no "un-archive"
workflow. If a Project is archived in error, the manager files it as a
discrepancy and addresses it through documentation rather than reversal.

**Hard rule:** Archive of an Active Project does not modify any WO state.
WOs preserve their pre-archive state as a historical snapshot. Open
blockers are preserved as open in the historical record.

---

## Permissions Summary

**Draft actions:**

| Action | Operator | Lead | Manager | Admin |
|--------|----------|------|---------|-------|
| View Draft list | — | ✓ | ✓ | ✓ |
| View Draft contents | — | ✓ | ✓ | ✓ |
| Follow validation deep links | — | ✓ | ✓ | ✓ |
| Create new Draft | — | — | ✓ | ✓ |
| Edit Draft | — | — | ✓ | ✓ |
| Compile Draft | — | — | ✓ | ✓ |
| Delete Draft | — | — | ✓ | ✓ |

**Active / Complete Project actions:**

| Action | Operator | Lead | Manager | Admin |
|--------|----------|------|---------|-------|
| View Project list (all statuses) | — | ✓ | ✓ | ✓ |
| Open Active Project Summary | — | ✓ | ✓ | ✓ |
| Edit Project metadata (Name, Customer, Notes) | — | — | ✓ | ✓ |
| Edit Project Due Date (cascades to WOs) | — | — | ✓ | ✓ |
| Add Top-Level Item to Active Project | — | — | ✓ | ✓ |
| Archive Active Project | — | — | ✓ | ✓ |
| Archive Complete Project | — | — | ✓ | ✓ |
| View Archived Projects (read-only) | — | ✓ | ✓ | ✓ |

**Note on Lead role:** Lead access to Project information covers the
engineering escalation case for Drafts and visibility for Active and
Archived Projects. Lead does not have edit authority on Project metadata
or Project lifecycle actions. Permissions become a Rev 2 concern.

---

## Side Panel

The Project Editor uses inline editing rather than a side panel for most
operations. A side panel is used for:

- Detailed view of a specific top-level item's full BOM tree (alternative
  to the inline tree preview when the planner wants more detail)
- Validation failure details for a specific node
- AuditLog history for the Draft (Created, Edited timestamps and users)

---

## Schema Implications

This view requires the following schema additions, applied during Stage 6:

| Field | Type | Notes |
|-------|------|-------|
| `Project.status` | Enum extension | Add `Draft` value |
| `Project.creatorUserId` | FK to User | Required, set at Draft creation |
| `Project.lastEditedUserId` | FK to User | Required, updated on every edit |
| `Project.lastEditedAt` | DateTime | Required, updated on every edit |
| `WOStatus` | Enum revision | Add `Unreleased` value. The final enum is `Unreleased \| Open \| Complete \| Cancelled`. (`Cancelled` was initially removed in early Stage 6 then re-added during reconciliation pass for the Cancel primitive — see `definition_change_flag_spec.md`) |
| `WorkOrder.status` default | Default value change | New WOs default to `Unreleased` (was `Open`) |
| `WorkOrder.priority` | Int → Int? (nullable) | Was required — must become nullable to support null project-level priority |
| `WorkOrder.topLevelIndex` | Int? (nullable) | Suffix value (1, 2, 3...) for top-level WOs. Null for non-top-level WOs |
| `WorkOrder.dueDate` | Confirm denormalization strategy | Currently a separate field on WorkOrder; this view's Project Due Date cascade requires the field to be kept in sync with `Project.dueDate` on every WO. Stage 6 should confirm the denormalization is the right choice (vs. removing the field and joining through Project) |
| AuditLog action types | Enum or string convention | Add: `ProjectMetadataEdit` (Name/Customer/Notes), `ProjectDueDateChanged` (with cascade summary), `ProjectArchived` (with state snapshot — works for Active and Complete), `ProjectTopLevelAdded` (with new top-level reference and WO count) |

The `topLevelIndex` is stored as an integer, not as a string with the suffix
formatting. The display formatting (e.g., "20137.01") is computed as
`Project.projectNumber + "." + zero-padded WorkOrder.topLevelIndex` in the UI.

The `WorkOrder.dueDate` field is denormalized from `Project.dueDate`. The
cascade ensures the two stay in sync. This denormalization is for query
efficiency — many views display WO Due Date in lists and avoiding a Project
join on every WO read is meaningful at scale. The cascade rule means there
is no risk of drift between the two values during normal operation.

WOs created via Project Compilation or via Add Top-Level Item are
initialized in `Unreleased` state. They transition out of Unreleased
through Stock Fulfillment (either to Complete via Fulfill from Stock, or
to Open via Release of a Pass-Through). This view does not transition WO
state directly — that is Stock Fulfillment's responsibility.

---

## Hard Rules Introduced by This Spec

| # | Rule |
|---|------|
| PC-1 | Compilation is atomic — no partial WO trees ever created |
| PC-2 | Project transitions Draft → Active only through successful compilation |
| PC-3 | Once Active, a Project cannot return to Draft |
| PC-4 | Top-Level Reference suffix is immutable once assigned |
| PC-5 | Effective quantity rolls up multiplicatively through the BOM tree |
| PC-6 | When a Part appears in multiple BOM positions, multiple WOs are generated — one per BOM row |
| PC-7 | Drafts are hard-deleted on confirm — no Discarded state |
| PC-8 | All Manager/Admin users can edit any Draft — last-write-wins |
| PC-9 | Compile button performs final validation regardless of live validation state — defends against race conditions |
| PC-10 | Compilation creates WOs in `Unreleased` state — they are invisible to execution lenses until Stock Fulfillment and Batching release them |
| PC-11 | Release is one-way — once Stock Fulfillment Release sets `stockFulfillmentReviewedAt`, the marker is not cleared. The WO subsequently progresses through Batching Confirm, which transitions it from `Unreleased` to `Open`. The Open transition is also one-way |
| PC-12 | Project metadata edits (Name, Customer, Notes, Due Date) on Active or Complete Projects happen in this view, not in Project View or anywhere else |
| PC-13 | Project Due Date updates cascade to all WOs in a single atomic transaction with a single AuditLog entry capturing the cascade |
| PC-14 | Project Status transitions Active → Complete automatically when the last WO becomes Complete |
| PC-15 | Project Archive is a Manager/Admin action available on Active and Complete Projects. Archive on Active Projects requires confirmation that surfaces incomplete WO and blocker counts |
| PC-16 | Archived Projects are read-only — no state changes, metadata edits, or operational actions are possible |
| PC-17 | Archive is one-way in Rev 1 — there is no un-archive workflow |
| PC-18 | Archive of an Active Project does not modify WO state. WOs and open blockers preserve their pre-archive state as a historical snapshot |
| PC-19 | Top-Level Items can be added to Active Projects (not Complete or Archived). Removal of existing Top-Level Items and quantity edits on existing Top-Level Items are Rev 2 |
| PC-20 | Top-Level Item additions follow the same compilation-validation rules as initial Project compilation. Atomic transaction; new WOs created in Unreleased state |
| PC-21 | Top-Level Index suffixes are sequentially assigned and immutable. Next available suffix is computed from max existing topLevelIndex on the Project, plus one. Suffixes are never reused |

---

## Design Notes

- This view is dual-purpose by design. Drafts and Active Projects coexist
  in the same surface because they share Project-level concerns. Splitting
  them into separate views would force users to navigate when their mental
  model treats both as "Project workflow"

- The Draft Editor is the heaviest surface in the view — it's where
  compilation happens, the gate through which all production demand enters
  the system. The Active Project Summary is intentionally lighter — most
  Active Project state lives in operational lenses, not here

- The BOM Tree Preview (Draft Editor) is the most important UI element
  in this view. It is the planner's confidence-building tool — they see
  what's about to be generated before committing. Make it readable,
  expandable, and visually clear about validation state

- Validation errors should never be a dead end. Every failure has a deep
  link. The planner (or an escalated user) can always get from "this is
  broken" to "here's where I fix it" in one click

- Compilation is intentionally heavy — atomic transaction, full validation,
  audit logging. This view is the gate through which all production demand
  enters the system. Treat the gate with appropriate weight

- The persistent Draft state is what makes the escalation handoff work
  without blocking the planner's progress. A Draft can sit for hours or
  days while upstream issues are resolved. The system is patient with
  planning even though it is rigid about compilation

- The auto-save pattern on field changes is intentional — planners should
  never lose work to a forgotten save click, especially given that Drafts
  may sit while escalations are resolved

- The Active Project Summary is read-mostly because Project View handles
  the operational drilldown. This view's job is project-level metadata
  and lifecycle (creation, edits to project-shared attributes, archival).
  Keeping it focused prevents it from becoming a junk drawer of management
  actions that belong elsewhere

- Project Due Date cascade to all WOs is a deliberate design decision.
  The alternative (WO-level Due Dates that drift from Project Due Date)
  would break the meaningfulness of Due Date as an organizational signal.
  When the Project moves, all its WOs move with it

- Project Archive's read-only historical view matters for retrospective
  analysis, customer documentation, and dispute resolution. Don't treat
  Archive as deletion — treat it as transitioning to a stable historical
  posture

---

## Open Items for Reconciliation Pass

The following items in this spec touch other specs and should be reviewed
during the post-Stage-7 reconciliation pass:

**Locked-state and Unreleased introduction:**
- **Terminology Lock:** Update "Released (WO Queue Entry)" definition to
  reflect Unreleased as a stored state. Update "Waiting" definition to
  clarify that step states on Unreleased WOs are operationally moot.
  Add `Unreleased` as a defined term in Cluster 4
- **State Model (Object 2 — Work Order):** Add `Unreleased` state and the
  three transitions in/out of it (compile creates, Stock Fulfillment
  completes, Batching releases). Add corresponding Hard Rules
- **Purchasing Lens spec:** Add explicit visibility rule — only WOs with
  `WOStatus = Open` appear in this lens
- **Operations Lens spec:** Add explicit visibility rule — only WOs with
  `WOStatus = Open` appear in this lens
- **Batching Lens spec:** Add explicit language that confirming the draft
  transitions toggled-ON WOs from `Unreleased` to `Open`. Toggled-OFF WOs
  remain Unreleased in the lens for future planning sessions
- **Other execution lens specs (Receiving, Machining, Welding, Blackening,
  Assembly, Distribution):** Confirm that step prerequisite gating is
  sufficient and no explicit WOStatus filter is needed. Document the
  reasoning in the spec for clarity

**Project lifecycle and metadata:**
- **Project View (OQ-011, in progress):** Confirm Project View defers all
  Project-level metadata edits to this view (no inline metadata edits in
  Project View). Confirm Project View's "filtered to Archived" mode renders
  Archived Projects in read-only fashion
- **Schema:** Confirm `WorkOrder.dueDate` denormalization strategy in Stage 6.
  Decision pending: keep with cascade-on-Project-Due-Date-edit, vs. remove
  and join through Project. Spec assumes denormalization with cascade
- **AuditLog action types:** Add `ProjectMetadataEdit`,
  `ProjectDueDateChanged`, `ProjectArchived` to the canonical action type
  list during Stage 6

**Forward-looking:**
- **Project View (OQ-011):** Visualizes WOs in all states (Unreleased,
  Open, Complete) with clear differentiation. Filters Archived Projects
  out by default; supports filter-in for historical access
- **Batching Lens:** Confirm `topLevelIndex` is available as a filter dimension
- **Parts Master spec:** Deep link target for "no template assigned" and
  "Part inactive" failures — confirm anchor scrolling behavior
- **Routing Template Editor spec:** Deep link target for "template inactive"
  failures — confirm direct-load-by-template behavior

**Rev 2 backlog (out of scope here, captured for future):**
- Removing Top-Level Items from Active Projects
- Editing quantity on existing Top-Level Items of Active Projects
- Un-archive workflow
- Permission model that distinguishes Lead from Manager more granularly — Rev 2
