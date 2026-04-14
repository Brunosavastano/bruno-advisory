#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T3.5-cycle-4}"
mkdir -p "$EVIDENCE_DIR"

TEST_LOG="$EVIDENCE_DIR/test-output.log"
PACKAGE_JSON="$ROOT/package.json"
TEST_FILE="$ROOT/apps/web/lib/storage/__tests__/billing.test.ts"

if ! grep -q '"test"' "$PACKAGE_JSON"; then
  echo "root test script missing from package.json" >&2
  exit 1
fi

if ! grep -q 'node --experimental-strip-types --test' "$PACKAGE_JSON"; then
  echo "root test script is not using strict node:test runner" >&2
  exit 1
fi

npm test | tee "$TEST_LOG"

node - "$ROOT" "$EVIDENCE_DIR" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2];
const evidenceDir = path.resolve(root, process.argv[3]);
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const testSource = fs.readFileSync(path.join(root, 'apps', 'web', 'lib', 'storage', '__tests__', 'billing.test.ts'), 'utf8');
const log = fs.readFileSync(path.join(evidenceDir, 'test-output.log'), 'utf8');

const expectedChecks = [
  'Billing readiness blocks when commercialStage is not cliente_convertido',
  'Billing readiness blocks when tasks exist and none are done',
  'Billing readiness passes when stage is cliente_convertido and all tasks are done',
  'Billing activation blocks when readiness check fails',
  'Billing activation succeeds when ready and creates active_local billingRecord',
  'Charge creation blocks when there is no active billing record',
  'Charge creation succeeds after activation and creates pending_local charge',
  'Targeted settlement blocks missing charge with 404',
  'Targeted settlement blocks foreign charge with 422',
  'Targeted settlement blocks already settled charge with 409',
  'Targeted settlement succeeds for pending charge with 201 and settled_local status',
  'Charge progression blocks when latest charge is still pending',
  'Charge progression succeeds after settlement with chargeSequence + 1'
];

for (const name of expectedChecks) {
  if (!testSource.includes(name)) {
    throw new Error(`Missing canonical test case: ${name}`);
  }
}

if (!log.includes('# pass 13') || !log.includes('# fail 0')) {
  throw new Error('node:test run did not report 13 passes and 0 failures');
}

const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  tranche: 'T3.5',
  cycle: 4,
  objective: 'Critical local billing coverage via node:test only.',
  testScript: packageJson.scripts.test,
  suiteFile: 'apps/web/lib/storage/__tests__/billing.test.ts',
  expectedChecks,
  logAssertions: {
    pass13: log.includes('# pass 13'),
    fail0: log.includes('# fail 0')
  },
  note: 'The suite builds @bruno-advisory/web, then executes node:test against compiled route handlers with an isolated temporary repo root to avoid touching workspace data.'
};

fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
NODE
