# T3 Cycle 6 — First local recurring charge behind active billing

## Status
Implemented locally on 2026-04-14 (Europe/Berlin).

## What changed
- Added canonical local billing charge model in repo code:
  - `packages/core/src/local-billing-charge-model.ts`
- Completed DB-backed local charge storage and helpers in:
  - `apps/web/lib/intake-storage.ts`
  - persisted tables:
    - `lead_billing_charges`
    - `lead_billing_charge_events`
  - exported helpers include:
    - `getLeadBillingCharge(leadId)`
    - `listLeadBillingCharges(leadId)`
    - `listLeadBillingChargeEvents(leadId)`
    - `createLeadLocalBillingCharge(...)`
- Added truthful charge mutation endpoint:
  - `POST /api/cockpit/leads/[leadId]/billing-charges`
  - blocks creation when no active local billing record exists
- Updated lead detail surface to render:
  - charge state
  - persisted charge events
  - create-charge action when eligible
- Added cycle 6 verification and DB inspection scripts plus evidence output under:
  - `state/evidence/T3-cycle-6/`

## Local verification commands
1. `npm run typecheck`
2. `npm run build`
3. `npm run verify:t3:cycle6`
4. `npm run verify:t3:cycle6:local`
5. `npm run inspect:t3:cycle6:db`

## What remains for cycle 7
- decide the next truthful post-charge billing operation without widening into provider integration, for example local payment capture or settlement state with its own event trail
