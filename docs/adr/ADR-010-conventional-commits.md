# ADR-010: Conventional Commits for Commit History

**Status:** Accepted
**Date:** 2026-05-19
**Phase:** 0a

## Context

Tirion is built solo with AI coding assistance (Claude Code). Commit history
is the primary record of what changed and why. Without a consistent format,
history becomes a mix of tool-generated messages, free-form descriptions, and
fragments that are difficult to scan when debugging a regression or auditing
what was built in a given session. The four-hook automation system (Phase 0a)
also relies on commit messages to classify changes; a consistent format makes
that easier.

## Decision

Conventional Commits format for all commits. The type prefix is required:

- `feat:` — new user-visible behavior
- `fix:` — bug correction
- `chore:` — maintenance, dependency updates, configuration
- `refactor:` — restructuring without behavior change
- `test:` — test additions or changes
- `docs:` — documentation only

Scope is optional and used when it adds clarity (e.g., `feat(work-orders): add cancel endpoint`).
Commit messages are enforced by developer discipline and the commit-routing
rule (ADR-012), not by automated tooling in Rev 1.

## Consequences

**Positive:**

- History is scannable by type prefix. Identifying all `fix:` commits, or all
  `feat:` commits in a phase, is a grep away.
- The format is a recognized standard in the industry. It is familiar to
  engineering reviewers and does not require explanation.
- Tooling to generate changelogs or release notes from Conventional Commits
  exists if it becomes useful later. The history is structured for that
  possibility without requiring it now.
- AI-assisted commits (via Claude Code) produce consistent messages when the
  convention is stated explicitly. Consistency is higher than with free-form
  messages.

**Negative:**

- Requires discipline on every commit. The developer must consciously choose a
  type and write a message that fits the format. On a fast-moving build day
  with many small commits, this is a minor friction cost.
- No automated enforcement in Rev 1 (no `commitlint` hook). A non-compliant
  message can be committed without rejection. The convention is only as strong
  as the discipline applied.
- The format is slightly more verbose than a single descriptive phrase. The
  added structure costs a few keystrokes.

## Alternatives considered

- **Free-form commit messages:** No structure constraint. History becomes
  heterogeneous in style and density; harder to scan and harder for automated
  tools to parse. Not appropriate for a project where the commit history is
  also a learning artifact.
- **`commitlint` with automated enforcement:** Rejects non-compliant messages
  at commit time. Stronger guarantee than discipline alone. Deferred to avoid
  tooling setup overhead in Phase 0a; can be added later if the discipline
  approach proves insufficient.
- **Angular commit format:** More prescriptive than Conventional Commits —
  requires body and footer sections, has stricter scope rules. The additional
  structure is overhead without clear benefit at this project scale.
