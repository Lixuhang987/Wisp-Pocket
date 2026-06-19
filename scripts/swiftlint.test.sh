#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_TMP_DIR="$(mktemp -d -t swiftlint-test.XXXXXX)"
FAKE_BIN_DIR="$TEST_TMP_DIR/bin"
CALLS_LOG="$TEST_TMP_DIR/calls.log"
TEMP_ROOT="$TEST_TMP_DIR/root"

cleanup() {
  rm -rf "$TEST_TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$FAKE_BIN_DIR" "$TEMP_ROOT/scripts" "$TEMP_ROOT/apps/desktop/Sources/Settings"

cat >"$FAKE_BIN_DIR/swift" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${SWIFTLINT_TEST_CALLS_LOG:-}" ]]; then
  printf 'swift %s\n' "$*" >>"$SWIFTLINT_TEST_CALLS_LOG"
fi

printf 'swift stdout for %s\n' "$*"
printf 'swift stderr for %s\n' "$*" >&2

if [[ "${SWIFTLINT_FAKE_FAIL:-0}" == "1" ]]; then
  exit 64
fi
EOF
chmod +x "$FAKE_BIN_DIR/swift"

cp "$ROOT_DIR/scripts/swiftlint.sh" "$TEMP_ROOT/scripts/swiftlint.sh"
chmod +x "$TEMP_ROOT/scripts/swiftlint.sh"

# Minimal SwiftLint config so the presence check passes.
cat >"$TEMP_ROOT/.swiftlint.yml" <<'EOF'
included:
  - apps/desktop/Sources/Settings
only_rules:
  - settings_no_bare_textfield
custom_rules:
  settings_no_bare_textfield:
    regex: '\bTextField\('
    message: "Use SettingsTextField."
    severity: error
EOF

# Touch a Settings source file so the plugin has something to lint.
: >"$TEMP_ROOT/apps/desktop/Sources/Settings/Placeholder.swift"

# 1. Happy path: script invokes the SwiftLint command plugin with write permission
#    and forwards its stdout/stderr.
: >"$CALLS_LOG"
success_output="$(SWIFTLINT_TEST_CALLS_LOG="$CALLS_LOG" PATH="$FAKE_BIN_DIR:$PATH" "$TEMP_ROOT/scripts/swiftlint.sh" 2>&1)"

if [[ "$success_output" != *"swift stdout for package --allow-writing-to-package-directory swiftlint"* ]] ||
  [[ "$success_output" != *"swift stderr for package --allow-writing-to-package-directory swiftlint"* ]]; then
  printf 'Expected swiftlint.sh to forward SwiftLint plugin output, got:\n%s\n' "$success_output" >&2
  exit 1
fi

actual_calls="$(cat "$CALLS_LOG")"
if [[ "$actual_calls" != *"package --allow-writing-to-package-directory swiftlint"* ]]; then
  printf 'Expected swiftlint.sh to invoke the SwiftLint command plugin with write permission, got:\n%s\n' "$actual_calls" >&2
  exit 1
fi

# 2. Lint failures exit non-zero and do not swallow the plugin message.
set +e
failure_output="$(SWIFTLINT_FAKE_FAIL=1 PATH="$FAKE_BIN_DIR:$PATH" "$TEMP_ROOT/scripts/swiftlint.sh" 2>&1)"
failure_status=$?
set -e

if [[ "$failure_status" -eq 0 ]]; then
  printf 'Expected swiftlint.sh to propagate SwiftLint plugin failures, got exit 0\n' >&2
  exit 1
fi

if [[ "$failure_output" != *"swift stderr for package --allow-writing-to-package-directory swiftlint"* ]]; then
  printf 'Expected swiftlint.sh to surface plugin failure output, got:\n%s\n' "$failure_output" >&2
  exit 1
fi

# 3. Missing .swiftlint.yml is a hard failure with a clear message before touching swift.
rm "$TEMP_ROOT/.swiftlint.yml"
set +e
missing_output="$(PATH="$FAKE_BIN_DIR:$PATH" "$TEMP_ROOT/scripts/swiftlint.sh" 2>&1)"
missing_status=$?
set -e

if [[ "$missing_status" -eq 0 ]]; then
  printf 'Expected swiftlint.sh to fail when .swiftlint.yml is missing, got exit 0\n' >&2
  exit 1
fi

if [[ "$missing_output" != *"missing"*".swiftlint.yml"* ]] && [[ "$missing_output" != *"missing "*".swiftlint.yml"* ]]; then
  printf 'Expected swiftlint.sh to report missing .swiftlint.yml, got:\n%s\n' "$missing_output" >&2
  exit 1
fi

if [[ "$missing_output" == *"swift stdout"* ]]; then
  printf 'Expected swiftlint.sh to bail out before invoking swift when config is missing, got:\n%s\n' "$missing_output" >&2
  exit 1
fi

echo "success"
