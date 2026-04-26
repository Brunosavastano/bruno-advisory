// AI-2 Cycle 1: list AI jobs for a lead. Operator visibility into what ran, status, cost, latency.
// GET /api/cockpit/leads/[leadId]/ai/jobs?status=succeeded&limit=50

import { aiJobStatuses, type AiJobStatus } from '@savastano-advisory/core';
import { listAiJobs } from '../../../../../../../lib/storage/ai-jobs';
import { requireCockpitSession } from '../../../../../../../lib/cockpit-session';

function isStatus(value: string): value is AiJobStatus {
  return aiJobStatuses.includes(value as AiJobStatus);
}

export async function GET(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const check = await requireCockpitSession(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const { leadId } = await context.params;
  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  const limitParam = url.searchParams.get('limit');

  const status = statusParam && isStatus(statusParam) ? statusParam : undefined;
  const limit = limitParam ? Math.min(500, Math.max(1, Number.parseInt(limitParam, 10) || 50)) : 50;

  const jobs = listAiJobs({ leadId, status, limit });
  return Response.json({ ok: true, jobs });
}
