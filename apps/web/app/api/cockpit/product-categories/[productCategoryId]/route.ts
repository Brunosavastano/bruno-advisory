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
  type ProductCategoryStatus,
  type ProductComplexityLevel,
  type ProductCreditRiskLevel,
  type ProductLiquidityRiskLevel,
  type ProductMarketRiskLevel,
  type ProductRiskLevel
} from '@savastano-advisory/core';
import {
  getProductCategory,
  updateProductCategory,
  type UpdateProductCategoryInput
} from '../../../../../lib/intake-storage';
import { requireCockpitSession } from '../../../../../lib/cockpit-session';

type UpdatePayload = Partial<{
  displayName: string;
  status: string;
  riskLevel: string;
  liquidityRisk: string;
  creditRisk: string;
  marketRisk: string;
  complexityLevel: string;
  issuerRiskProfile: string | null;
  hasGuarantee: boolean;
  guaranteeDescription: string | null;
  lockupPeriodDays: number | null;
  directCostNotes: string | null;
  indirectCostNotes: string | null;
  allowedRiskProfiles: string[];
  requiredInvestorCategory: string | null;
  requiresHumanReview: boolean;
  classificationRationale: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  expiresAt: string | null;
}>;

function asEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ productCategoryId: string }> }
) {
  const check = await requireCockpitSession(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const { productCategoryId } = await context.params;
  const productCategory = getProductCategory(productCategoryId);
  if (!productCategory) {
    return Response.json({ ok: false, error: 'product_category_not_found' }, { status: 404 });
  }
  return Response.json({ ok: true, productCategory });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ productCategoryId: string }> }
) {
  const check = await requireCockpitSession(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const { productCategoryId } = await context.params;

  let payload: UpdatePayload;
  try {
    payload = (await request.json()) as UpdatePayload;
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const updates: UpdateProductCategoryInput = {};

  if (payload.displayName !== undefined) updates.displayName = payload.displayName;
  if (payload.classificationRationale !== undefined) updates.classificationRationale = payload.classificationRationale;
  if (payload.issuerRiskProfile !== undefined) updates.issuerRiskProfile = payload.issuerRiskProfile;
  if (payload.hasGuarantee !== undefined) updates.hasGuarantee = payload.hasGuarantee;
  if (payload.guaranteeDescription !== undefined) updates.guaranteeDescription = payload.guaranteeDescription;
  if (payload.lockupPeriodDays !== undefined) updates.lockupPeriodDays = payload.lockupPeriodDays;
  if (payload.directCostNotes !== undefined) updates.directCostNotes = payload.directCostNotes;
  if (payload.indirectCostNotes !== undefined) updates.indirectCostNotes = payload.indirectCostNotes;
  if (payload.requiresHumanReview !== undefined) updates.requiresHumanReview = payload.requiresHumanReview;
  if (payload.reviewedAt !== undefined) updates.reviewedAt = payload.reviewedAt;
  if (payload.reviewedBy !== undefined) updates.reviewedBy = payload.reviewedBy;
  if (payload.expiresAt !== undefined) updates.expiresAt = payload.expiresAt;

  if (payload.status !== undefined) {
    const status = asEnum<ProductCategoryStatus>(payload.status, productCategoryStatuses);
    if (!status) return Response.json({ ok: false, error: 'invalid_status' }, { status: 400 });
    updates.status = status;
  }
  if (payload.riskLevel !== undefined) {
    const value = asEnum<ProductRiskLevel>(payload.riskLevel, productRiskLevels);
    if (!value) return Response.json({ ok: false, error: 'invalid_risk_level' }, { status: 400 });
    updates.riskLevel = value;
  }
  if (payload.liquidityRisk !== undefined) {
    const value = asEnum<ProductLiquidityRiskLevel>(payload.liquidityRisk, productLiquidityRiskLevels);
    if (!value) return Response.json({ ok: false, error: 'invalid_liquidity_risk' }, { status: 400 });
    updates.liquidityRisk = value;
  }
  if (payload.creditRisk !== undefined) {
    const value = asEnum<ProductCreditRiskLevel>(payload.creditRisk, productCreditRiskLevels);
    if (!value) return Response.json({ ok: false, error: 'invalid_credit_risk' }, { status: 400 });
    updates.creditRisk = value;
  }
  if (payload.marketRisk !== undefined) {
    const value = asEnum<ProductMarketRiskLevel>(payload.marketRisk, productMarketRiskLevels);
    if (!value) return Response.json({ ok: false, error: 'invalid_market_risk' }, { status: 400 });
    updates.marketRisk = value;
  }
  if (payload.complexityLevel !== undefined) {
    const value = asEnum<ProductComplexityLevel>(payload.complexityLevel, productComplexityLevels);
    if (!value) return Response.json({ ok: false, error: 'invalid_complexity_level' }, { status: 400 });
    updates.complexityLevel = value;
  }
  if (payload.allowedRiskProfiles !== undefined) {
    if (!Array.isArray(payload.allowedRiskProfiles)) {
      return Response.json({ ok: false, error: 'invalid_allowed_risk_profiles' }, { status: 400 });
    }
    const validated: ClientRiskProfile[] = [];
    for (const entry of payload.allowedRiskProfiles) {
      if (typeof entry !== 'string' || !clientRiskProfiles.includes(entry as ClientRiskProfile)) {
        return Response.json({ ok: false, error: 'invalid_allowed_risk_profiles' }, { status: 400 });
      }
      validated.push(entry as ClientRiskProfile);
    }
    updates.allowedRiskProfiles = validated;
  }
  if (payload.requiredInvestorCategory !== undefined) {
    if (payload.requiredInvestorCategory === null) {
      updates.requiredInvestorCategory = null;
    } else {
      const value = asEnum<InvestorCategory>(payload.requiredInvestorCategory, investorCategories);
      if (!value) return Response.json({ ok: false, error: 'invalid_required_investor_category' }, { status: 400 });
      updates.requiredInvestorCategory = value;
    }
  }

  const result = updateProductCategory(productCategoryId, updates, check.context.actorId);
  if (!result.ok) {
    const status = result.errorCode === 'product_category_not_found' ? 404 : 422;
    return Response.json({ ok: false, error: result.errorCode }, { status });
  }
  return Response.json({ ok: true, productCategory: result.productCategory });
}
