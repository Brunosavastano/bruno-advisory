import { listReviewQueueItems } from '../../../../lib/intake-storage';

export async function GET() {
  return Response.json({ items: listReviewQueueItems() });
}
