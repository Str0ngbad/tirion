# Tirion — State of the Spec (Re-Entry Brief)

**Purpose:** A single-page reorientation document for picking the project back up after a context switch. Reflects the spec corpus as of the end of the May 2026 build-prep session.

**Date current as of:** May 7, 2026

**Status:** Spec corpus is build-ready. No outstanding pre-build items. Next move is opening the build-phase consultant project and beginning Phase 0.

---

## Where You Left Off

You completed a substantial multi-session push that left the spec corpus internally consistent and build-ready. Major work in this session:

- **Reconciliation pass** addressing audit findings from the post-Stage-7 review: Definition Change Flag system as the implementation of Principle 10, Cancel primitive, batch propagation rules, three corrective rounds on the Component Added flag resolution, three inverted blocker direction rules corrected across the corpus, schema reconciled with all additions
- **WO Split spec** drafted with conservation rules, draft view UX, blocker-resolution integration, 15 hard rules
- **Side Panel consolidation** across nine files — unified Detail Panel structure with Process-Specific Section, click-to-swap routing step behavior in management views, lens-specific content delegated cleanly
- **Configuration Management spec** for Vendors, MaterialSpecs, Users, ProcessTypes, ProcessTypeSubStatus — including the Pattern A vs. Pattern B in-context creation distinction
- **Receiving design session** — full rewrite of the Receiving Lens spec based on real-world scenarios you walked through; Supply Order modal as primary surface, Supply Order Line Exception mechanism, schema simplification (Receipt + ReceiptLine entities removed)
- **Indicator system unified** in terminology_lock.md Cluster 9 — Red Flag (Blocker), Yellow Flag (Definition Change Flag), White Flag (Supply Order Exception); per-lens applicability locked
- **Phase 0a tooling phase added** to BUILD_ROADMAP for Claude Code hooks setup before substantive build begins (per Leith Wojas's recommendations)

All three pre-build audit items from earlier in the session are resolved.

---

## Spec Corpus Inventory (29 files)

**Build infrastructure (5):**
- `consultant_project_instructions.md` — persona for the build-phase Claude.ai project
- `CLAUDE.md` — for Claude Code repo root, includes Hooks and Project Maintenance section
- `BUILD_ROADMAP.md` — 11 phases (Phase 0 → 0a → 1A → ... → 10) with sub-phases
- `DEVIATIONS.md` — change log; all pre-build items marked resolved
- `TESTS_BACKLOG.md` — empty template for build-time test capture

**Foundation (4):**
- `schema.md` — full Prisma schema with all 51+ documented changes (Stage 6 + reconciliation pass + Receiving design session)
- `terminology_lock.md` — vocabulary across 9 clusters including Primitives (Loss, Rollback, Return to Stock, WO Split, Cancel) and Row Indicators
- `state_model.md` — 8 objects with full state transition rules including Definition Change Flag as Object 8
- `system_intent_and_rules.md` — 10 core principles, with Principle 10 reflecting actual Definition Change Flag implementation

**Configuration editors (4):**
- `parts_master_spec.md` — Part Form, Edit-Time Dialog, Cancel primitive
- `bom_editor_spec.md` — tree visualization, Edit-Time Dialog, displayOrder
- `routing_template_editor_spec.md` — template lifecycle, Edit-Time Dialog, retirement
- `configuration_management_spec.md` — Vendors, MaterialSpecs, Users, ProcessTypes (locked in Rev 1), ProcessTypeSubStatus

**Planning views (4):**
- `project_creation_view_spec.md` — Draft → Active compilation
- `stock_fulfillment_view_spec.md` — first gate (per-WO Model 1)
- `batching_lens_spec.md` — second gate; Composition Column with chips
- `project_view_spec.md` — flat row list with management edits

**Execution lenses (6):**
- `purchasing_lens_spec.md` — buyer surface; vendor precedence; exception visibility
- `receiving_lens_spec.md` — Supply Order modal as primary surface; two workflows
- `distribution_lens_spec.md` — final routing; ancestry tree display
- `machining_lens_spec.md` — operator surface; engineering vs. operator estimates preserved
- `assembly_lens_spec.md` — readiness math; Assembler Review Flag with cross-view indicator + filter
- `operations_lens_spec.md` — management overview; click-to-swap routing step behavior

**Cross-cutting systems (3):**
- `definition_change_flag_spec.md` — Edit-Time Dialog system; per-change-type resolution workflows; batch propagation rules
- `blocker_spec.md` — three-state lifecycle; preBlockerState; auto-creation scenarios
- `detail_panel_spec.md` — shared side panel structure with Process-Specific Section

**Special operations (1):**
- `wo_split_spec.md` — Manager/Admin primitive; conservation rules; draft view UX

**Reference (1):**
- `state_of_spec_brief.md` — this document

---

## Tech Stack (Locked)

- TypeScript (strict)
- Next.js 14+ with App Router
- PostgreSQL on Neon
- Prisma ORM
- REST API via Next.js API Routes with Zod validation
- Tailwind + shadcn/ui
- Vitest
- Vercel deployment
- Conventional Commits, kebab-case files, snake_case db, camelCase TS, PascalCase types/components

---

## Architectural Decisions That Matter Most for Build Phase

**Two-gate model:** Compile → Stock Fulfillment Release → Batching Confirm → Open. Stock Fulfillment is per-WO (Model 1). Batching Confirm is the only path from Unreleased to Open for Pass-Through WOs. Fulfill from Stock bypasses both gates and goes directly to Complete via Skipped routing steps.

**Headless-shaped architecture:** Business logic in `/lib`, route handlers thin, REST API. Rev 1 ships with single React frontend but the architecture supports future Rev 2 headless usage (B2B integration, AI agents, mobile clients) without rebuilding the backend.

**Principle 10 (Definition changes don't auto-cascade to WIP):** Implemented via the Definition Change Flag system. Engineer acknowledges impact at edit time via mandatory Edit-Time Dialog; Manager/Admin resolves each affected entity's flag deliberately via Dismiss or Accept Change. Auto-resolution scenarios for Component Added, batch propagation, WO Split.

**Five primitives:** Loss, Rollback, Return to Stock, WO Split, Cancel. All Manager/Admin-only with required notes and audit trail. Cancel is leaf-only.

**Permissive system, thoughtful manager:** The system enforces structural integrity (conservation rules, FK integrity, lockout prevention) but does not prevent operational decisions the manager could make incorrectly. All changes audited.

**Three-color indicator system:** Red Flag (Blocker — stops work), Yellow Flag (Definition Change Flag — informational, decision-pending), White Flag (Supply Order Exception — procurement-side signal). See terminology_lock.md Cluster 9 for full canonical definition.

**Soft delete only in Rev 1:** All configuration records (Parts, Vendors, MaterialSpecs, Users, etc.) use `isActive` boolean. Preserves FK integrity and audit log fidelity automatically.

---

## Sequence for Entering Build Phase

1. **Open the build-phase Claude.ai project.** Use `consultant_project_instructions.md` as the project instructions.

2. **Attach the spec corpus.** All 29 files. The build-phase consultant uses these as authoritative references.

3. **Provide Leith Wojas's hook recommendations screenshots.** These guide the Phase 0a setup — half day to a full day to configure Claude Code hooks for project_manifest, project_tracker, deviations auto-update, and self-review code review.

4. **Begin Phase 0 — Scaffolding.** Initialize Next.js project, set up Prisma schema, deploy to Vercel + Neon, verify sample API route. Per `BUILD_ROADMAP.md` Phase 0.

5. **Phase 0a — Tooling and Hooks Setup.** Configure the four core hooks per `BUILD_ROADMAP.md` Phase 0a. Outputs: `.claude/settings.json`, `.claude/hooks/`, `.claude/agents/`, `project_manifest.md`, `project_tracker.md`, CLAUDE.md update.

6. **Phase 1A — Configuration Foundation.** Lookup tables, users, vendors, material specs per `configuration_management_spec.md`. ProcessTypes seeded but locked in Rev 1.

7. **Phase 1B onward.** Per BUILD_ROADMAP.

Estimated Rev 1 build duration: 1-2 weeks of focused work after Phase 0a completion.

---

## What's Explicitly Out of Scope for Rev 1

Per the spec corpus and Rev 2 wishlists across multiple specs:

- Authentication (manual user selection in Rev 1)
- Material handling (separate physical inventory tracking from WO allocation)
- Material substitutions
- Assembly instructions (sub-step sequence + notes)
- Assembler Review Flag dedicated review queue surface
- Project Archival precondition checks (system-enforced)
- Add WIP WO to existing batch
- Receipt entity and shipment-level analytics
- Slip / invoice reference structured capture
- Email integration on User records
- Per-user permissions overrides
- Email/message integration for Process Notes (@-mention)
- Vendor merge utility
- Supply-Order-primary view orientation in Receiving Lens
- ProcessType management (locked in Rev 1; unlock paired with dev work to make new types operationally meaningful)
- Multi-select WO satisfaction in Receiving Lens grid
- Exception taxonomy beyond generic Exception field
- Richer historical view in Process-Specific Section for Complete steps

---

## Personal Context

- 11 years at small (10-person) machine manufacturing shop, 9 years as ops manager
- Built and ran the spreadsheet system Tirion replaces
- Laid off ~5 weeks ago after spec was taken over and built without him over a weekend by the CEO
- Active job search, transitioning to Product roles
- Tirion is portfolio + skill development + closure
- 15% company stake retained
- Actively learning during this build: REST API design, PostgreSQL, integrations, deeper AI (agents/skills/RAG/Eval), architecture principles
- Friend Leith Wojas providing technical guidance, particularly around Claude Code hooks discipline
- Build target: 1-2 weeks once Phase 0a tooling is in place

---

## Working Style with Claude (Locked)

For continuity in build-phase consultant project and any future Claude conversations:

- Direct, peer-to-peer communication; never patronizing
- Adaptive detail; tight chunks; small targeted decisions
- Don't use multiple-choice or `ask_user_input` tool — User prefers prose
- Surface plans for multi-step work before executing
- Always clarify ambiguity before swinging
- "The work is yours" attribution language — the user is doing the work; Claude is supporting
- Trust the user's time estimates over Claude's defaults
- Push back honestly when something seems wrong; don't capitulate when you have grounds
- Audit assumptions when the user asks (the kind of catch the user made on Routing Template in-context creation paid off)

---

## What This Document Replaces

The previous `state_of_spec_brief.md` (dated April 28, 2026) is now obsolete. It described the spec corpus at the START of the May 2026 build-prep session, before the substantial reconciliation work. Anyone using it for orientation will be misled about the current state.

This document (dated May 7, 2026) reflects the spec corpus as it currently stands — build-ready, all reconciliation complete, all pre-build audit items resolved.
