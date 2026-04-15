import { getIntakeStoragePaths, listReviewQueueItems } from '../../../lib/intake-storage';
import { ReviewQueuePanel } from './review-queue-panel';

export const dynamic = 'force-dynamic';

export default function ReviewQueuePage() {
  const items = listReviewQueueItems();
  const paths = getIntakeStoragePaths();

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Cockpit interno</div>
          <h1>Human review queue</h1>
          <p>Fila única para memos em pending_review e research workflows em review.</p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href="/cockpit/leads">Leads</a>
          <a className="btn btn-secondary" href="/cockpit/billing">Billing overview</a>
          <a className="btn btn-secondary" href="/cockpit/flags">Flags overview</a>
        </div>
      </div>

      <section className="card">
        <div className="kicker">Review queue observability</div>
        <p className="hint">DB: {paths.database}</p>
        <p className="hint">Tabela de research workflows: {paths.researchWorkflowsTable}</p>
        <p className="hint">Tabela de memos: {paths.memosTable}</p>
        <p className="hint">Itens pendentes agora: {items.length}</p>
      </section>

      <ReviewQueuePanel initialItems={items} />
    </main>
  );
}
