import { randomUUID } from 'node:crypto';
import { intakeAnalyticsEvents } from '@savastano-advisory/core/intake-contract';
import { eventsTable, getDatabase, parseMetadata, serializeMetadata } from './db';
import type { IntakeAnalyticsEvent } from '@savastano-advisory/core/intake-contract';
import type { IntakeEventRecord } from './types';

export function recordIntakeEvent(record: IntakeEventRecord) {
  if (!intakeAnalyticsEvents.includes(record.eventName)) {
    throw new Error(`Evento de analytics fora do contrato: ${record.eventName}`);
  }

  const db = getDatabase();
  const relatedLeadId =
    record.relatedLeadId ??
    (typeof record.metadata?.leadId === 'string' ? record.metadata.leadId : null);

  db.prepare(`
    INSERT INTO ${eventsTable} (event_id, event_name, occurred_at, metadata_json, related_lead_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    record.eventId ?? randomUUID(),
    record.eventName,
    record.occurredAt,
    serializeMetadata(record.metadata),
    relatedLeadId
  );
}

export function listStoredIntakeEvents(limit = 50) {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT event_id AS eventId, event_name AS eventName, occurred_at AS occurredAt,
      metadata_json AS metadataJson, related_lead_id AS relatedLeadId
    FROM ${eventsTable}
    ORDER BY occurred_at DESC, event_id DESC
    LIMIT ?
  `).all(limit) as Record<string, unknown>[];

  return rows.map((row) => ({
    eventId: String(row.eventId),
    eventName: row.eventName as IntakeAnalyticsEvent,
    occurredAt: String(row.occurredAt),
    metadata: parseMetadata(row.metadataJson),
    relatedLeadId: row.relatedLeadId === null ? null : String(row.relatedLeadId)
  }));
}
