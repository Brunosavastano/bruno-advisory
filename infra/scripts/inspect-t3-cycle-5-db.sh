#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
DB_PATH="$ROOT/data/dev/bruno-advisory-dev.sqlite3"
sqlite3 "$DB_PATH" <<'SQL'
.headers on
.mode column
SELECT billing_record_id, lead_id, status, currency, entry_fee_cents, monthly_fee_cents, minimum_commitment_months, activated_at, created_at
FROM lead_billing_records
ORDER BY created_at DESC
LIMIT 20;
SELECT billing_event_id, billing_record_id, lead_id, event_type, occurred_at, actor, note
FROM lead_billing_events
ORDER BY occurred_at DESC
LIMIT 40;
SQL
