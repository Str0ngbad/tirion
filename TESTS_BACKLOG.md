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

*(Empty — no deferred tests recorded yet.)*

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
