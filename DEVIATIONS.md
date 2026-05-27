# Tirion — Build-Time Deviations from Spec

This document tracks discoveries made during the build that diverge from the
locked Rev 1 spec. The spec is the source of truth, but no spec is perfect —
implementation reveals gaps, contradictions, and edge cases the spec didn't
anticipate.

When a deviation is discovered:

1. **Pause implementation.** Don't silently work around the spec.
2. **Document the deviation here** using the entry template below.
3. **Surface to the user** for direction.
4. **Update the spec** if appropriate (with user approval).
5. **Resume implementation** with the deviation either resolved (spec updated)
   or accepted (deviation logged and approved).

---

## Entry Template

For entries created by the deviations hook (via `Deviates-From:` /
`Deviation-Summary:` commit footer tags), **Commit:** is auto-populated
from the triggering commit. For hand-authored entries, backfill
**Commit:** with the hash of the commit that landed the change.

When adding a deviation, copy this template and fill it in:

```markdown
## YYYY-MM-DD — Short Title

**Phase:** [which build phase]
**Spec section:** [which spec document and section]
**Discovered by:** [Claude Code / user / consultant]
**Status:** [Open | Resolved-Spec-Updated | Resolved-Accepted | Resolved-Reverted]
**Commit:** [commit hash where the deviation was resolved]

### What the spec says

[Quote or paraphrase the relevant spec text]

### What was discovered

[Describe the gap, contradiction, or unanticipated case]

### Resolution

[What was decided. If the spec was updated, note which section.
If accepted as a deviation, explain why.
If reverted (the deviation turned out to be wrong), explain.]

### Files affected

[List files that touch this deviation]
```

---

## Deviations

## 2026-05-27 — Vendor detail panel: Active Work summary added

**Phase:** Mockup track (Vendor Configuration Grid)
**Spec section:** configuration_management_spec.md — Vendor Management → Detail Modal Fields
**Discovered by:** User, during mockup review
**Status:** Resolved-Spec-Updated
**Commit:** e2a363d

### What the spec said

The Vendor Detail Modal Fields section listed Notes, Audit log, and a
Reference list of Parts using this vendor as Default Vendor. The two
stat tiles (Default Vendor For, Open Supply Orders) covered configuration
counts but did not surface WIP impact.

### What was discovered

