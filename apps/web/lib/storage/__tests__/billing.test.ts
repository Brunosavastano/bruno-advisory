import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
// @ts-expect-error node:test runtime imports TS source directly for canonical constants
import { commercialStageModel } from '../../../../../packages/core/src/commercial-stage-model.ts';
// @ts-expect-error node:test runtime imports TS source directly for canonical constants
import { localBillingChargeModel } from '../../../../../packages/core/src/local-billing-charge-model.ts';
// @ts-expect-error node:test runtime imports TS source directly for canonical constants
import { localBillingModel } from '../../../../../packages/core/src/local-billing-model.ts';
// @ts-expect-error node:test runtime imports TS source directly for canonical constants
import { localBillingSettlementModel } from '../../../../../packages/core/src/local-billing-settlement-model.ts';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(import.meta.dirname, '../../../../../');
const webDir = path.join(repoRoot, 'apps', 'web');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-billing-node-test-'));

fs.writeFileSync(path.join(tempRoot, 'project.yaml'), 'project: test\n');
fs.symlinkSync(path.join(repoRoot, 'apps'), path.join(tempRoot, 'apps'), 'dir');
fs.symlinkSync(path.join(repoRoot, 'packages'), path.join(tempRoot, 'packages'), 'dir');
process.chdir(tempRoot);
process.on('exit', () => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

function loadUserland(modulePath: string) {
  return require(path.join(webDir, '.next', 'server', 'app', ...modulePath.split('/'), 'route.js')).routeModule.userland;
}

const intakeRoute = loadUserland('api/intake');
const tasksRoute = loadUserland('api/cockpit/leads/[leadId]/tasks');
const taskStatusRoute = loadUserland('api/cockpit/leads/[leadId]/tasks/[taskId]/status');
const stageRoute = loadUserland('api/cockpit/leads/[leadId]/commercial-stage');
const billingReadinessRoute = loadUserland('api/cockpit/leads/[leadId]/billing-readiness');
const billingRecordRoute = loadUserland('api/cockpit/leads/[leadId]/billing-record');
const billingChargeRoute = loadUserland('api/cockpit/leads/[leadId]/billing-charges');
const nextBillingChargeRoute = loadUserland('api/cockpit/leads/[leadId]/billing-charges/next');
const targetedSettlementRoute = loadUserland('api/cockpit/leads/[leadId]/billing-settlements/[chargeId]');

async function json(response: Response) {
  return { status: response.status, body: await response.json() };
}

async function createLead(label: string) {
  const response = await json(
    await intakeRoute.POST(
      new Request('http://localhost/api/intake', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName: `Billing Test ${label}`,
          email: `${label}-${randomUUID()}@example.com`,
          phone: '+55 11 99999-0000',
          city: 'Brasilia',
          state: 'DF',
          investableAssetsBand: '3m_a_10m',
          primaryChallenge: 'Organizar operacao local de billing',
          sourceLabel: label,
          privacyConsentAccepted: true,
          termsConsentAccepted: true
        })
      })
    )
  );

  assert.equal(response.status, 201);
  return response.body.leadId as string;
}

async function createTask(leadId: string, title: string, status: 'todo' | 'in_progress' | 'done' = 'todo') {
  const response = await json(
    await tasksRoute.POST(
      new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, status, dueDate: '2026-05-01' })
      }),
      { params: Promise.resolve({ leadId }) }
    )
  );

  assert.equal(response.status, 201);
  return response.body.task.taskId as string;
}

async function markTaskDone(leadId: string, taskId: string) {
  const response = await json(
    await taskStatusRoute.POST(
      new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks/${taskId}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ toStatus: 'done', changedBy: 'test_operator' })
      }),
      { params: Promise.resolve({ leadId, taskId }) }
    )
  );

  assert.equal(response.status, 200);
  return response.body;
}

