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
import { updateProductCategory, type UpdateProductCategoryInput } from '../../../../../lib/intake-storage';
import { requireCockpitSession } from '../../../../../lib/cockpit-session';

function asEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : null;
}

function trimOrNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function parseIntOrNull(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ productCategoryId: string }> }
) {
  const check = await requireCockpitSession(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const { productCategoryId } = await context.params;
  const url = new URL(request.url);
  const action = url.searchParams.get('action') ?? '';
  const formData = await request.formData();

  const detailPath = `/cockpit/product-categories/${productCategoryId}`;

  if (action !== 'update') {
    return Response.redirect(new URL(`${detailPath}?error=invalid_action`, request.url), 303);
  }

  const status = asEnum<ProductCategoryStatus>(formData.get('status'), productCategoryStatuses);
  const riskLevel = asEnum<ProductRiskLevel>(formData.get('riskLevel'), productRiskLevels);
  const liquidityRisk = asEnum<ProductLiquidityRiskLevel>(formData.get('liquidityRisk'), productLiquidityRiskLevels);
  const creditRisk = asEnum<ProductCreditRiskLevel>(formData.get('creditRisk'), productCreditRiskLevels);
  const marketRisk = asEnum<ProductMarketRiskLevel>(formData.get('marketRisk'), productMarketRiskLevels);
  const complexityLevel = asEnum<ProductComplexityLevel>(formData.get('complexityLevel'), productComplexityLevels);

  if (!status || !riskLevel || !liquidityRisk || !creditRisk || !marketRisk || !complexityLevel) {
    return Response.redirect(new URL(`${detailPath}?error=invalid_enum_value`, request.url), 303);
  }

  const allowedRaw = formData.getAll('allowedRiskProfiles');
  const allowedRiskProfiles: ClientRiskProfile[] = [];
  for (const entry of allowedRaw) {
    const v = asEnum<ClientRiskProfile>(entry, clientRiskProfiles);
    if (!v) {
      return Response.redirect(new URL(`${detailPath}?error=invalid_allowed_risk_profiles`, request.url), 303);
    }
    allowedRiskProfiles.push(v);
  }

  let requiredInvestorCategory: InvestorCategory | null = null;
  const requiredRaw = trimOrNull(formData.get('requiredInvestorCategory'));
  if (requiredRaw) {
    const parsed = asEnum<InvestorCategory>(requiredRaw, investorCategories);
    if (!parsed) {
      return Response.redirect(new URL(`${detailPath}?error=invalid_required_investor_category`, request.url), 303);
    }
    requiredInvestorCategory = parsed;
  }

  const updates: UpdateProductCategoryInput = {
    displayName: String(formData.get('displayName') ?? '').trim(),
    status,
    riskLevel,
    liquidityRisk,
    creditRisk,
    marketRisk,
    complexityLevel,
    issuerRiskProfile: trimOrNull(formData.get('issuerRiskProfile')),
    hasGuarantee: formData.get('hasGuarantee') === 'true',
    guaranteeDescription: trimOrNull(formData.get('guaranteeDescription')),
    lockupPeriodDays: parseIntOrNull(formData.get('lockupPeriodDays')),
    directCostNotes: trimOrNull(formData.get('directCostNotes')),
    indirectCostNotes: trimOrNull(formData.get('indirectCostNotes')),
    allowedRiskProfiles,
    requiredInvestorCategory,
    requiresHumanReview: formData.get('requiresHumanReview') === 'true',
    classificationRationale: String(formData.get('classificationRationale') ?? '').trim(),
    reviewedAt: trimOrNull(formData.get('reviewedAt')),
    reviewedBy: check.context.actorId,
    expiresAt: trimOrNull(formData.get('expiresAt'))
  };

  const result = updateProductCategory(productCategoryId, updates, check.context.actorId);
  if (!result.ok) {
    return Response.redirect(new URL(`${detailPath}?error=${result.errorCode}`, request.url), 303);
  }

  return Response.redirect(new URL(`${detailPath}?action=updated`, request.url), 303);
}
