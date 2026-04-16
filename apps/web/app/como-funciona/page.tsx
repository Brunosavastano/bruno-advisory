import { PageIntro } from '../site-shell';

export const metadata = {
  title: 'Como funciona | Savastano Advisory'
};

const steps = [
  {
    title: '1. Qualificação',
    body: 'Uma conversa inicial para entender contexto, patrimônio, objetivos e aderência à proposta.'
  },
  {
    title: '2. Estruturação do caso',
    body: 'Após aceite, começa a organização das informações principais, das contas relevantes, dos objetivos e das restrições do cliente.'
  },
  {
    title: '3. Direcionamento inicial',
    body: 'Com contexto suficiente, Bruno apresenta o enquadramento do caso e os primeiros próximos passos com racional explícito.'
  },
  {
    title: '4. Acompanhamento recorrente',
    body: 'O trabalho segue em cadência contínua, com revisões, pendências e recomendações registradas.'
  }
];

export default function ComoFuncionaPage() {
  return (
    <main>
      <PageIntro
        badge="Como funciona"
        title="Como o trabalho acontece"
        description="O processo foi desenhado para sair da conversa solta e entrar em uma rotina simples, objetiva e documentada."
        actions={
          <>
            <a className="btn" href="/go/intake?sourceLabel=site_home_primary_cta">
              Solicitar conversa inicial
            </a>
            <a className="btn btn-secondary" href="/para-quem-e">
              Para quem é
            </a>
          </>
        }
      />

      <section className="grid">
        {steps.map((step) => (
          <article className="card" key={step.title}>
            <div className="kicker">Etapa</div>
            <h2>{step.title}</h2>
            <p>{step.body}</p>
          </article>
        ))}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Fecho</div>
        <p>
          A proposta não é substituir a responsabilidade do cliente. É elevar a qualidade do processo decisório com
          método, contexto e registro.
        </p>
        <p className="hint">
          A conversa inicial continua tendo caráter informativo e de triagem. A consultoria personalizada só começa
          após proposta, contratação formal e coleta das informações necessárias.
        </p>
      </section>
    </main>
  );
}
