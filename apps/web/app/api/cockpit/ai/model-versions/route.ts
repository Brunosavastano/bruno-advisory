// Admin route to inspect and govern AI model versions.
// GET — list versions (filterable by status). Operator-level auth.
// POST — register a new candidate. Admin-only.
// PATCH — transition a version (candidate→active, active→deprecated, etc.). Admin-only.
//
// Model upgrades go through this route. Auto-promotion is intentionally NOT implemented.

import { aiModelVersionStatuses, type AiModelVersionStatus } from '@savastano-advisory/core';
import {
  listModelVersions,
  registerModelVersion,
  transitionModelVersion
} from '../../../../../lib/storage/ai-model-versions';
import { requireCockpitAdmin, requireCockpitSession } from '../../../../../lib/cockpit-session';

type RegisterPayload = {
  provider?: string;
  modelId?: string;
  displayName?: string;
  inputPriceJson?: string | null;
  outputPriceJson?: string | null;
  notes?: string | null;
};

type TransitionPayload = {
  modelVersionId?: string;
  toStatus?: string;
};

function isModelVersionStatus(value: string): value is AiModelVersionStatus {
  return aiModelVersionStatuses.includes(value as AiModelVersionStatus);
}

export async function GET(request: Request) {
  const check = await requireCockpitSession(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  const filter = statusParam && isModelVersionStatus(statusParam) ? { status: statusParam } : {};

  return Response.json({ ok: true, versions: listModelVersions(filter) });
}

export async function POST(request: Request) {
  const check = await requireCockpitAdmin(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const payload = (await request.json().catch(() => ({}))) as RegisterPayload;
  const provider = payload.provider?.trim();
  const modelId = payload.modelId?.trim();
  const displayName = payload.displayName?.trim();

  if (!provider || !modelId || !displayName) {
    return Response.json({ ok: false, error: 'missing_fields', reason: 'provider, modelId, displayName required' }, { status: 400 });
  }

  try {
    const version = registerModelVersion({
      provider,
      modelId,
      displayName,
      inputPriceJson: payload.inputPriceJson ?? null,
      outputPriceJson: payload.outputPriceJson ?? null,
      notes: payload.notes ?? null,
      actorId: check.context.actorId
    });
    return Response.json({ ok: true, version }, { status: 201 });
  } catch (error) {
    return Response.json(
      { ok: false, error: 'register_failed', reason: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const check = await requireCockpitAdmin(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const payload = (await request.json().catch(() => ({}))) as TransitionPayload;
  const modelVersionId = payload.modelVersionId?.trim();
  const toStatus = payload.toStatus?.trim();

  if (!modelVersionId || !toStatus || !isModelVersionStatus(toStatus)) {
    return Response.json({ ok: false, error: 'invalid_payload', reason: 'modelVersionId and valid toStatus required' }, { status: 400 });
  }

  try {
    const updated = transitionModelVersion({ modelVersionId, toStatus, actorId: check.context.actorId });
    if (!updated) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
    return Response.json({ ok: true, version: updated });
  } catch (error) {
    return Response.json(
      { ok: false, error: 'transition_failed', reason: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
