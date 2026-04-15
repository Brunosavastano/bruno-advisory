import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cockpitAuthModel, portalInviteModel } from '@bruno-advisory/core';

const COCKPIT_TOKEN_COOKIE = 'cockpit_token';
const COCKPIT_SESSION_COOKIE = cockpitAuthModel.cookie.name;
const LOGIN_QUERY_PARAM = 'login';
const TOKEN_QUERY_PARAM = 'token';
const PORTAL_SESSION_COOKIE = portalInviteModel.cookie.name;

function isCockpitApiRoute(pathname: string) {
  return pathname === '/api/cockpit' || pathname.startsWith('/api/cockpit/');
}

function isCockpitPageRoute(pathname: string) {
  return pathname === '/cockpit' || pathname.startsWith('/cockpit/');
}

function isPortalPageRoute(pathname: string) {
  return pathname === '/portal' || pathname.startsWith('/portal/');
}

function isPortalPublicRoute(pathname: string) {
  return pathname === '/portal/login';
}

function isCockpitPublicRoute(pathname: string) {
  // Routes that must be reachable WITHOUT authentication so users can log in.
  return (
    pathname === '/cockpit/login' ||
    pathname === '/api/cockpit/login' ||
    pathname === '/api/cockpit/logout'
  );
}

function hasCockpitSessionCookie(request: NextRequest) {
  // Edge middleware only checks for PRESENCE — the real session validation runs
  // inside route handlers via `requireCockpitSession` (Node runtime + SQLite).
  // Middleware cannot open the DB here.
  return Boolean(request.cookies.get(COCKPIT_SESSION_COOKIE)?.value);
}

function isAuthorizedCockpit(request: NextRequest, secret: string) {
  if (hasCockpitSessionCookie(request)) {
    return true;
  }
  const authorization = request.headers.get('authorization');
  const bearerToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;
  const cookieToken = request.cookies.get(COCKPIT_TOKEN_COOKIE)?.value ?? null;

  return bearerToken === secret || cookieToken === secret;
}

function hasPortalSession(request: NextRequest) {
  return Boolean(request.cookies.get(PORTAL_SESSION_COOKIE)?.value);
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
  const { nextUrl } = request;
  const { pathname } = nextUrl;
  const cockpitApiRoute = isCockpitApiRoute(pathname);
  const cockpitPageRoute = isCockpitPageRoute(pathname);
  const portalPageRoute = isPortalPageRoute(pathname);

  if (portalPageRoute && !isPortalPublicRoute(pathname) && !hasPortalSession(request)) {
    return NextResponse.redirect(new URL('/portal/login', request.url));
  }

  if (!cockpitApiRoute && !cockpitPageRoute) {
    return NextResponse.next();
  }

  // Login/logout endpoints must stay reachable even for unauthenticated clients.
  if (isCockpitPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const secret = process.env.COCKPIT_SECRET;
  if (!secret) {
    return NextResponse.next();
  }

  const tokenParam = nextUrl.searchParams.get(TOKEN_QUERY_PARAM);
  if (cockpitPageRoute && tokenParam === secret) {
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

  if (isAuthorizedCockpit(request, secret)) {
    return NextResponse.next();
  }

  if (cockpitApiRoute) {
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
  matcher: ['/cockpit/:path*', '/api/cockpit/:path*', '/portal/:path*']
};
