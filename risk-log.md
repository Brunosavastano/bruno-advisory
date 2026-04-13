# risk-log.md

## Formato
- risco
- severidade
- sinal de alerta
- resposta

## Riscos iniciais

- Acoplamento invisível ao VLH — alta — scripts, segredos ou padrões puxados sem isolamento — separar infra, credenciais e pipelines desde T0
- Overbuild antes de venda — alta — muito tempo em arquitetura e pouco tempo em oferta/site/intake — fechar T1 e T2 cedo
- Billing complexo cedo demais — média — integração travar T3 — escolher fluxo simples e auditável
- Portal crescer antes do CRM — média — cliente entra sem backoffice consistente — manter ordem T3 antes de T4
- IA produzir material não auditável — alta — logs pobres e drafts sem revisão — gate obrigatório de aprovação humana
