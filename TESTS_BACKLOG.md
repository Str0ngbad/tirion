# Tirion — Deferred Tests Backlog

This document tracks tests that should be written but were deferred from
Rev 1 per the pragmatic testing approach defined in CLAUDE.md.

Rev 1 testing focuses on business logic and transactions. Tests for CRUD
operations, UI components, and end-to-end flows are deferred to Rev 1.5
or Rev 2.

When a test is deferred during the build, add it here with enough context
to write it later.

---

## Entry Template

```markdown
## [Phase] — Short Description

**Type:** [Unit | Integration | E2E]
**Area:** [feature or module]
**Why deferred:** [reason — usually "deferred per Rev 1 testing approach"]

### What to test

[Description of the behavior]

### Test outline

[Setup, action, assertion sketch]

### Notes

[Anything else relevant — related deferred tests, dependencies, etc.]
```

---

## Backlog

---

## Hook Issues / Tooling Debt

### Self-review hook log.md write is sandbox-blocked

The PostToolUse self-review hook completes successfully and produces review
output, but the sub-agent is consistently blocked from writing to
.claude/reviews/log.md. Verdicts surface in-session but do not persist.

Impact: lost historical record of self-review verdicts; reviews must be
captured manually if needed for retrospective.

Diagnostic notes: First observed during Phase 0a hook setup; reproduces on
every commit. The block fires from the sub-agent's write step, not from
the hook script itself. Likely a Claude Code sandbox or permissions
configuration; not investigated further during Phase 0a.

Phase: 0a — to revisit in Rev 1.5+

---

### AuditAction naming: ETA case inconsistency

Two AuditAction entries use different capitalization for the same acronym:
- WOEtaUpdated (Eta as word stem)
- SupplyOrderLineETAUpdated (ETA fully capitalized)

Both spellings exist in seed_data_spec.md, schema.md, and prisma/seed.ts.
The inconsistency was inherited from the spec and not introduced during build.

Resolution requires a decision on canonical case style for acronyms across the
codebase, then a coordinated update across spec + schema + seed + any downstream
consumers (route paths, audit log queries, Zod schemas).

Out of scope for Rev 1 build; capture for Rev 1.5+ cleanup pass.

Phase: 1A — captured but deferred

---

### Deviations hook auto-populated date may be off by one

The deviations hook's auto-appended stub headers have shown dates one
day behind the actual local date on at least two occasions (commits
1ec1d1b on 2026-05-21 stub-dated 2026-05-20; commit 3fbfde4 on
2026-05-21 stub-dated 2026-05-20). The discrepancy may stem from a
timezone mismatch in the hook script (e.g., UTC vs local time when the
date is generated near midnight) or from a script reading a cached
date value.

Impact: cosmetic — deviation entries get manually corrected during
stub fill. No data integrity issue.

Diagnosis deferred to Rev 1.5+. Until then, manually correct the date
in the header when filling in each stub.

Phase: 1A — observed but deferred

---

### Verification scripts can leave residual test data on failure

The entity verification scripts (/scripts/verify-*-service.ts) follow a
try/finally cleanup pattern. However, if a script process is killed
hard (SIGKILL, container restart, abrupt window close) before reaching
the finally block, partial test data persists in the database.

This was observed during Phase 1D when verify-routing-template-service.ts
failed due to a residual record named __verify_template_A__ from a
prior aborted run. The failure was unrelated to the change under test
(BOM displayOrder removal) but presented as a regression.

The current mitigation is manual cleanup when a failure is diagnosed
as residual data. A more durable mitigation would be one of:

- Idempotent test data setup: prefix all verify-script test records
  with a known sentinel and delete-by-prefix at the start of every
  script (idempotent setup, not idempotent cleanup).
- Per-run unique suffix: include a random or timestamp suffix in
  test record names so collisions are statistically impossible.
- A dedicated cleanup script: /scripts/cleanup-verify-residuals.sh
  that deletes all records matching the verify-prefix pattern.

The first option (idempotent setup at script start) is the lightest
intervention.

Discovered: Phase 1D, during the displayOrder schema migration
verification sweep.

