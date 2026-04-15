'use client';

import type { ResearchWorkflowRecord, ResearchWorkflowStatus } from '@bruno-advisory/core';
import { useState } from 'react';

export function ResearchWorkflowsPanel(props: {
  leadId: string;
  initialWorkflows: ResearchWorkflowRecord[];
  statuses: readonly ResearchWorkflowStatus[];
  canonicalArtifact: string;
}) {
  const [workflows, setWorkflows] = useState(props.initialWorkflows);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [statusDraft, setStatusDraft] = useState<Record<string, ResearchWorkflowStatus>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/cockpit/leads/${props.leadId}/research-workflows`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, topic })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Falha ao criar workflow.');
      }

      const workflow = payload.workflow as ResearchWorkflowRecord;
      setWorkflows((current) => [workflow, ...current]);
      setTitle('');
      setTopic('');
      setStatusMessage('Workflow criado.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Falha ao criar workflow.');
    } finally {
      setBusy(false);
    }
  }

  async function saveStatus(id: string) {
    const status = statusDraft[id] ?? workflows.find((workflow) => workflow.id === id)?.status;
    if (!status) {
      return;
    }

    setBusy(true);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/cockpit/leads/${props.leadId}/research-workflows`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Falha ao atualizar workflow.');
      }

      const updated = payload.workflow as ResearchWorkflowRecord;
      setWorkflows((current) => current.map((workflow) => (workflow.id === id ? updated : workflow)));
      setStatusDraft((current) => ({ ...current, [id]: updated.status }));
      setStatusMessage('Status atualizado.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Falha ao atualizar workflow.');
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id: string) {
    setBusy(true);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/cockpit/leads/${props.leadId}/research-workflows`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Falha ao excluir workflow.');
      }

      setWorkflows((current) => current.filter((workflow) => workflow.id !== id));
      setStatusMessage('Workflow removido.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Falha ao excluir workflow.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="research-workflows" className="card" style={{ marginTop: 16 }}>
      <div className="kicker">Research workflow T5 cycle 1</div>
      <form className="form" onSubmit={createItem}>
        <label>
          Título
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Carteira internacional abril" required />
        </label>
        <label>
          Tópico
          <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Ex.: Hedge cambial e diversificação" required />
        </label>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Salvando...' : 'Criar workflow'}
        </button>
      </form>

      {statusMessage ? <p style={{ marginTop: 12 }}>{statusMessage}</p> : null}
      <p className="hint" style={{ marginTop: 12 }}>
        Modelo canônico: <code>{props.canonicalArtifact}</code>
      </p>
      <p className="hint">Status canônicos: {props.statuses.join(' → ')}</p>

      {workflows.length === 0 ? (
        <p style={{ marginTop: 12 }}>Nenhum workflow de research registrado ainda.</p>
      ) : (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>createdAt</th>
                <th>title</th>
                <th>topic</th>
                <th>status</th>
                <th>updatedAt</th>
                <th>actions</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((workflow) => (
                <tr key={workflow.id}>
                  <td>{workflow.createdAt}</td>
                  <td>{workflow.title}</td>
                  <td>{workflow.topic}</td>
                  <td>
                    <select
                      value={statusDraft[workflow.id] ?? workflow.status}
                      onChange={(event) => setStatusDraft((current) => ({
                        ...current,
                        [workflow.id]: event.target.value as ResearchWorkflowStatus
                      }))}
                    >
                      {props.statuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  <td>{workflow.updatedAt}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => saveStatus(workflow.id)}>
                        Salvar status
                      </button>
                      <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => removeItem(workflow.id)}>
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
