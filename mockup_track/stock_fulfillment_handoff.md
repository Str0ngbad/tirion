# Stock Fulfillment View — Implementation Handoff

**Mockup locked:** 2026-06-13  
**Spec:** `spec/stock_fulfillment_view_spec.md`  
**Mockup source:** `app/mockups/stock-fulfillment/`  
**Phase:** Rev 1, Stage 7 (Stock Fulfillment)

This document is the consolidated handoff from the mockup track to the
implementation track for the Stock Fulfillment View. It stands alone — the
reader does not need to have followed the session log. Reference the spec as
the authoritative source on business rules; reference this document for gaps,
decisions made during mockup iteration, and implementation guidance.

---

## 1. Surface Overview

The Stock Fulfillment View is the second step in the operational sequence,
receiving WOs from Project Creation in `Unreleased` state. Planners review
WOs that qualify as fulfillment candidates (Stock ≥ Demand), record
decisions (Fulfill from Stock or Pass Through), and explicitly release
decided non-candidate WOs downstream via the Release button.

The surface is organized around three layers:

- **Toolbar** — Project filter dropdown, Competing-only toggle, Global Release
  button
- **Project Header strip** — one card per Active Project with unreleased WOs;
  shows Candidates count, Pending Release count, and per-project Release button
- **Candidate table** — the list of WOs eligible for stock fulfillment,
  supporting inline expansion for cross-project competition context

The surface is narrow in scope by design: only WOs where Stock ≥ Demand are
surfaced. Non-candidates are tracked by the system as "Pending Release" and
release alongside candidates when the planner clicks Release.

**In scope for Rev 1:** the full candidate list, all three actions (Fulfill,
Pass Through, Reconcile Stock), the Release workflow (per-project and global),
Assembly cascade, auto-pass-through, and the inline expansion panel.

