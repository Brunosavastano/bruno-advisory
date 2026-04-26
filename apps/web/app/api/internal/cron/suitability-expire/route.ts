import { expireOverdueAssessments } from '../../../../../lib/intake-storage';

// AI-3 Cycle 1.5 — rota interna chamada pelo cron systemd no Contabo
// (infra/contabo/systemd/suitability-expire.{service,timer}). Não usa cookie
// cockpit; auth é feita por header X-Internal-Cron-Token, validado contra a
// env var INTERNAL_CRON_TOKEN. Em prod, ausência de INTERNAL_CRON_TOKEN
// bloqueia a rota (fail-closed).

const HEADER_NAME = 'x-internal-cron-token';

export async function POST(request: Request) {
  const expectedToken = process.env.INTERNAL_CRON_TOKEN?.trim();
  if (!expectedToken) {
    return Response.json(
      { ok: false, error: 'cron_token_not_configured' },
      { status: 503 }
    );
  }

  const providedToken = request.headers.get(HEADER_NAME)?.trim() ?? '';
  if (!providedToken || providedToken !== expectedToken) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const result = expireOverdueAssessments({ nowIso: new Date().toISOString() });
  return Response.json({
    ok: true,
    expiredCount: result.expiredCount,
    assessmentIds: result.expired.map((entry) => entry.assessmentId)
  });
}
