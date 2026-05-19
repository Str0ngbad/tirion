#!/bin/bash
# Single PostToolUse dispatcher. Reads stdin once, then invokes each hook
# sub-script if the triggering command was a git commit.
#
# This exists because multiple PostToolUse hook entries in settings.json
# each call STDIN=$(cat), and only the first one gets the actual payload.
# Subsequent hooks see empty stdin and never fire their sub-scripts.

set -uo pipefail

STDIN=$(cat)
COMMAND=$(echo "$STDIN" | jq -r '.tool_input.command' 2>&1)

if echo "$COMMAND" | grep -q 'git commit'; then
  # Hooks run sequentially. Each gets explicit empty stdin to prevent
  # any accidental consumption from leaking between them.
  bash .claude/hooks/run_review.sh < /dev/null
  bash .claude/hooks/update_manifest.sh < /dev/null
  bash .claude/hooks/update_tracker.sh < /dev/null
  bash .claude/hooks/update_deviations.sh < /dev/null
fi
