import {
  investorCategories,
  isClientProfileActiveForRecommendation,
  type ClientProfileRecord,
  type InvestorCategory
} from './client-profile-model';
import {
  cvm30OperationalReferences,
  cvm30ProductCategoryReferences
} from './cvm-30-references';
import {
  isProductCategoryActiveForRecommendation,
  type ProductCategoryRecord
} from './product-category-model';

// Gate determinístico de suitability para recomendações. Deve ser chamado antes
// de qualquer recomendação individualizada, inclusive draft gerado por IA.
//
// Regra operacional sugerida:
// - ok=true apenas quando a recomendação pode avançar sem bloqueio de perfil;
// - requires_human_review permite criar draft interno, mas não publicar ao
//   cliente sem aprovação do consultor responsável;
// - qualquer blocked_* impede recomendação personalizada até saneamento.

export type SuitabilityGateDecision =
  | 'allowed'
  | 'blocked_missing_profile'
  | 'blocked_expired_profile'
  | 'blocked_missing_product_classification'
  | 'blocked_inadequate_product'
  | 'blocked_investor_category'
  | 'blocked_excessive_or_inadequate_costs'
  | 'requires_human_review';

export type RecommendationCostAssessment = {
  readonly costsReviewed: boolean;
  readonly excessiveOrInadequateCosts: boolean;
  readonly rationale?: string;
};

export type RecommendationContext = {
  readonly nowIso?: string;
  readonly suitabilityAssessmentId?: string;
  readonly humanReviewed?: boolean;
  readonly costAssessment?: RecommendationCostAssessment;
};

export type SuitabilityGateOutcome = {
  readonly ok: boolean;
  readonly decision: SuitabilityGateDecision;
  readonly reasons: readonly string[];
  readonly cvmReferences: readonly string[];
};

const investorCategoryRanks: Readonly<Record<InvestorCategory, number>> = {
  retail: 0,
  qualified: 1,
  professional: 2
};

function isInvestorCategoryAtLeast(
  actual: InvestorCategory,
  required: InvestorCategory | null
): boolean {
  if (!required) {
    return true;
  }

  return investorCategoryRanks[actual] >= investorCategoryRanks[required];
}

function missingProfileOutcome(reasons: readonly string[]): SuitabilityGateOutcome {
  return {
    ok: false,
    decision: 'blocked_missing_profile',
    reasons,
    cvmReferences: [
      cvm30OperationalReferences.recommendation_prohibitions.cvmReference,
      cvm30OperationalReferences.client_risk_profile_classification.cvmReference
    ]
  };
}

export function canRecommendProduct(
  clientProfile: ClientProfileRecord | null | undefined,
  productCategory: ProductCategoryRecord | null | undefined,
  context: RecommendationContext = {}
): SuitabilityGateOutcome {
  const nowIso = context.nowIso ?? new Date().toISOString();

  if (!clientProfile) {
    return missingProfileOutcome(['missing_client_profile']);
  }

  const profileEligibility = isClientProfileActiveForRecommendation(clientProfile, nowIso);
  if (!profileEligibility.ok) {
    const hasExpired = profileEligibility.reasons.includes('profile_expired') || clientProfile.status === 'expired';

    return {
      ok: false,
      decision: hasExpired ? 'blocked_expired_profile' : 'blocked_missing_profile',
      reasons: profileEligibility.reasons,
      cvmReferences: [
        cvm30OperationalReferences.recommendation_prohibitions.cvmReference,
        cvm30OperationalReferences.profile_update_obligations.cvmReference
      ]
    };
  }

  if (!productCategory) {
    return {
      ok: false,
      decision: 'blocked_missing_product_classification',
      reasons: ['missing_product_category_classification'],
      cvmReferences: [cvm30ProductCategoryReferences.product_category_classification.cvmReference]
    };
  }

  if (!isProductCategoryActiveForRecommendation(productCategory, nowIso)) {
    return {
      ok: false,
      decision: 'blocked_missing_product_classification',
      reasons: ['product_category_not_active_or_outdated'],
      cvmReferences: [
        cvm30ProductCategoryReferences.product_category_classification.cvmReference,
        cvm30OperationalReferences.profile_update_obligations.cvmReference
      ]
    };
  }

  if (!clientProfile.riskProfile) {
    return missingProfileOutcome(['missing_risk_profile']);
  }

  if (!productCategory.allowedRiskProfiles.includes(clientProfile.riskProfile)) {
    return {
      ok: false,
      decision: 'blocked_inadequate_product',
      reasons: [
        `product_category_${productCategory.categoryKey}_not_allowed_for_profile_${clientProfile.riskProfile}`
      ],
      cvmReferences: [
        cvm30OperationalReferences.recommendation_prohibitions.cvmReference,
        cvm30ProductCategoryReferences.product_category_classification.cvmReference
      ]
    };
  }

  if (!isInvestorCategoryAtLeast(clientProfile.investorCategory, productCategory.requiredInvestorCategory)) {
    const required = productCategory.requiredInvestorCategory;
    return {
      ok: false,
      decision: 'blocked_investor_category',
      reasons: [
        `client_investor_category_${clientProfile.investorCategory}_below_required_${required}`
      ],
      cvmReferences: required === 'professional'
        ? [cvm30OperationalReferences.professional_investor_category.cvmReference]
        : [cvm30OperationalReferences.qualified_investor_category.cvmReference]
    };
  }

  if (context.costAssessment?.excessiveOrInadequateCosts) {
    return {
      ok: false,
      decision: 'blocked_excessive_or_inadequate_costs',
      reasons: [context.costAssessment.rationale ?? 'costs_excessive_or_inadequate_to_profile'],
      cvmReferences: [cvm30ProductCategoryReferences.cost_adequacy.cvmReference]
    };
  }

  if (productCategory.requiresHumanReview && !context.humanReviewed) {
    return {
      ok: false,
      decision: 'requires_human_review',
      reasons: [`product_category_${productCategory.categoryKey}_requires_human_review`],
      cvmReferences: [
        cvm30ProductCategoryReferences.product_category_classification.cvmReference,
        cvm30OperationalReferences.recommendation_prohibitions.cvmReference
      ]
    };
  }

  if (context.costAssessment && !context.costAssessment.costsReviewed) {
    return {
      ok: false,
      decision: 'requires_human_review',
      reasons: ['costs_not_reviewed'],
      cvmReferences: [cvm30ProductCategoryReferences.cost_adequacy.cvmReference]
    };
  }

  return {
    ok: true,
    decision: 'allowed',
    reasons: [],
    cvmReferences: [
      cvm30OperationalReferences.recommendation_scope.cvmReference,
      cvm30OperationalReferences.client_risk_profile_classification.cvmReference,
      cvm30ProductCategoryReferences.product_category_classification.cvmReference
    ]
  };
}

export { investorCategories };
