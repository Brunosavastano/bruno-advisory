import { cockpitAuthModel } from '@bruno-advisory/core';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  findCockpitSessionByToken,
  isCockpitSessionValid,
  deleteCockpitSessionByToken
} from '../../lib/intake-storage';

async function logoutAction() {
  'use server';

  const cookieStore = await cookies();
  const token = cookieStore.get(cockpitAuthModel.cookie.name)?.value;
  if (token) {
    deleteCockpitSessionByToken(token);
  }
  cookieStore.set({
    name: cockpitAuthModel.cookie.name,
    value: '',
    httpOnly: cockpitAuthModel.cookie.httpOnly,
    sameSite: cockpitAuthModel.cookie.sameSite,
    path: cockpitAuthModel.cookie.path,
    maxAge: 0
  });
  redirect('/cockpit/login');
}

async function getHeaderState() {
  const cookieStore = await cookies();
  const token = cookieStore.get(cockpitAuthModel.cookie.name)?.value;
  if (token) {
    const session = findCockpitSessionByToken(token);
    if (session && isCockpitSessionValid(session)) {
      return { mode: 'session' as const, email: session.email, displayName: session.displayName, role: session.role };
    }
  }

  const legacyToken = cookieStore.get('cockpit_token')?.value;
  const secret = process.env.COCKPIT_SECRET;
  if (legacyToken && secret && legacyToken === secret) {
    return { mode: 'legacy' as const };
  }

  return { mode: 'anonymous' as const };
}

export default async function CockpitLayout({ children }: { children: ReactNode }) {
  const headerState = await getHeaderState();

  return (
    <>
      {headerState.mode !== 'anonymous' ? (
        <header className="cockpit-header" style={{ padding: '0.75rem 1rem', background: '#111827', color: '#e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
          <nav style={{ display: 'flex', gap: '1rem' }}>
            <Link href="/cockpit/leads" style={{ color: '#e2e8f0' }}>Leads</Link>
            <Link href="/cockpit/review-queue" style={{ color: '#e2e8f0' }}>Review</Link>
            <Link href="/cockpit/billing" style={{ color: '#e2e8f0' }}>Billing</Link>
            <Link href="/cockpit/audit-log" style={{ color: '#e2e8f0' }}>Audit</Link>
            {headerState.mode === 'session' && headerState.role === 'admin' ? (
              <Link href="/cockpit/users" style={{ color: '#e2e8f0' }}>Users</Link>
            ) : null}
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {headerState.mode === 'session' ? (
              <span>
                {headerState.displayName} · <code style={{ background: 'rgba(148,163,184,0.15)', padding: '0.1rem 0.3rem', borderRadius: '0.25rem' }}>{headerState.role}</code>
              </span>
            ) : (
              <span style={{ color: '#fbbf24' }}>Sessão legada (COCKPIT_SECRET)</span>
            )}
            <form action={logoutAction}>
              <button type="submit" style={{ background: '#dc2626', color: 'white', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '0.25rem', cursor: 'pointer' }}>
                Sair
              </button>
            </form>
          </div>
        </header>
      ) : null}
      {children}
    </>
  );
}
