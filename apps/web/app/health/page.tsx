import { getHealthState } from '../../lib/state';

export default function HealthPage() {
  const health = getHealthState();

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Health</div>
          <h1 className="status-ok">healthy</h1>
        </div>
        <div><a href="/">Back to landing</a></div>
      </div>
      <div className="card">
        <pre>{JSON.stringify(health, null, 2)}</pre>
      </div>
    </main>
  );
}
