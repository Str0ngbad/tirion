# Tirion — Assembly Lens Spec

## Purpose

The Assembly Lens is a process execution view focused on the assembly operation.
It provides a build queue for assemblers showing which assemblies are ready to build,
which are waiting on components, and which are in progress.

---

## Primary Questions Answered

- What assemblies are ready to build right now?
- What assemblies are currently being worked on?
- What assemblies are waiting on components, and how close are they?
- How many assemblies remain to be produced?

---

## Visibility Rules

A Production Row appears in the Assembly Lens when ALL of the following
are true:
- WOStatus = `Open`
- WO's `partType = Assembly`
- Active routing step has `processType = Assemble`
- Active step state is not Complete and not Skipped
- Parent Project is Active (not Archived)
- WO is not Cancelled

A Production Row leaves this lens when:
- The Assemble step is marked Complete (advances to next step or completes WO), OR
- The Assemble step is Skipped (cascade-skip from upstream Fulfill from Stock —
  handled in Stock Fulfillment, not here), OR
- The WO is Cancelled (terminal state — excluded from operational visibility)

Cancelled WOs are excluded from this lens entirely.

---

## Row Model

Each row represents an Assembly Work Order at the Assembly process step.

**Component readiness is derived:**
`Components Ready = COUNT of child WOs where status = Complete / COUNT of
child WOs where status != Cancelled`.

Cancelled child WOs are excluded from BOTH numerator and denominator. An
Assembly with 5 children where 1 is Cancelled effectively has 4 children
for readiness calculation purposes — if 4 are Complete and 1 is Cancelled,
readiness shows as "4/4" (Ready), not "4/5".

---

## Grid Columns

| Column | Notes |
|--------|-------|
| Assembly Number | Part Number of the assembly |
| Assembly Name | |
| Components Ready | e.g. "11/15" — derived from child WO completion |
| Explode View | Row expansion control to show child WOs |
| Assembly State | Current execution state |
| Assembly Sub-State | Operator context (free text) |
| Project Quantity | Demand for this WO |
| Cumulative Quantity | Total demand across all WOs with this assembly ID |
| Project ID | |
| Due Date | |
| Priority | Global WO priority |
| Indicators | Row Indicators per `terminology_lock.md` Cluster 9: Red Flag (Blocker), Yellow Flag (Definition Change Flag). White Flag (Supply Order Exception) does NOT apply in this lens. Display order: Red → Yellow. See Definition Change Flag Handling below for Yellow Flag specifics |

---

## Assembly State Model

| State | Meaning |
|-------|---------|
| Waiting Components | Child WOs not yet complete |
| Ready | All required components complete; assembly can begin |
| Started | Assembly in progress |
| Complete | Assembly finished; quantity recorded |
| Blocked | Cannot proceed — blocker created |

**Ready derivation:** An assembly WO's Assembly step is Ready when all
non-Cancelled child WOs are Complete. This is computed by application logic,
not set manually. Cancelled children are excluded from the readiness
calculation.

---

## Row Expansion

Assembly rows can be expanded to show their component Work Orders.

Default expansion state: **show incomplete components only** (reduces visual noise —
complete components are not operationally relevant to the assembler).

Toggle available to show all components including complete ones.

Expanded child rows show:
- Part Number, Part Name
- WO State (with visual indicator)
- Quantity
- Project ID

Child rows are read-only in this view — execution of child WOs happens in
their respective process lenses.

---

## Grouping and Sorting

Default sort: **Readiness first (Ready before Waiting), then Priority, then Due Date**

Assemblers should see their actionable work at the top. Waiting assemblies are
visible but de-emphasized.

---

## Completion Dialog

When marking an Assembly step Complete:
- **Quantity Completed** (required)
- **Quantity Scrapped** (required — 0 if none)

Same rules as all process lenses: CompletedQty must meet or exceed demand.
Scrap cannot satisfy demand.

---

## Assembler Review Flag (Distinct from Definition Change Flag)

Assemblers can flag an assembly for later engineering or management review.
This is the existing "Flag for Review" mechanism — a feedback mechanism for
assemblers to surface real-world issues encountered during assembly. It is
**distinct from** the system-wide Definition Change Flag introduced via the
Definition Change Flag spec.

- Does not block production
- Does not change state
- Creates a flag record with required note (note required so the flag carries
  context for whoever reviews it)
- Serves as a feedback mechanism for real-world assembly issues
  (interference fits, unclear drawings, missing callouts, etc.)

This is an Assembler-initiated flag. The Definition Change Flag (yellow flag
indicator on rows) is a separate mechanism — system-created when a definition
edit affects this WO. See Definition Change Flag Handling below.

### Cross-View Visibility (Rev 1)

To support manager-level review without a dedicated review queue surface,
the Assembler Review Flag is visible across management views:

- **Project View grid:** Assembler Review Flag indicator (icon) on rows where
  an open flag exists
- **Operations Lens grid:** same indicator
- **Filter:** "WOs with open Assembler Review Flags" filter available in both
  Project View and Operations Lens; default off. Surfaces all flagged WOs in
  the user's normal management workflow

This combination — indicator + filter — provides Rev 1 management with the
visibility they need to find and review flagged assemblies without requiring
a separate queue surface. The manager reviews the flag in context (the row
where it lives, with all surrounding context visible), then resolves the
flag via the Detail Panel's Process-Specific Section action.

