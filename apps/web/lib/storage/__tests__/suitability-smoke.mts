// AI-3 Cycle 1 (ampliado) smoke test — exercita o pipeline completo via rotas HTTP
// reais sobre um SQLite temporário:
// 1. cria lead via /api/intake
// 2. seed de product_category de teste
// 3. draft → submit (deve cair em review_required pelas caps prudenciais ou em
//    submitted, dependendo das respostas) → approve com approvedRiskProfile
// 4. block + override do gate em /api/cockpit/leads/.../recommendations/.../PATCH
// 5. confirma audit trail
//
// Rodar APÓS `npm run build`:
//   node --experimental-strip-types apps/web/lib/storage/__tests__/suitability-smoke.mts

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(import.meta.dirname, '../../../../../');
const webDir = path.join(repoRoot, 'apps', 'web');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-suitability-smoke-'));

fs.writeFileSync(path.join(tempRoot, 'project.yaml'), 'project: test\n');
fs.symlinkSync(path.join(repoRoot, 'apps'), path.join(tempRoot, 'apps'), 'dir');
fs.symlinkSync(path.join(repoRoot, 'packages'), path.join(tempRoot, 'packages'), 'dir');
process.chdir(tempRoot);
process.on('exit', () => {
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch { /* ignore */ }
});

const TEST_COCKPIT_SECRET = 'ai-3-cycle-1-smoke-secret';
process.env.COCKPIT_SECRET = TEST_COCKPIT_SECRET;
const TEST_INTERNAL_CRON_TOKEN = 'ai-3-cycle-1.5-cron-secret';
process.env.INTERNAL_CRON_TOKEN = TEST_INTERNAL_CRON_TOKEN;
const cockpitCookie = `cockpit_token=${TEST_COCKPIT_SECRET}`;
const headers = { 'content-type': 'application/json', cookie: cockpitCookie };

function loadUserland(modulePath: string) {
  const compiled = path.join(webDir, '.next', 'server', 'app', ...modulePath.split('/'), 'route.js');
  return require(compiled).routeModule.userland;
}

const intakeRoute = loadUserland('api/intake');
const assessmentsRoute = loadUserland('api/cockpit/leads/[leadId]/suitability/assessments');
const assessmentRoute = loadUserland('api/cockpit/leads/[leadId]/suitability/assessments/[assessmentId]');
const productCategoriesRoute = loadUserland('api/cockpit/product-categories');
const recommendationsRoute = loadUserland('api/cockpit/leads/[leadId]/recommendations');
const recommendationActionRoute = loadUserland('api/cockpit/leads/[leadId]/recommendations/[recommendationId]');
const cronExpireRoute = loadUserland('api/internal/cron/suitability-expire');

async function createIntakeLead(label: string): Promise<string> {
  const res = await intakeRoute.POST(new Request('http://localhost/api/intake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fullName: label,
      email: `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}@example.com`,
      phone: '+5511999990000',
      city: 'Sao Paulo',
      state: 'SP',
      investableAssetsBand: '1m_a_3m',
      primaryChallenge: 'planejamento_e_visao',
      privacyConsentAccepted: true,
      termsConsentAccepted: true,
      intakeFormVersion: 'smoke-v1',
      sourceChannel: 'site_home',
      sourceLabel: 'Smoke Test'
    })
  }));
  const json = await jsonOf(res);
  if (json.status !== 201) throw new Error(`intake fail: ${json.status} ${JSON.stringify(json.body)}`);
  const id = json.body.leadId ?? json.body.lead?.leadId;
  if (!id) throw new Error(`intake without leadId: ${JSON.stringify(json.body)}`);
  return id;
}

