#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_TMP_DIR="$(mktemp -d -t create-worktree-test.XXXXXX)"
FAKE_BIN_DIR="$TEST_TMP_DIR/bin"
REPO_ROOT="$TEST_TMP_DIR/repo"
LOG_FILE="$TEST_TMP_DIR/calls.log"

cleanup() {
  rm -rf "$TEST_TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$FAKE_BIN_DIR" "$REPO_ROOT/.git" "$REPO_ROOT/scripts"
cp "$ROOT_DIR/scripts/create-worktree.sh" "$REPO_ROOT/scripts/create-worktree.sh"
chmod +x "$REPO_ROOT/scripts/create-worktree.sh"

cat >"$FAKE_BIN_DIR/git" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

repo_root="${HANDAGENT_CREATE_WORKTREE_TEST_REPO_ROOT:?}"
log_file="${HANDAGENT_CREATE_WORKTREE_TEST_LOG_FILE:?}"

if [[ "${1:-}" == "-C" ]]; then
  shift 2
fi

case "${1:-}" in
  rev-parse)
    case "${2:-}" in
      --show-toplevel)
        printf '%s\n' "$repo_root"
        ;;
      --git-dir)
        printf '%s\n' "$repo_root/.git"
        ;;
      --git-common-dir)
        printf '%s\n' "$repo_root/.git"
        ;;
      --show-superproject-working-tree)
        exit 1
        ;;
      *)
        printf 'unexpected git rev-parse args: %s\n' "$*" >&2
        exit 1
        ;;
    esac
    ;;
  check-ignore)
    if [[ "${2:-}" == "-q" && "${3:-}" == ".worktrees" ]]; then
      printf 'git check-ignore %s %s\n' "${2:-}" "${3:-}" >>"$log_file"
      exit 0
    fi
    printf 'unexpected git check-ignore args: %s\n' "$*" >&2
    exit 1
    ;;
  worktree)
    if [[ "${2:-}" == "add" && "${4:-}" == "-b" ]]; then
      printf 'git worktree add %s -b %s\n' "${3:-}" "${5:-}" >>"$log_file"
      printf 'git worktree stdout\n'
      printf 'git worktree stderr\n' >&2
      mkdir -p "${3:-}/scripts"
      exit 0
    fi
    printf 'unexpected git worktree args: %s\n' "$*" >&2
    exit 1
    ;;
  *)
    printf 'unexpected git args: %s\n' "$*" >&2
    exit 1
    ;;
esac
EOF
chmod +x "$FAKE_BIN_DIR/git"

cat >"$FAKE_BIN_DIR/pnpm" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'pnpm %s cwd=%s\n' "$*" "$PWD" >>"${HANDAGENT_CREATE_WORKTREE_TEST_LOG_FILE:?}"
printf 'pnpm stdout for %s\n' "$*"
printf 'pnpm stderr for %s\n' "$*" >&2
EOF
chmod +x "$FAKE_BIN_DIR/pnpm"

cat >"$FAKE_BIN_DIR/codegraph" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'codegraph %s cwd=%s\n' "$*" "$PWD" >>"${HANDAGENT_CREATE_WORKTREE_TEST_LOG_FILE:?}"
if [[ "${1:-}" == "init" ]]; then
  printf 'codegraph init stdout\n'
  printf 'codegraph init stderr\n' >&2
  mkdir -p "${3:-}/.codegraph"
fi
if [[ "${1:-}" == "status" ]]; then
  if [[ "${HANDAGENT_CREATE_WORKTREE_TEST_STATUS_FAIL:-0}" == "1" ]]; then
    printf 'codegraph status stdout before failure\n'
    printf 'codegraph status stderr before failure\n' >&2
    exit 45
  fi
  if [[ "${HANDAGENT_CREATE_WORKTREE_TEST_STATUS_MISMATCH:-0}" == "1" ]]; then
    printf 'This CodeGraph index belongs to a different git working tree.\n'
    exit 0
  fi
  printf 'CodeGraph status for %s\n' "${2:-}"
fi
EOF
chmod +x "$FAKE_BIN_DIR/codegraph"

output="$(
  HANDAGENT_CREATE_WORKTREE_TEST_REPO_ROOT="$REPO_ROOT" \
  HANDAGENT_CREATE_WORKTREE_TEST_LOG_FILE="$LOG_FILE" \
  PATH="$FAKE_BIN_DIR:$PATH" \
  "$REPO_ROOT/scripts/create-worktree.sh" codegraph-flow 2>&1
)"

