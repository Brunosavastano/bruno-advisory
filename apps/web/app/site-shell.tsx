import type { ReactNode } from 'react';

const pendingPublicationDetails = [
  'identificação pública CVM',
  'e-mail público de privacidade',
  'endereço profissional',
  'foro/cidade de referência para os Termos'
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-shell">
        <div className="site-header-row">
          <a className="site-brand" href="/">
            Bruno Advisory
          </a>
          <nav className="site-nav" aria-label="Navegação principal">
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
          <p className="hint">
            Consultoria de valores mobiliários prestada por Bruno Savastano, em nome próprio, observada a
            regulamentação aplicável. Conteúdo meramente institucional e informativo. Nada aqui constitui
            recomendação personalizada, promessa de rentabilidade ou garantia de resultado. A decisão final de
            investimento e a implementação das operações cabem exclusivamente ao cliente.
          </p>
        </div>
        <div>
          <p className="footer-title">Acesso público</p>
          <ul className="footer-links">
            <li>
              <a href="/para-quem-e">Para quem é</a>
            </li>
            <li>
              <a href="/como-funciona">Como funciona</a>
            </li>
            <li>
              <a href="/privacidade">Política de Privacidade</a>
            </li>
            <li>
              <a href="/termos">Termos de Uso</a>
            </li>
          </ul>
        </div>
        <div>
          <p className="footer-title">Pendências de publicação</p>
          <p className="hint">
            Alguns dados canônicos de compliance ainda não foram fechados para publicação pública e aparecem
            explicitamente como pendentes, sem valores inventados.
          </p>
          <ul className="footer-links">
            {pendingPublicationDetails.map((item) => (
              <li key={item}>{item}</li>
            ))}
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
        <p>{props.description}</p>
      </div>
      {props.actions ? <div className="actions">{props.actions}</div> : null}
    </div>
  );
}
