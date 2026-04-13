# Database path

## T0 dev DB baseline

Bruno Advisory uses a project-local independent SQLite file for T0 development proof.

- Script: `infra/scripts/init-dev-db.sh`
- DB path: `data/dev/bruno-advisory-dev.sqlite3`
- Evidence: `state/evidence/T0/db-info.json`

## Why this is acceptable for T0

- it is independent from VLH
- it is local to this repo
- it creates a real database file, not a placeholder
- it keeps production DB choice open while proving independence now

## Production direction

Production remains PostgreSQL per `project.yaml`, but that production path is not yet evidenced in T0.
