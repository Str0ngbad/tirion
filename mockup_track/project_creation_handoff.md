# Project Creation View — Implementation Handoff

**Mockup locked:** 2026-06-11  
**Spec:** `spec/project_creation_view_spec.md`  
**Mockup source:** `app/mockups/project-creation/`  
**Phase:** Rev 1, Stage 6 (Project Creation)

This document is the consolidated handoff from the mockup track to the
implementation track for the Project Creation View surface. It is written
to stand alone — the reader does not need to have followed the session log.
Reference the spec as the authoritative source on behavior; reference this
document for gaps, decisions made during mockup iteration, and
implementation guidance.

---

## 1. Surface Overview

The Project Creation View is the entry point for all production demand in
Tirion. It contains four surfaces:

- **Project List** — unified list of Draft and Active Projects; landing
  surface; entry to the other three
- **Draft Editor** — where planners build a Project's metadata and
  top-level BOM references, run live validation, and compile a Draft into
  an Active Project
- **Compile Failure Screen** — shown in-place of the Draft Editor body
  when compilation is triggered but validation fails; lists all failures
  with deep links to resolution surfaces
- **Active Project Summary** — read-mostly surface for Active and Complete
  Projects; shows WO completion progress and editable project-level metadata

The spec (`spec/project_creation_view_spec.md`) is the source of truth for
all business rules, state transitions, hard rules (PC-1 through PC-21), WO
generation semantics, and permission tables. Read it in full before
implementing.

**Rev 1 scope** covers the full Draft Editor + compilation flow, the
Compile Failure Screen, and the Active Project Summary in its
current read-mostly form. The edit affordances on Active Projects that
are deferred to Phase 8 are listed in section 6 below.

---

## 2. Spec Gaps to Backfill Before Implementation Begins

These items exist in the locked mockup but are not yet in
`project_creation_view_spec.md`. The implementation track must backfill
each into the spec (with user approval) before building, so the spec
remains authoritative.

### 2.1 Project Color attribute

The mockup adds an optional `color` attribute to the Project entity. It is
not in the spec.

**What was decided in the mockup:**

- Type: `ProjectColor | null` (see `_data.ts` for the union definition)
- Default: `null` — means no pill; Project Number renders as plain text
- Stored as a string column; hex and tint values live in the frontend
  color map, not the database
- Editable from: Draft Editor header (color picker affordance), Active
  Summary header (the only edit affordance on the Active Summary pre-Phase 8)
- Null is a valid permanent state, not an unfilled field

**Palette (13 colors, order is meaningful for the picker grid):**

```
Blue, Light Blue, Purple, Light Purple,
Red, Pink, Orange, Light Orange,
Yellow, Green, Light Green, Gray, Brown
```

The picker renders these as a 7-column grid (None + 13 colors = 14 cells,
two rows of 7). None is the first cell; it renders as a muted circle with
an X icon when unselected, a check when selected.

**Color map** (authoritative values in `_data.ts` `PROJECT_COLOR_MAP`):

| Key | Hex | Text on pill |
|-----|-----|-------------|
| `blue` | `#1d4ed8` | white |
| `lightBlue` | `#7dd3fc` | black |
| `purple` | `#7e22ce` | white |
| `lightPurple` | `#d8b4fe` | black |
| `red` | `#dc2626` | white |
| `pink` | `#ec4899` | black |
| `orange` | `#f97316` | black |
| `lightOrange` | `#fdba74` | black |
| `yellow` | `#facc15` | black |
| `green` | `#15803d` | white |
| `lightGreen` | `#86efac` | black |
| `gray` | `#4b5563` | white |
| `brown` | `#92400e` | white |

**Schema implication:** add `color: varchar(30) nullable` to the `Project`
table (or equivalent, per your chosen enum/string strategy). The palette
is frontend-enforced; a CHECK constraint on the string values is optional
but recommended.

**API implication:** include `color: string | null` (camelCase) in Project
resource responses. The field is optional metadata and does not affect any
business logic, compilation, or WO generation.

**What the implementation track must do:** backfill the Color attribute
into the spec, confirm the schema approach, implement the color picker
component and wiring, and ensure `ProjectIdPill` (see 2.2) uses the real
color value from the Project record.

### 2.2 `ProjectIdPill` component — cross-surface UI primitive

The Project Number is rendered everywhere as a `ProjectIdPill`:

- When `color` is set: solid-background pill using `meta.hex`, text color
  per `meta.text`, monospace font, `px-[0.45em] py-[0.1em]` padding,
  `rounded` corners
