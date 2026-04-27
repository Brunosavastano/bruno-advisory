import { productCategoryStatuses, type ProductCategoryStatus } from '@savastano-advisory/core';
import { listProductCategories } from '../../../lib/intake-storage';

export const dynamic = 'force-dynamic';

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function statusBadgeColor(status: ProductCategoryStatus): string {
  if (status === 'active') return '#1f4e79';
  if (status === 'draft') return '#888';
  return '#a55';
}

export default async function ProductCategoriesListPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = searchParams ? await searchParams : undefined;
  const statusFilterRaw = typeof resolved?.status === 'string' ? resolved.status : null;
  const statusFilter = statusFilterRaw && productCategoryStatuses.includes(statusFilterRaw as ProductCategoryStatus)
    ? (statusFilterRaw as ProductCategoryStatus)
    : undefined;
  const action = typeof resolved?.action === 'string' ? resolved.action : null;
  const error = typeof resolved?.error === 'string' ? resolved.error : null;

  const categories = listProductCategories(statusFilter ? { status: statusFilter } : undefined);

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Cockpit — Suitability</div>
          <h1>Categorias de produtos</h1>
          <p>Classificação determinística usada pelo gate de recomendações (Resolução CVM 30/2021, Art. 5º).</p>
        </div>
        <div className="actions">
          <a className="btn" href="/cockpit/product-categories/new">+ Nova categoria</a>
          <a className="btn btn-secondary" href="/cockpit/leads">← Voltar</a>
        </div>
      </div>

      {action === 'created' && (
        <section className="card" style={{ background: '#1f4e79', color: '#fff' }}>
          <p>✓ Categoria criada com sucesso.</p>
        </section>
      )}
      {action === 'updated' && (
        <section className="card" style={{ background: '#1f4e79', color: '#fff' }}>
          <p>✓ Categoria atualizada com sucesso.</p>
        </section>
      )}
      {error && (
        <section className="card" style={{ background: '#ffe6e6' }}>
          <p>Erro: <strong>{error}</strong></p>
        </section>
      )}

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Filtrar por status</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a className="btn btn-secondary" href="/cockpit/product-categories">Todos</a>
          {productCategoryStatuses.map((s) => (
            <a key={s} className="btn btn-secondary" href={`/cockpit/product-categories?status=${s}`}>
              {s}
            </a>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Total: {categories.length}</div>
        {categories.length === 0 ? (
          <p>Nenhuma categoria cadastrada{statusFilter ? ` com status ${statusFilter}` : ''}.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
                <th style={{ padding: 8 }}>Chave</th>
                <th style={{ padding: 8 }}>Nome</th>
                <th style={{ padding: 8 }}>Status</th>
                <th style={{ padding: 8 }}>Risco</th>
                <th style={{ padding: 8 }}>Complexidade</th>
                <th style={{ padding: 8 }}>Categoria investidor</th>
                <th style={{ padding: 8 }}>Revisado em</th>
                <th style={{ padding: 8 }}></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.productCategoryId} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8 }}><code>{c.categoryKey}</code></td>
                  <td style={{ padding: 8 }}>{c.displayName}</td>
                  <td style={{ padding: 8 }}>
                    <span style={{ background: statusBadgeColor(c.status), color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: 8 }}>{c.riskLevel}</td>
                  <td style={{ padding: 8 }}>{c.complexityLevel}</td>
                  <td style={{ padding: 8 }}>{c.requiredInvestorCategory ?? 'qualquer'}</td>
                  <td style={{ padding: 8 }}>{formatDateTime(c.reviewedAt)}</td>
                  <td style={{ padding: 8 }}>
                    <a href={`/cockpit/product-categories/${c.productCategoryId}`}>Editar</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
