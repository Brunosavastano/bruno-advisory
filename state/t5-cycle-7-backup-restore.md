# T5 cycle 7 - backup, rollback, and recovery

## Summary
Cycle 7 adds a SQLite-first backup and restore round-trip for the repo-local Bruno Advisory runtime.
The proof is a real destructive recovery test, not a paper procedure.

## What was built
- `infra/scripts/backup-production.sh`
  - creates a single `.tar.gz` archive at `BACKUP_ARCHIVE`
  - includes the SQLite DB file and `data/dev/uploads/` when present
  - succeeds when uploads do not exist
  - prints archive path and size on success
- `infra/scripts/restore-production.sh`
  - refuses to run when the archive is missing
  - overwrites `data/dev/` from the archive
  - restores the SQLite DB and uploads tree when present
- `docs/rollback.md`
  - step-by-step rollback procedure for the proven SQLite runtime
  - honest PostgreSQL note: `pg_dump` and `pg_restore` are the intended equivalents, but not the live verified runtime here
- `infra/scripts/verify-t5-cycle-7-local.sh`
  - runs preflight
  - seeds a lead
  - creates an uploads proof marker
  - backs up the runtime
  - corrupts the local runtime by zeroing the SQLite DB and deleting uploads
  - restores from archive
  - verifies the seeded lead and uploads marker survived the round-trip

## Verification result
- `state/evidence/T5-cycle-7/summary-local.json` reports `ok: true`
- backup archive was created and non-empty
- seeded lead survived backup -> corrupt -> restore
- uploads proof marker survived backup -> delete -> restore
- `tsc --noEmit` in `apps/web` passed
- `infra/scripts/verify-t5-full-regression.sh` still passed after the cycle 7 changes

## Fix applied during verification
- No product bug was found in the backup or restore path.
- One verifier-only correction was required: the cycle 7 proof initially assumed billing record status `active`, while the repo-local billing canon is `active_local`. The verifier was updated to accept the local canonical status instead of misclassifying a successful restore as a failure.

## Remaining limitations
- PostgreSQL backup and restore are documented-only in this cycle. Live proof remains SQLite-first.
- Recovery is file-based against the canonical repo-local `data/dev/` layout.
