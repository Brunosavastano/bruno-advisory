#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DB_PATH="${DB_PATH:-data/dev/bruno-advisory-dev.sqlite3}"
OUTPUT_PATH="${OUTPUT_PATH:-}"
LEAD_EMAIL="${LEAD_EMAIL:-}"

node - "$DB_PATH" "$OUTPUT_PATH" "$LEAD_EMAIL" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.argv[2];
const outputPath = process.argv[3];
const leadEmail = process.argv[4];

const result = {
  dbPath,
  exists: fs.existsSync(dbPath),
  sizeBytes: fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0,
  tables: [],
  counts: { leads: 0, events: 0 },
  matchingLead: null,
  matchingLeadEvents: [],
  recentLeads: [],
  recentEvents: []
};

if (result.exists) {
  const db = new DatabaseSync(dbPath);
  result.tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((row) => row.name);

  if (result.tables.includes('intake_leads')) {
    result.counts.leads = db.prepare('SELECT COUNT(*) AS count FROM intake_leads').get().count;
    result.recentLeads = db.prepare(`
      SELECT lead_id, full_name, email, status, source_channel, source_label, created_at
      FROM intake_leads
      ORDER BY created_at DESC, lead_id DESC
      LIMIT 5
    `).all();
  }

  if (result.tables.includes('intake_events')) {
    result.counts.events = db.prepare('SELECT COUNT(*) AS count FROM intake_events').get().count;
    result.recentEvents = db.prepare(`
      SELECT event_id, event_name, occurred_at, related_lead_id
      FROM intake_events
      ORDER BY occurred_at DESC, event_id DESC
      LIMIT 10
    `).all();
  }

  if (leadEmail && result.tables.includes('intake_leads')) {
    result.matchingLead = db.prepare(`
      SELECT lead_id, full_name, email, phone, investable_assets_band, source_channel, source_label, status, created_at
      FROM intake_leads
      WHERE lower(email) = lower(?)
      ORDER BY created_at DESC, lead_id DESC
      LIMIT 1
    `).get(leadEmail) ?? null;

    if (result.matchingLead && result.tables.includes('intake_events')) {
      result.matchingLeadEvents = db.prepare(`
        SELECT event_id, event_name, occurred_at, related_lead_id
        FROM intake_events
        WHERE related_lead_id = ?
           OR metadata_json LIKE ?
        ORDER BY occurred_at DESC, event_id DESC
        LIMIT 20
      `).all(result.matchingLead.lead_id, `%${result.matchingLead.lead_id}%`);
    }
  }
}

const json = `${JSON.stringify(result, null, 2)}\n`;
if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, json, 'utf8');
}
process.stdout.write(json);
NODE
