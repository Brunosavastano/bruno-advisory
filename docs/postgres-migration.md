# PostgreSQL migration plan

## Status in T5 cycle 5

Bruno Advisory remains SQLite-first in the current repo-local runtime.
This cycle does not add a PostgreSQL driver because Zeus explicitly barred new npm dependencies without approval.

What is delivered now:
- production environment contract in `infra/env.production.example`
- production preflight that can validate a PostgreSQL URL with `psql` when the client binary is available
- exact migration steps below, so the switch can be implemented without changing cockpit, portal, or API contracts

## Why the full switch is deferred

`apps/web/lib/storage/db.ts` is built around `node:sqlite` and synchronous SQL execution.
A real PostgreSQL switch needs a provider abstraction, a driver, and a schema bootstrap path for both providers.
Doing that honestly requires additional code and at least one new dependency, which is outside the current approval boundary.

## Exact implementation steps

### 1. Introduce a storage provider boundary

Create a small adapter layer under `apps/web/lib/storage/providers/`.
Minimum interfaces:
- `queryOne<T>()`
- `queryAll<T>()`
- `execute()`
- `transaction()`
- `ensureSchema()`

Keep the business modules (`leads.ts`, `billing.ts`, `portal.ts`, `recommendations.ts`, `research-workflows.ts`, `memos.ts`, `audit-log.ts`) calling the adapter instead of `DatabaseSync` directly.

### 2. Keep SQLite as the default local provider

Add provider resolution in `apps/web/lib/storage/db.ts`:
- `DATABASE_PROVIDER=sqlite` as default
- `DATABASE_PROVIDER=postgresql` for production
- `DATABASE_URL` required for both providers

SQLite URL rules to support:
- absolute path, for example `/root/Bruno-Advisory/bruno-advisory/data/dev/bruno-advisory-dev.sqlite3`
- `sqlite:///absolute/path.sqlite3`
- `file:/absolute/path.sqlite3`

### 3. Add a PostgreSQL driver after approval

Recommended minimal choice: `pg`.
After approval:
```bash
npm install pg -w @bruno-advisory/web
```

Then create `providers/postgres.ts` with:
- pooled connection creation from `DATABASE_URL`
- transaction helper using `BEGIN`, `COMMIT`, `ROLLBACK`
- row normalization matching the current field aliases used in SQLite queries

### 4. Port the schema bootstrap

Translate every `CREATE TABLE IF NOT EXISTS` block from `apps/web/lib/storage/db.ts` into PostgreSQL DDL.
Critical tables to port first:
- `intake_leads`
- `intake_events`
- `lead_stage_audit`
- `lead_internal_notes`
- `lead_internal_tasks`
- `lead_internal_task_audit`
- `lead_billing_records`
- `lead_billing_events`
- `lead_billing_charges`
- `lead_billing_charge_events`
- `lead_billing_settlements`
- `lead_billing_settlement_events`
- `portal_invites`
- `portal_sessions`
- `onboarding_checklist_items`
- `lead_documents`
- `lead_recommendations`
- `research_workflows`
- `research_workflow_events`
- `memos`
- `memo_events`
- `lead_pending_flags`
- `audit_log`

Key translation rules:
- `TEXT PRIMARY KEY` can remain `TEXT PRIMARY KEY`
- `INTEGER` remains `INTEGER`
- SQLite partial index on `lead_pending_flags` must be recreated explicitly in PostgreSQL
- boolean checks currently encoded as `INTEGER IN (0,1)` should become `BOOLEAN`
- keep the same column names so the API/storage contracts do not change

### 5. Preserve SQL alias compatibility

Current storage code relies on aliases like `lead_id AS leadId` and `created_at AS createdAt`.
Keep that alias pattern intact in both providers so higher-level modules stay unchanged.

### 6. Add migration/bootstrap command

Create a repo script such as:
```bash
bash infra/scripts/bootstrap-db.sh
```

Behavior:
- reads `DATABASE_PROVIDER` and `DATABASE_URL`
- applies the provider-specific bootstrap
- exits non-zero with a clear error if any critical table is missing afterward

### 7. Upgrade preflight to use the provider adapter

Once PostgreSQL runtime support exists, update `infra/scripts/preflight-production.sh` to:
- call the bootstrap command instead of relying on a local SQLite bootstrap path
- validate the same critical tables through the provider selected by env

### 8. Update seed and verifiers

After the provider abstraction exists, update these scripts to honor `DATABASE_PROVIDER` + `DATABASE_URL` directly:
- `infra/scripts/seed-beta.sh`
- `infra/scripts/verify-t5-cycle-5-local.sh`
- later T5 full-regression scripts

Acceptance target for the migration step:
- the same seed script works against SQLite and PostgreSQL without business-logic edits
- the same verifier passes against both providers

### 9. Production dry run before go-live

Before enabling a real production deploy:
1. provision PostgreSQL
2. export production env vars from `infra/env.production.example`
3. run preflight against PostgreSQL
4. run beta seed against PostgreSQL in a disposable database
5. run the full regression suite
6. only then switch the app runtime to `DATABASE_PROVIDER=postgresql`

## Non-goals for this document

This document does not invent new product behavior.
It only defines how to move the existing storage contract from SQLite to PostgreSQL without changing the public, cockpit, or portal surfaces.
