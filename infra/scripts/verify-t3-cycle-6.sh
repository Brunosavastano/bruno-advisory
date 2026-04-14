#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
echo "verify-t3-cycle-6.sh falling back to compiled-route verifier."
bash infra/scripts/verify-t3-cycle-6-local.sh
