#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DB_PATH="${DB_PATH:-data/dev/bruno-advisory-dev.sqlite3}"
OUTPUT_PATH="${OUTPUT_PATH:-}"
LEAD_ID="${LEAD_ID:-}"

if [[ -z "$LEAD_ID" ]]; then
  echo "LEAD_ID is required" >&2
  exit 1
fi

node - "$DB_PATH" "$OUTPUT_PATH" "$LEAD_ID" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.argv[2];
const outputPath = process.argv[3];
const leadId = process.argv[4];

const result = {
  dbPath,
  exists: fs.existsSync(dbPath),
  leadId,
  lead: null,
  auditEntries: []
};

if (result.exists) {
  const db = new DatabaseSync(dbPath);

  result.lead = db.prepare(`
    SELECT lead_id, full_name, email, status, commercial_stage, updated_at
    FROM intake_leads
    WHERE lead_id = ?
    LIMIT 1
  `).get(leadId) ?? null;

  result.auditEntries = db.prepare(`
    SELECT audit_id, lead_id, from_stage, to_stage, changed_at, changed_by, note
    FROM lead_stage_audit
    WHERE lead_id = ?
    ORDER BY changed_at DESC, audit_id DESC
    LIMIT 20
  `).all(leadId);
}

const json = `${JSON.stringify(result, null, 2)}\n`;
if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, json, 'utf8');
}
process.stdout.write(json);
NODE