- When `color` is null: plain `<span className="font-mono">` — no pill

The component wraps the Project Number string only. It is size-agnostic
(uses `em` units so it scales with surrounding text).

**Current mockup location:** `app/mockups/project-creation/_components/project-id-pill.tsx`

**This is the first cross-surface UI primitive established during the mockup
track.** It will be referenced by every surface that displays a Project
Number: Project List, Draft Editor, Active Summary, Compile Failure Screen,
success toasts, Project View, Operations Lens, Receiving Lens, and any
future surface. The implementation track must place it in the shared
component directory — `components/ui/` or `components/project/` — not
nested inside the project-creation surface.

**What the implementation track must do:** backfill the `ProjectIdPill`
treatment into the spec (or capture it as a design vocabulary entry in
CLAUDE.md), move the component to its durable shared location, and use it
consistently across all surfaces that display a Project Number.

### 2.3 Empty Draft state

The Draft Editor must render gracefully when opened against a brand-new
empty Draft (no fields filled in, no top-level items added).

**What was decided in the mockup:**

- Project Number field auto-focuses on initial load of a new Draft. Guard:
  `!project.projectName` prevents re-focusing on existing Drafts that
  already have content
- The validation summary banner renders in neutral empty-state form when
  there are no top-level items ("Add top-level items to begin validation")
- The BOM Tree Preview section is always visible, with a placeholder when
  no items are present
- The Compile button is disabled with a tooltip when required fields are
  missing

**What the spec currently says:** the spec describes the Draft Editor in
steady-state (items present, fields filled) but does not specify the
transient new-Draft state.

**What the implementation track must do:** backfill the empty-state
renderings into the spec or accept them as implied by the spec's field
requirements. Confirm that auto-focus on Project Number is the intended
behavior on new Draft entry.

### 2.4 Add New Project flow routing

**What was decided in the mockup:**

Click "Add New Project" → create an empty Draft record in the session
store → navigate immediately into the Draft Editor. No intermediate create
modal. The Draft Editor serves as both the create surface and the edit
surface.

**What the spec currently says:** the spec says "Opens the Project Editor
with an empty Draft. The Draft is created in the database immediately on
entry to the editor." This is consistent with the mockup's behavior, but
the spec language could be read as allowing an intermediate confirm step.

**What the implementation track must do:** confirm the spec language is
unambiguous that the Draft Editor is the create surface (no modal), and
that the Draft record is persisted immediately on navigation to the Editor
(not on first field edit). Clarify if needed.

### 2.5 Project Number uniqueness validation

**What was decided in the mockup:**

Project Number uniqueness is validated on field blur against the full
project list. An inline error appears if the entered number collides.

**What the spec currently says:** section "Validation behavior" states
"Project Number uniqueness validated on field blur. Inline error if
duplicate." This is consistent with the mockup.

**What the implementation track must do:** confirm the spec is complete on
this point. The real implementation must validate against the database
(not just the in-memory list), which means an API call or server action on
blur. Confirm the error message text and inline placement.

### 2.6 Palette picker UI layout (7-column grid)

**What was decided in the mockup:**

The picker renders 14 cells (None + 13 colors) in a 7-column grid, two
rows. The grid order matches `PROJECT_COLORS` in `_data.ts`. "None" is
always the first cell.

**What the spec currently says:** not mentioned.

**What the implementation track must do:** backfill the picker layout
convention into the spec or accept it as a design decision captured in this
document. The implementation should use a Radix Popover (or equivalent)
instead of the mockup's `absolute`-positioned div, which has no
viewport-edge detection.

---

## 3. Patterns Worth Preserving

### ProjectIdPill as the canonical Project Number treatment

The `ProjectIdPill` pattern — color as a property of the Project Number
rendering, not a separate adornment — held up well across all four surfaces
during mockup iteration. A colored row-tint-plus-chip was tried first and
replaced; the pill is strictly better. The implementation should adopt it
as the system-wide treatment and not re-derive it per surface.

### Empty-state handling in every section

Every section of the Draft Editor that can be empty has an explicit
empty-state rendering. This is more reliable than leaving blank space —
users need affordance cues when the page is empty on first open. The
mockup's empty states for the validation banner, BOM Tree Preview, and
Compile button are the reference for the implementation.

### Three-state Compile button

