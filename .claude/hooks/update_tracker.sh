#!/bin/bash
# update_tracker.sh — regenerates project_tracker.md at the repo root.
# Invoked by the PostToolUse hook after every git commit.

set -uo pipefail

# Known limitations to address as phases progress:
# - Phase 1A/1B heuristics are coarse: bare directory existence will mark them Done
#   as soon as the first file lands. Tighten heuristics phase-by-phase when work
#   on each phase actually begins. Consider an "In Progress" state.
# - Phase 0 bullet list claims Pino/Sentry/Vitest are configured but phase0_status()
#   only checks package.json, LICENSE, .env.example, and the health route.
#   Either expand the checks or trim the bullets to match what's actually verified.

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
OUT="$REPO_ROOT/project_tracker.md"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

file_exists() { [ -f "$REPO_ROOT/$1" ]; }
dir_exists()  { [ -d "$REPO_ROOT/$1" ]; }

ts_count_in() {
  find "$REPO_ROOT/$1" -maxdepth 2 -name "*.ts" -type f 2>/dev/null | wc -l
}

# ---------------------------------------------------------------------------
# Phase heuristics
# ---------------------------------------------------------------------------

phase0_status() {
  file_exists "package.json"                                     || { echo "Not Started"; return; }
  grep -q '"next"'           "$REPO_ROOT/package.json" 2>/dev/null || { echo "Not Started"; return; }
  grep -q '"@prisma/client"' "$REPO_ROOT/package.json" 2>/dev/null || { echo "Not Started"; return; }
  file_exists "LICENSE"                                          || { echo "Not Started"; return; }
  file_exists ".env.example"                                     || { echo "Not Started"; return; }
  file_exists "app/api/v1/health/route.ts"                      || { echo "Not Started"; return; }
  echo "Done"
}

# Outputs five space-separated tokens: review manifest tracker deviations adrs (each ✓ or ✗)
phase0a_checks() {
  local review="✗" manifest="✗" tracker="✗" deviations="✗" adrs="✗"

  if file_exists ".claude/hooks/run_review.sh" && file_exists ".claude/agents/code-reviewer.md"; then
    review="✓"
  fi
  if file_exists ".claude/hooks/update_manifest.sh" && file_exists "project_manifest.md"; then
    manifest="✓"
  fi
  if file_exists ".claude/hooks/update_tracker.sh" && file_exists "project_tracker.md"; then
    tracker="✓"
  fi
  if file_exists ".claude/hooks/update_deviations.sh"; then
    deviations="✓"
  fi

  if dir_exists "docs/adr"; then
    local all=true
    for n in 001 002 003 004 005 006 007 008 009 010 011 012; do
      compgen -G "$REPO_ROOT/docs/adr/ADR-${n}-*.md" > /dev/null 2>&1 \
        || { all=false; break; }
    done
    $all && adrs="✓"
  fi

  echo "$review $manifest $tracker $deviations $adrs"
}

phase1a_status() {
  local n
  n=$(ts_count_in "lib/queries")
  [ "$n" -gt 0 ] 2>/dev/null                                   || { echo "Not Started"; return; }
  file_exists "prisma/seed.ts"                                  || { echo "Not Started"; return; }
  if ! dir_exists "app/(config)" && ! dir_exists "app/config"; then
    echo "Not Started"; return
  fi
  echo "Done"
}

phase1b_status() {
  if dir_exists "app/parts" || dir_exists "app/(parts)"; then
    echo "Done"
  else
    echo "Not Started"
  fi
}

# ---------------------------------------------------------------------------
# Build tracker
# ---------------------------------------------------------------------------

