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
