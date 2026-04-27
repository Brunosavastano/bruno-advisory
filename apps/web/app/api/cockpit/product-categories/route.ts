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
  createProductCategory,
  listProductCategories,
  type CreateProductCategoryInput
} from '../../../../lib/intake-storage';
import { requireCockpitSession } from '../../../../lib/cockpit-session';

type CreatePayload = Partial<{
  categoryKey: string;
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

function normalizeAllowedRiskProfiles(value: unknown): readonly ClientRiskProfile[] | null {
  if (!Array.isArray(value)) return null;
  const out: ClientRiskProfile[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') return null;
    if (!clientRiskProfiles.includes(entry as ClientRiskProfile)) return null;
    out.push(entry as ClientRiskProfile);
  }
  return out;
}

export async function GET(request: Request) {
  const check = await requireCockpitSession(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status');
  const filter = statusFilter && productCategoryStatuses.includes(statusFilter as ProductCategoryStatus)
    ? { status: statusFilter as ProductCategoryStatus }
    : undefined;

  return Response.json({
    ok: true,
    productCategories: listProductCategories(filter)
  });
}

export async function POST(request: Request) {
  const check = await requireCockpitSession(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  let payload: CreatePayload;
  try {
    payload = (await request.json()) as CreatePayload;
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const riskLevel = asEnum<ProductRiskLevel>(payload.riskLevel, productRiskLevels);
  const liquidityRisk = asEnum<ProductLiquidityRiskLevel>(payload.liquidityRisk, productLiquidityRiskLevels);
  const creditRisk = asEnum<ProductCreditRiskLevel>(payload.creditRisk, productCreditRiskLevels);
  const marketRisk = asEnum<ProductMarketRiskLevel>(payload.marketRisk, productMarketRiskLevels);
  const complexityLevel = asEnum<ProductComplexityLevel>(payload.complexityLevel, productComplexityLevels);
  const allowedRiskProfiles = normalizeAllowedRiskProfiles(payload.allowedRiskProfiles);

  if (!riskLevel || !liquidityRisk || !creditRisk || !marketRisk || !complexityLevel || !allowedRiskProfiles) {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  let status: ProductCategoryStatus | undefined;
  if (payload.status !== undefined) {
    const parsed = asEnum<ProductCategoryStatus>(payload.status, productCategoryStatuses);
    if (!parsed) {
      return Response.json({ ok: false, error: 'invalid_status' }, { status: 400 });
    }
    status = parsed;
  }

  const requiredInvestorCategory = payload.requiredInvestorCategory === undefined || payload.requiredInvestorCategory === null
    ? null
    : asEnum<InvestorCategory>(payload.requiredInvestorCategory, investorCategories);
  if (payload.requiredInvestorCategory && !requiredInvestorCategory) {
    return Response.json({ ok: false, error: 'invalid_required_investor_category' }, { status: 400 });
  }

  const input: CreateProductCategoryInput = {
    categoryKey: payload.categoryKey ?? '',
    displayName: payload.displayName ?? '',
    status,
    riskLevel,
    liquidityRisk,
    creditRisk,
    marketRisk,
    complexityLevel,
    issuerRiskProfile: payload.issuerRiskProfile ?? null,
    hasGuarantee: payload.hasGuarantee ?? false,
    guaranteeDescription: payload.guaranteeDescription ?? null,
    lockupPeriodDays: payload.lockupPeriodDays ?? null,
    directCostNotes: payload.directCostNotes ?? null,
    indirectCostNotes: payload.indirectCostNotes ?? null,
    allowedRiskProfiles,
    requiredInvestorCategory,
    requiresHumanReview: payload.requiresHumanReview ?? false,
    classificationRationale: payload.classificationRationale ?? '',
    reviewedAt: payload.reviewedAt ?? null,
    reviewedBy: payload.reviewedBy ?? null,
    expiresAt: payload.expiresAt ?? null
  };

  const result = createProductCategory(input, check.context.actorId);
  if (!result.ok) {
    const status = result.errorCode === 'duplicate_category_key' ? 409 : 400;
    return Response.json({ ok: false, error: result.errorCode }, { status });
  }

  return Response.json({ ok: true, productCategory: result.productCategory }, { status: 201 });
}
