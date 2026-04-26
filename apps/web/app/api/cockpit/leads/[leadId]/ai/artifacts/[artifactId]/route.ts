// AI-2 Cycle 1: approve / reject / archive an ai_artifact from the review queue.
// PATCH /api/cockpit/leads/[leadId]/ai/artifacts/[artifactId]
// Body: { status: 'approved' | 'rejected' | 'archived', rejectionReason?: string }
//
// Storage layer enforces the transition rules (pending_review → approved/rejected/archived) and
// audit log captures every state change with the operator's actorId.

import { aiArtifactStatuses, type AiArtifactStatus } from '@savastano-advisory/core';
import {
  archiveArtifact,
  getAiArtifact,
  updateArtifactStatus
} from '../../../../../../../../lib/storage/ai-artifacts';
import { requireCockpitSession } from '../../../../../../../../lib/cockpit-session';

type PatchPayload = {
  status?: string;
  rejectionReason?: string | null;
};

function isArtifactStatus(value: string): value is AiArtifactStatus {
  return aiArtifactStatuses.includes(value as AiArtifactStatus);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ leadId: string; artifactId: string }> }
) {
  const check = await requireCockpitSession(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const { leadId, artifactId } = await context.params;

  const current = getAiArtifact(artifactId);
  if (!current || current.leadId !== leadId) {
    return Response.json({ ok: false, error: 'artifact_not_found' }, { status: 404 });
  }

  const payload = (await request.json().catch(() => ({}))) as PatchPayload;
  const status = payload.status?.trim();
  if (!status || !isArtifactStatus(status)) {
    return Response.json({ ok: false, error: 'invalid_status' }, { status: 400 });
  }

  try {
    if (status === 'archived') {
      const updated = archiveArtifact({ artifactId, actorId: check.context.actorId });
      if (!updated) return Response.json({ ok: false, error: 'transition_failed' }, { status: 400 });
      return Response.json({ ok: true, artifact: updated });
    }

    const updated = updateArtifactStatus({
      artifactId,
      status,
      reviewedBy: check.context.actorId,
      rejectionReason: payload.rejectionReason ?? null,
      actorId: check.context.actorId
    });
    if (!updated) return Response.json({ ok: false, error: 'transition_failed' }, { status: 400 });
    return Response.json({ ok: true, artifact: updated });
  } catch (error) {
    return Response.json(
      { ok: false, error: 'transition_failed', reason: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ leadId: string; artifactId: string }> }
) {
  const check = await requireCockpitSession(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const { leadId, artifactId } = await context.params;
  const artifact = getAiArtifact(artifactId);
  if (!artifact || artifact.leadId !== leadId) {
    return Response.json({ ok: false, error: 'artifact_not_found' }, { status: 404 });
  }
  return Response.json({ ok: true, artifact });
}
