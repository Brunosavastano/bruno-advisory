import { recordIntakeEvent } from '../../../lib/intake-storage';

export function GET(request: Request) {
  const url = new URL(request.url);
  const sourceLabel = url.searchParams.get('sourceLabel')?.trim() || 'site_home_primary_cta';

  recordIntakeEvent({
    eventName: 't2_primary_cta_clicked',
    occurredAt: new Date().toISOString(),
    metadata: { sourceLabel }
  });

  const redirectUrl = new URL('/intake', url.origin);
  redirectUrl.searchParams.set('sourceLabel', sourceLabel);

  return Response.redirect(redirectUrl, 302);
}
