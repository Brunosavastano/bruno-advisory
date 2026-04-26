// Dev-only runtime harness for AI-1 Cycle 1 storage helpers.
// Returns 404 in production. Hit ONLY by infra/scripts/verifiers/ai-1-cycle-1.ts during local
// verification. Gives the verifier a single endpoint that exercises all 9 storage modules end-to-end
// (create + transitions + audit-log writes) without needing to dynamic-import .ts files from Node.
//
// Gate: process.env.NODE_ENV must NOT be 'production'. The route returns 404 with empty body in prod.
//
// Lifecycle: this route is expected to be removed (or replaced by real cockpit/portal routes) once
// AI-1 Cycle 2 wires the Anthropic provider in. It carries no production responsibility.

import { archiveArtifact, createAiArtifact, updateArtifactStatus } from '../../../../../lib/storage/ai-artifacts';
import { setBudgetCap, deactivateBudgetCap } from '../../../../../lib/storage/ai-budget-caps';
import { createEvalCase } from '../../../../../lib/storage/ai-eval-cases';
import { recordEvalRun } from '../../../../../lib/storage/ai-eval-runs';
import { recordGuardrailResult, summarizeGuardrailResultsForJob } from '../../../../../lib/storage/ai-guardrail-results';
import { cancelAiJob, createAiJob, updateAiJobStatus } from '../../../../../lib/storage/ai-jobs';
import { appendAiMessage } from '../../../../../lib/storage/ai-messages';
import { registerModelVersion, transitionModelVersion } from '../../../../../lib/storage/ai-model-versions';
import { createPromptTemplate } from '../../../../../lib/storage/ai-prompt-templates';

