# Beta protocol

## Goal

Run one complete operator-to-client walkthrough on a seeded lead without inventing new product behavior.
This protocol is for T5 cycle 5 beta preparation and local environment hardening.

## Before you start

1. Set the local env vars required by preflight.
2. Run the preflight script.
3. Run the beta seed.
4. Keep the JSON output from the seed. It contains the lead ID, invite code, and artifact IDs used during the walkthrough.

Recommended local env for verification:

```bash
export NODE_ENV=development
export PORT=3000
export APP_BASE_URL=http://127.0.0.1:3000
export COCKPIT_SECRET=test-secret-for-local-beta
export DATABASE_PROVIDER=sqlite
export DATABASE_URL=/root/Bruno-Advisory/bruno-advisory/data/dev/bruno-advisory-dev.sqlite3
export BACKUP_ARCHIVE=/root/Bruno-Advisory/bruno-advisory/infra/backups/beta-local-latest.tar.gz
```

Run:

```bash
bash infra/scripts/preflight-production.sh
bash infra/scripts/seed-beta.sh
```

## Walkthrough sequence

### 1. Intake created
Expected:
- seeded lead exists in `intake_leads`
- lead appears in `/cockpit/leads`
- source label is beta-local

### 2. Cockpit lead detail
Expected:
- lead detail page opens for the seeded lead
- commercial stage is `cliente_convertido`
- internal task exists and is already `done`
- checklist contains 3 items
- portal invite is visible with active code

### 3. Billing
Expected:
- one billing record exists and is active
- one first recurring charge exists
- ledger-related surfaces can read the local billing state

Known truth:
- there is still no external payment provider integration in T5
- settlement progression remains local-only and operator-driven

### 4. Portal invite and client login
Use the `inviteCode` printed by `seed-beta.sh`.
Expected:
- `/portal/login` accepts the code
- a portal session is created
- client is redirected into the portal experience

### 5. Checklist in portal
Expected:
- 3 seeded checklist items are visible on the client dashboard
- items start as pending until manually completed in the walkthrough

### 6. Upload flow
Expected:
- client can upload a document through the portal upload area
- cockpit can later review the uploaded file
- uploaded files are stored under `data/dev/uploads/<leadId>/`

Known limitation:
- this protocol seeds the lead and invite, but it does not pre-upload a file
- upload is still a manual walkthrough step

### 7. Ledger, memos, and research
Expected:
- portal ledger can read the seeded local billing record and first charge
- one published memo is visible
- one delivered research workflow is visible
- the published memo is linked to the delivered research workflow

### 8. Audit spot-check
Expected:
- cycle 4 audit log continues to record critical actions created during real walkthrough activity
- the seeded record gives you a stable lead for manual end-to-end checking

## Known limitations as of T5 cycle 5

- PostgreSQL runtime support is not implemented yet. Exact migration steps are in `docs/postgres-migration.md`.
- `seed-beta.sh` currently supports the repo-local SQLite runtime only.
- No external billing provider, reconciliation layer, or payment settlement provider exists yet.
- No email/notification automation exists yet.
- No AI content generation exists yet. Research and memo artifacts remain manual-first containers.
- In sandboxed environments, raw HTTP bind may still fail with `listen EPERM`; local verifiers continue to prefer truthful compiled-route fallbacks where needed.

## Reset between tests

If you want a clean local rerun:

```bash
rm -rf data/dev
rm -rf apps/web/.next apps/web/.next.partial.*
mkdir -p data/dev
bash infra/scripts/preflight-production.sh
bash infra/scripts/seed-beta.sh
```

What reset does:
- removes the local SQLite DB
- removes uploaded portal files under `data/dev/uploads`
- removes compiled Next.js output so preflight rebuilds cleanly

## Recommended operator cadence during beta

1. run preflight
2. run seed
3. save the seed JSON in your notes
4. execute the walkthrough with that exact lead
5. if behavior deviates, log the defect before reseeding

This keeps beta proof tied to a concrete seeded record instead of hand-created state.
