import { cvm30References, type SuitabilitySectionKey } from './cvm-30-references';

// Questionário-padrão V1 (v1.2026-04). Hardcoded em TS por ora — migrar
// para tabela suitability_questionnaire_versions quando V2 surgir.
//
// A propriedade scoringRole separa perguntas que efetivamente pontuam risco
// de perguntas de captura regulatória, restrições e flags de revisão.
// Isso evita que, por exemplo, uma preferência ESG ou uma vedação a offshore
// distorça artificialmente o perfil de risco do cliente.
//
// Os pesos 1-5 só alimentam o scoring quando scoringRole='risk_score'.
// Para data_capture, constraint e review_flag, o peso é mantido apenas para
// facilitar evolução futura, mas é ignorado pelo motor de scoring V1.

export const suitabilityQuestionnaireVersion = 'v1.2026-04' as const;

export type SuitabilityQuestionInputType = 'single_select' | 'multi_select';

export type SuitabilityQuestionScoringRole =
  | 'risk_score'
  | 'constraint'
  | 'data_capture'
  | 'review_flag';

export type SuitabilityQuestionOption = {
  readonly value: string;
  readonly label: string;
  readonly weight: 1 | 2 | 3 | 4 | 5;
};

export type SuitabilityQuestion = {
  readonly id: string;
  readonly prompt: string;
  readonly inputType: SuitabilityQuestionInputType;
  readonly scoringRole: SuitabilityQuestionScoringRole;
  readonly cvmReference?: string;
  readonly options: readonly SuitabilityQuestionOption[];
};

export type SuitabilitySectionDefinition = {
  readonly key: SuitabilitySectionKey;
  readonly cvmReference: string;
  readonly description: string;
  readonly questions: readonly SuitabilityQuestion[];
};

const objectives: SuitabilitySectionDefinition = {
  key: 'objectives',
  cvmReference: cvm30References.objectives.cvmReference,
  description: cvm30References.objectives.description,
  questions: [
    {
      id: 'objectives_horizon',
      prompt: 'Em quanto tempo pretende usar a maior parte dos recursos investidos?',
      inputType: 'single_select',
      scoringRole: 'risk_score',
      cvmReference: 'CVM-Res-30/2021-Art-3-§1-I',
      options: [
        { value: 'lt_1y', label: 'Menos de 1 ano', weight: 1 },
        { value: '1_3y', label: 'Entre 1 e 3 anos', weight: 2 },
        { value: '3_5y', label: 'Entre 3 e 5 anos', weight: 3 },
        { value: '5_10y', label: 'Entre 5 e 10 anos', weight: 4 },
        { value: 'gt_10y', label: 'Mais de 10 anos', weight: 5 }
      ]
    },
    {
      id: 'objectives_primary_goal',
      prompt: 'Qual o objetivo principal do investimento?',
      inputType: 'single_select',
      scoringRole: 'risk_score',
      cvmReference: 'CVM-Res-30/2021-Art-3-§1-III',
      options: [
        { value: 'preservar', label: 'Preservar capital', weight: 1 },
        { value: 'renda', label: 'Gerar renda recorrente', weight: 2 },
        { value: 'equilibrio', label: 'Equilíbrio entre renda e crescimento', weight: 3 },
        { value: 'crescimento', label: 'Crescimento do patrimônio', weight: 4 },
        { value: 'multiplicar', label: 'Multiplicar o patrimônio aceitando volatilidade', weight: 5 }
      ]
    },
    {
      id: 'objectives_loss_tolerance',
      prompt: 'Qual perda temporária você aceitaria em 12 meses sem reagir?',
      inputType: 'single_select',
      scoringRole: 'risk_score',
      cvmReference: 'CVM-Res-30/2021-Art-3-§1-II',
      options: [
        { value: 'zero', label: 'Nenhuma — não aceito perdas', weight: 1 },
        { value: 'lt_5', label: 'Até 5%', weight: 2 },
        { value: 'lt_15', label: 'Até 15%', weight: 3 },
        { value: 'lt_30', label: 'Até 30%', weight: 4 },
        { value: 'gt_30', label: 'Acima de 30%', weight: 5 }
      ]
    },
    {
      id: 'objectives_purpose',
      prompt: 'A finalidade dos recursos é:',
      inputType: 'single_select',
      scoringRole: 'risk_score',
      cvmReference: 'CVM-Res-30/2021-Art-3-§1-III',
      options: [
        { value: 'reserva', label: 'Reserva de emergência', weight: 1 },
        { value: 'objetivo_curto', label: 'Objetivo definido em até 3 anos', weight: 2 },
        { value: 'aposentadoria', label: 'Complemento de aposentadoria', weight: 3 },
        { value: 'patrimonio', label: 'Construção de patrimônio de longo prazo', weight: 4 },
        { value: 'sucessao', label: 'Sucessão / transferência intergeracional', weight: 5 }
      ]
    }
  ]
};