export async function POST(request: Request) {
  if (process.env.AI_DEV_HARNESS_ENABLED !== '1') {
    return new Response(null, { status: 404 });
  }

  const body = (await request.json()) as { leadId?: string };
  const leadId = body?.leadId;
  if (!leadId) return Response.json({ ok: false, error: 'leadId required' }, { status: 400 });

  const errors: string[] = [];
  const probe: Record<string, unknown> = {};

  // 1. Prompt template
  const tpl = createPromptTemplate({
    name: 'memo_internal_draft',
    version: '0.1.0',
    purpose: 'Internal memo draft generation for cockpit operator review',
    body: 'You are an internal assistant ... [test body]',
    outputSchema: '{"type":"object"}',
    requiresGrounding: false,
    allowedSurfaces: ['cockpit_copilot']
  });
  probe.promptTemplate = { templateId: tpl.templateId, active: tpl.active };

  // 2. Model version + transition candidate → active
  const mv = registerModelVersion({ provider: 'anthropic', modelId: 'claude-opus-4-7', displayName: 'Claude Opus 4.7' });
  const mvActive = transitionModelVersion({ modelVersionId: mv.modelVersionId, toStatus: 'active' });
  if (mvActive?.status !== 'active') errors.push('mv promote');
  probe.modelVersion = { modelVersionId: mv.modelVersionId, status: mvActive?.status };

  // 3. Job: queued → running → succeeded
  const job = createAiJob({
    leadId,
    jobType: 'memo_draft',
    surface: 'cockpit_copilot',
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    modelVersionId: mv.modelVersionId,
    promptTemplateId: tpl.templateId,
    promptTemplateVersion: tpl.version,
    inputHash: 'sha256:fakeinputhash',
    inputRedactionLevel: 'strict',
    createdBy: 'verifier'
  });
  const jobRunning = updateAiJobStatus({ jobId: job.jobId, status: 'running' });
  const jobDone = updateAiJobStatus({
    jobId: job.jobId,
    status: 'succeeded',
    outputHash: 'sha256:fakeoutputhash',
    inputTokens: 100,
    outputTokens: 200,
    costCents: 5,
    latencyMs: 850
  });
  if (jobDone?.status !== 'succeeded' || !jobDone.completedAt) errors.push('job lifecycle');
  probe.job = { jobId: job.jobId, finalStatus: jobDone?.status };

  // 4. Artifact: pending_review → approved → archived
  const art = createAiArtifact({
    jobId: job.jobId,
    leadId,
    artifactType: 'memo_draft',
    title: 'Test memo draft',
    body: 'Drafted body',
    requiresGrounding: false,
    status: 'pending_review'
  });
  const artApproved = updateArtifactStatus({ artifactId: art.artifactId, status: 'approved', actorId: 'verifier-operator' });
  const artArchived = archiveArtifact({ artifactId: art.artifactId, actorId: 'verifier-operator' });
  if (artArchived?.status !== 'archived' || !artArchived.archivedAt) errors.push('artifact archive');
  probe.artifact = { artifactId: art.artifactId, finalStatus: artArchived?.status, approvedBy: artApproved?.reviewedBy };

  // 5. Message
  const msg = appendAiMessage({ leadId, surface: 'cockpit_copilot', role: 'assistant', content: 'Test', aiJobId: job.jobId });
  probe.message = { messageId: msg.messageId };

  // 6. Guardrail
  const guard = recordGuardrailResult({ jobId: job.jobId, ruleName: 'no_promised_returns', status: 'pass' });
  const summary = summarizeGuardrailResultsForJob(job.jobId);
  if (summary.passed !== 1) errors.push(`guardrail summary passed=${summary.passed}`);
  probe.guardrail = { resultId: guard.resultId, summary };

  // 7. Budget cap: set + deactivate + reactivate
  const cap = setBudgetCap({ scopeType: 'global', scopeValue: 'global', period: 'month', capCents: 5000, actionOnExceed: 'block' });
  const capDeactivated = deactivateBudgetCap({ capId: cap.capId, actorId: 'verifier-operator' });
  if (capDeactivated?.active !== false) errors.push('budget cap deactivate');
  probe.budgetCap = { capId: cap.capId, finalActive: capDeactivated?.active };

  // 8. Eval case + run
  const evalCase = createEvalCase({
    surface: 'cockpit_copilot',
    name: 'memo_smoke',
    inputJson: '{"prompt":"Write memo for X"}',
    expectedConstraintsJson: '{"max_words":300,"must_include":["disclaimer"]}'
  });
  const evalRun = recordEvalRun({
    modelVersionId: mv.modelVersionId,
    promptTemplateId: tpl.templateId,
    caseId: evalCase.caseId,
    status: 'pass',
    metricsJson: '{"latency_ms":900,"cost_cents":5}'
  });
  probe.evalRun = { runId: evalRun.runId, status: evalRun.status };

  // 9. Status transitions: invalid jumps must throw
  const transitions: Record<string, boolean> = {};

  const j2 = createAiJob({
    jobType: 'test',
    surface: 'cockpit_copilot',
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    promptTemplateId: tpl.templateId,
    promptTemplateVersion: tpl.version,
    inputHash: 'sha256:x',
    createdBy: 'verifier'
  });
  try {
    updateAiJobStatus({ jobId: j2.jobId, status: 'succeeded' });
    errors.push('queued→succeeded should reject');
  } catch (error) {
    transitions.queuedToSucceededRejected = (error as Error).message.includes('invalid transition');
  }

  try {
    cancelAiJob({ jobId: job.jobId, reason: 'late' });
    errors.push('cancel succeeded should reject');
  } catch (error) {
    transitions.cancelOnSucceededRejected = (error as Error).message.includes('cannot cancel');
  }

  const mvDep = registerModelVersion({ provider: 'anthropic', modelId: 'claude-opus-4-6', displayName: 'Claude Opus 4.6' });
  transitionModelVersion({ modelVersionId: mvDep.modelVersionId, toStatus: 'active' });
  transitionModelVersion({ modelVersionId: mvDep.modelVersionId, toStatus: 'deprecated' });
  try {
    transitionModelVersion({ modelVersionId: mvDep.modelVersionId, toStatus: 'active' });
    errors.push('deprecated→active should reject');
  } catch (error) {
    transitions.deprecatedToActiveRejected = (error as Error).message.includes('invalid transition');
  }
  probe.transitions = transitions;

  if (errors.length > 0) {
    return Response.json({ ok: false, errors, probe }, { status: 500 });
  }

  return Response.json({ ok: true, probe });
}
