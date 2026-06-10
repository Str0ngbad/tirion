# Tirion — Deferred Features and Cross-Surface Patterns

Items in this file are **out of scope for Rev 1** but are explicitly held for
Rev 1.5+ or Rev 2. Each entry includes the problem statement, the surfaces
that share the pattern (where applicable), and any directional design thinking
captured at the time the deferral was recorded.

Entries are ordered most recent first.

---

## Persistent Issue-Resolution Helper

**Held for:** Rev 1.5+
**Raised:** 2026-06-10, Project Creation View iteration pass
**Surfaces sharing this pattern:**
- Compile Failure Screen (Project Creation) — N validation failures, each
  requiring navigation to Part Form / BOM Editor / Routing Template Editor
  to fix upstream data
- Definition Change Flag inspection — a Part is updated, it is used in N
  Assemblies; the user needs to inspect each downstream Assembly to decide
  whether to acknowledge the change
- Deactivation blocker resolution — a Vendor / MaterialSpec / Part cannot be
  deactivated while N references exist; user needs to chase each reference

**The problem:**
Across all three surfaces, the user encounters a list of upstream issues they
need to resolve one-by-one. In Rev 1, resolving any single issue requires
navigating away from the issue list — which means losing context. The workaround
is "keep notes." This is acceptable for Rev 1 ship but produces real friction
in day-to-day shop use.

The same shape appears in all three places: a bounded list of fixable issues,
each linking to a different location in the app. The user needs to work through
the list without losing track of their position.

**Directional design lean (not a decision):**
- **Persistent overlay** — pinnable, draggable, non-blocking. The issue list
  stays visible as the user navigates to the resolution location, makes the
  fix, and returns to check off the item.
- **Detach to full window** — for heavier resolution work, the overlay can
  be promoted to a browser window (`window.open`) so the user can work
  side-by-side: issue list in one window, resolution work in the other.

**Design starting point for Rev 1.5+:**
Derive the common shape across all three surfaces before building anything.
"What is the minimum interaction model that serves all three?" is the question —
not "how do we implement the overlay?" The three surfaces have slightly different
list semantics (validation failures vs. change-impact acknowledgments vs.
deactivation blockers), so the abstraction needs to be broad enough to cover all
of them without forcing artificial uniformity.

**Rev 1 status:** Each surface handles the issue list inline, with deep links
to resolution locations. Users navigate away, fix the issue, navigate back, and
re-run validation or re-check the list. Notes are the workaround. This is
suboptimal but not a blocker.

---
