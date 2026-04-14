import { PageIntro } from '../site-shell';

export const metadata = {
  title: 'Termos de Uso | Bruno Advisory'
};

const pendingItems = ['identificação pública CVM', 'e-mail público', 'endereço profissional', 'foro/cidade aplicável'];

export default function TermosPage() {
  return (
    <main>
      <PageIntro
        badge="Compliance"
        title="Termos de Uso e Condições Gerais"
        description="Última atualização: 2026-04-13. Esta superfície pública segue o pacote canônico de compliance e marca explicitamente os dados ainda pendentes de publicação."
        actions={
          <>
            <a className="btn" href="/go/intake?sourceLabel=site_home_primary_cta">
              Solicitar conversa inicial
            </a>
            <a className="btn btn-secondary" href="/privacidade">
              Ver política de privacidade
            </a>
          </>
        }
      />

      <section className="card">
        <div className="kicker">Identificação</div>
        <p>
          Este site é mantido por Bruno Savastano, em nome próprio, com foco em consultoria independente para pessoas
          físicas premium.
        </p>
        <p className="hint">Detalhes públicos ainda pendentes de publicação: {pendingItems.join(', ')}.</p>
      </section>

      <section className="grid" style={{ marginTop: 16 }}>
        <article className="card">
          <div className="kicker">Natureza do site</div>
          <ul className="list">
            <li>institucional</li>
            <li>informativa</li>
            <li>comercial de captação e triagem inicial</li>
            <li>operacional para início de relacionamento, quando aplicável</li>
          </ul>
          <p className="hint">
            O conteúdo público do site não substitui análise individual, suitability, contrato escrito ou interação
            profissional personalizada.
          </p>
        </article>
        <article className="card">
          <div className="kicker">Conversa inicial e início do serviço</div>
          <p>
            A conversa inicial existe para entender contexto, verificar aderência entre demanda e oferta, esclarecer o
            escopo do trabalho e avaliar a conveniência de avançar para proposta comercial.
          </p>
          <p>
            A consultoria personalizada somente se inicia após aceite mútuo, formalização contratual, fornecimento das
            informações necessárias e conclusão das etapas mínimas de cadastro, suitability e compliance.
          </p>
        </article>
      </section>

      <section className="grid" style={{ marginTop: 16 }}>
        <article className="card">
          <div className="kicker">Escopo e limites</div>
          <p>
            Em regra, o serviço poderá incluir orientação, recomendação e aconselhamento sobre investimentos dentro dos
            limites legais e regulatórios aplicáveis.
          </p>
          <ul className="list">
            <li>não inclui administração discricionária de carteira</li>
            <li>não inclui custódia de ativos</li>
            <li>não inclui intermediação ou distribuição de valores mobiliários</li>
            <li>não inclui execução de ordens em nome do cliente</li>
            <li>não inclui promessa de rentabilidade</li>
          </ul>
        </article>
        <article className="card">
          <div className="kicker">Deveres do usuário</div>
          <ul className="list">
            <li>fornecer informações verdadeiras, completas e atualizadas</li>
            <li>não enviar dados excessivos ou inadequados pelo canal público</li>
            <li>não utilizar o site para fins ilícitos</li>
            <li>comunicar mudanças relevantes de perfil, situação financeira, objetivos e restrições</li>
          </ul>
        </article>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Tecnologia, IA e arquivamento</div>
        <p>
          Ferramentas tecnológicas, automações e inteligência artificial podem ser utilizadas para apoio operacional,
          organização, documentação, elaboração de rascunhos, análise preparatória e fluxos internos.
        </p>
        <p>
          Comunicações e documentos relacionados ao relacionamento profissional podem ser registrados e arquivados para
          fins de compliance, segurança, auditoria, defesa de direitos e cumprimento regulatório.
        </p>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Lei aplicável</div>
        <p>Aplica-se a legislação brasileira.</p>
        <p className="hint">
          A cidade/foro de referência ainda depende de publicação canônica final. A página mantém essa pendência
          explícita, sem preencher um valor não confirmado.
        </p>
      </section>
    </main>
  );
}
