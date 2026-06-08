# State of Spec — Phase 1 Complete

*Last updated: 2026-06-08 (Phase 1 close)*

## Purpose

This document captures the state of Tirion at the close of Phase 1. It is intended for two audiences:

- **Future Claude sessions** picking up the project — to understand where things stand without re-reading the full build history
- **Hiring managers and reviewers** evaluating Tirion as a portfolio artifact — to see what shipped, what was deferred, and the reasoning behind both

It is a snapshot, not a spec. The locked specs in `/spec/` remain the source of truth for entity behavior. This document layers on top of them: what was built, what changed, what's coming.

## Project Summary

Tirion is a manufacturing production management tool, designed for small-to-mid manufacturers transitioning from spreadsheet-driven workflows. Rev 1 is the foundational pass — it establishes the entity model, configuration surfaces, and core production-reference views (Parts, BOM, Routing Templates). Production execution surfaces (operations, machining, assembly, distribution, receiving, purchasing, batching, stock fulfillment) follow in Phases 3-10.

The Rev 1 spec corpus was authored before build began. Phase 1 implemented the spec with a small number of deliberate deviations (captured below).

## What Shipped in Phase 1

### Core Configuration Surfaces

All eight configuration surfaces are implemented with consistent design vocabulary and CRUD behavior.

