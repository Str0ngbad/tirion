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

## 2026-05-28 — Vendor gains location and website fields surfaced during mockup work

**Phase:** 1A
**Spec section:** schema.md (Vendor model) and configuration_management_spec.md (Vendor Management section)
**Discovered by:** User, during Vendor configuration grid mockup work
**Status:** Resolved-Spec-Updated
**Commit:** 3ce979cc03f84aacfed2dfff8d28447cf555b3dd

### What the spec said

The Vendor model in schema.md defined six fields: vendorId, vendorName,
contactInfo, leadTimeDays, notes, and isActive. The
configuration_management_spec listed the corresponding columns in the
Vendor grid. Neither spec referenced location or website as Vendor
attributes.

### What was discovered

During Vendor configuration grid mockup work, the user referenced the
predecessor spreadsheet system and identified that Location (city,
state) and Website were fields that had earned operational value
through years of real use. Both fields support distinct workflows:
location for shipping context and regional awareness, website for
direct navigation to vendor catalogs and ordering portals. Neither
maps cleanly into the existing contactInfo free-text field.

The discovery also surfaced that contactInfo itself is a free-text
blob that would benefit from decomposition into structured fields
(contactName, phone, email). That decomposition is deferred to Rev
1.5+ to keep Rev 1 scope tight; location and website were treated as
additive changes rather than folded into a contactInfo restructuring.

### Resolution

- schema.md Vendor model: added location String? and website String?
  adjacent to contactInfo. Both nullable; both displayed in grid and
  detail modal.
- configuration_management_spec.md Vendor Management: updated grid
  columns table, updated detail modal fields list, added a note
  documenting the contactInfo decomposition deferral with rationale.
- prisma/schema.prisma synced.
- Migration 20260528143003_vendor_location_website applied to dev
  branch (two ALTER TABLE ADD COLUMN statements; both columns
  nullable, no risk to existing data).
- Vendor service layer updated to handle both fields in create,
  update, audit logging, and response shaping.
- Vendor Zod schemas updated: light URL validation on website via
  .url() in CreateVendorSchema and UpdateVendorSchema; bare nullable
  in VendorWithCountsSchema.
- Verification script updated to exercise both fields; all 15 steps
  still pass.
- TESTS_BACKLOG.md gained an entry for the contactInfo decomposition
  Rev 1.5+ work (commit f72761c).

### Files affected

- spec/schema.md
- spec/configuration_management_spec.md
- prisma/schema.prisma
- prisma/migrations/20260528143003_vendor_location_website/migration.sql
- lib/vendors/schemas.ts
- lib/vendors/service.ts
- scripts/verify-vendor-service.ts

---

## 2026-05-28 — edit-distance autocomplete in cascade modal anticipates Rev 1.5+

**Phase:** _To be filled in._
**Spec section:** spec/configuration_management_spec.md
**Discovered by:** _To be filled in._
**Status:** Captured (rationale TBD)
**Commit:** 0cc28d3fb7fc0fa87cea66b0b925e4037815d034

### What was discovered

_To be filled in._

### Resolution

_To be filled in._

### Files affected

_To be filled in._

---

## 2026-05-28 — modal edit path replaces inline field editing implied by spec

**Phase:** _To be filled in._
**Spec section:** spec/configuration_management_spec.md
**Discovered by:** _To be filled in._
**Status:** Captured (rationale TBD)
**Commit:** 0dc56e640db251df69ad65662b5958ccb658ec15

### What was discovered

_To be filled in._

### Resolution

_To be filled in._

### Files affected

_To be filled in._

---

## 2026-05-29 — dialog redesigned as count cards with 3 expandable panels; not spec sections

**Phase:** _To be filled in._
**Spec section:** spec/routing_template_editor_spec.md
**Discovered by:** _To be filled in._
**Status:** Captured (rationale TBD)
**Commit:** 0784aca85333dcd9dbfbd8665b1ae658528f1d5e

### What was discovered

_To be filled in._

### Resolution

_To be filled in._

### Files affected

_To be filled in._

---

## 2026-05-31 — Nine additive Part fields and DCF trigger clarification surfaced during mockup work

**Phase:** 1A
**Spec section:** schema.md (Part model) and parts_master_spec.md (Part Form, Definition Change Flag triggers, Grid Columns sections)
**Discovered by:** User, during Part Form mockup work
**Status:** Resolved-Spec-Updated
**Commit:** fc67c29

### What the spec said

The Part model in schema.md defined the core operational fields
required for Phase 1A's Parts Master: identifiers, type, procurement,
material/vendor relations, routing, BOM linkage, inventory location,
stock count, and lifecycle. Neither schema.md nor parts_master_spec
included vendor part numbers, inventory thresholds, CAD documentation
links, pricing data, or manufacturing metrics — fields the user's
predecessor spreadsheet system had accumulated as operationally
meaningful over years of real use.