const BALANCED_ANSWERS = {
  objectives: {
    objectives_horizon: '3_5y',
    objectives_primary_goal: 'equilibrio',
    objectives_loss_tolerance: 'lt_15',
    objectives_purpose: 'aposentadoria'
  },
  financial_situation: {
    financial_regular_income_range: '15_50k',
    financial_income_stability: 'estavel',
    financial_total_wealth_range: '500k_1m',
    financial_asset_composition: ['cash_equivalents', 'real_estate'],
    financial_emergency_reserve: '3_6',
    financial_invest_share: '25_50',
    financial_debt_load: 'baixo'
  },
  knowledge_experience: {
    knowledge_general: 'intermediario',
    knowledge_history: 'fundos',
    knowledge_volatility: 'mantive',
    knowledge_operation_nature: ['fixed_income', 'funds'],
    knowledge_operation_volume: '50k_250k',
    knowledge_operation_frequency: 'quarterly',
    knowledge_operation_period: '3_10y',
    knowledge_academic_background: 'higher_finance_related',
    knowledge_professional_experience: 'indirect',
    knowledge_fx_risk_understanding: 'intermediate'
  },
  liquidity_needs: {
    liquidity_known_needs: 'lt_10',
    liquidity_lock_tolerance: '1y'
  },
  restrictions: {
    restrictions_esg: 'preferencias',
    restrictions_concentration: 'parcial',
    restrictions_offshore: 'limitado'
  }
};

async function createDraftAndSubmit(leadId: string, label: string) {
  const draftRes = await assessmentsRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${leadId}/suitability/assessments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ questionnaireVersion: 'v1.2026-04', answers: BALANCED_ANSWERS })
    }),
    { params: Promise.resolve({ leadId }) }
  );
  const draftJson = await jsonOf(draftRes);
  if (draftJson.status !== 201) throw new Error(`${label} draft fail: ${JSON.stringify(draftJson.body)}`);
  const assessmentId = draftJson.body.assessment.assessmentId;

  const submitRes = await assessmentRoute.PATCH(
    new Request(`http://localhost/api/cockpit/leads/${leadId}/suitability/assessments/${assessmentId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ action: 'submit', submittedByRole: 'consultant' })
    }),
    { params: Promise.resolve({ leadId, assessmentId }) }
  );
  const submitJson = await jsonOf(submitRes);
  if (submitJson.status !== 200) throw new Error(`${label} submit fail: ${JSON.stringify(submitJson.body)}`);
  return { assessmentId, capped: submitJson.body.assessment.cappedRiskProfile };
}

async function jsonOf(res: Response): Promise<{ status: number; body: any }> {
  return { status: res.status, body: await res.json() };
}

// 1. Intake — cria lead
const intakeRes = await intakeRoute.POST(new Request('http://localhost/api/intake', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    fullName: 'Teste Suitability Cycle 1',
    email: `teste-suit-${Date.now()}@example.com`,
    phone: '+5511999999999',
    city: 'Sao Paulo',
    state: 'SP',
    investableAssetsBand: '1m_a_3m',
    primaryChallenge: 'planejamento_e_visao',
    privacyConsentAccepted: true,
    termsConsentAccepted: true,
    intakeFormVersion: 'smoke-v1',
    sourceChannel: 'site_home',
    sourceLabel: 'Smoke Test'
  })
}));
const intakeJson = await jsonOf(intakeRes);
assert.equal(intakeJson.status, 201, `intake should 201, got ${intakeJson.status}: ${JSON.stringify(intakeJson.body)}`);
const leadId = intakeJson.body.leadId ?? intakeJson.body.lead?.leadId;
assert.ok(leadId, 'leadId expected from intake');
console.log(`[smoke] lead criado: ${leadId}`);

// 2. Product category seed
const catRes = await productCategoriesRoute.POST(new Request('http://localhost/api/cockpit/product-categories', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    categoryKey: 'rf_cdb_simples',
    displayName: 'CDB de banco grande',
    status: 'active',
    riskLevel: 'low',
    liquidityRisk: 'short',
    creditRisk: 'low',
    marketRisk: 'low',
    complexityLevel: 'simple',
    hasGuarantee: true,
    guaranteeDescription: 'FGC até R$ 250 mil por CPF/CNPJ por instituição',
    allowedRiskProfiles: ['conservador', 'moderado_conservador', 'moderado', 'moderado_arrojado', 'arrojado'],
    requiredInvestorCategory: null,
    requiresHumanReview: false,
    classificationRationale: 'CDB grande banco com FGC: liquidez curta, baixo risco de crédito.',
    reviewedAt: '2026-04-26T00:00:00.000Z',
    reviewedBy: 'smoke-tester'
  })
}));
const catJson = await jsonOf(catRes);
assert.equal(catJson.status, 201, `product_category 201, got ${catJson.status}: ${JSON.stringify(catJson.body)}`);
const categoryKey = catJson.body.productCategory.categoryKey;
console.log(`[smoke] product_category criada: ${categoryKey}`);

// 3. Suitability — answers cobrindo TODAS as perguntas v1.2026-04, balanceadas para perfil moderado
const answers = {
  objectives: {
    objectives_horizon: '3_5y',
    objectives_primary_goal: 'equilibrio',
    objectives_loss_tolerance: 'lt_15',
    objectives_purpose: 'aposentadoria'
  },
  financial_situation: {
    financial_regular_income_range: '15_50k',
    financial_income_stability: 'estavel',
    financial_total_wealth_range: '500k_1m',
    financial_asset_composition: ['cash_equivalents', 'real_estate'],
    financial_emergency_reserve: '3_6',
    financial_invest_share: '25_50',
    financial_debt_load: 'baixo'
  },
  knowledge_experience: {
    knowledge_general: 'intermediario',
    knowledge_history: 'fundos',
    knowledge_volatility: 'mantive',
    knowledge_operation_nature: ['fixed_income', 'funds'],
    knowledge_operation_volume: '50k_250k',
    knowledge_operation_frequency: 'quarterly',
    knowledge_operation_period: '3_10y',
    knowledge_academic_background: 'higher_finance_related',
    knowledge_professional_experience: 'indirect',
    knowledge_fx_risk_understanding: 'intermediate'
  },
  liquidity_needs: {
    liquidity_known_needs: 'lt_10',
    liquidity_lock_tolerance: '1y'
  },
  restrictions: {
    restrictions_esg: 'preferencias',
    restrictions_concentration: 'parcial',
    restrictions_offshore: 'limitado'
  }
};

const draftRes = await assessmentsRoute.POST(
  new Request(`http://localhost/api/cockpit/leads/${leadId}/suitability/assessments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ questionnaireVersion: 'v1.2026-04', answers })
  }),
  { params: Promise.resolve({ leadId }) }
);
const draftJson = await jsonOf(draftRes);
if (draftJson.status !== 201) {
  console.error('[smoke] draft creation failed:', JSON.stringify(draftJson.body, null, 2));
}
assert.equal(draftJson.status, 201, 'draft should 201');
const assessmentId = draftJson.body.assessment.assessmentId;
console.log(`[smoke] draft criado: ${assessmentId} answersHash=${draftJson.body.assessment.answersHash?.slice(0, 12)}...`);

