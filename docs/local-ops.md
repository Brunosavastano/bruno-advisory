# Local backup and healthcheck paths

## Backup path

- Script: `infra/scripts/backup-local.sh`
- Output path: `infra/backups/bruno-advisory-t0-local-latest.tar.gz`

Command:

```bash
bash infra/scripts/backup-local.sh
```

The backup is repo-local, excludes `.git`, `node_modules`, and `.next`, and writes a sibling `.sha256` checksum.

## Healthcheck path

- Script: `infra/scripts/healthcheck-local.sh`
- Default evidence output: `state/evidence/T0/healthcheck.json`

Command:

```bash
bash infra/scripts/healthcheck-local.sh
```

The script boots the local web app on an ephemeral port, calls `/api/health`, validates the expected Bruno Advisory / T0 / active payload, and exits non-zero on failure.
