# Tirion — System Intent and Rules

## Purpose

Tirion is designed for small to mid-sized manufacturing operations transitioning
from spreadsheet-driven workflows toward more structured, scalable processes.

The system prioritizes:
- High-context visibility over rigid structure
- Flexibility in querying and interrogating data
- Supporting users at varying levels of operational maturity
- Enabling decision-making rather than enforcing rigid scheduling

This is NOT a scheduling or simulation system. It does not attempt to predict or
enforce exact execution order across processes. Instead, it reflects real-world
conditions and allows users to apply judgment through filtering, grouping, and
contextual views.

The system is built to:
- Represent actual execution flow
- Support batch-based manufacturing
- Allow controlled intervention when exceptions occur
- Maintain clarity even in imperfect or evolving processes

---

## Core Principles

**1. Planning and Execution are Separate**
Demand (what must be fulfilled) and Planned Quantity (what will be produced) are
distinct and must never be merged.

**2. Batch Integrity**
Batches are treated as single execution units:
- All members share the same routing state
- No partial states exist within a batch
- If divergence is required, the batch must be split

**3. No Partial Routing**
If work is moved backward in routing, all downstream steps are reset. No partial
completion is preserved.

**4. Global Priority**
Priority is global and represents overall importance, not per-process execution
order. It does not attempt to dictate exact timing at each station.

**5. Visibility Over Automation**
The system exposes real conditions rather than attempting to optimize or automate
decisions. Users define context through filters and views.

**6. Exception-Driven Workflow**
Normal flow is implicit. The system emphasizes exceptions such as blockers,
delays, and disruptions.

**7. Explicit Intervention**
All non-standard actions (resolving blockers, modifying batches, routing
adjustments) must be intentional, logged, and justified.

**8. Single Source of Truth per Entity**
- WO state is authoritative when unbatched
- Batch state is authoritative when batched
- No conflicting representations are allowed

**9. Composable Views**
Users can dynamically filter and group data to answer unanticipated questions
rather than relying solely on predefined views.

**10. Definition Changes Do Not Cascade to WIP**
When a definition-layer record is changed (Routing Template, Part definition,
BOM structure, Vendor, etc.), that change does not automatically propagate to
Work Orders that are already open and in progress.

- The change takes effect for all future Work Orders generated after the change.
- Existing open Work Orders continue under their original definition.
- The system creates persistent Definition Change Flag records on all affected
  open Work Orders (and on Production Batches when affected WOs are batched).
- A Manager or Admin resolves each flagged instance deliberately via Dismiss
  (accept drift) or Accept Change (apply the change to the affected entity).

The Definition Change Flag system is the mechanism by which this principle
surfaces deferred reconciliation decisions. The engineer making the change
acknowledges impact at edit time via a forced dialog; the people closer to
the affected work make resolution decisions later with full operational
context.

See `definition_change_flag_spec.md` for the full system specification.

This principle applies consistently across all definition-layer changes. The
question to always ask when building any edit feature: "Are there open Work
Orders that reference this record, and if so, what happens to them?" The
answer in Tirion is always: they continue unchanged, they receive a flag,
and a Manager makes a deliberate resolution decision.

---

## Key Rules

- Blockers require explicit creation and resolution workflows
- All blocker resolutions require a note
- Blockers apply at the batch level when batched
- Assembly blockers apply only to the assembly's own routing, not its children
- Batch splits are required to isolate issues within a batch
- Batch dissolves if only one member remains
- Reassignment between batches requires confirmation and state alignment
- Routing rollback resets all downstream steps
- All user actions and inputs are logged with context, timestamp, and user identity
- Filters define operational context; the system does not enforce a concept of
  "today" or a schedule

---

## Work Order and Routing Rules

**Entities:**
- WorkOrder — project-linked, one per part/assembly per project
- WorkOrderStep — ordered steps generated from RoutingTemplateDefinition at WO creation
- Part — definition layer; routing template referenced here
- BOM — defines assembly/component relationships; project-agnostic
- AuditLog — immutable record of all state changes

**Step Rules:**
- Steps are explicitly ordered (stepIndex, 1-based)
- A step is Ready only when all steps with a lower stepIndex on the same WO are Complete
- Ready state is derived by application logic — never set directly
- Rollback: marking a step not-complete resets all steps with a higher stepIndex to Waiting
- Maximum 10 steps per routing template

**Completion Rules:**
- WO completion is transactional — final step complete + WO status update happen together
- Completion requires recording CompletedQty and ScrapQty
- Scrap cannot satisfy demand — only CompletedQty counts toward fulfillment
- All completion events write to AuditLog in the same transaction

**Assembly Rules:**
- An Assembly WO step is Ready only when all child WOs are Complete up to the
  equivalent step dependency
- Assembly routing templates may not include Purchase or Receive steps
- Assembly blockers apply only to the assembly's own routing, not its children

**Routing Template Rules:**
- RoutingTemplateDefinition is the source of truth for part routing
- Parts reference a template; WorkOrderSteps are generated as a snapshot at WO creation
- Editing a template does not affect open Work Orders (Principle 10)
- Template changes require confirmation showing affected part count
- Template names must be unique and descriptive

---

## Operational Philosophy

The system answers operational questions through filtering and grouping rather than
predefined reports. Users interrogate the same dataset in different ways. Common
questions the system must be able to answer include:

- What remains to be done for a given project?
- What assemblies are closest to being ready to build?
- Which parts requiring a specific process are ready, and what others need to go
  with that load?
- What needs to be ordered, grouped by vendor and material?
- What is blocking production right now?
- What work has been completed in the past week?

These questions combine multiple attributes (process, material, project, status,
timing) in ways that cannot be fully anticipated. Filters allow users to ask new
combinations without requiring new development each time.
