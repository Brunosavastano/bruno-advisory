# T3.5 Cycle 4, Billing tests

## Objective
Add reproducible automated coverage for the critical local billing paths using only the native `node:test` runner, without widening scope and without adding dependencies.

## What changed
- Added `apps/web/lib/storage/__tests__/billing.test.ts` coverage for the canonical billing flows:
  - billing readiness gate
  - billing activation
  - charge creation
  - targeted settlement
  - charge progression
  - blocking cases: missing charge, foreign charge, already settled charge, pending progression
- Kept the runner native by using the root `test` script in `package.json` with `node --test` semantics through Node's built-in test runner plus `--experimental-strip-types` for local TypeScript execution.
- Hardened the suite to be reproducible by:
  - building `@bruno-advisory/web` before the run
  - executing assertions against compiled Next route handlers
  - creating an isolated temporary repo root during the test run so the suite does not touch workspace billing data
- Created `infra/scripts/verify-t35-cycle-4-local.sh` to validate the script, execute the suite, and write local evidence.

## Notes
- During implementation, legacy `.ts` import suffix drift from earlier refactors had to be normalized in `apps/web/lib` and `packages/core/src` so the web build and `node:test` flow would execute cleanly.
- No new dependencies were added.
- No feature work was introduced.
- No T4 work was opened.

## Acceptance evidence
- Local verifier: `infra/scripts/verify-t35-cycle-4-local.sh`
- Evidence JSON: `state/evidence/T3.5-cycle-4/summary-local.json`
