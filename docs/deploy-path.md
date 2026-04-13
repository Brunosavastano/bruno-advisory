# Deploy path

## T0 deploy proof

The current independent deploy proof is a local standalone Next runtime built from this repo.

- Script: `infra/scripts/verify-standalone.sh`
- Runtime artifact: `apps/web/.next/standalone/apps/web/server.js`
- Evidence: `state/evidence/T0/standalone-health.json`
- Server log: `state/evidence/T0/standalone-server.log`

## Why this counts for T0

- it proves the app can run from a standalone build artifact
- it does not depend on VLH
- it is reproducible on this server
- it is a real deploy-shaped runtime path, not just `next dev`

## What still remains beyond this proof

- production host wiring
- production secrets injection
- production process supervision
- production domain and TLS