const financialSituation: SuitabilitySectionDefinition = {
  key: 'financial_situation',
  cvmReference: cvm30References.financial_situation.cvmReference,
  description: cvm30References.financial_situation.description,
  questions: [
    {
      id: 'financial_regular_income_range',
      prompt: 'Qual sua faixa de receita regular mensal declarada?',
      inputType: 'single_select',
      scoringRole: 'data_capture',
      cvmReference: 'CVM-Res-30/2021-Art-3-§2-I',
      options: [
        { value: 'lt_5k', label: 'Até R$ 5 mil', weight: 1 },
        { value: '5_15k', label: 'R$ 5 mil a R$ 15 mil', weight: 2 },
        { value: '15_50k', label: 'R$ 15 mil a R$ 50 mil', weight: 3 },
        { value: '50_150k', label: 'R$ 50 mil a R$ 150 mil', weight: 4 },
        { value: 'gt_150k', label: 'Acima de R$ 150 mil', weight: 5 }
      ]
    },
    {
      id: 'financial_income_stability',
      prompt: 'Como descreve a estabilidade da sua renda atual?',
      inputType: 'single_select',
      scoringRole: 'risk_score',
      cvmReference: 'CVM-Res-30/2021-Art-3-§2-I',
      options: [
        { value: 'instavel', label: 'Instável / variável mês a mês', weight: 1 },
        { value: 'razoavel', label: 'Razoavelmente estável com sazonalidade', weight: 2 },
        { value: 'estavel', label: 'Estável (CLT/funcionalismo/aposentadoria)', weight: 3 },
        { value: 'multiplas', label: 'Múltiplas fontes estáveis', weight: 4 },
        { value: 'patrimonial', label: 'Renda patrimonial dominante', weight: 5 }
      ]
    },
    {
      id: 'financial_total_wealth_range',
      prompt: 'Qual sua faixa de patrimônio total aproximado?',
      inputType: 'single_select',
      scoringRole: 'data_capture',
      cvmReference: 'CVM-Res-30/2021-Art-3-§2-II',
      options: [
        { value: 'lt_100k', label: 'Até R$ 100 mil', weight: 1 },
        { value: '100k_500k', label: 'R$ 100 mil a R$ 500 mil', weight: 2 },
        { value: '500k_1m', label: 'R$ 500 mil a R$ 1 milhão', weight: 3 },
        { value: '1m_10m', label: 'R$ 1 milhão a R$ 10 milhões', weight: 4 },
        { value: 'gt_10m', label: 'Acima de R$ 10 milhões', weight: 5 }
      ]
    },
    {
      id: 'financial_asset_composition',
      prompt: 'Quais ativos compõem majoritariamente seu patrimônio?',
      inputType: 'multi_select',
      scoringRole: 'data_capture',
      cvmReference: 'CVM-Res-30/2021-Art-3-§2-II',
      options: [
        { value: 'cash_equivalents', label: 'Caixa / renda fixa líquida', weight: 3 },
        { value: 'real_estate', label: 'Imóveis', weight: 3 },
        { value: 'business_equity', label: 'Participações societárias', weight: 3 },
        { value: 'marketable_securities', label: 'Valores mobiliários', weight: 3 },
        { value: 'pension_assets', label: 'Previdência', weight: 3 },
        { value: 'offshore_assets', label: 'Ativos no exterior', weight: 3 },
        { value: 'other', label: 'Outros', weight: 3 }
      ]
    },
    {
      id: 'financial_emergency_reserve',
      prompt: 'Quantos meses de despesas você cobre com reserva de emergência?',
      inputType: 'single_select',
      scoringRole: 'risk_score',
      cvmReference: 'CVM-Res-30/2021-Art-3-§2-III',
      options: [
        { value: 'lt_1', label: 'Menos de 1 mês', weight: 1 },
        { value: '1_3', label: '1 a 3 meses', weight: 2 },
        { value: '3_6', label: '3 a 6 meses', weight: 3 },
        { value: '6_12', label: '6 a 12 meses', weight: 4 },
        { value: 'gt_12', label: 'Mais de 12 meses', weight: 5 }
      ]
    },
    {
      id: 'financial_invest_share',
      prompt: 'Qual fração do patrimônio total você pretende investir conosco?',
      inputType: 'single_select',
      scoringRole: 'risk_score',
      cvmReference: 'CVM-Res-30/2021-Art-3-§2-II',
      options: [
        { value: 'gt_75', label: 'Mais de 75%', weight: 1 },
        { value: '50_75', label: '50% a 75%', weight: 2 },
        { value: '25_50', label: '25% a 50%', weight: 3 },
        { value: '10_25', label: '10% a 25%', weight: 4 },
        { value: 'lt_10', label: 'Menos de 10%', weight: 5 }
      ]
    },
    {
      id: 'financial_debt_load',
      prompt: 'Como avalia seu nível de endividamento atual?',
      inputType: 'single_select',
      scoringRole: 'risk_score',
      cvmReference: 'CVM-Res-30/2021-Art-3-§2-II',
      options: [
        { value: 'alto', label: 'Alto — comprometendo o orçamento', weight: 1 },
        { value: 'medio', label: 'Médio — dentro do controle', weight: 2 },
        { value: 'baixo', label: 'Baixo / pontual', weight: 3 },
        { value: 'sem_divida', label: 'Sem dívidas', weight: 4 },
        { value: 'credor_liquido', label: 'Sou credor líquido', weight: 5 }
      ]
    }
  ]
};

