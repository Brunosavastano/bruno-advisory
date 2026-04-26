import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sobre | Savastano Advisory'
};

export default function SobrePage() {
  return (
    <main>
      <div className="about-hero">
        <img
          src="/bruno-foto.jpg"
          alt="Bruno Savastano"
          className="about-photo"
          width={280}
          height={373}
        />
        <div className="about-intro">
          <div className="badge">Sobre o consultor</div>
          <h1>Bruno Savastano</h1>
          <p className="about-role">
            Consultor de Valores Mobiliários · CVM 004503-0 · CFA Level II Candidate
          </p>
          <p className="about-summary">
            Analista financeiro com experiência em mercado de capitais em escritórios e instituições
            de referência — Davis Polk &amp; Wardwell (Nova York), Machado Meyer Advogados (São Paulo)
            e ABGF (Brasília). Mestrado Profissional em Economia com ênfase em Finanças pelo Insper.
          </p>
          <p className="about-summary">
            A Savastano Advisory nasce de uma convicção: consultoria independente, sem conflito de
            interesse, com processo documentado e rastreável. Poucos clientes, atendimento direto,
            responsabilidade pessoal.
          </p>
          <div className="about-tags">
            <span className="about-tag">Independência</span>
            <span className="about-tag">Sem conflito de interesse</span>
            <span className="about-tag">Processo documentado</span>
            <span className="about-tag">CFA Candidate</span>
            <span className="about-tag">5 idiomas</span>
          </div>
        </div>
      </div>

      <div className="divider" />

      <section className="section">
        <p className="section-label">Trajetória</p>
        <h2 style={{ marginBottom: 40 }}>Experiência profissional</h2>
        <div className="timeline">
          <div className="timeline-item">
            <p className="timeline-period">2025 – presente</p>
            <p className="timeline-title">Consultor de Valores Mobiliários</p>
            <p className="timeline-org">Savastano Advisory · Brasília</p>
            <p className="timeline-desc">
              Consultoria independente para pessoas físicas com patrimônio relevante.
              Organização patrimonial, recomendações registradas, acompanhamento recorrente.
            </p>
          </div>
          <div className="timeline-item">
            <p className="timeline-period">Dez 2024 – Mai 2025</p>
            <p className="timeline-title">Sovereign Credit Analyst</p>
            <p className="timeline-org">ABGF — Agência Brasileira Gestora de Fundos · Brasília</p>
            <p className="timeline-desc">
              Análise de crédito soberano, modelagem de precificação de contra-garantias,
              dashboards de risco e representação institucional na Berne Union.
            </p>
          </div>
          <div className="timeline-item">
            <p className="timeline-period">Nov 2021 – Nov 2023</p>
            <p className="timeline-title">Associate — Debt Capital Markets</p>
            <p className="timeline-org">Machado Meyer Advogados · São Paulo</p>
            <p className="timeline-desc">
              Estruturação de emissões de dívida (debêntures, CRI, CRA, notas comerciais) em
              setores de banking, infraestrutura, energia e tecnologia. Análise de modelos
              financeiros, due diligence e negociação de documentação.
            </p>
          </div>
          <div className="timeline-item">
            <p className="timeline-period">Mar 2020 – Nov 2021</p>
            <p className="timeline-title">Associate — Equity Capital Markets</p>
            <p className="timeline-org">Davis Polk &amp; Wardwell LLP · Nova York</p>
            <p className="timeline-desc">
              Assessoria em emissões de equity e debt nos EUA, preparação de registration
              statements (S-1, F-1), suporte a IPOs cross-border e revisão de offering memoranda
              sob U.S. GAAP.
            </p>
          </div>
          <div className="timeline-item">
            <p className="timeline-period">2014 – 2020</p>
            <p className="timeline-title">Carreira inicial — Direito Corporativo</p>
            <p className="timeline-org">YKK, KillB, A.H. Antelo, K&amp;MC, TJSP</p>
            <p className="timeline-desc">
              Assessoria jurídica corporativa, estruturação de contratos e suporte a
              litígios financeiros.
            </p>
          </div>
        </div>
      </section>

      <div className="divider" />

      <section className="section">
        <p className="section-label">Formação</p>
        <h2 style={{ marginBottom: 40 }}>Educação e certificações</h2>
        <div className="grid two">
          <div className="card">
            <div className="kicker">Formação acadêmica</div>
            <ul className="list">
              <li>
                <strong>LLM em Direito Financeiro e de Mercado de Capitais</strong><br />
                <span className="hint">Insper · 2023 – 2025</span>
              </li>
              <li>
                <strong>Mestrado Profissional em Economia — Finance Track</strong><br />
                <span className="hint">Insper · 2021 – 2022</span>
              </li>
              <li>
                <strong>Bacharelado em Direito (LL.B.)</strong><br />
                <span className="hint">PUC-SP · 2010 – 2016</span>
              </li>
            </ul>
          </div>
          <div className="card">
            <div className="kicker">Certificações</div>
            <ul className="list">
              <li>CFA Level II Candidate — 2025</li>
              <li>CVM — Consultor de Valores Mobiliários (004503-0)</li>
              <li>Bloomberg Market Concepts (BMC) — 2024</li>
              <li>Capital IQ Pro Academy (101, 201, RatingsDirect, Portfolio Analytics) — 2025</li>
              <li>IELTS — English C2</li>
            </ul>
          </div>
        </div>
      </section>

      <div className="divider" />

      <section className="section">
        <p className="section-label">Idiomas</p>
        <h2 style={{ marginBottom: 32 }}>Comunicação multilíngue</h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
            <p style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', color: 'var(--sa-cream)', marginBottom: 4 }}>Português</p>
            <p className="hint">Nativo</p>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
            <p style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', color: 'var(--sa-cream)', marginBottom: 4 }}>English</p>
            <p className="hint">C2 — IELTS</p>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
            <p style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', color: 'var(--sa-cream)', marginBottom: 4 }}>Italiano</p>
            <p className="hint">C1</p>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
            <p style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', color: 'var(--sa-cream)', marginBottom: 4 }}>Español</p>
            <p className="hint">C1</p>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
            <p style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', color: 'var(--sa-cream)', marginBottom: 4 }}>Français</p>
            <p className="hint">B2</p>
          </div>
        </div>
      </section>

      <div className="divider" />

      <section className="section" style={{ textAlign: 'center' }}>
        <h2 style={{ marginBottom: 16 }}>Quer entender se faz sentido trabalhar juntos?</h2>
        <p style={{ color: 'var(--sa-text-dim)', marginBottom: 28, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
          A conversa inicial serve para entender seu contexto e avaliar aderência. Sem compromisso.
        </p>
        <a className="btn" href="/go/intake?sourceLabel=site_sobre_cta">
          Solicitar conversa inicial
        </a>
      </section>
    </main>
  );
}
