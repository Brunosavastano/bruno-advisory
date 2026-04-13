# compliance_review.md
Status: review curto  
Escopo: state/  
Objeto: fechamento da surface pública de compliance do V1

## Conclusão

A surface pública de compliance do V1 está **fechada em nível canônico de produto** por meio de um único documento: `COMPLIANCE_PACKAGE.md`.

Esse pacote já consolida, em português e com desenho regulatório brasileiro, os quatro blocos que estavam faltando:
1. política de privacidade;
2. termos / condições gerais;
3. disclaimer regulatório;
4. requisitos da página de contato / conversa inicial.

## Decisões operacionais fixadas

- O pacote público de compliance ficará em **um único arquivo canônico**.
- A conversa inicial foi fechada como **triagem e aderência**, não como consultoria personalizada.
- O serviço regulado começa apenas após **contrato escrito + coleta das informações necessárias**.
- O formulário público foi limitado a **dados mínimos**.
- O V1 não pedirá documentos, KYC completo ou uploads livres na página pública.
- O texto público assume **PF premium** como foco principal.
- O uso de IA foi enquadrado como **apoio operacional e analítico**, sem afastar responsabilidade profissional.

## O que ainda precisa ser preenchido antes do deploy

- nome completo final na forma pública desejada;
- dado de identificação CVM a exibir no site;
- e-mail de privacidade;
- endereço profissional;
- lista final de categorias de provedores efetivamente usados;
- política real de cookies/analytics do stack final;
- foro desejado;
- eventual copy comercial final da landing page.

## Riscos remanescentes

1. **Drift comercial**  
   Se a landing page prometer mais do que o pacote permite, o site volta a ficar sujo.

2. **Drift de stack**  
   Se forem adicionados analytics, pixels, chatbot externo, upload público ou IA externa não prevista, a política de privacidade precisará ser atualizada.

3. **Drift de oferta**  
   Se o foco migrar de PF premium para PJ ativa, o pacote precisará de revisão.

4. **Drift operacional**  
   Se a conversa inicial virar, na prática, recomendação individualizada, haverá desalinhamento entre copy e operação.

## Gate de fechamento

Considerar esta frente realmente fechada quando:
- `COMPLIANCE_PACKAGE.md` estiver no repo;
- a landing page, rodapé e form usarem exatamente a lógica deste pacote;
- os placeholders estiverem preenchidos;
- houver leitura humana final antes do deploy.

Fechamento recomendado: **ACEITAR COM PENDÊNCIAS DE PREENCHIMENTO**, sem necessidade de reabrir escopo substantivo.
