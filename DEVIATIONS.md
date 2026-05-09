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

When adding a deviation, copy this template and fill it in:

```markdown
## YYYY-MM-DD — Short Title

**Phase:** [which build phase]
**Spec section:** [which spec document and section]
**Discovered by:** [Claude Code / user / consultant]
**Status:** [Open | Resolved-Spec-Updated | Resolved-Accepted | Resolved-Reverted]

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

*(Empty — no deviations recorded yet.)*

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
