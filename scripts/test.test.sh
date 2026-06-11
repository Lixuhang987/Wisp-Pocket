#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_TMP_DIR="$(mktemp -d -t handagent-test-sh-test.XXXXXX)"
TEMP_ROOT="$TEST_TMP_DIR/root"
FAKE_BIN_DIR="$TEST_TMP_DIR/bin"

cleanup() {
  rm -rf "$TEST_TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$TEMP_ROOT/scripts" "$FAKE_BIN_DIR"
cp "$ROOT_DIR/scripts/test.sh" "$TEMP_ROOT/scripts/test.sh"
chmod +x "$TEMP_ROOT/scripts/test.sh"

for script_name in swiftw.test.sh package-app.test.sh create-worktree.test.sh test.test.sh; do
  cat >"$TEMP_ROOT/scripts/$script_name" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

script_name="$(basename "$0")"
printf '%s stdout\n' "$script_name"
printf '%s stderr\n' "$script_name" >&2

if [[ "${HANDAGENT_TEST_SH_FAIL_STEP:-}" == "$script_name" ]]; then
  exit 41
fi
EOF
  chmod +x "$TEMP_ROOT/scripts/$script_name"
done

cat >"$FAKE_BIN_DIR/pnpm" <<EOF
#!/usr/bin/env bash
set -euo pipefail

printf 'pnpm stdout for %s\n' "\$*"
printf 'pnpm stderr for %s\n' "\$*" >&2

EOF
chmod +x "$FAKE_BIN_DIR/pnpm"

success_output="$(PATH="$FAKE_BIN_DIR:$PATH" "$TEMP_ROOT/scripts/test.sh" 2>&1)"
if [[ "$success_output" != "success" ]]; then
  printf 'Expected successful scripts/test.sh output to be exactly "success", got:\n%s\n' "$success_output" >&2
  exit 1
fi

set +e
cat >"$FAKE_BIN_DIR/pnpm" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

printf 'pnpm stdout for %s\n' "$*"
printf 'pnpm stderr for %s\n' "$*" >&2
exit 42
EOF
chmod +x "$FAKE_BIN_DIR/pnpm"

failure_output="$(
  PATH="$FAKE_BIN_DIR:$PATH" \
    "$TEMP_ROOT/scripts/test.sh" 2>&1
)"
failure_status=$?
set -e

if [[ "$failure_status" -ne 42 ]]; then
  printf 'Expected failed pnpm step to exit 42, got %s\n' "$failure_status" >&2
  exit 1
fi

if [[ "$failure_output" != *"pnpm stdout for test:theme-tokens"* ]] ||
  [[ "$failure_output" != *"pnpm stderr for test:theme-tokens"* ]]; then
  printf 'Expected failed pnpm step to print captured output, got:\n%s\n' "$failure_output" >&2
  exit 1
fi

echo "success"
