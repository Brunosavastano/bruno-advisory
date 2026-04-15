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
    echo "backup-production.sh failed: missing required env var $name" >&2
    exit 1
  fi
}

require_env DATABASE_PROVIDER
require_env DATABASE_URL
require_env BACKUP_ARCHIVE

provider="$(printf '%s' "$DATABASE_PROVIDER" | tr '[:upper:]' '[:lower:]')"
database_path="$(resolve_path "$DATABASE_URL")"
archive_path="$(resolve_path "$BACKUP_ARCHIVE")"

case "$provider" in
  sqlite)
    expected_db="$ROOT/data/dev/bruno-advisory-dev.sqlite3"
    if [ "$database_path" != "$expected_db" ]; then
      echo "backup-production.sh failed: SQLite verification is repo-local only. Set DATABASE_URL to $expected_db" >&2
      exit 1
    fi

    if [ ! -f "$database_path" ]; then
      echo "backup-production.sh failed: SQLite database not found at $database_path" >&2
      exit 1
    fi

    mkdir -p "$(dirname "$archive_path")"

    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT

    payload_dir="$tmpdir/payload"
    mkdir -p "$payload_dir/data/dev"

    cp "$database_path" "$payload_dir/data/dev/$(basename "$database_path")"

    uploads_source="$ROOT/data/dev/uploads"
    uploads_included=false
    uploads_file_count=0
    if [ -d "$uploads_source" ]; then
      cp -a "$uploads_source" "$payload_dir/data/dev/uploads"
      uploads_included=true
      uploads_file_count="$(find "$uploads_source" -type f | wc -l | tr -d ' ')"
    fi

    cat > "$payload_dir/backup-metadata.json" <<JSON
{
  "ok": true,
  "provider": "sqlite",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "databasePath": "$database_path",
  "archiveTarget": "$archive_path",
  "uploadsIncluded": $uploads_included,
  "uploadsFileCount": $uploads_file_count,
  "note": "SQLite-first backup archive for Bruno Advisory local runtime. PostgreSQL would require pg_dump outside this cycle scope."
}
JSON

    tmp_archive="$archive_path.tmp"
    rm -f "$tmp_archive"
    tar -C "$payload_dir" -czf "$tmp_archive" data/dev backup-metadata.json
    mv "$tmp_archive" "$archive_path"

    archive_size_bytes="$(wc -c < "$archive_path" | tr -d ' ')"
    python3 - "$archive_path" "$archive_size_bytes" "$database_path" "$uploads_included" "$uploads_file_count" <<'PY'
import json, sys
archive_path, archive_size_bytes, database_path, uploads_included, uploads_file_count = sys.argv[1:6]
print(json.dumps({
    "ok": True,
    "provider": "sqlite",
    "archivePath": archive_path,
    "archiveSizeBytes": int(archive_size_bytes),
    "databasePath": database_path,
    "uploadsIncluded": uploads_included == "true",
    "uploadsFileCount": int(uploads_file_count),
    "note": "PostgreSQL backup is not implemented in this cycle. Use pg_dump/pg_restore for the PG equivalent."
}, indent=2))
PY
    ;;
  postgresql|postgres|pg)
    echo "backup-production.sh: PostgreSQL backup is out of scope in this environment. Use pg_dump to create the equivalent production backup." >&2
    exit 1
    ;;
  *)
    echo "backup-production.sh failed: unsupported DATABASE_PROVIDER '$DATABASE_PROVIDER'. Use sqlite or postgresql." >&2
    exit 1
    ;;
esac
