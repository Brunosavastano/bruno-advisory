# T6 Opening — Cockpit Auth & RBAC

## Date
2026-04-15

## Authorization
Bruno explicitly authorized T6 on 2026-04-15 after T5 was confirmed closed by evidence (commit `63d0d31`).

## Scope
T6 replaces the global `COCKPIT_SECRET` model with per-user accounts, password hashing (scrypt), role-based access control (admin/operator/viewer), session-based authentication, and individualized audit log traceability. `COCKPIT_SECRET` stays as a fallback for this tranche (removed in T7).

T6 does NOT:
- Add 2FA, OAuth, SSO, password reset by email, or refresh tokens
- Add rate limiting on login
- Add external auth/identity providers
- Remove `COCKPIT_SECRET` (T7 task)
- Integrate with VLH authentication

## Deliverables (8 cycles)

See `state/t6-prompt.md` for full cycle specifications.

| # | Name |
|---|------|
| 1 | Schema & scrypt foundation |
| 2 | Bootstrap admin CLI |
| 3 | Audit log actor_id signature |
| 4 | Middleware + requireCockpitSession |
| 5 | Login / logout API + page |
| 6 | Actor propagation (28 callsites) |
| 7 | Users admin UI |
| 8 | Regression + closure |

## Gate de saída
Bruno can bootstrap his admin account, log in with email/password, perform cockpit actions that appear in the audit log with his actor_id, and a non-admin user (if created) is blocked from admin routes with 403. `COCKPIT_SECRET` fallback still functions. Full regression (T5 flows + T6 scenarios) passes locally.

## Canonical references
- `T6_auth_rbac_prompt.md`
- `state/t6-prompt.md`
- `state/zeus-mandate.md`
- `project.yaml`
- `ROADMAP.md`
- `state/decision-log.md`
