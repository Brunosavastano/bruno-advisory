# T0 dependency security posture

## Current framework baseline

- `next`: `14.2.35` (pinned exact)
- `react`: `18.3.1`
- `react-dom`: `18.3.1`

## Reason for the Next.js bump

The prior T0 slice used `next@14.2.32`.

Per the official Next.js security advisory published on 2025-12-11, the patched 14.x line for the App Router React Server Components DoS issue is `14.2.35`.

## Local mitigation boundary

The current app does **not** use:

- `next/image`
- custom `rewrites`
- custom `redirects`
- custom `headers`

This matters because generic `npm audit` advisories for newer Next.js issues can still flag broad 14.x ranges even when the current T0 app does not exercise the affected feature paths.

## Audit stance for T0

- Minimum real hardening applied now: exact bump from `14.2.32` to `14.2.35`
- Verification path remains: `bash infra/scripts/verify-t0.sh`
- Deferred beyond this cycle: evaluating a major-line Next.js upgrade once T0 hardening is stable and accepted
