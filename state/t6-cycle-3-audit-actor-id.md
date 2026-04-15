# T6 Cycle 3 — Audit log actor_id signature

## What was built
- Parâmetro aditivo `actorId?: string | null` em `writeAuditLog({ ... })` (default `null`). Zero callsites existentes alterados (19 callers em 8 arquivos continuam funcionando idênticos).
- `INSERT INTO audit_log` agora inclui a coluna `actor_id` e passa `normalizeActorId(params.actorId)` — a função helper já existia no read-path desde Cycle 1 e é reaproveitada aqui para simetria de normalização.
- Read-path de `listAuditLog` / `listAllAuditLog` permanece intacto (já lia `actor_id AS actorId` desde Cycle 1).
- Verifier local repetível com 4 camadas de prova: source-text, schema probe, read-path, round-trip.

## Where it is
- Assinatura + INSERT: `apps/web/lib/storage/audit-log.ts`
- Verifier shell: `infra/scripts/verify-t6-cycle-3-local.sh`
- Verifier TS: `infra/scripts/verifiers/t6-cycle-3.ts`
- Evidence: `state/evidence/T6-cycle-3/summary-local.json`

## How to verify
1. `bash infra/scripts/verify-t6-cycle-3-local.sh`
2. Confirmar `ok: true` em `state/evidence/T6-cycle-3/summary-local.json`
3. Confirmar no summary:
   - `signatureHasActorId: true`
   - `insertIncludesActorIdColumn: true`
   - `insertPassesNormalizedActorId: true`
   - `callsiteCount: 19` e `callsitesWithActorId: 0` (contrato "nenhum caller passa actorId ainda")
   - `existingCallerActorIdAllNull: true` (stage transition grava `actor_id` NULL)
   - `readPathHasActorIdField: true` (response sempre traz `actorId`)
   - `readPathAllNullForExistingCallers: true`
   - `probeRowActorIdRoundTrip: true` (string persiste e round-trippa)
   - `explicitNullRoundTrip: true`
4. `npm run typecheck` limpo
5. Inner loop do test suite verde (13/13 lógicos; ruído Windows EPERM no shutdown da tempdir é pré-existente e não bloqueia)

## Design decisions
- **Parâmetro opcional sem quebra de callsite.** `actorId?: string | null` default `null` garante que TODO caller existente compila e roda sem alteração. Nenhum `as any` em lugar nenhum.
- **`normalizeActorId` reaproveitado.** O helper já existia no read-path (de Cycle 1). Chamá-lo no write-path garante que `""`, `"   "` e `undefined` viram NULL em vez de string vazia — mesma semântica que o read espera.
- **Prova híbrida source+runtime.** Signature e INSERT são provados por inspeção textual (regex); a quantidade de callsites sem `actorId` é provada contando AST-like (regex de bloco `writeAuditLog({...})`); o comportamento real é provado via rota compilada (stage transition) + INSERT direto via `DatabaseSync` para simular caller futuro. Não precisou adicionar rota de probe à superfície produtiva.
- **Guard de contrato no próprio verifier.** Se QUALQUER callsite futuro passar `actorId:` antes do Cycle 6, o verifier do Cycle 3 falha com mensagem explícita ("Cycle 3 contract violated"). Evita que alguém puxe propagação prematura.

## Anti-scope cumprido
- Zero callsites alterados (19 callers permanecem idênticos)
- Sem mudança no read-path (já funcionava)
- Sem middleware (Ciclo 4)
- Sem login/logout (Ciclo 5)
- Sem propagação de actor real (Ciclo 6)
- Sem UI (Ciclo 7)
- Sem mudança em `writeAuditLog`'s shape de erros/throws

## Remaining risk
- `normalizeActorId` converte strings vazias/whitespace em NULL silenciosamente. Se um caller futuro passar string sanitizada incorretamente, vai gravar NULL em vez de falhar. É o trade-off certo (lenient write, consistente com o resto do storage) mas vale anotar.
- Nenhum caller real ainda exercita `actorId: string`. O primeiro será o fallback `legacy-secret` em Cycle 4 (middleware), seguido pelos 19 callsites em Cycle 6.

## Next best step
- Abrir Ciclo 4: refatorar middleware para expor `requireCockpitSession()` (helper que roda dentro das route handlers, NÃO no Edge runtime do middleware) + manter `COCKPIT_SECRET` como fallback que passa `actorId: 'legacy-secret'` quando acionado. Middleware Edge só valida presença de cookie ou header, delegando validação real às routes.
