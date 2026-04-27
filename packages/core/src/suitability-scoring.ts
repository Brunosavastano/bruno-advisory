import {
  clientRiskProfiles,
  riskProfiles,
  type ClientRiskProfile,
  type RiskProfile
} from './client-profile-model';
import type { SuitabilitySectionKey } from './cvm-30-references';
import {
  suitabilityQuestionnaireVersion,
  suitabilityQuestionnaireV1,
  suitabilityQuestionnaireV1ByKey,
  type SuitabilityQuestion,
  type SuitabilityQuestionOption,
  type SuitabilitySectionDefinition
} from './suitability-questionnaire-v1';

// Scoring determinístico do questionário de suitability. Função pura, sem I/O.
// Recebe um mapa { sectionKey → { questionId → optionValue | optionValue[] } },
// valida que toda pergunta V1 foi respondida com opção válida, rejeita seções
// ou perguntas extras, calcula score 0-100 por normalização min-max, aplica
// caps prudenciais e gera flags para revisão humana.
//
// Somente perguntas com scoringRole='risk_score' entram no score. Perguntas de
// data_capture, constraint e review_flag são obrigatórias para trilha de
// suitability, mas não aumentam nem reduzem diretamente o perfil de risco.
//
// Pesos, caps e cortes de bucket continuam sendo calibração V1. O consultor
// CVM responsável deve aprovar a calibração antes de usá-la como gate de AI-5.

export const suitabilityScoringCalibrationVersion = 'risk-score-v1.2026-04' as const;

export type SuitabilityAnswerValue = string | readonly string[];
export type SuitabilityAnswers = Readonly<
  Record<SuitabilitySectionKey, Readonly<Record<string, SuitabilityAnswerValue>>>
>;

export const suitabilitySectionWeights: Readonly<Record<SuitabilitySectionKey, number>> = {
  objectives: 0.3,
  financial_situation: 0.25,
  knowledge_experience: 0.2,
  liquidity_needs: 0.15,
  restrictions: 0.1
};

const profileBuckets: ReadonlyArray<{
  readonly maxScore: number;
  readonly profile: ClientRiskProfile;
}> = [
  { maxScore: 20, profile: 'conservador' },
  { maxScore: 40, profile: 'moderado_conservador' },
  { maxScore: 60, profile: 'moderado' },
  { maxScore: 80, profile: 'moderado_arrojado' },
  { maxScore: Number.POSITIVE_INFINITY, profile: 'arrojado' }
];

export type SuitabilityRiskCapReasonCode =
  | 'short_horizon'
  | 'large_near_term_liquidity_need'
  | 'insufficient_emergency_reserve'
  | 'low_loss_tolerance'
  | 'high_debt_load';

export type SuitabilityRiskCap = {
  readonly reasonCode: SuitabilityRiskCapReasonCode;
  readonly maxProfile: ClientRiskProfile;
  readonly sourceQuestionId: string;
  readonly sourceOptionValue: string;
  readonly cvmReferences: readonly string[];
};

export type SuitabilityReviewFlagCode =
  | 'loss_tolerance_inconsistent_with_horizon'
  | 'high_risk_tolerance_but_no_emergency_reserve'
  | 'advanced_knowledge_but_limited_market_history'
  | 'long_horizon_but_high_liquidity_need'
  | 'offshore_allowed_but_limited_fx_understanding'
  | 'high_concentration_tolerance_with_low_loss_tolerance'
  | 'none_operation_nature_selected_with_other_values';

export type SuitabilityReviewFlagSeverity = 'info' | 'warning' | 'critical';

export type SuitabilityReviewFlag = {
  readonly code: SuitabilityReviewFlagCode;
  readonly severity: SuitabilityReviewFlagSeverity;
  readonly message: string;
  readonly questionIds: readonly string[];
  readonly cvmReferences: readonly string[];
};

export type SuitabilityConstraint = {
  readonly section: SuitabilitySectionKey;
  readonly questionId: string;
  readonly value: SuitabilityAnswerValue;
  readonly labels: readonly string[];
};

export type SuitabilityScoringResult = {
  readonly questionnaireVersion: typeof suitabilityQuestionnaireVersion;
  readonly scoringCalibrationVersion: typeof suitabilityScoringCalibrationVersion;
  readonly score: number;
  readonly computedRiskProfile: ClientRiskProfile;
  readonly cappedRiskProfile: ClientRiskProfile;
  // Mantém compatibilidade com o contrato antigo. Use cappedRiskProfile como
  // perfil operacional até aprovação humana.
  readonly riskProfile: RiskProfile;
  readonly breakdown: Readonly<Record<SuitabilitySectionKey, number>>;
  readonly capsApplied: readonly SuitabilityRiskCap[];
  readonly reviewFlags: readonly SuitabilityReviewFlag[];
  readonly constraints: readonly SuitabilityConstraint[];
};

