'use client';

import { pendingFlagTypes, type PendingFlagRecord, type PendingFlagType } from '@bruno-advisory/core';
import { useState } from 'react';

export function LeadFlagsPanel(props: { leadId: string; initialFlags: PendingFlagRecord[] }) {
  const [flags, setFlags] = useState(props.initialFlags);
  const [flagType, setFlagType] = useState<PendingFlagType>('pending_document');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createFlag(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);

    try {
      const response = await fetch(`/api/cockpit/leads/${props.leadId}/flags`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ flagType, note, setBy: 'operator_local' })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to set flag');
      }

      const next = [payload.flag as PendingFlagRecord, ...flags.filter((item) => item.flagType !== payload.flag.flagType)];
      setFlags(next);
      setNote('');
      setStatus('Flag salva.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Falha ao salvar flag.');
    } finally {
      setBusy(false);
    }
  }

  async function clearCurrentFlag(type: PendingFlagType) {
    setBusy(true);
    setStatus(null);

    try {
      const response = await fetch(`/api/cockpit/leads/${props.leadId}/flags/${type}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clearedBy: 'operator_local' })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to clear flag');
      }

      setFlags((current) => current.filter((item) => item.flagType !== type));
      setStatus('Flag removida.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Falha ao remover flag.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="kicker">Internal pending flags T4 cycle 5</div>
      <form className="form" onSubmit={createFlag}>
        <label>
          Tipo
          <select value={flagType} onChange={(event) => setFlagType(event.target.value as PendingFlagType)}>
            {pendingFlagTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nota
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Opcional" />
        </label>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Salvando...' : 'Salvar flag'}
        </button>
      </form>

      {status ? <p style={{ marginTop: 12 }}>{status}</p> : null}

      {flags.length === 0 ? (
        <p style={{ marginTop: 12 }}>Nenhuma flag ativa.</p>
      ) : (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>flagType</th>
                <th>note</th>
                <th>setAt</th>
                <th>setBy</th>
                <th>action</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.flagId}>
                  <td>{flag.flagType}</td>
                  <td>{flag.note ?? '-'}</td>
                  <td>{flag.setAt}</td>
                  <td>{flag.setBy}</td>
                  <td>
                    <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => clearCurrentFlag(flag.flagType)}>
                      Clear
                    </button>
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
