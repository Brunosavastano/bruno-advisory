# T0 operator audit

## Single audit command

```bash
bash infra/scripts/audit-t0.sh
```

This command must finish with exit code `0` before claiming T0 local proof is healthy.

## What it does

1. records the active `next`, `react`, and `react-dom` dependency tree
2. runs `npm audit --omit=dev --json` and requires zero reported vulnerabilities
3. runs `infra/scripts/verify-t0.sh` twice in a row
4. preserves both verification passes under `state/evidence/T0/runs/`
5. refreshes the top-level evidence files under `state/evidence/T0/`
6. runs the explicit local healthcheck script
7. runs the explicit local backup script

## Exact remaining T0 checklist after a clean audit

- [ ] minimal CI wired in the repo
- [ ] Zeus or Bruno accepts that the T0 gate is met
