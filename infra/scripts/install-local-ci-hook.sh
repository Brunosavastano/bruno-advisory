#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE="state/evidence/T0/ci-hook.txt"
mkdir -p "$(dirname "$EVIDENCE")"

git config core.hooksPath .githooks
{
  echo "hooksPath=$(git config --get core.hooksPath)"
  echo "hook=.githooks/pre-push"
  echo "command=bash infra/scripts/ci-local.sh"
} > "$EVIDENCE"

cat "$EVIDENCE"
