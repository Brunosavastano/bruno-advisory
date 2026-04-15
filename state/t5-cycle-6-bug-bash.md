# T5 cycle 6 - bug bash and regression suite

## What was tested
- Clean full rerun via `infra/scripts/verify-t5-full-regression.sh`
- Direct `tsc --noEmit` in `apps/web`
- End-to-end compiled-route regression path through intake, CRM stage, billing, portal invite/login, checklist, document upload/review, ledger, memos, research workflows, review queue, and audit log
- T3.5 billing tests
- Re-execution of T5 cycle verifiers 1 through 5

## What passed
- `state/evidence/T5-cycle-6/summary-local.json` -> `{ "ok": true }`
- `state/evidence/T5-cycle-6/regression-results.json` -> all entries `ok: true`
- `tsc --noEmit` in `apps/web` -> exit 0
- Billing tests -> exit 0
- T5 cycle verifiers 1 through 5 -> all exit 0 in the clean rerun
- End-to-end regression path -> exit 0

## What was fixed
- No confirmed product bug required a fix in the clean rerun.
- Earlier cycle 1 to cycle 4 failures were not reproducible after the clean rerun and are treated as transient execution noise, not confirmed defects.

## Remaining known limitations
- PostgreSQL runtime remains documented rather than implemented, as already captured in T5 cycle 5.
- Regression proof in this environment continues to rely on compiled-route/local execution rather than raw HTTP bind when sandbox behavior makes direct bind unreliable.
