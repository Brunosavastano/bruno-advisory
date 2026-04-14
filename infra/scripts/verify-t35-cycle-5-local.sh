#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T3.5-cycle-5}"
mkdir -p "$EVIDENCE_DIR"

npm run build >/dev/null

node - "$ROOT" "$EVIDENCE_DIR" <<'NODE'
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { createRequire } = require('node:module');

async function main() {
  const root = process.argv[2];
  const evidenceDir = path.resolve(root, process.argv[3]);
  const webDir = path.join(root, 'apps', 'web');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-t35-cycle5-'));
  const requireFromWeb = createRequire(path.join(webDir, 'package.json'));

  fs.writeFileSync(path.join(tempRoot, 'project.yaml'), 'project: test\n');
  fs.symlinkSync(path.join(root, 'apps'), path.join(tempRoot, 'apps'), 'dir');
  fs.symlinkSync(path.join(root, 'packages'), path.join(tempRoot, 'packages'), 'dir');
  process.chdir(tempRoot);
  process.on('exit', () => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  const intakeRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'intake', 'route.js')).routeModule.userland;
  const crmFieldsRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'crm-fields', 'route.js')).routeModule.userland;

  const intakeResponse = await intakeRoute.POST(
    new Request('http://localhost/api/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: 'T3.5 Cycle 5 CRM Local',
        email: `t35-cycle5-${randomUUID()}@example.com`,
        phone: '11999990000',
        city: 'Brasilia',
        state: 'DF',
        investableAssetsBand: '3m_a_10m',
        primaryChallenge: 'Estruturar CRM completo para onboarding',
        sourceLabel: 'verify_t35_cycle_5_local',
        privacyConsentAccepted: true,
        termsConsentAccepted: true
      })
    })
  );
  const intakeBody = await intakeResponse.json();
  if (intakeResponse.status !== 201 || !intakeBody.leadId) {
    throw new Error(`Intake route failed: ${intakeResponse.status}`);
  }

  const leadId = intakeBody.leadId;
  const crmPayload = {
    cidade_estado: 'Brasilia, DF',
    ocupacao_perfil: 'Servidor publico com perfil investidor',
    nivel_de_fit: 'alto',
    motivo_sem_fit: null,
    owner: 'operator_local',
    data_call_qualificacao: '2026-04-14',
    resumo_call: 'Lead pronto para onboarding e alinhado com a proposta.',
    interesse_na_oferta: 'alto',
    checklist_onboarding: JSON.stringify(['documentos_ok', 'perfil_ok', 'cadastro_pendente']),
    cadencia_acordada: 'Semanal',
    proximo_passo: 'Enviar contrato e iniciar onboarding',
    risco_de_churn: 'baixo'
  };

  const patchResponse = await crmFieldsRoute.PATCH(
    new Request(`http://localhost/api/cockpit/leads/${leadId}/crm-fields`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(crmPayload)
    }),
    { params: Promise.resolve({ leadId }) }
  );
  const patchBody = await patchResponse.json();
  if (patchResponse.status !== 200 || !patchBody.ok) {
    throw new Error(`CRM patch failed: ${patchResponse.status}`);
  }

  const dbPath = path.join(tempRoot, 'data', 'dev', 'bruno-advisory-dev.sqlite3');
  const db = new DatabaseSync(dbPath);
  const persistedLead = db.prepare(`
    SELECT
      lead_id AS leadId,
      cidade_estado AS cidadeEstado,
      ocupacao_perfil AS ocupacaoPerfil,
      nivel_de_fit AS nivelDeFit,
      motivo_sem_fit AS motivoSemFit,
      owner,
      data_call_qualificacao AS dataCallQualificacao,
      resumo_call AS resumoCall,
      interesse_na_oferta AS interesseNaOferta,
      checklist_onboarding AS checklistOnboarding,
      cadencia_acordada AS cadenciaAcordada,
      proximo_passo AS proximoPasso,
      risco_de_churn AS riscoDeChurn
    FROM intake_leads
    WHERE lead_id = ?
    LIMIT 1
  `).get(leadId);
  if (!persistedLead) {
    throw new Error('Persisted lead not found after patch');
  }

  const assertions = {
    cidadeEstado: persistedLead.cidadeEstado === crmPayload.cidade_estado,
    ocupacaoPerfil: persistedLead.ocupacaoPerfil === crmPayload.ocupacao_perfil,
    nivelDeFit: persistedLead.nivelDeFit === crmPayload.nivel_de_fit,
    motivoSemFit: persistedLead.motivoSemFit === null,
    owner: persistedLead.owner === crmPayload.owner,
    dataCallQualificacao: persistedLead.dataCallQualificacao === crmPayload.data_call_qualificacao,
    resumoCall: persistedLead.resumoCall === crmPayload.resumo_call,
    interesseNaOferta: persistedLead.interesseNaOferta === crmPayload.interesse_na_oferta,
    checklistOnboarding: persistedLead.checklistOnboarding === crmPayload.checklist_onboarding,
    cadenciaAcordada: persistedLead.cadenciaAcordada === crmPayload.cadencia_acordada,
    proximoPasso: persistedLead.proximoPasso === crmPayload.proximo_passo,
    riscoDeChurn: persistedLead.riscoDeChurn === crmPayload.risco_de_churn
  };

  const failedAssertions = Object.entries(assertions).filter(([, ok]) => !ok);
  if (failedAssertions.length > 0) {
    throw new Error(`Persisted CRM fields mismatch: ${failedAssertions.map(([key]) => key).join(', ')}`);
  }

  const detailSource = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'leads', '[leadId]', 'page.tsx'), 'utf8');
  const surfaceCheck = {
    crmRouteCompiled: fs.existsSync(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'crm-fields', 'route.js')),
    leadDetailShowsCrmSection: detailSource.includes('CRM T3.5 cycle 5') && detailSource.includes('Cidade/estado:') && detailSource.includes('Risco de churn:')
  };

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    leadId,
    intakeRouteStatus: intakeResponse.status,
    crmPatchRouteStatus: patchResponse.status,
    crmPayload,
    patchResponse: patchBody,
    persistedLead,
    assertions,
    surfaceCheck,
    dbPath,
    note: 'HTTP bind is blocked in this sandbox (listen EPERM); verification executed by invoking compiled route handlers directly.'
  };

  fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
NODE
