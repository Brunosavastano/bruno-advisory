import { cockpitAuthModel, cockpitRoles, isCockpitRole } from '@savastano-advisory/core';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  findCockpitSessionByToken,
  isCockpitSessionValid,
  listCockpitUsers,
  createCockpitUser,
  updateCockpitUser,
  countActiveAdmins
} from '../../../lib/intake-storage';

export const dynamic = 'force-dynamic';

async function getAdminContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(cockpitAuthModel.cookie.name)?.value;
  if (!token) return null;
  const session = findCockpitSessionByToken(token);
  if (!session || !isCockpitSessionValid(session) || session.role !== 'admin') {
    return null;
  }
  return session;
}

async function requireAdminOrRedirect() {
  const admin = await getAdminContext();
  if (!admin) {
    redirect('/cockpit/leads?error=Acesso%20restrito%20a%20administradores.');
  }
  return admin;
}

async function createUserAction(formData: FormData) {
  'use server';

  await requireAdminOrRedirect();

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const displayName = String(formData.get('displayName') ?? '').trim();
  const roleRaw = String(formData.get('role') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !displayName || !isCockpitRole(roleRaw) || password.length < 8) {
    redirect('/cockpit/users?error=Payload%20inválido%20(senha%20precisa%208%2B%20chars).');
  }

  try {
    createCockpitUser({ email, displayName, role: roleRaw, password });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const encoded = encodeURIComponent(message);
    redirect(`/cockpit/users?error=${encoded}`);
  }

  redirect(`/cockpit/users?created=${encodeURIComponent(email)}`);
}

async function toggleActiveAction(formData: FormData) {
  'use server';

  await requireAdminOrRedirect();

  const userId = String(formData.get('userId') ?? '').trim();
  const nextActive = String(formData.get('nextActive') ?? '') === 'true';
  if (!userId) {
    redirect('/cockpit/users?error=userId%20ausente.');
  }

  // Guardrail: don't let the last active admin deactivate themselves.
  if (!nextActive && countActiveAdmins() <= 1) {
    // Check if the target IS the last admin.
    const users = listCockpitUsers();
    const target = users.find((u) => u.userId === userId);
    if (target?.role === 'admin' && target.isActive) {
      redirect('/cockpit/users?error=Não%20é%20possível%20desativar%20o%20último%20admin%20ativo.');
    }
  }

  try {
    const updated = updateCockpitUser(userId, { isActive: nextActive });
    if (!updated) {
      redirect('/cockpit/users?error=Usuário%20não%20encontrado.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    redirect(`/cockpit/users?error=${encodeURIComponent(message)}`);
  }

  redirect(`/cockpit/users?updated=${encodeURIComponent(userId)}`);
}

async function changeRoleAction(formData: FormData) {
  'use server';

  await requireAdminOrRedirect();

  const userId = String(formData.get('userId') ?? '').trim();
  const roleRaw = String(formData.get('role') ?? '').trim();
  if (!userId || !isCockpitRole(roleRaw)) {
    redirect('/cockpit/users?error=Payload%20inválido.');
  }

  const users = listCockpitUsers();
  const target = users.find((u) => u.userId === userId);
  if (target?.role === 'admin' && roleRaw !== 'admin' && countActiveAdmins() <= 1) {
    redirect('/cockpit/users?error=Não%20é%20possível%20rebaixar%20o%20último%20admin%20ativo.');
  }

  try {
    const updated = updateCockpitUser(userId, { role: roleRaw });
    if (!updated) {
      redirect('/cockpit/users?error=Usuário%20não%20encontrado.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    redirect(`/cockpit/users?error=${encodeURIComponent(message)}`);
  }

  redirect(`/cockpit/users?updated=${encodeURIComponent(userId)}`);
}

function formatDate(iso: string) {
  return new Date(iso).toISOString().slice(0, 19).replace('T', ' ');
}

export default async function CockpitUsersPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await getAdminContext();
  if (!admin) {
    redirect('/cockpit/leads?error=Acesso%20restrito%20a%20administradores.');
  }
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const created = typeof resolvedSearchParams?.created === 'string' ? resolvedSearchParams.created : null;
  const updated = typeof resolvedSearchParams?.updated === 'string' ? resolvedSearchParams.updated : null;
  const error = typeof resolvedSearchParams?.error === 'string' ? resolvedSearchParams.error : null;

  const users = listCockpitUsers();

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Cockpit · Administração</div>
          <h1>Usuários do cockpit</h1>
          <p>
            Criar, promover, rebaixar e desativar operadores. Desativar um usuário remove as sessões abertas dele
            imediatamente.
          </p>
        </div>
      </div>

      {created ? <p className="success">Usuário criado: {created}</p> : null}
      {updated ? <p className="success">Usuário atualizado.</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <section className="card">
        <h2>Novo usuário</h2>
        <form className="form" action={createUserAction}>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Nome
            <input name="displayName" type="text" required />
          </label>
          <label>
            Papel
            <select name="role" defaultValue="operator" required>
              {cockpitRoles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            Senha inicial (mín. 8)
            <input name="password" type="password" minLength={8} required />
          </label>
          <button className="btn" type="submit">Criar usuário</button>
        </form>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Usuários ({users.length})</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #374151' }}>
              <th style={{ padding: '0.5rem' }}>Email</th>
              <th style={{ padding: '0.5rem' }}>Nome</th>
              <th style={{ padding: '0.5rem' }}>Papel</th>
              <th style={{ padding: '0.5rem' }}>Ativo</th>
              <th style={{ padding: '0.5rem' }}>Criado</th>
              <th style={{ padding: '0.5rem' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.userId} style={{ borderBottom: '1px solid #1f2937' }}>
                <td style={{ padding: '0.5rem' }}>{u.email}</td>
                <td style={{ padding: '0.5rem' }}>{u.displayName}</td>
                <td style={{ padding: '0.5rem' }}>
                  <form action={changeRoleAction} style={{ display: 'inline-flex', gap: '0.25rem' }}>
                    <input type="hidden" name="userId" value={u.userId} />
                    <select name="role" defaultValue={u.role}>
                      {cockpitRoles.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <button type="submit" style={{ fontSize: '0.75rem' }}>Salvar</button>
                  </form>
                </td>
                <td style={{ padding: '0.5rem' }}>{u.isActive ? '✓' : '✗'}</td>
                <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{formatDate(u.createdAt)}</td>
                <td style={{ padding: '0.5rem' }}>
                  <form action={toggleActiveAction} style={{ display: 'inline' }}>
                    <input type="hidden" name="userId" value={u.userId} />
                    <input type="hidden" name="nextActive" value={String(!u.isActive)} />
                    <button type="submit" style={{ fontSize: '0.75rem' }}>
                      {u.isActive ? 'Desativar' : 'Reativar'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
