import { listAllAuditLog, listAuditLog } from '../../../../lib/intake-storage';

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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const leadId = url.searchParams.get('leadId')?.trim() || null;
  const limit = parsePositiveInt(url.searchParams.get('limit'), 20);
  const offset = parsePositiveInt(url.searchParams.get('offset'), 0);
  const entries = leadId
    ? listAuditLog({ leadId, limit, offset })
    : listAllAuditLog({ limit, offset });

  return Response.json({ ok: true, entries, filters: { leadId, limit, offset } });
}
