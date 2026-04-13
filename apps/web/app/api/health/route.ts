import { getHealthState } from '../../../lib/state';

export function GET() {
  return Response.json(getHealthState());
}
