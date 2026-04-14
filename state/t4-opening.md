# T4 Opening — Portal do Cliente e Ledger

## Date
2026-04-14 05:20 GMT-3

## Authorization
Bruno explicitly authorized T4 on 2026-04-14 after T3.5 was confirmed closed by evidence.

## Scope
T4 delivers the private client portal with the minimum functional set for onboarding and ongoing relationship.

T4 does NOT:
- Open external billing providers
- Build marketing or public-facing content
- Integrate third-party email/auth services

## Deliverables (6 cycles)

### Cycle 1 — Client auth skeleton
- Invite-code based authentication (no email infra required)
- Dedicated portal routes under `/portal/*`
- Client session managed via cookie (separate from cockpit `COCKPIT_SECRET`)
- Bruno can create/revoke invite codes from cockpit
- Unauthenticated `/portal/*` requests redirect to `/portal/login`
- Verifier: `infra/scripts/verify-t4-cycle-1-local.sh`

### Cycle 2 — Client dashboard + onboarding checklist
- Client sees their own dashboard after login
- Onboarding checklist: Bruno defines items; client sees status and can mark complete
- Client sees only their own data (isolated by session/leadId)
- Verifier: `infra/scripts/verify-t4-cycle-2-local.sh`

### Cycle 3 — Document upload
- Client can upload files (stored locally under `data/dev/uploads/<leadId>/`)
- Metadata persisted in DB (filename, size, uploadedAt, status)
- Bruno sees uploaded documents in cockpit lead detail
- Verifier: `infra/scripts/verify-t4-cycle-3-local.sh`

### Cycle 4 — Recommendation ledger
- Bruno creates memos/recommendations in cockpit (title + body + date)
- Client sees their ledger in the portal (read-only)
- Ledger entries persisted in DB with traceability
- Verifier: `infra/scripts/verify-t4-cycle-4-local.sh`

### Cycle 5 — Internal pending flags + Bruno overview
- Bruno can set/clear internal flags per client (e.g., "pending_document", "pending_call")
- Bruno-facing view lists all clients with pending flags
- Client does NOT see these flags
- Verifier: `infra/scripts/verify-t4-cycle-5-local.sh`

### Cycle 6 — End-to-end proof + push + close
- End-to-end verifier: client logs in → completes checklist item → uploads document → sees ledger entry
- Bruno verifier: creates invite → sees upload → creates recommendation → views pending flags
- Git add + commit + push all T4 work
- Update `project.yaml`: `tranche_status: done`
- Create `state/t4-closure.md`
- Verifier: `infra/scripts/verify-t4-cycle-6-local.sh` (automated e2e) + manual push audit

## Rules
- Same Vulcanus output contract: what was built, where it is, how to verify, remaining risk, next step.
- Each cycle must pass its local verifier before acceptance.
- No external auth providers (no NextAuth, Clerk, Auth0 etc.) without Bruno's explicit approval.
- No external file storage (no S3, Cloudinary etc.) without Bruno's explicit approval.
- No new npm dependencies without Bruno's explicit approval.
- Client-facing routes must be clearly separated from cockpit routes.

## Canonical references
- This file
- `state/zeus-mandate.md`
- `project.yaml`
- `ROADMAP.md`
- `state/decision-log.md`
- `T4_portal_prompt.md`
