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
