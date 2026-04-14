# T2 Cycle 5 — Repeatable Repo-local Verification Path

## Date
2026-04-13

## Scope delivered in this cycle
1. Added a repo-local T2 verification script that proves the current funnel end to end.
2. Added a small repeatable DB inspection helper to improve auditability.
3. Wrote cycle 5 verification output into a dedicated evidence folder.

## Scripts
- `infra/scripts/verify-t2.sh`
- `infra/scripts/inspect-t2-db.sh`

## Package commands
- `npm run verify:t2`
- `npm run inspect:t2:db`

## Verification path covered
- homepage reachable
- institutional/compliance routes reachable
- CTA/intake route reachable
- one successful intake submission
- one failed intake submission caused by validation
- proof that the successful lead exists in the project DB
- proof that the cockpit reflects DB-backed lead state

## Evidence path
- `state/evidence/T2-cycle-5/`

## Notes
- The script uses repo-local bash, curl, Node, and the existing Next app.
- No new third-party test framework was added.
- T2 remains active and is not closed in this cycle.
