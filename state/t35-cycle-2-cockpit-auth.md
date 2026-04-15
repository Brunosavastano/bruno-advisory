# T3.5 Cycle 2 — Cockpit auth

## Status
Completed locally on 2026-04-14.

## What changed
- Added shared-secret cockpit protection in `apps/web/proxy.ts`.
- Protected cockpit surfaces:
  - `/cockpit/*`
  - `/api/cockpit/*`
- Auth accepts:
  - `Authorization: Bearer <COCKPIT_SECRET>`
  - cookie `cockpit_token=<COCKPIT_SECRET>`
  - browser bootstrap via `?token=<COCKPIT_SECRET>` which sets the cookie and redirects
- Unauthenticated cockpit API requests return `401 { ok: false, error: "unauthorized" }`.
- Unauthenticated cockpit page requests redirect to `?login=1`, which renders a simple inline login prompt.
- If `COCKPIT_SECRET` is unset, cockpit requests pass through unchanged for local/dev backwards compatibility.

## Public routes kept open
- `/`
- `/intake`
- `/api/intake`
- `/api/intake-events`
- `/api/health`
- `/health`
- `/como-funciona`
- `/para-quem-e`
- `/privacidade`
- `/termos`
- `/go/intake`

## Verification
- Verifier: `infra/scripts/verify-t35-cycle-2-local.sh`
- Evidence: `state/evidence/T3.5-cycle-2/summary-local.json`
- Method: compiled Next app route handlers invoked directly after `next build`, because HTTP bind is blocked in this sandbox.

## Note
- This repo is on Next.js 16, where `middleware.ts` is deprecated in favor of `proxy.ts`.
- The auth implementation therefore lives in `apps/web/proxy.ts` to match the framework’s current runtime behavior.
