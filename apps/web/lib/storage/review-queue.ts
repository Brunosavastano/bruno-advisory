import {
  aiArtifactsTable,
  getDatabase,
  leadsTable,
  memosTable,
  researchWorkflowsTable,
  suitabilityAssessmentsTable
} from './db';
import type { ReviewQueueItem } from './types';

export function listReviewQueueItems(): ReviewQueueItem[] {
  const db = getDatabase();
  const memoRows = db.prepare(`
    SELECT
      'memo' AS type,
      m.id AS id,
      m.lead_id AS leadId,
      l.full_name AS leadName,
      m.title AS title,
      m.status AS status,
      m.created_at AS createdAt,
      m.updated_at AS updatedAt
    FROM ${memosTable} m
    INNER JOIN ${leadsTable} l ON l.lead_id = m.lead_id
    WHERE m.status = 'pending_review'
  `).all() as Record<string, unknown>[];

  const workflowRows = db.prepare(`
    SELECT
      'research_workflow' AS type,
      w.id AS id,
      w.lead_id AS leadId,
      l.full_name AS leadName,
      w.title AS title,
      w.status AS status,
      w.created_at AS createdAt,
      w.updated_at AS updatedAt
    FROM ${researchWorkflowsTable} w
    INNER JOIN ${leadsTable} l ON l.lead_id = w.lead_id
    WHERE w.status = 'review'
  `).all() as Record<string, unknown>[];

  const aiArtifactRows = db.prepare(`
    SELECT
      'ai_artifact' AS type,
      a.artifact_type AS subtype,
      a.artifact_id AS id,
      a.lead_id AS leadId,
      l.full_name AS leadName,
      a.title AS title,
      a.status AS status,
      a.created_at AS createdAt,
      a.created_at AS updatedAt
    FROM ${aiArtifactsTable} a
    INNER JOIN ${leadsTable} l ON l.lead_id = a.lead_id
    WHERE a.status = 'pending_review'
  `).all() as Record<string, unknown>[];

  // AI-3 Cycle 2: assessments em submitted ou review_required entram na fila.
  const suitabilityRows = db.prepare(`
    SELECT
      'suitability_assessment' AS type,
      s.status AS subtype,
      s.assessment_id AS id,
      s.lead_id AS leadId,
      l.full_name AS leadName,
      ('Suitability ' || s.questionnaire_version) AS title,
      s.status AS status,
      s.created_at AS createdAt,
      s.updated_at AS updatedAt
    FROM ${suitabilityAssessmentsTable} s
    INNER JOIN ${leadsTable} l ON l.lead_id = s.lead_id
    WHERE s.status IN ('submitted', 'review_required', 'needs_clarification')
  `).all() as Record<string, unknown>[];

  return [...memoRows, ...workflowRows, ...aiArtifactRows, ...suitabilityRows]
    .map((row): ReviewQueueItem => {
      const rawType = String(row.type);
      const type: ReviewQueueItem['type'] =
        rawType === 'memo'
          ? 'memo'
          : rawType === 'ai_artifact'
          ? 'ai_artifact'
          : rawType === 'suitability_assessment'
          ? 'suitability_assessment'
          : 'research_workflow';
      const item: ReviewQueueItem = {
        type,
        id: String(row.id),
        leadId: String(row.leadId),
        leadName: String(row.leadName),
        title: String(row.title),
        status: String(row.status),
        createdAt: String(row.createdAt),
        updatedAt: String(row.updatedAt)
      };
      if ((type === 'ai_artifact' || type === 'suitability_assessment') && row.subtype) {
        item.subtype = String(row.subtype);
      }
      return item;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
}