// 4. Submit
const submitRes = await assessmentRoute.PATCH(
  new Request(`http://localhost/api/cockpit/leads/${leadId}/suitability/assessments/${assessmentId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ action: 'submit', submittedByRole: 'consultant' })
  }),
  { params: Promise.resolve({ leadId, assessmentId }) }
);
const submitJson = await jsonOf(submitRes);
if (submitJson.status !== 200) {
  console.error('[smoke] submit failed:', JSON.stringify(submitJson.body, null, 2));
}
assert.equal(submitJson.status, 200);
const submittedAssessment = submitJson.body.assessment;
console.log(`[smoke] submit: status=${submittedAssessment.status} score=${submittedAssessment.score} computed=${submittedAssessment.computedRiskProfile} capped=${submittedAssessment.cappedRiskProfile} caps=${JSON.parse(submittedAssessment.capsAppliedJson ?? '[]').length} flags=${JSON.parse(submittedAssessment.reviewFlagsJson ?? '[]').length} routedToReview=${submitJson.body.routedToReview}`);
assert.ok(submittedAssessment.score !== null);
assert.ok(submittedAssessment.computedRiskProfile);
assert.ok(submittedAssessment.cappedRiskProfile);
assert.ok(submittedAssessment.scoringCalibrationVersion);
assert.ok(['submitted', 'review_required'].includes(submittedAssessment.status));

// 5. Approve com perfil capped (sem override)
const approveRes = await assessmentRoute.PATCH(
  new Request(`http://localhost/api/cockpit/leads/${leadId}/suitability/assessments/${assessmentId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      action: 'approve',
      approvedRiskProfile: submittedAssessment.cappedRiskProfile,
      validUntil: '2027-04-26',
      approvalNotes: 'Aprovado em smoke test'
    })
  }),
  { params: Promise.resolve({ leadId, assessmentId }) }
);
const approveJson = await jsonOf(approveRes);
if (approveJson.status !== 200) {
  console.error('[smoke] approve failed:', JSON.stringify(approveJson.body, null, 2));
}
assert.equal(approveJson.status, 200);
assert.equal(approveJson.body.assessment.status, 'approved');
assert.equal(approveJson.body.profile.status, 'active');
assert.equal(approveJson.body.profile.riskProfile, submittedAssessment.cappedRiskProfile);
assert.equal(approveJson.body.profile.profileSource, 'consultant_approved');
console.log(`[smoke] approved: profile.riskProfile=${approveJson.body.profile.riskProfile} validUntil=${approveJson.body.profile.validUntil} profileSource=${approveJson.body.profile.profileSource}`);

