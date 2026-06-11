#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bash ./scripts/create-worktree.sh <task-name> [branch-name]

Creates .worktrees/<task-name>, runs pnpm install, initializes a worktree-local
CodeGraph index, and prints the exact projectPath to use for CodeGraph MCP calls.

Arguments:
  task-name    Directory name under .worktrees/. Allowed: letters, numbers, ., _, -
  branch-name  Optional branch name. Defaults to codex/<task-name>.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

task_name="${1:-}"
branch_name="${2:-}"

if [[ -z "$task_name" ]]; then
  usage >&2
  exit 2
fi

if [[ ! "$task_name" =~ ^[A-Za-z0-9._-]+$ ]]; then
  printf 'Invalid task name: %s\n' "$task_name" >&2
  printf 'Use only letters, numbers, dot, underscore, and hyphen.\n' >&2
  exit 2
fi

if [[ -z "$branch_name" ]]; then
  branch_name="codex/$task_name"
fi

if [[ "$branch_name" == -* ]]; then
  printf 'Invalid branch name: %s\n' "$branch_name" >&2
  printf 'Branch names must not start with a dash.\n' >&2
  exit 2
fi

script_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(git -C "$script_root" rev-parse --show-toplevel)"
worktree_path="$repo_root/.worktrees/$task_name"

git_dir="$(cd "$(git -C "$repo_root" rev-parse --git-dir)" && pwd -P)"
git_common_dir="$(git -C "$repo_root" rev-parse --git-common-dir)"
if [[ "$git_common_dir" != /* ]]; then
  git_common_dir="$repo_root/$git_common_dir"
fi
git_common_dir="$(cd "$git_common_dir" && pwd -P)"

if [[ "$git_dir" != "$git_common_dir" ]] && ! git -C "$repo_root" rev-parse --show-superproject-working-tree >/dev/null 2>&1; then
  printf 'Already inside a linked worktree: %s\n' "$repo_root" >&2
  printf 'Run this script from the main checkout, not from another worktree.\n' >&2
  exit 2
fi

if ! git -C "$repo_root" check-ignore -q .worktrees; then
  printf '.worktrees is not ignored by git. Refusing to create a project-local worktree.\n' >&2
  printf 'Add .worktrees to .gitignore first.\n' >&2
  exit 2
fi

if [[ -e "$worktree_path" ]]; then
  printf 'Worktree path already exists: %s\n' "$worktree_path" >&2
  exit 2
fi

command -v pnpm >/dev/null || {
  printf 'Missing required command: pnpm\n' >&2
  exit 127
}

command -v codegraph >/dev/null || {
  printf 'Missing required command: codegraph\n' >&2
  exit 127
}

run_quiet() {
  local tmp_log
  local status

  tmp_log="$(mktemp -t "create-worktree.XXXXXX")"
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

run_quiet git -C "$repo_root" worktree add "$worktree_path" -b "$branch_name"

cd "$worktree_path"

run_quiet pnpm install
run_quiet codegraph init -i "$worktree_path"

codegraph_status_log="$(mktemp -t "create-worktree-codegraph-status.XXXXXX")"
trap 'rm -f "$codegraph_status_log"' EXIT
if codegraph status "$worktree_path" >"$codegraph_status_log" 2>&1; then
  codegraph_status="$(cat "$codegraph_status_log")"
else
  status=$?
  cat "$codegraph_status_log"
  exit "$status"
fi

if [[ "$codegraph_status" == *"This CodeGraph index belongs to a different git working tree"* ]]; then
  printf '%s\n' "$codegraph_status" >&2
  printf 'CodeGraph is still pointing at a different git working tree: %s\n' "$worktree_path" >&2
  exit 1
fi

printf 'CodeGraph projectPath: %s\n' "$worktree_path"