const knowledgeExperience: SuitabilitySectionDefinition = {
  key: 'knowledge_experience',
  cvmReference: cvm30References.knowledge_experience.cvmReference,
  description: cvm30References.knowledge_experience.description,
  questions: [
    {
      id: 'knowledge_general',
      prompt: 'Como descreve seu conhecimento geral em investimentos?',
      inputType: 'single_select',
      scoringRole: 'risk_score',
      cvmReference: 'CVM-Res-30/2021-Art-3-§3-I',
      options: [
        { value: 'nenhum', label: 'Nenhum', weight: 1 },
        { value: 'basico', label: 'Básico (renda fixa, fundos simples)', weight: 2 },
        { value: 'intermediario', label: 'Intermediário (ações, ETFs, multimercados)', weight: 3 },
        { value: 'avancado', label: 'Avançado (derivativos, alternativos)', weight: 4 },
        { value: 'profissional', label: 'Profissional do mercado', weight: 5 }
      ]
    },
    {
      id: 'knowledge_history',
      prompt: 'Quais classes de ativos você já investiu em algum momento?',
      inputType: 'single_select',
      scoringRole: 'risk_score',
      cvmReference: 'CVM-Res-30/2021-Art-3-§3-I',
      options: [
        { value: 'poupanca', label: 'Poupança apenas', weight: 1 },
        { value: 'renda_fixa', label: 'Renda fixa (CDB, Tesouro, LCI/LCA)', weight: 2 },
        { value: 'fundos', label: 'Fundos abertos / previdência', weight: 3 },
        { value: 'acoes', label: 'Ações / ETFs / FIIs', weight: 4 },
        { value: 'derivativos', label: 'Derivativos / alternativos / cripto', weight: 5 }
      ]
    },
    {
      id: 'knowledge_volatility',
      prompt: 'Já passou por uma queda relevante (>20%) em uma carteira sua?',
      inputType: 'single_select',
      scoringRole: 'risk_score',
      cvmReference: 'CVM-Res-30/2021-Art-3-§3-II',
      options: [
        { value: 'nunca', label: 'Nunca passei', weight: 1 },
        { value: 'vendi', label: 'Sim — vendi tudo no susto', weight: 2 },
        { value: 'reduzi', label: 'Sim — reduzi exposição', weight: 3 },
        { value: 'mantive', label: 'Sim — mantive posição', weight: 4 },
        { value: 'aumentei', label: 'Sim — aumentei exposição na queda', weight: 5 }
      ]
    },
    {
      id: 'knowledge_operation_nature',
      prompt: 'Qual a natureza das operações que você já realizou no mercado de valores mobiliários?',
      inputType: 'multi_select',
      scoringRole: 'data_capture',
      cvmReference: 'CVM-Res-30/2021-Art-3-§3-II',
      options: [
        { value: 'none', label: 'Nunca realizei operações no mercado de valores mobiliários', weight: 1 },
        { value: 'fixed_income', label: 'Renda fixa / títulos públicos / títulos bancários', weight: 2 },
        { value: 'funds', label: 'Fundos de investimento / previdência', weight: 3 },
        { value: 'equities_reits_etfs', label: 'Ações / ETFs / FIIs', weight: 4 },
        { value: 'structured_products', label: 'Produtos estruturados', weight: 4 },
        { value: 'derivatives', label: 'Derivativos', weight: 5 },
        { value: 'crypto_or_alternatives', label: 'Criptoativos ou alternativos', weight: 5 }
      ]
    },
    {
      id: 'knowledge_operation_volume',
      prompt: 'Qual foi o volume financeiro aproximado das operações já realizadas?',
      inputType: 'single_select',
      scoringRole: 'data_capture',
      cvmReference: 'CVM-Res-30/2021-Art-3-§3-II',
      options: [
        { value: 'none', label: 'Nenhuma operação', weight: 1 },
        { value: 'lt_50k', label: 'Até R$ 50 mil', weight: 2 },
        { value: '50k_250k', label: 'R$ 50 mil a R$ 250 mil', weight: 3 },
        { value: '250k_1m', label: 'R$ 250 mil a R$ 1 milhão', weight: 4 },
        { value: 'gt_1m', label: 'Acima de R$ 1 milhão', weight: 5 }
      ]
    },
    {
      id: 'knowledge_operation_frequency',
      prompt: 'Com que frequência você realizou operações de investimento nos últimos anos?',
      inputType: 'single_select',
      scoringRole: 'data_capture',
      cvmReference: 'CVM-Res-30/2021-Art-3-§3-II',
      options: [
        { value: 'none', label: 'Nunca / praticamente nunca', weight: 1 },
        { value: 'rare', label: 'Raramente', weight: 2 },
        { value: 'quarterly', label: 'Algumas vezes por ano', weight: 3 },
        { value: 'monthly', label: 'Mensalmente', weight: 4 },
        { value: 'weekly_or_more', label: 'Semanalmente ou com maior frequência', weight: 5 }
      ]
    },
    {
      id: 'knowledge_operation_period',
      prompt: 'Há quanto tempo você realiza operações de investimento?',
      inputType: 'single_select',
      scoringRole: 'data_capture',
      cvmReference: 'CVM-Res-30/2021-Art-3-§3-II',
      options: [
        { value: 'none', label: 'Nunca realizei operações', weight: 1 },
        { value: 'lt_1y', label: 'Menos de 1 ano', weight: 2 },
        { value: '1_3y', label: 'Entre 1 e 3 anos', weight: 3 },
        { value: '3_10y', label: 'Entre 3 e 10 anos', weight: 4 },
        { value: 'gt_10y', label: 'Mais de 10 anos', weight: 5 }
      ]
    },
    {
      id: 'knowledge_academic_background',
      prompt: 'Qual sua formação acadêmica?',
      inputType: 'single_select',
      scoringRole: 'data_capture',
      cvmReference: 'CVM-Res-30/2021-Art-3-§3-III-and-§4',
      options: [
        { value: 'basic', label: 'Ensino fundamental ou médio', weight: 1 },
        { value: 'higher_non_finance', label: 'Ensino superior em área não financeira', weight: 2 },
        { value: 'higher_finance_related', label: 'Ensino superior em economia, administração, contabilidade, direito empresarial ou área correlata', weight: 3 },
        { value: 'postgrad_finance_related', label: 'Pós-graduação ou formação avançada em finanças/economia/mercado', weight: 4 },
        { value: 'not_applicable_legal_entity', label: 'Não aplicável — cliente pessoa jurídica', weight: 3 }
      ]
    },
    {
      id: 'knowledge_professional_experience',
      prompt: 'Sua experiência profissional envolve finanças, investimentos ou mercado de capitais?',
      inputType: 'single_select',
      scoringRole: 'data_capture',
      cvmReference: 'CVM-Res-30/2021-Art-3-§3-III-and-§4',
      options: [
        { value: 'none', label: 'Não envolve', weight: 1 },
        { value: 'indirect', label: 'Envolve indiretamente', weight: 2 },
        { value: 'direct_non_investment', label: 'Envolve diretamente finanças, mas não gestão/investimentos', weight: 3 },
        { value: 'investment_related', label: 'Envolve investimentos, alocação ou mercado de capitais', weight: 4 },
        { value: 'not_applicable_legal_entity', label: 'Não aplicável — cliente pessoa jurídica', weight: 3 }
      ]
    },
    {
      id: 'knowledge_fx_risk_understanding',
      prompt: 'Como avalia seu entendimento sobre risco cambial em investimentos no exterior?',
      inputType: 'single_select',
      scoringRole: 'review_flag',
      cvmReference: 'CVM-Res-30/2021-Art-3-§3-I',
      options: [
        { value: 'none', label: 'Não entendo risco cambial', weight: 1 },
        { value: 'basic', label: 'Entendo que a moeda pode oscilar, mas não domino os impactos', weight: 2 },
        { value: 'intermediate', label: 'Entendo os principais impactos de câmbio na carteira', weight: 3 },
        { value: 'advanced', label: 'Entendo cenários, hedge e volatilidade cambial', weight: 4 },
        { value: 'professional', label: 'Tenho experiência profissional ou técnica com câmbio/hedge', weight: 5 }
      ]
    }
  ]
};

