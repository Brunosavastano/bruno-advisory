import fs from 'node:fs';
import path from 'node:path';

export type ProjectState = {
  projectName: string;
  activeTranche: string;
  trancheStatus: string;
  stageGate: string;
  topRisks: string[];
  latestDecision: string;
  sourceFiles: string[];
};

const repoRoot = path.resolve(process.cwd(), '../..');
const projectYamlPath = path.join(repoRoot, 'project.yaml');
const riskLogPath = path.join(repoRoot, 'state', 'risk-log.md');
const decisionLogPath = path.join(repoRoot, 'state', 'decision-log.md');

function readProjectYaml() {
  return fs.readFileSync(projectYamlPath, 'utf8');
}

function readRiskLog() {
  return fs.readFileSync(riskLogPath, 'utf8');
}

function readDecisionLog() {
  return fs.readFileSync(decisionLogPath, 'utf8');
}

function matchValue(source: string, key: string) {
  const regex = new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm');
  const match = source.match(regex);
  return match?.[1]?.trim() ?? 'unknown';
}

function getSection(markdown: string, heading: string) {
  const marker = `## ${heading}`;
  const start = markdown.indexOf(marker);

  if (start === -1) {
    return '';
  }

  const afterMarker = markdown.slice(start + marker.length);
  const nextHeadingIndex = afterMarker.indexOf('\n## ');
  return nextHeadingIndex === -1 ? afterMarker : afterMarker.slice(0, nextHeadingIndex);
}

function parseTopRisks(markdown: string, limit = 5) {
  return getSection(markdown, 'Riscos iniciais')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).split(' — ')[0].trim())
    .filter(Boolean)
    .slice(0, limit);
}

function parseLatestDecision(markdown: string) {
  const decisions = getSection(markdown, 'Entradas')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '));

  return decisions.at(-1)?.slice(2).trim() ?? 'Nenhuma decisão registrada';
}

export function getProjectState(): ProjectState {
  const projectYaml = readProjectYaml();
  const riskLog = readRiskLog();
  const decisionLog = readDecisionLog();

  return {
    projectName: matchValue(projectYaml, 'name'),
    activeTranche: matchValue(projectYaml, 'active_tranche'),
    trancheStatus: matchValue(projectYaml, 'tranche_status'),
    stageGate: matchValue(projectYaml, 'stage_gate'),
    topRisks: parseTopRisks(riskLog),
    latestDecision: parseLatestDecision(decisionLog),
    sourceFiles: ['project.yaml', 'state/risk-log.md', 'state/decision-log.md', 'PROJECT.md', 'CONTROL_ROOM_SPEC.md']
  };
}

export function getHealthState() {
  const projectState = getProjectState();
  return {
    ok: true,
    app: 'web',
    project: projectState.projectName,
    tranche: projectState.activeTranche,
    status: projectState.trancheStatus,
    checkedAt: new Date().toISOString()
  };
}
