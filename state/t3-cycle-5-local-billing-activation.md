# T3 Cycle 5 — Local billing activation from readiness gate

## Status
Implemented locally on 2026-04-14 (Europe/Berlin).

## What changed
- Added canonical local billing model in repo code:
  - `packages/core/src/local-billing-model.ts`
- Added DB-backed persisted billing record and billing event trail:
  - `lead_billing_records`
  - `lead_billing_events`
  - storage read/write paths in `apps/web/lib/intake-storage.ts`
- Added truthful mutation endpoint:
  - `POST /api/cockpit/leads/[leadId]/billing-record`
  - creates first local billing record only when billing readiness is true
  - returns truthful failure when readiness is unmet or record already exists
- Updated lead detail surface (`/cockpit/leads/[leadId]`) to render:
  - billing record state
  - pricing shape sourced from T1 canon
  - persisted billing event trail
  - operator action to create local billing record
- Added cycle 5 verification and DB inspection scripts plus evidence output under:
  - `state/evidence/T3-cycle-5/`

## Local verification commands
1. `npm run typecheck`
2. `npm run build`
3. `npm run verify:t3:cycle5`
4. `npm run verify:t3:cycle5:local`

## What remains for cycle 6
- decide the next truthful post-activation billing mutation or collection event without widening into external provider integration