const liquidityNeeds: SuitabilitySectionDefinition = {
  key: 'liquidity_needs',
  cvmReference: cvm30References.liquidity_needs.cvmReference,
  description: cvm30References.liquidity_needs.description,
  questions: [
    {
      id: 'liquidity_known_needs',
      prompt: 'Há necessidade conhecida de saque relevante nos próximos 12 meses?',
      inputType: 'single_select',
      scoringRole: 'risk_score',
      cvmReference: 'CVM-Res-30/2021-Art-3-§2-III',
      options: [
        { value: 'gt_50', label: 'Sim — mais de 50% do investido', weight: 1 },
        { value: '25_50', label: 'Sim — entre 25% e 50%', weight: 2 },
        { value: '10_25', label: 'Sim — entre 10% e 25%', weight: 3 },
        { value: 'lt_10', label: 'Sim — abaixo de 10%', weight: 4 },
        { value: 'nenhuma', label: 'Nenhuma necessidade prevista', weight: 5 }
      ]
    },
    {
      id: 'liquidity_lock_tolerance',
      prompt: 'Qual o maior prazo de carência aceitável para parte significativa da carteira?',
      inputType: 'single_select',
      scoringRole: 'risk_score',
      cvmReference: 'CVM-Res-30/2021-Art-3-§1-I',
      options: [
        { value: 'd0', label: 'Liquidez diária obrigatória', weight: 1 },
        { value: '90d', label: 'Até 90 dias', weight: 2 },
        { value: '1y', label: 'Até 1 ano', weight: 3 },
        { value: '3y', label: 'Até 3 anos', weight: 4 },
        { value: '5y_plus', label: '5 anos ou mais', weight: 5 }
      ]
    }
  ]
};

