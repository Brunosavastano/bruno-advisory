# T7 Cycle 2 — Rebrand repo (Bruno Advisory → Savastano Advisory)

## What was built
- **Metadata atualizado**: `project.yaml` (`name: Savastano Advisory`, `brand`, `domain`, `cvm_code`), `state: active_tranche: T7, tranche_status: active, stage_gate: rebrand_compliance`; root `package.json` (`savastano-advisory`); workspace scoped names `@savastano-advisory/web`, `@savastano-advisory/core`, `@savastano-advisory/ui`.
- **56 arquivos de código** com import `@bruno-advisory/*` → `@savastano-advisory/*` (bulk sed, zero residual).
- **UI pública rebrandada**: `layout.tsx` metadata.title, `page.tsx` hero badge + copy, `site-shell.tsx` header brand + footer disclaimer. Footer agora inclui: "Savastano Advisory é nome fantasia de Bruno Savastano, consultor de valores mobiliários autorizado pela CVM (código 004503-0)".
- **Páginas secundárias**: `como-funciona`, `para-quem-e`, `privacidade`, `termos`, `portal/login` — todas com "Savastano Advisory" no título/copy onde antes era "Bruno Advisory".
- **DB path**: `apps/web/lib/storage/db.ts` → `savastano-advisory-dev.sqlite3`.
- **Env templates**: `.env.example` e `infra/env.production.example` com DB path, backup path, APP_BASE_URL atualizados.
- **tsconfig.base.json**: paths `@savastano-advisory/core/*` e `@savastano-advisory/ui/*`.
- **README.md**: "Savastano Advisory" no título.
- **Preservação intencional**: `state/` e `docs/` históricos permanecem intactos com referências "Bruno Advisory" (são registros históricos, não superfície pública).
- **Identidade legal**: "Bruno Savastano" permanece em TODA referência legal/regulatória (footer disclaimer, página de privacidade, termos, landing "relação direta"). Não foi tocada.

## Verification
- `npm run typecheck` limpo após atualização do tsconfig paths
- `npm run build -w @savastano-advisory/web` green
- Inner test suite 13/13 lógicos
- `grep -ri "bruno.advisory\|@bruno-advisory" apps/ packages/ scripts/ project.yaml package.json` em superfície produtiva → zero resultados
- 4 ocorrências legítimas de "Bruno Savastano" (não brand, identidade legal) em: `page.tsx:89`, `privacidade/page.tsx:36`, `site-shell.tsx:38`, `termos/page.tsx:31` — todas corretas

## Files touched
- `project.yaml`
- `package.json` (root)
- `apps/web/package.json`
- `packages/core/package.json`
- `packages/ui/package.json`
- `tsconfig.base.json`
- `README.md`
- `apps/web/app/layout.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/site-shell.tsx`
- `apps/web/app/como-funciona/page.tsx`
- `apps/web/app/para-quem-e/page.tsx`
- `apps/web/app/privacidade/page.tsx`
- `apps/web/app/termos/page.tsx`
- `apps/web/app/portal/login/page.tsx`
- `apps/web/lib/storage/db.ts`
- `.env.example`
- `infra/env.production.example`
- 56 `.ts`/`.tsx` files with import path change (bulk)
