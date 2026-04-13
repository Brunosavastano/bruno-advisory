#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

OUTPUT_REL="${1:-infra/backups/bruno-advisory-t0-local-latest.tar.gz}"
OUTPUT="$ROOT/$OUTPUT_REL"
SHA_FILE="$OUTPUT.sha256"
mkdir -p "$(dirname "$OUTPUT")"

TMP_OUTPUT="$OUTPUT.tmp"
rm -f "$TMP_OUTPUT"

tar \
  --exclude='./.git' \
  --exclude='./node_modules' \
  --exclude='./apps/web/.next' \
  --exclude='./infra/backups' \
  -czf "$TMP_OUTPUT" .

mv "$TMP_OUTPUT" "$OUTPUT"
sha256sum "$OUTPUT" > "$SHA_FILE"

printf 'backup=%s\n' "$OUTPUT_REL"
printf 'sha256=%s\n' "$(cut -d' ' -f1 "$SHA_FILE")"
