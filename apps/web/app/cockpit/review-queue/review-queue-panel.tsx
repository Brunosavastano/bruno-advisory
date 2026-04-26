'use client';

import type { ReviewQueueItem } from '../../../lib/storage/types';
import { useMemo, useState } from 'react';

type Filter = 'all' | 'ai_artifact' | 'memo' | 'research_workflow';

const FILTER_OPTIONS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'ai_artifact', label: 'IA' },
  { key: 'memo', label: 'Memos' },
  { key: 'research_workflow', label: 'Research' }
];

type RejectModalState =
  | { open: false }
  | { open: true; item: ReviewQueueItem; reason: string };

export function ReviewQueuePanel(props: { initialItems: ReviewQueueItem[] }) {
  const [items, setItems] = useState(props.initialItems);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [rejectModal, setRejectModal] = useState<RejectModalState>({ open: false });

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((entry) => entry.type === filter);
  }, [items, filter]);

  const counts = useMemo(() => {
    return {
      all: items.length,
      ai_artifact: items.filter((i) => i.type === 'ai_artifact').length,
      memo: items.filter((i) => i.type === 'memo').length,
      research_workflow: items.filter((i) => i.type === 'research_workflow').length
    };
  }, [items]);

  async function applyAction(item: ReviewQueueItem, action: 'approved' | 'rejected', rejectionReason: string | null) {
    setBusyId(item.id);
    setMessage(null);

    try {
      let response: Response;
      if (item.type === 'ai_artifact') {
        response = await fetch(`/api/cockpit/leads/${item.leadId}/ai/artifacts/${item.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status: action, rejectionReason })
        });
      } else {
        const endpoint =
          item.type === 'memo'
            ? `/api/cockpit/leads/${item.leadId}/memos`
            : `/api/cockpit/leads/${item.leadId}/research-workflows`;
        response = await fetch(endpoint, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: item.id, status: action, rejectionReason })
        });
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Falha ao revisar item.');
      }

      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setMessage(action === 'approved' ? `${item.title} aprovado.` : `${item.title} rejeitado.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao revisar item.');
    } finally {
      setBusyId(null);
    }
  }

  function openRejectModal(item: ReviewQueueItem) {
    setRejectModal({ open: true, item, reason: '' });
    setMessage(null);
  }

  function closeRejectModal() {
    setRejectModal({ open: false });
  }

  function confirmReject() {
    if (!rejectModal.open) return;
    const reason = rejectModal.reason.trim();
    if (!reason) return;
    const item = rejectModal.item;
    setRejectModal({ open: false });
    void applyAction(item, 'rejected', reason);
  }

  function viewLink(item: ReviewQueueItem): string {
    if (item.type === 'ai_artifact') return `/cockpit/ai-artifacts/${item.id}`;
    return `/cockpit/leads/${item.leadId}`;
  }

  function viewLabel(item: ReviewQueueItem): string {
    if (item.type === 'ai_artifact') return 'Abrir artifact';
    return 'Abrir lead';
  }

  return (
    <>
      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Filtros</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={filter === option.key ? 'btn' : 'btn btn-secondary'}
              onClick={() => setFilter(option.key)}
            >
              {option.label} ({counts[option.key]})
            </button>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Itens pendentes — {filteredItems.length}</div>
        {message ? (
          <p
            style={{
              marginTop: 8,
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.04)',
              borderLeft: '3px solid #C5A55A',
              borderRadius: 4
            }}
          >
            {message}
          </p>
        ) : null}

        {filteredItems.length === 0 ? (
          <p style={{ marginTop: 12 }}>
            {filter === 'all' ? 'Nenhum item pendente de review agora.' : 'Nenhum item neste filtro.'}
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 12,
              marginTop: 12
            }}
          >
            {filteredItems.map((item) => {
              const busy = busyId === item.id;
              const isAi = item.type === 'ai_artifact';
              return (
                <article
                  key={`${item.type}-${item.id}`}
                  style={{
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    padding: 16,
                    background: 'rgba(255,255,255,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}
                >
                  <header style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    {isAi ? (
                      <>
                        <span
                          className="badge"
                          style={{ background: '#8B1A1A', color: '#F5F0E8', borderColor: '#8B1A1A' }}
                        >
                          IA
                        </span>
                        <span className="badge" style={{ fontSize: 11 }}>
                          {item.subtype ?? 'ai_artifact'}
                        </span>
                      </>
                    ) : (
                      <span className="badge">{item.type}</span>
                    )}
                  </header>

                  <h3 style={{ margin: 0, fontSize: 16, lineHeight: 1.3 }}>{item.title}</h3>

                  <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>
                    {item.leadName}
                    <br />
                    <span style={{ fontSize: 12, opacity: 0.6 }}>{item.updatedAt}</span>
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto' }}>
                    <a className="btn btn-secondary" href={viewLink(item)} style={{ fontSize: 13 }}>
                      {viewLabel(item)}
                    </a>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => applyAction(item, 'approved', null)}
                      style={{ fontSize: 13 }}
                    >
                      Aprovar
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => openRejectModal(item)}
                      style={{ fontSize: 13 }}
                    >
                      Rejeitar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {rejectModal.open ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(13,13,13,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeRejectModal();
          }}
        >
          <div
            style={{
              background: '#1A1A1A',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: 24,
              maxWidth: 520,
              width: '100%'
            }}
          >
            <h2 style={{ marginTop: 0 }}>Rejeitar — {rejectModal.item.title}</h2>
            <label style={{ display: 'block' }}>
              Motivo (obrigatório)
              <textarea
                rows={4}
                value={rejectModal.reason}
                onChange={(e) =>
                  setRejectModal((state) => (state.open ? { ...state, reason: e.target.value } : state))
                }
                placeholder="Explique brevemente o motivo da rejeição."
                style={{ width: '100%', marginTop: 4 }}
                autoFocus
              />
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn"
                disabled={rejectModal.reason.trim().length === 0}
                onClick={confirmReject}
              >
                Confirmar rejeição
              </button>
              <button type="button" className="btn btn-secondary" onClick={closeRejectModal}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