// 6. Cria recomendação draft
const recRes = await recommendationsRoute.POST(
  new Request(`http://localhost/api/cockpit/leads/${leadId}/recommendations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title: 'Sugestão CDB', body: 'Alocar 30% em CDB de banco grande.', category: 'asset_allocation', createdBy: 'smoke-tester' })
  }),
  { params: Promise.resolve({ leadId }) }
);
const recJson = await jsonOf(recRes);
assert.equal(recJson.status, 201);
const recommendationId = recJson.body.recommendation.recommendationId;
console.log(`[smoke] recommendation criada: ${recommendationId}`);

// 7. Publish — gate deve aprovar (perfil ativo)
const publishRes = await recommendationActionRoute.PATCH(
  new Request(`http://localhost/api/cockpit/leads/${leadId}/recommendations/${recommendationId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({})
  }),
  { params: Promise.resolve({ leadId, recommendationId }) }
);
const publishJson = await jsonOf(publishRes);
assert.equal(publishJson.status, 200, `publish should 200, got ${publishJson.status}: ${JSON.stringify(publishJson.body)}`);
assert.equal(publishJson.body.suitabilityGate.decision, 'allowed');
console.log(`[smoke] publish OK com gate=${publishJson.body.suitabilityGate.decision}`);

// 8. Cria SEGUNDO lead sem suitability — gate deve BLOQUEAR
const intake2Res = await intakeRoute.POST(new Request('http://localhost/api/intake', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    fullName: 'Lead Sem Suitability',
    email: `sem-suit-${Date.now()}@example.com`,
    phone: '+5511988887777',
    city: 'Sao Paulo',
    state: 'SP',
    investableAssetsBand: '1m_a_3m',
    primaryChallenge: 'planejamento_e_visao',
    privacyConsentAccepted: true,
    termsConsentAccepted: true,
    intakeFormVersion: 'smoke-v1',
    sourceChannel: 'site_home',
    sourceLabel: 'Smoke Test'
  })
}));
const intake2Json = await jsonOf(intake2Res);
const leadIdNoSuit = intake2Json.body.leadId ?? intake2Json.body.lead?.leadId;
assert.ok(leadIdNoSuit);