async function setClientConverted(leadId: string) {
  const response = await json(
    await stageRoute.POST(
      new Request(`http://localhost/api/cockpit/leads/${leadId}/commercial-stage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ toStage: 'cliente_convertido', changedBy: 'test_operator' })
      }),
      { params: Promise.resolve({ leadId }) }
    )
  );

  assert.equal(response.status, 200);
  return response.body;
}

async function getReadiness(leadId: string) {
  return json(
    await billingReadinessRoute.GET(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-readiness`), {
      params: Promise.resolve({ leadId })
    })
  );
}

async function activateBilling(leadId: string) {
  return json(
    await billingRecordRoute.POST(
      new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-record`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ actor: 'test_operator' })
      }),
      { params: Promise.resolve({ leadId }) }
    )
  );
}

async function createCharge(leadId: string) {
  return json(
    await billingChargeRoute.POST(
      new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-charges`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ actor: 'test_operator' })
      }),
      { params: Promise.resolve({ leadId }) }
    )
  );
}

async function settleCharge(leadId: string, chargeId: string) {
  return json(
    await targetedSettlementRoute.POST(
      new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-settlements/${chargeId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ actor: 'test_operator', note: 'route settle' })
      }),
      { params: Promise.resolve({ leadId, chargeId }) }
    )
  );
}

