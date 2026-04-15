#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

resolve_path() {
  local value="$1"
  case "$value" in
    /*) printf '%s\n' "$value" ;;
    *) printf '%s\n' "$ROOT/$value" ;;
  esac
}

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "restore-production.sh failed: missing required env var $name" >&2
    exit 1
  fi
}

require_env DATABASE_PROVIDER
require_env DATABASE_URL
require_env BACKUP_ARCHIVE

provider="$(printf '%s' "$DATABASE_PROVIDER" | tr '[:upper:]' '[:lower:]')"
database_path="$(resolve_path "$DATABASE_URL")"
archive_path="$(resolve_path "$BACKUP_ARCHIVE")"

if [ ! -f "$archive_path" ]; then
  echo "restore-production.sh failed: backup archive not found at $archive_path" >&2
  exit 1
fi

case "$provider" in
  sqlite)
    expected_db="$ROOT/data/dev/bruno-advisory-dev.sqlite3"
    if [ "$database_path" != "$expected_db" ]; then
      echo "restore-production.sh failed: SQLite verification is repo-local only. Set DATABASE_URL to $expected_db" >&2
      exit 1
    fi

    rm -rf "$ROOT/data/dev"
    mkdir -p "$ROOT/data/dev"
    tar -xzf "$archive_path" -C "$ROOT" data/dev

    if [ ! -f "$database_path" ]; then
      echo "restore-production.sh failed: restored SQLite database missing at $database_path" >&2
      exit 1
    fi

    uploads_path="$ROOT/data/dev/uploads"
    uploads_restored=false
    uploads_file_count=0
    if [ -d "$uploads_path" ]; then
      uploads_restored=true
      uploads_file_count="$(find "$uploads_path" -type f | wc -l | tr -d ' ')"
    fi

    python3 - "$archive_path" "$database_path" "$uploads_restored" "$uploads_file_count" <<'PY'
import json, sys
archive_path, database_path, uploads_restored, uploads_file_count = sys.argv[1:5]
print(json.dumps({
    "ok": True,
    "provider": "sqlite",
    "archivePath": archive_path,
    "restoredDatabasePath": database_path,
    "uploadsRestored": uploads_restored == "true",
    "uploadsFileCount": int(uploads_file_count),
    "note": "PostgreSQL restore is not implemented in this cycle. Use pg_restore for the PG equivalent."
}, indent=2))
PY
    ;;
  postgresql|postgres|pg)
    echo "restore-production.sh: PostgreSQL restore is out of scope in this environment. Use pg_restore against a pg_dump archive." >&2
    exit 1
    ;;
  *)
    echo "restore-production.sh failed: unsupported DATABASE_PROVIDER '$DATABASE_PROVIDER'. Use sqlite or postgresql." >&2
    exit 1
    ;;
esac