const recNoSuitRes = await recommendationsRoute.POST(
  new Request(`http://localhost/api/cockpit/leads/${leadIdNoSuit}/recommendations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title: 'Bloqueio esperado', body: 'corpo', category: 'general', createdBy: 'smoke-tester' })
  }),
  { params: Promise.resolve({ leadId: leadIdNoSuit }) }
);
const recNoSuitJson = await jsonOf(recNoSuitRes);
assert.equal(recNoSuitJson.status, 201);
const recIdNoSuit = recNoSuitJson.body.recommendation.recommendationId;

const blockedPublishRes = await recommendationActionRoute.PATCH(
  new Request(`http://localhost/api/cockpit/leads/${leadIdNoSuit}/recommendations/${recIdNoSuit}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({})
  }),
  { params: Promise.resolve({ leadId: leadIdNoSuit, recommendationId: recIdNoSuit }) }
);
const blockedJson = await jsonOf(blockedPublishRes);
assert.equal(blockedJson.status, 422);
assert.equal(blockedJson.body.error, 'suitability_gate_blocked');
assert.equal(blockedJson.body.decision, 'blocked_missing_profile');
console.log(`[smoke] gate bloqueou publish: decision=${blockedJson.body.decision} reasons=${blockedJson.body.reasons.join(',')}`);

// 9. Override consciente — passa por causa do overrideReason
const overridePublishRes = await recommendationActionRoute.PATCH(
  new Request(`http://localhost/api/cockpit/leads/${leadIdNoSuit}/recommendations/${recIdNoSuit}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ overrideSuitabilityGate: true, overrideReason: 'Cliente já assinou suitability em papel; perfil será cadastrado em sequência (smoke).' })
  }),
  { params: Promise.resolve({ leadId: leadIdNoSuit, recommendationId: recIdNoSuit }) }
);
const overrideJson = await jsonOf(overridePublishRes);
assert.equal(overrideJson.status, 200);
console.log(`[smoke] override OK; recommendation publicada apesar do bloqueio`);

// 10. Audit trail
const { DatabaseSync } = await import('node:sqlite');
const sqliteDb = new DatabaseSync(path.join(tempRoot, 'data', 'dev', 'savastano-advisory.sqlite3'), { readOnly: true });

const suitabilityActions = sqliteDb.prepare(`
  SELECT action FROM audit_log WHERE lead_id = ? AND action LIKE 'suitability.%' ORDER BY created_at ASC
`).all(leadId) as Array<{ action: string }>;
console.log(`[smoke] suitability audit (${suitabilityActions.length}): ${suitabilityActions.map((r) => r.action).join(', ')}`);
assert.ok(suitabilityActions.length >= 3);

const overrideActions = sqliteDb.prepare(`
  SELECT action, detail FROM audit_log WHERE lead_id = ? AND action = 'recommendation.suitability_gate_overridden'
`).all(leadIdNoSuit) as Array<{ action: string; detail: string | null }>;
assert.equal(overrideActions.length, 1);
console.log(`[smoke] override audit registrado: ${overrideActions[0].action}`);

const productCategoryActions = sqliteDb.prepare(`
  SELECT action FROM audit_log WHERE entity_type = 'product_category'
`).all() as Array<{ action: string }>;
assert.ok(productCategoryActions.some((r) => r.action === 'product_category.created'));

sqliteDb.close();

// ----------------------------------------------------------------------------
// Cycle 1.5 — clarification round-trip + supersede manual + cron de expiração
// ----------------------------------------------------------------------------

console.log('[smoke] --- Cycle 1.5 scenarios ---');

// 1.5.A — clarification round-trip
const leadIdClarify = await createIntakeLead('Lead Clarification Roundtrip');
const { assessmentId: assessmentIdClarify, capped: cappedClarify } = await createDraftAndSubmit(leadIdClarify, 'clarify');
console.log(`[smoke 1.5] clarify lead criado, assessment=${assessmentIdClarify}, capped=${cappedClarify}`);

const reqClarRes = await assessmentRoute.PATCH(
  new Request(`http://localhost/api/cockpit/leads/${leadIdClarify}/suitability/assessments/${assessmentIdClarify}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ action: 'request_clarification', message: 'Confirme a faixa de patrimônio total — está incompatível com a renda declarada.' })
  }),
  { params: Promise.resolve({ leadId: leadIdClarify, assessmentId: assessmentIdClarify }) }
);
const reqClarJson = await jsonOf(reqClarRes);
assert.equal(reqClarJson.status, 200, `request_clarification 200, got ${reqClarJson.status}: ${JSON.stringify(reqClarJson.body)}`);
assert.equal(reqClarJson.body.assessment.status, 'needs_clarification');
const reqList = JSON.parse(reqClarJson.body.assessment.clarificationRequestsJson ?? '[]');
assert.equal(reqList.length, 1);
console.log(`[smoke 1.5] clarification solicitada — status=${reqClarJson.body.assessment.status} requests=${reqList.length}`);

