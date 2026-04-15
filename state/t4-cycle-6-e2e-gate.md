# T4 Cycle 6, end-to-end gate

## Objective
Provar localmente, com artefatos reais do T4, o fluxo ponta a ponta do cliente e o fluxo operacional do cockpit antes do fechamento definitivo da tranche.

## What changed
- Verificador unificado `infra/scripts/verify-t4-cycle-6-local.sh` criado para executar o gate E2E completo em raiz temporária isolada.
- Fluxo cliente coberto com handlers reais compilados: invite login, checklist completion, document upload e leitura do ledger publicado.
- Fluxo operador coberto com handlers reais compilados: create invite, revoke invite, leitura de uploads no cockpit, create/publish recommendation e leitura do overview de pending flags.
- Auditoria local em SQLite confirma persistência de checklist, documento, recommendation, pending flag e revogação sem sessões órfãs.
- Prova explícita de invisibilidade das pending flags no portal foi gravada na evidência do ciclo.

## Where
- `infra/scripts/verify-t4-cycle-6-local.sh`
- `state/evidence/T4-cycle-6/summary-local.json`
- `state/t4-closure.md`
- `project.yaml`

## Verify
```bash
npm run typecheck
bash infra/scripts/verify-t4-cycle-6-local.sh
```

## Gate result
- Cliente: fluxo completo validado.
- Operador: fluxo completo validado.
- Evidência local auditável: validada.
- Sem dependências novas, sem provider externo, sem acoplamento com VLH.
- Fechamento da tranche mantido porque o verificador passou sem lacunas bloqueantes.
