#!/bin/bash
# Self-review hook — invoked by Claude Code post-commit.
# Spawns the code-reviewer sub-agent against the most recent commit
# and appends the review to .claude/reviews/log.md.

set -euo pipefail

DEBUG_LOG=".claude/reviews/hook-debug.log"

# Ensure the debug log's parent dir exists (reviews/ is gitignored).
mkdir -p "$(dirname "$DEBUG_LOG")"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$DEBUG_LOG"
}

log "----- hook fired -----"

# Ensure we're in a git repo
if [ ! -d ".git" ]; then
  log "Not in a git repo root; skipping review."
  echo "Not in a git repo root; skipping review." >&2
  exit 0
fi

# Get the most recent commit info for logging
COMMIT_HASH=$(git rev-parse --short HEAD)
COMMIT_SUBJECT=$(git log -1 --pretty=%s)

log "commit: ${COMMIT_HASH} — ${COMMIT_SUBJECT}"
log "cwd: $(pwd)"
log "PATH: ${PATH}"
log "claude binary: $(command -v claude || echo 'NOT FOUND')"

echo "Running self-review for commit ${COMMIT_HASH}: ${COMMIT_SUBJECT}" >&2

CLAUDE_CMD=(claude --agent code-reviewer -p "Review the most recent commit and append your review to .claude/reviews/log.md per the format in your system prompt." --bare --allowedTools "Read,Grep,Glob,Bash")
log "about to run: ${CLAUDE_CMD[*]}"

# Disable errexit around the claude call so a non-zero exit still gets logged.
set +e
"${CLAUDE_CMD[@]}" >> "$DEBUG_LOG" 2>&1
CLAUDE_EXIT=$?
set -e

log "claude exit code: ${CLAUDE_EXIT}"
log "----- hook complete -----"

echo "Self-review complete." >&2
