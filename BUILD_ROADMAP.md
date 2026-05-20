# Tirion — Build Roadmap

This document defines the phased build plan for Tirion Rev 1. Phases are
sequenced by dependency and value. Each phase has lightweight exit criteria.

The roadmap is a guide, not a contract. As discoveries are made during the
build, this roadmap may be updated. Update DEVIATIONS.md when phase scope
shifts.

**Target build duration:** 1-2 weeks.

---

## Operating Principles

- **Don't build ahead.** Earlier phases establish patterns later phases follow.
  If you find yourself touching a later phase, stop and ask.
- **Ship per phase.** Each phase ends with something demonstrable. Don't
  combine phases into a single multi-week chunk.
- **Real data early.** Phase 1B exists specifically so that all subsequent
  phase work can be done with realistic data, not synthetic seed data.
- **Test what matters.** Per the testing approach in CLAUDE.md, focus on
  business logic and transactions. Add to TESTS_BACKLOG.md when deferring.

---

## Phase 0 — Scaffolding

Set up the project skeleton. Nothing user-facing yet.

**Tasks:**
- Initialize Next.js 14+ project with TypeScript strict mode
- Set up Tailwind CSS and shadcn/ui base configuration
- Set up Prisma with PostgreSQL connection
- Apply the `schema.prisma` from `spec/schema.md`
- Run initial migration
- Set up `/lib`, `/components`, `/app/api`, `/spec` directory structure
- Configure path aliases in `tsconfig.json`
- Set up Vitest with sample test
- Set up separate test database (Docker container or schema isolation) so
  Vitest tests run against a real database without polluting dev data
- Set up Conventional Commits enforcement (commitlint, optional but recommended)
- Set up `.env.example` and local environment
- Set up Docker Compose for local PostgreSQL
- Initial deployment to Vercel + connect Neon database
- **Observability setup:**
  - Install structured logging library (Pino recommended for Next.js
    compatibility and performance)
  - Configure log levels (debug for dev, info for production by default)
  - Install and configure Sentry for error tracking
    - Sentry account creation
    - DSN added to environment variables
    - Sentry initialization in Next.js (per their Next.js setup guide)
    - Test that errors are captured in dev (deliberately throw a test error)
- **Repository hygiene:**
  - `.gitignore` complete (Next.js, Prisma, env, .claude/settings.local.json)
  - `.env.example` populated with all required variables
  - `README.md` with one-paragraph description, tech stack, quick-start link
  - LICENSE file (per project license decision — see CLAUDE.md or project owner)

