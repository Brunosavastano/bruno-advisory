#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
node - "$ROOT" <<'NODE'
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const root = process.argv[2];
const dbPath = path.join(root, 'data', 'dev', 'bruno-advisory-dev.sqlite3');
const db = new DatabaseSync(dbPath);

const result = {
  dbPath,
  billingRecords: db.prepare(`
    SELECT billing_record_id, lead_id, status, currency, entry_fee_cents, monthly_fee_cents, minimum_commitment_months, activated_at, created_at
    FROM lead_billing_records
    ORDER BY created_at DESC
    LIMIT 20
  `).all(),
  charges: db.prepare(`
    SELECT charge_id, billing_record_id, lead_id, charge_sequence, charge_kind, status, currency, amount_cents, due_date, posted_at, created_at
    FROM lead_billing_charges
    ORDER BY created_at DESC
    LIMIT 20
  `).all(),
  chargeEvents: db.prepare(`
    SELECT charge_event_id, charge_id, billing_record_id, lead_id, event_type, occurred_at, actor, note
    FROM lead_billing_charge_events
    ORDER BY occurred_at DESC
    LIMIT 40
  `).all()
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
NODE
