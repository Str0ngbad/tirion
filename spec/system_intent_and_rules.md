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

---

## Operating Procedures — Hooks and Commit Patterns

This section documents established processes the consultant should follow. New
windows pick up these patterns from this document rather than rediscovering them
through trial and error.

### The two-agent framework

Two Claude windows operate during build sessions:

- **The consultant window** (this conversation) drafts prompts, reviews outputs,
  and provides design guidance. Does not execute commands or commit code directly.
- **The builder** (Claude Code in the user's terminal) executes the consultant's
  prompts and reports results. Operates the file system, runs verification scripts,
  makes commits, and triggers the hooks.

When the consultant drafts a prompt, the builder reads it, executes the work, and
reports back with commit hashes, test results, and any ambiguity encountered. The
consultant reviews and either confirms, drafts a follow-up, or addresses the
ambiguity.

A separate mockup window (the user's own, with Playwright MCP) runs alongside but
operates independently from the consultant. The consultant does not see mockup work
directly; the user surfaces mockup discoveries that need spec attention. The
consultant folds those discoveries into the spec corpus as separate focused commits.

### The hook system

Four Claude Code hooks fire on every git commit, configured in `.claude/settings.json`
and dispatched via `.claude/hooks/dispatch.sh`:

1. **update_manifest.sh** regenerates `project_manifest.md` (the file/function/API/query
   map). Lives at the repo root.

2. **update_tracker.sh** regenerates `project_tracker.md` (the phase-by-phase progress
   document). The tracker uses binary Done/Not Started status; it does not have an
   "In Progress" state. This is a known limitation tracked in `TESTS_BACKLOG.md` under
   Hook Issues / Tooling Debt.

3. **update_deviations.sh** auto-appends a stub to `DEVIATIONS.md` when the commit
   contains both `Deviates-From:` and `Deviation-Summary:` footer lines. Otherwise the
   hook exits silently. The stub has empty fields that need to be filled in by a
   follow-up commit.

4. **run_review.sh** spawns a sub-agent that reviews the just-committed changes against
   `CLAUDE.md` and the spec.

The hooks regenerate `project_manifest.md` and `project_tracker.md` as side effects of
every commit. These files do not need to be staged manually — the hooks handle them.

### The deviation footer pattern

When a commit changes something that diverges from previously-locked spec, include two
footer lines in the commit message:

```
Deviates-From: spec/some-spec.md (specific section)
Deviation-Summary: One-line summary that becomes the stub header
```

After the commit, `update_deviations.sh` auto-appends a stub to `DEVIATIONS.md`. The
next commit fills in the stub with:

- Phase (1A, 1B, etc.)
- Discovered by (User, Claude Code, Consultant, during what work)
- What the spec said (the original spec state)
- What was discovered (the design decisions or operational realities that prompted the
  change)
- Resolution (what changed in which files)
- Files affected (the list)

The stub-fill commit message follows the form:
`docs(deviations): fill in stub for <topic>`

Not every commit needs deviation footers. They apply when:
- A previously-locked spec section is being modified
- A discovery during build necessitates divergence from spec
- A scope refinement folds back into the spec corpus

They do NOT apply when:
- Building features per spec without deviation
- Cleaning up code, fixing typos, or routine refactoring
- Filling in stubs (the stub-fill commit itself doesn't need new footers)

### Commitlint footer line length

The `Deviation-Summary` footer is parsed by commitlint as a body line. The underlying
`conventional-commits-parser` only recognizes a fixed list of footer tokens (primarily
`BREAKING CHANGE`); custom tokens like `Deviates-From` and `Deviation-Summary` parse as
body content despite their semantic role.

To accommodate full summaries without forced truncation, the `body-max-line-length` limit
is set to 200 characters in `commitlint.config.js`. Stay under 200; longer summaries need
manual truncation while preserving the essential meaning.

This was identified and resolved during Phase 1A work. The details and root cause are in
`DEVIATIONS.md`.

### Backlog hygiene

`TESTS_BACKLOG.md` tracks deferred work in four categories:

- **Hook Issues / Tooling Debt** — operational debt in the build automation
- **Spec Consistency** — drift between spec files or missing cross-references
- **Follow-up Implementation** — work explicitly deferred to a later phase
- **Operational Patterns** — observed patterns about how the build environment behaves

When an entry is resolved, remove it from the backlog as its own focused commit. The
commit message form:

```
chore(backlog): remove resolved <entry name> entry
```

This keeps the backlog focused on actually-outstanding work rather than mixing past and
present.

### Commit cadence

Small, focused commits are preferred over large bundled ones. Examples of focused commits
from established patterns:

- Entity backend work follows a three-commit pattern: errors → service+schemas+types+
  verification → routes. Each runs through type-check and verification before committing.
- Spec arc work follows a one-section-per-commit pattern. Each section gets its own
  commit, then a deviation stub fill commit if footers were included.
- Refactor work that touches multiple files for the same purpose lands as one commit
  (e.g., applying the same fix across multiple service files).
- Removal of resolved backlog entries lands as its own commit separate from the work
  that resolved them.

Commits with deviation footers follow the two-step pattern: the main commit lands, the
hook generates the stub, the next commit fills the stub.

### Verification scripts

Service-layer verification lives in `/scripts/verify-<entity>-service.ts`. Each script
tests its entity's full CRUD lifecycle with realistic test data and explicit cleanup in
a `try/finally`.

These are NOT Vitest tests — they are imperative end-to-end scripts run via `npx tsx`.
The trade-off: faster to author than full test suites, less ceremony, and they exercise
the actual service against a real database. The cost is they're not part of an automated
CI run; they're invoked manually during development and as regression checks before
commits.

When changing infrastructure that affects multiple services (the P2002 helper, the
`mutateWithAudit` pattern, etc.), run the verification scripts for all affected services
as part of the verification step. The pattern from Phase 1A backend work:

```bash
npx tsx scripts/verify-vendor-service.ts
npx tsx scripts/verify-procurement-category-service.ts
npx tsx scripts/verify-material-spec-service.ts
npx tsx scripts/verify-user-service.ts
npx tsx scripts/verify-process-type-sub-status-service.ts
```

Add the script for the entity being built; run the existing scripts as regression checks.
