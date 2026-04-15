# T5 Prompt — Workflows Assistidos por IA, Beta e Go-Live

## Date
2026-04-15

## Status
Awaiting Bruno authorization to open.

## Context
T0–T4 delivered: independent repo, commercial proposition, public intake funnel, backoffice CRM/billing, and private client portal with onboarding, documents, ledger, and pending flags.
T3.5 hardened storage, auth, tests, and CRM fields.
All tranches closed by evidence with local verifiers.

The system now has a complete operator-to-client path running locally on SQLite.
T5 is the final tranche before production use.

## Objective
Automate what has already proved value, harden the system for real use, and prepare a controlled go-live.

T5 does NOT:
- Integrate external AI APIs without Bruno's explicit approval
- Add external billing/payment providers without Bruno's explicit approval
- Change the public brand or positioning defined in T1
- Open new product surfaces beyond what T4 delivered
- Create VLH dependency of any kind

## Deliverables (8 cycles)

### Cycle 1 — Research workflow skeleton
- Define a canonical research workflow model in `packages/core/src/research-workflow-model.ts`
- Statuses: `draft → in_progress → review → approved → delivered`
- DB table `research_workflows` with: id, leadId, title, topic, status, createdAt, updatedAt
- Cockpit: CRUD routes under `/api/cockpit/leads/[leadId]/research-workflows`
- Cockpit surface: research workflows visible in lead detail
- Portal: client sees `delivered` research entries as read-only in a dedicated section
- No AI integration yet — this cycle builds the container
- Verifier: `infra/scripts/verify-t5-cycle-1-local.sh`

### Cycle 2 — Memo/draft generator skeleton
- Define a canonical memo model in `packages/core/src/memo-model.ts`
- Memo linked to a research workflow (optional) or standalone per lead
- Statuses: `draft → pending_review → approved → published`
- DB table `memos` with: id, leadId, researchWorkflowId (nullable), title, body, status, createdAt, updatedAt
- Cockpit: CRUD + status mutation routes
- Cockpit surface: memos visible in lead detail, linked to research workflow when applicable
- Portal: client sees `published` memos in ledger or a dedicated section
- No AI generation yet — manual creation only
- Verifier: `infra/scripts/verify-t5-cycle-2-local.sh`

### Cycle 3 — Human review queue
- Cockpit-wide view at `/cockpit/review-queue` listing all memos and research workflows in `pending_review` status across all leads
- Sortable by date, lead name, type (memo vs research)
- Bruno can approve or reject directly from the queue (status mutation)
- Rejection records a reason in DB
- Audit trail: all review actions logged in existing event pattern
- Verifier: `infra/scripts/verify-t5-cycle-3-local.sh`

### Cycle 4 — Critical action logging
- Identify and enumerate critical actions: billing activation, charge creation, settlement, recommendation publish, document review, memo approval, invite creation/revocation
- Create a unified `audit_log` table: id, action, entityType, entityId, leadId, actorType (operator/client/system), detail (JSON), createdAt
- Instrument all critical paths to write to `audit_log`
- Cockpit: audit log viewer at `/cockpit/audit-log` with filters (action, lead, date range)
- Cockpit: per-lead audit trail visible in lead detail
- Verifier: `infra/scripts/verify-t5-cycle-4-local.sh`

### Cycle 5 — Beta preparation + environment hardening
- Production environment contract: document required env vars for production (PostgreSQL, real domain, HTTPS, secrets)
- Create `infra/env.production.example` with all required vars, annotated
- Create `infra/scripts/preflight-production.sh`: validates that all required vars are set, DB is reachable, and critical tables exist
- Migrate DB init to support both SQLite (dev) and PostgreSQL (prod) via env switch
- Seed script: `infra/scripts/seed-beta.sh` creates a test lead with invite, checklist items, a memo, a research workflow, and a billing record for walkthrough
- Document the beta test protocol in `docs/beta-protocol.md`: what to test, expected behavior, known limitations
- Verifier: `infra/scripts/verify-t5-cycle-5-local.sh`

### Cycle 6 — Bug bash + regression suite
- Run full manual walkthrough using seed data and document every bug found in `state/t5-bug-bash.md`
- Fix all P0/P1 bugs found
- Create `infra/scripts/verify-t5-full-regression.sh`: exercises the entire intake → CRM → billing → portal → documents → ledger → audit path end-to-end
- Existing T3.5 billing tests must still pass
- All previous tranche verifiers must still pass (no regression)
- Verifier: regression script itself + bug bash log

### Cycle 7 — Backup, rollback, and recovery
- Production backup script: `infra/scripts/backup-production.sh` (DB dump + uploads archive)
- Restore script: `infra/scripts/restore-production.sh` (from backup archive)
- Rollback procedure: documented in `docs/rollback.md` with step-by-step instructions
- Test: create backup → corrupt/delete DB → restore → verify data intact via regression script
- Verifier: `infra/scripts/verify-t5-cycle-7-local.sh` (backup/restore round-trip)

### Cycle 8 — Release checklist, final proof, and close
- Create `docs/release-checklist.md`: exhaustive pre-go-live checklist (env, secrets, DNS, HTTPS, DB, backup schedule, monitoring contact, first-client readiness)
- Run `verify-t5-full-regression.sh` one final time
- Run `preflight-production.sh` against a real or simulated production env
- Git add + commit + push all T5 work
- Update `project.yaml`: `tranche_status: done`
- Create `state/t5-closure.md`
- Verifier: all regression + preflight passing + manual push audit

## Evidence contract per cycle
Each cycle must produce at least:
- Code or config artifact in the repo
- Local verifier script that passes
- State note in `state/t5-cycle-N-*.md`
- Evidence JSON in `state/evidence/T5-cycle-N/summary-local.json`

## Gate de saída (T5)
The tranche closes when:
1. Research workflow and memo containers exist with full CRUD and portal visibility
2. Human review queue is operational with audit trail
3. All critical actions are logged in a unified audit table
4. Production environment contract is documented and preflight validates
5. Bug bash is complete with no open P0/P1
6. Full regression suite passes end-to-end
7. Backup and restore are tested with round-trip proof
8. Release checklist exists and preflight passes
9. Zeus records explicit acceptance
10. `project.yaml` is updated

## What T5 explicitly defers
- AI-assisted content generation (research/memo drafting via LLM) — deferred to post-go-live or a future tranche, requires Bruno approval on provider, cost, and data handling
- External payment provider integration (Stripe, etc.) — deferred until local billing proves itself in real use
- Email/notification system — deferred
- Multi-user RBAC beyond single-operator cockpit — deferred
- Custom domain and DNS — operational decision, not code dependency
- Monitoring/alerting infra beyond healthcheck — deferred to post-go-live ops

## Rules
- Same Vulcanus output contract: what was built, where it is, how to verify, remaining risk, next step.
- Each cycle must pass its local verifier before acceptance.
- No external AI API integration without Bruno's explicit approval.
- No new npm dependencies without Bruno's explicit approval.
- No external services (cloud storage, email, payment) without Bruno's explicit approval.
- No VLH dependency of any kind.
- AI workflow containers are manual-first; automation is a future layer, not a T5 requirement.

## Canonical references
- This file
- `state/zeus-mandate.md`
- `project.yaml`
- `ROADMAP.md`
- `state/decision-log.md`
