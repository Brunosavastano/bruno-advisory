import { listAllLeadsWithActiveFlags } from '../../../../lib/intake-storage';

export async function GET() {
  return Response.json({ ok: true, leads: listAllLeadsWithActiveFlags() });
}
