# Mockup Track Session Log

This file records design exploration done on the Tirion mockup
track. The mockup track is a parallel workstream to the
implementation track: it builds functional HTML/React mockups to
validate spec ergonomics, surface design questions, and explore
patterns before implementation work commits to them.

Each entry below documents a session's exploration — what surfaces
were touched, what design decisions emerged, what's recommended
for implementation, and what stays mockup-only.

This file is the mockup track's record. Implementation track
decisions go in DEVIATIONS.md when those decisions land in code
that ships.

Entries are ordered most recent first.

---

## 2026-06-13 — Stock Fulfillment View — Iteration Pass 2

**Surfaces touched:** /app/mockups/stock-fulfillment/ — second iteration pass
addressing six reviewer findings.

**Mockup commits:**
- `7509097` — fix+feat: all six items combined (see breakdown below)

### Scope

Six findings addressed in this session:

1. **Candidates/Pending Release set semantics** — `pendingReleaseCount` was
   previously `reviewedAt !== null` (decided WOs only). Corrected to
   `unreleasedCount - candidateCount` so the invariant
   `Candidates + Pending Release = total Unreleased` holds continuously.
   `releaseProject` and `releaseAll` now exclude candidate WOs so candidates
   persist in the view while Pending Release WOs release to Open.
   Project headers now disappear when `unreleasedCount = 0` (not just when
   candidates = 0). Per-Project Release button simplified to
   "Release Project [Number]", disabled when `pendingReleaseCount = 0`.
   Global button: "Release All Pending (N)".

2. **Row shading** — removed `style={{ backgroundColor: colorMeta.tintRgba }}`
   from candidate table rows. Project color renders only in `ProjectIdPill`.
   Assembly rows get `bg-muted/10`, Part rows no background.

3. **Cumulative Demand column** — added between Stock and Due Date. Value is
   sum of `quantity` across candidate WOs only for the same `partId`. Renders
   in `text-amber-500` when cumulative > stock. Non-candidate demand excluded
   (goes to procurement regardless of planner decisions; adding noise without
   supporting action).

4. **Parent column** — replaced "BOM Position" with "Parent". Shows immediate
   parent assembly's `partNumber` (monospace). Top-level WOs render `—`.
   Hover tooltip shows full ancestry chain (closest ancestor first) using
   shadcn/ui `Tooltip`. All non-top-level WOs get the tooltip; the tooltip
   adds the part name even for single-ancestor cases.

5. **Expansion row cleanup** — now filters to candidates only via
   `getCompetingCandidates()`. Columns align with parent table (Project,
   Parent, Part Number, Part Name, Demand, Stock, Cumul. Demand, Due Date,
   Actions). Fulfill and Pass Through buttons on each expansion row; no
   Reconcile (stock reconciliation is a Part-level action covered by the
   parent row). Empty-state message when no other candidates exist.
   `getCompetingWos` renamed to `getCompetingCandidates` and now accepts the
   candidate list rather than full state.

6. **Active filter visual** — clicking a Project Header sets the project
   filter and shows a ring + "Filtered" label on that header. Clicking again
   clears it.

### Spec gaps / notes for implementation handoff

- **BOM Position → Parent**: The spec still says "BOM Position" column. This
  was a spec wording issue — the actionable info is the immediate parent, with
  deeper context via hover. The spec should be updated before real
  implementation references it.

