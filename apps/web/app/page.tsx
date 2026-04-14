import { recordIntakeEvent } from '../lib/intake-storage';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  recordIntakeEvent({
    eventName: 't2_landing_viewed',
    occurredAt: new Date().toISOString(),
    metadata: { route: '/' }
  });

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Bruno Advisory</div>
          <h1>Organização e acompanhamento de investimentos para PF premium.</h1>
          <p>
            Bruno Advisory foi desenhado para quem já tem patrimônio relevante e quer trocar fragmentação,
            improviso e excesso de produto por um processo mais claro, pessoal e documentado.
          </p>
        </div>
        <div className="actions">
          <a className="btn" href="/go/intake?sourceLabel=site_home_primary_cta">
            Solicitar conversa inicial
          </a>
          <a className="btn btn-secondary" href="/como-funciona">
            Entender como funciona
          </a>
        </div>
      </div>

      <section className="grid">
        <article className="card">
          <div className="kicker">Para quem é</div>
          <p>
            Para profissionais, empresários e famílias enxutas que já acumularam patrimônio financeiro e agora
            precisam de método, contexto e acompanhamento recorrente.
          </p>
          <a href="/para-quem-e">Ver critérios de fit</a>
        </article>
        <article className="card">
          <div className="kicker">O que entregamos</div>
          <ul className="list">
            <li>diagnóstico inicial do caso</li>
            <li>organização da fotografia financeira</li>
            <li>direcionamento inicial com racional explícito</li>
            <li>acompanhamento recorrente</li>
            <li>recomendações registradas com histórico e status</li>
          </ul>
        </article>
        <article className="card">
          <div className="kicker">O que não prometemos</div>
          <p>
            Não vendemos atalho, giro de produto ou promessa de retorno. O trabalho é organizar decisões com mais
            coerência, clareza e rastreabilidade.
          </p>
          <p className="hint">
            A conversa inicial é apenas de triagem e aderência. Ela não constitui recomendação personalizada.
          </p>
        </article>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Como funciona</div>
        <ol className="list">
          <li>qualificação inicial</li>
          <li>proposta e aceite</li>
          <li>coleta e diagnóstico</li>
          <li>direcionamento inicial</li>
          <li>acompanhamento recorrente</li>
        </ol>
        <div className="actions" style={{ marginTop: 12 }}>
          <a className="btn btn-secondary" href="/como-funciona">
            Ver processo completo
          </a>
          <a className="btn btn-secondary" href="/privacidade">
            Política de Privacidade
          </a>
          <a className="btn btn-secondary" href="/termos">
            Termos de Uso
          </a>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Relação com Bruno</div>
        <p>
          A relação é direta com Bruno. O objetivo do V1 não é escalar atendimento genérico. É atender poucos
          clientes com clareza, processo e responsabilidade.
        </p>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Superfície pública de compliance</div>
        <p>
          As páginas públicas de privacidade e termos já estão acessíveis. Dados canônicos que ainda não foram
          fechados para publicação aparecem sinalizados como pendentes, sem valores inventados.
        </p>
        <div className="actions">
          <a className="btn btn-secondary" href="/privacidade">
            Ler política de privacidade
          </a>
          <a className="btn btn-secondary" href="/termos">
            Ler termos de uso
          </a>
        </div>
      </section>
    </main>
  );
}
