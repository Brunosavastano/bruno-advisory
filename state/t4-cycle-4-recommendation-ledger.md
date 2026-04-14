# T4 Cycle 4, recommendation ledger por lead

## Objective
Entregar ledger de recomendações por lead com criação real no cockpit, persistência auditável em SQLite e leitura read-only no portal autenticado, sem widen para flags internos ou fechamento da tranche.

## What changed
- Bruno cria recomendações/memos no cockpit por lead.
- Cada item persiste com rastreabilidade mínima exigida:
  - `title`
  - `body`
  - `date` (persistido como `recommendation_date`)
  - `createdAt`
  - `createdBy`
  - `publishedAt`
  - `visibility`
- O portal do cliente expõe apenas recomendações publicadas do próprio `leadId` da sessão.
- O ledger no portal é read-only.
- O isolamento foi provado com dois leads e duas sessões separadas.

## Where
- `packages/core/src/recommendation-model.ts`
- `apps/web/lib/storage/recommendations.ts`
- `apps/web/lib/storage/db.ts`
- `apps/web/app/api/cockpit/leads/[leadId]/recommendations/route.ts`
- `apps/web/app/api/cockpit/leads/[leadId]/recommendations/[recommendationId]/route.ts`
- `apps/web/app/api/portal/recommendations/route.ts`
- `apps/web/app/cockpit/leads/[leadId]/page.tsx`
- `apps/web/app/portal/ledger/page.tsx`
- `apps/web/app/portal/dashboard/page.tsx`
- `infra/scripts/verify-t4-cycle-4-local.sh`

## Verify
```bash
npm run typecheck
mkdir -p apps/web/.next/static && npm run build
bash infra/scripts/verify-t4-cycle-4-local.sh
```

## Acceptance evidence
- criação real no cockpit validada por handler compilado
- publicação e leitura real no portal do lead correto
- persistência auditável em `lead_recommendations`
- prova explícita de isolamento por lead e sessão
- nenhuma dependência nova, nenhum provider externo, nenhum acoplamento com VLH