export type SuitabilityScoringError = {
  readonly ok: false;
  readonly errorCode:
    | 'missing_section'
    | 'missing_answer'
    | 'invalid_option'
    | 'invalid_answer_type'
    | 'extra_section'
    | 'extra_answer';
  readonly section?: SuitabilitySectionKey | string;
  readonly questionId?: string;
  readonly optionValue?: string;
};

export type SuitabilityScoringOutcome =
  | ({ readonly ok: true } & SuitabilityScoringResult)
  | SuitabilityScoringError;

type SectionRawScore = {
  readonly ok: true;
  readonly raw: number;
  readonly min: number;
  readonly max: number;
};

function findOption(
  question: SuitabilityQuestion,
  value: string
): SuitabilityQuestionOption | undefined {
  return question.options.find((candidate) => candidate.value === value);
}

function validateQuestionAnswer(
  definition: SuitabilitySectionDefinition,
  question: SuitabilityQuestion,
  answer: SuitabilityAnswerValue | undefined
): SuitabilityScoringError | null {
  if (answer === undefined || answer === null) {
    return { ok: false, errorCode: 'missing_answer', section: definition.key, questionId: question.id };
  }

  if (question.inputType === 'single_select') {
    if (typeof answer !== 'string' || answer.length === 0) {
      return {
        ok: false,
        errorCode: 'invalid_answer_type',
        section: definition.key,
        questionId: question.id
      };
    }

    if (!findOption(question, answer)) {
      return {
        ok: false,
        errorCode: 'invalid_option',
        section: definition.key,
        questionId: question.id,
        optionValue: answer
      };
    }

    return null;
  }

  if (!Array.isArray(answer) || answer.length === 0) {
    return {
      ok: false,
      errorCode: 'invalid_answer_type',
      section: definition.key,
      questionId: question.id
    };
  }

  for (const optionValue of answer) {
    if (typeof optionValue !== 'string' || optionValue.length === 0 || !findOption(question, optionValue)) {
      return {
        ok: false,
        errorCode: 'invalid_option',
        section: definition.key,
        questionId: question.id,
        optionValue: String(optionValue)
      };
    }
  }

  return null;
}

function selectedOptionWeights(question: SuitabilityQuestion, answer: SuitabilityAnswerValue): readonly number[] {
  if (typeof answer === 'string') {
    const option = findOption(question, answer);
    return option ? [option.weight] : [];
  }

  return answer
    .map((value) => findOption(question, value)?.weight)
    .filter((weight): weight is 1 | 2 | 3 | 4 | 5 => typeof weight === 'number');
}

function scoreSectionRaw(
  definition: SuitabilitySectionDefinition,
  answers: Readonly<Record<string, SuitabilityAnswerValue>>
): SectionRawScore | SuitabilityScoringError {
  const expectedQuestionIds = new Set(definition.questions.map((question) => question.id));

  for (const presentQuestionId of Object.keys(answers)) {
    if (!expectedQuestionIds.has(presentQuestionId)) {
      return {
        ok: false,
        errorCode: 'extra_answer',
        section: definition.key,
        questionId: presentQuestionId
      };
    }
  }

  let raw = 0;
  let min = 0;
  let max = 0;

  for (const question of definition.questions) {
    const answer = answers[question.id];
    const validationError = validateQuestionAnswer(definition, question, answer);
    if (validationError) {
      return validationError;
    }

    if (question.scoringRole !== 'risk_score') {
      continue;
    }

    const weights = selectedOptionWeights(question, answer);
    if (weights.length === 0) {
      return { ok: false, errorCode: 'missing_answer', section: definition.key, questionId: question.id };
    }

    const questionRaw = weights.reduce((acc, weight) => acc + weight, 0) / weights.length;
    const minWeight = question.options.reduce(
      (acc, candidate) => Math.min(acc, candidate.weight),
      Number.POSITIVE_INFINITY
    );
    const maxWeight = question.options.reduce((acc, candidate) => Math.max(acc, candidate.weight), 0);

    raw += questionRaw;
    min += minWeight;
    max += maxWeight;
  }

  return { ok: true, raw, min, max };
}

