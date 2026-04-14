# T3 Cycle 9 — Charge-targeted local settlement by chargeId

## Status
Implemented locally on 2026-04-14 (Europe/Berlin).

## What changed
- Added canonical targeting artifact in repo code:
  - `packages/core/src/local-billing-settlement-targeting-model.ts`
- Extended DB-backed intake storage with explicit charge-targeted settlement helpers in:
  - `apps/web/lib/intake-storage.ts`
  - exported helper:
    - `settleLeadLocalBillingChargeById(...)`
- Preserved the legacy lead-level settlement entry point while routing explicit chargeId settlement through the new targeted helper.
- Added charge-targeted settlement endpoint:
  - `POST /api/cockpit/leads/[leadId]/billing-settlements/[chargeId]`
- Updated lead detail surface to show explicit charge-row settlement controls for pending charges.
- Added cycle 9 verification scripts and evidence output under:
  - `infra/scripts/verify-t3-cycle-9.sh`
  - `infra/scripts/verify-t3-cycle-9-local.sh`
  - `state/evidence/T3-cycle-9/`

## Verified behavior
- targeted settlement fails truthfully before active billing exists
- targeted settlement fails truthfully when the selected charge does not exist
- targeted settlement fails truthfully when the selected charge belongs to another lead
- targeted settlement fails truthfully when the selected charge is already `settled_local`
- targeted settlement succeeds for the intended pending sequence 2 charge
- settlement rows and settlement events remain linked to the selected `chargeId`
- lead detail exposes explicit charge-level settlement controls instead of relying only on implicit lead-level selection

## Local verification commands
1. `npm run typecheck`
2. `npm run build`
3. `npm run verify:t3:cycle9`
4. `npm run verify:t3:cycle9:local`

## Evidence pack
- `state/evidence/T3-cycle-9/typecheck.log`
- `state/evidence/T3-cycle-9/build.log`
- `state/evidence/T3-cycle-9/verify-cycle9.log`
- `state/evidence/T3-cycle-9/verify-cycle9-local.log`
- `state/evidence/T3-cycle-9/local-route-targeted-settlement-blocked-no-billing.json`
- `state/evidence/T3-cycle-9/local-route-targeted-settlement-blocked-missing-charge.json`
- `state/evidence/T3-cycle-9/local-route-targeted-settlement-blocked-foreign-charge.json`
- `state/evidence/T3-cycle-9/local-route-targeted-settlement-charge-one.json`
- `state/evidence/T3-cycle-9/local-route-targeted-settlement-blocked-settled-charge.json`
- `state/evidence/T3-cycle-9/local-route-targeted-settlement-charge-two.json`
- `state/evidence/T3-cycle-9/local-db-inspection.json`
- `state/evidence/T3-cycle-9/local-surface-check.json`
- `state/evidence/T3-cycle-9/summary-local.json`

## What remains for cycle 10
- decide the next truthful billing step after explicit charge-targeted settlement, likely recurring continuation, settlement continuation, or more structured billing history controls, without widening into provider integration or reconciliation breadth
