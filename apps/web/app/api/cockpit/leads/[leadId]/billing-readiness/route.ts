import { getLeadBillingReadiness } from '../../../../../../lib/intake-storage';

export async function GET(_request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  const readiness = getLeadBillingReadiness(leadId);

  if (!readiness) {
    return Response.json({ ok: false, error: 'Lead nao encontrado.' }, { status: 404 });
  }

  return Response.json({ ok: true, readiness }, { status: 200 });
}
