# Local CI gate

## Purpose

T0 minimal CI is a repo-local pre-push gate, independent from VLH and independent from third-party CI components.

## Canonical path

- Hook: `.githooks/pre-push`
- Install script: `infra/scripts/install-local-ci-hook.sh`
- CI command: `infra/scripts/ci-local.sh`
- Evidence: `state/evidence/T0/ci-local.log` and `state/evidence/T0/ci-hook.txt`

## What the gate runs

The pre-push hook runs:

```bash
bash infra/scripts/ci-local.sh
```

That command runs the full T0 operator audit:

```bash
bash infra/scripts/audit-t0.sh
```

## Why this counts for T0

- it is wired to the repo used on this server
- it blocks pushes when the project proof is broken
- it uses no VLH runtime or workflow
- it avoids third-party CI components while still enforcing an integration gate
