import { portalInviteModel } from '@savastano-advisory/core';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { redeemInvite } from '../../../lib/intake-storage';

export const dynamic = 'force-dynamic';

async function loginAction(formData: FormData) {
  'use server';

  const code = String(formData.get('code') ?? '').trim();
  const session = redeemInvite(code);

  if (!session) {
    redirect('/portal/login?error=Código inválido, expirado, usado ou revogado.');
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: portalInviteModel.cookie.name,
    value: session.sessionToken,
    httpOnly: portalInviteModel.cookie.httpOnly,
    sameSite: portalInviteModel.cookie.sameSite,
    path: portalInviteModel.cookie.path,
    maxAge: portalInviteModel.sessionExpiryDays * 24 * 60 * 60
  });

  redirect('/portal/dashboard');
}

export default async function PortalLoginPage({
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
          <div className="badge">Portal do cliente</div>
          <h1>Acesso por código de convite</h1>
          <p>Use o código enviado pelo Savastano Advisory para abrir sua área privada.</p>
        </div>
      </div>

      <section className="card">
        {error ? <p className="error">{error}</p> : null}
        <form className="form" action={loginAction}>
          <label>
            Código de convite
            <input name="code" type="text" placeholder="Cole o código de 32 caracteres" autoComplete="one-time-code" required />
          </label>
          <button className="btn" type="submit">Entrar no portal</button>
        </form>
        <p className="hint" style={{ marginTop: 12 }}>
          Cookie de sessão: <code>{portalInviteModel.cookie.name}</code>
        </p>
      </section>
    </main>
  );
}
