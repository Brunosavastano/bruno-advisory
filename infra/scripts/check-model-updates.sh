#!/usr/bin/env bash
# AI-1 Cycle 2 — manual model upgrade workflow stub.
# Usage: bash infra/scripts/check-model-updates.sh
#
# Lifecycle for promoting a new Anthropic model:
#   1. Operator inspects what is pinned (this script lists current versions).
#   2. Operator reads Anthropic's release notes manually:
#        https://docs.anthropic.com/en/docs/about-claude/models
#   3. If a newer Sonnet ships, register it as candidate via the admin API.
#   4. Run the golden eval set (Cycle 4 will automate; for now: manual A/B).
#   5. Once satisfied, transition candidate -> active via the admin API.
#   6. Old version transitions active -> deprecated (and eventually blocked).
#
# This script is a shell stub that prints current state and the upgrade commands.
# It does NOT automate the upgrade — that decision stays with the operator.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "=== AI model_versions currently registered ==="
echo "(Reading from local SQLite. Production DB lives in the savastano-advisory-app container.)"
echo

DB="${ROOT}/data/dev/savastano-advisory.sqlite3"
if [ ! -f "$DB" ]; then
  echo "(no local DB at $DB — start the app or run a verifier first)"
  exit 0
fi

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" "SELECT provider, model_id, display_name, status, datetime(created_at), datetime(pinned_at) FROM ai_model_versions ORDER BY created_at DESC;" || true
else
  echo "(sqlite3 CLI not installed; skipping listing — see ai_model_versions table directly)"
fi

cat <<'COMMANDS'

=== How to register a new candidate (example: Sonnet 4.7) ===

# 1. Register the new version as candidate (admin auth required):
curl -X POST https://savastanoadvisory.com.br/api/cockpit/ai/model-versions \
  -H 'Content-Type: application/json' \
  -H 'Cookie: cockpit_session=<your-session-token>' \
  -d '{
    "provider": "anthropic",
    "modelId": "claude-sonnet-4-7",
    "displayName": "Claude Sonnet 4.7",
    "inputPriceJson": "{\"centsPerMillion\":300,\"cachedCentsPerMillion\":30}",
    "outputPriceJson": "{\"centsPerMillion\":1500}",
    "notes": "Released YYYY-MM-DD. Pricing same as 4.6."
  }'

# 2. Run the golden eval set against the candidate (Cycle 4 will automate). For Cycle 2,
#    create eval cases manually, run jobs against the candidate model_version_id, and
#    inspect ai_eval_runs for pass/warn/fail counts.

# 3. Once satisfied, promote candidate -> active:
curl -X PATCH https://savastanoadvisory.com.br/api/cockpit/ai/model-versions \
  -H 'Content-Type: application/json' \
  -H 'Cookie: cockpit_session=<your-session-token>' \
  -d '{ "modelVersionId": "<candidate-id>", "toStatus": "active" }'

# 4. Deprecate the old version:
curl -X PATCH https://savastanoadvisory.com.br/api/cockpit/ai/model-versions \
  -H 'Content-Type: application/json' \
  -H 'Cookie: cockpit_session=<your-session-token>' \
  -d '{ "modelVersionId": "<old-id>", "toStatus": "deprecated" }'

# 5. Update AI_MODEL on the server .env to the new modelId, then restart the app.

Reference: https://docs.anthropic.com/en/docs/about-claude/models
COMMANDS
