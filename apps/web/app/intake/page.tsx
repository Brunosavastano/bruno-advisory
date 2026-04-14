import { recordIntakeEvent } from '../../lib/intake-storage';
import { PageIntro } from '../site-shell';
import { IntakeForm } from './intake-form';

type IntakePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getFirstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function IntakePage({ searchParams }: IntakePageProps) {
  const params = searchParams ? await searchParams : {};
  const sourceLabel = getFirstParam(params.sourceLabel)?.trim() || 'site_home_primary_cta';

  recordIntakeEvent({
    eventName: 't2_intake_viewed',
    occurredAt: new Date().toISOString(),
    metadata: { sourceLabel }
  });

  return (
    <main>
      <PageIntro
        badge="Intake"
        title="Triagem inicial"
        description="Preencha os dados mínimos para qualificação inicial. Esta etapa é informativa e de triagem, não uma recomendação individualizada de investimento."
        actions={
          <>
            <a className="btn btn-secondary" href="/">
              Voltar
            </a>
            <a className="btn btn-secondary" href="/privacidade">
              Privacidade
            </a>
            <a className="btn btn-secondary" href="/termos">
              Termos
            </a>
          </>
        }
      />

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="kicker">Antes de enviar</div>
        <p>
          A conversa inicial serve para entender contexto, avaliar aderência e explicar próximos passos. Se houver fit,
          os próximos passos normalmente incluem proposta, coleta das informações necessárias, suitability e
          contratação formal.
        </p>
        <p className="hint">
          Leia a <a href="/privacidade">Política de Privacidade</a> e os <a href="/termos">Termos de Uso</a>
          {' '}antes de consentir com o envio.
        </p>
      </section>

      <IntakeForm sourceLabel={sourceLabel} />
    </main>
  );
}
