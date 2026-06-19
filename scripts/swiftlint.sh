#!/usr/bin/env bash

# SwiftLint guardrail for Settings theme safety.
#
# Invokes the SwiftLintPlugin command plugin declared in Package.swift and
# reads `.swiftlint.yml` at the repository root. The plugin only allows custom
# rules that forbid bare Settings inputs and hardcoded colors, keeping CI
# decoupled from pre-existing SwiftLint style debt.
#
# The plugin needs permission to write to the package directory (SwiftLint
# supports `--fix`), so `--allow-writing-to-package-directory` is passed.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f "$ROOT_DIR/.swiftlint.yml" ]]; then
  echo "scripts/swiftlint.sh: missing $ROOT_DIR/.swiftlint.yml" >&2
  exit 1
fi

cd "$ROOT_DIR"

if ! command -v swift >/dev/null 2>&1; then
  echo "scripts/swiftlint.sh: swift toolchain not found" >&2
  exit 1
fi

# shellcheck disable=SC2086
exec swift package --allow-writing-to-package-directory swiftlint "$@"
