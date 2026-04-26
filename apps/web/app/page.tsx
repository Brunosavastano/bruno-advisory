import { recordIntakeEvent } from '../lib/intake-storage';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  recordIntakeEvent({
    eventName: 't2_landing_viewed',
    occurredAt: new Date().toISOString(),
    metadata: { route: '/' }
  });

  return (
    <>
      <section className="hero">
        <img
          src="/brasao-lg.webp"
          alt="Brasão da família Savastano"
          className="hero-crest"
          width={200}
          height={250}
        />
        <p className="hero-motto">Veritas · Libertas · Honor</p>
        <h1>Organização e acompanhamento de investimentos para patrimônios relevantes.</h1>
        <p className="hero-subtitle">
          Savastano Advisory foi desenhado para quem já tem patrimônio financeiro e quer trocar fragmentação,
          improviso e excesso de produto por um processo mais claro, pessoal e documentado.
        </p>
        <div className="hero-actions">
          <a className="btn" href="/go/intake?sourceLabel=site_home_primary_cta">
            Solicitar conversa inicial
          </a>
          <a className="btn btn-secondary" href="/como-funciona">
            Entender como funciona
          </a>
        </div>
      </section>

      <div className="divider" />

      <main>
        <section className="section">
          <div className="grid">
            <article className="card">
              <div className="kicker">Para quem é</div>
              <p>
                Para profissionais, empresários e famílias enxutas que já acumularam patrimônio financeiro e agora
                precisam de método, contexto e acompanhamento recorrente.
              </p>
              <a href="/para-quem-e">Ver critérios de fit →</a>
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
                Não vendemos atalho, giro de produto ou promessa de retorno. O trabalho é organizar decisões com
                mais coerência, clareza e rastreabilidade.
              </p>
              <p className="hint" style={{ marginTop: 12 }}>
                A conversa inicial é apenas de triagem e aderência. Ela não constitui recomendação personalizada.
              </p>
            </article>
          </div>
        </section>

        <div className="divider" />

        <section className="section">
          <p className="section-label">Processo</p>
          <h2 style={{ marginBottom: 32 }}>Como funciona</h2>
          <div className="card">
            <ol className="list">
              <li>Qualificação inicial — entender contexto e avaliar aderência</li>
              <li>Proposta e aceite — escopo, valores, expectativas</li>
              <li>Coleta e diagnóstico — fotografia financeira completa</li>
              <li>Direcionamento inicial — racional explícito e documentado</li>
              <li>Acompanhamento recorrente — revisão periódica com registro</li>
            </ol>
            <div className="actions" style={{ marginTop: 28 }}>
              <a className="btn btn-secondary" href="/como-funciona">Ver processo completo</a>
            </div>
          </div>
        </section>

        <div className="divider" />

        <section className="section">
          <p className="section-label">Relação direta</p>
          <h2 style={{ marginBottom: 16 }}>Um consultor. Poucos clientes. Processo documentado.</h2>
          <p style={{ maxWidth: 640 }}>
            A relação é direta com Bruno Savastano. O objetivo não é escalar atendimento genérico. É atender poucos
            clientes com clareza, processo e responsabilidade.
          </p>
        </section>

        <div className="divider" />

        <section className="section">
          <p className="section-label">Compliance</p>
          <h2 style={{ marginBottom: 16 }}>Transparência regulatória</h2>
          <p style={{ maxWidth: 640, marginBottom: 24 }}>
            As páginas públicas de privacidade e termos estão acessíveis e refletem a operação real do serviço.
          </p>
          <div className="actions">
            <a className="btn btn-secondary" href="/privacidade">Política de Privacidade</a>
            <a className="btn btn-secondary" href="/termos">Termos de Uso</a>
          </div>
        </section>
      </main>
    </>
  );
}