- **Stale-state capture in handlers** (fixed in this pass for `handlePassThrough`
  via functional setState; `handleFulfill` and `handleReconcileConfirm` use
  derived values from the pre-action state which is acceptable since those
  handlers don't chain). Mockup-level issue; real implementation uses server
  actions so this pattern doesn't apply.

- **Header active-filter UX**: Clicking a header filters to that project AND
  the dropdown select stays at "All Projects" (not synced). If the user
  clears filter via the header (click again), the select returns to "All
  Projects" automatically. This is fine for a mockup but the real
  implementation should use a single filter state source.

### Verification results (Playwright)

All key assertions passed:
- Invariant holds on load: C+P=U for all 4 projects ✓
- No project-color inline style on candidate rows (tintedCount=0) ✓
- Top-level WOs show `—` in Parent column ✓
- Amber fires correctly: Tailstock Brake Assembly cumDemand=2 > stock=1 ✓
- Expansion: only competing candidate (10412) shown, 2 buttons, no Reconcile ✓
- Fulfill from expansion triggers auto-pass-through on 10121 Tailstock ✓
- Pass Through: C-1, P+1, invariant maintained ✓
- Per-Project Release: pending→0, button disabled, candidates unchanged ✓
- Active filter: ring styling, "Filtered" label, header/rows scoped ✓

---

## 2026-06-11 — Project Creation View — Surface Lock

**Surfaces touched:** /app/mockups/project-creation/ — final iteration pass before
implementation handoff.

**Mockup commits:**
- `bdb58d3` — fix: auto-focus Project Number on new Draft using projectName guard
- `3768835` — feat: retune Project Color palette to 13-color full-spectrum set
- `7324b74` — refactor: replace Project Color row tint with Project ID pill treatment

### Scope

Three focused changes completing the Project Creation surface:

1. **Project Number auto-focus** — new Drafts auto-focus the Project Number
   field on load. Guard added to prevent the focus from firing on existing
   Drafts with a projectName already set (guard: `!project.projectName`).

2. **Palette retune** — the 11-color palette from the prior session was
   replaced with a 13-color full-spectrum set. Added: Red, Yellow, Green,
   Light Green. Removed: Teal, Cyan, Indigo, Violet, Magenta, Electric Blue.
   Rationale: the prior palette excluded the warm half of the spectrum; the
   new palette covers the full hue wheel with better visual distinctness.
   Updated seeded color assignments: 17559→orange, 10256→blue, 10236→null,
   10121→green, 10030→brown.

3. **ProjectIdPill migration** — row tint + breadcrumb chip replaced with a
   unified `ProjectIdPill` component. The pill renders the Project Number
   as a solid-color pill when color is set, or as plain monospace text when
   color is null. Applied wherever Project Number is rendered: Project List
   rows, Draft Editor breadcrumb, Active Summary header. This is a reusable
   cross-surface UI primitive — its location at
   `_components/project-id-pill.tsx` is mockup-local; the implementation
   track should move it to the shared component directory.

### Surface status

**Locked for implementation.** The Project Creation View mockup is complete.
Handoff document: `mockup_track/project_creation_handoff.md`.

### Spec gaps

Project Color and the `ProjectIdPill` pattern are not in
`project_creation_view_spec.md`. A full list of gaps and what the
implementation track needs to backfill is captured in the handoff doc.

---

## 2026-06-10 — Project Creation View — Iteration Pass

**Surfaces touched:** /app/mockups/project-creation/ — iteration on all three
surfaces from the prior session.

**Mockup commits:**
- `7720780` — fix: delete icon contrast on Project List and Draft Editor rows
- `554f666` — feat: Add New Project wiring (session store + empty Draft state)
- `ccf5199` — feat: Project Color attribute with curated palette picker

### Scope

Four focused changes:

1. **Delete icon contrast** — raised resting opacity from `/40` to `/70` on
   Trash2 row actions in Project List and Draft Editor top-level items table.
   `/40` on a near-black background fails WCAG AA for icon controls (3:1
   minimum); `/70` passes. Hover retains `text-destructive` for maximum
   contrast.

2. **Add New Project wiring** — module-level session store added to `_data.ts`
   (`getSessionProjects` / `setSessionProjects` / `createNewProject`).
   Module scope persists across Next.js SPA navigations, so list page and
   detail page share project state without Zustand. New project IDs are
   synthesized monotonically starting at projectId=6 / projectNumber=17560.
   Empty Draft state in the editor: auto-focus on Project Number, always-
   visible validation banner (neutral empty-state message when no items),
   BOM Tree Preview section always renders (empty-state placeholder when
   no items). Project Number uniqueness validation on blur against all
   projects in the session store.

3. **Project Color** — see design decisions below.

4. **Persistent issue-resolution helper** — identified as a cross-surface
   pattern held for Rev 1.5+. Documented in `DEFERRED.md` (newly created).
   Not built in this pass.

### Design decisions made

**1. Session store via module scope (not Zustand / URL params)**

The mockup's prior architecture used isolated useState on each page, seeded
from INITIAL_PROJECTS. This worked for the five seeded projects (which never
change) but broke for new projects (created on list page, not visible on
detail page).

Decision: add a module-level `_sessionProjects` variable in `_data.ts`.
Module scope persists across client-side navigations in a Next.js SPA session.
Both page.tsx files initialize from `getSessionProjects()` and detail page
syncs back via `setSessionProjects()` in `updateProject()` and `onDeleteDraft()`.

The sync happens imperatively inside state updater functions (acceptable
side-effect pattern for a mockup). In production, this would be Zustand,
React Query, or a proper store. Module-scope state is a mockup-track shortcut
with a clear comment noting the real-world replacement.

**2. ID synthesis starting at 17560**

New projects created within the session get numeric IDs starting at 17560
(one above the highest seeded projectNumber). IDs are monotonically
incrementing per session. The code has an explicit comment that this is
mock-only; real implementation uses database auto-increment.

**3. Project Color — palette choices**

The palette excludes green, amber, and red ranges (reserved for status
indicators: active/pass/complete, warning/draft, error/fail respectively).
Also excludes rose/crimson (could read as status-red).

Final 11-color palette:
- Blue (#3b82f6) — professional neutral
- Teal (#14b8a6) — blue-green, clearly not status
- Cyan (#06b6d4) — bright but blue, not green
- Indigo (#6366f1) — dark blue-purple
- Violet (#8b5cf6) — lighter purple
- Purple (#a855f7)
- Magenta (#d946ef) — fuchsia
- Pink (#ec4899) — clearly pink, not red
- Brown (#92400e) — dark warm, not status amber
- Slate (#64748b) — cool grey, higher opacity (15/28%) to ensure visibility
- Electric Blue (#38bdf8) — the "look at me" high-attention option

Seeded assignments: 17559→blue, 10256→violet, 10236→null (demonstrates
no-color), 10121→electric, 10030→teal.

**4. Color application: tints on list rows, chip in headers**

Row tints (12% opacity at rest, 22% on hover) applied via inline style.
Hover tracking via `hoveredRowId` state in project-list — needed because
Tailwind's `hover:bg-*` classes don't override inline `backgroundColor`.
Uncolored rows keep the original `hover:bg-muted/50` Tailwind class.

Chip in `[id]/page.tsx` breadcrumb chrome (2.5px circle) when color is set.
Color field in Draft Editor header grid (swatch trigger + dropdown picker).
Color field in Active Summary header — the only editable affordance this
pass; `onChange` prop threaded through from detail page.

**5. Active Summary's only editable affordance**

The read-only notice was updated to say "Project Color is editable" while
all other fields remain Phase 8. This makes the color picker the deliberate
exception — it doesn't change project operational data, so adding it to the
"read-only this pass" surface doesn't compromise the Phase 8 scope gate.

**6. Spec gap: Project Color is not in `project_creation_view_spec.md`**

The Color attribute was introduced in this mockup pass and has no spec
equivalent. Per mockup track convention, the spec is NOT edited in mockup
track sessions — the gap is recorded here, and the spec will be backfilled
separately by the user.

The attribute is conceptually optional metadata (like Notes) that doesn't
affect compilation, WO generation, or any lifecycle transitions. It is
purely a workspace-organization affordance for the planner.

**7. Persistent issue-resolution helper — explicitly held**

The user identified this cross-surface pattern during the iteration cycle:
three surfaces (Compile Failure Screen, Definition Change Flag inspection,
Deactivation blocker resolution) all present a bounded list of fixable issues,
each requiring navigation away from the list to resolve. Rev 1's solution is
"navigate away, fix, navigate back" — the list context is lost each time.

This is documented in `DEFERRED.md` with the problem statement, three
surfaces, and directional design thinking (pinnable overlay with detach-to-
window option). The design starting point for Rev 1.5+ is to derive the
common shape across all three surfaces before building anything.

### Recommendations for implementation

- **Session store pattern** — module scope works for a mockup but is not
  the implementation recommendation. Use Zustand, React Query, or server-
  state (RSC + Server Actions) for cross-page state in production.
- **Project Color** — optional field on Project record. If persisted to
  the database, a simple `color: varchar(20)` column with the union of
  color names as a CHECK constraint. The hex/tint values belong in the
  frontend color map (not the database). The palette can be tuned or
  extended without a migration.
- **Row tinting** — the 12/22% opacity values work on the current dark
  theme. On a light theme, these percentages would likely need to be higher
  (~20/35%) for the tint to be visible. Color tinting should be tested at
  both theme modes if a light mode is ever added.
- **Uniqueness validation** — the mockup validates Project Number uniqueness
  on blur against the session store. Real implementation validates against
  the database (the unique constraint on `Project.projectNumber` covers the
  persistence layer, but the UX inline error needs an API call on blur or
  a server action).

### Open questions for implementation track

- **Color in API responses** — should color be included in the Project
  resource response? Likely yes, as a nullable string field. The API
  convention is camelCase, so `color: "blue" | null`.
- **Palette extensibility** — the 11-color palette is fixed in the mockup.
  Should users be able to add custom colors? Not for Rev 1; flag for Rev 2
  if the constraint becomes a pain point in user testing.
- **Color in cross-surface references** — the chip is only added to the
  `[id]/page.tsx` breadcrumb in this pass. When Project Number links appear
  in other execution lenses (Project View, Operations Lens, etc.), those
  surfaces should show the chip too. The implementation should share a
  `ProjectColorChip` component from a common location.

### Mockup-only details

- **Module-scope session store** — not a production pattern. No Zustand,
  no persistence, no multi-tab consistency.
- **Specific opacity values (12/22%)** — visually tuned for the dark theme;
  may need adjustment for light mode or different background colors.
- **ColorPicker popover positioning** — uses `absolute left-0 top-9` with a
  fixed width. In production, a Radix Popover or similar primitive handles
  viewport edge detection and positioning.
- **`drop-shadow` on check icon in swatch** — Tailwind utility for readability
  against saturated backgrounds. Fine for a mockup; production may use a
  different approach (white stroke or composite shadow).

---

## 2026-06-08 — Project Creation View (Project List, Draft Editor, Active Summary)

**Surfaces touched:** /app/mockups/project-creation/ — three surfaces:
Project List (landing/default), Draft Editor (editing + compile flow),
Active Project Summary (read-only).

**Mockup commits:**
- `8a87120` — initial scaffold: _data.ts with five seeded projects, WO
  generation, template assignment, all three surface components
- `afc38e9` — fix: ALWAYS_ASSIGN_PARTS ensures clean-compile projects
  resolve routing templates despite real data having `routingTemplate: null`

### Scope of exploration

This session built the Project Creation View — the surface where users
define new manufacturing projects (linking customers to BOM top-level
items), manage them as Drafts (editing header fields and top-level
items), compile a Draft into an Active Project (validating all BOM
parts have active routing templates, then generating Work Orders), and
view an Active Project's summary.

The session used the same real-data integration from the BOM Editor
session: all five seeded projects use real Part IDs and BOM trees from
the existing mockup dataset. Five projects were seeded with specific
validation scenarios:

- **17559 Wireless Probe Package — Cell 3** (Draft, single top-level,
  clean compile — 19-08-0-00)
- **10256 Customer A Trunnion — Q2 Build** (Draft, single top-level,
  clean compile — 22-15-0-00)
- **10236 Bridgeport Upgrade — Floor 2** (Draft, single top-level,
  surfaces two failure types: 22-06-1-00 has no template; 22-06-2-00
  has no template; 22-06-0-00 has an inactive template)
- **10121 PB-M Cell 2024-Q4** (Active, 6 top-level parts, 101 WOs)
- **10030 PB-M Wrap Drive Integration** (Active, 8 top-level parts,
  162 WOs)

The session established the compile flow end-to-end: validation runs
as a BOM tree walk, failures produce a Compile Failure Screen with
resolution deep links, a clean validation triggers WO generation and
transitions the project to Active.

### Design decisions made

**1. Validation at module init via ALWAYS_ASSIGN_PARTS**

The real mockup data has `routingTemplate: null` on many leaf parts
(assembly components), which would cause every project to fail
validation even for projects intended to compile cleanly. The
resolution: at module init, walk the BOM trees of the clean-compile
and Active projects to collect all part IDs, then create an
ALWAYS_ASSIGN_PARTS Set. `resolvePartTemplate()` returns an active
default template (102 for Assemblies, 101 for Parts) for any part in
that Set, bypassing the null in real data.

Specific overrides are still modeled via TEMPLATE_OVERRIDE_MAP for the
three parts in 10236 that should show failures (two mapped to null for
"no template", one mapped to inactive template 103).

**Why this approach:** the alternative (patching all real data to add
routing templates) would have lost the ability to model the failure
scenarios that make 10236 meaningful. The ALWAYS_ASSIGN_PARTS approach
keeps real data intact while defining which projects are "clean" at
the mockup level.

**Implication for implementation:** real database validation logic
checks `RoutingTemplate` assignments on each Part record directly; no
ALWAYS_ASSIGN_PARTS equivalent needed. This is a mockup-only shim.

**2. Compile flow with three Compile button states**

The Compile button has three states based on project completeness and
validation:

- **Disabled** (grey, with tooltip): missing required header fields
  (customer, due date, or no top-level items). Cannot attempt compile.
- **Amber/warn outline**: all required fields present, but at least one
  validation failure exists. Clicking shows the Compile Failure Screen.
- **Primary enabled**: all required fields present, all validation
  passes. Clicking triggers the 800ms compile simulation then
  transitions to Active.

The compile button text is "Compile →" in warn state (prompts the user
to proceed despite warnings) and "Compile →" in clean state. This
distinction was implemented by changing the visual style rather than
the text.

**Implication:** this three-state pattern fits any action that has
hard blocks (missing required data) and soft warnings (fixable-but-
valid-to-proceed issues). Not a general pattern for all buttons — only
for actions that have both.

**3. Compile Failure Screen as a full surface replacement, not overlay**

When the Compile button is clicked with validation failures, the Draft
Editor body is replaced entirely by the Compile Failure Screen (not a
modal Dialog overlaying the Editor). The Screen shows:

- Count header: "Compilation cancelled — N validation issues must be
  resolved"
- Per-failure list: part number, part name, failure reason label, BOM
  path breadcrumb, deep link to resolution surface
- Footer: "Return to Editor" button

Resolution deep links:
- no-template → `/mockups/parts?partId=X` (Open Part form → Routing
  Template section)
- part-inactive → `/mockups/parts?partId=X` (Open Part form)
- circular → `/mockups/bom-editor/X` (Open BOM Editor)
- template-inactive → dead-end annotation "Routing Template Editor
  — not yet built" (no link because the Routing Template Editor
  mockup does not support this navigation yet)

**Implication:** template-inactive failures have a dead-end annotation
in the mockup. When the Routing Template Editor mockup gains this
resolution path, the `getDeepLink()` function needs the `template-
inactive` case updated to a real href.

**4. BOM Tree Preview in Draft Editor**

The Draft Editor shows a BOM Tree Preview section (below the top-level
items table) that visualizes the full BOM tree for each top-level item
with per-node validation indicators. This preview:

- Reuses the same `validateTree()` logic used by the compile flow
- Shows CheckCircle2 (pass) or AlertCircle (fail) per node with the
  failure reason label
- "Fix" deep links on fail nodes (same resolution deep links as the
  Compile Failure Screen)
- Has Expand All / Collapse All / Reset controls
- Failure nodes show a dead-end annotation ("not yet built") when the
  resolution surface isn't available

The BOM Tree Preview mirrors the expandable tree pattern from the BOM
Editor mockup (hybrid expandable, chevron per sub-assembly).

**5. Active Project Summary is read-only (Phase 8 note)**

The Active Summary surface is intentionally read-only. All edit
affordances are absent. A sky-blue notice banner reads:

> "Active Project — read-only view. Work order management and
> execution details will be available in Phase 8 of the Project View
> build."

Progress bars (per project and per top-level item) show 0% since all
generated WOs are Unreleased. "All N Work Orders are Unreleased" note
provides context.

Quick Navigation links (to WO grid, Routing Steps, Blockers, etc.)
appear as inert text with "— not yet built" annotations.

**6. Part search relevance ranking (from BOM Editor, confirmed here)**

The PartSearchCombobox in the Draft Editor uses the same
relevance-ranked search established in the BOM Editor:
exact → prefix → substring → edit-distance on same-length prefix,
on Part Number first, Part Name second. Confirmed this is the right
pattern for any part-selection combobox in the system.

**7. TypeScript strict mode: discriminated union for ValidationResult**

`ValidationResult` is a discriminated union:
```typescript
type ValidationResultPass = { status: "pass" };
type ValidationResultFail = { status: "fail"; reason: ValidationFailureReason; templateName?: string };
type ValidationResult = ValidationResultPass | ValidationResultFail;
```

Accessing `reason` requires narrowing to `ValidationResultFail`.
Components that need to display failure details import
`ValidationResultFail` and cast after narrowing. This pattern avoids
`as any` and keeps the compiler helpful throughout the validation
rendering path.

**8. Lucide icon `title` prop — must wrap in `<span title>`**

Lucide React icons do not accept a `title` prop. Attempting to pass
`title="..."` produces a TypeScript error. The correct pattern is:
```tsx
<span title="Tooltip text">
  <AlertCircle className="h-4 w-4" />
</span>
```
This applies throughout the mockup wherever an icon needs a tooltip.
Already documented in BOM Editor history; confirmed as the pattern
for all mockup surfaces.

### Recommendations for implementation

- **Compile flow** as a server-side transaction: validate all parts
  against their RoutingTemplate assignments (with database-backed
  resolution), then within a single transaction generate all WOs
  (with steps, per `state_model.md`), write an AuditLog entry, and
  transition the project to Active. Validation is fast and should run
  before the transaction is opened.

- **Three compile-button states** (hard-blocked, warn-but-clickable,
  clean) as the canonical pattern for actions with both required-data
  gates and fixable-warning conditions.

- **Compile Failure Screen** as a full surface replacement with
  resolution deep links per failure reason. When the Routing Template
  Editor gains a URL-addressable per-template route, wire the
  `template-inactive` deep link.

- **BOM Tree Preview** in the Draft Editor (or an equivalent live
  validation summary). Users should know before compiling which parts
  will fail and why. The preview makes the Compile Failure Screen less
  surprising and accelerates the fix loop.

- **Active Summary as a Phase 8 stub.** The surface exists and is
  reachable; it shows accurate WO counts and 0% progress for
  Unreleased. Full execution detail (per-WO status, step completion,
  blockers) is Phase 8 work.

- **Validation logic as pure functions in `/lib`** (no component or
  database imports). The `validateTree()`, `validatePart()`, and
  `validateProject()` functions are testable in isolation and reused
  by both the Preview and the Compile flow.

- **WO generation as a recursive BOM tree walk.** Walk each
  top-level item's BOM tree; create one WO per node; create steps per
  routing template; assign `Unreleased` status to all WOs, `Waiting`
  status to all steps. This is the spec's compile behavior.

### Open questions for implementation track

- **WO reference format:** the mockup generates WO references as
  `projectNumber.NN` (e.g., "17559.01"). The spec in
  `project_creation_view_spec.md` should specify the exact format for
  implementation. If it's different, adjust.

- **Compile concurrency:** if two users compile the same Draft
  simultaneously, the second write should either detect the state
  change (409 Conflict) or be idempotent. The mockup doesn't model
  this. Real implementation needs a concurrency decision.

- **WO count capping:** Project 10030 generates 162 WOs from 8 top-
  level items. At scale, a large project might generate 500+. CLAUDE.md
  notes that Prisma transactions exceeding ~50 rows may need chunking.
  The WO generation transaction should account for this.

- **Template-inactive resolution flow:** currently a dead-end in the
  mockup. When the Routing Template Editor mockup (or real
  implementation) supports routing a user to a specific template's
  edit form, the deep link in both the Compile Failure Screen and the
  BOM Tree Preview validation indicators needs to be wired up.

- **Draft auto-save vs explicit save:** the Draft Editor uses auto-
  save on every field change (via the `update()` helper bumping
  `lastEditedAt`). Real implementation should match this behavior with
  an auto-save API call (debounced) or a Save button. Spec may be
  silent on this; worth clarifying.

### Mockup-only details

- **ALWAYS_ASSIGN_PARTS shim** — not needed in implementation; real
  database has proper RoutingTemplate assignments per Part.
- **800ms compile simulation** — real compile may be faster or slower
  depending on project size; the delay is mockup UX only.
- **State isolation between pages** — because the mockup uses page-
  level useState initialized from INITIAL_PROJECTS, navigating away
  from [id]/page.tsx and back resets project state. A compiled project
  appearing as Active on the list requires the compile to have updated
  the parent page state before navigating. This is a mockup architecture
  limitation; real implementation uses a shared database.
- **Active Summary 0% progress** — all generated WOs are Unreleased
  so progress bars show 0%. The mockup has no mechanism to advance WO
  status; this is expected.

---

## 2026-06-02 — BOM Editor (read-only tree, real-data integration, editing operations)

**Surfaces touched:** /app/mockups/bom-editor/ (search-driven
landing, expandable tree visualization, editing operations,
validation systems), /app/mockups/parts/_data.ts (real-data
integration replacing MOCK_PARTS)

**Mockup commits:** approximately 12-15 commits in sequence:
- BOM Editor surface + read-only tree visualization
- Real data integration: 1893 Parts + 434 Assemblies + 2341 BOM
  edges, sanitized customer names, generated cost freshness dates
- Architecture polish: push-tree layout for Part Form Sheet,
  persistent search in chrome, route collapse from two routes to
  one, shared Part Form Sheet via cross-mockup import
- Commit 2a: row tinting bumps, tree width tightening, root row at
  top of tree, sort rule (Parts above Assemblies, alphabetical),
  inline qty edit
- Followup: 0-as-remove confirmation gate
- Sticky column headers + tree width fix
- Commit 2b: ⋮ menu, Add Child inline-input flow, Remove Children
  multiselect mode, cycle detection with chain display, depth
  validation, audit logging
- Evaluation fixes: ⋮ menu position, edit-distance threshold,
  relevance ranking, duplicate Add error, cycle icon UX, depth
  thresholds adjusted to 6/8, ESC unwinding stack
- Edit-distance prefix matching
- Tooltip on cycle icon + pointer-events fix

### Scope of exploration

This session built out the BOM Editor — a standalone surface for
viewing and editing BOM (Bill of Materials) relationships. The BOM
Editor is structurally different from prior mockups: it visualizes
a graph (Parts and Assemblies as nodes, BOM edges with quantities
as edges), supports tree traversal in both directions, and gates
edits through cycle and depth validation.

The session also included substantial real-data integration. The
mockup's MOCK_PARTS was replaced with sanitized data from the
user's prior shop: 1893 Parts, 434 Assemblies, and 2341 BOM edges
representing actual machine builds. Customer names were anonymized;
costs and freshness dates were generated. The Parts grid, BOM
Editor, Part Form Sheet, and all dependent surfaces now operate on
this real-shape data.

By session end, the BOM Editor supports:
- Read-only tree visualization with hybrid expandable structure
- Operational rollups (cost, buildable count, freshness indicators)
  computed recursively over subtrees
- Search-driven Assembly selection with persistent search in chrome
- Cross-mockup integration with Part Form Sheet (full form, scrolled
  to relevant section on open, push-tree layout)
- Editing operations: inline qty edit with confirmation, Add Child
  with cycle/depth validation, multiselect Remove with confirmation
- Mode exclusivity (one edit at a time per Assembly; navigation
  remains available; in-progress edits discard on navigation away)
- ESC unwinding via modal stack (most recently activated closes first)

### Design decisions made

**1. Hybrid expandable tree visualization (not flat-list-with-
navigation)**

Question: how should the BOM tree be visualized — as a flat list
of immediate children (one level at a time, click sub-Assembly to
navigate into it) or as an expandable tree (show whole tree
inline, expand/collapse sub-Assemblies)?

Options considered: flat list with breadcrumb navigation;
expandable tree (default collapsed, expand-on-click); always-fully-
expanded tree.

Decision: hybrid expandable tree. Sub-Assemblies show a chevron
that expands them inline. "Expand all" / "Collapse all" toggles
for bulk operations. Default state shows only the immediate
children of the root Assembly.

Reasons: at typical depths (3-5), the user benefits from seeing
the full structure. At deeper depths, expand-collapse lets them
focus. Flat list would have required excessive navigation for
common workflows. Fully-expanded would have overwhelmed the user
on first open.

Implication: tree visualization handles arbitrary depth.
Validation thresholds (soft at 6, hard at 8) reflect visual
capacity, not engineering capacity. The execution lenses (Projects
especially) inherit this pattern.

**2. Search-driven landing collapsed into editor chrome**

Question: should the BOM Editor have a separate landing page (for
Assembly selection) and an editor page (for working on an
Assembly's BOM)?

Options considered: separate routes for landing and editor (two-
page model); single route with persistent search in chrome.

Decision: single route. /mockups/bom-editor renders the editor
with empty body if no Assembly is selected. The search is
persistent in the chrome. /mockups/bom-editor/[id] renders the
same chrome plus that Assembly's tree.

Reasons: switching between Assemblies is a common workflow; making
it require navigation back to a landing page adds friction. The
search bar in chrome handles all entry points uniformly. The
landing's "what Assembly do I want to look at?" question is now
always one search box away.

Implication: the Parts Master and execution lenses can follow a
similar pattern — persistent search in chrome for entity selection,
empty-state landing when no entity is selected.

**3. Push-tree layout (not push-chrome) for Part Form Sheet**

Question: when the Part Form Sheet opens (from a Part Number
click), should it push the page chrome aside or only push the
tree?

Decision: push only the tree. Chrome (search bar, page header,
Assembly identity) stays full-width above. The tree compresses to
~67%, the Sheet takes ~33% on the right. Both scroll independently.

This pattern matches what we established in /mockups/parts: chrome
above stays put; body content reflows around side panels. The
execution lenses will use the same pattern.

**4. Bidirectional BOM traversal via clickable rows**

Question: should the user be able to navigate the BOM tree by
clicking rows, and if so, in which directions?

Decision: yes, bidirectional. Click a Part's Part Number → opens
Part Form Sheet showing that Part's data, scrolled to Parent
Assemblies section. From Part Form Sheet, click a parent row in
the Parent Assemblies section → that parent becomes the Sheet's
focus. Combined with the Sheet's Child Parts section (for
Assemblies), full BOM tree walkable.

This was the breakthrough on tree navigation — the surface isn't
just for viewing one Assembly's BOM; it's for traversing the BOM
graph by clicking, with the Part Form Sheet showing each node's
full context.

**5. Sort rule: Parts above Assemblies, alphabetical within**

Question: in what order should children of an Assembly be
displayed?

Decision: Parts above Assemblies. Within each group, alphabetical
by Part Number. Applied at render time, not stored in data.

Reasons: BOM order isn't semantically meaningful (no "build this
first, then this" — that's routing). Parts-above-Assemblies
matches habitual organization in the real data and aids scanning
(leaves before branches). Alphabetical-within keeps consistent
positioning across reloads.

Implication: future Rev might add drag-and-drop reordering with
persisted custom order; for Rev 1, the sort rule is sufficient.

**6. Operational rollups as first-class data, not just structure**

Question: should the BOM Editor show only the structural
relationships, or include computed operational data?

Decision: include both. Each row shows the part's identity
(structure) AND its operational state (own stock, buildable
rollup for Assemblies, cost rollup, freshness, location).

The Buildable rollup is particularly significant — for an
Assembly, it answers "how many of this Assembly could we build
right now from on-hand stock?" computed by minimum across all
descendants, weighted by quantities, treating null stock as 0.

Reasons: this answers operational questions inline ("what could
we ship from stock today?") without requiring a separate report
or aggregation surface. The user noted this feature was a
limitation in the prior tool; surfacing it here uses the BOM
Editor as analysis surface, not just structural editor.

**7. Cycle detection on add, visible-but-disabled in combobox**

Question: how should cycle prevention be surfaced — block at
Save? Filter from search results? Show but disable?

Decision: show cycle-creating candidates in the combobox but
render them as disabled (greyed text + red error icon). Hover the
icon for tooltip, click the icon for the chain display dialog.

This preserves information (user sees the Part exists) while
preventing the cycle. The dialog with chain becomes a learning
moment — the user understands WHY the Part can't be used here
(the chain through the tree that creates the cycle).

Alternative would have been: pre-filter cycle-creators out of
results (less informative); or let users select and block at Save
with the dialog (more friction).

**8. Depth validation: soft warning at 6, hard block at 8**

Question: at what depth should the system warn or block?

Decision: soft warning when proposed depth would be 6, 7, or 8.
Hard block when proposed depth would be 9 or greater.

These thresholds reflect the visual capacity of the interface:
beyond depth 6, the tree zone constrains Part Names with
truncation; beyond depth 8, the tree zone becomes too narrow to
read. Engineering capacity (PostgreSQL recursive CTEs handle
depth 20+ without issue) is not the binding constraint.

The user's real-data maximum is depth 5, so the soft warning rarely
fires on legitimate edits. When it does, the user can confirm
intent or restructure.

**9. Mode exclusivity with navigation still available**

Question: when one Assembly is in an editing mode (Add Child,
Remove Children), what can the user do?

Decision: editing on OTHER Assemblies is blocked (their ⋮ menus
disabled). But navigation — chevrons on other Assemblies, search
in chrome, Part Form Sheet opens — remains available. Navigation
away from the page silently discards in-progress edits.

This matches "Add Child means start adding a child; don't undo
my pending work just because I clicked the wrong button" reasoning.
Navigation is non-destructive; explicit Cancel or Save resolves
the edit.

**10. ESC unwinding via most-recently-activated stack**

Question: when multiple modal/mode states are active (e.g., Add
Child open AND Part Form Sheet open), which closes first on ESC?

Decision: most recently activated closes first. Implementation
uses a stack — each modal/mode pushes on activation, ESC pops the
top.

shadcn Dialogs handle their own ESC via Radix; the custom stack
only manages non-Dialog dismissibles (Sheet, Add mode, Remove
mode). This separation works in practice because users perceive
"close what I opened most recently" regardless of underlying
mechanism.

**11. Search results ranked by relevance**

Question: when the user types in the Part Number combobox, what
order should results appear in?

Decision: exact match > prefix > substring > edit-distance, on
Part Number first, then Part Name. Within tier, secondary sort by
Part Number.

This was a real bug fix discovered in evaluation: typing exact
Part Numbers initially produced results buried behind fuzzy
matches. The relevance ranking puts the user's most likely
intended candidate at top.

Implication: any search-with-fuzzy-match in the system should
apply the same ranking. Worth establishing as a pattern.

**12. Edit-distance: compare against same-length prefix**

Question: when the user types a partial Part Number (e.g.,
"41-02-1-"), should it match candidates like "41-02-0-XX" via
edit-distance?

Decision: compare the search string to the candidate's prefix of
equal length to the search. Edit-distance 1 between "41-02-1-"
and "41-02-0-" yields match for any candidate starting with
"41-02-0-..."

The naive full-string edit-distance treated the candidate's
additional characters as insertions, inflating distance past
threshold. The prefix-comparison rule reflects the user's mental
model: "I'm searching for Part Numbers starting like this."

**13. Real data integration — full dataset with sanitization**

Question: should the mockup use real data, fabricated data, or a
curated subset?

Decision: full real dataset from the user's prior shop, with
sanitization for customer names. 1893 Parts + 434 Assemblies +
2341 BOM edges. Costs from real data; cost-last-updated dates
regenerated for plausible freshness distribution.

Reasons: the Pattern E filter system was designed for spreadsheet-
scale interrogation; using 1893 Parts validates the system at
real-world scale. Curation would have created arbitrary cutoffs.
Fabrication would have lost authenticity (real BOMs have
irregular structure that's hard to invent).

Customer-identifying Assembly names anonymized ("Hines 3-column"
→ "Customer A 3-column" with consistent letter per customer).
Technical product names and component supplier names kept as-is.

**14. Sticky column headers on scroll**

Question: when the BOM tree (or Parts grid) is scrolled
vertically through many rows, where do the column headers go?

Decision: sticky to the top of the scroll container. Implemented
at the `th` element level (not `thead`) because `position: sticky`
on `thead` is unreliable across browsers. `th`-level sticky is
the standard pattern.

This was applied to both the BOM Editor's tree and the Parts
Master grid as a consistent treatment.

### Recommendations for implementation

- **Hybrid expandable tree** for any tree-shaped visualization
  (BOM Editor, Projects execution view). Default collapsed except
  root; expand/collapse per node; bulk Expand all / Collapse all
  toggles.

- **Search-driven chrome on landing surfaces.** The search bar is
  always available, not behind navigation. Empty-state body when
  no entity is selected.

- **Push-tree layout pattern** for any side-panel-over-list
  surface. Chrome stays full-width above; body content (tree,
  grid, etc.) compresses to make room for the panel; both scroll
  independently. Inherits from Parts Master.

- **Bidirectional BOM traversal.** Click any Part to open its
  Sheet, scrolled to the relevant section (Parent Assemblies for
  most contexts). Click any parent or child row to navigate the
  Sheet to that record. BOM graph traversal as primary
  interaction.

- **Sort rule: Parts above Assemblies, alphabetical within.**
  Applied at render. Sort key: partType (Part first), then
  partNumber.

- **Operational rollups on Assemblies:** cost (sum recursive),
  buildable (min recursive, null stock = 0), freshness
  (descending: missing > stale (>6mo) > healthy). Computed on-the-
  fly; not persisted.

- **Cycle detection prevents save (combobox-level), error icon
  surfaces chain on demand.** Don't let the user proceed with a
  cycle; do give them the information about why on request.
  Validation as pure functions in /lib for reuse.

- **Depth thresholds: soft warn at 6, hard block at 8.** Visual
  capacity, not engineering. The schema's max depth (or whatever
  the engineering limit is) is separate.

- **Mode exclusivity within a single user's session.** One edit at
  a time per Assembly; navigation remains available. Real
  implementation should consider how this maps to multi-user
  (last-write-wins? optimistic locking? explicit save conflicts?).

- **ESC unwinding via most-recently-activated stack.** Either
  custom hook coordinating shadcn Dialog primitives or pure custom
  stack. shadcn Dialogs' built-in ESC is cooperative.

- **Search ranking: exact > prefix > substring > edit-distance, on
  Part Number then Part Name.** Apply consistently across any
  fuzzy-search affordance in the system.

- **Edit-distance: same-length prefix comparison.** Search "X"
  matches candidate "X..." with substring; matches "Y..." (where
  "Y" is edit-distance N from "X") if the candidate's prefix of
  length |X| is distance ≤ threshold from X.

- **Sticky column headers at `th` level**, not `thead`. Reliable
  across browsers; Parts grid and BOM Editor both use this
  pattern.

- **Cross-mockup component reuse pattern.** The Part Form Sheet is
  imported across mockups. Implementation should share via a
  proper shared location (e.g., /app/_components/part-form-sheet/).
  Same applies to: ProcessTypeChip, PROCESS_TYPE_META, MOCK_PARTS,
  ProcessTypeLegend, edit-distance utilities, and now Part Form
  Sheet itself. Multiple components are load-bearing across
  surfaces.

### Open questions for implementation

- **BOM relationship persistence in database.** The mockup
  represents BOM as denormalized arrays (`childParts`,
  `parentAssemblies`) on each MockPart. Real schema uses a BOM
  table with FK to Part. Queries for tree traversal use recursive
  CTEs. Performance at scale needs validation.

- **Concurrent editing.** Multiple users editing different
  Assemblies' BOMs simultaneously: presumably fine. Multiple users
  editing the SAME Assembly's BOM: needs decision. Optimistic
  locking? Last-write-wins? Real-time sync (Liveblocks,
  Y.js)? The mockup doesn't model this.

- **In-flight edit recovery.** Mockup discards on navigation away.
  Real implementation may want auto-save drafts or warn-on-leave.
  User preference is "discard, but I can navigate freely" — match
  in implementation.

- **Buildable rollup performance.** With real data at 2300+
  parts/assemblies and a full subtree calculation, the rollup is
  fast enough in-memory in the mockup. With database queries +
  network, this could be expensive. Caching strategy?
  Materialized view? On-demand calculation?

- **Cycle detection at scale.** Mockup's cycle check is O(N) walk
  of proposed child's subtree. Real-world scale (10k+ parts)
  should remain fast but worth confirming.

- **Real-time updates.** If User A adds a child to Assembly X
  while User B is looking at X's BOM, does B see the update?
  Real-time sync, polling, or refresh-on-action?

- **Audit log retention and query.** Per-Assembly audit entries
  accumulate; how is this surfaced operationally? Filtering by
  date range? Export? Implementation needs to decide retention.

- **Stock count source-of-truth.** The mockup has stock counts on
  Parts (set by the Receiving lens in production). The buildable
  rollup reads these counts; the cost rollup reads costs. Both
  are computed values, but the inputs come from different
  operational surfaces. Implementation needs to define the data
  flow.

- **Sub-assembly stock-on-hand.** The mockup allows Assemblies to
  carry their own stock count (e.g., pre-built sub-assemblies in
  stock). The rollup logic accounts for this but the spec on how
  this works operationally is thin. Worth clarifying.

- **Part Form Sheet as shared component.** Cross-mockup import
  works in mockup but Parts and BOM Editor both depend on it.
  Implementation should lift to a shared location with proper
  API. The "Open in Parts Master" link suggests the canonical
  edit surface is Parts grid; BOM Editor uses the same Sheet
  for context viewing.

### Mockup-only refinements

- **Specific row tinting values** (`bg-muted/80` for Parts) —
  visually tuned; not spec language. Implementation matches for
  consistency but pixel-perfect equivalence not required.

- **Specific tree zone width** (`w-[424px]`) — visually tuned to
  fit Location column next to Part Form Sheet at 1440px viewport.
  Implementation should match the principle (data columns visible
  with side panel open) but exact value may shift.

- **Specific column widths and ordering** in the data zone (Type,
  Qty, Stock, Buildable, Cost, Freshness, Location) — chosen for
  the mockup; implementation should validate based on the real
  operational queries users ask of this surface.

- **Open in Parts Master link wording and position** — currently
  in a strip above the Part Form Sheet; can be relocated.

- **Cycle icon visual** (lucide AlertCircle, text-destructive
  color) — implementation should keep an iconographic standard
  but specific icon library/icon may shift.

- **ESC stack vs alternative dismissal patterns** — the stack-
  based approach worked but other patterns (focus-based, last-
  registered modal) are also valid; implementation may choose.

- **Real-data values** — costs, dates, stock counts, etc. The
  mockup uses real-but-sanitized data; production uses live data
  from the actual operational systems.

- **Search ranking and edit-distance precise rules** — the
  ranking tiers and prefix-comparison rule are documented above
  and should be respected, but specific tie-breaking and edge
  cases may shift in implementation.

- **Specific tree max-depth thresholds (6/8)** — these are
  intentional design choices for Rev 1; future Revs may adjust
  based on user feedback or operational reality.

---

## 2026-05-31 — Part Form side panel and Definition Change Flag

**Surfaces touched:** /app/mockups/parts/ (Part Form side panel,
Material & Vendor / Routing / Parent Assemblies / Inventory /
Child Parts sections, Definition Change Flag dialog)

**Mockup commits:** approximately 6 commits in sequence:
- "part form as push-grid side panel" (1.6a)
- "independent scroll for parts grid and side panel" (scroll fix)
- "selected-row indicator on parts grid"
- "part form material and vendor section"
- "part form routing, parents, inventory sections"
- "part form definition change flag and child parts"

### Scope of exploration

This session built out the Part Form — the side panel that opens
when a user clicks a row in the Parts grid. Part Form is the hub
where most other configuration surfaces are referenced (Materials,
Vendors, Routing Templates, BOM relationships) and where the
Definition Change Flag system operates on the Parts side (parallel
to the Routing Template Editor's edit-time dialog on the
Templates side).

The session started with a layout overhaul (replacing the wide
overlay Sheet from prior work with a narrower push-grid side panel)
to establish the side-panel pattern that execution lenses will
inherit. From there, the form's six sections were built out
incrementally: Header and Core Details (already done), Material &
Vendor with in-context creation (cascade modal + Vendor create
modal both local to the Parts mockup), Routing Template with
Change Template dropdown, Parent Assemblies and (for Assemblies)
Child Parts with click-to-navigate behavior, Inventory with bin
thresholds, and finally the Definition Change Flag dialog that
gates Save when definition fields change with downstream impact.

By session end, the Part Form is functionally complete. Every
field the spec describes is present and interactive. BOM tree
traversal works in both directions. In-context creation works for
both Materials and Vendors. The Definition Change Flag dialog
fires correctly based on field-change-plus-impact gating logic.

### Design decisions made

#### 1. Side panel pattern (not modal overlay) for Part Form

**Question:** Should the Part Form open as a wide overlay (the earlier
implementation) or a narrower side panel that pushes the grid?

**Options considered:**
- Keep the wide overlay (current)
- Narrow side panel that overlays grid
- Narrow side panel that pushes grid to ~67% width

**Decision:** Push-grid side panel at ~33% width.

Reasons: (a) consistency with execution lenses that will use the same
pattern, (b) the grid stays interactive while the panel is open (user
can click another row to navigate to a different Part), (c) the user's
"click data column to scroll panel to relevant section" workflow requires
the panel to be a long-lived navigation surface, not a one-shot modal.

The standalone-best design would have been a centered sub-window with
tiled sections, but consistency across surfaces wins for Rev 1. If the
panel pattern proves too constraining at 33%, the user can adjust width.

**Implication:** all form sections use single-column layout (no
side-by-side fields). The grid scrolls horizontally for wide Views
even with the panel open — accepted trade-off.

#### 2. Click-data-column scrolls panel to corresponding section

**Question:** When a user clicks a specific column in a grid row,
should the panel just open at the top, or scroll to a section relevant
to that column?

**Options considered:**
- Open at top always
- Scroll to relevant section based on which column was clicked

**Decision:** Scroll to the relevant section. The mapping (Material
column → Material & Vendor section; Routing column → Routing Template
section; etc.) reduces friction for "I want to look at this specific
aspect of this part" workflows. Without it, the user opens the panel
and scrolls manually every time.

**Implication:** each section has a stable HTML id; column-to-section
map drives the scroll behavior; clicking a row's data cell passes the
column ID up to the panel. This pattern is specced for execution lenses
too; establishing it here as the canonical implementation.

#### 3. Bidirectional BOM traversal — Parents on all, Children on Assemblies

**Question:** Should Assemblies show their parent assemblies (where
they're used) or their child parts (what they're made of)?

**Options considered:**
- Parents only for both (simpler)
- Children only for Assemblies (replaces Parents semantics)
- Both Parents AND Children where applicable (most thorough)

**Decision:** Both. Parts show only Parents (Parts are leaves; they have
no children). Assemblies show both Parents (most assemblies are
sub-assemblies in something larger) and Children (what they're made of).
All rows in both sections are clickable, enabling full BOM tree traversal
via the panel.

**Implication:** operationally significant — a user looking at a
sub-assembly can navigate up to the parent or down to a component without
leaving the panel. The BOM is the relational backbone of the system; the
panel respects that.

#### 4. In-context creation: local cascade modal and Vendor create modal

**Question:** When the user is creating or editing a Part and needs a new
MaterialSpec or Vendor that doesn't exist yet, how do they create one
without leaving the form?

**Options considered:**
- Navigate to the Material Specs or Vendors mockup (high friction)
- Modal that imports from those mockups (cross-mockup coupling)
- Local modals within the Parts mockup (decoupled)

**Decision:** Local modals. The MaterialSpec cascade modal in Parts is
create-only (the full edit functionality lives in the MaterialSpec
Management surface). The Vendor create modal in Parts is minimal (name +
contact + lead time + notes, skipping website and location that belong in
full Vendor Management). Both modals add to Parts' local MOCK_* arrays;
no propagation to other mockup surfaces.

**Implication:** spec language for in-context creation needs to specify
what subset of the full fields are exposed and what the data persistence
semantics are (presumably real Vendor and MaterialSpec records, available
everywhere). Mockup track preserves decoupling; implementation track
resolves to single shared records.

#### 5. Definition Change Flag — Parallel dialog, not shared

**Question:** The Routing Template Editor has an edit-time dialog with
count cards (Parts/WOs/Stock); should the Parts side use the same
component or a parallel one?

**Options considered:**
- Lift the EditTimeDialog to a shared location and parameterize the data source
- Build a parallel DefinitionChangeFlagDialog inside the Parts mockup

**Decision:** Parallel. The two dialogs share ~80% design language but
operate on different data (Routing Template's dialog shows Parts using the
template + WOs running templates; Parts' dialog shows BOM references +
WOs producing this Part + this Part's stock). Parameterizing for shared
use would add complexity to both consumers. Parallel-similar is the cost
of mockup decoupling we chose to accept.

**Implication:** implementation may choose to share these via a generic
ImpactDialog component that takes data sources as props. That's an
implementation-track decision; both mockup implementations exist as
reference.

#### 6. Save gates through dialog only when definition fields AND impact

**Question:** When does the Definition Change Flag dialog fire?

**Options considered:**
- Fire whenever any field changes
- Fire only when definition fields change
- Fire only when definition fields change AND the Part has downstream impact

**Decision:** When BOTH conditions are true at Save time: (a) a
definition field changed (Material Spec, Default Vendor, Routing Template,
Stock Size, Blank Length), and (b) the Part has any downstream impact
(parents > 0 OR open WOs > 0 OR stock > 0).

Otherwise Save commits silently. Non-definition field changes (Name,
Description, Notes, etc.) never trigger the dialog regardless of impact.
Definition-field changes on Parts with zero impact (draft Parts, freshly
created Parts) also commit silently.

**Implication:** matches the Routing Template Editor's gating logic and
keeps the dialog meaningful — it only appears when there's something real
to confirm.

#### 7. Stock Size as free text deferred to Rev 2

**Question:** Should Stock Size be a structured field (combobox of known
sizes per MaterialSpec) or free text?

**Options considered:**
- Structured combobox (sizes defined per MaterialSpec)
- Free text

**Decision:** Free text for Rev 1. Material handling is undergoing broader
rework in Rev 2; Stock Size structure belongs in that work. Mockup uses a
simple text input.

#### 8. Bin Min/Max validation as warning, not block

**Question:** When Bin Max < Bin Min (an unusual configuration), should
the form prevent Save or just warn?

**Options considered:**
- Block Save with a validation error
- Show a warning but allow Save

**Decision:** Warn but allow. Trust the user with tools — they may
legitimately set values that look unusual. The warning surfaces the
concern; the user decides.

#### 9. Inline edit on grid + form edits stay in sync

**Question:** Stock Count and Inventory Location are inline-editable in
the grid AND editable in the form's Inventory section. Should edits in
one surface reflect in the other?

**Options considered:**
- Independent state (grid and form diverge until a Save/Reload)
- Bidirectional sync (both surfaces share the same record in memory)

**Decision:** Bidirectional sync. Both surfaces operate on the same
MockPart record in memory; changes in either reflect immediately in the
other. The grid is the fast path for single-field edits; the form is the
comprehensive edit context.

#### 10. Routing Template editor navigation as link, not overlay

**Question:** How does the user access the Routing Template Editor from
the Part Form's Routing Template section?

**Options considered:**
- Navigation link to /mockups/routing-templates/[id]
- Overlay that opens the editor over the Part Form

**Decision:** Navigation link for the mockup. Long-term, the user prefers
this to open as an overlay over the Part Form (avoiding context loss). For
the mockup, link navigation is acceptable; the overlay redesign is flagged
for implementation-track consideration.

### Recommendations for implementation

- **Side panel pattern** (push-grid at ~33%) for Part Form and execution
  lenses. The grid remains interactive; the panel updates on row clicks.
- **Click-to-section navigation** from grid columns to form sections
  (column-to-section mapping declared per surface).
- **Bidirectional BOM traversal** — both Parents and Children shown where
  applicable, both clickable, both navigate the panel.
- **In-context creation** for MaterialSpec and Vendor from the Part Form.
  Real implementation should create records in the shared database; the
  cascade modal and Vendor create modal can be reused across surfaces (BOM
  Editor, etc.) that need similar in-context creation.
- **Definition Change Flag dialog** with the trigger logic (definition
  fields AND impact). Three count cards parallel to the Routing Template
  Editor's dialog. Implementation may share a generic ImpactDialog
  component between the two.
- **Selected-row indicator** on the grid when the panel is open (left-edge
  accent + subtle background tint).
- **Stock Count and Location bidirectional sync** between grid inline-edit
  and form field edits.
- **All section ID anchors** stable across surface versions (the
  click-to-scroll behavior depends on these).

### Open questions for implementation track

- **In-context creation persistence:** the mockup's local modals add to
  local data; production should create real records via the same Vendor /
  MaterialSpec API endpoints. Permissions and validation rules need to
  match the full-surface CRUD.
- **Cascade modal vs full MaterialSpec management:** the Parts cascade
  modal is create-only. Should the same component support edit mode in
  this context, or is editing always done via the MaterialSpec Management
  surface? (Mockup decoupling meant we sidestepped this; implementation
  has to choose.)
- **Routing Template Editor as overlay vs page:** flagged as a user
  preference; defer to implementation track's UX evaluation. Pattern would
  affect multiple surfaces.
- **Definition Change Flag dialog generalization:** Parts and Routing
  Templates have parallel dialogs. Worth a shared ImpactDialog component?
  If so, what's the API?
- **BOM data model in the database:** Parts have `parentAssemblies` and
  `childParts` as denormalized arrays in the mockup. The actual schema uses
  BOM records; the form needs to read both directions efficiently (parent
  assemblies via BOM table joined where childPartId = this part; child
  parts via BOM table where parentPartId = this part).
- **Open WOs query:** the dialog shows open WOs targeting this Part.
  Production query joins WorkOrder → Part with status filtering.
  Performance implications at scale.
- **Stock Size structure (Rev 2):** flagged for the material handling
  rework. Until then, free text.

### Mockup-only refinements

- **33% panel width as starting value** — visually tuned; not a spec
  requirement.
- **Bin Min/Max as Rev 2 fields** — defined in mockup, deferred in
  implementation schema until Rev 2 lands.
- **Cascade modal create-only** — full edit mode lives in MaterialSpec
  Management; deliberately not replicated.
- **Vendor create modal minimal fields** — full Vendor Management surface
  owns the comprehensive Vendor record.
- **Parallel implementation of Definition Change Flag dialog and Routing
  Template Editor edit-time dialog** — not a shared component;
  implementation may choose to share.
- **Stock Size free-text** — Rev 2 work.

---

## 2026-05-30 — Parts Master Pattern E exploration

**Surfaces touched:** Parts Master grid (`/app/mockups/parts/`); Routing Templates grid (`/app/mockups/routing-templates/`) — incidentally affected by ProcessTypeChip width change
**Mockup commits:**
- `34f2533` — narrower compact chips, parts grid legend + toggle (1.5a)
- `8a3a352` — parts views foundation and full column system (1.5b)
- `4a8609a` — column-header menus replace filter bar (1.5c)
- `b3810da` — parts views modification and management (1.5d)
- `7b267e8` — trim view management modal to essential columns (polish)

### Scope of exploration

This session explored a substantial extension to the Parts Master grid: a Views system that lets users define and switch between saved configurations of column visibility, sort, and filters. The exploration was motivated by the user's design principle that the grid should support spreadsheet-parity interrogation — users should be able to answer ad-hoc questions about the parts data without requiring developer intervention or exporting to external tools.

The session expanded scope significantly beyond the original spec across four dimensions: the fixed filter bar described in the spec was replaced with column-header-driven sort, filter, and hide controls; approximately thirteen additional columns were defined covering Rev 2 schema fields and operationally meaningful data not surfaced in the original spec; a full Views CRUD system was added (switcher, modification UI, management modal); and filter operators were defined per column data type, with the Routing column gaining include/exclude filter semantics that go beyond the spec's deferred Rev 2 "Includes Process" filter.

This scope expansion was deliberate. The Parts grid is core to operational interrogation work — it is where shop staff answer questions like "which parts use this material?" or "which parts have no routing and are still open?" — and the user's position is that investing in a capable grid pays off across every workflow that references the parts library. The implementation track will evaluate scope against Rev 1 capacity before committing to all of it.

The session concluded with a polish pass (commit `7b267e8`) that trimmed the View Management modal to its essential columns after an initial version was too wide and surfaced columns that were editorial concerns rather than management concerns. This trim illustrates the mockup track's value: the over-wide modal was built, reviewed visually, and corrected in the same session rather than surfacing post-implementation.

### Design decisions made

#### 1. Pattern E (named Views) over Pattern A (column toggles only)

**Question:** Should column visibility be ad-hoc per-session adjustments, or should it support saved, named configurations?

**Options considered:**
- Pattern A: a column picker with session-only state — visible columns reset on page reload
- Pattern E: named, persistent Views with column visibility, sort, and filters combined
- Hybrid: Pattern A in Rev 1, Pattern E deferred to Rev 2

**Decision:** Pattern E for Rev 1.

The hybrid would have produced a half-feature that users would find frustrating: they would invest effort configuring columns and filters, close the tab, and have to rebuild from scratch the next time. Pattern A alone would have required users to reconstruct their preferred view configuration every session, which conflicts with the design principle that the grid should be a durable operational tool rather than a scratch surface. Pattern E lets common operational questions ("Material Audit", "Inventory Check", "No Routing Flagged") get encoded once and reused by the whole team.

**Implication:** requires a Views data model (name, visible columns with order, default sort, filter array, default flag), a View switcher UI, a modification UI, and a management modal. Substantially more implementation work than Pattern A, justified by alignment with the "interrogate freely" design principle.

#### 2. Views are shared across users, not per-user

**Question:** Should each user maintain their own set of Views, or do Views exist at the system level and are visible to all users?

**Options considered:**
- Per-user: each user has their own Views; other users' Views are not visible
- Shared: Views exist at the system level; all users see and use the same set
- Hybrid: shared base Views with per-user overlays (personal Views layered on top of system Views)

**Decision:** Shared.

In a small-shop context (six to ten users), workflow overlap is significant. If a shop manager builds a "Material Audit" View, every operator benefits from it being available without having to recreate it. The cost of reinventing Views per-user outweighs the benefit of personalization at this scale. Shared Views also keep the implementation materially simpler: one Views table, no user→views junction, no merging logic between system and personal Views.

**Implication:** any user with grid access sees the same set of Views. Creating, editing, and deleting Views may warrant permission gating (documented as an open question below); the mockup assumes any user can do these operations.

#### 3. Column-header menus replace the filter bar

**Question:** Where do filters live in the UI?

**Options considered:**
- Keep the inline filter bar as described in spec (input row beneath the column headers)
- Replace with column-header menus (spreadsheet pattern: click a header chevron to sort, filter, or hide that column)
- Hybrid: quick-filter shortcuts inline plus header menus for full control

**Decision:** Full column-header menu replacement.

Reasons: consistency (one filter pattern, one place to look rather than two), discoverability (every column exposes the same affordances via the same interaction), space efficiency (no chrome row above the grid devoted to filter UI, which matters on dense grids), and parity with spreadsheet tools the user is migrating from. The inline filter bar requires users to locate the right input field in a separate UI zone; the header menu puts the filter affordance on the column itself, which is the natural association.

**Implication:** every column header has a hover-visible chevron menu trigger and supports right-click. Active filters are indicated by a funnel icon on the header with a hover tooltip describing the active filter. Filter popovers are type-specific (text operators for string columns, range operators for numeric and date columns, multi-select for categorical columns, etc.).

#### 4. AND-only filter combination

**Question:** Should multiple active filters combine via AND only, or should the system support OR with visual grouping (e.g., "material = Aluminum OR material = Steel")?

**Options considered:**
- AND only: all active filters must be satisfied simultaneously
- AND + OR with grouping: user can specify which filters combine with OR

**Decision:** AND only for Rev 1.

AND matches the "narrow down to answer my question" mental model the user articulated — each additional filter further restricts the result set. OR adds significant UX complexity (grouping UI, filter relationship visualization, precedence rules) for what is likely a minority of operational questions. If users need OR-style behavior, they can save a View that pre-filters to a relevant subset and then narrow from there; alternatively they can compare across two Views. This can be revisited if operational feedback reveals common questions that require OR.

#### 5. Routing column filter supports include AND exclude semantics

**Question:** Should the Routing filter support both "contains process X" and "does NOT contain process X"?

**Options considered:**
- Include-only: filter to parts whose routing includes a specific process (matches the spec's deferred "Includes Process" Rev 2 filter)
- Include + exclude: filter to parts whose routing includes a specific process, or explicitly exclude parts whose routing includes a specific process

**Decision:** Include + exclude.

The user's existing spreadsheet allows both operations; including this in Rev 1 maintains parity with the tool being replaced. The UI is a two-radio-column layout per process type: one column for "exclude" (parts whose routing includes this process are hidden), one for "include" (show only parts whose routing includes this process), mutually exclusive per row, default neither (unconstrained). This design makes it visually clear that include and exclude are mutually exclusive for any given process type.

**Implication:** the spec's "Includes Process" filter, originally deferred to Rev 2, is brought into Rev 1 with expanded semantics (include + exclude). The implementation track should evaluate this against Rev 1 scope; if include-only is more tractable, it is still a net advancement over the original spec.

#### 6. View carries columns + sort + filters; user can override any ad-hoc

**Question:** What exactly does a View persist, and what can the user change without modifying the saved View?

**Decision:** A View saves visible columns (with order), default sort (column + direction), and a filter array. The user can change any of these ad-hoc without dirtying the saved View definition: column visibility via a Columns picker control (session-level overlay on the View's column list), sort via clicking column headers, filters via column-header menus.

When the user makes ad-hoc changes that diverge from the saved View, the View switcher shows a "modified" indicator. The user can then: Save (overwrites the saved View with current state), Save as new (creates a new View with current state, prompting for a name inline), or Revert (discards ad-hoc changes, restores saved View state).

Rationale: trust the user with tools. They should be able to interrogate freely — adding a filter or sorting a column mid-session — without ceremony. They should also be able to preserve a configuration they have built up if it's worth keeping. The modified indicator is the minimal signal needed to close the loop between "this is what I saved" and "this is what I'm currently looking at."

#### 7. Save (overwrite) requires confirmation; Save as new and Revert do not

**Question:** Which modification actions need confirmation gates?

**Decision:** Save (overwrite) gets a confirmation dialog; Save as new and Revert do not.

Save (overwrite) is destructive on a shared resource — it replaces a View that all users rely on. The confirmation dialog explicitly mentions that other users will see the change, which is important because Views are shared (decision 2). Save as new is additive (creates a new View, no existing View is harmed). Revert discards the user's own ad-hoc changes and restores the saved state, which is low-stakes — the user can immediately re-apply any changes they discarded.

#### 8. Switching Views resets ad-hoc changes

**Question:** When the user switches to a different View, do their ad-hoc filters and column changes persist into the new View, or does the new View start clean?

**Decision:** Reset. Switching to a View loads that View's saved columns, sort, and filters fresh, discarding any ad-hoc changes from the previous View.

A View represents a defined frame for asking a specific question; switching to a new View should enter that frame's defined state. If the user wants filters to persist across Views, they should save those filters into the View before switching. The alternative — carrying ad-hoc state across View switches — would produce confusing behavior where the "Inventory Check" View shows filters from "Material Audit" that the user forgot they had active.

#### 9. "All Parts" default View shows every column

**Question:** What does the default View show when the user first opens the grid?

**Decision:** Every column. The user's design principle is "show everything and let them remove what they don't need." Discovering that a column exists is harder than hiding a column you don't need.

**Implication:** the All Parts View has approximately twenty-three columns at full build-out (including Rev 2 columns) and produces horizontal scroll at typical viewport widths. The user accepts horizontal scroll as the cost of complete visibility by default. In the mockup, the full column set with realistic content is demonstrated; the scroll behavior is intentional.

#### 10. Sparse Views size to content, not container width

**Question:** When a View has few columns (e.g., a focused View with four or five columns), should the columns stretch to fill the full container width, or should they pool to the left with the right side of the container empty?

**Options considered:**
- Stretch: columns expand to fill the container (similar to some table frameworks' default behavior)
- Pool left: columns take their natural width; right side of container is empty space

**Decision:** Pool to the left.

Stretching produces excessive horizontal gaps between columns when the column count is low — a three-column View at 1400px would produce columns that are ~450px wide each, which hurts scannability. Pooling to the left keeps columns at their natural content-appropriate widths and leaves whitespace on the right, which is visually cleaner and matches the user's expectation from spreadsheet tools.

### Recommendations for implementation

These recommendations are specific enough that the implementation track can act on them without re-deriving context from this exploration.

- **Views data model:** a `views` table with columns: `name` (string), `is_default` (boolean), `visible_columns` (ordered JSON array of column identifiers), `default_sort` (JSON: `{column, direction}`), `filters` (JSON array of filter objects). Shared at the system level — no user foreign key.

- **Column-header menu UI:** each column header renders a hover-visible chevron (dropdown trigger) exposing: sort ascending, sort descending, clear sort, separator, filter (opens type-appropriate popover), separator, hide column. Right-click on header opens the same menu. Active sort direction is indicated by an arrow icon on the header.

- **Active filter indicators:** when a column has an active filter, a funnel icon appears on the column header. Hovering the funnel shows a tooltip describing the active filter in plain language (e.g., "Material contains 'Alum'"). This is the primary mechanism for a user to know which columns are currently filtered without opening each column's menu.

- **Columns picker control:** a standalone button in the grid toolbar (separate from the Views system) that opens a panel listing all columns with checkboxes. This is the session-level column visibility override — changes here mark the View as "modified" but do not save to the View definition. The picker is the escape hatch when the user wants to temporarily add or remove a column without formally editing the View.

- **View modification UI:** when the active View's current state differs from its saved state, a "modified" badge appears on the View switcher. An adjacent dropdown exposes: Save (with confirmation dialog noting the shared-resource nature of the change), Save as new (opens an inline name input, Enter to confirm), Revert (restores saved state, no confirmation).

- **View management modal:** accessible from the View switcher. Shows a table of Views with: Name (editable inline), Default (radio selection — only one View can be default), Duplicate action, Delete action (gated — the current default View cannot be deleted; the last remaining View cannot be deleted). Column visibility, sort, and filters are not editable from this modal — those are set via the grid itself and then saved.

- **Rev 2 columns acknowledged in schema planning:** the columns explored in the mockup that go beyond the current Rev 1 schema — vendor part number, model link, drawing link, bin minimum/maximum, part cost, cost last updated, machine cycle time, number of setups, material form (as a separate field from material name) — should be planned as Rev 2 additive schema additions. Designing the Views column identifier system to accommodate these now (by treating column IDs as strings rather than enums) means the upgrade path is seamless.

- **Routing filter:** implement with include/exclude semantics as described in decision 5. The UI is a two-column radio matrix (exclude | include) per process type, mutually exclusive per row, default unconstrained.

- **AND-only filter combination** for Rev 1, as described in decision 4. No OR grouping, no filter precedence UI.

- **ProcessTypeChip width standardization:** the chip width reduction (from wider to narrower compact chips) in commit `34f2533` affected both the Parts Master grid and the Routing Templates grid. Any component using `ProcessTypeChip` in compact mode should inherit the narrower dimensions. Implementation should use a single shared component rather than duplicating the chip across views.

### Open questions for implementation track

These are infrastructure questions the mockup did not model and that the implementation track needs to decide.

- **Views persistence layer:** database table design, schema, and migrations for the Views system. The mockup uses in-memory state initialized from a seeded array. The implementation needs to decide on the schema (see recommendation above), handle the default View bootstrap, and define the API endpoints (`GET /api/v1/parts/views`, `POST`, `PATCH /api/v1/parts/views/:id`, `DELETE`).

- **Views permissions:** can any authenticated user create, edit, and delete Views, or is this an admin-only operation? The mockup assumes any user can do all View operations. In a small-shop context with trusted users this may be acceptable; however, a user accidentally deleting the shared "Inventory Check" View that the whole team relies on is a meaningful risk. Options: admin-only creation/deletion with any-user editing, or confirmation gates only (current mockup approach), or a locked "system Views" concept alongside user-creatable Views.

- **View versioning and schema evolution:** what happens when a column referenced in a saved View's `visible_columns` array is later removed or renamed (e.g., a Rev 2 schema change renames a field)? The mockup does not model this. A reasonable answer: the View silently omits column identifiers it does not recognize. A better answer may be a migration step when schema changes touch column identifiers. This needs a decision before Views are persisted.

- **Bootstrap state:** the mockup ships with several seeded Views (All Parts, Material Audit, Inventory Check, etc.). Production needs an answer for how an empty system gets its first Views — likely a database seed or an admin onboarding flow that creates default Views on first launch.

- **Performance at scale:** the mockup has approximately fifteen parts. Real datasets may have thousands. Filter and sort performance at scale needs validation, particularly for deep filter operators (text contains, date range, routing include/exclude with join semantics) on large datasets. Indexing strategies should be considered early if the parts table is expected to grow significantly.

- **Sticky columns:** deferred from this session (explicitly accepted by the user as out of scope for this round). The user flagged interest in pinning Part Number and Part Name columns during horizontal scroll, which would require sticky column implementation. Flagged here so it is not re-evaluated from scratch when revisited.

### Mockup-only refinements

These are things explored in the mockup that are NOT recommended for the implementation track to carry forward verbatim, or that are visual/dimensional decisions the implementation track can adjust without breaking design intent.

- **Specific chip dimensions:** the compact ProcessTypeChip is 16px wide at the reduced size. This is a visual tuning decision reached iteratively in the session, not a design language specification. Implementation should produce chips that feel compact and readable; exact pixel values can shift based on the font and spacing system in the production implementation.

- **Specific modal widths:** the View Management modal uses `max-w-lg`. The Columns picker popover uses a fixed width. These are reasonable starting points but are visual sizing decisions, not architectural constraints — the implementation team can adjust these based on the actual content that appears in the production UI.

- **Dummy data values:** the mockup uses approximately fifteen mock parts with realistic but fabricated field content. This data is for demonstration only. The production implementation uses real data from the database; no mockup data should be copied or referenced in the implementation.

- **Categorical filter exclude operator not implemented:** categorical filter popovers (e.g., Material filter with a list of material values) support "is any of" (include) but do not yet support "is none of" (exclude). This asymmetry was noted as a known limitation — the Routing filter has exclude semantics but general categorical filters do not. Documenting here so this is not re-explored from scratch; if the implementation track adds it, the Routing filter's include/exclude matrix is a good interaction pattern reference.

- **Light mode aesthetic:** the current mockup state is functional but visually unpolished. The user has noted interest in revisiting the visual design post-Rev 1 with specific design intent (typography, color system, spacing rhythm) rather than as a parity exercise against the current mockup. The mockup's visual state is not a target for the implementation; it is a functional skeleton.

---

## Cross-Surface Decisions

Design and implementation decisions that apply across multiple surfaces and are tracked here rather than inside a single session entry.

### Condense toggle as cross-surface viewing affordance

The Condense toggle (a shadcn Switch labeled "Condense") appears in
multiple mockup surfaces: the execution lens views (where it
originated), the Routing Template Library, and is planned for the
Parts Grid. The toggle controls whether ProcessTypeChip instances
render in compact mode (color swatch only) or normal mode (color
stripe with label).

Intent: surfaces that show routing step sequences in dense tabular
contexts benefit from a viewing-density control. Labeled chips are
more readable; compact chips fit more sequence detail in less
horizontal space. The toggle lets users choose per-surface based on
their current task.

Implementation choices made for Rev 1:
- The toggle is implemented as a shared component
  (/components/condense-toggle.tsx) for reuse across surfaces.
- Condense state is per-surface (each surface holds its own
  useState). Not currently a user-wide preference. Different
  surfaces declare different defaults: the Routing Template Library
  defaults to non-condensed (labeled chips); the Parts Grid will
  default to condensed (density at scale matters more there).
- If a global preference layer is wanted later, the per-surface
  useState can migrate to a shared hook without changing the
  component's API.
- Only the Sequence column (or equivalent) responds to condense.
  Other surface elements (legend bars, form fields, individual step
  cards in form UIs) always render at full label fidelity.

Discovered: Phase 2 Routing Template Library UI implementation.
First implementation: this commit. Next planned use: Parts Grid.

---

## Spec Gap: Location column missing from Stock Fulfillment candidate list

`spec/stock_fulfillment_view_spec.md` does not include an Inventory Location
column in the candidate table column list. During mockup iteration, Location
was added to support the physical pull step of fulfillment — planners need
to know where to walk. The data exists on Part and Assembly records
(`inventoryLocation` field) but the spec is silent on surfacing it.

**Gap:** The spec column list and column-placement rules need to be updated
to include Location (after Due Date, before Parent) with a note that null
values render as a dash and the purpose is operational pull-step support.

Discovered: Stock Fulfillment mockup iteration (Location column + expansion
row alignment pass).
