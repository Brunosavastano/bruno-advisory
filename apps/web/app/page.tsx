import { getProjectState } from '../lib/state';

export default function ControlRoomPage() {
  const state = getProjectState();

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Control Room</div>
          <h1>{state.projectName}</h1>
          <p>Ledger vivo mínimo do projeto, derivado do canon do repositório.</p>
        </div>
        <div>
          <a href="/health">Health page</a>
        </div>
      </div>

      <section className="grid">
        <div className="card"><div className="kicker">Projeto</div><div className="value">{state.projectName}</div></div>
        <div className="card"><div className="kicker">Tranche ativa</div><div className="value">{state.activeTranche}</div></div>
        <div className="card"><div className="kicker">Status da tranche</div><div className="value">{state.trancheStatus}</div></div>
        <div className="card"><div className="kicker">Stage gate</div><div className="value">{state.stageGate}</div></div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Top risks</div>
        <ol className="list">
          {state.topRisks.map((risk) => (
            <li key={risk}>{risk}</li>
          ))}
        </ol>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Última decisão canônica</div>
        <p>{state.latestDecision}</p>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Fontes canônicas lidas</div>
        <ul className="list">
          {state.sourceFiles.map((file) => (
            <li key={file}><code>{file}</code></li>
          ))}
        </ul>
      </section>
    </main>
  );
}
