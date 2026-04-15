# T5 cycle 5 - beta preparation and environment hardening

## Goal
Ship the minimum production contract and a repeatable beta walkthrough without adding new product features.

## Delivered
- `infra/env.production.example` with the production env contract annotated.
- `infra/scripts/preflight-production.sh` validating required env vars, DB reachability, and critical tables.
- `docs/postgres-migration.md` documenting the exact PostgreSQL migration path since a full runtime switch is outside this cycle and approval boundary.
- `infra/scripts/seed-beta.sh` creating one complete beta lead through intake, task completion, converted commercial stage, billing record, first charge, portal invite, checklist items, published recommendation, delivered research workflow, and published memo linked to that research.
- `docs/beta-protocol.md` documenting the walkthrough, expected behavior, limitations, and reset instructions.
- `infra/scripts/verify-t5-cycle-5-local.sh` running preflight, running seed, confirming invite persistence, and writing evidence.

## Acceptance target
- `npm run typecheck`
- `bash infra/scripts/preflight-production.sh`
- `bash infra/scripts/seed-beta.sh`
- `npm run verify:t5:cycle5:local`

## Evidence
- `state/evidence/T5-cycle-5/summary-local.json`
