# T0 dependency security posture

## Current framework baseline

- `next`: `16.2.3` (pinned exact)
- `react`: `18.3.1`
- `react-dom`: `18.3.1`

## Why this is the T0 baseline

The previous T0 hardening slice on `14.2.35` removed the specific 2025-12-11 advisory pressure in the 14.x line, but `npm audit` still reported one high vulnerability and pointed to `16.2.3` as the fixable non-vulnerable baseline.

The app is still deliberately minimal, so the smallest truthful closure was to test the audit-recommended major bump directly.

## Result

- the app installs cleanly on `next@16.2.3`
- the existing local verification path still passes
- `npm audit` reports zero vulnerabilities
- React remained on the existing 18.x baseline because `next@16.2.3` accepts it and the app does not need a broader framework migration for T0

## T0 stance

- dependency posture is now honest with the live audit result
- backup and healthcheck paths are explicit inside the repo under `infra/scripts/`
- the single operator audit command is `bash infra/scripts/audit-t0.sh`
