'use client';

import { useState } from 'react';

type Mode = 'idle' | 'rejecting' | 'submitting';

export function ArtifactReviewActions({ leadId, artifactId }: { leadId: string; artifactId: string }) {
  const [mode, setMode] = useState<Mode>('idle');
  const [rejectionReason, setRejectionReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function submit(action: 'approved' | 'rejected') {
    if (action === 'rejected' && rejectionReason.trim().length === 0) {
      setMessage('Motivo de rejeição é obrigatório.');
      return;
    }
    setMode('submitting');
    setMessage(null);
    try {
      const response = await fetch(`/api/cockpit/leads/${leadId}/ai/artifacts/${artifactId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status: action,
          rejectionReason: action === 'rejected' ? rejectionReason.trim() : null
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        setMode('idle');
        setMessage(body.reason ?? body.error ?? `HTTP ${response.status}`);
        return;
      }
      setMessage(action === 'approved' ? 'Artifact aprovado. Recarregando...' : 'Artifact rejeitado. Recarregando...');
      setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      setMode('idle');
      setMessage(error instanceof Error ? error.message : 'Falha de rede.');
    }
  }

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="kicker">Ações de revisão</div>
      <p>Este artifact está em <strong>pending_review</strong>. Aprove para registrar como revisado humanamente, ou rejeite com motivo.</p>

      {message ? (
        <p style={{ color: message.includes('aprovado') || message.includes('rejeitado') ? '#027a48' : '#b42318' }}>{message}</p>
      ) : null}

      {mode === 'idle' ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button type="button" className="btn" onClick={() => submit('approved')}>
            Aprovar
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setMode('rejecting')}>
            Rejeitar
          </button>
        </div>
      ) : null}

      {mode === 'rejecting' ? (
        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block' }}>
            Motivo da rejeição (obrigatório)
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ex.: linguagem prometendo retorno, falta contexto regulatório, prefiro reescrever do zero..."
              style={{ width: '100%', marginTop: 4 }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="btn"
              disabled={rejectionReason.trim().length === 0}
              onClick={() => submit('rejected')}
            >
              Confirmar rejeição
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setMode('idle');
                setRejectionReason('');
                setMessage(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'submitting' ? <p style={{ marginTop: 8 }}>Enviando…</p> : null}
    </section>
  );
}
