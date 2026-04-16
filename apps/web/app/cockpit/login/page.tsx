import { cockpitAuthModel } from '@savastano-advisory/core';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  findCockpitUserByEmail,
  verifyPassword,
  createCockpitSession
} from '../../../lib/intake-storage';

export const dynamic = 'force-dynamic';

async function loginAction(formData: FormData) {
  'use server';

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    redirect('/cockpit/login?error=Informe email e senha.');
  }

  const user = findCockpitUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirect('/cockpit/login?error=Credenciais inválidas.');
  }

  if (!user.isActive) {
    redirect('/cockpit/login?error=Usuário desativado.');
  }

  const session = createCockpitSession(user.userId);

  const cookieStore = await cookies();
  cookieStore.set({
    name: cockpitAuthModel.cookie.name,
    value: session.sessionToken,
    httpOnly: cockpitAuthModel.cookie.httpOnly,
    sameSite: cockpitAuthModel.cookie.sameSite,
    path: cockpitAuthModel.cookie.path,
    maxAge: cockpitAuthModel.sessionExpiryDays * 24 * 60 * 60
  });

  redirect('/cockpit/leads');
}

export default async function CockpitLoginPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const error = typeof resolvedSearchParams?.error === 'string' ? resolvedSearchParams.error : null;

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Cockpit</div>
          <h1>Entrar no cockpit</h1>
          <p>Acesse com seu email e senha de operador.</p>
        </div>
      </div>

      <section className="card">
        {error ? <p className="error">{error}</p> : null}
        <form className="form" action={loginAction}>
          <label>
            Email
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Senha
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="btn" type="submit">Entrar</button>
        </form>
        <p className="hint" style={{ marginTop: 12 }}>
          Cookie de sessão: <code>{cockpitAuthModel.cookie.name}</code>
        </p>
      </section>
    </main>
  );
}