The Compile button uses three visual states: disabled (missing required
fields), amber warn (fields present but validation failures exist),
primary enabled (all clear). This three-state pattern fits any action with
both hard gates and fixable-but-valid-to-proceed conditions. It is not a
general pattern for all buttons — only for actions that have this shape.

### Compile Failure Screen as a full surface replacement, not overlay

When compilation fails, the Draft Editor body is replaced entirely by the
Compile Failure Screen (not a modal). The "Return to Editor" button is the
only exit. This worked well in mockup use — the failure screen has enough
content (N failures with BOM paths and deep links) that a modal overlay
would be cramped.

### Validation as pure functions in `/lib`

The mockup's `_lib/validation.ts` contains the complete validation logic:
`validatePart`, `validateTree`, `validateProject`, `failCount`, `allPass`.
These are pure functions with no component or database imports. The
implementation should replicate this separation — validation logic in
`/lib`, callable from both the live-validation path and the compile
transaction. The function signatures and type definitions in `validation.ts`
are a clean reference for the real implementation.

---

## 4. Patterns Specifically NOT to Carry Forward

### `ALWAYS_ASSIGN_PARTS` data fix

At module init, `_data.ts` builds a `Set<number>` of Part IDs by walking
the BOM trees of the clean-compile draft projects (17559, 10256) and the
two Active projects (10121, 10030). The `resolvePartTemplate()` helper
returns a mock template for any Part in this set, overriding the real
data's `null` template values.

**Why it exists:** the real Part Master data has `routingTemplate: null`
on many leaf Parts. Without this override, every project would fail
validation and the mockup could not demonstrate the success path. The set
scopes the override to the coherent clean-compile subset, so project 10236
still fails as designed.

**Do not model this.** The real implementation checks `RoutingTemplate`
assignments on the actual Part records in the database. There is no
equivalent of `ALWAYS_ASSIGN_PARTS` in the real system.

### Module-level session store

`_data.ts` exports `getSessionProjects`, `setSessionProjects`, and
`createNewProject`. These use a module-level `_sessionProjects` variable
that persists across Next.js client-side navigations within the same SPA
session.

**Do not model this.** This is a mockup shortcut for sharing state between
the list page and the detail page without a real store. The implementation
uses the actual database + Prisma + API routes. If a client-side cache is
needed, use React Query, SWR, or Zustand — not module scope.

### Synthetic Project records and ID generation

The five seeded projects (projectIds 1–5, projectNumbers 17559, 10256,
10236, 10121, 10030) and the `_nextProjectId` / `_nextProjectNumber`
counters starting above them are mock data.

**Do not model this.** The implementation uses real Project records from
the database with real database-assigned IDs.

### Mock current user

`createNewProject()` hardcodes `createdByUserId: 3, createdByName: "Marcus Hill"`.

**Do not model this.** The implementation uses the authenticated user's
identity from the session/auth layer.

### `absolute`-positioned color picker

`color-picker.tsx` uses `absolute left-0 top-9` with a fixed width. It
has no viewport-edge detection and can clip at screen edges.

**Replace with:** a Radix Popover (or shadcn Popover wrapper) which handles
positioning automatically. The picker's internal layout (7-column grid,
swatch behavior) is correct; only the positioning mechanism needs updating.

### Dead-end deep links

The mockup's Compile Failure Screen and BOM Tree Preview have inert
annotation links for `template-inactive` failures:
`"Routing Template Editor — not yet built"`. The `getDeepLink()` function
in the Draft Editor has a `template-inactive` case that renders this.

**Replace with:** a real link to the Routing Template Editor for that
template. The spec section on deep links specifies the target
(`template-inactive → links to the Routing Template Editor with the
inactive template selected`). Wire it when the Routing Template Editor has
a URL-addressable per-template route.

---

## 5. Known Limitations of the Mockup

These are gaps in the mockup that the implementation track must address:

- **Module state resets on hard reload** — any projects created or color
  changes made during the session are lost. The implementation persists to
  the database.
- **`template-inactive` deep links are inert** — see section 4 above.
- **No actual database transaction on Compile** — the mockup runs an
  800ms simulation and then sets component state. The real compile is an
  atomic Prisma transaction (see spec section "Compilation Behavior",
  rule PC-1).
- **No actual user authentication** — mock current user hardcoded.
- **No toast persistence** — compile success toasts are transient
  in-component state. The implementation should use a global toast system
  (shadcn Toaster or equivalent).
- **Active Summary read-only** — Add Top-Level Item, Edit Due Date cascade
  modal, and Archive workflow are not built. These are Phase 8 deferred
  (see section 6).
