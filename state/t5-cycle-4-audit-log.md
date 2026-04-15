# T5 cycle 4 - unified audit log

## Goal
Persist a single traceable audit log for critical billing, portal, review, recommendation, and CRM actions.

## Delivered
- `audit_log` table in SQLite with lead-aware filtering and pagination support.
- Storage module `apps/web/lib/storage/audit-log.ts` for writes and reads.
- Critical-path instrumentation across billing, portal, review queue, recommendations, documents, checklist completion, and commercial stage changes.
- Cockpit API routes for full and per-lead audit-log reads.
- Cockpit viewer at `/cockpit/audit-log` and lead-detail panel showing the latest 20 events.
- Local verifier `infra/scripts/verify-t5-cycle-4-local.sh` that exercises billing, portal, review, and audit-log route filtering.

## Acceptance target
- `npm run typecheck`
- `npm run verify:t5:cycle4:local`
- Re-run `npm run verify:t5:cycle1:local`, `npm run verify:t5:cycle2:local`, `npm run verify:t5:cycle3:local`

## Evidence
- `state/evidence/T5-cycle-4/summary-local.json`
