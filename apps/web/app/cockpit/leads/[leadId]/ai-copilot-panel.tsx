'use client';

import { useState } from 'react';

type SurfaceKey = 'memo-draft' | 'research-summary' | 'pre-call-brief' | 'follow-up-draft' | 'pending-checklist';

type Surface = {
  key: SurfaceKey;
  label: string;
  description: string;
};

const SURFACES: ReadonlyArray<Surface> = [
  { key: 'memo-draft', label: 'Gerar memo', description: 'Rascunho de memo interno para revisão.' },
  { key: 'research-summary', label: 'Resumir pesquisa', description: 'Resume documentos aceitos + research workflows entregues.' },
  { key: 'pre-call-brief', label: 'Briefing pré-call', description: 'Pontos a validar e perguntas sugeridas antes da reunião.' },
  { key: 'follow-up-draft', label: 'Follow-up pós-call', description: 'Rascunho de mensagem para enviar depois da reunião.' },
  { key: 'pending-checklist', label: 'Checklist pendências', description: 'Lista de itens em aberto com prioridade.' }
];

type ResultEntry = {
  id: number;
  surface: string;
  status: 'success' | 'error';
  message: string;
  artifactId?: string;
};

export function AiCopilotPanel({ leadId }: { leadId: string }) {
  const [busy, setBusy] = useState<SurfaceKey | null>(null);
  const [focusHint, setFocusHint] = useState('');
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [counter, setCounter] = useState(0);

  async function trigger(surface: Surface) {
    setBusy(surface.key);
    const id = counter + 1;
    setCounter(id);

    try {
      const response = await fetch(`/api/cockpit/leads/${leadId}/ai/${surface.key}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ focusHint: focusHint.trim() || undefined })
      });
      const body = await response.json().catch(() => ({}));

      if (response.ok && body.ok) {
        setResults((prev) => [
          {
            id,
            surface: surface.label,
            status: 'success',
            message: `Gerado em ${(Number(body.latencyMs ?? 0) / 1000).toFixed(1)}s — custo ${body.costCents ?? 0}¢`,
            artifactId: body.artifactId
          },
          ...prev
        ]);
      } else {
        let errorMsg: string;
        if (body.error === 'blocked_budget') {
          errorMsg = 'Bloqueado por orçamento. Aumente o cap em ai_budget_caps ou aguarde o próximo período.';
        } else if (body.error === 'blocked_guardrail') {
          errorMsg = `Bloqueado por guardrail: ${body.reason ?? 'output violou regra de compliance'}`;
        } else if (body.error === 'ai_disabled') {
          errorMsg = 'IA desabilitada (AI_ENABLED=false no servidor).';
        } else if (body.error === 'provider_unavailable' || body.error === 'provider_failure') {
          errorMsg = `Falha no provedor: ${body.reason ?? body.error}`;
        } else {
          errorMsg = body.reason ?? body.error ?? `HTTP ${response.status}`;
        }
        setResults((prev) => [
          { id, surface: surface.label, status: 'error', message: errorMsg },
          ...prev
        ]);
      }
    } catch (error) {
      setResults((prev) => [
        {
          id,
          surface: surface.label,
          status: 'error',
          message: error instanceof Error ? error.message : 'Falha de rede'
        },
        ...prev
      ]);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="kicker">Copiloto IA</div>
      <p>
        Gere rascunhos com IA para revisão na <a href="/cockpit/review-queue">fila de revisão</a>. Tudo
        passa por guardrails (sem promessa de retorno, sem minimização de risco), redação de PII
        sensível e budget caps antes de chegar ao Anthropic.
      </p>

      <label style={{ display: 'block', marginTop: 8 }}>
        Foco específico (opcional)
        <input
          type="text"
          value={focusHint}
          onChange={(e) => setFocusHint(e.target.value)}
          placeholder='Ex.: "revisar carteira pós-Selic", "preparar para reunião sobre liquidez"'
          style={{ width: '100%', marginTop: 4 }}
          disabled={busy !== null}
        />
      </label>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 8,
          marginTop: 12
        }}
      >
        {SURFACES.map((surface) => (
          <button
            key={surface.key}
            type="button"
            className="btn"
            disabled={busy !== null}
            onClick={() => trigger(surface)}
            title={surface.description}
          >
            {busy === surface.key ? 'Gerando…' : surface.label}
          </button>
        ))}
      </div>

      {results.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Últimas execuções desta sessão</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {results.slice(0, 10).map((entry) => (
              <li
                key={entry.id}
                style={{
                  padding: '8px 12px',
                  borderLeft: entry.status === 'success' ? '3px solid #027a48' : '3px solid #b42318',
                  marginBottom: 6,
                  background: 'rgba(255, 255, 255, 0.03)',
                  fontSize: 14
                }}
              >
                <strong>{entry.surface}</strong> — {entry.message}
                {entry.artifactId ? (
                  <>
                    {' '}
                    — <a href={`/cockpit/ai-artifacts/${entry.artifactId}`}>Ver artifact</a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
