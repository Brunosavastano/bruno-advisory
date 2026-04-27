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

export const dynamic = 'force-dynamic';

export default async function NewProductCategoryPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = searchParams ? await searchParams : undefined;
  const error = typeof resolved?.error === 'string' ? resolved.error : null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Cockpit — Suitability</div>
          <h1>Nova categoria de produto</h1>
          <p>Classificação determinística usada pelo gate de recomendações.</p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href="/cockpit/product-categories">← Voltar</a>
        </div>
      </div>

      {error && (
        <section className="card" style={{ background: '#ffe6e6' }}>
          <p>Erro: <strong>{error}</strong></p>
        </section>
      )}

      <section className="card" style={{ marginTop: 16 }}>
        <form
          method="post"
          action="/cockpit/product-categories/submit-action?action=create"
          style={{ display: 'grid', gap: 16 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label>
              Chave (snake_case, única) <span style={{ color: 'red' }}>*</span>
              <br />
              <input type="text" name="categoryKey" required pattern="[a-z0-9_]+" placeholder="rf_cdb_simples" style={{ width: '100%' }} />
            </label>
            <label>
              Nome de exibição <span style={{ color: 'red' }}>*</span>
              <br />
              <input type="text" name="displayName" required placeholder="CDB de banco grande, sem alavancagem" style={{ width: '100%' }} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <label>
              Status
              <br />
              <select name="status" defaultValue="draft">
                {productCategoryStatuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Nível de risco geral <span style={{ color: 'red' }}>*</span>
              <br />
              <select name="riskLevel" required defaultValue="">
                <option value="" disabled>Escolha…</option>
                {productRiskLevels.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Complexidade <span style={{ color: 'red' }}>*</span>
              <br />
              <select name="complexityLevel" required defaultValue="">
                <option value="" disabled>Escolha…</option>
                {productComplexityLevels.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <label>
              Risco de liquidez <span style={{ color: 'red' }}>*</span>
              <br />
              <select name="liquidityRisk" required defaultValue="">
                <option value="" disabled>Escolha…</option>
                {productLiquidityRiskLevels.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Risco de crédito <span style={{ color: 'red' }}>*</span>
              <br />
              <select name="creditRisk" required defaultValue="">
                <option value="" disabled>Escolha…</option>
                {productCreditRiskLevels.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Risco de mercado <span style={{ color: 'red' }}>*</span>
              <br />
              <select name="marketRisk" required defaultValue="">
                <option value="" disabled>Escolha…</option>
                {productMarketRiskLevels.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          <fieldset style={{ border: '1px solid #ccc', padding: 12 }}>
            <legend>Perfis de cliente permitidos <span style={{ color: 'red' }}>*</span></legend>
            <p className="hint" style={{ marginTop: 0 }}>Marque todos os perfis para os quais essa categoria é adequada.</p>
            {clientRiskProfiles.map((p) => (
              <label key={p} style={{ display: 'inline-block', marginRight: 16 }}>
                <input type="checkbox" name="allowedRiskProfiles" value={p} /> {p}
              </label>
            ))}
          </fieldset>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label>
              Categoria de investidor exigida
              <br />
              <select name="requiredInvestorCategory" defaultValue="">
                <option value="">qualquer (incl. varejo)</option>
                {investorCategories.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label style={{ alignSelf: 'end' }}>
              <input type="checkbox" name="requiresHumanReview" value="true" />
              {' '}Exige revisão humana antes de recomendar
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <label>
              Perfil do emissor (opcional)
              <br />
              <input type="text" name="issuerRiskProfile" placeholder="ex.: banco brasileiro grande porte" style={{ width: '100%' }} />
            </label>
            <label>
              <input type="checkbox" name="hasGuarantee" value="true" />
              {' '}Tem garantia (FGC/seguro/etc.)
            </label>
            <label>
              Lockup (dias, opcional)
              <br />
              <input type="number" name="lockupPeriodDays" min="0" style={{ width: '100%' }} />
            </label>
          </div>

          <label>
            Descrição da garantia (opcional)
            <br />
            <input type="text" name="guaranteeDescription" placeholder="ex.: FGC até R$ 250 mil por CPF/instituição" style={{ width: '100%' }} />
          </label>

          <label>
            Notas de custos diretos (taxas, spreads — opcional)
            <br />
            <textarea name="directCostNotes" rows={2} style={{ width: '100%' }} />
          </label>

          <label>
            Notas de custos indiretos (impostos, IOF — opcional)
            <br />
            <textarea name="indirectCostNotes" rows={2} style={{ width: '100%' }} />
          </label>

          <label>
            Racional da classificação <span style={{ color: 'red' }}>*</span>
            <br />
            <textarea name="classificationRationale" rows={4} required placeholder="Explique por que essa categoria foi classificada assim. Esse texto fica auditável." style={{ width: '100%' }} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label>
              Revisado em (opcional)
              <br />
              <input type="date" name="reviewedAt" defaultValue={today} />
            </label>
            <label>
              Expira em (opcional)
              <br />
              <input type="date" name="expiresAt" />
            </label>
          </div>

          <div>
            <button className="btn" type="submit">Criar categoria</button>
          </div>
        </form>
      </section>
    </main>
  );
}
