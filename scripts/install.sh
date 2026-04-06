#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${OPENTRADEX_WORKSPACE:-$HOME/opentradex}"
PACKAGE_MANAGER="${OPENTRADEX_PACKAGE_MANAGER:-npm}"

echo "Welcome to OpenTradex"
echo "Our implementation. Your strategy."
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install Node.js 22+ and rerun this installer."
  exit 1
fi

if [[ "$PACKAGE_MANAGER" == "bun" ]]; then
  if ! command -v bun >/dev/null 2>&1; then
    echo "Bun is not installed, so this installer is falling back to npm."
    PACKAGE_MANAGER="npm"
  fi
fi

if [[ "$PACKAGE_MANAGER" == "bun" ]]; then
  bun add -g opentradex@latest
else
  npm install -g opentradex@latest
fi

opentradex onboard --workspace "$WORKSPACE"
