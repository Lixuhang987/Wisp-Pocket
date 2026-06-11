#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

run_quiet() {
  local tmp_log
  local status

  tmp_log="$(mktemp -t "handagent-test.XXXXXX")"
  if "$@" >"$tmp_log" 2>&1; then
    rm -f "$tmp_log"
    return 0
  else
    status=$?
    cat "$tmp_log"
    rm -f "$tmp_log"
    return "$status"
  fi
}

run_quiet bash "$PROJECT_ROOT/scripts/swiftw.test.sh"
run_quiet bash "$PROJECT_ROOT/scripts/package-app.test.sh"
run_quiet bash "$PROJECT_ROOT/scripts/create-worktree.test.sh"
run_quiet bash "$PROJECT_ROOT/scripts/test.test.sh"

run_quiet pnpm test:theme-tokens
run_quiet pnpm --filter handagent-electron-shell test

run_quiet pnpm exec vitest run \
  --exclude ".worktrees/**" \
  apps/agent-server/tests \
  packages/core/tests

echo "success"
