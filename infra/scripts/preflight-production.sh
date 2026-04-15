#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

required_vars=(
  NODE_ENV
  PORT
  APP_BASE_URL
  COCKPIT_SECRET
  DATABASE_PROVIDER
  DATABASE_URL
  BACKUP_ARCHIVE
)

errors=()
for var_name in "${required_vars[@]}"; do
  if [ -z "${!var_name:-}" ]; then
    errors+=("missing required env var: ${var_name}")
  fi
done

if [ "${#errors[@]}" -gt 0 ]; then
  printf 'Preflight failed:\n' >&2
  for err in "${errors[@]}"; do
    printf ' - %s\n' "$err" >&2
  done
  exit 1
fi

case "$NODE_ENV" in
  production|development|test) ;;
  *)
    echo "Preflight failed: NODE_ENV must be one of production, development, test." >&2
    exit 1
    ;;
esac

if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
  echo "Preflight failed: PORT must be numeric." >&2
  exit 1
fi

if ! [[ "$APP_BASE_URL" =~ ^https?:// ]]; then
  echo "Preflight failed: APP_BASE_URL must start with http:// or https://." >&2
  exit 1
fi

if [ "$NODE_ENV" = "production" ] && ! [[ "$APP_BASE_URL" =~ ^https:// ]]; then
  echo "Preflight failed: production APP_BASE_URL must start with https://." >&2
  exit 1
fi

if [ "${#COCKPIT_SECRET}" -lt 16 ]; then
  echo "Preflight failed: COCKPIT_SECRET must be at least 16 characters." >&2
  exit 1
fi

mkdir -p "$(dirname "$BACKUP_ARCHIVE")"

provider="$(printf '%s' "$DATABASE_PROVIDER" | tr '[:upper:]' '[:lower:]')"

bootstrap_sqlite_schema() {
  local route_module="apps/web/.next/server/app/api/cockpit/audit-log/route.js"

  if [ ! -f "$route_module" ]; then
    rm -rf apps/web/.next apps/web/.next.partial.* 2>/dev/null || true
    NODE_ENV=production npm run build >/dev/null
  fi

  node - "$ROOT" <<'NODE'
const path = require('node:path');

async function main() {
  const root = process.argv[2];
  const modulePath = path.join(root, 'apps', 'web', '.next', 'server', 'app', 'api', 'cockpit', 'audit-log', 'route.js');
  const userland = require(modulePath).routeModule.userland;
  process.chdir(root);
  const response = await userland.GET(new Request('http://localhost/api/cockpit/audit-log?limit=1'));
  if (response.status !== 200) {
    const text = await response.text();
    throw new Error(`SQLite bootstrap via compiled audit route failed with status ${response.status}: ${text}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
NODE
}

case "$provider" in
  sqlite)
    expected_default_db="$ROOT/data/dev/bruno-advisory-dev.sqlite3"
    db_url="$DATABASE_URL"
    if [ "$db_url" != "$expected_default_db" ]; then
      echo "Preflight failed: current SQLite runtime is repo-local only. Set DATABASE_URL to $expected_default_db for local verification." >&2
      exit 1
    fi

    bootstrap_sqlite_schema

    node - "$DATABASE_URL" <<'NODE'
const dbPath = process.argv[2];
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');

const requiredTables = [
  'intake_leads',
  'memos',
  'research_workflows',
  'audit_log',
  'lead_billing_records',
  'portal_invites'
];

if (!fs.existsSync(dbPath)) {
  console.error(`Preflight failed: SQLite database not found at ${dbPath}`);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
const missing = requiredTables.filter((table) => {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1").get(table);
  return !row;
});

if (missing.length > 0) {
  console.error(`Preflight failed: missing SQLite tables: ${missing.join(', ')}`);
  process.exit(1);
}

const probe = db.prepare('SELECT 1 AS ok').get();
if (!probe || probe.ok !== 1) {
  console.error('Preflight failed: SQLite probe query did not return ok=1.');
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, provider: 'sqlite', databasePath: dbPath, checkedTables: requiredTables }, null, 2));
NODE
    ;;
  postgresql|postgres|pg)
    if ! command -v psql >/dev/null 2>&1; then
      echo "Preflight failed: psql is required for PostgreSQL validation in this cycle." >&2
      echo "Install the PostgreSQL client or run the migration plan in docs/postgres-migration.md." >&2
      exit 1
    fi

    if ! psql "$DATABASE_URL" -Atqc 'SELECT 1;' >/dev/null 2>&1; then
      echo "Preflight failed: could not connect to PostgreSQL with DATABASE_URL." >&2
      exit 1
    fi

    missing_tables="$(psql "$DATABASE_URL" -Atqc "
      WITH required(name) AS (
        VALUES
          ('intake_leads'),
          ('memos'),
          ('research_workflows'),
          ('audit_log'),
          ('lead_billing_records'),
          ('portal_invites')
      )
      SELECT required.name
      FROM required
      LEFT JOIN information_schema.tables t
        ON t.table_schema = 'public'
       AND t.table_name = required.name
      WHERE t.table_name IS NULL
      ORDER BY required.name;
    ")"

    if [ -n "$missing_tables" ]; then
      echo "Preflight failed: missing PostgreSQL tables:" >&2
      printf '%s\n' "$missing_tables" >&2
      exit 1
    fi

    printf '{\n  "ok": true,\n  "provider": "postgresql",\n  "checkedTables": ["intake_leads", "memos", "research_workflows", "audit_log", "lead_billing_records", "portal_invites"]\n}\n'
    ;;
  *)
    echo "Preflight failed: unsupported DATABASE_PROVIDER '$DATABASE_PROVIDER'. Use sqlite or postgresql." >&2
    exit 1
    ;;
esac