function getSingleAnswer(
  answers: SuitabilityAnswers,
  section: SuitabilitySectionKey,
  questionId: string
): string | undefined {
  const value = answers[section]?.[questionId];
  return typeof value === 'string' ? value : undefined;
}

function getMultiAnswer(
  answers: SuitabilityAnswers,
  section: SuitabilitySectionKey,
  questionId: string
): readonly string[] {
  const value = answers[section]?.[questionId];
  return Array.isArray(value) ? value : [];
}

const profileRanks: Readonly<Record<ClientRiskProfile, number>> = {
  conservador: 0,
  moderado_conservador: 1,
  moderado: 2,
  moderado_arrojado: 3,
  arrojado: 4
};

function mostConservativeProfile(
  current: ClientRiskProfile,
  candidateMax: ClientRiskProfile
): ClientRiskProfile {
  return profileRanks[candidateMax] < profileRanks[current] ? candidateMax : current;
}

function applyCaps(
  computedRiskProfile: ClientRiskProfile,
  capsApplied: readonly SuitabilityRiskCap[]
): ClientRiskProfile {
  return capsApplied.reduce(
    (current, cap) => mostConservativeProfile(current, cap.maxProfile),
    computedRiskProfile
  );
}

function computeCaps(answers: SuitabilityAnswers): readonly SuitabilityRiskCap[] {
  const caps: SuitabilityRiskCap[] = [];

  const horizon = getSingleAnswer(answers, 'objectives', 'objectives_horizon');
  if (horizon === 'lt_1y') {
    caps.push({
      reasonCode: 'short_horizon',
      maxProfile: 'conservador',
      sourceQuestionId: 'objectives_horizon',
      sourceOptionValue: horizon,
      cvmReferences: ['CVM-Res-30/2021-Art-3-§1-I']
    });
  } else if (horizon === '1_3y') {
    caps.push({
      reasonCode: 'short_horizon',
      maxProfile: 'moderado_conservador',
      sourceQuestionId: 'objectives_horizon',
      sourceOptionValue: horizon,
      cvmReferences: ['CVM-Res-30/2021-Art-3-§1-I']
    });
  }

  const liquidityNeed = getSingleAnswer(answers, 'liquidity_needs', 'liquidity_known_needs');
  if (liquidityNeed === 'gt_50') {
    caps.push({
      reasonCode: 'large_near_term_liquidity_need',
      maxProfile: 'conservador',
      sourceQuestionId: 'liquidity_known_needs',
      sourceOptionValue: liquidityNeed,
      cvmReferences: ['CVM-Res-30/2021-Art-3-§2-III']
    });
  } else if (liquidityNeed === '25_50') {
    caps.push({
      reasonCode: 'large_near_term_liquidity_need',
      maxProfile: 'moderado_conservador',
      sourceQuestionId: 'liquidity_known_needs',
      sourceOptionValue: liquidityNeed,
      cvmReferences: ['CVM-Res-30/2021-Art-3-§2-III']
    });
  }

  const emergencyReserve = getSingleAnswer(
    answers,
    'financial_situation',
    'financial_emergency_reserve'
  );
  if (emergencyReserve === 'lt_1') {
    caps.push({
      reasonCode: 'insufficient_emergency_reserve',
      maxProfile: 'conservador',
      sourceQuestionId: 'financial_emergency_reserve',
      sourceOptionValue: emergencyReserve,
      cvmReferences: ['CVM-Res-30/2021-Art-3-§2-III']
    });
  } else if (emergencyReserve === '1_3') {
    caps.push({
      reasonCode: 'insufficient_emergency_reserve',
      maxProfile: 'moderado_conservador',
      sourceQuestionId: 'financial_emergency_reserve',
      sourceOptionValue: emergencyReserve,
      cvmReferences: ['CVM-Res-30/2021-Art-3-§2-III']
    });
  }

  const lossTolerance = getSingleAnswer(answers, 'objectives', 'objectives_loss_tolerance');
  if (lossTolerance === 'zero') {
    caps.push({
      reasonCode: 'low_loss_tolerance',
      maxProfile: 'conservador',
      sourceQuestionId: 'objectives_loss_tolerance',
      sourceOptionValue: lossTolerance,
      cvmReferences: ['CVM-Res-30/2021-Art-3-§1-II']
    });
  } else if (lossTolerance === 'lt_5') {
    caps.push({
      reasonCode: 'low_loss_tolerance',
      maxProfile: 'moderado_conservador',
      sourceQuestionId: 'objectives_loss_tolerance',
      sourceOptionValue: lossTolerance,
      cvmReferences: ['CVM-Res-30/2021-Art-3-§1-II']
    });
  }

  const debtLoad = getSingleAnswer(answers, 'financial_situation', 'financial_debt_load');
  if (debtLoad === 'alto') {
    caps.push({
      reasonCode: 'high_debt_load',
      maxProfile: 'conservador',
      sourceQuestionId: 'financial_debt_load',
      sourceOptionValue: debtLoad,
      cvmReferences: ['CVM-Res-30/2021-Art-3-§2-II']
    });
  }

  return caps;
}