- **WO count on Active projects is fixed at compile time** — the mock WO
  trees for projects 10121 and 10030 are generated at module init and never
  progress. Progress bars always show 0%. Expected in a mockup.

---

## 6. Phase 8 Dependencies

The Active Project Summary in Rev 1 is intentionally read-mostly. The
following affordances are Phase 8 work and must NOT be built as part of
the Rev 1 Project Creation implementation:

- **Add Top-Level Item to Active Project** — new top-level Assembly added
  post-compile, triggers another validation + atomic WO subtree generation
  transaction. Full workflow specified in the spec under "Adding a
  Top-Level Item to an Active Project."
- **Edit Project Due Date cascade modal** — due date change triggers a
  cascade to all WOs in an atomic transaction. Specified in spec under
  "Editing Project Due Date."
- **Project Archive workflow** — Manager-initiated, with different
  confirmation dialogs for Active vs Complete Projects. Specified in spec
  under "Project Archive."

The Active Summary's read-only notice banner is the correct Rev 1 scope.
Do not add these affordances to the Rev 1 implementation.

---

## 7. Deferred Work — Pointer to DEFERRED.md

`DEFERRED.md` contains an entry for the **Persistent Issue-Resolution
Helper** raised during Project Creation mockup iteration (2026-06-10).

This is a cross-surface concern affecting the Compile Failure Screen
(Project Creation), the Definition Change Flag inspection (Parts), and
the Deactivation Blocker resolution (Vendors/MaterialSpecs/Parts). All
three surfaces present a bounded list of fixable issues where resolving
any one requires navigating away from the list, losing context.

The Rev 1 implementation handles each surface inline with deep links.
Users navigate away, fix the issue, navigate back, and re-run. This is
suboptimal but not a blocker for Rev 1.

**Do not attempt to build the persistent helper in Rev 1.** The design
starting point (pinnable overlay with detach-to-window option) is captured
in `DEFERRED.md`. The right first step for Rev 1.5+ is to derive the
common shape across all three surfaces before building anything.

---

## 8. File Inventory

All files at `app/mockups/project-creation/`:

| File | Purpose |
|------|---------|
| `_data.ts` | All mock data: `ProjectColor` type and `PROJECT_COLOR_MAP`, `MockProject` type, seeded projects (17559, 10256, 10236, 10121, 10030), session store (`getSessionProjects` / `setSessionProjects` / `createNewProject`), `ALWAYS_ASSIGN_PARTS` shim, `resolvePartTemplate()`, BOM-tree WO generation (`buildWOs`), WO count helpers |
| `_lib/validation.ts` | Pure validation functions: `validatePart`, `validateTree`, `validateProject`, `failCount`, `allPass`; `ValidationResult` discriminated union; `NodeValidation` type |
| `page.tsx` | Project List surface — unified Draft + Active list, status filter tabs, "Add New Project" button, row delete action |
| `[id]/page.tsx` | Detail page — routes to Draft Editor or Active Summary based on project status; breadcrumb with `ProjectIdPill`; color picker wiring for Active Summary |
| `_components/project-list.tsx` | Project List component — table rows with `ProjectIdPill`, status badges, progress column, row actions |
| `_components/draft-editor.tsx` | Draft Editor component — header fields, color picker trigger, top-level items table, BOM Tree Preview wrapper, Compile button (three states), compile simulation, Compile Failure Screen swap, delete Draft |
| `_components/active-summary.tsx` | Active Project Summary component — header (read-only + color picker), progress bars per top-level item, Quick Navigation links (inert annotations), Phase 8 deferred notice |
| `_components/compile-failure-screen.tsx` | Compile Failure Screen — failure list with BOM path breadcrumbs, deep links (with inert annotation for `template-inactive`), "Return to Editor" button |
| `_components/bom-tree-preview.tsx` | BOM Tree Preview — expandable tree, per-node validation indicators, Fix deep links, Expand All / Collapse All / Reset controls |
| `_components/part-search-combobox.tsx` | Searchable Part/Assembly selector used in Draft Editor top-level item add control; relevance-ranked search (exact → prefix → substring → edit-distance) |
| `_components/project-id-pill.tsx` | `ProjectIdPill` component — renders Project Number as a colored pill or plain text. **Move to shared component directory in implementation.** |
| `_components/color-picker.tsx` | Color picker popover — 7-column swatch grid, None option, click-outside dismiss. **Replace positioning with Radix Popover in implementation.** |
