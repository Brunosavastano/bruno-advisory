import { randomUUID } from 'node:crypto';
import {
  clientRiskProfiles,
  investorCategories,
  productCategoryStatuses,
  productComplexityLevels,
  productCreditRiskLevels,
  productLiquidityRiskLevels,
  productMarketRiskLevels,
  productRiskLevels,
  type ClientRiskProfile,
  type InvestorCategory,
  type ProductCategoryRecord,
  type ProductCategoryStatus,
  type ProductComplexityLevel,
  type ProductCreditRiskLevel,
  type ProductLiquidityRiskLevel,
  type ProductMarketRiskLevel,
  type ProductRiskLevel
} from '@savastano-advisory/core';
import { writeAuditLog } from './audit-log';
import { getDatabase, productCategoriesTable } from './db';

// AI-3 Cycle 1 (ampliado) — CRUD básico de product_categories.
// Cycle 1 cobre create, list, get, update. Versionamento e revisões periódicas
// (campo expires_at já existe) ficam para tranches futuras.

const SELECT_COLUMNS = `
  product_category_id AS productCategoryId,
  category_key AS categoryKey,
  display_name AS displayName,
  status,
  risk_level AS riskLevel,
  liquidity_risk AS liquidityRisk,
  credit_risk AS creditRisk,
  market_risk AS marketRisk,
  complexity_level AS complexityLevel,
  issuer_risk_profile AS issuerRiskProfile,
  has_guarantee AS hasGuarantee,
  guarantee_description AS guaranteeDescription,
  lockup_period_days AS lockupPeriodDays,
  direct_cost_notes AS directCostNotes,
  indirect_cost_notes AS indirectCostNotes,
  allowed_risk_profiles_json AS allowedRiskProfilesJson,
  required_investor_category AS requiredInvestorCategory,
  requires_human_review AS requiresHumanReview,
  classification_rationale AS classificationRationale,
  reviewed_at AS reviewedAt,
  reviewed_by AS reviewedBy,
  expires_at AS expiresAt,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function parseAllowedRiskProfiles(raw: unknown): readonly ClientRiskProfile[] {
  if (typeof raw !== 'string' || raw.length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: ClientRiskProfile[] = [];
    for (const value of parsed) {
      if (typeof value === 'string' && clientRiskProfiles.includes(value as ClientRiskProfile)) {
        out.push(value as ClientRiskProfile);
      }
    }
    return out;
  } catch {
    return [];
  }
}

function normalizeRow(row: Record<string, unknown>): ProductCategoryRecord {
  const status = String(row.status) as ProductCategoryStatus;
  if (!productCategoryStatuses.includes(status)) {
    throw new Error(`Invalid product_category status: ${status}`);
  }

  const riskLevel = String(row.riskLevel) as ProductRiskLevel;
  if (!productRiskLevels.includes(riskLevel)) {
    throw new Error(`Invalid risk_level: ${riskLevel}`);
  }

  const liquidityRisk = String(row.liquidityRisk) as ProductLiquidityRiskLevel;
  if (!productLiquidityRiskLevels.includes(liquidityRisk)) {
    throw new Error(`Invalid liquidity_risk: ${liquidityRisk}`);
  }

  const creditRisk = String(row.creditRisk) as ProductCreditRiskLevel;
  if (!productCreditRiskLevels.includes(creditRisk)) {
    throw new Error(`Invalid credit_risk: ${creditRisk}`);
  }

  const marketRisk = String(row.marketRisk) as ProductMarketRiskLevel;
  if (!productMarketRiskLevels.includes(marketRisk)) {
    throw new Error(`Invalid market_risk: ${marketRisk}`);
  }

  const complexityLevel = String(row.complexityLevel) as ProductComplexityLevel;
  if (!productComplexityLevels.includes(complexityLevel)) {
    throw new Error(`Invalid complexity_level: ${complexityLevel}`);
  }

  const requiredInvestorCategoryRaw = nullableString(row.requiredInvestorCategory);
  const requiredInvestorCategory = requiredInvestorCategoryRaw && investorCategories.includes(requiredInvestorCategoryRaw as InvestorCategory)
    ? (requiredInvestorCategoryRaw as InvestorCategory)
    : null;

  return {
    productCategoryId: String(row.productCategoryId),
    categoryKey: String(row.categoryKey),
    displayName: String(row.displayName),
    status,
    riskLevel,
    liquidityRisk,
    creditRisk,
    marketRisk,
    complexityLevel,
    issuerRiskProfile: nullableString(row.issuerRiskProfile),
    hasGuarantee: Number(row.hasGuarantee) === 1,
    guaranteeDescription: nullableString(row.guaranteeDescription),
    lockupPeriodDays: nullableNumber(row.lockupPeriodDays),
    directCostNotes: nullableString(row.directCostNotes),
    indirectCostNotes: nullableString(row.indirectCostNotes),
    allowedRiskProfiles: parseAllowedRiskProfiles(row.allowedRiskProfilesJson),
    requiredInvestorCategory,
    requiresHumanReview: Number(row.requiresHumanReview) === 1,
    classificationRationale: String(row.classificationRationale),
    reviewedAt: nullableString(row.reviewedAt),
    reviewedBy: nullableString(row.reviewedBy),
    expiresAt: nullableString(row.expiresAt),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt)
  };
}

export type CreateProductCategoryInput = {
  categoryKey: string;
  displayName: string;
  status?: ProductCategoryStatus;
  riskLevel: ProductRiskLevel;
  liquidityRisk: ProductLiquidityRiskLevel;
  creditRisk: ProductCreditRiskLevel;
  marketRisk: ProductMarketRiskLevel;
  complexityLevel: ProductComplexityLevel;
  issuerRiskProfile?: string | null;
  hasGuarantee?: boolean;
  guaranteeDescription?: string | null;
  lockupPeriodDays?: number | null;
  directCostNotes?: string | null;
  indirectCostNotes?: string | null;
  allowedRiskProfiles: readonly ClientRiskProfile[];
  requiredInvestorCategory?: InvestorCategory | null;
  requiresHumanReview?: boolean;
  classificationRationale: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  expiresAt?: string | null;
};

export type CreateProductCategoryResult =
  | { ok: true; productCategory: ProductCategoryRecord }
  | { ok: false; errorCode: 'duplicate_category_key' | 'invalid_payload' };

export function createProductCategory(input: CreateProductCategoryInput, actorId: string | null): CreateProductCategoryResult {
  const categoryKey = input.categoryKey.trim();
  const displayName = input.displayName.trim();
  const classificationRationale = input.classificationRationale.trim();
  const allowed = input.allowedRiskProfiles.filter((value) => clientRiskProfiles.includes(value));

  if (!categoryKey || !displayName || !classificationRationale || allowed.length === 0) {
    return { ok: false, errorCode: 'invalid_payload' };
  }

  const status: ProductCategoryStatus = input.status ?? 'draft';
  if (!productCategoryStatuses.includes(status)) {
    return { ok: false, errorCode: 'invalid_payload' };
  }

  const requiredInvestorCategory = input.requiredInvestorCategory ?? null;
  if (requiredInvestorCategory && !investorCategories.includes(requiredInvestorCategory)) {
    return { ok: false, errorCode: 'invalid_payload' };
  }

  const db = getDatabase();
  const productCategoryId = randomUUID();
  const now = new Date().toISOString();

  try {
    db.prepare(`
      INSERT INTO ${productCategoriesTable} (
        product_category_id, category_key, display_name, status,
        risk_level, liquidity_risk, credit_risk, market_risk, complexity_level,
        issuer_risk_profile, has_guarantee, guarantee_description, lockup_period_days,
        direct_cost_notes, indirect_cost_notes, allowed_risk_profiles_json,
        required_investor_category, requires_human_review, classification_rationale,
        reviewed_at, reviewed_by, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      productCategoryId,
      categoryKey,
      displayName,
      status,
      input.riskLevel,
      input.liquidityRisk,
      input.creditRisk,
      input.marketRisk,
      input.complexityLevel,
      input.issuerRiskProfile ?? null,
      input.hasGuarantee ? 1 : 0,
      input.guaranteeDescription ?? null,
      input.lockupPeriodDays ?? null,
      input.directCostNotes ?? null,
      input.indirectCostNotes ?? null,
      JSON.stringify(allowed),
      requiredInvestorCategory,
      input.requiresHumanReview ? 1 : 0,
      classificationRationale,
      input.reviewedAt ?? null,
      input.reviewedBy ?? null,
      input.expiresAt ?? null,
      now,
      now
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('UNIQUE') && message.includes('category_key')) {
      return { ok: false, errorCode: 'duplicate_category_key' };
    }
    throw error;
  }

  writeAuditLog({
    action: 'product_category.created',
    entityType: 'product_category',
    entityId: productCategoryId,
    actorType: 'operator',
    actorId,
    detail: { categoryKey, displayName, status, riskLevel: input.riskLevel }
  });

  const created = getProductCategory(productCategoryId);
  if (!created) throw new Error(`product_category ${productCategoryId} missing after insert`);
  return { ok: true, productCategory: created };
}