const restrictions: SuitabilitySectionDefinition = {
  key: 'restrictions',
  cvmReference: cvm30References.restrictions.cvmReference,
  description: cvm30References.restrictions.description,
  questions: [
    {
      id: 'restrictions_esg',
      prompt: 'Há restrições éticas/setoriais a respeitar (ESG, religião, etc.)?',
      inputType: 'single_select',
      scoringRole: 'constraint',
      cvmReference: 'Internal-IPS-Constraints',
      options: [
        { value: 'rigidas', label: 'Sim — restrições rígidas, lista fechada', weight: 1 },
        { value: 'preferencias', label: 'Sim — preferências firmes, mas flexíveis', weight: 3 },
        { value: 'nenhuma', label: 'Não — sem restrições', weight: 5 }
      ]
    },
    {
      id: 'restrictions_concentration',
      prompt: 'Tolera concentração relevante em poucos ativos / setores?',
      inputType: 'single_select',
      scoringRole: 'risk_score',
      cvmReference: 'Internal-IPS-Constraints',
      options: [
        { value: 'nao_tolero', label: 'Não tolero — quero diversificação ampla', weight: 1 },
        { value: 'parcial', label: 'Tolero pontualmente', weight: 3 },
        { value: 'aceito', label: 'Aceito alta concentração com convicção', weight: 5 }
      ]
    },
    {
      id: 'restrictions_offshore',
      prompt: 'Há vedação a ativos offshore ou em moeda estrangeira?',
      inputType: 'single_select',
      scoringRole: 'constraint',
      cvmReference: 'Internal-IPS-Constraints',
      options: [
        { value: 'vedado', label: 'Vedado — apenas Brasil/BRL', weight: 1 },
        { value: 'limitado', label: 'Permitido com limite', weight: 3 },
        { value: 'sem_restricao', label: 'Sem restrição', weight: 5 }
      ]
    }
  ]
};

export const suitabilityQuestionnaireV1: readonly SuitabilitySectionDefinition[] = [
  objectives,
  financialSituation,
  knowledgeExperience,
  liquidityNeeds,
  restrictions
];

export const suitabilityQuestionnaireV1ByKey: Readonly<
  Record<SuitabilitySectionKey, SuitabilitySectionDefinition>
> = {
  objectives,
  financial_situation: financialSituation,
  knowledge_experience: knowledgeExperience,
  liquidity_needs: liquidityNeeds,
  restrictions
};
