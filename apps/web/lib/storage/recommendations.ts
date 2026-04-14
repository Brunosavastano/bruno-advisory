import { randomUUID } from 'node:crypto';
import {
  recommendationCategories,
  recommendationVisibilities,
  type RecommendationCategory,
  type RecommendationRecord,
  type RecommendationVisibility
} from '@bruno-advisory/core';
import { getDatabase, leadRecommendationsTable, leadsTable } from './db';

function getLeadExists(leadId: string) {
  const db = getDatabase();
  const row = db.prepare(`SELECT lead_id AS leadId FROM ${leadsTable} WHERE lead_id = ? LIMIT 1`).get(leadId);
  return Boolean(row);
}

function normalizeCategory(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return recommendationCategories.includes(value as RecommendationCategory)
    ? (value as RecommendationCategory)
    : null;
}

function normalizeRecommendationRow(row: Record<string, unknown>): RecommendationRecord {
  const visibility = String(row.visibility) as RecommendationVisibility;
  if (!recommendationVisibilities.includes(visibility)) {
    throw new Error(`Invalid recommendation visibility: ${String(row.visibility)}`);
  }

  return {
    recommendationId: String(row.recommendationId),
    leadId: String(row.leadId),
    title: String(row.title),
    body: String(row.body),
    recommendationDate: String(row.recommendationDate),
    category: normalizeCategory(row.category === null ? null : String(row.category)),
    visibility,
    createdAt: String(row.createdAt),
    publishedAt: row.publishedAt === null ? null : String(row.publishedAt),
    createdBy: String(row.createdBy)
  };
}

export function createRecommendation(
  leadId: string,
  title: string,
  body: string,
  recommendationDate: string,
  category: RecommendationCategory | null | undefined,
  createdBy: string
): RecommendationRecord | null {
  if (!getLeadExists(leadId)) {
    return null;
  }

  const normalizedTitle = title.trim();
  const normalizedBody = body.trim();
  const normalizedDate = recommendationDate.trim();
  const normalizedCreatedBy = createdBy.trim();
  const normalizedCategory = normalizeCategory(category ?? null);

  if (!normalizedTitle || !normalizedBody || !normalizedCreatedBy || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    return null;
  }

  const recommendationId = randomUUID();
  const createdAt = new Date().toISOString();
  const db = getDatabase();

  db.prepare(`
    INSERT INTO ${leadRecommendationsTable} (
      recommendation_id,
      lead_id,
      title,
      body,
      recommendation_date,
      category,
      visibility,
      created_at,
      published_at,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, NULL, ?)
  `).run(recommendationId, leadId, normalizedTitle, normalizedBody, normalizedDate, normalizedCategory, createdAt, normalizedCreatedBy);

  return {
    recommendationId,
    leadId,
    title: normalizedTitle,
    body: normalizedBody,
    recommendationDate: normalizedDate,
    category: normalizedCategory,
    visibility: 'draft',
    createdAt,
    publishedAt: null,
    createdBy: normalizedCreatedBy
  };
}

export function listRecommendations(
  leadId: string,
  visibilityFilter: 'all' | 'published' = 'all'
): RecommendationRecord[] {
  const db = getDatabase();
  const rows = (
    visibilityFilter === 'published'
      ? db.prepare(`
          SELECT
            recommendation_id AS recommendationId,
            lead_id AS leadId,
            title,
            body,
            recommendation_date AS recommendationDate,
            category,
            visibility,
            created_at AS createdAt,
            published_at AS publishedAt,
            created_by AS createdBy
          FROM ${leadRecommendationsTable}
          WHERE lead_id = ? AND visibility = 'published'
          ORDER BY COALESCE(published_at, created_at) DESC, recommendation_id DESC
        `).all(leadId)
      : db.prepare(`
          SELECT
            recommendation_id AS recommendationId,
            lead_id AS leadId,
            title,
            body,
            recommendation_date AS recommendationDate,
            category,
            visibility,
            created_at AS createdAt,
            published_at AS publishedAt,
            created_by AS createdBy
          FROM ${leadRecommendationsTable}
          WHERE lead_id = ?
          ORDER BY created_at DESC, recommendation_id DESC
        `).all(leadId)
  ) as Record<string, unknown>[];

  return rows.map(normalizeRecommendationRow);
}

export function publishRecommendation(recommendationId: string, leadId: string): RecommendationRecord | null {
  const db = getDatabase();
  const publishedAt = new Date().toISOString();
  const result = db.prepare(`
    UPDATE ${leadRecommendationsTable}
    SET visibility = 'published', published_at = COALESCE(published_at, ?)
    WHERE recommendation_id = ? AND lead_id = ?
  `).run(publishedAt, recommendationId, leadId);

  if (result.changes === 0) {
    return null;
  }

  const row = db.prepare(`
    SELECT
      recommendation_id AS recommendationId,
      lead_id AS leadId,
      title,
      body,
      recommendation_date AS recommendationDate,
      category,
      visibility,
      created_at AS createdAt,
      published_at AS publishedAt,
      created_by AS createdBy
    FROM ${leadRecommendationsTable}
    WHERE recommendation_id = ? AND lead_id = ?
    LIMIT 1
  `).get(recommendationId, leadId) as Record<string, unknown> | undefined;

  return row ? normalizeRecommendationRow(row) : null;
}

export function deleteRecommendation(recommendationId: string, leadId: string) {
  const db = getDatabase();
  const result = db.prepare(`DELETE FROM ${leadRecommendationsTable} WHERE recommendation_id = ? AND lead_id = ?`).run(recommendationId, leadId);
  return result.changes > 0;
}