**Exit criteria:**
- `npm run dev` starts a working Next.js app
- `npx prisma migrate dev` runs cleanly against the local database
- One sample API route works (`/api/v1/health` returning `{ ok: true }`)
- Vercel deployment succeeds with the database connected
- One sample Vitest test passes against the test database
- Logging output is structured (JSON or Pino's pretty-print in dev)
- Test error appears in Sentry dashboard
- README.md exists and is accurate

---

## Phase 0a — Tooling and Hooks Setup

Set up Claude Code hooks and project maintenance automation before substantive
build begins. This phase is dedicated to disciplined tooling — the difference
between "vibe coding" and a maintainable build over the 1-2 week Rev 1.

Estimated effort: half day to full day.

This phase exists because Claude Code without disciplined automation tends to
produce inconsistent code, lose track of decisions, and create maintenance debt
that compounds. The hooks established here are deterministic (they fire
regardless of what Claude "decides") and run on every commit.

**Reference:** Conversation screenshots from Leith Wojas (recommendations on
hook-based discipline) should be supplied to the build-phase consultant during
this setup. The consultant will translate the recommendations into actual
Claude Code hook configuration.

**Deliverables:**

1. **`.claude/settings.json`** — project-level hook configuration committed to
   the repo. Configures the four core hooks below.

2. **`.claude/hooks/` directory** — supporting scripts called by the hooks
   (e.g., `update_manifest.sh`, `update_tracker.sh`, `run_review.sh`). Scripts
   committed to the repo so the team shares the same tooling.

3. **`.claude/agents/` directory** — sub-agent system prompts (at minimum, a
   code reviewer agent for the self-review hook).

4. **`project_manifest.md`** — auto-generated map of every meaningful file,
   function, API call, and database query in the project. Updated by hook on
   every commit. Lives at the repo root so Claude Code can read it instead of
   re-scanning the entire repository for context.

5. **`project_tracker.md`** — auto-generated live progress document showing
   what's been built versus what's still in spec. Updated by hook on every
   commit. Lives at the repo root.

6. **CLAUDE.md update** — brief section describing the hook system and what
   each hook does, so Claude Code (and human reviewers) understand the
   tooling at a glance.

7. **Initial ADRs (ADR-001 through ADR-010)** in `/docs/adr/` — capturing
   the architectural decisions already made in the spec corpus and CLAUDE.md.
   See CLAUDE.md "Architecture Decision Records" section for the list and
   format. The build-phase consultant drafts these by drawing rationale from
   the spec corpus, CLAUDE.md, and the State of Spec Brief.

**The four core hooks (per Leith's recommendations):**

| Hook | Lifecycle Event | Purpose |
|------|----------------|---------|
| Update project_manifest.md | PostToolUse on git commit | Re-generate the file/function/API/query map after each commit |
| Update project_tracker.md | PostToolUse on git commit | Re-generate the spec-versus-built progress document |
| Update DEVIATIONS.md | PostToolUse on git commit | Detect deviations from spec made during the commit; append to DEVIATIONS.md as a changelog entry |
| Self-review code review | PostToolUse on git commit | Spawn a sub-agent to review the just-committed changes for quality, consistency with the spec, and adherence to CLAUDE.md principles |

**Setup approach:**

The build-phase consultant should generate the configuration interactively
based on the screenshots and this roadmap section. Use the `/hooks` command
inside Claude Code or have the consultant generate the JSON directly.

**Exit criteria:**

- `.claude/settings.json` exists and is committed
- All four hooks fire successfully on a test commit
- `project_manifest.md` and `project_tracker.md` are generated and contain
  meaningful content
- DEVIATIONS.md auto-update fires (even if the test commit produces no
  deviations to log)
- Self-review code review hook produces a review on the test commit
- CLAUDE.md updated to document the hook system
- `/hooks` command in Claude Code shows all four hooks configured
- ADR-001 through ADR-010 exist in `/docs/adr/` with complete content per
  CLAUDE.md's ADR template

**Notes on iteration:**

First versions of hooks will need refinement once you see how they behave on
real commits. Don't try to perfect them in this phase — get them all working
end-to-end, then refine in early Phase 1 as you encounter friction.

The 10-minute default timeout per hook is configurable. The self-review hook
in particular may need a longer timeout (sub-agent execution can take several
minutes on substantial commits).

If a hook becomes a problem during a specific phase of work (e.g., the
manifest update is too slow during a refactor with many small commits), it
can be temporarily disabled via `.claude/settings.local.json` (your personal
override, not committed) without affecting the project-level configuration.

---

## Phase 1 — Configuration Foundation

Build the definition layer — the data foundation everything else depends on.

This is a substantial phase. Break into sub-phases.

### Phase 1A — Lookup Tables and Users

Build the configuration management surfaces per
`spec/configuration_management_spec.md`. Includes lookup tables, users,
and the in-context creation pattern from the Part Form (Pattern B).

**Tasks:**
- ProcessType seed data (Purchase, Receive, Machine, Weld, Blacken, Paint,
  3D Print, Assemble, Distribution per `seed_data_spec.md`). View-only
  surface in Rev 1 — no add/edit/deactivate. Inspect and Finish are NOT
  Rev 1 ProcessTypes
- ProcessTypeSubStatus CRUD + seed data per `seed_data_spec.md`
  (Purchase, Receive, Machine, Assemble seed lists; Weld, Blacken, Paint,
  3D Print, Distribution have no seed sub-statuses)
- AuditAction lookup table + seed data (per `spec/seed_data_spec.md` —
  consolidates all seed data into one reference; includes ProcessTypes,
  ProcessTypeSubStatus, AuditAction, bootstrap admin user)
- Vendor CRUD with dedicated surface AND in-context creation from Part Form
- MaterialSpec CRUD with dedicated surface AND in-context creation from Part Form
- User CRUD (basic — manual user selection in Rev 1, no auth enforcement;
  Admin lockout prevention enforced)
- Soft-delete (`isActive`) for all five tables
- Reference-count display on Vendor and MaterialSpec records (count of active
  Parts referencing this record)
- Deactivation blockers per Configuration Management spec (cannot deactivate
  Vendor/MaterialSpec while referenced by active Parts)

**Exit criteria:**
- All lookup tables seeded per Configuration Management spec
- Admin can create/edit/deactivate users, vendors, material specs
- Manager can create/edit/deactivate vendors and material specs (not users
  or process configuration)
- Process types are seeded but not editable (locked in Rev 1)
- Sub-statuses are configurable per ProcessType
- In-context creation modals work from Part Form for Vendor and MaterialSpec
  (Routing Templates are NOT in-context — created/edited via dedicated
  Routing Template Editor surface, per `routing_template_editor_spec.md`)
- All configuration changes logged to AuditLog
- Admin lockout prevention works (cannot demote/deactivate self if only Admin)

### Phase 1B — Parts Master

Build the Parts Master view per `spec/parts_master_spec.md`.

**Tasks:**
- Part CRUD with all fields (partType, defaultVendor, materialSpec, routingTemplate FK, etc.)
- Parts Master grid view with sort, filter, search
- Part detail form
- Stock count inline editing with audit trail
- Part deactivation (soft delete)

**Exit criteria:**
- Can create/view/edit/deactivate Parts and Assemblies
- Parts Master grid matches spec — sort/filter/search work
- Stock count edits write to AuditLog

### Phase 1C — Routing Template Editor

Build per `spec/routing_template_editor_spec.md`.

**Tasks:**
- RoutingTemplateDefinition CRUD
- RoutingTemplateStep editing (add, remove, reorder)
- Validation: max 10 steps, contiguous 1-based indexing
- Validation: Assembly templates can't include Purchase or Receive steps
- Template assignment to Parts (via Part edit)

**Exit criteria:**
- Can create/edit/deactivate routing templates
- Step ordering works
- Validation rules enforced
- Parts can reference templates

### Phase 1D — BOM Editor

Build per `spec/bom_editor_spec.md`.

**Tasks:**
- BOM CRUD (parent/child relationships)
- BOM tree visualization
- displayOrder editing
- Validation: parent must be Assembly, no circular references, no duplicate child under same parent
- Quantity editing

**Exit criteria:**
- Can build BOM trees of arbitrary depth
- Validation rules enforced
- Tree visualization matches spec
- BOM edits write to AuditLog

---

## Phase 2 — Spreadsheet Import

Build the import path so real data can drive subsequent phases.

This is positioned early per OQ-009 and the user's explicit request — real
data exposes UX issues that synthetic data hides.

**Tasks:**
- Import endpoint that accepts a structured spreadsheet (CSV or Excel)
- Validation logic that surfaces errors before commit
- Atomic import — all-or-nothing
- Specifically supports importing: Parts, MaterialSpecs, Vendors, BOM rows,
  Routing Templates and steps
- Dry-run mode to preview changes before applying
- AuditLog entries for imported records

**Exit criteria:**
- User can import their old shop's dataset successfully
- Import errors are surfaced clearly
- Imported data is fully usable in Phase 1 views (Parts Master, BOM Editor, etc.)
- Roll-back is possible if import was wrong (manual via DB or via "delete imported batch" feature — TBD with user)

---

## Phase 3 — Project Creation: Drafts and Compilation

Build the Drafts portion of `spec/project_creation_view_spec.md`. Active
Project Summary is deferred to Phase 8.

**Tasks:**
- Project CRUD (Draft state)
- Draft Editor: header, top-level items list with add/remove
- Live validation per spec
- Compilation: atomic transaction generating WO tree from BOM
- WO generation rules per spec (one WO per BOM position, topLevelIndex, snapshot routingTemplateDefinitionId)
- WorkOrderStep generation from routing templates
- Compile failure screen with deep links
- Draft list view
- Draft hard-deletion

**Exit criteria:**
- User can create a Draft Project end-to-end
- Compilation generates correct WO tree (verified against test cases)
- Validation failures are surfaced with deep links
- All Draft → Active transitions write appropriate AuditLog entries
- Compiled WOs are in Unreleased state

---

## Phase 4 — Stock Fulfillment

Build per `spec/stock_fulfillment_view_spec.md`.

**Tasks:**
- Candidate query (Stock ≥ Demand, WOStatus = Unreleased, etc.)
- Project Header section with counts
- Candidate list with BOM-order display
- Three actions: Fulfill from Stock, Pass Through, Reconcile Stock
- Defensive descendant-then-ancestor rule
- Assembly cascade-skip on fulfillment
- Auto-pass-through on stock depletion mid-session
- Inline context expansion for cross-Project competition
- Release button (global + per-Project)
- All AuditLog action types per spec

**Exit criteria:**
- Workflow works end-to-end: candidate → decision → release
- Cascades work correctly (verified by integration test)
- Defensive rules prevent the conflict cases per spec
- Release transitions Unreleased → Open atomically with single aggregate AuditLog entry

---

## Phase 5 — Batching Lens

Build per `spec/batching_lens_spec.md`.

**Tasks:**
- Batching candidate query (released WOs eligible for batching)
- Batch Editor surface (per `spec/batch_editor_spec.md`)
- ProductionBatch CRUD with member management
- Batch derivation rules (priority, dueDate, totalQuantity)
- WO Split workflow

**Exit criteria:**
- Batches can be created from eligible WOs
- Batch member changes correctly re-derive batch fields
- WO Split correctly divides WO with audit trail
- Batches enter execution lenses correctly

---

## Phase 6 — Execution Lenses

Build the configurable execution lens pattern, then build all process-specific
lenses.

This phase produces multiple deliverables but they share infrastructure.

### Phase 6A — Lens Infrastructure

Build the configurable lens component that all execution lenses share.

**Tasks:**
- Shared lens component supporting filter/sort/anchor patterns
- Shared row components (WO row, Batch row)
- Shared side panel (per `spec/detail_panel_spec.md`)
- Shared confirmation+note modal for state changes
- Shared inline edit patterns (Priority, sub-status, etc.)
- Shared anchor view layout per `spec/anchor_filter_spec.md`

**Exit criteria:**
- One reference lens (e.g., Machining) is fully built using the infrastructure
- Side panel renders WO context correctly
- State change modal works correctly with AuditLog writes

### Phase 6B — Per-Process Lenses

Build the remaining lenses using the shared infrastructure.

**Tasks:**
- Purchasing Lens per `spec/purchasing_lens_spec.md`
- Receiving Lens per `spec/receiving_lens_spec.md`
- Machining Lens (or refine the reference lens from 6A) per `spec/machining_lens_spec.md`
- Assembly Lens per `spec/assembly_lens_spec.md`
- Distribution Lens per `spec/distribution_lens_spec.md`
- SupplyOrder + SupplyOrderLine + SupplyOrderLineAllocation workflow (Purchasing/Receiving)

**Exit criteria:**
- All execution lenses are functional
- Step state transitions work correctly across lenses
- Purchasing → Receiving → execution flow is end-to-end functional

---

## Phase 7 — Operations Lens

Build per `spec/operations_lens_spec.md`.

This is process-organized rather than project-organized. Sorts include
Readiness Deficiency.

**Tasks:**
- Operations Lens grid
- Process-organized view
- Readiness Deficiency sort
- Cross-process visibility filters
- Reuses lens infrastructure from Phase 6

**Exit criteria:**
- Operations Lens shows current shop state across all processes
- Filters and sorts match spec
- Performance acceptable with realistic data volume

---

## Phase 8 — Project View + Active Project Management

Build per `spec/project_view_spec.md` and the Active Project portion of
`spec/project_creation_view_spec.md`.

This is positioned late because it depends on most other views existing —
it's the management lens that sees everything.

**Tasks:**
- Project View grid with all Rev 1 columns
- Project Key configuration area
- Status column with single-signal logic
- Routing Grid (Compact/Expanded) with anchor view
- Filter/Find search modes
- Indent rule implementation
- Per-column visibility (localStorage persistence)
- Inline edits and state-change modal
- From-stock prompt logic
- Inferred-skip logic
- Skip-and-Fulfill recovery action with descendant constraint
- Return to Stock (Primitive 3) with cascade reverse
- Active Project Summary surface in Project Creation View
- Add Top-Level Item to Active Project workflow
- Project Archive (Active and Complete)
- Project Due Date cascade

**Exit criteria:**
- Project View is functional end-to-end
- All four primitives (Loss, Rollback, Return to Stock, WO Split) work correctly
- Skip-and-Fulfill enforces descendant constraint
- Active Project metadata edits work; Top-Level Item additions work
- Archive workflow (Active and Complete) preserves snapshot state correctly

---

## Phase 9 — Blocker Workflows

Build per `spec/blocker_spec.md`.

**Tasks:**
- Blocker creation from execution lenses and Project View
- Blocker entityType handling (WO vs. Batch)
- Pending Resolution transition (Manager/Admin only)
- Resolution with type (Cleared, BatchAdjustment, RoutingRollback, WOSplit)
- preBlockerState capture and restoration on Cleared
- Blocker visibility in Operations Lens, Project View, execution lenses
- AuditLog action types for blocker events

**Exit criteria:**
- Blockers can be created, transitioned to Pending, and resolved with all four types
- Resolution restores correct state per spec
- Blockers correctly propagate to batch level when blocking a batched WO

---

## Phase 10 — Polish and Acceptance

The final phase before declaring Rev 1 done.

**Tasks:**
- End-to-end smoke test of major flows with real data
- Bug fixes for issues discovered during use
- Performance pass on heavy views (Project View with hundreds of WOs, Operations Lens cross-process)
- Documentation updates (README, deployment notes)
- Final spec drift reconciliation (update specs based on DEVIATIONS.md learnings)
- TESTS_BACKLOG.md final pass — anything that should be in Rev 1 vs. deferred

**Exit criteria:**
- All major flows work end-to-end with real data
- Performance acceptable on realistic load
- Documentation is current
- DEVIATIONS.md is up to date
- The tool is demoable

---

## Cross-Cutting Concerns

These apply across all phases, not just specific ones.

### Authentication and authorization

Rev 1 has no real auth — manual user selection. Permissions are enforced at
the API layer based on the selected user's role. Rev 2 will add real auth.

### AuditLog discipline

Every state change writes to AuditLog in the same transaction. This is
non-negotiable per the spec. New AuditAction types go into the lookup table
via INSERT.

### Spec drift handling

When implementation reveals a spec gap or contradiction:
1. Pause the work
2. Document in DEVIATIONS.md
3. Surface to user for direction
4. Update spec if appropriate
5. Resume

### Test coverage

Per CLAUDE.md: business logic + transactions get tests. CRUD and UI mostly
don't. Add to TESTS_BACKLOG.md when deferring tests for things that warrant
later coverage.

### Build commits

Conventional Commits, small and focused, one logical change per commit.

---

## What's Not in Rev 1 (Reference)

These items are deliberately deferred to Rev 2 or later. Don't build them
in Rev 1 unless explicitly directed:

- Real authentication and authorization
- Material Handling (allocation tracking, raw material WO splits)
- Process Batching (cross-PartID batches around shared process)
- Revision Management for Parts and BOMs
- Reversal of stock fulfillment
- Removal of Top-Level Items from Active Projects
- Un-archive workflow
- Server-side persistence of UI preferences
- Process column groups in Project View
- Machine and operator assignment columns in Project View
- WIP flagging when definitions change
- Per-lens priority overrides
- E2E tests
- Mobile-specific UI
- Public API for external integrations

These are tracked in `spec/schema.md` "Rev 2 Schema Extensions" and in the
Rev 2 backlog sections of individual view specs.

---

## Roadmap Status

Update this section as phases complete.

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0 | Done | Initial scaffolding complete |
| Phase 0a | Done | Tooling, hooks, ADRs, Playwright, commitlint |
| Phase 1A | Not started | |
| Phase 1B | Not started | |
| Phase 1C | Not started | |
| Phase 1D | Not started | |
| Phase 2 | Not started | |
| Phase 3 | Not started | |
| Phase 4 | Not started | |
| Phase 5 | Not started | |
| Phase 6A | Not started | |
| Phase 6B | Not started | |
| Phase 7 | Not started | |
| Phase 8 | Not started | |
| Phase 9 | Not started | |
| Phase 10 | Not started | |