During mockup review, the user identified that an admin considering vendor
deactivation or Default-Vendor reassignment needs awareness of WIP impact
to make an informed decision — not as a blocker (spec is explicit that WIP
doesn't block these actions), but as operational context. Specifically:
how many active WOs depend on this vendor, and of those how many are in
the purchasing queue vs. awaiting material receipt.

Open Supply Orders gave partial information (transactions in flight) but
missed WOs in the purchasing queue and didn't communicate the count of WOs
affected.

### Resolution

- Added a third stat tile "Active Work" to the Vendor Detail panel with
  three counts: total active WOs, awaiting receipt, awaiting purchase.
- Counts are disjoint subsets of total; per the state model, every WO is
  in exactly one purchasing state at a time. The sum of awaiting receipt
  and awaiting purchase will often be less than total, with the remainder
  representing WOs past both gates but still active in routing.
- Added a link to the Operations Lens filtered by vendor for the full
  breakdown — the Active Work summary is a high-level signal, not a
  detailed list.
- configuration_management_spec.md Vendor Management section updated to
  document the new field and its semantics.
- Same pattern may apply to Part Form Default Vendor changes; deferred
  pending separate review when Part Form mockup work begins.

### Files affected

- spec/configuration_management_spec.md (Detail Modal Fields section)
- app/mockups/vendors/_data.ts (three new fields on MockVendor)
- app/mockups/vendors/_components/vendor-detail-modal.tsx (new tile)

---

## 2026-05-09 — schema.md missing UserProcessTypeAssignment model

**Phase:** 0
**Spec section:** schema.md ProcessType model; configuration_management_spec.md UserProcessTypeAssignment definition
**Discovered by:** Claude Code (during schema extraction in Phase 0)
**Status:** Resolved-Spec-Updated

### What the spec says

`schema.md` line 272 declares a relation on `ProcessType`:
`userAssignments UserProcessTypeAssignment[]`

But the `UserProcessTypeAssignment` model itself was not defined in `schema.md`. It IS defined in `configuration_management_spec.md` (line 356) along with related relations on `User` and `ProcessType`.

### What was discovered

`schema.md` was not fully synced with `configuration_management_spec.md` when the `UserProcessTypeAssignment` junction table was added there. The relation references survived in `schema.md`, but the model definition and the User-side relation were never copied over. Result: `npx prisma validate` failed with "Type 'UserProcessTypeAssignment' is neither a built-in type, nor refers to another model, composite type, or enum."

### Resolution

`schema.md` updated to include the `UserProcessTypeAssignment` model definition and the corresponding `assignedProcessTypes` relation on the User model, copied from `configuration_management_spec.md`.

### Files affected

- `spec/schema.md` (added UserProcessTypeAssignment model and User-side relation)
- `prisma/schema.prisma` (will be regenerated by Claude Code from updated schema.md in next commit)

---

## 2026-05-09 — schema.md SupplyOrder retains orphaned Receipt relation

**Phase:** 0
**Spec section:** schema.md SupplyOrder model; "Receipt and ReceiptLine — REMOVED in Rev 1" section
**Discovered by:** Claude Code (during schema extraction in Phase 0)
**Status:** Resolved-Spec-Updated

### What the spec says

`schema.md` line 761 declares a relation on `SupplyOrder`:
`receipts  Receipt[]`

But the `Receipt` and `ReceiptLine` models were explicitly removed in Rev 1 per the Receiving Design Session (RD1, RD2). The analogous `SupplyOrderLine.receiptLines` relation was correctly removed (RD12), but `SupplyOrder.receipts` was missed in the cleanup pass.

### What was discovered

`npx prisma validate` failed with "Type 'Receipt' is neither a built-in type, nor refers to another model, composite type, or enum." The relation is genuinely orphaned — nothing else in the schema defines or references a Receipt model.

### Resolution

`receipts Receipt[]` line removed from the `SupplyOrder` model in `schema.md`.

### Files affected

- `spec/schema.md` (removed orphaned Receipt relation from SupplyOrder)
- `prisma/schema.prisma` (will be regenerated by Claude Code from updated schema.md in next commit)

## 2026-05-09 — schema.md missing four inverse relations and minor drift

**Phase:** 0
**Spec section:** schema.md — Part, MaterialSpec, AuditLog models; misc cleanup
**Discovered by:** Claude Code (during second schema extraction in Phase 0)
**Status:** Resolved-Spec-Updated

### What the spec says

`schema.md` declared forward foreign-key relations on four fields without declaring the inverse (back-reference) relations on the parent models:

- `ProductionBatch.part Part` — no `productionBatches ProductionBatch[]` on Part
- `DefinitionChangeFlag.changeAuditLog AuditLog` — no `definitionChangeFlags DefinitionChangeFlag[]` on AuditLog
- `SupplyOrderLine.part Part?` — no `supplyOrderLines SupplyOrderLine[]` on Part
- `SupplyOrderLine.materialSpec MaterialSpec?` — no `supplyOrderLines SupplyOrderLine[]` on MaterialSpec

Additionally, three minor inconsistencies remained from the Receipt removal pass:

- Overview line referenced "23 tables" — actual count after Receipt/ReceiptLine removal is 21
- `AuditAction.category` comment listed `'Receipt'` as a valid category
- Table Creation Order list still numbered Receipt and ReceiptLine as steps 19 and 20

### What was discovered

Prisma requires both sides of every relation to be declared in the schema for the type-safe client to navigate the relation in either direction. Forward declarations alone fail validation with "missing opposite relation field." All four cases were structurally consistent at the database FK level but incomplete at the Prisma schema level.

The minor inconsistencies were leftovers from the Receiving Design Session's Receipt entity removal — references in prose that the structural cleanup pass missed.

### Resolution

`schema.md` updated to add the four inverse relation declarations on the appropriate parent models, plus the three minor cleanups (corrected table count, Receipt removed from category list, table creation order renumbered).

### Files affected

- `spec/schema.md` (added four inverse relations on Part, MaterialSpec, AuditLog; corrected table count and creation order; removed Receipt from AuditAction category list)
- `prisma/schema.prisma` (will be regenerated by Claude Code from updated schema.md in next commit)
---

## Index of Common Deviation Categories

When a pattern of deviations emerges, add it here so future discoveries can
reference prior decisions.

*(Empty — no patterns established yet.)*

---

## Review Cadence

The user reviews this document:
- At the end of each phase (during phase exit criteria check)
- When considering whether to update the spec
- During the Phase 10 reconciliation pass

The consultant references this document:
- Before answering questions about features that have prior deviations
- When drafting Claude Code prompts for areas with known deviations
- When reviewing Claude Code outputs to catch silent re-introduction of resolved
  deviations

---

## Pre-Build Spec Items Identified During Audit

These items were identified during the post-reconciliation audit and should be
resolved before Phase 1A build begins. Tracked here so they don't get lost.

### Side Panel Process-Specific Section Pattern
**Status:** ✅ RESOLVED — see `detail_panel_spec.md` Process-Specific Section
**Scope:** Was small targeted update to `detail_panel_spec.md`; ended up as
substantial update to detail_panel_spec.md plus slim-down of all six lens
specs' Side Panel sections to delegate shared content and define only their
process-specific content. Includes click-to-swap routing step behavior in
management views and editability rules.

### Configuration Management Spec
**Status:** ✅ RESOLVED — see `configuration_management_spec.md`
**Scope:** Consolidated spec covering Vendors, MaterialSpecs, Users,
ProcessTypes, ProcessTypeSubStatus. Also documents the in-context creation
pattern (Pattern B) for Vendors/MaterialSpecs from the Part Form versus
dedicated surface creation (Pattern A) for Users/ProcessTypeSubStatus.
ProcessTypes locked in Rev 1 (view-only).


### Receiving Workflow Focused Design Session
**Status:** ✅ RESOLVED — see `receiving_lens_spec.md` (rewritten)
**Scope:** Validated the dual-surface approach. Outcome: Supply Order modal
is the primary action surface; WO side panel section is intentionally
minimal (navigation point + status display). Receiving Lens grid serves as
the WO-context surface for partial-allocation decisions.
**Key decisions captured:**
- Two distinct workflows: full-line satisfaction (one click) vs. partial
  allocation (manual WO-by-WO satisfaction from the lens grid)
- Supply Order Line Exception mechanism added (procurement-side signal
  separate from WO Blockers)
- Per-WO ETA + per-Line ETA, with Line ETA propagation to member WOs
- Receipt and ReceiptLine entities REMOVED from Rev 1 schema (audit log
  provides historical record)
- Refusal mechanism removed (quality issues become Blockers + Line Exceptions)
- Slip/invoice reference dropped from Rev 1
**Schema impact:** 15 changes applied — see schema.md Receiving Design
Session Change Summary

## 2026-05-09 — Local dev uses Neon dev branch instead of Docker Compose

**Phase:** 0
**Spec section:** BUILD_ROADMAP.md Phase 0 — "Set up Docker Compose for local PostgreSQL"
**Discovered by:** Project owner (during environment setup)
**Status:** Resolved-Deviation-Accepted

### What the spec says

The build roadmap lists Docker Compose for local PostgreSQL as a Phase 0
task. The intent is a self-contained local database that lives in repo
config and can be spun up identically by anyone cloning the repo.

### What was discovered

The build machine is running Windows 10 Enterprise 21H2. Docker Desktop
requires Windows 10 Pro/Home 22H2 or higher. The Enterprise edition is
managed by the project owner's former employer and cannot be upgraded
through consumer Windows Update channels. A future Pro license upgrade
is planned but is not scheduled for the Rev 1 build window.

### Resolution

Local development uses a dedicated `development` branch of the Neon project
in place of Docker Compose. Tests use a third `test` branch, also on Neon.
Both branches are isolated from the `production` branch.

Pros of this approach:
- No local install or OS-level dependency
- Schema state is reproducible from `prisma/schema.prisma` + migrations
- Matches the production database engine exactly (no SQLite-in-dev,
  Postgres-in-prod mismatch)

Cons:
- Requires network connectivity for any database operation in dev
- Slight added latency on each query (vs. local Docker)
- Anyone cloning the repo needs their own Neon account or alternative
  Postgres setup

The `.env.example` file documents the `DATABASE_URL` requirement; new
developers cloning the repo can either follow the Neon path or set up
their own local Postgres if preferred.

### Migration path

When the build machine is upgraded to Windows 11 Pro, Docker can be
installed and a `docker-compose.yml` added to the repo. The Neon branches
remain valuable regardless (production database, separate test isolation),
so this is additive rather than a replacement.

### Files affected

- No code changes; this is an environment-level decision
- `.env.example` already documents `DATABASE_URL` correctly for either path

## 2026-05-21 — AuditAction count corrected from 49 to 59

**Phase:** 1A
**Spec section:** seed_data_spec.md Section 3 (AuditAction Lookup) and the Verification section
**Discovered by:** Claude Code (during Phase 1A seed implementation)
**Status:** Resolved-Spec-Updated
**Commit:** 1ec1d1b

### What the spec says

"**Total AuditAction seed entries:** 49" — but the actual table in the same section listed 59 distinct entries.

### What was discovered

The declared count was not updated after the Reconciliation Pass added 10 entries (WOCancelled, four flag actions, RoutingResetByFlagResolution, WOAttributeUpdatedByFlagResolution, BOMComponentAddedViaFlagResolution, BatchMemberRemovedForFlagResolution) and the Receiving Design Session added 7 SupplyOrder action entries. The table was correct; the count line was stale metadata.

### Resolution

Count line updated from 49 to 59 in both Section 3 and the Verification section of seed_data_spec.md. Seed implements all 59 listed entries.

### Files affected

- spec/seed_data_spec.md (count corrected in two places)
- prisma/seed.ts (implements all 59 entries)

---

## 2026-05-21 — Added Configuration AuditAction category for Vendor lifecycle events

**Phase:** 1A
**Spec section:** seed_data_spec.md Section 3 (AuditAction Lookup)
**Discovered by:** Phase 1A consultant (during Vendor API design)
**Status:** Resolved-Spec-Updated
**Commit:** 3fbfde4c9fad595e3ec4593c84da0bb2ea638b17

### What the spec said

The AuditAction seed list did not include configuration-management
actions. The Configuration Management spec implies generic config
actions (CREATE, EDIT, DEACTIVATE) would be sufficient, but neither
generic nor entity-specific configuration actions appear in the
AuditAction seed.

### What was discovered

Building the Vendor API requires AuditAction entries for the four
Vendor lifecycle events (created, updated, deactivated, reactivated)
to write AuditLog entries with meaningful action identifiers. Generic
CRUD actions would be less useful for audit trail filtering than
entity-specific names, and the existing AuditAction conventions in
the seed favor explicit domain-meaningful names (StockReconciliation,
ProjectArchived) over generic CRUD.

### Resolution

Added a new "Configuration" AuditAction category to the seed with four
entries: VendorCreated, VendorUpdated, VendorDeactivated,
VendorReactivated. seed_data_spec.md Section 3 updated to document the
new category and the new total of 63 entries. The same pattern will
be extended in subsequent Phase 1A work for MaterialSpec, User, and
ProcessTypeSubStatus lifecycle events.

### Files affected

- prisma/seed.ts (4 new entries in seedAuditActions)
- spec/seed_data_spec.md (new Configuration Actions subsection, count
  updated from 59 to 63 in two places)

---

## 2026-05-21 — Vendor schema reconciliation: leadTimeDays and vendorName uniqueness

**Phase:** 1A
**Spec section:** schema.md (Vendor model) vs configuration_management_spec.md (Vendor Management section)
**Discovered by:** Claude Code (during Phase 1A Vendor service layer foundation)
**Status:** Resolved-Spec-Updated
**Commit:** c9ed3b8f9efbe3f9ab0069fa30594fc5adbf2878

### What the spec said

schema.md described the Vendor model without leadTimeDays and without
@unique on vendorName. configuration_management_spec.md's Vendor
Management section cited "Existing schema per schema.md" but then
described a Vendor model that included leadTimeDays (Int?) and
vendorName uniqueness — describing fields that schema.md did not
actually contain.

### What was discovered

The two specs disagreed on the Vendor model. The configuration spec
treats leadTimeDays as a first-class grid column ("Lead Time (Days) |
Reference for buyer planning") and treats vendorName uniqueness as
required ("Vendor Name | Required, unique"). Both are functionally
necessary: leadTimeDays for buyer planning workflows, and vendorName
uniqueness to prevent ambiguous vendor identification in the
configuration grid and to support the seed file's upsert pattern.

Per developer confirmation, these fields were intended to be in the
Vendor model. They were missed when schema.md was updated to reflect
decisions made during the configuration management spec work. The
configuration spec is the more recently-revised document and reflects
the intended state.

### Resolution

- schema.md updated to add leadTimeDays Int? and @unique vendorName to
  the Vendor model.
- prisma/schema.prisma updated to match.
- Migration generated and applied to the dev branch:
  20260521175345_add_vendor_lead_time_and_unique_name
- Seed re-ran cleanly with the updated schema.

### Files affected

- spec/schema.md (Vendor model definition updated)
- prisma/schema.prisma (Vendor model updated to match)
- prisma/migrations/20260521175345_add_vendor_lead_time_and_unique_name/
  migration.sql (new migration file)

---

## 2026-05-21 — MaterialSpec model reconciliation: simplified to alloy + form, stockSize moved to Part

**Phase:** 1A
**Spec section:** schema.md (MaterialSpec model) and
  configuration_management_spec.md (MaterialSpec Management section)
**Discovered by:** Phase 1A consultant (during MaterialSpec service layer planning)
**Status:** Resolved-Spec-Updated
**Commit:** 26e4e4cad7fda676d2445eb53b968d3b322a784b

### What the spec said

schema.md described MaterialSpec with fields including materialName,
form, stockSize, unitOfMeasure, and isActive — a model that conflated
material identity (what kind of material) with material handling
(specific stockable dimensional items). configuration_management_spec.md
described a different MaterialSpec model with materialName, description,
defaultVendorId, and isActive — closer to material identity alone but
adding fields not present in schema.md. Neither was internally
consistent across the spec corpus, and the Parts Master spec actively
referenced MaterialSpec.stockSize as a grid column source.

### What was discovered

The model conflated two related but distinct concerns: material
identity (alloy + form: "1018 Steel + Flat Bar") and material
handling (specific stockable dimensions and quantities). Material
handling proper is Rev 2 work and depends on tracking on-hand
quantities, allocations, and locations. In Rev 1, the dimensional
information is captured per Part because two Parts using the same
generic material can have different stock sizes.

Per developer resolution in a dedicated spec window: MaterialSpec is
scoped to generic material identity (alloy + form) for Rev 1.
Dimensional information moves to the Part record. Default vendor
remains at the Part level (no MaterialSpec-level default vendor in
Rev 1). isActive stays on MaterialSpec for typo/duplicate cleanup.

### Resolution

- spec/schema.md MaterialSpec: dropped stockSize, unitOfMeasure;
  added composite @@unique([materialName, form])
- spec/schema.md Part: added stockSize String? (required at
  application layer when materialSpecId is populated, enforced via
  Zod not via database constraint)
- spec/configuration_management_spec.md: updated MaterialSpec model
  block, grid columns, creation path; added three Rev 1 scope notes
  (Default Vendor in Rev 1, Dimensional Information in Rev 1, Rev 2)
- spec/parts_master_spec.md: updated Stock Size column and filter
  sources to Part.stockSize; added stockSize as a Part Form field
  with conditional-required behavior; added stockSize to the
  Definition Change Flag triggers; removed stale "stock size is a
  property of MaterialSpec" language
- spec/definition_change_flag_spec.md: added MaterialSpec field-
  trigger rules (materialName and form trigger flags; isActive does
  not)
- prisma/schema.prisma: synced with schema.md changes
- Migration 20260521180000_material_spec_reconciliation applied to
  dev branch (DROP COLUMN on stockSize and unitOfMeasure with
  IF EXISTS guards, CREATE UNIQUE INDEX on composite key, ADD COLUMN
  on Part.stockSize)
- Seed re-ran cleanly with updated schema
- Vendor service verification re-ran cleanly (no regressions)

### Files affected

- spec/schema.md
- spec/configuration_management_spec.md
- spec/parts_master_spec.md
- spec/definition_change_flag_spec.md
- prisma/schema.prisma
- prisma/migrations/20260521180000_material_spec_reconciliation/migration.sql

---

## 2026-05-27 — Deviation footer convention made explicit in CLAUDE.md

**Phase:** 1A
**Spec section:** CLAUDE.md (Hooks and Project Maintenance section)
**Discovered by:** Phase 1A consultant (during Vendor mockup commit retrospective)
**Status:** Resolved-Spec-Updated
**Commit:** c8625b7

### What the spec said

CLAUDE.md's Hooks and Project Maintenance section described the
deviations hook's behavior — appends a structured stub to DEVIATIONS.md
when the commit message contains both `Deviates-From:` and
`Deviation-Summary:` footers — but did not explicitly direct consultant-
authored prompts to include those footers when proposing commits that
modify the spec corpus.

### What was discovered

During the Vendor mockup work (commit e2a363d), a consultant in a
separate conversation window drafted a Claude Code prompt that updated
the configuration_management_spec but omitted the deviation footers
from the commit message. The deviations hook correctly did nothing
(no footers, no trigger), and the deviation entry had to be authored
by hand directly in DEVIATIONS.md. This bypassed the hook's
auto-population of the commit hash, which then required backfilling
in commit c8625b7.

The convention existed structurally but was implicit in CLAUDE.md.
Other Claude.ai conversation windows working on this project don't
inherit context from this conversation — each one reads CLAUDE.md
fresh. If the convention isn't documented there, it has to be
re-established in every conversation.

### Resolution

CLAUDE.md's Hooks and Project Maintenance section now explicitly
documents that any commit which changes the spec corpus should
include `Deviates-From:` and `Deviation-Summary:` footers, with the
expected format and the consequence of omitting them. This convention
is now discoverable by any consultant agent reading CLAUDE.md without
requiring out-of-band knowledge transfer.

This is the inverse of the convention/decision distinction discussed
earlier in the build: a convention that was being followed informally
in one workstream got bypassed in another because it wasn't formalized.
Formalizing it in CLAUDE.md prevents the same bypass from recurring
in future mockup work or contributor onboarding.

### Files affected

- CLAUDE.md (Hooks and Project Maintenance section expanded with
  explicit footer-convention guidance)

---
