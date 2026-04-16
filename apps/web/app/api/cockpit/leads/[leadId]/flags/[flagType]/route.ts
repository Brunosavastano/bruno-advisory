import { pendingFlagTypes, type PendingFlagType } from '@savastano-advisory/core';
import { clearFlag } from '../../../../../../../lib/intake-storage';

function isPendingFlagType(value: string): value is PendingFlagType {
  return pendingFlagTypes.includes(value as PendingFlagType);
}

export async function DELETE(request: Request, context: { params: Promise<{ leadId: string; flagType: string }> }) {
  const { leadId, flagType } = await context.params;
  const body = (await request.json()) as { clearedBy?: string };

  if (!isPendingFlagType(flagType) || !body?.clearedBy?.trim()) {
    return Response.json({ ok: false, error: 'Invalid clear flag payload.' }, { status: 400 });
  }

  const flag = clearFlag(leadId, flagType, body.clearedBy);
  if (!flag) {
    return Response.json({ ok: false, error: 'Active flag not found.' }, { status: 404 });
  }

  return Response.json({ ok: true, flag });
}