- **Parts** — grid with virtualized rendering, slide-in Sheet for detail editing, BOM and Routing template assignment, definition-change flagging, push-grid layout, drag-to-reorder columns, saved views with full state persistence
- **BOM Editor** — tree visualization with recursive rollups for cost, buildable count, and freshness; per-Part and per-Assembly freshness icons; inline qty editing; add/remove children with cycle and depth-limit validation; cross-surface integration to Parts Master
- **Routing Templates** — list of templates, in-template step editing, process type assignments, reorderable steps
- **Vendors** — grid + Sheet, reference-block deactivation per CM-2, in-context creation pathway from Parts Sheet preserved, Sheet-create mode for Configuration surface
- **Material Specs** — grid + Sheet, cascade modal for composite-unique (materialName, form) pair creation and editing; narrow grid with intentional roadmap card in the empty space
- **Users** — grid + Sheet with role-conditional fields, lockout prevention enforced (cannot deactivate or de-Admin the only active Admin), in-context Process Type multi-select
- **Processes** — surface combining ProcessType and ProcessTypeSubStatus (consolidated from spec's two separate surfaces); grouped-by-ProcessType layout with drag-to-reorder for sub-statuses, two distinct Sheet types (ProcessType detail and SubStatus detail) sharing one side panel slot
- **Procurement Categories** — grid + Sheet, Sheet-create mode, drag-to-reorder, displayOrder hidden from UI

### Global Navigation

- Persistent top bar on every page with Tirion wordmark (home link) on the left
- Two category buttons: Configuration Views (current eight surfaces), Production Views (empty in Rev 1, populated by Phase 6+ execution lenses)
- Dropdown UX: hover-open with structural bridge (no timing buffer), click-to-pin, switch menus on hover regardless of pin state
- Active-state indicator: colored underline on active category button; colored left-border on active dropdown item

### Cross-Surface Integration

- Parts Master ↔ BOM Editor: "Edit Assembly" button on Parts Sheet navigates to BOM Editor for that Assembly; "Open in Parts Master" link on BOM Editor identity band navigates back via deep-link
- Parts Master `?partId=X` URL parameter opens the Sheet for a specific Part on page load
- Push-grid layout pattern (primary surface + 400px Sheet sibling) standardized across surfaces

### Saved Views

- Saved views persist filters, sorts, column visibility, and column order
- Multiple views per user
- Save, save-as-new, revert-to-saved actions
- Dirty-state indicator (compares all persisted dimensions including column order)

### Audit Infrastructure

- Every entity mutation creates a typed audit log entry
- Audit log section in entity Sheets shows recent entries (last 5, expandable)
- Bulk operations (drag-to-reorder) create single bulk audit entries rather than per-row entries
- Audit Actions seeded; new actions added via migrations

### Data Import (Phase 2)

- Real shop data imported from CSV: 1,893 parts, 434 assemblies, 108 vendors, populated process types and sub-statuses, routing templates, BOM relationships
- Material normalization notes preserved as local file (not in repo) for future data improvement work
- Phase 2 in the build roadmap; folded into Phase 1's natural workflow rather than executed as a separate sequenced phase

### Deployment

- Vercel project configured with production branch pointing at `main`
- Neon database for production and dev
- Environment variables, build configuration, and deployment trigger functional

## Notable Deviations from Spec

Each deviation was a deliberate decision during build, recorded in DEVIATIONS.md with reasoning. Summary:

- **Processes surface consolidation.** Spec defined separate "ProcessTypes" and "ProcessTypeSubStatus" management surfaces. During build, the ProcessTypes view-only catalog was determined to be redundant — its data (description, reference counts) folded into ProcessType detail Sheets accessible from the ProcessTypeSubStatus surface. Renamed to "Processes." Saved a dead view; produced a richer single surface.

- **MaterialSpec cascade modal retained.** Other configuration surfaces migrated from modal-create to Sheet-create during the polish pass because the Sheet already presented the same fields used for editing. MaterialSpec stayed with its cascade modal because its input flow (sequential dropdowns for materialName, then form, with collision handling) doesn't fit the Sheet's layout structure as naturally as the field-list pattern used for other entities. UX-driven decision, not principled exception.

- **Create-via-Sheet pattern adopted on most surfaces.** Spec assumed modal-create as the default. Build migrated to Sheet-create for Users, Processes (sub-statuses), Vendors, and ProcurementCategory because the Sheet already presents substantively the same fields the create form would, and the Sheet keeps the grid visible (less disruptive than a modal).

- **DisplayOrder hidden from UI on entities supporting drag-to-reorder.** Spec called for displayOrder as a visible, editable field. Build implemented drag-to-reorder as the sole order affordance for sub-statuses and procurement categories; displayOrder became implementation detail since position-in-list conveys the same information.

- **Click-to-sort removed from column headers in Parts Grid.** Spec didn't address this directly. Build removed it once drag-to-reorder was added to columns to free the gesture. Sort remains accessible via column chevron menus and active-sort pills.

- **Multi-sort defaults to additive (no shift+click modifier).** Spec didn't specify. Build chose additive default with pills for unwinding — single, discoverable interaction model rather than modifier-key pattern.

- **Production vs Configuration nav distinction.** Spec didn't categorize surfaces. Build introduced the principle: Configuration surfaces define entities; Production surfaces execute work using those definitions. All Phase 1 surfaces are Configuration; Phase 6+ execution lenses will populate Production.

## Design Vocabulary Established

These patterns were codified during Phase 1 and are documented in CLAUDE.md. Future surfaces (Phase 3+) inherit them.

- **Push-Sheet layout.** Primary surface (grid, tree) sits beside a 400px fixed-width Sheet. Configuration grids use `w-[calc(100% - 400px)] shrink-0` to prevent layout shift on Sheet toggle. Parts Master Grid (high column count) uses `flex-1` because it benefits from filling space.
- **Always-rendered side panel.** Sheet slot is always 400px; empty state placeholder when no selection. Prevents reflow on Sheet open/close.
- **Active-state indicator.** Colored line — bottom-border for horizontal layouts (nav buttons, sub-nav), left-border for vertical layouts (dropdown items, sub-status rows). Active-state dot indicator (green dot) for entity rows in grids.
- **Affordances earn their place.** Multiple affordances for the same edit are fine when they serve different user contexts (e.g., column order accessible from both header drag and the column selector dropdown). The principle is value-based: provide affordances where they improve UX; don't multiply them when they don't.
- **Configuration surfaces follow consistent grid pattern.** Sortable columns, Show Inactive toggle, max-width container with left-alignment, Active dot column when relevant, drag-to-reorder where applicable.
- **Bulk operations get bulk audit entries.** Drag-to-reorder produces one audit entry per operation, not per row. Audit log captures user actions, not row-level mutations.
- **Multi-sort default for grids.** Sort menu selections stack additively; pills are the unwind affordance. No shift-click modifier patterns.
- **Cross-surface deep links.** Navigation between surfaces preserves context (Part X → BOM Editor for that Assembly → return to Part X's Sheet).

## What Was Deferred

These items are flagged for circle-back in Phase 1.5 or Rev 2. They are not technical debt; they were intentionally scoped out to keep Rev 1 focused.

### Deferred to Phase 1.5 (post-deployment polish)

- **Migration workflow as discipline.** Production deploy in Phase 1 was improvised. A focused cycle establishing schema migration patterns, data sync strategy, and deployment cadence is the first item after Phase 1 closes.
- **AuditLogSection consolidation.** The component is currently duplicated between PartFormSheet (inline) and the Configuration surfaces (`/components/configuration/audit-log-section.tsx`). Consolidate when stable.
- **Process-types route bypasses service layer.** ProcessType reads go directly through Prisma rather than through `/lib/process-types/service.ts`. Acceptable for view-only access; extract to service layer if any write operations are added.

### Deferred to Rev 2

- **MaterialSpec full overhaul.** Rev 1 MaterialSpec is intentionally minimal. Rev 2 expands into the full material handling pass — vendor sourcing, dimensional standards, stock management, usage rollups across parts and work orders. The Rev 1 surface includes a small inline card explaining this scope deliberately to viewers.
- **Ultrawide UI pass.** Several surfaces render appropriately at standard desktop widths but haven't been verified at ultrawide. Configuration grid caps, Parts Master Grid behavior, BOM Editor tree rendering, side panel proportions — all need ultrawide review.
- **Light mode tuning.** Color treatments are calibrated for the default theme; light mode hasn't received the same polish.
- **Authorization gating.** User entity has roles (Operator/Lead/Manager/Admin) but role-based UI access enforcement is not implemented. The Production vs Configuration nav structure was designed with permission-gated dropdowns in mind for future implementation.
- **Mobile/narrow viewport handling.** Tirion is desktop-only by design. Mobile is not a Rev 1 priority. Future revs may add responsive layouts.

### Phases 3-10 (Rev 1 Remaining)

After Phase 1 closes (cleanup + migration), Rev 1 continues with the execution-side work per BUILD_ROADMAP.md:

- **Phase 3 — Project Creation.** Build the surface for creating projects, which generate WorkOrders against the entity model established in Phase 1.
- **Phase 4 — Stock Fulfillment.** Implement stock-driven WorkOrder satisfaction; recovery paths for stock decisions.
- **Phase 5 — Batching Lens.** Cross-WO batching around shared processes.
- **Phase 6 — Execution Lenses + Infrastructure.** Per-process lenses (Purchasing, Receiving, Machining, Assembly, Distribution, Weld, Blacken, Paint, 3D Print) sharing common infrastructure (filter, sort, saved views, anchor view). This phase is multi-surface; the others above are single substantial surfaces each.
- **Phase 7 — Operations Lens.** Cross-process visibility; the management lens that sees everything.
- **Phase 8 — Project View and Active Project Management.** Project-organized view with primitives (Loss, Rollback, Return to Stock, WO Split).
- **Phase 9 — Blockers.** Blocker workflow infrastructure across execution lenses, Project View, and Operations Lens.
- **Phase 10 — Polish and Acceptance.** Final smoke pass; Rev 1 declared done.

Phases 3-5 and 7-9 are each a single substantial surface. Phase 6 is the most concentrated work (multiple per-process lenses), but the infrastructure is shared.

## Architectural Decisions Worth Knowing

### Stack

- TypeScript / Next.js (App Router) / Prisma / Neon Postgres
- shadcn/ui primitives + Tailwind
- React Query for data fetching with optimistic UI patterns
- dnd-kit for drag interactions (vertical sort in Processes and Procurement Categories; horizontal sort in Parts Grid columns; vertical sort in Parts column selector)

### Authorship Model

- The user (Tony) authored the spec, made every architectural and product decision, and directed the build
- Claude (this consultant role) drafted prompts for Code (a separate Claude Code session in the user's terminal); drafts incorporated user decisions and were executed by Code under user supervision
- Each commit was the user's call; consultant Claude advised, did not autonomously decide

### Workflow Patterns Established

These are workflow practices that emerged during Phase 1 and remain in effect:

- **Post-commit working tree verification.** After every feature commit, Code runs `git status` and reports the result. Prevents orphaned source files (a real bug discovered mid-build and addressed via this discipline).
- **Mockup-reference discipline.** For surfaces with mockup files, Code reads the mockup during discovery before implementation. Prevents prompt-text-only implementation that diverges from visual intent.
- **Discovery phase before implementation.** Code reads existing implementation, related patterns, and any relevant spec sections before writing new code. Surfaces ambiguity before commit.
- **Backend cleanup commits before UI work.** When backend services have gaps relative to spec, a focused cleanup commit aligns them before UI implementation begins.
- **Preservation before deletion.** Local files (CSVs, notes) preserved outside the repo before any cleanup that would destroy them.
- **Bulk audit entries for bulk operations.** Reorder operations produce one audit entry, not N.

### What Tirion Is Not

- Not an ERP. Tirion is purposefully narrow: production management for small/mid shops, not full enterprise resource planning.
- Not a workflow automation engine. Tirion provides high-context visibility and human decision-making support, not rigid automation rules.
- Not a multi-tenant SaaS. Rev 1 is single-shop deployment; multi-shop would be future work.

## Roadmap Snapshot

| Phase | Status | Focus |
|---|---|---|
| Phase 0 | ✅ | Scaffolding |
| Phase 0a | ✅ | Tooling, hooks, ADRs |
| Phase 1 | ✅ | Configuration surfaces, foundational data model, design vocabulary |
| Phase 2 | ✅ | Data import (folded into Phase 1 flow) |
| Phase 1.5 | Next | Migration workflow discipline, AuditLog consolidation, process-types service extraction |
| Phase 3 | After 1.5 | Project Creation |
| Phase 4 | Future | Stock Fulfillment |
| Phase 5 | Future | Batching Lens |
| Phase 6 | Future | Execution lenses + shared infrastructure |
| Phase 7 | Future | Operations Lens |
| Phase 8 | Future | Project View + Active Project Management |
| Phase 9 | Future | Blockers |
| Phase 10 | Future | Polish and Acceptance |
| Rev 2 | Future | MaterialSpec overhaul, ultrawide, light mode, auth gating |

---

*This document is a snapshot at Phase 1 close. It does not replace the locked specs in `/spec/`. For specific entity behavior, see the spec corpus. For architectural decisions, see ADRs in the repo. For build history, see commit log.*