// resubmit com novas respostas (cliente corrige patrimônio)
const updatedAnswers = JSON.parse(JSON.stringify(BALANCED_ANSWERS));
updatedAnswers.financial_situation.financial_total_wealth_range = '1m_10m';
const resubmitRes = await assessmentRoute.PATCH(
  new Request(`http://localhost/api/cockpit/leads/${leadIdClarify}/suitability/assessments/${assessmentIdClarify}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ action: 'resubmit', submittedByRole: 'client', answers: updatedAnswers })
  }),
  { params: Promise.resolve({ leadId: leadIdClarify, assessmentId: assessmentIdClarify }) }
);
const resubmitJson = await jsonOf(resubmitRes);
assert.equal(resubmitJson.status, 200, `resubmit 200, got ${resubmitJson.status}: ${JSON.stringify(resubmitJson.body)}`);
assert.ok(['submitted', 'review_required'].includes(resubmitJson.body.assessment.status));
assert.equal(resubmitJson.body.assessment.submittedByRole, 'client');
console.log(`[smoke 1.5] resubmit OK — status=${resubmitJson.body.assessment.status} role=${resubmitJson.body.assessment.submittedByRole}`);

// approve depois do resubmit
const approveAfterClarRes = await assessmentRoute.PATCH(
  new Request(`http://localhost/api/cockpit/leads/${leadIdClarify}/suitability/assessments/${assessmentIdClarify}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      action: 'approve',
      approvedRiskProfile: resubmitJson.body.assessment.cappedRiskProfile,
      validUntil: '2027-04-26',
      approvalNotes: 'Aprovado após clarificação no smoke'
    })
  }),
  { params: Promise.resolve({ leadId: leadIdClarify, assessmentId: assessmentIdClarify }) }
);
assert.equal(approveAfterClarRes.status, 200);
console.log(`[smoke 1.5] approve após clarificação OK`);

// 1.5.B — clarification em estado `approved` deve falhar
const reqClarOnApprovedRes = await assessmentRoute.PATCH(
  new Request(`http://localhost/api/cockpit/leads/${leadIdClarify}/suitability/assessments/${assessmentIdClarify}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ action: 'request_clarification', message: 'Já aprovado, deve falhar' })
  }),
  { params: Promise.resolve({ leadId: leadIdClarify, assessmentId: assessmentIdClarify }) }
);
const reqClarOnApprovedJson = await jsonOf(reqClarOnApprovedRes);
assert.equal(reqClarOnApprovedJson.status, 422);
assert.equal(reqClarOnApprovedJson.body.error, 'invalid_transition');
console.log(`[smoke 1.5] clarification em approved bloqueado corretamente: ${reqClarOnApprovedJson.body.error}`);

// 1.5.C — supersede manual via rota
// Cria 2º assessment para o mesmo lead (clarify) e marca o 1º (já approved) como superseded manualmente.
// Observação: o approve normal do Cycle 1 já faz supersession automática quando há novo approve;
// aqui exercitamos o supersede manual antes de aprovar o 2º.
const draftSecondRes = await assessmentsRoute.POST(
  new Request(`http://localhost/api/cockpit/leads/${leadIdClarify}/suitability/assessments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ questionnaireVersion: 'v1.2026-04', answers: BALANCED_ANSWERS })
  }),
  { params: Promise.resolve({ leadId: leadIdClarify }) }
);
const draftSecondJson = await jsonOf(draftSecondRes);
const assessmentIdSecond = draftSecondJson.body.assessment.assessmentId;