async function createNextCharge(leadId: string) {
  return json(
    await nextBillingChargeRoute.POST(
      new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-charges/next`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ actor: 'test_operator' })
      }),
      { params: Promise.resolve({ leadId }) }
    )
  );
}

async function createReadyLead(label: string) {
  const leadId = await createLead(label);
  const taskId = await createTask(leadId, 'Checklist pronta');
  await markTaskDone(leadId, taskId);
  await setClientConverted(leadId);
  return { leadId, taskId };
}

test('1. Billing readiness blocks when commercialStage is not cliente_convertido', { concurrency: false }, async () => {
  const leadId = await createLead('readiness-stage-blocked');
  await createTask(leadId, 'Qualificar lead', 'done');
  const result = await getReadiness(leadId);

  assert.equal(result.status, 200);
  assert.equal(result.body.readiness.isBillingReady, false);
  assert.equal(result.body.readiness.currentCommercialStage, commercialStageModel.defaultStage);
  assert.ok(result.body.readiness.unmetConditions.includes('commercial_stage_cliente_convertido'));
});

test('2. Billing readiness blocks when tasks exist and none are done', { concurrency: false }, async () => {
  const leadId = await createLead('readiness-task-blocked');
  await setClientConverted(leadId);
  await createTask(leadId, 'Task A', 'todo');
  await createTask(leadId, 'Task B', 'in_progress');
  const result = await getReadiness(leadId);

  assert.equal(result.status, 200);
  assert.equal(result.body.readiness.isBillingReady, false);
  assert.equal(result.body.readiness.doneTasks, 0);
  assert.equal(result.body.readiness.pendingTasks, 2);
  assert.ok(result.body.readiness.unmetConditions.includes('all_internal_tasks_done'));
});

test('3. Billing readiness passes when stage is cliente_convertido and all tasks are done', { concurrency: false }, async () => {
  const leadId = await createLead('readiness-pass');
  const taskA = await createTask(leadId, 'Task A', 'done');
  const taskB = await createTask(leadId, 'Task B', 'todo');
  await markTaskDone(leadId, taskB);
  await setClientConverted(leadId);
  const result = await getReadiness(leadId);

  assert.equal(result.status, 200);
  assert.equal(result.body.readiness.isBillingReady, true);
  assert.equal(result.body.readiness.totalTasks, 2);
  assert.equal(result.body.readiness.doneTasks, 2);
  assert.deepEqual(result.body.readiness.unmetConditions, []);
  assert.equal(typeof taskA, 'string');
});

test('4. Billing activation blocks when readiness check fails', { concurrency: false }, async () => {
  const leadId = await createLead('activation-blocked');
  const result = await activateBilling(leadId);

  assert.equal(result.status, 422);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, 'BILLING_NOT_READY');
});

test('5. Billing activation succeeds when ready and creates active_local billingRecord', { concurrency: false }, async () => {
  const { leadId } = await createReadyLead('activation-success');
  const result = await activateBilling(leadId);

  assert.equal(result.status, 201);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.billingRecord.status, localBillingModel.initialRecordStatus);
  assert.equal(typeof result.body.billingRecord.activatedAt, 'string');
});

test('6. Charge creation blocks when there is no active billing record', { concurrency: false }, async () => {
  const { leadId } = await createReadyLead('charge-blocked');
  const result = await createCharge(leadId);

  assert.equal(result.status, 422);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, 'ACTIVE_BILLING_RECORD_REQUIRED');
});

test('7. Charge creation succeeds after activation and creates pending_local charge', { concurrency: false }, async () => {
  const { leadId } = await createReadyLead('charge-success');
  await activateBilling(leadId);
  const result = await createCharge(leadId);

  assert.equal(result.status, 201);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.charge.status, localBillingChargeModel.initialChargeStatus);
  assert.equal(result.body.charge.chargeSequence, localBillingChargeModel.firstChargeSequence);
});

test('8. Targeted settlement blocks missing charge with 404', { concurrency: false }, async () => {
  const { leadId } = await createReadyLead('settlement-missing');
  await activateBilling(leadId);
  const result = await settleCharge(leadId, 'missing-charge-id');

  assert.equal(result.status, 404);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, 'CHARGE_NOT_FOUND');
});

test('9. Targeted settlement blocks foreign charge with 422', { concurrency: false }, async () => {
  const owner = await createReadyLead('settlement-owner');
  await activateBilling(owner.leadId);
  const ownerCharge = await createCharge(owner.leadId);

  const foreign = await createReadyLead('settlement-foreign');
  await activateBilling(foreign.leadId);
  const result = await settleCharge(foreign.leadId, ownerCharge.body.charge.chargeId);

  assert.equal(result.status, 422);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, 'CHARGE_NOT_OWNED_BY_LEAD');
});

test('10. Targeted settlement blocks already settled charge with 409', { concurrency: false }, async () => {
  const { leadId } = await createReadyLead('settlement-settled');
  await activateBilling(leadId);
  const firstSettlement = await createCharge(leadId);
  await settleCharge(leadId, firstSettlement.body.charge.chargeId);
  const result = await settleCharge(leadId, firstSettlement.body.charge.chargeId);

  assert.equal(result.status, 409);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, 'CHARGE_ALREADY_SETTLED');
});

test('11. Targeted settlement succeeds for pending charge with 201 and settled_local status', { concurrency: false }, async () => {
  const { leadId } = await createReadyLead('settlement-success');
  await activateBilling(leadId);
  const chargeResult = await createCharge(leadId);
  const result = await settleCharge(leadId, chargeResult.body.charge.chargeId);

  assert.equal(result.status, 201);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.charge.status, localBillingSettlementModel.resultingChargeStatus);
  assert.equal(result.body.settlement.status, localBillingSettlementModel.resultingChargeStatus);
});

test('12. Charge progression blocks when latest charge is still pending', { concurrency: false }, async () => {
  const { leadId } = await createReadyLead('progression-blocked');
  await activateBilling(leadId);
  await createCharge(leadId);
  const result = await createNextCharge(leadId);

  assert.equal(result.status, 422);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, 'PENDING_RECURRING_CHARGE_EXISTS');
});

test('13. Charge progression succeeds after settlement with chargeSequence + 1', { concurrency: false }, async () => {
  const { leadId } = await createReadyLead('progression-success');
  await activateBilling(leadId);
  const firstCharge = await createCharge(leadId);
  await settleCharge(leadId, firstCharge.body.charge.chargeId);
  const result = await createNextCharge(leadId);

  assert.equal(result.status, 201);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.charge.status, localBillingChargeModel.initialChargeStatus);
  assert.equal(result.body.charge.chargeSequence, 2);
  assert.equal(result.body.previousCharge.status, localBillingSettlementModel.resultingChargeStatus);
});