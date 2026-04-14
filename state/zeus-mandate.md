# Zeus Mandate — T4 Portal do Cliente

## Date
2026-04-14 05:58 GMT-3

## Status
T4 is OPEN.

## Tranche objective
Deliver a private client portal with minimum functional set for onboarding and ongoing relationship.

## Cycles

| # | Name | Status |
|---|------|--------|
| 1 | Client auth skeleton (invite-code) | ✅ accepted |
| 2 | Client dashboard + onboarding checklist | ✅ accepted |
| 3 | Document upload | ✅ accepted |
| 4 | Recommendation ledger | ✅ accepted |
| 5 | Internal pending flags + Bruno overview | ✅ accepted |
| 6 | End-to-end proof + push + close | 🔴 open |

## Current cycle
**Cycle 6 — End-to-end proof + push + close**

### Deliverables
- E2E verifier: client logs in → completes checklist item → uploads document → sees ledger entry
- Operator verifier: creates invite → sees upload → creates recommendation → views pending flags
- git add + commit + push all T4 work
- Update `project.yaml`: `tranche_status: done`
- Create `state/t4-closure.md`
- Create `state/evidence/T4-cycle-6/summary-local.json`

## Acceptance bar
Each cycle: artifacts present + local verifier passes + state note written + evidence JSON in `state/evidence/T4-cycle-N/`.

## Rules
- No external auth providers without Bruno's approval
- No external file storage without Bruno's approval
- No new npm dependencies without Bruno's approval
- Client routes isolated from cockpit routes

## Canonical references
- `state/t4-opening.md`
- `project.yaml`
- `ROADMAP.md`
- `T4_portal_prompt.md`