### What was discovered

During Part Form mockup work, the user referenced the predecessor
system and identified nine fields with proven operational value that
were missing from the Rev 1 spec:

- vendorPartNumber: required for buyer workflow (the SKU to identify
  when ordering from a vendor)
- binMin and binMax: inventory threshold data that allows users to
  begin populating the values now in preparation for the Stock
  Fulfillment lens (Phase 4) consumption
- modelLink and drawingLink: light CAD integration enabling a Part
  to reference its model file and engineering drawing directly
- partCost and partCostUpdatedAt: pricing data with a service-managed
  timestamp that records when the cost was last recorded
- machineCycleTime and numberOfSetups: manufacturing metrics that
  inform routing decisions and capacity planning

The fields are reference, inventory threshold, pricing, and operational
metric data — not Part identity. As such, they do not trigger the
Definition Change Flag system; this clarification was added to the
spec to prevent future confusion about flag scope.

The discovery also surfaced that several additional fields explored in
the mockup (vendor part number, model link, drawing link, part cost,
cost last updated, machine cycle time, number of setups) had originally
been considered Rev 2 work. The user's evaluation was that the
operational cost of populating these fields was minimal and the value
of having the data structure in place justified adding them as
additive Rev 1 fields rather than deferring.

### Resolution

- schema.md Part model: added nine nullable fields in logical groupings
  (identification, vendor, manufacturing, inventory, cost).
- parts_master_spec.md updated:
  - Material & Vendor section: vendorPartNumber documented with
    conditional display rule
  - New Documentation subsection: modelLink and drawingLink with URL
    validation and clickable-link display rules
  - New Manufacturing subsection: machineCycleTime and numberOfSetups
  - Inventory section: binMin and binMax with warn-not-block rule for
    binMax < binMin
  - New Cost subsection: partCost with Decimal precision rationale,
    partCostUpdatedAt as read-only auto-managed field
  - Definition Change Flag triggers section: explicit clarification
    that the nine new fields do not trigger flags
  - Grid Columns section: new fields documented as available columns
- prisma/schema.prisma synced; partCost uses @db.Decimal(10, 2)
- Migration 20260531125555_part_field_additions applied to dev branch
  (nine ALTER TABLE ADD COLUMN statements; all columns nullable, no
  risk to existing data)
- Seed re-ran cleanly with the updated schema
- Vendor service verification re-ran cleanly (no regressions)
- /lib/parts/ does not yet exist; Phase 1B Part service will be built
  against the updated schema from the start

### Files affected

- spec/schema.md (Part model, Mockup Work Change Summary)
- spec/parts_master_spec.md (multiple sections)
- prisma/schema.prisma (Part model)
- prisma/migrations/20260531125555_part_field_additions/migration.sql

---

## 2026-05-31 — Part Form design decisions from mockup track operationalized in spec

**Phase:** 1A
**Spec section:** parts_master_spec.md (Part Form section and subsections)
**Discovered by:** User, during Part Form mockup work
**Status:** Resolved-Spec-Updated
**Commit:** 12c1179

### What the spec said

The parts_master_spec described the Part Form at a higher level of
abstraction: it noted the form's existence, its sections, the fields
within them, the Definition Change Flag system as a concept, and the
in-context creation pattern for MaterialSpec and Vendor. But it did
not specify the form's surface pattern (modal vs side panel),
click-to-section navigation behavior, bidirectional BOM traversal
mechanics, in-context creation modal field boundaries, the specific
gating logic for the Definition Change Flag dialog, or the inline
sync between grid edits and form panel edits.

### What was discovered

During Part Form mockup work, six concrete design decisions emerged
that the spec had not pinned down. Each was a clarification or
operationalization of patterns the spec implied but did not specify:

1. The Part Form uses a side panel pattern at ~33% width with grid
   push, distinct from the modal-overlay pattern used by configuration
   surfaces. The side panel is a long-lived navigation surface
   supporting cross-Part navigation, scroll-to-section workflows,
   and cross-surface modal navigation per ADR-013.

2. Clicking a specific column in the grid scrolls the open panel to
   the form section corresponding to that column. The column-to-
   section mapping enables "I want to look at this specific aspect of
   this Part" workflows without manual scrolling.

3. The Part Form supports bidirectional BOM traversal: Parent
   Assemblies on all Parts (Parts and Assemblies alike), Child Parts
   on Assemblies only. Both sections render clickable rows that
   navigate the panel.

