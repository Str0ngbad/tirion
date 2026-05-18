#!/bin/bash
# Self-review hook — invoked by Claude Code post-commit.
# Spawns the code-reviewer sub-agent against the most recent commit
# and appends the review to .claude/reviews/log.md.

set -euo pipefail

# Ensure we're in a git repo
if [ ! -d ".git" ]; then
  echo "Not in a git repo root; skipping review." >&2
  exit 0
fi

# Get the most recent commit info for logging
COMMIT_HASH=$(git rev-parse --short HEAD)
COMMIT_SUBJECT=$(git log -1 --pretty=%s)

echo "Running self-review for commit ${COMMIT_HASH}: ${COMMIT_SUBJECT}" >&2

# Spawn the code-reviewer sub-agent.
# The sub-agent reads the diff itself via its own Bash tool access.
claude --agent code-reviewer --print "Review the most recent commit and append your review to .claude/reviews/log.md" >&2

echo "Self-review complete." >&2