export function getProductCategory(productCategoryId: string): ProductCategoryRecord | null {
  const db = getDatabase();
  const row = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM ${productCategoriesTable} WHERE product_category_id = ? LIMIT 1`)
    .get(productCategoryId) as Record<string, unknown> | undefined;
  return row ? normalizeRow(row) : null;
}

export function getProductCategoryByKey(categoryKey: string): ProductCategoryRecord | null {
  const db = getDatabase();
  const row = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM ${productCategoriesTable} WHERE category_key = ? LIMIT 1`)
    .get(categoryKey) as Record<string, unknown> | undefined;
  return row ? normalizeRow(row) : null;
}

export function listProductCategories(filter?: { status?: ProductCategoryStatus }): ProductCategoryRecord[] {
  const db = getDatabase();
  const status = filter?.status;
  const rows = (status
    ? db
        .prepare(`SELECT ${SELECT_COLUMNS} FROM ${productCategoriesTable} WHERE status = ? ORDER BY display_name ASC`)
        .all(status)
    : db
        .prepare(`SELECT ${SELECT_COLUMNS} FROM ${productCategoriesTable} ORDER BY display_name ASC`)
        .all()) as Record<string, unknown>[];
  return rows.map(normalizeRow);
}

export type UpdateProductCategoryInput = Partial<Omit<CreateProductCategoryInput, 'categoryKey'>> & {
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  expiresAt?: string | null;
};