worktree_path="$REPO_ROOT/.worktrees/codegraph-flow"
expected_log=$'git check-ignore -q .worktrees\n'
expected_log+="git worktree add $worktree_path -b codex/codegraph-flow"$'\n'
expected_log+="pnpm install cwd=$worktree_path"$'\n'
expected_log+="codegraph init -i $worktree_path cwd=$worktree_path"$'\n'
expected_log+="codegraph status $worktree_path cwd=$worktree_path"

actual_log="$(cat "$LOG_FILE")"
if [[ "$actual_log" != "$expected_log" ]]; then
  printf 'Expected command order:\n%s\n\nActual:\n%s\n' "$expected_log" "$actual_log" >&2
  exit 1
fi

if [[ ! -d "$worktree_path/.codegraph" ]]; then
  printf 'Expected worktree-local CodeGraph index at %s/.codegraph\n' "$worktree_path" >&2
  exit 1
fi

if [[ "$output" != "CodeGraph projectPath: $worktree_path" ]]; then
  printf 'Expected successful output to contain only CodeGraph projectPath, got:\n%s\n' "$output" >&2
  exit 1
fi

: >"$LOG_FILE"
custom_output="$(
  HANDAGENT_CREATE_WORKTREE_TEST_REPO_ROOT="$REPO_ROOT" \
  HANDAGENT_CREATE_WORKTREE_TEST_LOG_FILE="$LOG_FILE" \
  PATH="$FAKE_BIN_DIR:$PATH" \
  "$REPO_ROOT/scripts/create-worktree.sh" custom-task feature/custom-branch 2>&1
)"

custom_path="$REPO_ROOT/.worktrees/custom-task"
grep -q "git worktree add $custom_path -b feature/custom-branch" "$LOG_FILE"
if [[ "$custom_output" != "CodeGraph projectPath: $custom_path" ]]; then
  printf 'Expected custom branch output to contain only CodeGraph projectPath, got:\n%s\n' "$custom_output" >&2
  exit 1
fi

if HANDAGENT_CREATE_WORKTREE_TEST_REPO_ROOT="$REPO_ROOT" \
  HANDAGENT_CREATE_WORKTREE_TEST_LOG_FILE="$LOG_FILE" \
  HANDAGENT_CREATE_WORKTREE_TEST_STATUS_MISMATCH=1 \
  PATH="$FAKE_BIN_DIR:$PATH" \
  "$REPO_ROOT/scripts/create-worktree.sh" mismatch \
  >"$TEST_TMP_DIR/mismatch.log" 2>&1; then
  printf 'Expected CodeGraph status mismatch to fail.\n' >&2
  exit 1
fi

grep -q 'CodeGraph is still pointing at a different git working tree:' "$TEST_TMP_DIR/mismatch.log"

if HANDAGENT_CREATE_WORKTREE_TEST_REPO_ROOT="$REPO_ROOT" \
  HANDAGENT_CREATE_WORKTREE_TEST_LOG_FILE="$LOG_FILE" \
  HANDAGENT_CREATE_WORKTREE_TEST_STATUS_FAIL=1 \
  PATH="$FAKE_BIN_DIR:$PATH" \
  "$REPO_ROOT/scripts/create-worktree.sh" status-fail \
  >"$TEST_TMP_DIR/status-fail.log" 2>&1; then
  printf 'Expected CodeGraph status command failure to fail.\n' >&2
  exit 1
fi

status_fail_output="$(cat "$TEST_TMP_DIR/status-fail.log")"
if [[ "$status_fail_output" != *"codegraph status stdout before failure"* ]] ||
  [[ "$status_fail_output" != *"codegraph status stderr before failure"* ]]; then
  printf 'Expected CodeGraph status failure to print captured output, got:\n%s\n' "$status_fail_output" >&2
  exit 1
fi

if HANDAGENT_CREATE_WORKTREE_TEST_REPO_ROOT="$REPO_ROOT" \
  HANDAGENT_CREATE_WORKTREE_TEST_LOG_FILE="$LOG_FILE" \
  PATH="$FAKE_BIN_DIR:$PATH" \
  "$REPO_ROOT/scripts/create-worktree.sh" '../bad' \
  >"$TEST_TMP_DIR/bad-task.log" 2>&1; then
  printf 'Expected invalid task name to fail.\n' >&2
  exit 1
fi

grep -q 'Invalid task name:' "$TEST_TMP_DIR/bad-task.log"

echo "success"
