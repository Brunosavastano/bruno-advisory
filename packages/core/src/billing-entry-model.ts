import { type OperatorCommercialStage } from './commercial-stage-model';

export const billingEntryTaskStates = ['todo', 'in_progress', 'done'] as const;
export type BillingEntryTaskState = (typeof billingEntryTaskStates)[number];

export const billingEntryConditionKeys = [
  'commercial_stage_cliente_convertido',
  'at_least_one_internal_task',
  'all_internal_tasks_done'
] as const;

export type BillingEntryConditionKey = (typeof billingEntryConditionKeys)[number];

export const billingEntryConditionLabels: Record<BillingEntryConditionKey, string> = {
  commercial_stage_cliente_convertido: 'Estagio comercial deve estar em Cliente convertido.',
  at_least_one_internal_task: 'Deve existir ao menos 1 tarefa interna.',
  all_internal_tasks_done: 'Todas as tarefas internas devem estar com status done.'
};

export type BillingEntryEvaluationInput = {
  commercialStage: OperatorCommercialStage;
  taskStates: BillingEntryTaskState[];
};

export type BillingEntryEvaluation = {
  isBillingReady: boolean;
  requiredCommercialStage: OperatorCommercialStage;
  currentCommercialStage: OperatorCommercialStage;
  totalTasks: number;
  doneTasks: number;
  pendingTasks: number;
  unmetConditions: BillingEntryConditionKey[];
  unmetConditionLabels: string[];
};

export const billingEntryModel = {
  canonicalArtifact: 'packages/core/src/billing-entry-model.ts',
  tranche: 'T3',
  cycle: 4,
  objective: 'Canonical pre-billing readiness condition derived from persisted operator state.',
  requiredCommercialStage: 'cliente_convertido' as OperatorCommercialStage,
  doneTaskState: 'done' as BillingEntryTaskState,
  taskStates: billingEntryTaskStates,
  conditions: billingEntryConditionKeys,
  conditionLabels: billingEntryConditionLabels
} as const;

export function isBillingEntryTaskState(value: unknown): value is BillingEntryTaskState {
  return typeof value === 'string' && billingEntryTaskStates.includes(value as BillingEntryTaskState);
}

export function evaluateBillingEntryReadiness(input: BillingEntryEvaluationInput): BillingEntryEvaluation {
  const totalTasks = input.taskStates.length;
  const doneTasks = input.taskStates.filter((status) => status === billingEntryModel.doneTaskState).length;
  const pendingTasks = totalTasks - doneTasks;
  const unmetConditions: BillingEntryConditionKey[] = [];

  if (input.commercialStage !== billingEntryModel.requiredCommercialStage) {
    unmetConditions.push('commercial_stage_cliente_convertido');
  }

  if (totalTasks < 1) {
    unmetConditions.push('at_least_one_internal_task');
  }

  if (totalTasks > 0 && pendingTasks > 0) {
    unmetConditions.push('all_internal_tasks_done');
  }

  return {
    isBillingReady: unmetConditions.length === 0,
    requiredCommercialStage: billingEntryModel.requiredCommercialStage,
    currentCommercialStage: input.commercialStage,
    totalTasks,
    doneTasks,
    pendingTasks,
    unmetConditions,
    unmetConditionLabels: unmetConditions.map((condition) => billingEntryModel.conditionLabels[condition])
  };
}
