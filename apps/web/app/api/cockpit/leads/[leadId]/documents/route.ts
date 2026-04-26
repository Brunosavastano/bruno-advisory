import { listDocuments } from '../../../../../../lib/intake-storage';
import { requireCockpitSession } from '../../../../../../lib/cockpit-session';

export async function GET(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const check = await requireCockpitSession(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const { leadId } = await context.params;
  return Response.json({ ok: true, documents: listDocuments(leadId) });
}
