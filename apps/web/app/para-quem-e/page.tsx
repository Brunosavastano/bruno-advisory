import { PageIntro } from '../site-shell';

export const metadata = {
  title: 'Para quem é | Savastano Advisory'
};

export default function ParaQuemEPage() {
  return (
    <main>
      <PageIntro
        badge="Para quem é"
        title="Para quem Savastano Advisory foi desenhado"
        description="Savastano Advisory foi desenhado para PF premium com patrimônio financeiro relevante e necessidade real de coordenação."
        actions={
          <>
            <a className="btn" href="/go/intake?sourceLabel=site_home_primary_cta">
              Solicitar conversa inicial
            </a>
            <a className="btn btn-secondary" href="/como-funciona">
              Como funciona
            </a>
          </>
        }
      />

      <section className="card">
        <p>Em geral, isso significa clientes que:</p>
        <ul className="list">
          <li>já passaram da fase inicial de acumulação</li>
          <li>têm carteira ou estruturas espalhadas</li>
          <li>sentem excesso de informação e pouca síntese</li>
          <li>querem decisões mais coerentes e menos reativas</li>
          <li>valorizam relação direta, discrição e método</li>
        </ul>
      </section>

      <section className="grid" style={{ marginTop: 16 }}>
        <article className="card">
          <div className="kicker">Quando há fit</div>
          <p>
            Há fit quando existe patrimônio suficiente para justificar acompanhamento recorrente e quando o cliente
            quer um processo mais claro, não apenas uma opinião pontual.
          </p>
        </article>
        <article className="card">
          <div className="kicker">Quando não há fit</div>
          <p>
            Provavelmente não há fit se você busca calls de curto prazo, especulação, atendimento massificado ou uma
            solução genérica para qualquer perfil.
          </p>
        </article>
      </section>
    </main>
  );
}
