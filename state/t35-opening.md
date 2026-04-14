# T3.5 Opening — Hardening Tranche

## Date
2026-04-14 00:00 GMT-3

## Authorization
Bruno explicitly authorized this tranche by listing the issues and asking Zeus to orchestrate the fix.

## Scope
T3.5 is a hardening tranche between T3 (CRM/billing) and T4 (client portal).
It does NOT add features. It hardens what exists.

## Deliverables (6 cycles)

### Cycle 1 — Split intake-storage.ts
- Extract from the 2305-line monolith into domain modules:
  - `apps/web/lib/storage/db.ts` — DB init/connection
  - `apps/web/lib/storage/leads.ts` — lead CRUD + commercial stage
  - `apps/web/lib/storage/notes.ts` — notes
  - `apps/web/lib/storage/tasks.ts` — tasks
  - `apps/web/lib/storage/billing.ts` — billing activation, charges, settlements, progression, overview
  - `apps/web/lib/storage/intake.ts` — intake form + events
- `apps/web/lib/intake-storage.ts` becomes a re-export barrel or is deleted
- All existing routes must still work (no functional change)
- Verifier: `infra/scripts/verify-t35-cycle-1-local.sh`

### Cycle 2 — Basic auth on cockpit
- Add a shared-secret or basic-auth middleware to all `/cockpit/*` and `/api/cockpit/*` routes
- Auth credential comes from env var `COCKPIT_SECRET`
- Unauthenticated requests to cockpit paths → 401
- Public routes (/intake, /api/intake, /, /como-funciona, etc.) remain open
- Verifier: `infra/scripts/verify-t35-cycle-2-local.sh`

### Cycle 3 — Remove legacy settlement route
- Delete `apps/web/app/api/cockpit/leads/[leadId]/billing-settlements/route.ts` (the lead-level implicit one)
- Keep only `billing-settlements/[chargeId]/route.ts` (the targeted one)
- Verify no internal references break
- Verifier: `infra/scripts/verify-t35-cycle-3-local.sh`

### Cycle 4 — Core billing tests
- Add at least one test per critical billing path using Node's built-in test runner (`node:test`):
  - Billing readiness gate
  - Billing activation
  - Charge creation
  - Settlement (targeted)
  - Charge progression
  - Settlement blocks (already-settled, foreign charge, missing charge)
- Tests must import canonical models from `packages/core/src/`
- Test script: `npm test` in root `package.json`
- Verifier: `infra/scripts/verify-t35-cycle-4-local.sh`

### Cycle 5 — CRM field expansion
- Add the missing T1-defined CRM fields to the lead schema:
  - `cidade_estado`, `ocupacao_perfil`, `nivel_de_fit`, `motivo_sem_fit`
  - `owner`, `data_call_qualificacao`, `resumo_call`, `interesse_na_oferta`
  - `checklist_onboarding`, `cadencia_acordada`, `proximo_passo`, `risco_de_churn`
- Fields can be nullable and optional initially
- Lead detail surface must display them
- Verifier: `infra/scripts/verify-t35-cycle-5-local.sh`

### Cycle 6 — Push + close
- Git add + commit + push all T3.5 work
- Update `project.yaml`: `tranche_status: done`
- Create `state/t35-closure.md` with evidence list
- Verifier: manual (Zeus audits the push)

## Rules
- Same Vulcanus output contract: what was built, where it is, how to verify, remaining risk, next step.
- Each cycle must pass its local verifier before acceptance.
- No feature work. No new UI pages. No new API routes (except removing one).
- No third-party dependencies without asking Bruno.

## Canonical references
- This file
- `state/zeus-mandate.md` (updated to T3.5)
- `project.yaml` (updated to T3.5)
