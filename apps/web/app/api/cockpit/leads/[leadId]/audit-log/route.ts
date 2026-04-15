import { listAuditLog } from '../../../../../../lib/intake-storage';

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, parsed);
}

export async function GET(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  const url = new URL(request.url);
  const limit = parsePositiveInt(url.searchParams.get('limit'), 20);
  const offset = parsePositiveInt(url.searchParams.get('offset'), 0);
  const entries = listAuditLog({ leadId, limit, offset });

  return Response.json({ ok: true, leadId, entries, filters: { leadId, limit, offset } });
}
