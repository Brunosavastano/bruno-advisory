import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const COCKPIT_TOKEN_COOKIE = 'cockpit_token';
const LOGIN_QUERY_PARAM = 'login';
const TOKEN_QUERY_PARAM = 'token';

function isApiRoute(pathname: string) {
  return pathname === '/api/cockpit' || pathname.startsWith('/api/cockpit/');
}

function isPageRoute(pathname: string) {
  return pathname === '/cockpit' || pathname.startsWith('/cockpit/');
}

function isAuthorized(request: NextRequest, secret: string) {
  const authorization = request.headers.get('authorization');
  const bearerToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;
  const cookieToken = request.cookies.get(COCKPIT_TOKEN_COOKIE)?.value ?? null;

  return bearerToken === secret || cookieToken === secret;
}

function buildLoginPromptResponse(request: NextRequest) {
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search ? request.nextUrl.search : ''}`;
  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charSet="utf-8" />
    <title>Cockpit protegido</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
      main { max-width: 40rem; margin: 10vh auto; padding: 2rem; background: #111827; border-radius: 1rem; }
      code { background: rgba(148, 163, 184, 0.15); padding: 0.1rem 0.3rem; border-radius: 0.35rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>Cockpit protegido</h1>
      <p>Abra esta rota com o segredo compartilhado na query string para iniciar a sessão.</p>
      <p>Exemplo: <code>${nextPath}${nextPath.includes('?') ? '&' : '?'}token=SEU_SEGREDO</code></p>
    </main>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 401,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export function proxy(request: NextRequest) {
  const secret = process.env.COCKPIT_SECRET;
  if (!secret) {
    return NextResponse.next();
  }

  const { nextUrl } = request;
  const { pathname } = nextUrl;
  const apiRoute = isApiRoute(pathname);
  const pageRoute = isPageRoute(pathname);

  if (!apiRoute && !pageRoute) {
    return NextResponse.next();
  }

  const tokenParam = nextUrl.searchParams.get(TOKEN_QUERY_PARAM);
  if (pageRoute && tokenParam === secret) {
    const redirectUrl = nextUrl.clone();
    redirectUrl.searchParams.delete(TOKEN_QUERY_PARAM);
    redirectUrl.searchParams.delete(LOGIN_QUERY_PARAM);

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set({
      name: COCKPIT_TOKEN_COOKIE,
      value: secret,
      httpOnly: true,
      sameSite: 'lax',
      secure: nextUrl.protocol === 'https:',
      path: '/'
    });
    return response;
  }

  if (isAuthorized(request, secret)) {
    return NextResponse.next();
  }

  if (apiRoute) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  if (nextUrl.searchParams.get(LOGIN_QUERY_PARAM) === '1') {
    return buildLoginPromptResponse(request);
  }

  const loginUrl = nextUrl.clone();
  loginUrl.searchParams.set(LOGIN_QUERY_PARAM, '1');
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/cockpit/:path*', '/api/cockpit/:path*']
};
