import type { ClientRiskProfile, InvestorCategory } from './client-profile-model';
import { cvm30ProductCategoryReferences } from './cvm-30-references';

// Classificação determinística de categorias de produtos para fins de
// suitability. Este modelo é complementar ao perfil do cliente: o gate de
// recomendação só consegue decidir adequação quando existe tanto perfil do
// cliente quanto categoria de produto classificada.

export const productCategoryStatuses = ['draft', 'active', 'retired'] as const;
export type ProductCategoryStatus = (typeof productCategoryStatuses)[number];

export const productRiskLevels = ['very_low', 'low', 'medium', 'high', 'very_high'] as const;
export type ProductRiskLevel = (typeof productRiskLevels)[number];

export const productLiquidityRiskLevels = ['daily', 'short', 'medium', 'long', 'illiquid'] as const;
export type ProductLiquidityRiskLevel = (typeof productLiquidityRiskLevels)[number];

export const productCreditRiskLevels = ['none', 'low', 'medium', 'high', 'very_high'] as const;
export type ProductCreditRiskLevel = (typeof productCreditRiskLevels)[number];

export const productMarketRiskLevels = ['very_low', 'low', 'medium', 'high', 'very_high'] as const;
export type ProductMarketRiskLevel = (typeof productMarketRiskLevels)[number];

export const productComplexityLevels = ['simple', 'moderate', 'complex', 'very_complex'] as const;
export type ProductComplexityLevel = (typeof productComplexityLevels)[number];

export const productCategoryModel = {
  canonicalArtifact: 'packages/core/src/product-category-model.ts',
  statuses: productCategoryStatuses,
  riskLevels: productRiskLevels,
  liquidityRiskLevels: productLiquidityRiskLevels,
  creditRiskLevels: productCreditRiskLevels,
  marketRiskLevels: productMarketRiskLevels,
  complexityLevels: productComplexityLevels,
  cvmReference: cvm30ProductCategoryReferences.product_category_classification.cvmReference,
  fields: [
    'productCategoryId',
    'categoryKey',
    'displayName',
    'status',
    'riskLevel',
    'liquidityRisk',
    'creditRisk',
    'marketRisk',
    'complexityLevel',
    'issuerRiskProfile',
    'hasGuarantee',
    'guaranteeDescription',
    'lockupPeriodDays',
    'directCostNotes',
    'indirectCostNotes',
    'allowedRiskProfiles',
    'requiredInvestorCategory',
    'requiresHumanReview',
    'classificationRationale',
    'reviewedAt',
    'reviewedBy',
    'expiresAt',
    'createdAt',
    'updatedAt'
  ] as const,
  invariants: [
    'status=active exige allowedRiskProfiles não vazio',
    'requiredInvestorCategory=null significa permitido para varejo, desde que compatível com perfil de risco',
    'produtos complexos devem exigir requiresHumanReview=true',
    'classificação deve ser revisada em periodicidade não superior ao prazo regulatório aplicável'
  ] as const,
  objective:
    'Classificar categorias de produtos para que o suitability gate consiga bloquear recomendações inadequadas ao perfil do cliente, categoria de investidor, complexidade, custos, liquidez e riscos.'
} as const;

export type ProductCategoryRecord = {
  productCategoryId: string;
  categoryKey: string;
  displayName: string;
  status: ProductCategoryStatus;
  riskLevel: ProductRiskLevel;
  liquidityRisk: ProductLiquidityRiskLevel;
  creditRisk: ProductCreditRiskLevel;
  marketRisk: ProductMarketRiskLevel;
  complexityLevel: ProductComplexityLevel;
  issuerRiskProfile: string | null;
  hasGuarantee: boolean;
  guaranteeDescription: string | null;
  lockupPeriodDays: number | null;
  directCostNotes: string | null;
  indirectCostNotes: string | null;
  allowedRiskProfiles: readonly ClientRiskProfile[];
  requiredInvestorCategory: InvestorCategory | null;
  requiresHumanReview: boolean;
  classificationRationale: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function isProductCategoryActiveForRecommendation(
  productCategory: Pick<
    ProductCategoryRecord,
    'status' | 'allowedRiskProfiles' | 'reviewedAt' | 'expiresAt'
  >,
  nowIso = new Date().toISOString()
): boolean {
  if (productCategory.status !== 'active') {
    return false;
  }

  if (productCategory.allowedRiskProfiles.length === 0) {
    return false;
  }

  if (!productCategory.reviewedAt) {
    return false;
  }

  if (!productCategory.expiresAt) {
    return true;
  }

  const expiresAtTime = Date.parse(productCategory.expiresAt);
  const nowTime = Date.parse(nowIso);

  return Number.isFinite(expiresAtTime) && Number.isFinite(nowTime) && expiresAtTime >= nowTime;
}
