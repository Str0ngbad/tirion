# ADR-012: All Commits Routed Through Claude Code

**Status:** Accepted
**Date:** 2026-05-19
**Phase:** 0a

## Context

The Phase 0a tooling system includes four hooks that fire on every `git commit`:
manifest regeneration, tracker regeneration, DEVIATIONS.md auto-update, and
self-review code review. These hooks are configured as `PostToolUse` hooks in
Claude Code's `.claude/settings.json`. They fire when Claude Code executes a
`git commit` command via its Bash tool.

Commits made directly in a terminal via `git commit` bypass Claude Code
entirely. The hooks never fire. The manifest and tracker fall out of date,
deviations go unlogged, and the self-review does not run.

## Decision

All commits during Rev 1 development must go through Claude Code's commit
workflow. The developer does not run `git commit` directly in a terminal.

If a direct git commit is unavoidable (e.g., during a Claude Code outage, or
to amend a commit that cannot go through the normal flow), the developer must
manually run the manifest and tracker regeneration scripts afterward, and note
in the commit message that the automated hooks did not fire.

## Consequences

**Positive:**

- All four hooks fire on every commit without exception. The manifest and
  tracker are always current after a commit. DEVIATIONS.md captures structured
  records of deviations automatically. Every commit receives a self-review.
- The discipline is self-reinforcing: because the manifest and tracker are
  always current, they are always useful. If they were allowed to fall out of
  date, they would stop being consulted, and the value would erode.
- No additional tooling is required to enforce the hook system. Claude Code's
  hook mechanism handles it.

**Negative:**

- The developer cannot commit without Claude Code available. A Claude Code
  outage, network issue, or service disruption blocks the commit workflow
  entirely. The recovery path is: commit directly via `git commit` in the
  terminal, then manually run `.claude/hooks/update_manifest.sh` and
  `.claude/hooks/update_tracker.sh` to bring the generated docs back into
  sync. Note in the commit message that automated hooks did not fire.
- The recovery procedure requires the developer to remember it exists. It is
  not enforced.
- This is a discipline rule, not a technical constraint. Nothing in git
  prevents a direct terminal commit. The rule is only as strong as the
  developer's adherence.
- The constraint does not extend beyond Rev 1. If future contributors join
  the project, they must be onboarded to this workflow explicitly.

## Alternatives considered

- **Husky pre-commit or post-commit hooks:** Fires on every `git commit`
  regardless of how it is invoked. Would solve the bypass problem. Adds a
  Node.js dependency and requires script equivalents of what the Claude Code
  hooks do. The self-review hook in particular (which spawns a Claude Code
  sub-agent) has no straightforward equivalent as a standalone shell script.
- **CI-based manifest and tracker regeneration:** Run the regeneration scripts
  in CI on every push. Provides eventual consistency (manifest is current after
  push, not after commit). The self-review feedback is delayed until CI
  completes. Useful as a backstop but not a substitute for per-commit
  discipline.
- **Accepting stale artifacts between sessions:** Do not enforce per-commit
  regeneration; regenerate at the start of each session instead. Lower
  discipline cost, but the manifest and tracker lose their value as real-time
  references during active development. Rejected because the per-commit hook
  system is the core of the Phase 0a tooling investment.
