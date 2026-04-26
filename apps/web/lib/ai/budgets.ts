// Budget enforcement for AI calls.
// Pulls applicable caps from ai_budget_caps and current spend from ai_jobs (cost_cents in period).
// Returns whether the projected cost would breach a 'block' cap.
//
// Scope precedence: lead > job_type > surface > global. Multiple caps may apply at once; if ANY
// active 'block' cap would be breached, the call is blocked. 'warn' caps don't block but are
// returned in the result so callers can log them.

import type { AiBudgetActionOnExceed, AiBudgetCapRecord, AiBudgetPeriod, AiBudgetScopeType } from '@savastano-advisory/core';
import { aiBudgetCapsTable, aiJobsTable, getDatabase } from '../storage/db';

export type BudgetCheckParams = {
  surface: string;
  jobType: string;
  leadId: string | null;
  estimatedCostCents: number;
};

export type BudgetCapEvaluation = {
  capId: string;
  scopeType: AiBudgetScopeType;
  scopeValue: string;
  period: AiBudgetPeriod;
  capCents: number;
  currentSpendCents: number;
  projectedSpendCents: number;
  actionOnExceed: AiBudgetActionOnExceed;
  wouldExceed: boolean;
};

export type BudgetCheckResult =
  | { ok: true; evaluations: BudgetCapEvaluation[]; warnings: BudgetCapEvaluation[] }
  | { ok: false; blocking: BudgetCapEvaluation; evaluations: BudgetCapEvaluation[]; warnings: BudgetCapEvaluation[] };

function periodStart(period: AiBudgetPeriod): string {
  const now = new Date();
  if (period === 'day') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    return start.toISOString();
  }
  // month
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  return start.toISOString();
}

function getCurrentSpendCents(params: {
  scopeType: AiBudgetScopeType;
  scopeValue: string;
  period: AiBudgetPeriod;
}): number {
  const db = getDatabase();
  const periodStartIso = periodStart(params.period);
  // Match scope by predicate. We sum cost_cents of every ai_job created within the period whose
  // surface/job_type/lead_id matches the cap's scope. Statuses other than 'queued' and 'blocked_*'
  // count — we want to capture even failed jobs because they cost money.
  let sql: string;
  let bindings: unknown[];

  if (params.scopeType === 'global') {
    sql = `SELECT COALESCE(SUM(cost_cents), 0) AS total FROM ${aiJobsTable} WHERE created_at >= ?`;
    bindings = [periodStartIso];
  } else if (params.scopeType === 'surface') {
    sql = `SELECT COALESCE(SUM(cost_cents), 0) AS total FROM ${aiJobsTable} WHERE created_at >= ? AND surface = ?`;
    bindings = [periodStartIso, params.scopeValue];
  } else if (params.scopeType === 'job_type') {
    sql = `SELECT COALESCE(SUM(cost_cents), 0) AS total FROM ${aiJobsTable} WHERE created_at >= ? AND job_type = ?`;
    bindings = [periodStartIso, params.scopeValue];
  } else {
    // lead
    sql = `SELECT COALESCE(SUM(cost_cents), 0) AS total FROM ${aiJobsTable} WHERE created_at >= ? AND lead_id = ?`;
    bindings = [periodStartIso, params.scopeValue];
  }

  const row = db.prepare(sql).all(...(bindings as string[])) as Array<{ total: number }>;
  return Number(row[0]?.total ?? 0);
}

function listApplicableCaps(params: BudgetCheckParams): AiBudgetCapRecord[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT
      cap_id AS capId,
      scope_type AS scopeType,
      scope_value AS scopeValue,
      period,
      cap_cents AS capCents,
      action_on_exceed AS actionOnExceed,
      active,
      created_at AS createdAt,
      updated_at AS updatedAt,
      deactivated_at AS deactivatedAt
    FROM ${aiBudgetCapsTable}
    WHERE active = 1
  `).all() as Array<Record<string, unknown>>;

  return rows
    .map((row) => ({
      capId: String(row.capId),
      scopeType: String(row.scopeType) as AiBudgetScopeType,
      scopeValue: String(row.scopeValue),
      period: String(row.period) as AiBudgetPeriod,
      capCents: Number(row.capCents),
      actionOnExceed: String(row.actionOnExceed) as AiBudgetActionOnExceed,
      active: Number(row.active) === 1,
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
      deactivatedAt: row.deactivatedAt === null ? null : String(row.deactivatedAt)
    }))
    .filter((cap) => {
      if (cap.scopeType === 'global') return true;
      if (cap.scopeType === 'surface') return cap.scopeValue === params.surface;
      if (cap.scopeType === 'job_type') return cap.scopeValue === params.jobType;
      if (cap.scopeType === 'lead') return params.leadId !== null && cap.scopeValue === params.leadId;
      return false;
    });
}

export function checkBudgetForJob(params: BudgetCheckParams): BudgetCheckResult {
  const caps = listApplicableCaps(params);

  const evaluations: BudgetCapEvaluation[] = caps.map((cap) => {
    const currentSpendCents = getCurrentSpendCents({
      scopeType: cap.scopeType,
      scopeValue: cap.scopeValue,
      period: cap.period
    });
    const projectedSpendCents = currentSpendCents + params.estimatedCostCents;
    return {
      capId: cap.capId,
      scopeType: cap.scopeType,
      scopeValue: cap.scopeValue,
      period: cap.period,
      capCents: cap.capCents,
      currentSpendCents,
      projectedSpendCents,
      actionOnExceed: cap.actionOnExceed,
      wouldExceed: projectedSpendCents > cap.capCents
    };
  });

  const warnings = evaluations.filter((evaluation) => evaluation.wouldExceed && evaluation.actionOnExceed === 'warn');
  const blocking = evaluations.find((evaluation) => evaluation.wouldExceed && evaluation.actionOnExceed === 'block');

  if (blocking) {
    return { ok: false, blocking, evaluations, warnings };
  }
  return { ok: true, evaluations, warnings };
}
