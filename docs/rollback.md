# Rollback procedure

This document defines the local SQLite-first rollback path for Bruno Advisory.
It is the T5 cycle 7 recovery procedure, not a promise of a live PostgreSQL runtime in this environment.

## Scope

- Current proven runtime: repo-local SQLite database at `data/dev/bruno-advisory-dev.sqlite3`
- Current backup unit: one `.tar.gz` archive containing the SQLite DB and `data/dev/uploads/` when present
- Current restore target: overwrite `data/dev/` from a known-good archive
- PostgreSQL note: the equivalent production approach would use `pg_dump` and `pg_restore`, but that runtime is still documented-only in this repo state

## Step-by-step rollback

### 1. Pre-deploy, create a known-good backup and record its path

Set the production env values for the local runtime, then run:

```bash
export DATABASE_PROVIDER=sqlite
export DATABASE_URL=/root/Bruno-Advisory/bruno-advisory/data/dev/bruno-advisory-dev.sqlite3
export BACKUP_ARCHIVE=/root/Bruno-Advisory/bruno-advisory/infra/backups/pre-deploy-$(date -u +%Y%m%dT%H%M%SZ).tar.gz
bash infra/scripts/backup-production.sh
```

Record the exact `BACKUP_ARCHIVE` path that succeeded.
That archive is the rollback source if the deploy fails or the local data becomes corrupt.

### 2. Deploy fails or data is corrupt

Examples:
- new deploy does not boot cleanly
- post-deploy verification fails
- SQLite database file becomes empty, missing, or inconsistent
- uploaded client files are missing after a failed deploy step

Do not keep mutating the runtime while diagnosing.
Use the known-good archive from step 1.

### 3. Stop the app

Stop the running app before restoring files.
The exact stop command depends on how the app was launched in the current environment.
The critical rule is simple: do not restore over a live process that may still be writing to `data/dev/`.

### 4. Restore from the known-good archive

```bash
export DATABASE_PROVIDER=sqlite
export DATABASE_URL=/root/Bruno-Advisory/bruno-advisory/data/dev/bruno-advisory-dev.sqlite3
export BACKUP_ARCHIVE=/root/Bruno-Advisory/bruno-advisory/infra/backups/<known-good>.tar.gz
bash infra/scripts/restore-production.sh
```

What restore does now:
- refuses to run if the archive is missing
- removes the current `data/dev/` contents
- extracts the archived `data/dev/` tree back into place
- restores the SQLite DB file
- restores `data/dev/uploads/` if it was present in the archive

### 5. Verify the restore before restart

Run preflight or probe the DB directly.

Preferred:

```bash
export NODE_ENV=development
export PORT=3000
export APP_BASE_URL=http://127.0.0.1:3000
export COCKPIT_SECRET=test-secret-for-local-verify
export DATABASE_PROVIDER=sqlite
export DATABASE_URL=/root/Bruno-Advisory/bruno-advisory/data/dev/bruno-advisory-dev.sqlite3
export BACKUP_ARCHIVE=/root/Bruno-Advisory/bruno-advisory/infra/backups/<known-good>.tar.gz
bash infra/scripts/preflight-production.sh
```

Or probe the DB tables directly:

```bash
sqlite3 data/dev/bruno-advisory-dev.sqlite3 "SELECT COUNT(*) FROM intake_leads;"
sqlite3 data/dev/bruno-advisory-dev.sqlite3 "SELECT COUNT(*) FROM audit_log;"
```

A restore is not complete until verification succeeds.

### 6. Restart the app

After the restore verifies cleanly, restart the app with the same runtime env contract used before the failed deploy.
Then rerun the normal smoke checks.

## PostgreSQL equivalent, honestly scoped

PostgreSQL is not the live runtime proven in this environment yet.
When that cutover happens, the equivalent workflow will be:

1. `pg_dump` before deploy
2. stop the app or place it into maintenance mode
3. `pg_restore` into the target database
4. verify critical tables and app boot
5. restart normal traffic

That is the operational intent, but it is not the verified cycle-7 path here.

## Current limitations

- No live PostgreSQL runtime is implemented in this repo-local verification environment
- Backup and restore proof is SQLite-first only in cycle 7
- Restore is file-based and assumes the repo-local `data/dev/` structure remains canonical
- Uploaded files are restored only if they were present in the backup archive
