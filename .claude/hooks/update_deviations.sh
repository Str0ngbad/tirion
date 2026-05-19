#!/bin/bash
# update_deviations.sh — appends a stub entry to DEVIATIONS.md when the
# most recent commit contains Deviates-From and Deviation-Summary footers.
# Invoked by the PostToolUse hook after every git commit.
# Exits silently with 0 if neither footer is present (most commits).

set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
DEVIATIONS="$REPO_ROOT/DEVIATIONS.md"
DEBUG_LOG="$REPO_ROOT/.claude/reviews/hook-debug.log"

COMMIT_HASH=$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")
COMMIT_FULL=$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo "unknown")
COMMIT_DATE=$(git -C "$REPO_ROOT" log -1 --format=%ad --date=short 2>/dev/null || echo "unknown")
COMMIT_BODY=$(git -C "$REPO_ROOT" log -1 --format=%B 2>/dev/null || echo "")

# Extract footer values — anchored to line start, case-sensitive
DEVIATES_FROM=$(echo "$COMMIT_BODY" | grep '^Deviates-From:' \
  | sed 's/^Deviates-From:[[:space:]]*//' | head -1)
DEVIATION_SUMMARY=$(echo "$COMMIT_BODY" | grep '^Deviation-Summary:' \
  | sed 's/^Deviation-Summary:[[:space:]]*//' | head -1)

# Both footers must be present; otherwise not a deviation commit
if [ -z "$DEVIATES_FROM" ] || [ -z "$DEVIATION_SUMMARY" ]; then
  exit 0
fi

# Look up current in-progress phase from project_tracker.md
PHASE="_To be filled in._"
if [ -f "$REPO_ROOT/project_tracker.md" ]; then
  PHASE_LINE=$(grep -B1 '^\*\*Status:\*\* In Progress' "$REPO_ROOT/project_tracker.md" 2>/dev/null \
    | grep '^## Phase' | head -1 | sed 's/^## //')
  [ -n "$PHASE_LINE" ] && PHASE="$PHASE_LINE"
fi

# Append stub — never overwrite
cat >> "$DEVIATIONS" <<STUB

## ${COMMIT_DATE} — ${DEVIATION_SUMMARY}

**Phase:** ${PHASE}
**Spec section:** ${DEVIATES_FROM}
**Discovered by:** _To be filled in._
**Status:** Captured (rationale TBD)
**Commit:** ${COMMIT_FULL}

### What was discovered

_To be filled in._

### Resolution

_To be filled in._

### Files affected

_To be filled in._

---
STUB

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deviations stub appended for ${COMMIT_HASH}" >> "$DEBUG_LOG"
echo "DEVIATIONS.md stub appended for ${COMMIT_HASH}." >&2
