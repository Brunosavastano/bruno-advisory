import { PageIntro } from '../site-shell';

export const metadata = {
  title: 'Política de Privacidade | Bruno Advisory'
};

const pendingItems = [
  'identificação pública CVM',
  'e-mail de privacidade',
  'endereço profissional',
  'lista final de provedores relevantes'
];

export default function PrivacidadePage() {
  return (
    <main>
      <PageIntro
        badge="Compliance"
        title="Política de Privacidade"
        description="Última atualização: 2026-04-13. Esta página foi publicada a partir do canon local de compliance, sem inventar dados ainda pendentes de publicação."
        actions={
          <>
            <a className="btn" href="/go/intake?sourceLabel=site_home_primary_cta">
              Solicitar conversa inicial
            </a>
            <a className="btn btn-secondary" href="/termos">
              Ver termos de uso
            </a>
          </>
        }
      />

      <section className="card">
        <div className="kicker">Controlador</div>
        <p>
          Bruno Savastano atua em nome próprio no contexto deste site, do contato inicial, da apresentação de
          proposta, do onboarding e da prestação de serviços.
        </p>
        <p className="hint">
          Detalhes canônicos ainda pendentes de publicação pública: {pendingItems.join(', ')}.
        </p>
      </section>

      <section className="grid" style={{ marginTop: 16 }}>
        <article className="card">
          <div className="kicker">Dados que podem ser tratados</div>
          <ul className="list">
            <li>nome, e-mail, telefone, cidade e estado</li>
            <li>faixa patrimonial e contexto resumido do desafio</li>
            <li>logs técnicos mínimos de acesso e segurança</li>
            <li>dados adicionais de onboarding apenas em etapa posterior adequada</li>
          </ul>
        </article>
        <article className="card">
          <div className="kicker">Finalidades</div>
          <ul className="list">
            <li>receber, organizar e responder solicitações enviadas pelo site</li>
            <li>agendar e realizar conversa inicial de triagem e aderência</li>
            <li>avaliar compatibilidade entre caso e oferta do serviço</li>
            <li>cumprir deveres legais, regulatórios e de compliance</li>
            <li>manter segurança, estabilidade e auditabilidade do ambiente</li>
          </ul>
        </article>
      </section>

      <section className="grid" style={{ marginTop: 16 }}>
        <article className="card">
          <div className="kicker">Não enviar no formulário público</div>
          <ul className="list">
            <li>senhas ou códigos de autenticação</li>
            <li>dados completos de conta bancária ou corretora</li>
            <li>CPF, RG, extratos completos ou documentos de KYC</li>
            <li>dados pessoais sensíveis desnecessários</li>
          </ul>
        </article>
        <article className="card">
          <div className="kicker">Bases legais e retenção</div>
          <p>
            O tratamento pode se apoiar em execução de procedimentos preliminares, cumprimento de obrigação legal ou
            regulatória, exercício regular de direitos, legítimo interesse quando cabível e consentimento quando
            necessário.
          </p>
          <p className="hint">
            Contatos não convertidos em clientes, em regra, podem ser mantidos por até 12 meses da última interação,
            salvo necessidade legítima ou regulatória de retenção por prazo maior.
          </p>
        </article>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Uso de IA e automações</div>
        <p>
          Ferramentas de automação e inteligência artificial podem ser utilizadas para apoio operacional, organização
          de informações, elaboração de rascunhos, resumos, classificação interna, registro e apoio analítico.
        </p>
        <p>
          Essas ferramentas não eliminam a responsabilidade profissional do consultor. Recomendações personalizadas e
          comunicações sensíveis permanecem sujeitas a revisão humana adequada.
        </p>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Direitos e contato</div>
        <p>
          O titular pode solicitar confirmação de tratamento, acesso, correção, informações sobre compartilhamento,
          revogação de consentimento quando aplicável e demais direitos cabíveis nos termos da legislação.
        </p>
        <p className="hint">
          O canal público específico para privacidade ainda está pendente de publicação canônica. Até lá, esta página
          deixa a pendência explícita em vez de inventar um contato.
        </p>
      </section>
    </main>
  );
}