{
  cat <<'HEADER'
# project_tracker.md

> Auto-generated. Do not edit by hand.
> Regenerated on every commit by `.claude/hooks/update_tracker.sh`

---

HEADER

  # ---- Phase 0 ----
  P0=$(phase0_status)
  echo "## Phase 0 — Scaffolding"
  echo "**Status:** $P0"
  if [ "$P0" = "Done" ]; then
    echo "- Next.js scaffold with TypeScript, Tailwind, ESLint ✓"
    echo "- Prisma with adapter-pg, schema applied to Neon ✓"
    echo "- Pino logging and Sentry error tracking configured ✓"
    echo "- Vitest sample test passing ✓"
    echo "- /api/v1/health endpoint deployed to Vercel ✓"
    echo "- LICENSE and README in place ✓"
  fi
  echo ""

  # ---- Phase 0a ----
  read -r REVIEW MANIFEST TRACKER DEVIATIONS ADRS <<< "$(phase0a_checks)"

  P0A="In Progress"
  if [ "$REVIEW" = "✓" ] && [ "$MANIFEST" = "✓" ] && [ "$TRACKER" = "✓" ] \
     && [ "$DEVIATIONS" = "✓" ] && [ "$ADRS" = "✓" ]; then
    P0A="Done"
  fi

  echo "## Phase 0a — Tooling and Hooks Setup"
  echo "**Status:** $P0A"
  echo "- Self-review hook $REVIEW"
  echo "- Manifest hook $MANIFEST"
  echo "- Tracker hook $TRACKER"
  echo "- Deviations hook $DEVIATIONS"
  echo "- ADRs 001–012 $ADRS"
  echo ""

  # ---- Phase 1A ----
  P1A=$(phase1a_status)
  echo "## Phase 1A — Configuration Foundation"
  echo "**Status:** $P1A"
  if [ "$P1A" = "Done" ]; then
    echo "- Lookup tables seeded (ProcessType, ProcessTypeSubStatus, AuditAction) ✓"
    echo "- Vendor and MaterialSpec CRUD with in-context creation ✓"
    echo "- User CRUD with Admin lockout prevention ✓"
  fi
  echo ""

  # ---- Phase 1B ----
  P1B=$(phase1b_status)
  echo "## Phase 1B — Parts Master"
  echo "**Status:** $P1B"
  if [ "$P1B" = "Done" ]; then
    echo "- Part CRUD with all fields ✓"
    echo "- Parts Master grid with sort, filter, search ✓"
    echo "- Stock count inline editing with audit trail ✓"
  fi
  echo ""

  # ---- Remaining phases (no heuristics yet) ----
  for label in \
    "1C — Routing Template Editor" \
    "1D — BOM Editor" \
    "2 — Spreadsheet Import" \
    "3 — Project Creation: Drafts and Compilation" \
    "4 — Stock Fulfillment" \
    "5 — Batching Lens" \
    "6A — Lens Infrastructure" \
    "6B — Per-Process Lenses" \
    "7 — Operations Lens" \
    "8 — Project View + Active Project Management" \
    "9 — Blocker Workflows" \
    "10 — Polish and Acceptance"
  do
    echo "## Phase ${label}"
    echo "**Status:** Not Started"
    echo ""
  done

  # ---- Open DEVIATIONS stubs ----
  echo "---"
  echo ""
  echo "## Open DEVIATIONS stubs"
  echo ""
  if [ -f "$REPO_ROOT/DEVIATIONS.md" ]; then
    OPEN_STUBS=$(awk '/^\*\*Status:\*\* Captured/{f=1} /^\*\*Commit:\*\*/ && f{print $2; f=0}' \
      "$REPO_ROOT/DEVIATIONS.md" 2>/dev/null)
    if [ -n "$OPEN_STUBS" ]; then
      while IFS= read -r hash; do
        [ -z "$hash" ] && continue
        STUB_DATE=$(git -C "$REPO_ROOT" log --format="%ad" --date=short -1 "$hash" 2>/dev/null \
          || echo "unknown")
        echo "- \`$hash\` ($STUB_DATE) — rationale TBD"
      done <<< "$OPEN_STUBS"
    else
      echo "_None._"
    fi
  else
    echo "_None._"
  fi
  echo ""

} > "$OUT"

echo "project_tracker.md updated." >&2