function computeReviewFlags(answers: SuitabilityAnswers): readonly SuitabilityReviewFlag[] {
  const flags: SuitabilityReviewFlag[] = [];

  const horizon = getSingleAnswer(answers, 'objectives', 'objectives_horizon');
  const lossTolerance = getSingleAnswer(answers, 'objectives', 'objectives_loss_tolerance');
  const emergencyReserve = getSingleAnswer(
    answers,
    'financial_situation',
    'financial_emergency_reserve'
  );
  const knowledgeGeneral = getSingleAnswer(answers, 'knowledge_experience', 'knowledge_general');
  const knowledgeHistory = getSingleAnswer(answers, 'knowledge_experience', 'knowledge_history');
  const liquidityNeed = getSingleAnswer(answers, 'liquidity_needs', 'liquidity_known_needs');
  const offshore = getSingleAnswer(answers, 'restrictions', 'restrictions_offshore');
  const fxUnderstanding = getSingleAnswer(
    answers,
    'knowledge_experience',
    'knowledge_fx_risk_understanding'
  );
  const concentration = getSingleAnswer(answers, 'restrictions', 'restrictions_concentration');
  const operationNature = getMultiAnswer(
    answers,
    'knowledge_experience',
    'knowledge_operation_nature'
  );

  if (
    horizon === 'lt_1y' &&
    (lossTolerance === 'lt_30' || lossTolerance === 'gt_30')
  ) {
    flags.push({
      code: 'loss_tolerance_inconsistent_with_horizon',
      severity: 'warning',
      message:
        'Cliente declara horizonte inferior a 1 ano, mas aceita perda temporária elevada. Revisar coerência entre horizonte e tolerância a risco.',
      questionIds: ['objectives_horizon', 'objectives_loss_tolerance'],
      cvmReferences: ['CVM-Res-30/2021-Art-3-§1-I-II']
    });
  }

  if (
    (lossTolerance === 'lt_30' || lossTolerance === 'gt_30') &&
    (emergencyReserve === 'lt_1' || emergencyReserve === '1_3')
  ) {
    flags.push({
      code: 'high_risk_tolerance_but_no_emergency_reserve',
      severity: 'critical',
      message:
        'Cliente declara alta tolerância a perdas, mas possui reserva de emergência insuficiente. Exigir revisão humana antes de recomendação.',
      questionIds: ['objectives_loss_tolerance', 'financial_emergency_reserve'],
      cvmReferences: ['CVM-Res-30/2021-Art-3-§1-II', 'CVM-Res-30/2021-Art-3-§2-III']
    });
  }

  if (
    (knowledgeGeneral === 'avancado' || knowledgeGeneral === 'profissional') &&
    (knowledgeHistory === 'poupanca' || knowledgeHistory === 'renda_fixa')
  ) {
    flags.push({
      code: 'advanced_knowledge_but_limited_market_history',
      severity: 'warning',
      message:
        'Cliente declara conhecimento avançado/profissional, mas histórico limitado de classes de ativos. Confirmar experiência real.',
      questionIds: ['knowledge_general', 'knowledge_history'],
      cvmReferences: ['CVM-Res-30/2021-Art-3-§3-I-II']
    });
  }

  if (
    (horizon === '5_10y' || horizon === 'gt_10y') &&
    (liquidityNeed === 'gt_50' || liquidityNeed === '25_50')
  ) {
    flags.push({
      code: 'long_horizon_but_high_liquidity_need',
      severity: 'warning',
      message:
        'Cliente declara horizonte longo, mas também necessidade relevante de liquidez em 12 meses. Separar objetivos ou criar subcarteiras.',
      questionIds: ['objectives_horizon', 'liquidity_known_needs'],
      cvmReferences: ['CVM-Res-30/2021-Art-3-§1-I', 'CVM-Res-30/2021-Art-3-§2-III']
    });
  }

  if (
    (offshore === 'limitado' || offshore === 'sem_restricao') &&
    (fxUnderstanding === 'none' || fxUnderstanding === 'basic')
  ) {
    flags.push({
      code: 'offshore_allowed_but_limited_fx_understanding',
      severity: 'warning',
      message:
        'Cliente permite ativos offshore, mas demonstra baixo entendimento de risco cambial. Incluir explicação específica antes de recomendação.',
      questionIds: ['restrictions_offshore', 'knowledge_fx_risk_understanding'],
      cvmReferences: ['CVM-Res-30/2021-Art-3-§3-I']
    });
  }

  if (
    concentration === 'aceito' &&
    (lossTolerance === 'zero' || lossTolerance === 'lt_5')
  ) {
    flags.push({
      code: 'high_concentration_tolerance_with_low_loss_tolerance',
      severity: 'warning',
      message:
        'Cliente aceita concentração relevante, mas declara baixa tolerância a perdas. Confirmar se entende volatilidade e risco de concentração.',
      questionIds: ['restrictions_concentration', 'objectives_loss_tolerance'],
      cvmReferences: ['CVM-Res-30/2021-Art-3-§1-II']
    });
  }

  if (operationNature.includes('none') && operationNature.length > 1) {
    flags.push({
      code: 'none_operation_nature_selected_with_other_values',
      severity: 'warning',
      message:
        'Cliente selecionou ausência de operações e, simultaneamente, outras naturezas de operação. Solicitar correção ou esclarecimento.',
      questionIds: ['knowledge_operation_nature'],
      cvmReferences: ['CVM-Res-30/2021-Art-3-§3-II']
    });
  }

  return flags;
}