4. The in-context creation modals in the Part Form have specific
   boundaries: the MaterialSpec cascade modal is create-only (edit
   happens in MaterialSpec Management); the Vendor create modal is
   minimal (name, contact, lead time, notes — website and location
   deferred to Vendors surface). Both paths create real database
   records via standard API endpoints.

5. The Definition Change Flag dialog fires when BOTH conditions are
   true at Save time: a definition field changed (materialSpecId,
   defaultVendorId, routingTemplateDefinitionId, stockSize,
   blankLength) AND the Part has downstream impact (BOM child
   references, open WOs, or stock > 0). Otherwise Save commits
   silently. The dialog parallels the Routing Template Editor's
   Edit-Time Dialog; implementation is encouraged to share a
   component.

6. Inventory fields (stockCount, inventoryLocation, binMin, binMax)
   sync bidirectionally between the grid's inline editing and the
   form panel's Inventory section. Both surfaces operate on the same
   record in memory.

### Resolution

- parts_master_spec.md updated with six new or expanded subsections:
  - Surface Pattern (side panel + grid push, with rationale and
    contrast against configuration surfaces' modal pattern)
  - Click-to-Section Navigation (column-to-section mapping table)
  - Bidirectional BOM Traversal (Parents on all, Children on
    Assemblies, both clickable)
  - In-Context Creation (Material & Vendor) (modal boundaries and
    field subsets per workflow)
  - Definition Change Flag Dialog (firing conditions, count cards,
    cancel/acknowledge flow, shared-component recommendation)
  - Inventory inline sync (bidirectional sync between grid and panel)

- No schema changes, no migrations, no code changes required.

- The spec changes reference ADR-013 for the cross-surface navigation
  pattern that the in-context creation flows depend on.

### Files affected

- spec/parts_master_spec.md (multiple subsections added or expanded
  in the Part Form section)

---

## 2026-05-31 — ProcurementType enum replaced by ProcurementCategory configurable lookup

**Phase:** 1A
**Spec section:** schema.md (Part model, ProcurementCategory model);
  configuration_management_spec.md (new ProcurementCategory Management
  section); seed_data_spec.md (new Section 3, AuditAction count update)
**Discovered by:** User, during Parts Master Grid spec drafting
**Status:** Resolved-Spec-Updated
**Commit:** c98ac7e

### What the spec said

schema.md defined Part.procurementType as a three-value enum:
ProcurementType { Make, Buy, MakeBuy }. The grid spec's column
inventory drafting referenced this field as a categorical column for
the Parts Master Grid.

### What was discovered

The three-value enum was operationally insufficient. The user's
predecessor system used five categories that distinguish how a Part
is procured at meaningful granularity:

- CTL (Cut to Length): material cut to length by a vendor specifically
  for this Part
- PO (Part Off): material cut in-house from stocked material
- P (Purchased): finished purchased component
- SM (Sheet Metal): sheet metal stock
- HW (Hardware): fasteners, fittings, off-the-shelf components

These distinctions matter operationally. "Cut to Length" and "Part Off"
look similar to a generic Make/Buy enum but have different vendor and
inventory implications. "Purchased" is genuinely different from
hardware purchasing because hardware tends to be standardized and
ordered in bulk. The enum collapsed these distinctions and forced
operational workflows to lose information.

Making the categorization admin-configurable rather than enum-fixed
also accommodates future evolution. If the shop's procurement
patterns shift, admins can add categories without requiring a schema
migration. This matches the broader pattern in Tirion of moving
business categorization out of enums and into lookup tables (the
prior MaterialSpec reconciliation followed a similar shape, replacing
implicit material categorization with a configurable model).

### Resolution

- schema.md: new ProcurementCategory model with categoryCode (unique),
  categoryName (unique), description, displayOrder, isActive. Part
  model gains procurementCategoryId Int? with relation. The
  ProcurementType enum is removed.
- configuration_management_spec.md: new ProcurementCategory Management
  section documenting Purpose, Schema, Grid Columns, Detail Modal
  Fields, Creation, Editing, Deactivation Rules, and Initial Seed.
  Configuration surfaces count updated from five to six. Permissions
  table extended.
- prisma/schema.prisma: synced with schema.md changes.
- Migration 20260531145717_introduce_procurement_category applied to
  dev branch. Creates ProcurementCategory table with seed-friendly
  structure; adds procurementCategoryId column to Part with foreign
  key; drops procurementType column from Part; drops ProcurementType
  enum type. All DROP statements use IF EXISTS for idempotency.
- No Part records existed in the database, so the procurementType
  column drop required no data migration.
- prisma/seed.ts: new seedProcurementCategories function upserts the
  five starting categories keyed on categoryCode. Four new AuditActions
  added to the Configuration category. The main seed entry point
  calls seedProcurementCategories alongside the other seed functions.
  Verification log updated.
- seed_data_spec.md: new Section 3 documents ProcurementCategory seed
  values (the five categories with their codes, names, descriptions,
  and displayOrder). AuditAction total updated from 63 to 67 in two
  places. Section numbering for downstream sections (AuditAction,
  Initial Admin, What Is NOT Seeded) shifted by one.
- Two stale references to procurementType in scripts/verify-vendor-
  service.ts and scripts/verify-vendor-actions.ts were removed during
  the type-check step. These were test fixture artifacts; the field is
  now absent from Part creation in test code, which works correctly
  since procurementCategoryId is nullable.
- All verification passes: tsc clean, 15-step Vendor service
  verification clean, seed produces expected counts (9 ProcessTypes,
  16 sub-statuses, 67 AuditActions, 5 ProcurementCategories, 1 admin).

The ProcurementCategory backend (service, routes, verification script,
configuration management surface implementation) follows in a separate
commit, applying the established pattern from Vendor and MaterialSpec
work.

### Files affected

- spec/schema.md
- spec/configuration_management_spec.md
- spec/seed_data_spec.md
- prisma/schema.prisma
- prisma/migrations/20260531145717_introduce_procurement_category/migration.sql
- prisma/seed.ts
- scripts/verify-vendor-service.ts
- scripts/verify-vendor-actions.ts

---

## 2026-05-31 — Views System foundation added to grid spec, with new AuditAction category

**Phase:** 1A
**Spec section:** parts_master_grid_spec.md (Views System section); seed_data_spec.md (View section, AuditAction Views category)
**Discovered by:** User, during Parts Master Grid spec drafting
**Status:** Resolved-Spec-Updated
**Commit:** f29b65d4ffeba61244e3b568a539aad30da7d316

### What the spec said

The grid spec described the columns, sort behavior, filters, and
column-header menu but did not yet document the Views system — the
named saved configurations of column visibility, ordering, sort,
and filters that compose those primitives into reusable
operational tools.

MOCKUP_TRACK.md's Pattern E exploration described the Views system
design with recommendations for the data model, the Views switcher,
and the bootstrap. Those recommendations needed to be lifted into
the spec with the design refinements made during this consultation.

### What was discovered

The Views system design as captured during mockup track exploration
needed three substantive refinements before landing in the spec:

1. The Master View needs to be locked. The original mockup track
   notes described Views with a default flag but did not separate
   "default" (loads on first open) from "locked" (cannot be deleted
   or saved over). A locked Master View with full column visibility
   provides a reliable starting point for building derived Views,
   prevents accidental loss of the canonical baseline, and
   simplifies the Rev 1 invariants.

2. Audit metadata on the View model itself (createdAt, updatedAt,
   createdByUserId, updatedByUserId) was deferred. The columns are
   inexpensive but not yet operationally needed. Adding them
   speculatively conflicts with the "build what's needed when it's
   needed" principle. They can be added additively if operational
   need emerges.

3. The audit action set was scoped to three actions (ViewCreated,
   ViewUpdated, ViewDeleted). The originally-considered
   ViewDefaultChanged action is deferred because the default View
   does not change in Rev 1 (Master is permanently default). The
   ViewModified action was rejected as overlapping with ViewUpdated.

### Resolution

- parts_master_grid_spec.md: new Views System section after the
  Filter System section. Covers the View data model (viewId, name,
  isDefault, isLocked, three Json columns), the Filter Object
  Shape with value-shape variation by operator type, naming
  constraints (1-30 chars, unique, free text), the Master View
  concept and its invariants, the View switcher UI (dropdown with
  default View at top, others alphabetical), the bootstrap with
  five seeded Views (Master View, Material Audit, Inventory Check,
  No Routing Flagged, Part Identification), and the audit logging
  scope.

- seed_data_spec.md: new Section 4: View documenting the five
  seeded Views with their key fields and the upsert-on-name
  seeding pattern. New Views AuditAction category with three
  entries. AuditAction total updated from 67 to 70. Subsequent
  sections renumbered. Verification log expectations updated.
  Seeding order updated to include Views.

- The schema migration for the View model is deferred to Phase 1B
  when the Parts Master backend is built. This follows the
  established pattern from the nine Part field additions earlier —
  spec describes the model, migration follows when there's a
  consumer for the table.

The View Modification Model (Save / Save as new / Revert flows),
Columns Picker, Active Filters chrome, and View Management Modal
follow in subsequent commits as separate concerns.

### Files affected

- spec/parts_master_grid_spec.md
- spec/seed_data_spec.md

---
