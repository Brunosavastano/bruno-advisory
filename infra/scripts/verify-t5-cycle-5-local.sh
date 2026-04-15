#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T5-cycle-5}"
mkdir -p "$EVIDENCE_DIR"

export NODE_ENV="${NODE_ENV:-development}"
export PORT="${PORT:-3000}"
export APP_BASE_URL="${APP_BASE_URL:-http://127.0.0.1:3000}"
export COCKPIT_SECRET="${COCKPIT_SECRET:-test-secret-t5-cycle5}"
export DATABASE_PROVIDER="${DATABASE_PROVIDER:-sqlite}"
export DATABASE_URL="${DATABASE_URL:-$ROOT/data/dev/bruno-advisory-dev.sqlite3}"
export BACKUP_ARCHIVE="${BACKUP_ARCHIVE:-$ROOT/infra/backups/t5-cycle-5-local-latest.tar.gz}"

rm -rf apps/web/.next apps/web/.next.partial.* 2>/dev/null || true
npm run typecheck >/dev/null

PREFLIGHT_OUTPUT="$EVIDENCE_DIR/preflight-output.json"
SEED_OUTPUT="$EVIDENCE_DIR/seed-output.json"

bash infra/scripts/preflight-production.sh > "$PREFLIGHT_OUTPUT"
bash infra/scripts/seed-beta.sh > "$SEED_OUTPUT"

node - "$ROOT" "$EVIDENCE_DIR" "$PREFLIGHT_OUTPUT" "$SEED_OUTPUT" <<'NODE'
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

const preflight = readJson(preflightPath);
const seed = readJson(seedPath);

assert(preflight.ok === true, 'Preflight output did not report ok=true.', preflight);
assert(seed.ok === true, 'Seed output did not report ok=true.', seed);

const requiredSeedFields = [
  'leadId',
  'taskId',
  'billingRecordId',
  'firstChargeId',
  'inviteId',
  'inviteCode',
  'recommendationId',
  'researchWorkflowId',
  'memoId'
];
for (const field of requiredSeedFields) {
  assert(typeof seed[field] === 'string' && seed[field].length > 0, `Missing required seed field: ${field}.`, seed);
}
assert(Array.isArray(seed.checklistItemIds) && seed.checklistItemIds.length === 3, 'Expected exactly 3 checklist items from the seed.', seed);

const dbPath = process.env.DATABASE_URL;
assert(typeof dbPath === 'string' && dbPath.length > 0, 'DATABASE_URL must point to the SQLite DB for local verification.');
assert(fs.existsSync(dbPath), 'Expected SQLite DB file to exist after seed.', { dbPath });

const db = new DatabaseSync(dbPath);
const inviteRow = db.prepare(`
  SELECT invite_id AS inviteId, lead_id AS leadId, code, status
  FROM portal_invites
  WHERE invite_id = ?
  LIMIT 1
`).get(seed.inviteId);
assert(inviteRow, 'Invite row missing from DB.', { inviteId: seed.inviteId });
assert(inviteRow.code === seed.inviteCode, 'Invite code in DB does not match seed output.', inviteRow);
assert(inviteRow.leadId === seed.leadId, 'Invite lead_id in DB does not match seed output.', inviteRow);

const recommendationRow = db.prepare(`
  SELECT recommendation_id AS recommendationId, visibility
  FROM lead_recommendations
  WHERE recommendation_id = ?
  LIMIT 1
`).get(seed.recommendationId);
assert(recommendationRow && recommendationRow.visibility === 'published', 'Seeded recommendation was not published.', recommendationRow);

const researchRow = db.prepare(`
  SELECT id, status
  FROM research_workflows
  WHERE id = ?
  LIMIT 1
`).get(seed.researchWorkflowId);
assert(researchRow && researchRow.status === 'delivered', 'Seeded research workflow was not delivered.', researchRow);

const memoRow = db.prepare(`
  SELECT id, status, research_workflow_id AS researchWorkflowId
  FROM memos
  WHERE id = ?
  LIMIT 1
`).get(seed.memoId);
assert(memoRow && memoRow.status === 'published' && memoRow.researchWorkflowId === seed.researchWorkflowId, 'Seeded memo was not published and linked correctly.', memoRow);

const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  preflight,
  seed,
  invitePersisted: true,
  note: 'Verification ran against the repo-local SQLite runtime with honest preflight and seeded beta walkthrough data.'
};

fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
NODE