### Resolution

A Manager or Admin can resolve an Assembler Review Flag from the Process-
Specific Section of the Detail Panel for an Assembly WO with an open flag.
Resolution requires:
- Resolution note (required — captures what was reviewed and what was
  decided)
- The flag is marked Resolved with `resolvedAt`, `resolvedByUserId`,
  `resolutionNote`
- AuditLog entry written

A flag can be resolved while the assembly is still in progress, after the
assembly is Complete, or at any other state. Resolution is independent of
the WO's lifecycle.

### Process-Level Archival Convention (Unenforced in Rev 1)

The intended workflow is for managers to review all open Assembler Review
Flags before archiving a project. Rev 1 does not enforce this — projects
can be archived with open flags. The convention is process-level (manager
discipline), and the indicator + filter make it easy to check before
archival.

The system-enforced precondition check is deferred to Rev 2 (see Rev 2
Wishlist).

---

## Definition Change Flag Handling

Per the Definition Change Flag system (see `definition_change_flag_spec.md`),
when a Part, BOM, or Routing Template definition is edited and the change
affects open WOs, those WOs receive yellow flag indicators visible in this
lens.

For Assembly WOs specifically, two scenarios are common:

**Component Added flags (on this Assembly):**
When a BOM change adds a new child component to this assembly's BOM, this
Assembly WO is flagged. Resolution by Manager/Admin can either Dismiss
(accept the as-built state without the new component) or Accept Change
(generate the new child WO subtree under this Assembly). If Accept Change
is chosen and this Assembly is past Waiting (Ready, Started, or Complete),
an automatic Blocker is created on this Assembly per the auto-blocker
rules in `blocker_spec.md`.

**Component Removed flags (on child WOs):**
When a BOM change removes a child component, the child WOs are flagged
(not this Assembly directly). The child WO flags are resolved separately
via the Cancel primitive. If a child WO is Cancelled, this Assembly's
readiness math automatically updates (denominator decrements; if the
remaining children are Complete, Ready state is achieved).

Assemblers seeing the yellow indicator should escalate to a Manager —
they cannot resolve flags themselves but should know not to proceed without
checking that the change has been resolved.

---

## Side Panel — Process-Specific Section

The shared Detail Panel structure (per `detail_panel_spec.md`) handles
Header, Status, Routing Detail, Dependency Context (component readiness
fraction, all children grouped by state), Batch Context, Pending Definition
Changes, Blocker Section, WO-level Notes, and Actions.

This lens's Process-Specific Section content (rendered between Routing Detail
and Dependency Context per the shared structure):

| Field | Editability | Notes |
|-------|-------------|-------|
| Components Status (non-complete only) | Read-only | List of child WOs that are not yet Complete. Live derivation from child WO states. Cancelled children excluded. Complete children visible in shared Dependency Context section, not duplicated here |
| Process Sub-Status | Editable per step state and permission | Per ProcessTypeSubStatus seed |
| Engineering Notes | Read-only | From routing template snapshot |
| Process Notes | Editable, append-only | Free text; timestamped and attributed; newest at top. Scoped to the Assembly step |
| Assembler Review Flag | Action button + note field | Distinct from Definition Change Flag — see Assembler Review Flag section below |

**Assembly Instructions (sub-step sequence and notes):** dropped from Rev 1.
Added to Rev 2 wishlist — see Rev 2 Wishlist section.

### Components Status — Display Approach

The Components Status field shows only non-complete child WOs (Waiting,
Ready, Started, Blocked) with their current state. This is a focused view
answering the assembler's primary question: "what am I waiting on?"

Complete components are visible in the shared Dependency Context section
(item 5 in the Detail Panel structure), where all children are grouped by
state. The Process-Specific Section avoids duplicating that fuller view —
it's an action-oriented filter, not a comprehensive listing.

If the assembler needs to see complete components (e.g., to verify
something was produced correctly), they reference the Dependency Context
section or use Project View's row explode pattern.

---

## Design Notes

- The Components Ready indicator (e.g., "11/15") is the most important column
  for assemblers scanning the queue. Make it visually prominent.
- Assemblies waiting on one or two remaining components should feel close —
  consider a visual progress indicator (e.g., a small bar or color shift as
  the ratio approaches 100%).
- The explode view should default to collapsed in the grid — expand on demand.
  Showing all child rows by default would make the grid unreadable for complex
  assemblies.
- Assembly blockers apply only to the assembly's own routing steps, not to
  child WOs. A blocked assembly does not block its children from being worked.

---

## Rev 2 Wishlist

Items deferred from Rev 1 that should be considered for future revisions:

- **Assembly Instructions (Sub-Step Sequence + Notes):** dropped from Rev 1
  scope. Free-text per-assembly instructions covering internal assembly
  sub-steps. Useful for complex assemblies where the routing template
  doesn't capture sufficient detail and assemblers benefit from structured
  guidance. Editable by Lead+ roles when added.
- **Assembler Review Flag — Dedicated Review Queue Surface:** Rev 1 uses
  the indicator + filter pattern in management views. Rev 2 could add a
  dedicated review queue surface for managers who prefer a focused review
  workflow.
- **Project Archival Precondition Check:** Rev 2 enforcement that all open
  Assembler Review Flags must be resolved before a project can be archived.
  Rev 1 leaves this as process-level discipline (unenforced).
