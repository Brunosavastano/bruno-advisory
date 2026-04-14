# T3 Cycle 4 — Billing readiness precondition from persisted operator state

## Status
Implemented locally on 2026-04-14 (Europe/Berlin).

## What changed
- Added canonical billing-entry model in repo code:
  - `packages/core/src/billing-entry-model.ts`
- Defined deterministic readiness rules using persisted operator state:
  - commercial stage must be `cliente_convertido`
  - at least one internal task must exist
  - all internal tasks must be `done`
- Added DB-backed read path:
  - `getLeadBillingReadiness(leadId)` in `apps/web/lib/intake-storage.ts`
- Exposed deterministic read endpoint:
  - `GET /api/cockpit/leads/[leadId]/billing-readiness`
- Updated lead detail surface (`/cockpit/leads/[leadId]`) to render:
  - billing readiness YES/NO
  - current stage and task counts
  - unmet billing-entry conditions when not ready
- Preserved T2 funnel behavior and T3 cycles 1 to 3 operator flows (stage mutation, notes, tasks, task lifecycle audit).

## Local verification commands
1. `npm run typecheck`
2. `npm run build`
3. `npm run verify:t3:cycle4`
4. `npm run verify:t3:cycle4:local` (fallback when environment blocks socket bind)

## Evidence folder
- `state/evidence/T3-cycle-4/`

## What remains for cycle 5
- wire this readiness gate into actual billing event creation (still pre-provider integration decision)
