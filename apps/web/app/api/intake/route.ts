import { sourceChannelValues, validatePublicIntakePayload } from '@bruno-advisory/core/intake-contract';
import { persistLeadFromIntake, recordIntakeEvent } from '../../../lib/intake-storage';

type IntakeRequestPayload = {
  sourceChannel?: string;
  sourceCampaign?: string;
  sourceMedium?: string;
  sourceContent?: string;
  [key: string]: unknown;
};

function toSourceChannel(value: string | undefined) {
  if (value && sourceChannelValues.includes(value as (typeof sourceChannelValues)[number])) {
    return value as (typeof sourceChannelValues)[number];
  }

  return 'site_home';
}

export async function POST(request: Request) {
  let body: IntakeRequestPayload;

  try {
    body = (await request.json()) as IntakeRequestPayload;
  } catch {
    return Response.json({ ok: false, errors: [{ field: 'payload', message: 'JSON inválido.' }] }, { status: 400 });
  }

  const sourceChannel = toSourceChannel(body.sourceChannel);

  recordIntakeEvent({
    eventName: 't2_intake_submitted',
    occurredAt: new Date().toISOString(),
    metadata: { sourceChannel }
  });

  const validation = validatePublicIntakePayload(body);

  if (!validation.ok) {
    recordIntakeEvent({
      eventName: 't2_intake_submit_failed',
      occurredAt: new Date().toISOString(),
      metadata: { reason: 'validation_error', errorCount: validation.errors.length }
    });

    return Response.json({ ok: false, errors: validation.errors }, { status: 400 });
  }

  const lead = persistLeadFromIntake({
    payload: validation.data,
    sourceChannel,
    sourceCampaign: typeof body.sourceCampaign === 'string' ? body.sourceCampaign : undefined,
    sourceMedium: typeof body.sourceMedium === 'string' ? body.sourceMedium : undefined,
    sourceContent: typeof body.sourceContent === 'string' ? body.sourceContent : undefined
  });

  recordIntakeEvent({
    eventName: 't2_intake_submit_succeeded',
    occurredAt: new Date().toISOString(),
    metadata: { leadId: lead.leadId, sourceChannel }
  });

  return Response.json({ ok: true, leadId: lead.leadId }, { status: 201 });
}
