export const operatorCommercialStageValues = [
  'intake_novo',
  'contato_inicial',
  'diagnostico_em_andamento',
  'proposta_enviada',
  'negociacao',
  'cliente_convertido',
  'encerrado_sem_conversao'
] as const;

export type OperatorCommercialStage = (typeof operatorCommercialStageValues)[number];

export const operatorCommercialStageLabels: Record<OperatorCommercialStage, string> = {
  intake_novo: 'Intake novo',
  contato_inicial: 'Contato inicial',
  diagnostico_em_andamento: 'Diagnóstico em andamento',
  proposta_enviada: 'Proposta enviada',
  negociacao: 'Negociação',
  cliente_convertido: 'Cliente convertido',
  encerrado_sem_conversao: 'Encerrado sem conversão'
};

export const commercialStageModel = {
  canonicalArtifact: 'packages/core/src/commercial-stage-model.ts',
  tranche: 'T3',
  cycle: 1,
  objective: 'Canonical operator-side commercial stages for the minimal CRM spine.',
  defaultStage: 'intake_novo' as OperatorCommercialStage,
  stages: operatorCommercialStageValues,
  labels: operatorCommercialStageLabels
} as const;

export function isOperatorCommercialStage(value: unknown): value is OperatorCommercialStage {
  return typeof value === 'string' && operatorCommercialStageValues.includes(value as OperatorCommercialStage);
}
