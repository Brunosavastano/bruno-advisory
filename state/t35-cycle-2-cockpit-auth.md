# T3.5 Cycle 2 — Cockpit auth básica

## O que foi feito
- Endureci a superfície protegida do cockpit com gate por `COCKPIT_SECRET` no `apps/web/middleware.ts`.
- As rotas `/cockpit/*` e `/api/cockpit/*` agora exigem segredo válido.
- O segredo pode ser enviado por `Authorization: Basic ...`, `Authorization: Bearer ...` ou `x-cockpit-secret`, mantendo a validação centralizada no middleware.
- Sem segredo válido, as rotas protegidas respondem `401`.
- As rotas públicas do canon permanecem fora do matcher do middleware e seguem abertas.

## Onde está
- `apps/web/proxy.ts`
- `infra/scripts/verify-t35-cycle-2-local.sh`
- `state/evidence/T3.5-cycle-2/summary-local.json`

## Como verificar
- `bash infra/scripts/verify-t35-cycle-2-local.sh`
- Confirmar no JSON de evidência:
  - `protectedChecks.cockpitPageWithoutSecret.status = 401`
  - `protectedChecks.cockpitApiWithoutSecret.status = 401`
  - `protectedChecks.cockpitPageWithSecret.next = true`
  - `protectedChecks.cockpitApiWithSecret.next = true`
  - todas as entradas de `publicRouteChecks` com `next = true`

## O que falta
- Seguir para o próximo ciclo de hardening sem abrir escopo novo.
- Em produção real, decidir se o canal oficial será Basic auth puro ou header secreto, mas sem mudar o gate funcional desta tranche.
