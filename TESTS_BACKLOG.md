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
