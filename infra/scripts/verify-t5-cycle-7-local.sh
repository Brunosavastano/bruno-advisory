#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T5-cycle-7}"
mkdir -p "$EVIDENCE_DIR"

export NODE_ENV="${NODE_ENV:-development}"
export PORT="${PORT:-3000}"
export APP_BASE_URL="${APP_BASE_URL:-http://127.0.0.1:3000}"
export COCKPIT_SECRET="${COCKPIT_SECRET:-test-secret-t5-cycle7}"
export DATABASE_PROVIDER="${DATABASE_PROVIDER:-sqlite}"
export DATABASE_URL="${DATABASE_URL:-$ROOT/data/dev/bruno-advisory-dev.sqlite3}"
export BACKUP_ARCHIVE="${BACKUP_ARCHIVE:-$ROOT/infra/backups/t5-cycle-7-local-latest.tar.gz}"

rm -rf apps/web/.next apps/web/.next.partial.* 2>/dev/null || true
npm run typecheck >/dev/null

PREFLIGHT_OUTPUT="$EVIDENCE_DIR/preflight-output.json"
SEED_OUTPUT="$EVIDENCE_DIR/seed-output.json"
BACKUP_OUTPUT="$EVIDENCE_DIR/backup-output.json"
RESTORE_OUTPUT="$EVIDENCE_DIR/restore-output.json"

bash infra/scripts/preflight-production.sh > "$PREFLIGHT_OUTPUT"
bash infra/scripts/seed-beta.sh > "$SEED_OUTPUT"

UPLOADS_MARKER_DIR="$ROOT/data/dev/uploads/t5-cycle-7-proof"
mkdir -p "$UPLOADS_MARKER_DIR"
LEAD_ID="$(python3 - "$SEED_OUTPUT" <<'PY'
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as fh:
    print(json.load(fh)['leadId'])
PY
)"
MARKER_PATH="$UPLOADS_MARKER_DIR/${LEAD_ID}.txt"
printf 'backup restore proof for %s\n' "$LEAD_ID" > "$MARKER_PATH"

bash infra/scripts/backup-production.sh > "$BACKUP_OUTPUT"

if [ ! -s "$BACKUP_ARCHIVE" ]; then
  echo "verify-t5-cycle-7-local.sh failed: backup archive missing or empty at $BACKUP_ARCHIVE" >&2
  exit 1
fi

: > "$DATABASE_URL"
rm -rf "$ROOT/data/dev/uploads"

bash infra/scripts/restore-production.sh > "$RESTORE_OUTPUT"

node - "$ROOT" "$EVIDENCE_DIR" "$PREFLIGHT_OUTPUT" "$SEED_OUTPUT" "$BACKUP_OUTPUT" "$RESTORE_OUTPUT" "$MARKER_PATH" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assert(condition, message, payload) {
  if (!condition) {
    const suffix = payload === undefined ? '' : ` ${JSON.stringify(payload)}`;
    throw new Error(`${message}${suffix}`);
  }
}

const root = process.argv[2];
const evidenceDir = path.resolve(root, process.argv[3]);
const preflightPath = path.resolve(root, process.argv[4]);
const seedPath = path.resolve(root, process.argv[5]);
const backupPath = path.resolve(root, process.argv[6]);
const restorePath = path.resolve(root, process.argv[7]);
const markerPath = path.resolve(root, process.argv[8]);

const preflight = readJson(preflightPath);
const seed = readJson(seedPath);
const backup = readJson(backupPath);
const restore = readJson(restorePath);

assert(preflight.ok === true, 'Preflight output did not report ok=true.', preflight);
assert(seed.ok === true, 'Seed output did not report ok=true.', seed);
assert(backup.ok === true, 'Backup output did not report ok=true.', backup);
assert(restore.ok === true, 'Restore output did not report ok=true.', restore);
assert(Number(backup.archiveSizeBytes) > 0, 'Backup archive size must be greater than zero.', backup);

const dbPath = process.env.DATABASE_URL;
assert(typeof dbPath === 'string' && dbPath.length > 0, 'DATABASE_URL must be set for SQLite verification.');
assert(fs.existsSync(dbPath), 'Expected restored SQLite DB file to exist.', { dbPath });

const db = new DatabaseSync(dbPath);
const leadRow = db.prepare(`
  SELECT lead_id AS leadId, full_name AS fullName, email, source_label AS sourceLabel
  FROM intake_leads
  WHERE lead_id = ?
  LIMIT 1
`).get(seed.leadId);
assert(leadRow, 'Seeded lead did not survive backup -> corrupt -> restore round-trip.', { leadId: seed.leadId });
assert(leadRow.email === seed.email, 'Restored lead email does not match the seeded lead.', leadRow);

const billingRow = db.prepare(`
  SELECT billing_record_id AS billingRecordId, status
  FROM lead_billing_records
  WHERE billing_record_id = ?
  LIMIT 1
`).get(seed.billingRecordId);
assert(billingRow && ['active', 'active_local'].includes(billingRow.status), 'Restored billing record missing or inactive.', billingRow);

assert(fs.existsSync(markerPath), 'Uploads proof marker was not restored.', { markerPath });
const markerContents = fs.readFileSync(markerPath, 'utf8');
assert(markerContents.includes(seed.leadId), 'Uploads marker contents do not match seeded lead.', { markerContents, leadId: seed.leadId });

const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  preflight,
  seed,
  backup,
  restore,
  restoredLeadId: seed.leadId,
  restoredBillingRecordId: seed.billingRecordId,
  uploadsMarkerPath: markerPath,
  note: 'Cycle 7 proved a real SQLite backup -> corruption -> restore round-trip on the repo-local runtime.'
};

fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
NODE
