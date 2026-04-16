import { pendingFlagTypes, type PendingFlagType } from '@savastano-advisory/core';
import { listActiveFlags, setFlag } from '../../../../../../lib/intake-storage';

function isPendingFlagType(value: string): value is PendingFlagType {
  return pendingFlagTypes.includes(value as PendingFlagType);
}

export async function GET(_request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  return Response.json({ ok: true, flags: listActiveFlags(leadId) });
}

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  const body = (await request.json()) as { flagType?: string; note?: string; setBy?: string };

  if (!body?.flagType || !isPendingFlagType(body.flagType) || !body?.setBy?.trim()) {
    return Response.json({ ok: false, error: 'Invalid pending flag payload.' }, { status: 400 });
  }

  const flag = setFlag(leadId, body.flagType, body.setBy, body.note);
  if (!flag) {
    return Response.json({ ok: false, error: 'Lead not found or invalid flag.' }, { status: 404 });
  }

  return Response.json({ ok: true, flag }, { status: 201 });
}
