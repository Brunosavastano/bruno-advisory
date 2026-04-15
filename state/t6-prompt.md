# T6 Prompt — Cockpit Auth & RBAC

## Date
2026-04-15

## Status
Authorized by Bruno on 2026-04-15. Active.

## Context
T0–T5 delivered a complete operator-to-client path: independent repo, commercial offer, public intake, CRM + billing lifecycle, client portal, AI-assisted workflows, and release checklist. The cockpit is protected by a single environment secret (`COCKPIT_SECRET`), validated in `apps/web/proxy.ts`.

The audit log records operator actions with `actor_type = 'operator'` but no `actor_id`. This is acceptable for single-operator operation (Bruno only) but blocks:
- individual traceability required by CVM regulation
- granular access revocation (LGPD compliance on operator separation)
- expansion to second operator (assistant, accountant, partner consultant)

T6 replaces the global-secret model with per-user accounts, roles, and session-based authentication, mirroring the portal's session pattern. The `COCKPIT_SECRET` stays active as a fallback during this tranche to prevent lockout during transition — removal is T7 scope.

## Objective
Deliver a production-grade authentication model for the cockpit with:
- per-user accounts (email, password hash, role, active flag)
- role-based access control (admin/operator/viewer)
- individualized audit trail (`actor_id` on every action)
- session-based login (30-day TTL, httpOnly cookie)
- operational CLI for first-admin bootstrap
- minimal admin UI for user management
- preserved backward-compatibility via `COCKPIT_SECRET` fallback with sentinel

T6 does NOT:
- Add 2FA, OAuth, SSO, or password reset by email
- Add rate limiting on login
- Remove `COCKPIT_SECRET` (explicit T7 task)
- Add external auth/identity providers
- Add refresh tokens or session rotation
- Integrate with VLH authentication

## Deliverables (8 cycles)

### Cycle 1 — Schema & scrypt foundation
- Canonical model in `packages/core/src/cockpit-auth-model.ts` (roles enum, session TTL constant, hash format constant)
- SQLite DDL for `cockpit_users` and `cockpit_sessions` via `CREATE TABLE IF NOT EXISTS`
- `ensureCockpitAuthColumns()` ALTER helper for `audit_log.actor_id`
- `apps/web/lib/storage/cockpit-auth.ts` with: `hashPassword`, `verifyPassword`, `createUser`, `getUserByEmail`, `getUserById`, `createSession`, `getSessionByToken`, `deleteSession`, `deleteExpiredSessions`
- Types in `apps/web/lib/storage/types.ts`: `CockpitRole`, `CockpitUser`, `CockpitSession`
- Verifier: scrypt round-trip, user create + lookup, session create + token lookup + expiry check
- No UI or middleware changes yet

### Cycle 2 — Bootstrap admin CLI
- `scripts/bootstrap-admin.ts` reads email + password from argv or stdin (non-echoing)
- Creates user with `role='admin'`, `is_active=1`
- Idempotent: errors explicitly if email exists (no overwrite)
- Prints created user_id (no password echoed back)
- Verifier: temp DB, CLI run twice, second run errors, DB state unchanged

### Cycle 3 — Audit log actor_id signature
- ALTER `audit_log ADD COLUMN actor_id TEXT NULL` via `ensureCockpitAuthColumns`
- `writeAuditLog` signature: optional `actorId?: string | null`
- `AuditLogEntry` type extended with `actorId`
- `listAuditLog` query surfaces new column
- Zero callsite changes yet (additive only)
- Legacy rows keep `actor_id = NULL` (no backfill)
- Verifier: existing entries still read correctly, new entry with `actorId` round-trips

### Cycle 4 — Middleware + requireCockpitSession
- `apps/web/proxy.ts` refactored: cookie-presence-only check for page redirects
- `apps/web/lib/auth/cockpit-session.ts`: `requireCockpitSession(req, allowedRoles?)`
- Cookie parsing from `request.headers.get('cookie')` (same pattern as portal)
- Session lookup via `getSessionByToken` (happens inside route handler, not middleware)
- Fallback: `Authorization: Bearer <COCKPIT_SECRET>` still accepted, synthetic session with `actorId='legacy-secret'`
- Whitelist `/cockpit/login` and `/api/cockpit/auth/*` from middleware redirect
- Verifier: unauth request → 401; valid bearer → 200; valid session cookie → 200; expired session → 401; invalid role → 403

### Cycle 5 — Login / logout API + page
- `POST /api/cockpit/auth/login`: validates email+password, creates session, sets `cockpit_session` cookie (httpOnly, sameSite=lax, path=/, 30-day expiry)
- `POST /api/cockpit/auth/logout`: deletes session row, clears cookie
- `GET /cockpit/login`: form page with email + password fields
- Middleware updated to allow these routes without auth
- Verifier: wrong password → 401; correct → 200 + Set-Cookie; logout → cleared cookie → next request 401

### Cycle 6 — Actor propagation (28 callsites)
- Every cockpit route handler calls `requireCockpitSession()` and extracts `session.actorId`
- All 28 `writeAuditLog` callsites updated to pass `actorId`
- Batched by file: `billing.ts` (5) → `portal.ts` (6) → `leads.ts`, `documents.ts`, `memos.ts`, `checklist.ts`, `recommendations.ts`, `research-workflows.ts`
- Storage function signatures threaded with optional `actorId` param
- `npm run test` (billing test) stays green
- Verifier: perform real cockpit action via session → audit log row has matching `actor_id`

### Cycle 7 — Users admin UI
- `GET /api/cockpit/users` (admin only): list users
- `POST /api/cockpit/users` (admin only): create user (email, password, role, display_name)
- `PATCH /api/cockpit/users/[userId]` (admin only): toggle `is_active`, change role
- `app/cockpit/users/page.tsx`: table + create form
- `app/cockpit/layout.tsx`: shared header with "Logado como: {name} ({role})" + logout button
- 403 guard on admin-only routes for non-admin sessions
- Verifier: operator on admin routes → 403; admin creates user → listed; deactivate user → login 401

### Cycle 8 — Regression + closure
- `infra/scripts/verify-t6-full-regression.sh`: all 12 E2E scenarios from plan
- Existing T5 regression still green
- `state/t6-closure.md`
- `project.yaml`: `tranche_status: done`
- Decision log entry
- Risk log entry

## Gate de saída
Bruno tests: bootstrap admin → login → perform action → audit log shows his actor_id. Wrong password rejected. `COCKPIT_SECRET` fallback still works. No regressions in T5 flows.

## Canonical references
- `T6_auth_rbac_prompt.md`
- `state/t6-opening.md`
- `state/zeus-mandate.md`
- `project.yaml`
- `ROADMAP.md`
- `state/decision-log.md`
