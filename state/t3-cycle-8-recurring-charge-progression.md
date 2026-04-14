# T3 Cycle 8 — Local recurring charge progression after first settlement

## Status
Implemented locally on 2026-04-14 (Europe/Berlin).

## What changed
- Added canonical recurring progression artifact in repo code:
  - `packages/core/src/local-billing-charge-progression-model.ts`
- Preserved the existing local charge canon and added DB-backed next-charge progression in:
  - `apps/web/lib/intake-storage.ts`
  - exported helper:
    - `createNextLeadLocalBillingCharge(...)`
- Added truthful progression mutation endpoint:
  - `POST /api/cockpit/leads/[leadId]/billing-charges/next`
- Updated lead detail surface to show:
  - latest recurring charge status
  - progression action only when the latest recurring charge is `settled_local`
  - multiple persisted charges in sequence on the same lead
- Added cycle 8 verification scripts and evidence output under:
  - `infra/scripts/verify-t3-cycle-8.sh`
  - `infra/scripts/verify-t3-cycle-8-local.sh`
  - `state/evidence/T3-cycle-8/`

## Verified behavior
- progression fails truthfully before active billing exists
- progression fails truthfully when no settled prior charge exists
- progression fails truthfully when a pending recurring charge already exists
- after charge 1 is settled, the next progression creates charge 2 with incremented `chargeSequence`
- charge 2 persists as the next monthly recurring charge with its own event trail
- lead detail renders multiple charges so sequence progression is visible

## Local verification commands
1. `npm run typecheck`
2. `npm run build`
3. `npm run verify:t3:cycle8`
4. `npm run verify:t3:cycle8:local`

## Evidence pack
- `state/evidence/T3-cycle-8/typecheck.log`
- `state/evidence/T3-cycle-8/build.log`
- `state/evidence/T3-cycle-8/verify-cycle8.log`
- `state/evidence/T3-cycle-8/verify-cycle8-local.log`
- `state/evidence/T3-cycle-8/local-route-progression-blocked-before-billing.json`
- `state/evidence/T3-cycle-8/local-route-progression-blocked-before-settled.json`
- `state/evidence/T3-cycle-8/local-route-charge-one-created.json`
- `state/evidence/T3-cycle-8/local-route-progression-blocked-while-pending.json`
- `state/evidence/T3-cycle-8/local-route-charge-one-settled.json`
- `state/evidence/T3-cycle-8/local-route-charge-two-created.json`
- `state/evidence/T3-cycle-8/local-route-progression-blocked-after-sequence-two.json`
- `state/evidence/T3-cycle-8/local-db-inspection.json`
- `state/evidence/T3-cycle-8/local-surface-check.json`
- `state/evidence/T3-cycle-8/summary-local.json`

## What remains for cycle 9
- decide the next truthful recurring billing step after sequence 2 creation, likely settlement or continuation logic for later sequences, without widening into provider integration or reconciliation breadth