Suggested timing: When a future verification script failure is
traced to residual data again, take the cleanup pattern as part
of that triage. Until then, the current cost (one manual cleanup
every few months) is acceptable.

**Inverse failure mode also observed (Phase 1E):** A verify script
can also fail because it _depended on_ residual data from prior
runs. verify-grid-endpoint.ts was passing on Phase 1B Unit 3
because verify-part-service.ts left Part rows behind. When Phase
1C/1D introduced BOM verify scripts with proper cleanup, the
residual Parts were eventually cleared and the grid endpoint script
began failing on the now-empty database. The script never created
its own fixtures.

Mitigation: every verify script must own its fixtures end-to-end —
create what it needs at the start, delete what it created in a
finally block, never depend on residual state. The Phase 1E fix to
verify-grid-endpoint.ts establishes this pattern explicitly. It also
adds an idempotent pre-run cleanup block (delete-by-known-name at
the top of main()) so a prior aborted run does not block the next
run with a name-collision error.

---

### project_tracker.md has no "In Progress" status

The tracker script reports each phase as either "Not Started" or
"Done" based on the presence of expected deliverable files (e.g.,
Phase 0a's ADR detection). There is no "In Progress" status for
phases where some work has been committed but not all deliverables
exist.

Observed: as of commit 3a850d2, five Phase 1A commits have landed
(seed file, spec corrections, deviation logs, AuditAction additions)
but project_tracker.md still reports Phase 1A as "Not Started."

Impact: the tracker's status field becomes misleading during active
phase work. Anyone reading the tracker mid-phase has to look at git
history to know whether work has begun.

Resolution path (deferred): teach the tracker script to detect partial
progress via either (a) a count of commits since the phase started,
(b) the presence of some-but-not-all expected deliverables, or
(c) a manually-maintained phase status field.

Phase: 1A — observed but deferred

---

### Pre-existing TypeScript errors in scripts/import-prior-shop-data.ts

The Phase 1E import script (scripts/import-prior-shop-data.ts,
commit 12ad34b) has pre-existing TypeScript errors that have
persisted through subsequent UI work (commits 65d45ff and e88672d).
Each new commit has confirmed the errors are isolated to the
import script and don't affect production code.

The script ran successfully and produced correct data outcomes
(the imported data is valid and complete). The TypeScript errors
are at compile-time only — likely implicit `any` types or non-null
assertions that work at runtime but don't satisfy strict mode.

Action when convenient: read the script, identify the specific
errors, fix them. Likely a 30-60 minute task. Worth doing before
the next major data import (if any) so the script doesn't accrue
more debt.

Discovered: ongoing observation across Phase 2 UI commits.
Suggested timing: during a quiet maintenance pass, or as a warmup
task before another large implementation.

---

## Spec Consistency

### UI surface naming not locked in terminology_lock

The terminology_lock.md spec covers entities, states, and operations
but does not lock the names for UI surfaces. As a result, the same
surface is referred to by multiple names across the spec corpus:

- The Vendor configuration grid / Vendor Management Surface / Vendors
  surface / Vendor library (informal user-perspective name)
- Likely similar issues exist for Materials, Users, ProcessTypes,
  ProcessTypeSubStatus, Parts Master, lenses, Project View, etc.

Impact: minor inconsistency when reading the spec; risk of larger
inconsistency as more UI is built without canonical names locked.

Resolution path (deferred): once UI surfaces are more concretely defined
in Phase 1+ work, do a single pass adding a "UI Surfaces" section to
terminology_lock.md that lists each surface with its canonical name
and a brief description. Then update spec references to use the
canonical names.

Best timing: end of Phase 1A or start of Phase 1B, when the
configuration grids are built and the Part Form / Parts Master are
being designed. By then we'll have hands-on knowledge of which names
feel right.

Phase: 1A — observed but deferred

---

### Stale stockSize references citing MaterialSpec in downstream spec files

Two spec files reference `stockSize` via a path that no longer exists
after the MaterialSpec reconciliation (commit 26e4e4c), which moved
`stockSize` from MaterialSpec to Part:

- **purchasing_lens_spec.md** Grid Columns table — Stock Size listed as
  "From MaterialSpec — sortable". Correct path is `Part.stockSize`.
- **project_view_spec.md** WO grid columns table — Stock Size source
  listed as `Part.materialSpec.stockSize`. That path doesn't exist;
  correct path is `Part.stockSize`.

Root cause is the same for both: the MaterialSpec reconciliation updated
schema.md and configuration_management_spec.md but did not sweep
downstream specs that referenced the old path.

Impact: minor. Neither surface is being built until Phase 6+ (Purchasing
Lens) or Phase 7+ (Project View WO grid), so the drift doesn't affect
current work. But anyone reading either spec to understand where Stock
Size comes from will get an incorrect answer.

Resolution: when Phase 6 or Phase 7 work begins on these surfaces,
update both references to read `Part.stockSize` (or prose equivalent
matching the Parts Master spec). Also run a fresh grep across the spec
corpus at that time — other downstream specs may have acquired similar
drift by then.

Phase: 1A — observed during MaterialSpec implementation planning

---

### Column ID conventions diverge between parts_master_spec and parts_master_grid_spec

The Parts Master Spec's Grid Columns table uses display-friendly labels in
its Source column (e.g., "materialSpec.materialName", "defaultVendor.vendorName")
while the Parts Master Grid Spec's Column Inventory uses normalized column IDs
(e.g., "materialName", "defaultVendorName"). The seed Views in Phase 1B Unit 1
used the grid spec's IDs as canonical, which is correct, but the older spec
should be normalized to match to prevent future confusion.

Discovered: Phase 1B Unit 1, during Master View seed implementation.
Action: Normalize parts_master_spec.md column references to match
parts_master_grid_spec.md's Column Inventory IDs.
Suggested timing: Phase 10 spec reconciliation pass.

Follow-up observation (Phase 1B Unit 3): the seed Views use the column ID
"procurementCategory" while the PartRow type uses "procurementCategoryName".
The sort and filter builders accommodate both aliases. This is the same
class of drift as the original entry — column IDs are not consistently
named across the spec corpus, the seed data, and the API response shapes.
The Phase 10 normalization pass should reconcile all three layers to a
single canonical ID per column.

Phase: 1B — observed during Master View seed implementation; extended Phase 1B Unit 3

---

### Multi-select inverse operator (is_none_of) missing from filter operator inventory

The Parts Master Grid spec's Filter Operator Inventory documents
multi-select filtering via "is any of" but does not explicitly document or
omit an inverse "is none of" operator. The discriminated union in
lib/views/schemas.ts only includes is_any_of; the filter builder
constructed in Phase 1B Unit 3 supports only is_any_of accordingly.

The exhaustive switch on the operator discriminator will surface a
compile error if is_none_of is added to the union later, so this is
not a runtime risk — it is a spec/scope clarity issue.

Discovered: Phase 1B Unit 3, during filter builder implementation.
Action: Determine whether is_none_of is intentionally deferred (and the
spec should state so explicitly) or whether it should be added to Rev 1
(and the schema, types, builder, and verification script need updates).
Suggested timing: Phase 10 spec reconciliation pass, or earlier if user
feedback during Parts Master Grid use surfaces the need.

Phase: 1B — observed during filter builder implementation

---

### AuditAction naming conventions diverge across entities

Each entity backend has picked its own lifecycle verb convention for
AuditActions, with no pinned norm in spec:

- Vendor: VendorCreated / VendorUpdated / VendorDeactivated /
  VendorReactivated
- Part: PartCreated / PartUpdated / PartDeactivated / PartReactivated
- RoutingTemplate: RoutingTemplateCreated / RoutingTemplateEdited /
  RoutingTemplateRetired / RoutingTemplateReactivated
- View: ViewCreated / ViewUpdated / ViewDeleted

Three distinct conventions across four entities: "Updated" vs "Edited",
"Deactivated" vs "Retired", "Deleted" (Views, hard delete) vs
"Deactivated/Retired" (soft delete). The differences are semantic in
some cases (Views hard-delete; others soft-delete) but inconsistent in
others (Edited vs Updated is purely a vocabulary choice).

Discovered: Phase 1C, during RoutingTemplate backend implementation when
the prompt's expected verbs (Updated/Retired) did not match the
already-seeded values (Edited/Retired).

Action: Decide on canonical lifecycle verbs and normalize. Suggested
canonical: Created / Updated / Deactivated / Reactivated for soft-delete
entities; Created / Updated / Deleted for hard-delete entities. Normalize
both spec/seed_data_spec.md and prisma/seed.ts; backfill any AuditLog
entries already written under the old action names.

Suggested timing: Phase 10 spec reconciliation pass.

---

### partsReferencingCount consistency between list and detail endpoints

The Routing Template service has two paths that produce
`partsReferencingCount`:

- `toTemplateRow` (used by listRoutingTemplates): derives the count
  from Prisma's `_count.parts` on the relation.
- `getRoutingTemplate` (used by detail fetch): explicitly filters to
  active-only parts (see commit e88672d).

Code's reasoning for the detail-endpoint override: the
EditTimeDialog needs active-only semantics — inactive Parts
referencing a template don't represent operational impact for
edit-time review.

Open question: does the list endpoint's `_count.parts` also filter
to active-only, or does it count all parts regardless of isActive?
If the former, the two endpoints produce identical counts and
the override is a redundant safeguard. If the latter, the Library's
impact-check (uses the list shape) and the dialog (uses the detail
shape) may show different counts for the same template — a quiet
correctness issue.

Action when convenient:
1. Read /lib/routing-templates/service.ts and verify whether
   listRoutingTemplates includes a `where: { isActive: true }` filter
   on the parts relation in its `_count` definition.
2. If yes: no further work; document the consistency in a code
   comment.
3. If no: align the list endpoint to match the detail endpoint
   (filter to active-only).

Either outcome is small. The right time to address is either
during a Routing Template backend pass or once the Parts Master UI
makes any inconsistency visible.

Discovered: Phase 2 form implementation review, commit e88672d.

---

## Follow-up Implementation

### Part service does not validate Assembly + Purchase/Receive rule on routing template assignment

The spec states: "Assembly routing templates may not include Purchase or
Receive steps." The Phase 1C RoutingTemplate backend did not enforce
this at template creation because RoutingTemplateDefinition has no
appliesTo or partType field — the constraint can only be enforced at
the point where a Part references a template (assignment time).

Phase 1B Unit 2's Part service implements
PartRoutingTemplateInvalidError for existence/active validation when a
Part's routingTemplateDefinitionId is set, but does NOT validate the
Assembly + Purchase/Receive rule. A Part with partType: "Assembly"
can currently reference a template containing Purchase or Receive
steps without the API rejecting the request.

Discovered: Phase 1C, during the schema review for the Assembly +
Purchase/Receive validation placement decision.

Action: Extend the Part service's FK pre-validation for
routingTemplateDefinitionId. When the Part's partType is "Assembly"
and the input includes a routingTemplateDefinitionId, fetch the
template's steps with their ProcessType records. If any step's
ProcessType is Purchase or Receive (by code or category — confirm
against the seed's ProcessType definitions), throw a new error class
(e.g., PartAssemblyRoutingInvalidError) with details listing the
violating step indices.

This validation belongs in both createPart and updatePart.

Suggested timing: After Phase 1D BOM Editor backend completes, before
Phase 2 Spreadsheet Import. The import path would let users assign
invalid template/part combinations en masse if this gap is not closed
first.

---

### Vendor Open WOs Summary endpoint not yet implemented

Spec was updated in commit e2a363d to add an Open WOs summary to
the Vendor Detail Modal Fields (configuration_management_spec.md
Vendor Management section). The corresponding API endpoint has not
been built.

Specification: GET /api/v1/vendors/:id/open-wos-summary returning
three counts:
- total open WOs whose Part has this vendor as defaultVendorId
- awaiting receipt (open WOs in the ordered-not-yet-received state)
- awaiting purchase (open WOs in the not-yet-ordered state)

The two breakdown counts are disjoint subsets of total per the state
model; the remainder (total minus the two breakdowns) is WOs past
both purchasing and receiving.

### Design Decision

The endpoint's query logic should share its construction with
the Purchasing and Receiving lens services (Phase 6B+). The
"awaiting purchase" semantics correspond to "WO has Purchase
step not yet Complete" — the same filter the Purchasing Lens
uses. The "awaiting receipt" semantics correspond to "WO has
Purchase step Complete AND Receive step not yet Complete" —
the same filter the Receiving Lens uses.

Building the summary endpoint before the lens services exist
would mean writing query logic that should be shared with code
that doesn't exist yet, then refactoring later. Building the
lens services first makes the summary endpoint a thin wrapper
that calls them with count semantics rather than row-returning
semantics.

Phase: 1A — to implement after WorkOrder and lens services
land in Phase 1C+ / Phase 6B; the endpoint becomes a thin
wrapper around the lens query logic.

---

### Vendor contactInfo decomposition deferred to Rev 1.5+

The Vendor.contactInfo field is currently free text holding name,
phone, and email as a single string. configuration_management_spec.md
notes this is deferred to Rev 1.5+ to keep Rev 1 scope tight.

Specification when implemented:
- Decompose contactInfo into separate fields: contactName, phone,
  email (all nullable)
- Migration would parse existing free-text contactInfo into the
  structured fields where possible, leaving unparseable values in
  a fallback contactInfo field or flagging them for manual cleanup
- Vendor grid would gain dedicated columns for phone and email
  (clickable links for both — tel: and mailto:)
- Vendor create/update forms would show structured inputs instead
  of a single free-text field

Trigger: when buyer or admin workflow needs reliable structured
contact data (e.g., bulk emailing vendors, integrating with phone
systems, or contact-info validation).

Phase: Rev 1.5+ — deferred from Rev 1 (Vendor field additions commit
3ce979c)

---

### Routing template synthesis from CSV data for Phase 1E import

Phase 1E (real-data import from the user's prior shop's CSVs) will
need to derive RoutingTemplateDefinitions from per-part routing data.
The legacy CSV does not have a template concept — each Part Master
row has its own Machine/Weld/Blacken/Paint columns directly.

The agreed approach (between consultant and user during Phase 1D
wrap-up): synthesize templates by clustering Parts on their
(Machine, Weld, Blacken, Paint) combinations and assigning each
cluster a synthetic template name. A real shop typically has 5-15
distinct routing patterns covering most parts, with outliers.

Two additional considerations:
- Two ProcessTypes in the new Tirion data model do not exist in the
  legacy CSV. Some manual work will be needed to bring everything
  forward — Parts that should have these new process types will need
  manual template assignment post-import.
- Cluster naming: synthetic template names should be deterministic
  and readable (e.g., "Mill+Weld+Paint" derived from the constituent
  process types). The user will rename if the synthesized names are
  not operationally meaningful.

Discovered: Phase 1D wrap-up, during Phase 1E scoping discussion.
Suggested timing: Phase 1E — handled in the data mapping spec
(/spec/data_import_mapping.md, drafted during the Phase 1E
consultant session).

### Inventory Location collision warning behavior on Part create/update endpoints

The Part.inventoryLocation @unique constraint was removed (Phase 1E). The
schema no longer enforces uniqueness, and the dead
PartInventoryLocationCollisionError throw path in /lib/parts/service.ts is
unreachable.

The intended replacement behavior (per spec/parts_master_spec.md Inline
Editing section): the create and update endpoints succeed when a duplicate
location is provided, but include a warning in the response body identifying
the conflicting Part.

Implementation work required:
- Detect inventoryLocation duplicates against active Parts in
  createPart and updatePart (and updateInventoryLocation), inside
  the mutateWithAudit transaction.
- Return shape change: responses include an optional warnings array of
  `{ code, message, conflictingPartId, conflictingPartNumber }`.
- Optional: add a lookup endpoint (GET /api/v1/parts/by-location/[location])
  to support frontend pre-submit confirmation dialogs.
- Remove the PartInventoryLocationCollisionError class entirely once the
  dead reference is replaced.

Tie to: Parts Master UI work, when the frontend implements the confirmation
dialog. The API change should be informed by the frontend's consumption shape;
landing the API change before the UI is designed risks rework.

Discovered: Phase 1E import preparation; 41 collisions across 9 locations in
the Part Master CSV demonstrated the constraint did not match shop reality.

---

### Precision Ground Steel Parts imported with null materialSpec

The Phase 1E import (commit 12ad34b) left 8 Parts with materialSpecId
null because their Material value ("Precision Ground Steel") was not
in /data-import/material_normalization.csv. The consultant-user
discussion during Phase 1E mapping settled on A36 / Precision Ground
Flat as the canonical mapping for the most common case, but the value
ranges across multiple forms in the source data (not all are Flat).

The user routed this through material_mixed_form_resolution.csv during
the mapping pass to handle the multi-form case, but the import script
either did not match the csv_material_value spelling in the resolution
file, or did not consult the resolution file for these specific Parts.
Root cause not investigated at the time; the 8 affected Parts are a
small enough set to fix manually post-import via the Parts Master UI.

Action when convenient: when the Parts Master UI is functional, list
the 8 affected Parts (query: Part where Material in raw source =
"Precision Ground Steel") and assign the correct MaterialSpec per
Part based on Stock Size:
- Flat stock sizes → A36 / Precision Ground Flat
- Round stock sizes → likely O1 / Precision Ground Round or similar
  (consult per Part)
- Other forms → consult per Part

Discovered: Phase 1E import-report findings, commit 12ad34b.
Suggested timing: during initial Parts Master UI use.

---

### Bundle Assemblies will eventually use Distribution-only routing

Phase 1E imported all real-shop Assemblies through the synthesized
routing templates. The Assembly routing synthesis pairs an
Assemble or Weld step with Distribution (and any middle steps from
CSV flags).

Some Assemblies in the imported data are "bundle" Assemblies — they
represent a shipping unit that aggregates Parts and sub-Assemblies
without itself requiring any assembly work. The synthesis assigned
these to the standard "Assemble" template, which is functionally
fine (an empty Assemble step on a bundle is a no-op operationally)
but not semantically accurate.

The right long-term model is a "Distribution-only" routing template
(just the Distribution ProcessType, no Assemble, no Machine, etc.)
for bundle Assemblies. This template doesn't currently exist in the
imported data because the synthesis algorithm always pairs
Distribution with at least one work step.

Action when convenient: when the Routing Template Editor UI is
functional, create a "Distribution" template (single step:
Distribution ProcessType only) and reassign the bundle Assemblies
to use it. The bundle Assemblies are identifiable by user knowledge;
no programmatic identifier marks them.

Not urgent. The current Assemble assignment produces correct
behavior for now.

Discovered: Phase 1E wrap-up discussion.
Suggested timing: during initial Routing Template Editor UI use, or
later as bundle Assemblies are reviewed operationally.

---

## Operational Patterns

### Prisma migrations require manual handling in Claude Code's bash tool

The conventional Prisma workflow uses `prisma migrate dev` to author
and apply migrations. This command is interactive and requires a TTY,
which Claude Code's bash tool does not provide. Attempting `migrate
dev` in a Claude Code session fails with a TTY-related error
regardless of arguments (--create-only, --skip-seed, etc.).

The working pattern observed during commit c9ed3b8:
1. Update prisma/schema.prisma manually with the desired schema change
2. Create the migration directory and file manually:
   mkdir prisma/migrations/<timestamp>_<name>
   write the migration SQL by hand, matching Prisma's naming
   conventions (table_column_key for unique indexes, etc.)
3. Apply with `npx prisma migrate deploy` (non-interactive, applies
   pending migrations without asking questions)
4. Regenerate the Prisma client: `npx prisma generate`
5. Verify via re-running the seed

This pattern is conventional in CI/CD environments (migrate deploy is
the production-equivalent of migrate dev). It just happens to be
required here too because of the TTY constraint.

Resolution path (deferred): document this in CLAUDE.md's database
workflow section so future Code sessions know the pattern. Probably
worth a brief addition to ADR-011 as well, since the ADR currently
describes a workflow that assumes migrate dev works.

Phase: 1A — observed and operational

---

### Prisma client regeneration is not picked up by the running Next.js dev server

When schema.prisma changes and `npx prisma generate` regenerates the
typed client, the running Next.js dev server does not pick up the new
client automatically. The dev server has already imported the prior
client; Next's hot reload watches the project source tree but not
node_modules/.prisma/client where the generated client lives.

Symptom: the schema change lands, the migration runs, `npm run type-check`
passes (tsc reads the regenerated client from node_modules), but write
operations against the running server return 500 with errors referencing
the prior schema shape (missing columns, wrong types, etc.).

Discovered: Phase 1D commit 4, when BOM write smoke tests failed against
a server that had been running since before commit 74cd90e (drop
displayOrder). The fix was restarting the dev server.

Action: After any prisma migrate command, restart the dev server before
running smoke tests. The pattern:
  1. Make the schema change
  2. Run `npx prisma migrate dev --name ...`
  3. Run `npx prisma generate` (the migrate command usually does this)
  4. Stop the dev server (Ctrl+C in the npm run dev terminal)
  5. Restart `npm run dev`
  6. Run smoke tests

A more durable mitigation would be a dev script that wraps prisma
migrate to automatically restart the dev server, or a Next.js plugin
that watches the Prisma client output. Neither is needed at current
velocity — the manual restart is a few seconds and a known pattern.

Discovered: Phase 1D, Operational Patterns observation.
Suggested timing: Document in CLAUDE.md alongside migration guidance.
Lift to tooling if the manual step gets in the way more than once or
twice.

---

### Multiple verify scripts independently construct routing template fixtures

As of Phase 1E (commit 22f9378), four verify scripts each construct
their own routing template fixtures during setup:

- verify-vendor-service.ts (likely, via Part creation paths)
- verify-view-service.ts (similar)
- verify-routing-template-service.ts (necessarily — it's the system
  under test)
- verify-grid-endpoint.ts (just added)

The seed does not include any RoutingTemplateDefinition records. Each
script either creates a template, references it, then cleans it up,
or omits routing templates from its fixtures entirely.

This is currently fine — each script has specific fixture needs that
a shared seed template would not satisfy uniformly, and the per-script
cleanup is well-isolated. If the count of fixture-creating scripts
grows substantially (e.g., 7+) the duplication may become a
maintenance burden worth addressing via a shared fixture helper or a
seed addition.

Discovered: Phase 1E, during verify-grid-endpoint.ts fix.
Action: None for now. Revisit if the pattern proliferates beyond
about 6-7 scripts or if seed coordination across scripts becomes a
source of bugs.

---

### Import script runtime characteristics

The Phase 1E import script (scripts/import-prior-shop-data.ts, commit
12ad34b) took ~65 minutes for ~1850 Parts + ~370 Assemblies + ~2330
BOM edges against Neon. The consultant predicted 3-5 minutes; actual
was ~9x that.

Cause: each createPart service call performs 4-5 sequential DB queries
for FK pre-validation (defaultVendor active check, materialSpec active
check, procurementCategory active check, routingTemplate active check)
plus the transaction itself (Part insert + audit log write). At Neon's
network latency (~200ms per round-trip including TLS), per-Part cost
runs ~1-2 seconds. Multiplied across 1850 Parts plus BOM edges and
Assemblies, ~65 minutes is the actual cost.

The data outcomes are correct — idempotency was verified by re-running
in commit mode and observing zero new entities created. The import
worked; it was just slow.

Optimizations available if re-import is needed at higher frequency:
- Pre-cache FK lookups (Vendor, MaterialSpec, ProcurementCategory,
  RoutingTemplate) in memory at script start, eliminating per-Part FK
  queries
- Batch Part inserts inside larger transactions (cost: coarser error
  reporting per row)
- Run against a local Postgres instance instead of Neon (eliminates
  network latency)

Not worth doing for the one-off import. Logged so future runtime
estimates are calibrated and so the optimization path is documented
if a frequent-import scenario emerges (e.g., a customer with similar
prior-tool data wanting to migrate).

Discovered: Phase 1E import, commit 12ad34b.

---

### Smoke test residue in dev database

The form implementation's smoke testing created a "Smoke Test
Template" row, verified the create flow, then retired the template
via the API. The retired record remains in the database as an
inactive RoutingTemplateDefinition.

This is authentic operational behavior — retired templates persist;
the system is designed for soft-delete semantics. The residue does
not represent a bug.

Note for future work:
- Verify scripts that assume specific template counts should use
  active=true filters or expect the residue
- The Show Inactive toggle on the Library page surfaces this
  template
- If a fully clean dev DB is wanted for any reason (demo, fresh
  baseline), the retired template can be hard-deleted via direct
  prisma query: `prisma.routingTemplateDefinition.delete({ where: {
  templateName: "Smoke Test Template" } })` (also deletes the
  associated RoutingTemplateStep records via cascade).

Discovered: Phase 2 form implementation, commit e88672d.
Action: None required. Logged for awareness.

---

### processTypeName → ProcessTypeKey boundary assumption

The frontend's ProcessTypeKey type (from /lib/process-types.ts) is
a string-literal union matching the canonical names of seeded
ProcessTypes. The backend's API returns `processTypeName` as a
string from the database's ProcessType.processName field.

The Routing Template UI assumes these strings match — direct casts
from the API's `processTypeName` to `ProcessTypeKey` are used
throughout (e.g., the form's StepDraft initialization, the
EditTimeDialog's step rendering). The cast is currently safe
because both layers reference the seeded canonical names as
authority.

This assumption is fragile to a future change where:
- A new ProcessType is added to the DB schema/seed but not to
  ProcessTypeKey
- A ProcessType is renamed in the seed but ProcessTypeKey isn't
  updated
- The backend's `processTypeName` field starts returning a different
  value (e.g., lowercase, or includes additional formatting)

Mitigation options:
- Add a defensive runtime check at the boundary that maps API
  strings to ProcessTypeKey with a fallback for unknown values
- Generate ProcessTypeKey from the DB schema directly (e.g., via a
  build step that reads the seed)
- Add a verify-script assertion that confirms all seeded
  ProcessType.processName values match ProcessTypeKey members

Action when convenient: add the verify-script assertion (lowest
cost, highest leverage). Defer the boundary-cast hardening until
the assumption actually breaks.

Discovered: Phase 2 form implementation, commit e88672d.

---

### Seed-vs-spec drift in View configurations

Phase 2 Commit 2 (commit 0cce39f) shipped with the Master View seed
missing several columns and using older column IDs that didn't
match the production ColumnId type. The issues were discovered only
when the UI rendered Master View as incomplete and the user
surfaced the gap during review.

Pattern: seeded data and spec language drift apart silently. The
spec describes what each View should contain; the seed is the
implementation that should follow. When they diverge, the UI
exposes the gap, but only if someone notices during visual review.

Mitigation in this commit: added a verify-script assertion that the
Master View seed includes all non-excluded columns from ALL_COLUMNS.

Worth considering: similar structural assertions for the other
seeded Views (Material Audit, Inventory Check, etc.) — though
their column sets are smaller and more curated, drift there is
less likely to be silently incorrect.

If recurring drift becomes a real issue, the systemic fix is to
generate the seed Views from spec language (e.g., a structured
data file in /spec/views/ that the seed reads). Premature
optimization now; would be worth it if Views grew significantly
in number or complexity.

Discovered: Phase 2 Commit 2 user review.

---

## Categories Summary

| Category | Count | Notes |
|----------|-------|-------|
| Unit (CRUD) | 0 | |
| Unit (UI components) | 0 | |
| Integration (large workflows) | 0 | |
| E2E | 0 | All E2E deferred to Rev 2 per design |

Update counts as deferrals accumulate.

---

## Review Cadence

The user reviews this document:
- At the end of Rev 1 (Phase 10) to decide which deferred tests to write
  before declaring Rev 1 done
- At the start of Rev 1.5 / Rev 2 to plan a test-coverage push

The consultant references this document:
- When considering whether to defer a test during the build
- When the user asks "what's not tested" before a release
