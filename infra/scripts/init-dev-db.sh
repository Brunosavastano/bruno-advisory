#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DB_PATH="data/dev/bruno-advisory-dev.sqlite3"
EVIDENCE_PATH="state/evidence/T0/db-info.json"
mkdir -p "$(dirname "$DB_PATH")" "$(dirname "$EVIDENCE_PATH")"

python3 - "$DB_PATH" "$EVIDENCE_PATH" <<'PY'
import json, os, sqlite3, sys

db_path = sys.argv[1]
evidence_path = sys.argv[2]
conn = sqlite3.connect(db_path)
conn.execute("create table if not exists system_metadata (key text primary key, value text not null)")
conn.execute("insert or replace into system_metadata(key, value) values ('project', 'Bruno Advisory')")
conn.execute("insert or replace into system_metadata(key, value) values ('tranche', 'T0')")
conn.commit()
rows = conn.execute("select key, value from system_metadata order by key").fetchall()
conn.close()
with open(evidence_path, 'w', encoding='utf-8') as fh:
    json.dump({
        'dbPath': db_path,
        'exists': os.path.exists(db_path),
        'sizeBytes': os.path.getsize(db_path),
        'rows': rows,
    }, fh, indent=2)
print(evidence_path)
PY
