'use client';

import type { MemoRecord, MemoStatus, ResearchWorkflowRecord } from '@bruno-advisory/core';
import { useState } from 'react';

export function MemosPanel(props: {
  leadId: string;
  initialMemos: MemoRecord[];
  workflows: ResearchWorkflowRecord[];
  statuses: readonly MemoStatus[];
  canonicalArtifact: string;
}) {
  const [memos, setMemos] = useState(props.initialMemos);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [researchWorkflowId, setResearchWorkflowId] = useState('');
  const [draftBody, setDraftBody] = useState<Record<string, string>>({});
  const [draftStatus, setDraftStatus] = useState<Record<string, MemoStatus>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const workflowLabelById = new Map(props.workflows.map((workflow) => [workflow.id, workflow.title]));

  async function createMemo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/cockpit/leads/${props.leadId}/memos`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, body, researchWorkflowId: researchWorkflowId || null })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Falha ao criar memo.');
      }

      const memo = payload.memo as MemoRecord;
      setMemos((current) => [memo, ...current]);
      setTitle('');
      setBody('');
      setResearchWorkflowId('');
      setMessage('Memo criado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao criar memo.');
    } finally {
      setBusy(false);
    }
  }

  async function saveMemo(id: string) {
    const currentMemo = memos.find((memo) => memo.id === id);
    if (!currentMemo) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/cockpit/leads/${props.leadId}/memos`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id,
          body: draftBody[id] ?? currentMemo.body,
          status: draftStatus[id] ?? currentMemo.status
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Falha ao atualizar memo.');
      }

      const memo = payload.memo as MemoRecord;
      setMemos((current) => current.map((item) => (item.id === id ? memo : item)));
      setDraftBody((current) => ({ ...current, [id]: memo.body }));
      setDraftStatus((current) => ({ ...current, [id]: memo.status }));
      setMessage('Memo atualizado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao atualizar memo.');
    } finally {
      setBusy(false);
    }
  }

  async function removeMemo(id: string) {
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/cockpit/leads/${props.leadId}/memos`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Falha ao excluir memo.');
      }

      setMemos((current) => current.filter((memo) => memo.id !== id));
      setMessage('Memo removido.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao excluir memo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="kicker">Memo container T5 cycle 2</div>
      <form className="form" onSubmit={createMemo}>
        <label>
          Título
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Nota de cenário semanal" required />
        </label>
        <label>
          Research workflow (opcional)
          <select value={researchWorkflowId} onChange={(event) => setResearchWorkflowId(event.target.value)}>
            <option value="">Sem vínculo</option>
            {props.workflows.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>{workflow.title}</option>
            ))}
          </select>
        </label>
        <label>
          Corpo
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={6} placeholder="Escreva o memo manualmente." required />
        </label>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Salvando...' : 'Criar memo'}
        </button>
      </form>

      {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}
      <p className="hint" style={{ marginTop: 12 }}>
        Modelo canônico: <code>{props.canonicalArtifact}</code>
      </p>
      <p className="hint">Status canônicos: {props.statuses.join(' → ')}</p>

      {memos.length === 0 ? (
        <p style={{ marginTop: 12 }}>Nenhum memo registrado ainda.</p>
      ) : (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>createdAt</th>
                <th>title</th>
                <th>research</th>
                <th>status</th>
                <th>body</th>
                <th>updatedAt</th>
                <th>actions</th>
              </tr>
            </thead>
            <tbody>
              {memos.map((memo) => (
                <tr key={memo.id}>
                  <td>{memo.createdAt}</td>
                  <td>{memo.title}</td>
                  <td>
                    {memo.researchWorkflowId ? (
                      <a href={`/cockpit/leads/${props.leadId}#research-workflows`}>
                        {workflowLabelById.get(memo.researchWorkflowId) ?? memo.researchWorkflowId}
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    <select
                      value={draftStatus[memo.id] ?? memo.status}
                      onChange={(event) => setDraftStatus((current) => ({
                        ...current,
                        [memo.id]: event.target.value as MemoStatus
                      }))}
                    >
                      {props.statuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <textarea
                      value={draftBody[memo.id] ?? memo.body}
                      rows={5}
                      onChange={(event) => setDraftBody((current) => ({ ...current, [memo.id]: event.target.value }))}
                    />
                  </td>
                  <td>{memo.updatedAt}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => saveMemo(memo.id)}>
                        Salvar
                      </button>
                      <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => removeMemo(memo.id)}>
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
