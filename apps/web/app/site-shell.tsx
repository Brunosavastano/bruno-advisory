import type { ReactNode } from 'react';

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-shell">
        <div className="site-header-row">
          <a className="site-brand" href="/">
            <img
              src="/brasao-savastano.png"
              alt="Brasão Savastano"
              className="site-brand-crest"
              width={42}
              height={52}
            />
            Savastano Advisory
          </a>
          <nav className="site-nav" aria-label="Navegação principal">
            <a href="/sobre">Sobre</a>
            <a href="/para-quem-e">Para quem é</a>
            <a href="/como-funciona">Como funciona</a>
            <a href="/privacidade">Privacidade</a>
            <a href="/termos">Termos</a>
            <a href="/intake">Conversa inicial</a>
          </nav>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-shell footer-grid">
        <div>
          <p className="footer-title">Disclaimer regulatório</p>
          <p className="footer-disclaimer">
            Savastano Advisory é nome fantasia de Bruno Barreto Mesiano Savastano, consultor de valores mobiliários
            autorizado pela CVM (código 004503-0), atuando em nome próprio, observada a regulamentação aplicável.
            Conteúdo meramente institucional e informativo. Nada aqui constitui recomendação personalizada, promessa
            de rentabilidade ou garantia de resultado. A decisão final de investimento e a implementação das
            operações cabem exclusivamente ao cliente.
          </p>
          <p className="footer-motto">Veritas, Libertas, Honor</p>
        </div>
        <div>
          <p className="footer-title">Navegação</p>
          <ul className="footer-links">
            <li><a href="/sobre">Sobre o consultor</a></li>
            <li><a href="/para-quem-e">Para quem é</a></li>
            <li><a href="/como-funciona">Como funciona</a></li>
            <li><a href="/privacidade">Política de Privacidade</a></li>
            <li><a href="/termos">Termos de Uso</a></li>
            <li><a href="/intake">Conversa inicial</a></li>
          </ul>
        </div>
        <div>
          <p className="footer-title">Contato</p>
          <ul className="footer-links">
            <li>brunobmsavastano@gmail.com</li>
            <li style={{ marginTop: 16, fontSize: 12, color: 'var(--sa-text-dim)' }}>CVM 004503-0</li>
            <li style={{ fontSize: 12, color: 'var(--sa-text-dim)' }}>Brasília, DF</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

export function PageIntro(props: { badge: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="header">
      <div>
        <div className="badge">{props.badge}</div>
        <h1>{props.title}</h1>
        <p style={{ color: 'var(--sa-text-dim)', maxWidth: 600, marginTop: 12 }}>{props.description}</p>
      </div>
      {props.actions ? <div className="actions">{props.actions}</div> : null}
    </div>
  );
}
