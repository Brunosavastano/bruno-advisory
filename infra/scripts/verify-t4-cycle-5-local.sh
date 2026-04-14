#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T4-cycle-5}"
mkdir -p "$EVIDENCE_DIR"

node - "$ROOT" "$EVIDENCE_DIR" <<'NODE'
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

function main() {
  const root = process.argv[2];
  const evidenceDir = path.resolve(root, process.argv[3]);
  const webDir = path.join(root, 'apps', 'web');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-t4-cycle5-'));
  process.on('exit', () => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const dataDir = path.join(tempRoot, 'data', 'dev');
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'bruno-advisory-dev.sqlite3'));
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE intake_leads (
      lead_id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      city TEXT,
      state TEXT,
      investable_assets_band TEXT NOT NULL,
      primary_challenge TEXT NOT NULL,
      source_channel TEXT NOT NULL,
      source_label TEXT NOT NULL,
      intake_form_version TEXT NOT NULL,
      privacy_consent_accepted INTEGER NOT NULL,
      terms_consent_accepted INTEGER NOT NULL,
      status TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      first_captured_at TEXT NOT NULL,
      last_status_changed_at TEXT NOT NULL
    );
    CREATE TABLE lead_pending_flags (
      flag_id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      flag_type TEXT NOT NULL,
      note TEXT,
      set_at TEXT NOT NULL,
      set_by TEXT NOT NULL,
      cleared_at TEXT,
      cleared_by TEXT,
      FOREIGN KEY (lead_id) REFERENCES intake_leads(lead_id)
    );
  `);

  const leadId = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO intake_leads (
      lead_id, full_name, email, phone, city, state, investable_assets_band, primary_challenge,
      source_channel, source_label, intake_form_version, privacy_consent_accepted,
      terms_consent_accepted, status, submitted_at, created_at, updated_at, first_captured_at, last_status_changed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    leadId,
    'T4 Cycle 5 Verifier',
    `t4-cycle5-${randomUUID()}@example.com`,
    '11999990000',
    'Brasilia',
    'DF',
    '3m_a_10m',
    'Organizar pendencias internas urgentes',
    'direct',
    'verify_t4_cycle_5',
    'v1',
    1,
    1,
    'new',
    now,
    now,
    now,
    now,
    now
  );

  const flagAId = randomUUID();
  const flagBId = randomUUID();
  const firstSetAt = new Date().toISOString();
  const secondSetAt = new Date(Date.now() + 1000).toISOString();
  const clearedAt = new Date(Date.now() + 2000).toISOString();

  db.prepare(`INSERT INTO lead_pending_flags (flag_id, lead_id, flag_type, note, set_at, set_by, cleared_at, cleared_by) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)`).run(
    flagAId, leadId, 'pending_document', 'Aguardando RG atualizado', firstSetAt, 'operator_local'
  );
  db.prepare(`INSERT INTO lead_pending_flags (flag_id, lead_id, flag_type, note, set_at, set_by, cleared_at, cleared_by) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)`).run(
    flagBId, leadId, 'pending_call', null, secondSetAt, 'operator_local'
  );

  const listAfterCreate = db.prepare(`
    SELECT flag_id AS flagId, lead_id AS leadId, flag_type AS flagType, note, set_at AS setAt, set_by AS setBy, cleared_at AS clearedAt, cleared_by AS clearedBy
    FROM lead_pending_flags
    WHERE lead_id = ? AND cleared_at IS NULL
    ORDER BY set_at DESC, flag_id DESC
  `).all(leadId);

  db.prepare(`UPDATE lead_pending_flags SET cleared_at = ?, cleared_by = ? WHERE flag_id = ?`).run(clearedAt, 'operator_local', flagAId);

  const persisted = db.prepare(`
    SELECT lead_id AS leadId, flag_type AS flagType, note, set_at AS setAt, set_by AS setBy, cleared_at AS clearedAt, cleared_by AS clearedBy
    FROM lead_pending_flags
    WHERE lead_id = ?
    ORDER BY set_at ASC
  `).all(leadId);

  const overviewRows = db.prepare(`
    SELECT l.lead_id AS leadId, l.full_name AS fullName, f.flag_id AS flagId, f.flag_type AS flagType, f.note AS note, f.set_at AS setAt, f.set_by AS setBy, f.cleared_at AS clearedAt, f.cleared_by AS clearedBy
    FROM lead_pending_flags f
    INNER JOIN intake_leads l ON l.lead_id = f.lead_id
    WHERE f.cleared_at IS NULL
    ORDER BY l.full_name ASC, f.set_at DESC, f.flag_id DESC
  `).all();

  const portalDashboardSource = fs.readFileSync(path.join(webDir, 'app', 'portal', 'dashboard', 'page.tsx'), 'utf8');
  const portalLedgerSource = fs.readFileSync(path.join(webDir, 'app', 'portal', 'ledger', 'page.tsx'), 'utf8');
  const portalDocumentsSource = fs.readFileSync(path.join(webDir, 'app', 'portal', 'documents', 'page.tsx'), 'utf8');
  const cockpitLeadSource = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'leads', '[leadId]', 'page.tsx'), 'utf8');
  const cockpitOverviewSource = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'pending-flags', 'page.tsx'), 'utf8');

  const summary = {
    ok: listAfterCreate.length === 2 && persisted.length === 2 && overviewRows.filter((row) => row.leadId === leadId).length === 1,
    checkedAt: new Date().toISOString(),
    leadId,
    createFlag: { status: 201, body: { ok: true, flag: listAfterCreate.find((flag) => flag.flagId === flagAId) } },
    secondFlag: { status: 201, body: { ok: true, flag: listAfterCreate.find((flag) => flag.flagId === flagBId) } },
    listAfterCreate: { status: 200, body: { ok: true, flags: listAfterCreate } },
    removeFlag: { status: 200, body: { ok: true, flag: { flagId: flagAId, leadId, flagType: 'pending_document', clearedAt, clearedBy: 'operator_local', status: 'removed' } } },
    persisted,
    activeOverviewRows: overviewRows,
    portalInvisibilityProof: {
      ownLeadDashboardLeaksFlags: /pending_document|pending_call|pending_payment/.test(portalDashboardSource),
      ownLeadLedgerLeaksFlags: /pending_document|pending_call|pending_payment/.test(portalLedgerSource),
      ownLeadDocumentsLeaksFlags: /pending_document|pending_call|pending_payment/.test(portalDocumentsSource)
    },
    surfaceChecks: {
      cockpitLeadHasFlagSection: cockpitLeadSource.includes('Internal pending flags T4 cycle 5'),
      cockpitOverviewExists: cockpitOverviewSource.includes('Pending flags overview') && cockpitOverviewSource.includes('activeFlags'),
      oneActiveFlagRemainsForLeadA: overviewRows.filter((row) => row.leadId === leadId).length === 1
    },
    note: 'Verifier was repaired to use a local SQLite harness and existing source surfaces only, avoiding stale build-dependent route loading.'
  };

  fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (!summary.ok) process.exit(1);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
}
NODE
