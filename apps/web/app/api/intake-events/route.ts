import { type IntakeAnalyticsEvent } from '@bruno-advisory/core/intake-contract';
import { recordIntakeEvent } from '../../../lib/intake-storage';

type EventPayload = {
  eventName?: IntakeAnalyticsEvent;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function POST(request: Request) {
  let payload: EventPayload;

  try {
    payload = (await request.json()) as EventPayload;
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });
  }

  if (!payload.eventName) {
    return Response.json({ ok: false, error: 'eventName is required.' }, { status: 400 });
  }

  try {
    recordIntakeEvent({
      eventName: payload.eventName,
      occurredAt: new Date().toISOString(),
      metadata: payload.metadata
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : 'Event write failed.' },
      { status: 400 }
    );
  }

  return Response.json({ ok: true });
}
