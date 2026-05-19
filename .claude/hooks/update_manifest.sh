#!/bin/bash
# update_manifest.sh — regenerates project_manifest.md at the repo root.
# Invoked by the PostToolUse hook after every git commit.

set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
OUT="$REPO_ROOT/project_manifest.md"

# Header metadata
COMMIT_HASH=$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")
TIMESTAMP=$(git -C "$REPO_ROOT" log -1 --format="%aI" HEAD 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Describe a TypeScript/TSX file in one line by inspecting its exports.
describe_ts() {
  local file="$1"
  local rel="${file#$REPO_ROOT/}"

  # Collect route handlers (files under app/api/)
  local handlers
  handlers=$(grep -oE 'export async function (GET|POST|PUT|PATCH|DELETE)' "$file" 2>/dev/null \
    | awk '{print $4}' | sort -u | tr '\n' ',' | sed 's/,$//')

  # Collect named exports (functions and consts)
  local named
  named=$(grep -oE 'export (async )?function [A-Za-z_][A-Za-z0-9_]*|export const [A-Za-z_][A-Za-z0-9_]*' "$file" 2>/dev/null \
    | awk '{print $NF}' | sort -u | tr '\n' ',' | sed 's/,$//')

  local has_default
  has_default=$(grep -c 'export default' "$file" 2>/dev/null || true)

  # Build description
  local desc=""
  if [ -n "$handlers" ]; then
    # Route handlers take over the whole description — they are the exports
    desc="route handlers: $handlers"
  else
    if [ -n "$named" ]; then
      desc="exports: $named"
    fi
    if [ "$has_default" -gt 0 ]; then
      if [ -n "$desc" ]; then
        desc="$desc; default export"
      else
        desc="default export"
      fi
    fi
  fi

  if [ -n "$desc" ]; then
    echo "$rel — $desc"
  else
    echo "$rel"
  fi
}

# Describe a spec markdown file: filename + first H1 heading.
describe_spec() {
  local file="$1"
  local rel="${file#$REPO_ROOT/}"
  local heading
  heading=$(grep -m1 '^# ' "$file" 2>/dev/null | sed 's/^# //' || echo "(no heading)")
  echo "$rel — $heading"
}

# ---------------------------------------------------------------------------
# Build manifest
# ---------------------------------------------------------------------------

{
  cat <<HEADER
# project_manifest.md

> Auto-generated. Do not edit by hand.
> Regenerated on every commit by \`.claude/hooks/update_manifest.sh\`
>
> Commit: \`${COMMIT_HASH}\`  |  Generated: \`${TIMESTAMP}\`

---

HEADER

  # ---- app/ ----------------------------------------------------------------
  echo "## app/"
  echo ""
  while IFS= read -r -d '' f; do
    rel="${f#$REPO_ROOT/}"
    case "$f" in
      *.ts|*.tsx) echo "- $(describe_ts "$f")" ;;
      *.css)      echo "- $rel — global stylesheet" ;;
      *)          echo "- $rel" ;;
    esac
  done < <(find "$REPO_ROOT/app" -type f \
    ! -name "*.ico" \
    ! -path "*/.next/*" \
    ! -path "*/node_modules/*" \
    -print0 2>/dev/null | sort -z)
  echo ""

  # ---- lib/ ----------------------------------------------------------------
  echo "## lib/"
  echo ""
  while IFS= read -r -d '' f; do
    rel="${f#$REPO_ROOT/}"
    case "$f" in
      *.ts|*.tsx) echo "- $(describe_ts "$f")" ;;
      *)          echo "- $rel" ;;
    esac
  done < <(find "$REPO_ROOT/lib" -type f ! -path "*/node_modules/*" -print0 2>/dev/null | sort -z)
  echo ""

  # ---- components/ ---------------------------------------------------------
  if [ -d "$REPO_ROOT/components" ]; then
    echo "## components/"
    echo ""
    while IFS= read -r -d '' f; do
      rel="${f#$REPO_ROOT/}"
      case "$f" in
        *.ts|*.tsx) echo "- $(describe_ts "$f")" ;;
        *)          echo "- $rel" ;;
      esac
    done < <(find "$REPO_ROOT/components" -type f ! -path "*/node_modules/*" -print0 2>/dev/null | sort -z)
    echo ""
  fi

  # ---- tests/ --------------------------------------------------------------
  if [ -d "$REPO_ROOT/tests" ]; then
    echo "## tests/"
    echo ""
    while IFS= read -r -d '' f; do
      rel="${f#$REPO_ROOT/}"
      case "$f" in
        *.ts|*.tsx) echo "- $(describe_ts "$f")" ;;
        *)          echo "- $rel" ;;
      esac
    done < <(find "$REPO_ROOT/tests" -type f ! -path "*/node_modules/*" -print0 2>/dev/null | sort -z)
    echo ""
  fi

  # ---- prisma/ -------------------------------------------------------------
  echo "## prisma/"
  echo ""
  if [ -f "$REPO_ROOT/prisma/schema.prisma" ]; then
    local_models=$(grep -c '^model ' "$REPO_ROOT/prisma/schema.prisma" 2>/dev/null || echo 0)
    local_enums=$(grep -c '^enum ' "$REPO_ROOT/prisma/schema.prisma" 2>/dev/null || echo 0)
    echo "- prisma/schema.prisma — Prisma schema: ${local_models} model(s), ${local_enums} enum(s)"
  fi
  while IFS= read -r -d '' f; do
    rel="${f#$REPO_ROOT/}"
    case "$f" in
      */schema.prisma) ;;  # already listed above
      *.sql) echo "- $rel — migration SQL" ;;
      *.ts)  echo "- $(describe_ts "$f")" ;;
      *)     echo "- $rel" ;;
    esac
  done < <(find "$REPO_ROOT/prisma" -type f -print0 2>/dev/null | sort -z)
  echo ""

  # ---- spec/ ---------------------------------------------------------------
  echo "## spec/"
  echo ""
  while IFS= read -r -d '' f; do
    echo "- $(describe_spec "$f")"
  done < <(find "$REPO_ROOT/spec" -type f -name "*.md" -print0 2>/dev/null | sort -z)
  echo ""

  # ---- .claude/hooks/ ------------------------------------------------------
  echo "## .claude/hooks/"
  echo ""
  while IFS= read -r -d '' f; do
    rel="${f#$REPO_ROOT/}"
    echo "- $rel"
  done < <(find "$REPO_ROOT/.claude/hooks" -type f -print0 2>/dev/null | sort -z)
  echo ""

  # ---- Top-level config files ----------------------------------------------
  echo "## config (root)"
  echo ""
  for f in \
    "$REPO_ROOT/next.config.ts" \
    "$REPO_ROOT/tsconfig.json" \
    "$REPO_ROOT/postcss.config.mjs" \
    "$REPO_ROOT/eslint.config.mjs" \
    "$REPO_ROOT/vitest.config.ts" \
    "$REPO_ROOT/package.json" \
    "$REPO_ROOT/prisma.config.ts" \
    "$REPO_ROOT/.env.example" \
    "$REPO_ROOT/.gitignore" \
    "$REPO_ROOT/.gitattributes"
  do
    [ -f "$f" ] && echo "- ${f#$REPO_ROOT/}"
  done
  echo ""

} > "$OUT"

echo "project_manifest.md updated (commit ${COMMIT_HASH})." >&2
