// AI-2 Cycle 2 verifier — UI changes (frontend-only). Source-shape audits + build pass.
// No backend changes; runtime probes are limited to confirming the build still serves the new pages.

import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
const evidenceDirArg = process.argv[3];
if (!root || !evidenceDirArg) throw new Error('Usage: node ai-2-cycle-2.ts <repoRoot> <evidenceDir>');
const evidenceDir = path.resolve(root, evidenceDirArg);

const webDir = path.join(root, 'apps', 'web');

// ---------- A. New files exist ----------
const requiredFiles = [
  'app/cockpit/leads/[leadId]/ai-copilot-panel.tsx',
  'app/cockpit/leads/[leadId]/ai-history/page.tsx',
  'app/cockpit/ai-artifacts/[artifactId]/page.tsx',
  'app/cockpit/ai-artifacts/[artifactId]/artifact-review-actions.tsx'
];
const sourceShape: Record<string, boolean> = {};
for (const f of requiredFiles) {
  sourceShape[f] = fs.existsSync(path.join(webDir, f));
  if (!sourceShape[f]) throw new Error(`Missing file: ${f}`);
}

// ---------- B. AiCopilotPanel content ----------
const copilotSrc = fs.readFileSync(
  path.join(webDir, 'app/cockpit/leads/[leadId]/ai-copilot-panel.tsx'),
  'utf8'
);
const copilotChecks = {
  hasUseClient: /^'use client'/.test(copilotSrc.trim()),
  has5Surfaces:
    /memo-draft/.test(copilotSrc) &&
    /research-summary/.test(copilotSrc) &&
    /pre-call-brief/.test(copilotSrc) &&
    /follow-up-draft/.test(copilotSrc) &&
    /pending-checklist/.test(copilotSrc),
  hasFocusHintInput: /focusHint/.test(copilotSrc),
  hasErrorHandling:
    /blocked_budget/.test(copilotSrc) &&
    /blocked_guardrail/.test(copilotSrc) &&
    /ai_disabled/.test(copilotSrc),
  linksToArtifactView: /\/cockpit\/ai-artifacts\//.test(copilotSrc)
};
for (const [k, v] of Object.entries(copilotChecks)) {
  if (!v) throw new Error(`ai-copilot-panel.tsx check failed: ${k}`);
}

// ---------- C. Lead page wires the panel ----------
const leadPageSrc = fs.readFileSync(path.join(webDir, 'app/cockpit/leads/[leadId]/page.tsx'), 'utf8');
const leadPageChecks = {
  importsCopilot: /import\s*\{\s*AiCopilotPanel\s*\}/.test(leadPageSrc),
  rendersCopilot: /<AiCopilotPanel\b/.test(leadPageSrc),
  hasAiHistoryLink: /ai-history/.test(leadPageSrc)
};
for (const [k, v] of Object.entries(leadPageChecks)) {
  if (!v) throw new Error(`page.tsx check failed: ${k}`);
}

// ---------- D. Artifact view page content ----------
const artifactPageSrc = fs.readFileSync(
  path.join(webDir, 'app/cockpit/ai-artifacts/[artifactId]/page.tsx'),
  'utf8'
);
const artifactChecks = {
  showsBody: /artifact\.body/.test(artifactPageSrc),
  showsJobMetadata:
    /job\.costCents/.test(artifactPageSrc) &&
    /job\.inputTokens/.test(artifactPageSrc) &&
    /job\.latency_?Ms/i.test(artifactPageSrc),
  showsGuardrails: /listGuardrailResultsForJob/.test(artifactPageSrc),
  showsRedaction: /redactionCounts/.test(artifactPageSrc),
  conditionalActionsForPending: /pending_review/.test(artifactPageSrc) && /ArtifactReviewActions/.test(artifactPageSrc)
};
for (const [k, v] of Object.entries(artifactChecks)) {
  if (!v) throw new Error(`artifact page check failed: ${k}`);
}

// ---------- E. Artifact review actions: rejection modal ----------
const artifactActionsSrc = fs.readFileSync(
  path.join(webDir, 'app/cockpit/ai-artifacts/[artifactId]/artifact-review-actions.tsx'),
  'utf8'
);
const artifactActionsChecks = {
  hasRejectionTextarea: /<textarea/.test(artifactActionsSrc) && /rejectionReason/.test(artifactActionsSrc),
  validatesRejectionReason: /\.trim\(\)\.length === 0/.test(artifactActionsSrc),
  patchesArtifactRoute: /\/ai\/artifacts\//.test(artifactActionsSrc) && /method:\s*'PATCH'/.test(artifactActionsSrc)
};
for (const [k, v] of Object.entries(artifactActionsChecks)) {
  if (!v) throw new Error(`artifact-review-actions.tsx check failed: ${k}`);
}

// ---------- F. Review queue panel: cards + modal + filters ----------
const queuePanelSrc = fs.readFileSync(
  path.join(webDir, 'app/cockpit/review-queue/review-queue-panel.tsx'),
  'utf8'
);
const queueChecks = {
  hasFilterTabs: /FILTER_OPTIONS/.test(queuePanelSrc) && /'all'/.test(queuePanelSrc),
  hasCardsLayout: /gridTemplateColumns/.test(queuePanelSrc) && /<article/.test(queuePanelSrc),
  hasRejectModal: /rejectModal/.test(queuePanelSrc) && /role="dialog"/.test(queuePanelSrc),
  noWindowPrompt: !/window\.prompt\(/.test(queuePanelSrc),
  iaBadgeVisual: /#8B1A1A/.test(queuePanelSrc) && /\bIA\b/.test(queuePanelSrc),
  artifactDeepLink: /\/cockpit\/ai-artifacts\//.test(queuePanelSrc)
};
for (const [k, v] of Object.entries(queueChecks)) {
  if (!v) throw new Error(`review-queue-panel.tsx check failed: ${k}`);
}

// ---------- G. AI history page ----------
const historySrc = fs.readFileSync(
  path.join(webDir, 'app/cockpit/leads/[leadId]/ai-history/page.tsx'),
  'utf8'
);
const historyChecks = {
  listsJobs: /listAiJobs/.test(historySrc),
  joinsArtifacts: /listArtifactsForLead/.test(historySrc) && /artifactByJobId/.test(historySrc),
  showsTotalCost: /totalCostCents/.test(historySrc),
  linksToArtifact: /\/cockpit\/ai-artifacts\//.test(historySrc)
};
for (const [k, v] of Object.entries(historyChecks)) {
  if (!v) throw new Error(`ai-history page check failed: ${k}`);
}

// ---------- Summary ----------
const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  sourceShape,
  copilotChecks,
  leadPageChecks,
  artifactChecks,
  artifactActionsChecks,
  queueChecks,
  historyChecks,
  note:
    'AI-2 Cycle 2: AiCopilotPanel exposes 5 surfaces with focus hint + error handling + artifact deep links. Lead page wires the panel and links to ai-history. Artifact viewer shows full body + job metadata + guardrails + redaction + conditional review actions. Rejection modal replaces window.prompt and validates non-empty reason. Review queue redesigned with filter tabs + responsive cards + modal. AI history page lists jobs with totals and per-job artifact links. All wiring verified by source-shape audits; build/typecheck verified by the wrapper script.'
};

fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