**Out of scope for Rev 1:** reversal of fulfillment, inventory bin/location
management beyond display, permissions sub-gating for Reconcile Stock (see
spec's Rev 2 Backlog section).

Read `spec/stock_fulfillment_view_spec.md` in full before implementing. The
hard rules (SF-1 through SF-18) and the operational sequence diagram are
load-bearing.

---

## 2. Spec Gaps to Backfill Before Implementation Begins

These items exist in the locked mockup but are not yet in
`spec/stock_fulfillment_view_spec.md`. The implementation track must backfill
each into the spec (with user approval) before building.

### 2.1 "Pending Release" UI terminology

**What the spec says:** "Decided but Unreleased" in the Project Header table,
"Release All Reviewed WOs (N)" for the Global Release button, "Release Project
[Number] — N WOs" for per-project Release buttons.

**What the mockup uses:**
- Project Header cards: "Pending Release" (column label and count)
- Per-project Release button: `"Release Project {projectNumber}"` — no N,
  no " — N WOs" suffix. The adjacent "Pending Release" count card carries
  the number.
- Global Release button: `"Release All Pending (N)"`

The audit-trail terms (`stockFulfillmentReviewedAt`, `StockFulfillmentReleased`)
are unchanged from the spec.

**What the implementation track must do:** update the spec's Project Header
table and button label language to match the mockup's terminology. The
"Pending Release" framing proved operationally clear; "Decided but Unreleased"
is accurate but verbose. Backfill both the column label and the button label
variants.

### 2.2 Set semantics — Candidates and Pending Release as disjoint sets

**What the spec says:** The spec defines candidacy criteria (SF-1 through the
Entry Conditions section) and discusses decided-but-unreleased WOs separately,
without explicitly stating the invariant.

**What the mockup encodes:**

```typescript
// computeProjectStats (in _data.ts):
// candidateCount: WOs in the current candidate set
// unreleasedCount: all WOs with status === "Unreleased"
// pendingReleaseCount: unreleasedCount - candidateCount
```

**The invariant:** `Candidates + Pending Release = total Unreleased WOs`.
Holds continuously. Any WO that is Unreleased is either a current Candidate
or in Pending Release — never both, never neither (while Unreleased).

A WO is a **Candidate** when ALL are true:
- `status === "Unreleased"`
- `reviewedAt === null`
- `stockCounts[partId] >= quantity`
- Parent Project `status === Active`
- Not cancelled
- Not defensively de-listed (no Complete descendant in same project for Assembly WOs)

A WO is in **Pending Release** when it is Unreleased in an Active project
and is NOT a current Candidate (either because it was decided, lost stock
eligibility, or was never eligible).

**What the implementation track must do:** backfill the invariant explicitly
into the spec and implement it as a verifiable assertion. This is a strong
test target — a unit test that checks `C + P = U` after every action in the
session would catch counting bugs immediately.

### 2.3 Project Header disappearance rule

**What the spec says:** "A Project's header disappears from the view when:
All candidates have decisions recorded AND All decided WOs have been released."

**What the mockup uses:**

```typescript
// visibleProjects filters:
.filter((p) => (projectStats[p.projectId]?.unreleasedCount ?? 0) > 0)
```

A Project Header disappears when `unreleasedCount === 0`, equivalently when
`candidateCount === 0 AND pendingReleaseCount === 0`. These are logically
equivalent to the spec's phrasing, but the spec's language implies two
separate conditions that both need to be true. The mockup's single
`unreleasedCount` check is cleaner.

**What the implementation track must do:** update the spec to use the explicit
`unreleasedCount === 0` (or equivalent) formulation so the rule is
unambiguous.

### 2.4 Per-project Release button label

**What the spec says:** `"Release Project [Number] — N WOs"` (count embedded
in the button).

**What the mockup uses:** `"Release Project {projectNumber}"` — no count.
The "Pending Release" count in the adjacent header card carries the number.

**Why:** the count on the per-project button was redundant with the Pending
Release count displayed 40px to the left. Removing it reduces visual noise
without losing information.

**What the implementation track must do:** update the spec's button label to
match. Confirm with user if the adjacent count card fully covers the
information need.

### 2.5 Release-respects-filter rule — asymmetric application

**What the spec says (SF-16):** "Release scope respects the current view
filter. Global Release releases all decided-but-unreleased WOs across visible
Projects; Project-specific Release in a header releases only that Project's."

This language reads as a uniform rule, but the mockup's implementation is
asymmetric:

**Global Release button:** respects both the Project filter dropdown AND the
Competing-only toggle (scoped to `filterProjectId ? [filterProjectId] :
undefined` passed to `releaseAll()`).

**Per-project Release button:** respects neither filter. Always releases the
full Pending Release set for that Project, regardless of the Competing-only
toggle or whether that project is the active filter.

```typescript
// releaseProject() ignores the candidateWoIds that are filter-scoped —
// it operates on the projectId directly.
// releaseAll() accepts an optional projectIds array from the current filter scope.
```

**What the implementation track must do:** update SF-16 to explicitly state
the asymmetric behavior. The rule should read: Global Release respects both
the Project filter and the Competing-only toggle scope. Per-project Release
ignores both filters and always releases that Project's full Pending Release
set. The asymmetry is intentional — per-project Release is a "clear this
project" action, not a "clear what I can currently see" action.

### 2.6 "BOM Position" column → "Parent" column with hover-for-ancestry

**What the spec says:** "BOM Position — Path within the Project's BOM tree
(e.g., '20137.01 → BRACKET-100 → FAST-M5'). Informs the planner where to
physically allocate the pulled parts."

**What the mockup uses:** a "Parent" column showing the immediate parent's
`partNumber` in monospace. Top-level WOs render `—`. A hover tooltip on the
Parent cell surfaces the full ancestry chain (closest ancestor first), with
both `partNumber` and `partName` per ancestor level.

**Why:** the full path string in a column cell truncated at typical widths and
was hard to scan quickly. The immediate parent is the operationally relevant
piece ("which bin does this part go into?"); the full path is useful on demand.

**Design intent is unchanged** — ancestry context is preserved, just
reorganized between the column and a tooltip.

**What the implementation track must do:** update the spec column name to
"Parent" and describe the hover-for-ancestry behavior. The spec's note about
physical bin allocation context remains valid; it just applies to the Parent
column + tooltip combination.

### 2.7 Cumulative Demand column — candidate-only scope

**What the spec says:** "Cumulative Demand — Total Unreleased demand for this
PartID across all Projects. Surfaces cross-Project context at a glance."

**What the mockup uses:** cumulative demand counts only current Candidate WOs:

```typescript
const cumulativeDemand = getCompetingCandidates(candidates, wo.partId)
  .reduce((sum, c) => sum + c.quantity, 0);
```

Non-candidate demand (WOs that have been passed through, auto-passed, or that
never had stock eligibility) is excluded.

**Why:** non-candidate demand is already decided; it doesn't inform the
planner's current decision. Including it would inflate the number beyond what
the planner can act on in this view.

**What the implementation track must do:** update the spec's Cumulative Demand
column description to say "Total demand from current Candidate WOs for this
PartID across all Projects" and note that non-candidates are excluded.

### 2.8 Amber threshold on Cumulative Demand

**What the spec says:** silent on visual treatment for the Cumulative Demand
column.

**What the mockup uses:** when `cumulativeDemand > stockCount` for a given
PartID, the Cumulative Demand cell renders in `text-amber-500`. This is the
established status-amber.

**What the implementation track must do:** backfill this visual rule into the
spec's "Visual conventions" section.

### 2.9 Location column

**What the spec says:** not listed in the Candidate List Columns table.

**What the mockup uses:** a "Location" column sourced from the Part/Assembly
`inventoryLocation` field (`MOCK_PARTS.find(p => p.partId === wo.partId)?.inventoryLocation`).
Renders the raw string value or `"—"` when null.

**Operational rationale:** planners need to know where to walk during the
pull step. Without this column, they would need to cross-reference Parts
Master mid-workflow. The data already exists on Part records; surfacing it
here is low-cost and high-value.

**What the implementation track must do:** add Location to the spec's column
table (after Due Date, before Parent) with a note: source is `Part.inventoryLocation`,
renders `—` when null, purpose is pull-step physical navigation.

Note: this gap was also recorded in the MOCKUP_TRACK.md "Spec Gap: Location
column missing from Stock Fulfillment candidate list" cross-surface entry.

### 2.10 Location as fourth sort key

**What the spec says (SF-14):** "Default candidate list order is Project, then
top-down BOM order (ancestor before descendants)."

**What the mockup uses:** within BOM sibling groups (WOs that share the same
`parentWoId`), a Location ascending sort (nulls last) precedes the `bomOrder`
tiebreaker. Top-level WOs (`.01`, `.02`, …) retain their reference `bomOrder`
sequence — Location does NOT override inter-top-level Assembly ordering.

The full sort hierarchy:
1. Due Date ASC (nulls last) — determines Project emit order
2. Project ID ASC — tiebreaker within same due date
3. DFS pre-order (ancestor before descendants) — within Project
4. Location ASC (nulls last) — within BOM sibling groups only
5. `bomOrder` ASC — final stability tiebreaker

**Implementation note:** the sort is not a flat comparator. `locationSortedProject()`
in `_data.ts` performs a DFS traversal per project, sorting each sibling group
independently. A flat sort cannot produce the correct ancestor-before-descendant
ordering combined with sibling-level location grouping.

**What the implementation track must do:** update SF-14 to include Location as
the fourth sort key with the constraint that it applies within sibling groups
only. Recommend validating the behavior with real bin codes before locking —
the mockup uses plain string sort; natural sort (e.g., "A-1" < "A-2" < "A-10")
may be necessary if bin code formats surface ordering problems.

### 2.11 "Competing only" filter toggle

**What the spec says:** the Filters section lists only a Project filter. No
toggle.

**What the mockup uses:** a shadcn `Switch` labeled "Competing only" in the
toolbar. When on, the candidate list is filtered to only rows where
`cumulativeDemand > stockCount` (the amber rows). Composes with the Project
filter via AND. Global Release scope respects both filters; per-project Release
ignores both (see 2.5).

Empty state when toggle is on and no rows qualify: "No competing candidates.
Toggle off to see all rows."

**Workflow rationale:** the toggle supports a two-phase planner pattern —
enter decision mode (toggle on, resolve contested WOs), then exit decision
mode (toggle off, work through remaining clean WOs at speed).

**What the implementation track must do:** add the Competing-only toggle to
the spec's Filters section. Document the AND composition with the Project
filter. Explicitly state the asymmetric Release behavior (see 2.5).

### 2.12 Reconcile Stock as inline edit icon

**What the spec says:** "Reconcile Stock — Modal trigger. Always available"
(listed as an Actions column entry alongside Fulfill and Pass Through).

**What the mockup uses:** a `Pencil` icon inline with the Stock count value
in the Stock column, with a shadcn Tooltip reading "Reconcile stock." The
icon is on parent candidate rows only. Expansion rows show the Stock value
but no icon.

**Why:** Reconcile is a Part-level action, not a WO-level action. Placing it
inline with the Stock count visually connects the affordance to the data it
operates on. Removing it from the Actions column declutters the right side.

**What the implementation track must do:** update the spec's column description
to describe the inline placement (inline with Stock count value, parent rows
only) rather than as an Actions column button.

### 2.13 Inline expansion filtered to candidates only

**What the spec says (SF-13):** "Inline expansion always shows all competing
Unreleased WOs across all Projects, regardless of active filters on the
candidate list."

**What the mockup uses:** the expansion shows only competing Candidate WOs
for the same PartID (`getCompetingCandidates()` takes the candidates list,
not all workOrders):

```typescript
export function getCompetingCandidates(
  candidates: SfWorkOrder[],
  partId: number
): SfWorkOrder[] {
  return candidates.filter((w) => w.partId === partId);
}
```

Non-candidates (passed-through, auto-passed, defensively de-listed ancestors)
are excluded.

**Why:** the expansion is a decision-support tool. Non-candidates have already
been decided or lost eligibility — showing them would add noise without
supporting a decision the planner can make right now. The spec's language
("all competing Unreleased WOs") predates the candidate-only semantic
established during iteration.

**What the implementation track must do:** update SF-13 to say the expansion
shows all competing **Candidate** WOs for the PartID across all Projects,
not all Unreleased. The "regardless of active filters" part still holds —
the expansion is not constrained by the toolbar's project filter or the
Competing-only toggle.

### 2.14 Inline expansion column structure and actions

**What the spec says:** "The expansion shows: each competing WO's Project
Number and Top-Level Reference, Demand quantity for each, Cumulative Demand
across all competing WOs, a 'Fulfill from this row' action on each entry."

**What the mockup uses:**

**Column structure:** expansion rows render in the same `<table>` as parent
rows, using a shared `<colgroup>`. Columns: Project, Part Number, Part Name,
Demand, Stock, Cumulative Demand, Due Date, Location, Parent, Actions. The
Project cell uses extra left indent (`pl-8`) to indicate visual nesting.

**Actions on expansion rows:** both `Fulfill from Stock` and `Pass Through`
buttons (no Reconcile icon — Reconcile is parent-row only). The spec only
mentions "Fulfill from this row."

**What the implementation track must do:**
- Update the spec to describe the full column structure for expansion rows
  (matches parent table minus Status column, with Project cell indented).
- Add `Pass Through` as an expansion-row action alongside `Fulfill from Stock`.
- Confirm that Reconcile is explicitly parent-row only.

### 2.15 Empty state for expansion with no competing candidates

**What the spec says:** not addressed.

**What the mockup uses:**

```tsx
<td colSpan={10} className="px-8 pb-3 text-xs italic text-muted-foreground">
  No other candidates competing for this Part.
</td>
```

Shown when a candidate row is expanded but `competitors.length === 0` (the
row has no other candidates sharing its PartID).

**What the implementation track must do:** add the empty state rendering to
the spec.

### 2.16 Active Project Header filter visual state

**What the spec says:** "Clicking a Project header focuses the candidate list
on that Project. A 'Show all Projects' toggle returns to the unified view."

**What the mockup uses:** clicking a Project Header sets `filterProjectId`
to that project. The active-filter visual state is `ring-2 ring-inset
ring-ring/50 bg-accent/30` — a neutral ring. A small "Filtered" label
appears beside the project name. Clicking the same header again clears
the filter.

**Important:** the ring color is neutral (from the design token `ring`),
explicitly NOT the project's color. See section 5 (Color Discipline) for why.

The toolbar's Project dropdown remains at "All Projects" while the header
filter is active — they are parallel filter mechanisms that are not synced
in the mockup. The real implementation should use a single filter state
source.

**What the implementation track must do:** decide whether to sync the
dropdown and header filter states in the real implementation (recommended:
yes — single source of truth). Backfill the header click behavior and
visual state into the spec's UI description.

### 2.17 Other gaps identified from code review

**`SfWoStatus` includes `"Skipped"`** — the mockup's type union is
`"Unreleased" | "Open" | "Complete" | "Skipped"`. The spec's schema section
notes `Skipped` is "already pending Stage 6 from OQ-013." Confirm this is
resolved in the schema before implementation.

**`bomPath` field on `SfWorkOrder`** — the mockup carries a `bomPath: string[]`
on each WO (ancestor path from project root to this WO's part, top-level ref
first). This data informs the Parent column tooltip and the BOM ancestry chain
display. The real implementation needs to either store this on the WO record
or compute it efficiently from the BOM graph at query time. Consider whether
a denormalized path string is worth storing for query performance.

**Due Date sourced from Project, not WO** — in the mockup, Due Date in the
candidate table is `project.dueDate`, not a WO-level field. The sort also uses
project due date. Confirm the spec's intent — if individual WOs can carry
their own due dates (e.g., from BOM-level delivery requirements), the real
implementation may need a more nuanced due date source.

**Global Release counts "pending" across visible projects** — `totalPendingRelease`
in the component is the sum of `pendingReleaseCount` across `visibleProjects`
(which respects the project filter but not the Competing-only toggle). The
Release All button uses `filterProjectId ? [filterProjectId] : undefined` as
the scope. Confirm this is the correct behavior when both filters are active.

---

## 3. Patterns Worth Preserving

### Set-based count semantics with verifiable invariant

The disjoint Candidates and Pending Release sets, with `C + P = U` as a
continuous invariant, are a clean basis for the count display logic and
the Release behavior. The implementation should encode the set definitions
in a single place (`computeCandidates` + `computeProjectStats`) and derive
all displayed counts from those definitions. A unit test that asserts
`C + P = U` after every action would catch counting bugs immediately.

### `ProjectIdPill` for color signal

Project color belongs to the pill, and only the pill. This was violated twice
during iteration (row background tint, then Project Header card background)
and both violations were caught and reverted. See section 5 for the full
rationale and structural enforcement recommendation.

### Reconcile Stock as inline edit icon

The Pencil icon inline with the Stock count value is operationally cleaner
than a button in the Actions column. It reads as "the Stock number is editable
here" rather than "there is an action you can take on this row." Implementation
should preserve this UX.

### Shared `<colgroup>` for parent and expansion rows

Parent rows and expansion rows live in the same `<table>` element, with column
widths set via `<colgroup>`. This eliminates alignment drift between parent
and expansion content without the complexity of a nested table. The `CX`
constant object in `page.tsx` maps column names to shared Tailwind class
strings, keeping parent and expansion cell classes in sync.

### Location as sort key for physical workflow

The Location-within-siblings sort produces a meaningful improvement in physical
pull efficiency with no loss of BOM ordering integrity. Worth preserving in the
real implementation. The `locationSortedProject()` DFS traversal pattern (sort
siblings, then emit in DFS pre-order) is the correct structure — a flat sort
cannot reproduce this.

### Filter composition via AND

Project filter and Competing-only toggle compose via AND, and the Global
Release scope inherits the composition. Implementation should preserve this
pattern and make the composition explicit in a single derived scope value
rather than applying filters in multiple places.

---

## 4. Patterns Specifically NOT to Carry Forward

### Synthesized projects 10412 and 10489

Projects 10412 ("Customer F Tailstock Retrofit", projectId 6) and 10489
("Customer G Photo Eye Package", projectId 7) are synthetic. They were created
to demonstrate cross-project competition density at a scale that would expose
the competing-candidates UX behavior. The real implementation uses actual
project records with database-assigned IDs.

Note also that projects 10121 (projectId 4) and 10030 (projectId 5) are
re-derived independently in `_data.ts`. They share project numbers with the
Project Creation mockup's seeded data but are separate in-memory objects —
there is no cross-mockup data sharing. The real implementation reads from the
same database.

### Manual stock seeding for demo scenarios

Two stock overrides are applied in `_data.ts` via `STOCK_OVERRIDES`:

```typescript
const STOCK_OVERRIDES: Record<number, number> = {
  1942: 1, // Tailstock Brake Assembly — competes across 10121 and 10412
  1949: 1, // Photo Eye Cable Assembly — competes across 10030 and 10489
};
```

Part 1942 (Tailstock Brake Assembly) has stock forced to 1 so that two
projects each wanting 1 unit produces the cascade + auto-pass scenario. Part
1949 (Photo Eye Cable Assembly) has stock forced to 1 to demonstrate
sub-assembly-level auto-pass-through. The real implementation reflects actual
stock counts from Parts Master.

### WO generation at module init via BOM walk

`buildSfWOs()` and `buildProjectWOs()` walk BOM trees at module init to
generate the WO records for all four Active Projects. The real implementation
generates WOs at Project compile time (in the Project Creation workflow);
Stock Fulfillment reads existing WO records from the database.

### Module-level session state

All state is in-memory via React `useState`. Stock counts, WO statuses, and
audit log reset on hard page reload. The real implementation persists to
the database via Prisma transactions.

### Mock current user (Admin)

```typescript
const MOCK_USER = { id: 1, name: "Admin" };
```

All actions are attributed to a hardcoded Admin user. The real implementation
uses authenticated user context. Per the spec's permissions table, Fulfill,
Pass Through, and Reconcile Stock are Manager+/Admin only — this gating is not
in the mockup. Auth and permissions arrive Rev 1.5+.

### `_auditIdCounter` module-level mutable

The mockup uses a module-level counter for audit entry IDs that persists
across renders. The real implementation uses database-assigned IDs.

---

## 5. The Color Discipline (and why it needs structural enforcement)

During the Stock Fulfillment mockup build, the established color discipline —
"project color belongs to the pill, nowhere else" — was violated **twice**:

1. The initial candidate table rows were given `style={{ backgroundColor: colorMeta.tintRgba }}` from the project's color
2. The Project Header cards were built with the project color as the card background

Both violations were caught during reviewer pass and reverted. The commit
message for the fix is `7509097`; the specific revert is:

```typescript
// BEFORE (wrong):
style={{ backgroundColor: colorMeta.tintRgba }}
// AFTER (correct): removed. Project color renders only in ProjectIdPill.
```

**The pattern is:** without structural enforcement, color leakage recurs as
new surfaces are built and scaffolded from existing code. The pill-only rule
is implicit, not enforced.

**The implementation track should:**

- Centralize project color application through `ProjectIdPill`. No other
  component should reference `PROJECT_COLOR_MAP` directly for background
  or border coloring.
- Treat any use of `PROJECT_COLOR_MAP` or equivalent palette lookups outside
  of `ProjectIdPill` as a code-smell during review. Add a comment to
  `PROJECT_COLOR_MAP` noting this restriction.
- Consider a lint rule or test that flags inline `style={{ backgroundColor }}`
  or Tailwind color classes referencing project-color values outside the pill
  component.
- Audit every new surface for color-discipline compliance before merging.

**Why the discipline matters:**

Project color is a high-signal visual identifier — concentrated in the pill,
it's a reliable at-a-glance Project differentiator. Diluted across row
backgrounds, card fills, and ring colors, it becomes noise and conflicts with
the tool's intentional palette reservation: status-green (active/pass),
status-amber (warning/competing), status-red (error/fail) are load-bearing
visual signals. Color discipline preserves those signals by keeping the
project-color palette strictly segregated to the pill.

---

## 6. Known Limitations of the Mockup

- **Module state resets on hard reload.** Stock counts, decisions, and audit
  entries are lost. The implementation persists to the database.

- **Defensive descendant-then-ancestor action-time check is not exercise-tested
  by Playwright.** The pre-filter prevents the action-time condition from being
  reachable in normal play through the mockup (a descendant completing removes
  the ancestor from the candidate list before the user can try to fulfill it).
  The check exists in `fulfillWo()` in `_data.ts` and is correct, but it was
  not covered by the Playwright verification suite. The real implementation
  should add unit test coverage for this path.

- **Header filter and toolbar dropdown are not synced.** Clicking a Project
  Header card sets `filterProjectId` directly; the "All Projects" dropdown
  does not update. Clicking the header again clears the filter and the dropdown
  returns to "All Projects" automatically. The real implementation should use
  a single filter state source.

- **Stale-state capture in `handleFulfill`.** The handler reads `wo` and
  `state` from the closure at call time. `handlePassThrough` uses functional
  `setState` to avoid this. `handleFulfill` and `handleReconcileConfirm` use
  derived values from the pre-action state, which is acceptable for those
  handlers since they don't chain state updates. The real implementation uses
  server actions, so this pattern is moot.

- **Real audit logging.** The mockup logs to in-memory state. The
  implementation writes to the AuditLog table in the same Prisma transaction
  as the state change.

- **Real database transactions.** The mockup uses functional `setState` to
  produce new state objects. The implementation wraps all multi-write operations
  in `prisma.$transaction()`.

- **Permissions gating.** See section 4.

---

## 7. Pointers to Other Deferred Work

`DEFERRED.md` contains an entry for the **Persistent Issue-Resolution Helper**
raised during Project Creation mockup iteration.

The Stock Fulfillment View does not currently share the exact shape of the
three surfaces the helper targets (Compile Failure Screen, Definition Change
Flag inspection, Deactivation Blocker resolution). However, the inline
expansion panel is structurally similar — it presents a bounded list of
competing WOs that each may require a cross-project judgment call. If the
helper's "pinnable overlay with detach-to-window" design were generalized,
the expansion panel context might benefit from it.

Not part of this surface's Rev 1 work. Noted for future consideration.

---

## 8. Shared Components Used

**`ProjectIdPill`** — imported from
`app/mockups/project-creation/_components/project-id-pill.tsx`. This
component is cross-surface and should be moved to `components/ui/` or
`components/project/` in the real implementation. Do not nest it inside
the project-creation surface directory. The prior handoff
(`mockup_track/project_creation_handoff.md`, section 2.2) documents the
component's full API and color map.

**`ReconcileStockModal`** — lives at `app/mockups/_shared/reconcile-stock-modal.tsx`.
This is an explicit shared asset. The modal is deliberately stateless — it
does not touch any data store; the caller records the change. The prop
contract:

```typescript
type Props = {
  partNumber: string;
  partName: string;
  currentStockCount: number;
  onClose: () => void;
  onConfirm: (newStockCount: number, reason: string) => void;
};
```

The implementation track should maintain this as a shared React component
referenced from Parts Master, Stock Fulfillment, Distribution Lens, and any
future surface that needs stock adjustment without a context switch. The spec
already calls for it to be a shared component; this confirms the prop API.

---

## 9. File Inventory

### `app/mockups/stock-fulfillment/`

| File | Purpose |
|------|---------|
| `_data.ts` | All mock data and business logic: `SfProject`, `SfWorkOrder`, `SfAuditEntry`, `SfState` types; `SF_PROJECTS` (4 seeded projects including 2 synthetic); `STOCK_OVERRIDES` (parts 1942 and 1949 seeded to 1); `buildSfWOs()` / `buildProjectWOs()` for BOM-walk WO generation at module init; `computeCandidates()` (candidacy filter + `locationSortedProject()` DFS sort); `computeProjectStats()` (derives `candidateCount`, `pendingReleaseCount`, `unreleasedCount` per project); `getDescendantWoIds()`, `getCompetingCandidates()`, `getAncestryChain()` helpers; `fulfillWo()`, `passThrough()`, `reconcileStock()`, `releaseProject()`, `releaseAll()` action functions |
| `page.tsx` | The entire Stock Fulfillment View: toolbar (Project filter, Competing-only toggle, Global Release button), Project Header strip, candidate table with inline expansion, Reconcile Stock modal wiring. Single-file component — the surface is not split into sub-components. |

### `app/mockups/_shared/`

| File | Purpose |
|------|---------|
| `reconcile-stock-modal.tsx` | Shared Reconcile Stock modal — stateless, caller-owned data updates. Used by Stock Fulfillment and Parts Master. Validates new count (non-negative integer) and reason (required). |