export type UpdateProductCategoryResult =
  | { ok: true; productCategory: ProductCategoryRecord }
  | { ok: false; errorCode: 'product_category_not_found' | 'invalid_payload' };

export function updateProductCategory(
  productCategoryId: string,
  updates: UpdateProductCategoryInput,
  actorId: string | null
): UpdateProductCategoryResult {
  const current = getProductCategory(productCategoryId);
  if (!current) {
    return { ok: false, errorCode: 'product_category_not_found' };
  }

  const next: ProductCategoryRecord = {
    ...current,
    displayName: updates.displayName?.trim() || current.displayName,
    status: updates.status ?? current.status,
    riskLevel: updates.riskLevel ?? current.riskLevel,
    liquidityRisk: updates.liquidityRisk ?? current.liquidityRisk,
    creditRisk: updates.creditRisk ?? current.creditRisk,
    marketRisk: updates.marketRisk ?? current.marketRisk,
    complexityLevel: updates.complexityLevel ?? current.complexityLevel,
    issuerRiskProfile: updates.issuerRiskProfile === undefined ? current.issuerRiskProfile : updates.issuerRiskProfile,
    hasGuarantee: updates.hasGuarantee === undefined ? current.hasGuarantee : updates.hasGuarantee,
    guaranteeDescription: updates.guaranteeDescription === undefined ? current.guaranteeDescription : updates.guaranteeDescription,
    lockupPeriodDays: updates.lockupPeriodDays === undefined ? current.lockupPeriodDays : updates.lockupPeriodDays,
    directCostNotes: updates.directCostNotes === undefined ? current.directCostNotes : updates.directCostNotes,
    indirectCostNotes: updates.indirectCostNotes === undefined ? current.indirectCostNotes : updates.indirectCostNotes,
    allowedRiskProfiles: updates.allowedRiskProfiles
      ? updates.allowedRiskProfiles.filter((value) => clientRiskProfiles.includes(value))
      : current.allowedRiskProfiles,
    requiredInvestorCategory: updates.requiredInvestorCategory === undefined ? current.requiredInvestorCategory : updates.requiredInvestorCategory,
    requiresHumanReview: updates.requiresHumanReview === undefined ? current.requiresHumanReview : updates.requiresHumanReview,
    classificationRationale: updates.classificationRationale?.trim() || current.classificationRationale,
    reviewedAt: updates.reviewedAt === undefined ? current.reviewedAt : updates.reviewedAt,
    reviewedBy: updates.reviewedBy === undefined ? current.reviewedBy : updates.reviewedBy,
    expiresAt: updates.expiresAt === undefined ? current.expiresAt : updates.expiresAt
  };

  if (!productCategoryStatuses.includes(next.status)) {
    return { ok: false, errorCode: 'invalid_payload' };
  }
  if (next.status === 'active' && next.allowedRiskProfiles.length === 0) {
    return { ok: false, errorCode: 'invalid_payload' };
  }

  const now = new Date().toISOString();
  const db = getDatabase();
  db.prepare(`
    UPDATE ${productCategoriesTable}
    SET display_name = ?,
        status = ?,
        risk_level = ?,
        liquidity_risk = ?,
        credit_risk = ?,
        market_risk = ?,
        complexity_level = ?,
        issuer_risk_profile = ?,
        has_guarantee = ?,
        guarantee_description = ?,
        lockup_period_days = ?,
        direct_cost_notes = ?,
        indirect_cost_notes = ?,
        allowed_risk_profiles_json = ?,
        required_investor_category = ?,
        requires_human_review = ?,
        classification_rationale = ?,
        reviewed_at = ?,
        reviewed_by = ?,
        expires_at = ?,
        updated_at = ?
    WHERE product_category_id = ?
  `).run(
    next.displayName,
    next.status,
    next.riskLevel,
    next.liquidityRisk,
    next.creditRisk,
    next.marketRisk,
    next.complexityLevel,
    next.issuerRiskProfile,
    next.hasGuarantee ? 1 : 0,
    next.guaranteeDescription,
    next.lockupPeriodDays,
    next.directCostNotes,
    next.indirectCostNotes,
    JSON.stringify(next.allowedRiskProfiles),
    next.requiredInvestorCategory,
    next.requiresHumanReview ? 1 : 0,
    next.classificationRationale,
    next.reviewedAt,
    next.reviewedBy,
    next.expiresAt,
    now,
    productCategoryId
  );

  writeAuditLog({
    action: 'product_category.updated',
    entityType: 'product_category',
    entityId: productCategoryId,
    actorType: 'operator',
    actorId,
    detail: {
      categoryKey: current.categoryKey,
      previousStatus: current.status,
      newStatus: next.status
    }
  });

  const refreshed = getProductCategory(productCategoryId);
  if (!refreshed) throw new Error(`product_category ${productCategoryId} missing after update`);
  return { ok: true, productCategory: refreshed };
}
