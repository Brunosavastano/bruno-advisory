# T3.5 Cycle 1 — Storage split

## Date
2026-04-14

## What changed
- Split `apps/web/lib/intake-storage.ts` into domain modules under `apps/web/lib/storage/`:
  - `db.ts`
  - `leads.ts`
  - `notes.ts`
  - `tasks.ts`
  - `billing.ts`
  - `intake.ts`
  - `types.ts` (shared exported contracts used by the domain modules)
- Converted `apps/web/lib/intake-storage.ts` into a re-export barrel so existing imports keep working unchanged.
- Added `infra/scripts/verify-t35-cycle-1-local.sh` to build the app and exercise the compiled route handlers across intake, notes, tasks, stage mutation, billing readiness, billing activation, charge creation, settlement, and recurring progression.

## Verification
- `npm run typecheck`
- `npm run build`
- `bash infra/scripts/verify-t35-cycle-1-local.sh`

## Evidence
- `state/evidence/T3.5-cycle-1/summary-local.json`

## Remaining risk
- The split preserves behavior through the existing barrel, but deeper regression coverage still depends on future cycle test additions.
