# T3 Cycle 1 — Operator Spine Note

## Status
Implemented locally on 2026-04-13 (Europe/Berlin).

## What changed
- Added canonical T3 commercial stage model in repo code:
  - `packages/core/src/commercial-stage-model.ts`
- Added operator lead detail surface:
  - `/cockpit/leads/[leadId]` reachable from `/cockpit/leads`
- Added DB-backed mutation route inside app:
  - `POST /api/cockpit/leads/[leadId]/commercial-stage`
- Added persisted audit trail table in SQLite:
  - `lead_stage_audit`
- Added audit trail rendering on lead detail.
- Hardened storage root discovery so the project DB resolves from the repo root regardless of current working directory.

## T2 preservation
- Public intake contract and T2 funnel paths remain unchanged (`/go/intake`, `/intake`, `/api/intake`, `/cockpit/leads`).
- Existing intake `status` field is preserved; cycle 1 adds independent operator `commercial_stage`.

## Local verification commands
1. `npm run typecheck`
2. `npm run build`
3. `npm run verify:t3:cycle1`
4. `npm run verify:t3:cycle1:local` (fallback when the environment blocks socket bind)

## Evidence folder
- `state/evidence/T3-cycle-1/`

## What remains for cycle 2
- introduce internal notes/tasks linked to lead detail
- expand operator transitions/guardrails if needed
- decide minimal bridge from commercial stage progression to client activation/billing events
