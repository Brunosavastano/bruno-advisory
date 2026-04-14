# T3 Cycle 7 — First local settlement mutation over an existing local charge

## Status
Implemented locally on 2026-04-14 (Europe/Berlin).

## What changed
- Added canonical local settlement model in repo code:
  - `packages/core/src/local-billing-settlement-model.ts`
- Extended DB-backed intake storage for settlement state, reads, and mutation in:
  - `apps/web/lib/intake-storage.ts`
  - persisted tables:
    - `lead_billing_settlements`
    - `lead_billing_settlement_events`
  - exported helpers include:
    - `getLeadBillingSettlement(chargeId)`
    - `listLeadBillingSettlements(leadId)`
    - `listLeadBillingSettlementEvents(leadId)`
    - `createLeadLocalBillingSettlement(...)`
- Added truthful settlement mutation endpoint:
  - `POST /api/cockpit/leads/[leadId]/billing-settlements`
  - blocks settlement when no eligible `pending_local` charge exists
- Updated lead detail surface to render:
  - visible settlement state
  - settlement event trail
  - local settlement action only when an eligible charge exists
- Added cycle 7 verification scripts and evidence output under:
  - `infra/scripts/verify-t3-cycle-7.sh`
  - `infra/scripts/verify-t3-cycle-7-local.sh`
  - `state/evidence/T3-cycle-7/`

## Verified behavior
- settlement fails truthfully before any eligible charge exists
- settlement succeeds only after active billing plus local charge creation
- charge status moves from `pending_local` to `settled_local`
- settlement records and settlement events persist with lead, billing record, and charge references
- lead detail renders settlement state and event trail from persisted storage
- repeated settlement attempts fail truthfully once no eligible charge remains

## Local verification commands
1. `npm run typecheck`
2. `npm run build`
3. `npm run verify:t3:cycle7`
4. `npm run verify:t3:cycle7:local`

## Evidence pack
- `state/evidence/T3-cycle-7/typecheck.log`
- `state/evidence/T3-cycle-7/build.log`
- `state/evidence/T3-cycle-7/verify-cycle7.log`
- `state/evidence/T3-cycle-7/verify-cycle7-local.log`
- `state/evidence/T3-cycle-7/local-route-settlement-blocked-before-charge.json`
- `state/evidence/T3-cycle-7/local-route-settlement-blocked-before-eligible-charge.json`
- `state/evidence/T3-cycle-7/local-route-settlement-created.json`
- `state/evidence/T3-cycle-7/local-route-settlement-blocked-after-settled.json`
- `state/evidence/T3-cycle-7/local-db-inspection.json`
- `state/evidence/T3-cycle-7/local-surface-check.json`
- `state/evidence/T3-cycle-7/summary-local.json`

## What remains for cycle 8
- decide the next truthful post-settlement billing step, likely moving from the first settled local charge toward recurring cycle progression, reconciliation detail, or a second charge lifecycle without widening into provider integration
