# Release checklist

This is the exhaustive pre-go-live checklist for Bruno Advisory at the end of T5.
Checked items are only those verified in the local runtime.
Unchecked items require real production infrastructure or production credentials and are intentionally left open here.

## Environment and runtime contract

- [ ] All required env vars set (reference `infra/env.production.example`)
  - Local status: env contract exists and local verification used equivalent vars.
  - Production status: real production values are not configured in this repo-local environment.

- [ ] COCKPIT_SECRET rotated for production (not the local test value)
  - Local status: test secrets were used for verification only.
  - Production status: real production secret rotation remains pending.

- [ ] APP_BASE_URL set to real HTTPS domain
  - Local status: local verification used `http://127.0.0.1:3000`.
  - Production status: real HTTPS domain is still pending.

- [ ] DATABASE_PROVIDER and DATABASE_URL set for production DB
  - Local status: verified against repo-local SQLite.
  - Production status: PostgreSQL production connection is not configured here.

- [ ] BACKUP_ARCHIVE pointing to durable storage outside repo
  - Local status: backup and restore were proven locally with repo-local archive targets.
  - Production status: durable external archive path is still pending.

## Migration and operational readiness

- [x] PostgreSQL cutover plan reviewed (`docs/postgres-migration.md`)
  - Local status: documented nine-step cutover plan exists and is reviewable now.
  - Production status: live PostgreSQL cutover is still pending.

- [ ] `preflight-production.sh` passes on production env
  - Local status: preflight passes on the local SQLite runtime.
  - Production status: production env preflight has not been run.

- [ ] DNS configured and resolving to production host
  - Local status: not applicable in repo-local verification.
  - Production status: pending.

- [ ] HTTPS certificate valid and auto-renewing
  - Local status: not applicable in repo-local verification.
  - Production status: pending.

- [ ] Backup schedule established (cron or manual cadence documented)
  - Local status: backup and restore scripts exist, but no production schedule is configured from this repo-local environment.
  - Production status: pending.

- [ ] First backup of production DB verified
  - Local status: SQLite backup round-trip was proven locally.
  - Production status: first production backup is still pending.

- [x] Rollback procedure tested (`docs/rollback.md`)
  - Local status: verified with a real SQLite backup -> corrupt -> restore round-trip in T5 cycle 7.
  - Production status: production rollback drill still pending.

## First-client operational checks

- [ ] First-client lead exists in system with invite code ready
  - Local status: seeded beta leads and invite codes were created successfully in local verification.
  - Production status: real first-client record is still pending.

- [x] Portal login tested with real invite code
  - Local status: portal login was exercised with a real locally generated invite code in regression and beta seed verification.
  - Production status: production-domain portal login still pending.

- [ ] Cockpit accessible from production host with correct secret
  - Local status: cockpit routes and secret-gated behavior were verified locally.
  - Production status: production-host validation still pending.

## Final local proof at end of T5

- [x] Full local regression passes (`infra/scripts/verify-t5-full-regression.sh`)
  - Local status: final clean regression passed with all nine checks green.

- [x] Local backup/restore round-trip passes (`infra/scripts/verify-t5-cycle-7-local.sh`)
  - Local status: seeded lead and uploads proof marker survived backup -> corruption -> restore.

- [x] TypeScript passes in `apps/web`
  - Local status: `tsc --noEmit` passed.
