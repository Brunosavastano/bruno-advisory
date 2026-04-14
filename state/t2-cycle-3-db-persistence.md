# T2 Cycle 3 — DB-backed Intake Persistence (Local)

## Date
2026-04-13

## Scope delivered in this cycle
1. Primary intake lead persistence moved from JSONL to the project DB at `data/dev/bruno-advisory-dev.sqlite3`.
2. Primary intake event persistence moved from JSONL to the same project DB in a dedicated event table.
3. Cockpit now reads DB-backed lead state instead of JSONL.
4. The same CTA -> intake -> submit -> cockpit path remains active.
5. Legacy JSONL records are imported into DB for continuity, but JSONL is no longer the primary storage path.

## DB objects used
- database file: `data/dev/bruno-advisory-dev.sqlite3`
- lead table: `intake_leads`
- event table: `intake_events`

## Verification path (exact)
1. Start app:
```bash
npm run dev
```
2. Open `http://localhost:3000/`.
3. Click `Iniciar triagem`.
4. Submit a valid intake payload.
5. Confirm `201` success or success UI with `leadId`.
6. Submit an invalid payload and confirm `400` with validation errors.
7. Open `http://localhost:3000/cockpit/leads` and verify the new row appears with canonical cockpit columns.
8. Query the DB directly:
```bash
node - <<'NODE'
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/dev/bruno-advisory-dev.sqlite3');
console.log(db.prepare('SELECT lead_id, full_name, status, source_channel, source_label, created_at FROM intake_leads ORDER BY created_at DESC LIMIT 5').all());
console.log(db.prepare('SELECT event_name, occurred_at, related_lead_id FROM intake_events ORDER BY occurred_at DESC LIMIT 10').all());
NODE
```

## Notes
- No CRM, billing, or portal scope was added.
- No VLH dependency was introduced.
- T2 remains active and is not closed in this cycle.
