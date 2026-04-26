import { listReviewQueueItems } from '../../../../lib/intake-storage';
import { requireCockpitSession } from '../../../../lib/cockpit-session';

export async function GET(request: Request) {
  const check = await requireCockpitSession(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  return Response.json({ items: listReviewQueueItems() });
}