function extractConstraints(answers: SuitabilityAnswers): readonly SuitabilityConstraint[] {
  const constraints: SuitabilityConstraint[] = [];

  for (const definition of suitabilityQuestionnaireV1) {
    for (const question of definition.questions) {
      if (question.scoringRole !== 'constraint') {
        continue;
      }

      const value = answers[definition.key]?.[question.id];
      if (value === undefined) {
        continue;
      }

      const values = typeof value === 'string' ? [value] : value;
      const labels = values
        .map((optionValue) => findOption(question, optionValue)?.label)
        .filter((label): label is string => typeof label === 'string');

      constraints.push({
        section: definition.key,
        questionId: question.id,
        value,
        labels
      });
    }
  }

  return constraints;
}

export function scoreSuitability(answers: SuitabilityAnswers): SuitabilityScoringOutcome {
  for (const presentKey of Object.keys(answers)) {
    if (!(presentKey in suitabilityQuestionnaireV1ByKey)) {
      return { ok: false, errorCode: 'extra_section', section: presentKey };
    }
  }

  const breakdown: Partial<Record<SuitabilitySectionKey, number>> = {};
  let weightedTotal = 0;

  for (const definition of suitabilityQuestionnaireV1) {
    const sectionAnswers = answers[definition.key];
    if (!sectionAnswers) {
      return { ok: false, errorCode: 'missing_section', section: definition.key };
    }

    const sectionOutcome = scoreSectionRaw(definition, sectionAnswers);
    if ('errorCode' in sectionOutcome) {
      return sectionOutcome;
    }

    const { raw, min, max } = sectionOutcome;
    const sectionScore = max > min ? ((raw - min) / (max - min)) * 100 : 0;
    const roundedSectionScore = Math.round(sectionScore * 100) / 100;
    breakdown[definition.key] = roundedSectionScore;
    weightedTotal += roundedSectionScore * suitabilitySectionWeights[definition.key];
  }

  const score = Math.round(weightedTotal);
  const computedRiskProfile = bucketScore(score);
  const capsApplied = computeCaps(answers);
  const cappedRiskProfile = applyCaps(computedRiskProfile, capsApplied);

  return {
    ok: true,
    questionnaireVersion: suitabilityQuestionnaireVersion,
    scoringCalibrationVersion: suitabilityScoringCalibrationVersion,
    score,
    computedRiskProfile,
    cappedRiskProfile,
    riskProfile: cappedRiskProfile,
    breakdown: breakdown as Readonly<Record<SuitabilitySectionKey, number>>,
    capsApplied,
    reviewFlags: computeReviewFlags(answers),
    constraints: extractConstraints(answers)
  };
}

export function bucketScore(score: number): ClientRiskProfile {
  if (!Number.isFinite(score)) {
    return riskProfiles[0];
  }

  for (const bucket of profileBuckets) {
    if (score <= bucket.maxScore) {
      return bucket.profile;
    }
  }

  return clientRiskProfiles[clientRiskProfiles.length - 1];
}
