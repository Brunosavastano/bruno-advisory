#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "[verify] checking canonical tranche alignment"

grep -n "## T3.5" ROADMAP.md
grep -n "T3.5 foi aberta como tranche intermediária de hardening" state/decision-log.md
grep -n "active_tranche: T3.5" project.yaml
grep -n "tranche_status: open" project.yaml
grep -n "stage_gate: hardening" project.yaml
grep -n "## Authorization" state/t35-opening.md
grep -n "## Status" state/zeus-mandate.md

echo "[verify] canonical T3.5 governance is coherent"
