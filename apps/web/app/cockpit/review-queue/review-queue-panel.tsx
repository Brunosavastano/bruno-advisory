'use client';

import type { ReviewQueueItem } from '../../../lib/storage/types';
import { useState } from 'react';

export function ReviewQueuePanel(props: { initialItems: ReviewQueueItem[] }) {
  const [items, setItems] = useState(props.initialItems);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function applyAction(item: ReviewQueueItem, action: 'approved' | 'rejected') {
    const rejectionReason = action === 'rejected'
      ? window.prompt(`Motivo da rejeição para ${item.title}:`, '')?.trim() ?? ''
      : '';

    if (action === 'rejected' && !rejectionReason) {
      setMessage('Rejeição cancelada ou sem motivo.');
      return;
    }

    setBusyId(item.id);
    setMessage(null);

    try {
      let response: Response;
      if (item.type === 'ai_artifact') {
        response = await fetch(`/api/cockpit/leads/${item.leadId}/ai/artifacts/${item.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status: action, rejectionReason: rejectionReason || null })
        });
      } else {
        const endpoint = item.type === 'memo'
          ? `/api/cockpit/leads/${item.leadId}/memos`
          : `/api/cockpit/leads/${item.leadId}/research-workflows`;
        response = await fetch(endpoint, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: item.id, status: action, rejectionReason: rejectionReason || null })
        });
      }

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Falha ao revisar item.');
      }

      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setMessage(action === 'approved' ? 'Item aprovado.' : 'Item rejeitado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao revisar item.');
    } finally {
      setBusyId(null);
    }
  }

  function renderTypeBadge(item: ReviewQueueItem) {
    if (item.type === 'ai_artifact') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="badge" style={{ background: '#8B1A1A', color: '#F5F0E8', borderColor: '#8B1A1A' }}>IA</span>
          <span className="badge" style={{ fontSize: 11 }}>{item.subtype ?? 'ai_artifact'}</span>
        </span>
      );
    }
    return <span className="badge">{item.type}</span>;
  }

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="kicker">Human review queue T5 cycle 3</div>
      {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}

      {items.length === 0 ? (
        <p style={{ marginTop: 12 }}>Nenhum item pendente de review agora.</p>
      ) : (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>type</th>
                <th>lead</th>
                <th>title</th>
                <th>status</th>
                <th>createdAt</th>
                <th>updatedAt</th>
                <th>context</th>
                <th>actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const busy = busyId === item.id;
                return (
                  <tr key={`${item.type}-${item.id}`}>
                    <td>{renderTypeBadge(item)}</td>
                    <td>{item.leadName}</td>
                    <td>{item.title}</td>
                    <td>{item.status}</td>
                    <td>{item.createdAt}</td>
                    <td>{item.updatedAt}</td>
                    <td>
                      <a href={`/cockpit/leads/${item.leadId}`}>Abrir lead</a>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => applyAction(item, 'approved')}>
                          Aprovar
                        </button>
                        <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => applyAction(item, 'rejected')}>
                          Rejeitar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
