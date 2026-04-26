# T8 Closure — Deploy Pipeline

## Date
2026-04-26

## Status
**T8 closed by evidence.** Site live at https://savastanoadvisory.com.br

## What T8 delivered
- **Dockerfile**: multi-stage Node 22 Alpine. Standalone Next.js output, non-root user, `DATA_DIR=/data` env var para SQLite + uploads em Docker volume.
- **docker-compose.production.yml**: app (porta 3000 interna) + Caddy reverse proxy (portas 80/443). Volumes nomeados para dados, TLS certs, config.
- **Caddyfile**: auto-HTTPS via Let's Encrypt para `savastanoadvisory.com.br` + `www`.
- **DNS**: registro A no Registro.br apontando para `212.90.121.236` (Contabo VPS).
- **Deploy script**: `infra/scripts/deploy-production.sh` (package + scp + ssh + build + up).
- **Code changes**: `db.ts` e `documents.ts` aceitam `DATA_DIR` env var para override do path de dados em produção.
- **Containers rodando**: `savastano-advisory-app` + `savastano-advisory-caddy`.
- **COCKPIT_SECRET**: configurado via `.env` no servidor.

## Evidence
- `ping savastanoadvisory.com.br` → `212.90.121.236` ✓
- HTTPS certificate provisioned by Caddy ✓
- Site renders in browser ✓
- `docker ps` shows both containers Up and healthy ✓

## Bugs fixed during deploy
1. Dockerfile COPY de `apps/web/node_modules` — npm workspaces hoist para raiz; removido (commit `81bc9b2`).
2. `.dockerignore` excluía `state/` — página `/health` precisa de `state/risk-log.md` no prerender; removido (commit `2607b02`).

## Deferrals
- **Bootstrap admin em produção**: ainda não executado (aguarda redesign para ter algo apresentável antes de criar o primeiro admin).
- **Backup schedule**: não configurado (cron para copiar o SQLite volume).
- **Monitoring/alerting**: sem healthcheck automatizado.
- **CI/CD**: deploy continua manual via script ou git pull + rebuild no servidor.

## Next
T9 — Redesign visual completo com identidade Savastano (brasão, paleta burgundy/dourado/preto).
