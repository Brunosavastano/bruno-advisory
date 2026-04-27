import {
  clientRiskProfiles,
  investorCategories,
  productCategoryStatuses,
  productComplexityLevels,
  productCreditRiskLevels,
  productLiquidityRiskLevels,
  productMarketRiskLevels,
  productRiskLevels
} from '@savastano-advisory/core';
import { notFound } from 'next/navigation';
import { getProductCategory } from '../../../../lib/intake-storage';

export const dynamic = 'force-dynamic';

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export default async function EditProductCategoryPage({
  params,
  searchParams
}: {
  params: Promise<{ productCategoryId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { productCategoryId } = await params;
  const resolved = searchParams ? await searchParams : undefined;
  const error = typeof resolved?.error === 'string' ? resolved.error : null;
  const action = typeof resolved?.action === 'string' ? resolved.action : null;

  const category = getProductCategory(productCategoryId);
  if (!category) notFound();

  const allowedSet = new Set(category.allowedRiskProfiles);

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Cockpit — Suitability</div>
          <h1>Editar categoria: {category.displayName}</h1>
          <p>Chave: <code>{category.categoryKey}</code> · ID: <code>{category.productCategoryId}</code></p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href="/cockpit/product-categories">← Voltar à lista</a>
        </div>
      </div>

      {action === 'updated' && (
        <section className="card" style={{ background: '#1f4e79', color: '#fff' }}>
          <p>✓ Categoria atualizada.</p>
        </section>
      )}
      {error && (
        <section className="card" style={{ background: '#ffe6e6' }}>
          <p>Erro: <strong>{error}</strong></p>
        </section>
      )}

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Metadados</div>
        <p className="hint">Criado em {formatDateTime(category.createdAt)} · Atualizado em {formatDateTime(category.updatedAt)} · Revisado por {category.reviewedBy ?? '-'}</p>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <form
          method="post"
          action={`/cockpit/product-categories/${category.productCategoryId}/submit-action?action=update`}
          style={{ display: 'grid', gap: 16 }}
        >
          <label>
            Nome de exibição <span style={{ color: 'red' }}>*</span>
            <br />
            <input type="text" name="displayName" required defaultValue={category.displayName} style={{ width: '100%' }} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <label>
              Status
              <br />
              <select name="status" defaultValue={category.status}>
                {productCategoryStatuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Nível de risco geral
              <br />
              <select name="riskLevel" defaultValue={category.riskLevel}>
                {productRiskLevels.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Complexidade
              <br />
              <select name="complexityLevel" defaultValue={category.complexityLevel}>
                {productComplexityLevels.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <label>
              Risco de liquidez
              <br />
              <select name="liquidityRisk" defaultValue={category.liquidityRisk}>
                {productLiquidityRiskLevels.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Risco de crédito
              <br />
              <select name="creditRisk" defaultValue={category.creditRisk}>
                {productCreditRiskLevels.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Risco de mercado
              <br />
              <select name="marketRisk" defaultValue={category.marketRisk}>
                {productMarketRiskLevels.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          <fieldset style={{ border: '1px solid #ccc', padding: 12 }}>
            <legend>Perfis de cliente permitidos</legend>
            {clientRiskProfiles.map((p) => (
              <label key={p} style={{ display: 'inline-block', marginRight: 16 }}>
                <input type="checkbox" name="allowedRiskProfiles" value={p} defaultChecked={allowedSet.has(p)} /> {p}
              </label>
            ))}
          </fieldset>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label>
              Categoria de investidor exigida
              <br />
              <select name="requiredInvestorCategory" defaultValue={category.requiredInvestorCategory ?? ''}>
                <option value="">qualquer (incl. varejo)</option>
                {investorCategories.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label style={{ alignSelf: 'end' }}>
              <input type="checkbox" name="requiresHumanReview" value="true" defaultChecked={category.requiresHumanReview} />
              {' '}Exige revisão humana antes de recomendar
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <label>
              Perfil do emissor (opcional)
              <br />
              <input type="text" name="issuerRiskProfile" defaultValue={category.issuerRiskProfile ?? ''} style={{ width: '100%' }} />
            </label>
            <label>
              <input type="checkbox" name="hasGuarantee" value="true" defaultChecked={category.hasGuarantee} />
              {' '}Tem garantia
            </label>
            <label>
              Lockup (dias, opcional)
              <br />
              <input type="number" name="lockupPeriodDays" min="0" defaultValue={category.lockupPeriodDays ?? ''} style={{ width: '100%' }} />
            </label>
          </div>

          <label>
            Descrição da garantia (opcional)
            <br />
            <input type="text" name="guaranteeDescription" defaultValue={category.guaranteeDescription ?? ''} style={{ width: '100%' }} />
          </label>

          <label>
            Notas de custos diretos (opcional)
            <br />
            <textarea name="directCostNotes" rows={2} defaultValue={category.directCostNotes ?? ''} style={{ width: '100%' }} />
          </label>

          <label>
            Notas de custos indiretos (opcional)
            <br />
            <textarea name="indirectCostNotes" rows={2} defaultValue={category.indirectCostNotes ?? ''} style={{ width: '100%' }} />
          </label>

          <label>
            Racional da classificação <span style={{ color: 'red' }}>*</span>
            <br />
            <textarea name="classificationRationale" rows={4} required defaultValue={category.classificationRationale} style={{ width: '100%' }} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label>
              Revisado em (opcional)
              <br />
              <input type="date" name="reviewedAt" defaultValue={category.reviewedAt?.slice(0, 10) ?? ''} />
            </label>
            <label>
              Expira em (opcional)
              <br />
              <input type="date" name="expiresAt" defaultValue={category.expiresAt?.slice(0, 10) ?? ''} />
            </label>
          </div>

          <div>
            <button className="btn" type="submit">Salvar alterações</button>
          </div>
        </form>
      </section>
    </main>
  );
}