const supersedeRes = await assessmentRoute.PATCH(
  new Request(`http://localhost/api/cockpit/leads/${leadIdClarify}/suitability/assessments/${assessmentIdClarify}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ action: 'supersede', supersededByAssessmentId: assessmentIdSecond })
  }),
  { params: Promise.resolve({ leadId: leadIdClarify, assessmentId: assessmentIdClarify }) }
);
const supersedeJson = await jsonOf(supersedeRes);
assert.equal(supersedeJson.status, 200);
assert.equal(supersedeJson.body.assessment.status, 'superseded');
assert.equal(supersedeJson.body.assessment.supersededByAssessmentId, assessmentIdSecond);
console.log(`[smoke 1.5] supersede manual OK`);

// 1.5.D — expire automático via cron interno
// Cria novo lead/assessment e aprova com validUntil = ontem; chama o cron e verifica expired.
const leadIdExpire = await createIntakeLead('Lead Expire Cron');
const { assessmentId: assessmentIdExpire } = await createDraftAndSubmit(leadIdExpire, 'expire');

const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const expireApproveRes = await assessmentRoute.PATCH(
  new Request(`http://localhost/api/cockpit/leads/${leadIdExpire}/suitability/assessments/${assessmentIdExpire}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      action: 'approve',
      validUntil: yesterday,
      approvalNotes: 'Validade já vencida para testar cron'
    })
  }),
  { params: Promise.resolve({ leadId: leadIdExpire, assessmentId: assessmentIdExpire }) }
);
assert.equal(expireApproveRes.status, 200, 'approve com validUntil ontem deve aceitar (validação é só formato)');

// Cron sem token → 401
const cronNoAuthRes = await cronExpireRoute.POST(new Request('http://localhost/api/internal/cron/suitability-expire', {
  method: 'POST',
  headers: { 'content-type': 'application/json' }
}));
assert.equal(cronNoAuthRes.status, 401);
console.log(`[smoke 1.5] cron sem token bloqueado: 401`);

// Cron com token errado → 401
const cronBadAuthRes = await cronExpireRoute.POST(new Request('http://localhost/api/internal/cron/suitability-expire', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-internal-cron-token': 'token-errado' }
}));
assert.equal(cronBadAuthRes.status, 401);

// Cron com token correto → expira o lead acima
const cronOkRes = await cronExpireRoute.POST(new Request('http://localhost/api/internal/cron/suitability-expire', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-internal-cron-token': TEST_INTERNAL_CRON_TOKEN }
}));
const cronOkJson = await jsonOf(cronOkRes);
assert.equal(cronOkJson.status, 200);
assert.ok(cronOkJson.body.expiredCount >= 1);
assert.ok(cronOkJson.body.assessmentIds.includes(assessmentIdExpire));
console.log(`[smoke 1.5] cron OK — expiredCount=${cronOkJson.body.expiredCount}`);

// Conferir status no DB
const sqliteDb2 = new DatabaseSync(path.join(tempRoot, 'data', 'dev', 'savastano-advisory.sqlite3'), { readOnly: true });
const expiredRow = sqliteDb2.prepare(`SELECT status FROM suitability_assessments WHERE assessment_id = ?`).get(assessmentIdExpire) as { status: string };
assert.equal(expiredRow.status, 'expired');
const expiredProfile = sqliteDb2.prepare(`SELECT status FROM client_profiles WHERE lead_id = ?`).get(leadIdExpire) as { status: string };
assert.equal(expiredProfile.status, 'expired');

const cycleAuditActions = sqliteDb2.prepare(`
  SELECT action FROM audit_log
  WHERE action LIKE 'suitability.%'
    AND lead_id IN (?, ?)
  ORDER BY created_at ASC
`).all(leadIdClarify, leadIdExpire) as Array<{ action: string }>;
const allActions = cycleAuditActions.map((r) => r.action);
assert.ok(allActions.includes('suitability.clarification_requested'));
assert.ok(allActions.includes('suitability.resubmitted'));
assert.ok(allActions.includes('suitability.superseded.manual'));
assert.ok(allActions.includes('suitability.expired.cron'));
console.log(`[smoke 1.5] audit actions verificadas: ${[...new Set(allActions)].join(', ')}`);
sqliteDb2.close();

console.log('[smoke] OK — AI-3 Cycles 1 + 1.5 end-to-end via rotas HTTP.');
