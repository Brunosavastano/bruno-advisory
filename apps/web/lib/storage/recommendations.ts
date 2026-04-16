import { randomUUID } from 'node:crypto';
import {
  recommendationCategories,
  recommendationVisibilities,
  type RecommendationCategory,
  type RecommendationRecord,
  type RecommendationVisibility
} from '@savastano-advisory/core';
import { writeAuditLog } from './audit-log';
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
    category: normalizeCategory(row.category === null ? null : String(row.category)),
    visibility,
    createdAt: String(row.createdAt),
    publishedAt: row.publishedAt === null ? null : String(row.publishedAt),
    createdBy: String(row.createdBy)
  };
}

function hasLegacyRecommendationDateColumn() {
  const db = getDatabase();
  const rows = db.prepare(`PRAGMA table_info(${leadRecommendationsTable})`).all() as Array<{ name?: unknown }>;
  return rows.some((row) => row.name === 'recommendation_date');
}

export function createRecommendation(
  leadId: string,
  title: string,
  body: string,
  category: RecommendationCategory | null | undefined,
  createdBy: string
): RecommendationRecord | null {
  if (!getLeadExists(leadId)) {
    return null;
  }

  const normalizedTitle = title.trim();
  const normalizedBody = body.trim();
  const normalizedCreatedBy = createdBy.trim();
  const normalizedCategory = normalizeCategory(category ?? null);

  if (!normalizedTitle || !normalizedBody || !normalizedCreatedBy) {
    return null;
  }

  const recommendationId = randomUUID();
  const createdAt = new Date().toISOString();
  const recommendationDate = createdAt.slice(0, 10);
  const db = getDatabase();

  if (hasLegacyRecommendationDateColumn()) {
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
    `).run(
      recommendationId,
      leadId,
      normalizedTitle,
      normalizedBody,
      recommendationDate,
      normalizedCategory,
      createdAt,
      normalizedCreatedBy
    );
  } else {
    db.prepare(`
      INSERT INTO ${leadRecommendationsTable} (
        recommendation_id,
        lead_id,
        title,
        body,
        category,
        visibility,
        created_at,
        published_at,
        created_by
      ) VALUES (?, ?, ?, ?, ?, 'draft', ?, NULL, ?)
    `).run(recommendationId, leadId, normalizedTitle, normalizedBody, normalizedCategory, createdAt, normalizedCreatedBy);
  }

  return {
    recommendationId,
    leadId,
    title: normalizedTitle,
    body: normalizedBody,
    category: normalizedCategory,
    visibility: 'draft',
    createdAt,
    publishedAt: null,
    createdBy: normalizedCreatedBy
  };
}

function getRecommendation(recommendationId: string, leadId: string): RecommendationRecord | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT
      recommendation_id AS recommendationId,
      lead_id AS leadId,
      title,
      body,
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

export function publishRecommendation(recommendationId: string, leadId: string, actorId: string | null = null): RecommendationRecord | null {
  const current = getRecommendation(recommendationId, leadId);
  if (!current) {
    return null;
  }

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
      category,
      visibility,
      created_at AS createdAt,
      published_at AS publishedAt,
      created_by AS createdBy
    FROM ${leadRecommendationsTable}
    WHERE recommendation_id = ? AND lead_id = ?
    LIMIT 1
  `).get(recommendationId, leadId) as Record<string, unknown> | undefined;

  const recommendation = row ? normalizeRecommendationRow(row) : null;
  if (recommendation) {
    writeAuditLog({
      action: 'recommendation_published',
      entityType: 'recommendation',
      entityId: recommendation.recommendationId,
      leadId: recommendation.leadId,
      actorType: 'operator',
      actorId,
      detail: {
        title: recommendation.title,
        category: recommendation.category,
        visibility: recommendation.visibility
      }
    });
  }

  return recommendation;
}

export function deleteRecommendation(recommendationId: string, leadId: string, actorId: string | null = null) {
  const current = getRecommendation(recommendationId, leadId);
  if (!current) {
    return false;
  }

  const db = getDatabase();
  const result = db.prepare(`DELETE FROM ${leadRecommendationsTable} WHERE recommendation_id = ? AND lead_id = ?`).run(recommendationId, leadId);

  if (result.changes > 0) {
    writeAuditLog({
      action: 'recommendation_deleted',
      entityType: 'recommendation',
      entityId: current.recommendationId,
      leadId: current.leadId,
      actorType: 'operator',
      actorId,
      detail: {
        title: current.title,
        category: current.category,
        visibility: current.visibility
      }
    });
    return true;
  }

  return false;
}
