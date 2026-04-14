import { listDocuments } from '../../../../../../lib/intake-storage';

export async function GET(_request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  return Response.json({ ok: true, documents: listDocuments(leadId) });
}
