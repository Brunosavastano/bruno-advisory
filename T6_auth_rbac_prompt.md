# T6 — Cockpit Auth & RBAC Prompt

## Dono da tranche
Zeus

## Executor principal
Vulcanus

## Missão
Substituir o modelo de autenticação do cockpit baseado em segredo global único (`COCKPIT_SECRET`) por contas individuais com papéis (admin, operator, viewer) e rastreabilidade individualizada no audit log, preservando o fallback do segredo durante a transição.

## Entregáveis mínimos
- tabelas `cockpit_users` e `cockpit_sessions` no SQLite
- coluna `actor_id` em `audit_log` preservando registros legados
- hashing de senha com scrypt nativo (sem dependência externa)
- helper `requireCockpitSession(req, allowedRoles?)` para route handlers
- página `/cockpit/login` + endpoints `login`/`logout`
- CLI `scripts/bootstrap-admin.ts` para provisionar o primeiro admin
- propagação de `actorId` nos 28 callsites de `writeAuditLog`
- UI `/cockpit/users` restrita a admin + layout com header/logout
- fallback `COCKPIT_SECRET` ativo registrando `actor_id = 'legacy-secret'`

## Sucesso
A tranche fecha quando:
1. Bruno consegue logar com email/senha e realizar ações que aparecem no audit log com seu `actor_id` real
2. Tentativa de login com senha errada retorna 401
3. Usuário com papel `operator` é bloqueado (403) em rotas restritas a `admin`
4. Sessão expirada não autentica novas requests
5. `COCKPIT_SECRET` ainda funciona como bearer fallback e registra sentinel `legacy-secret`
6. Regressão completa (T5 + T6) passa sem regressão
7. Script de bootstrap é idempotente e recuperável

## Fracasso
A tranche falha se:
- Bruno ficar trancado fora sem caminho de recuperação
- Registros antigos de audit log se corromperem na migração
- Middleware Edge tentar acessar SQLite (incompatibilidade de runtime)
- Testes existentes (billing) quebrarem
- Senhas forem armazenadas em texto plano ou hash fraco

## Instrução para Vulcanus
Schema primeiro, UI depois. Preserve o fallback do segredo até o fim da tranche. Cada ciclo deve produzir evidência local com `ok: true` antes do próximo. Não adicione dependências externas de hashing. Não tente fazer DB lookup no middleware — a validação real vive dentro das route handlers.
