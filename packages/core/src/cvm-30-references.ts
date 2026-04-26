// Mapeamento canônico das referências da Resolução CVM 30/2021 usadas pelo
// módulo de suitability. A separação abaixo é intencional:
// - perfil do cliente: Art. 3º e Art. 4º;
// - classificação de categorias de produtos: Art. 5º;
// - vedações, atualizações e manutenção documental: Arts. 6º, 9º e 14.
//
// Evite usar Art. 5º como referência para dados mínimos do perfil do cliente:
// ele trata da classificação das categorias de produtos, não do questionário
// do cliente.

export const cvm30ClientProfileReferences = {
  objectives: {
    cvmReference: 'CVM-Res-30/2021-Art-3-caput-I-and-§1-I-II-III',
    description:
      'Objetivos de investimento: período em que o cliente deseja manter o investimento, preferências declaradas quanto à assunção de riscos e finalidades do investimento.'
  },
  financial_situation: {
    cvmReference: 'CVM-Res-30/2021-Art-3-caput-II-and-§2-I-II-III',
    description:
      'Situação financeira: valor das receitas regulares declaradas, valor e ativos que compõem o patrimônio e necessidade futura de recursos declarada pelo cliente.'
  },
  knowledge_experience: {
    cvmReference: 'CVM-Res-30/2021-Art-3-caput-III-and-§3-I-II-III-and-§4',
    description:
      'Conhecimento e experiência: familiaridade com produtos, natureza, volume, frequência e período das operações já realizadas, formação acadêmica e experiência profissional, observada a exceção aplicável a clientes pessoa jurídica.'
  },
  liquidity_needs: {
    cvmReference: 'CVM-Res-30/2021-Art-3-§1-I-and-§2-III',
    description:
      'Horizonte de investimento e necessidade futura de recursos declarada pelo cliente.'
  },
  restrictions: {
    cvmReference: 'Internal-IPS-Constraints',
    description:
      'Restrições, vedações, preferências e condicionantes declaradas pelo cliente para fins de política de investimento e revisão humana.'
  }
} as const;

// Mantém compatibilidade com os imports existentes do projeto.
export const cvm30References = cvm30ClientProfileReferences;

export type SuitabilitySectionKey = keyof typeof cvm30ClientProfileReferences;

export const suitabilitySectionKeys = Object.keys(
  cvm30ClientProfileReferences
) as readonly SuitabilitySectionKey[];

export type Cvm30ClientProfileReference =
  (typeof cvm30ClientProfileReferences)[SuitabilitySectionKey];

export const cvm30ProductCategoryReferences = {
  product_category_classification: {
    cvmReference: 'CVM-Res-30/2021-Art-5-caput-and-paragraph-unique-I-II-III-IV',
    description:
      'Classificação das categorias de produtos considerando riscos associados, perfil dos emissores e prestadores de serviços, garantias e prazos de carência.'
  },
  cost_adequacy: {
    cvmReference: 'CVM-Res-30/2021-Art-3-§5',
    description:
      'Consideração dos custos diretos e indiretos, com abstenção de recomendar produtos, serviços ou operações que impliquem custos excessivos e inadequados ao perfil do cliente.'
  }
} as const;

export type ProductCategoryReferenceKey = keyof typeof cvm30ProductCategoryReferences;
export type Cvm30ProductCategoryReference =
  (typeof cvm30ProductCategoryReferences)[ProductCategoryReferenceKey];

export const cvm30OperationalReferences = {
  recommendation_scope: {
    cvmReference: 'CVM-Res-30/2021-Art-1-paragraph-unique-and-Art-2',
    description:
      'O dever de verificação de adequação se aplica a recomendações direcionadas a clientes específicos, inclusive por meio eletrônico, e impede recomendações sem verificação de adequação ao perfil.'
  },
  client_risk_profile_classification: {
    cvmReference: 'CVM-Res-30/2021-Art-4',
    description:
      'Obrigação de avaliar e classificar o cliente em categorias de perfil de risco previamente estabelecidas.'
  },
  recommendation_prohibitions: {
    cvmReference: 'CVM-Res-30/2021-Art-6-I-II-III',
    description:
      'Vedação de recomendação quando produto ou serviço não é adequado, quando faltam informações para identificar o perfil ou quando o perfil está desatualizado.'
  },
  profile_update_obligations: {
    cvmReference: 'CVM-Res-30/2021-Art-9-I-II',
    description:
      'Obrigação de manter informações de perfil atualizadas e reclassificar categorias de valores mobiliários em periodicidade regulatória.'
  },
  recordkeeping: {
    cvmReference: 'CVM-Res-30/2021-Art-14',
    description:
      'Manutenção dos documentos e declarações exigidos pelo prazo mínimo regulatório aplicável.'
  },
  qualified_investor_category: {
    cvmReference: 'CVM-Res-30/2021-Art-12',
    description: 'Critérios regulatórios para enquadramento como investidor qualificado.'
  },
  professional_investor_category: {
    cvmReference: 'CVM-Res-30/2021-Art-11',
    description: 'Critérios regulatórios para enquadramento como investidor profissional.'
  }
} as const;

export type OperationalReferenceKey = keyof typeof cvm30OperationalReferences;
export type Cvm30OperationalReference =
  (typeof cvm30OperationalReferences)[OperationalReferenceKey];

export type CvmReference =
  | Cvm30ClientProfileReference
  | Cvm30ProductCategoryReference
  | Cvm30OperationalReference;
