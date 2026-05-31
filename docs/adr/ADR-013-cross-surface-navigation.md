# ADR-013: Cross-Surface Navigation via Layered Modals

**Status:** Accepted
**Date:** 2026-05-31
**Phase:** 0b

## Context

Tirion has multiple surfaces that users move between during operational
work: the Parts Master grid, the Part Form, the Routing Template Editor,
the BOM Editor, the various Lenses, the Project View, the Configuration
surfaces. Users frequently need to navigate from one surface to another
in the course of a single task. A buyer looking at a Part may need to
open its Routing Template to verify the process flow. A manager
reviewing a Routing Template may need to check which Parts use it.

Two architectural patterns are available for these cross-surface
navigations:

**Link navigation:** Each surface is its own page. Navigation between
surfaces is browser-level navigation that unmounts the prior surface
and mounts the new one.

**Layered modal navigation:** The originating surface stays mounted; the
target surface opens as an overlay on top. The user returns by closing
the overlay; the originating surface is exactly as they left it because
it never unmounted.

A third pattern exists for navigation that represents a true context
shift (entering an entirely different mode of work, e.g., switching from
configuration work to operations or to project creation). Full-page
navigation is appropriate for these mode-change transitions.

## Decision

Tirion uses a **mode-sensitive navigation policy**:

1. **Layered modal navigation** is the default for cross-surface
   navigation within the same operational mode. The originating
   surface stays mounted; the target surface opens as an overlay.
   Examples: Part Form → Routing Template Editor; Part Form → BOM
   Editor; Configuration surfaces → other Configuration surfaces.

2. **Full-page navigation** is used for navigation between operational
   modes. The originating surface unmounts; the target surface mounts
   as a new page. Examples: Operations Lens → Project Creation;
   Configuration → Operations; admin/settings → operational work.

Mode is defined here as a coherent user activity. Configuration work
(Parts library, Vendor list, MaterialSpec list, Routing Templates,
BOM relationships) is one mode. Operations work (Lenses, Project View,
WO state transitions) is another. Project Creation is its own mode.
Admin/settings is its own mode.

The distinction between cross-surface and cross-mode is judgment-based,
but the criterion is: does this navigation represent the user moving
to a *related context that supports their current task*, or moving to
a *fundamentally different activity*?

## Layered Modal Specifics

**Depth limit:** Maximum modal depth is 2. The originating surface
(depth 0) plus one overlay (depth 1) plus one further overlay (depth
2). No surfaces in Rev 1 introduce a third layer.

**When a depth-3 case appears:** Don't pre-architect. The first real
depth-3 case that surfaces during build or mockup work triggers a
deliberate architectural decision (likely via an ADR amendment or a
new ADR). Options to consider at that point include:
- Replacing the top layer with the new surface (most natural for
  "side trip" cases)
- Closing intermediate layers (collapsing the stack)
- Disallowing the navigation (surface a "close current first" prompt)
- Allowing depth 3 only for specific surface combinations

Watch for depth-3 cases proactively rather than reactively. Document
them when they appear.

**State preservation:** Because the originating surface stays mounted,
its state (selected View, ad-hoc filter/sort/column changes, partial
form edits, scroll position) is preserved automatically by virtue of
React not unmounting the component. No explicit state persistence
layer is required for this case.

**Browser back-button behavior:** With layered modals, the back button
closes the top modal layer. When no modals are open, back navigates
in browser history normally. This matches user expectations and
preserves bookmarkability of the underlying surface.

**Focus management:** Each new modal layer takes focus when opened.
Escape key closes the top modal. Focus returns to the trigger element
in the originating surface when a modal closes.

## Consequences

**Positive:**

- State preservation across cross-surface navigation is structural
  rather than requiring explicit persistence infrastructure
- The user's working context (the Part they're operating on, the
  routing template they're configuring) is preserved transparently
  during side trips to related surfaces
- Cross-surface navigation feels lighter and faster than full-page
  navigation for related-context cases
- Mode changes still get the deliberate full-page treatment that
  signals a context shift

**Negative:**

- Modal overlay management adds complexity (focus traps, escape key
  handling, z-index management, layered backdrop styling)
- The 2-layer depth limit constrains workflows that might want deeper
  navigation. The "watch for depth-3 cases" approach defers this cost
- Mobile/narrow-viewport rendering of layered modals requires
  deliberate design (later layers occlude earlier layers on small
  screens). Acceptable trade-off since manufacturing-shop use is
  primarily desktop
- The judgment-based distinction between cross-surface and cross-mode
  may require occasional refinement as new surfaces are designed

**Neutral:**

- Browser bookmarking and deep linking work for the originating
  surface but not for the modal state. Acceptable; deep links to
  modals are not a user need for Tirion's operational contexts

## Implementation Notes

These notes are not architectural commitments — they're starting points
for implementation work. Adjust based on what works in practice.

- shadcn's Dialog component is the foundation for modal layers
- Modal stack management can live in a top-level context provider or
  custom hook (`useModalStack` or similar)
- Each surface that opens layered modals declares which surfaces it
  can open as overlays via component composition (the surface owns
  the modal trigger; the modal's content is the target surface's
  component)
- The Part Form is the first surface to use this pattern (opening
  Routing Template Editor as an overlay)
- Backlog item: define the modal stack pattern as a reusable
  component or context before the first non-trivial use

## Alternatives Considered

**Link navigation with state persistence infrastructure.** Building a
localStorage-or-server-side mechanism that persists per-surface state
across navigation events. Discarded because state preservation becomes
structural with layered modals, eliminating the need for the
persistence layer. The total work is lower with layered modals.

**Layered modals without depth limit.** Allowing arbitrary nesting.
Discarded because deep modal stacks produce poor UX (visual clutter,
unclear what's underneath, confusing escape key behavior). The depth
limit with watch-for-depth-3 policy avoids over-architecting while
preserving the option to revisit.

**Full-page navigation everywhere.** Treating all cross-surface moves
as page navigations. Discarded because the user's working context
(which Part they're operating on, etc.) would be lost on every
cross-surface action, requiring constant re-establishment. This was
the implicit Rev 1 baseline before the mockup track surfaced the
context-loss cost.

## References

- Spec corpus: configuration_management_spec.md, parts_master_spec.md,
  routing_template_editor_spec.md — all describe surfaces that this
  navigation pattern applies to
- Mockup track exploration: 2026-05-31 Part Form session (the
  trigger for this architectural decision)
- ADR-001: Tech stack (shadcn Dialog as the modal foundation)
