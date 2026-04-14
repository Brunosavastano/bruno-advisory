# Zeus Mandate — T3.5 Hardening

## Date
2026-04-14 00:55 GMT-3

## Status
T3.5 is OPEN. Current cycle: 5.

## Completed
- Cycle 1: Storage split ✅
- Cycle 2: Cockpit auth (proxy.ts, COCKPIT_SECRET) ✅
- Cycle 3: Legacy settlement route removed ✅
- Cycle 4: 13 billing tests, all passing ✅

## Current cycle target
**Cycle 5: CRM field expansion**

Add the missing T1-defined CRM fields to the lead schema. These are needed for T4 (client portal/onboarding).

Fields to add (all nullable/optional):
- `cidade_estado` (string) — city/state of lead
- `ocupacao_perfil` (string) — occupation/profile
- `nivel_de_fit` (string: 'alto' | 'medio' | 'baixo' | null)
- `motivo_sem_fit` (string) — reason if no fit
- `owner` (string) — internal owner name
- `data_call_qualificacao` (string: ISO date or null)
- `resumo_call` (string) — call summary
- `interesse_na_oferta` (string: 'alto' | 'medio' | 'baixo' | null)
- `checklist_onboarding` (string: JSON-serialized array or null)
- `cadencia_acordada` (string) — agreed cadence
- `proximo_passo` (string) — next step
- `risco_de_churn` (string: 'alto' | 'medio' | 'baixo' | null)

Implementation approach:
1. Add fields to the SQLite schema in `apps/web/lib/storage/db.ts` (ALTER TABLE or recreation)
2. Add to the lead type in `apps/web/lib/storage/types.ts`
3. Add read/write in `apps/web/lib/storage/leads.ts`
4. Expose a PATCH route: `apps/web/app/api/cockpit/leads/[leadId]/crm-fields/route.ts`
5. Display new fields in the lead detail surface `apps/web/app/cockpit/leads/[leadId]/page.tsx`

Deliverables:
- Updated schema, types, storage
- New PATCH route `api/cockpit/leads/[leadId]/crm-fields`
- Updated lead detail page
- `infra/scripts/verify-t35-cycle-5-local.sh`
- `state/t35-cycle-5-crm-fields.md`
- `state/evidence/T3.5-cycle-5/summary-local.json`

Rules:
- No third-party deps
- All new fields nullable/optional
- 5-part output contract
