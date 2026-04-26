import {
  canRecommendProduct,
  cvm30OperationalReferences,
  isClientProfileActiveForRecommendation,
  type RecommendationContext,
  type SuitabilityGateOutcome
} from '@savastano-advisory/core';
import { getProductCategoryByKey } from './product-categories';
import { getCurrentClientProfile } from './suitability';

// AI-3 Cycle 1 (ampliado) — wrapper que carrega ClientProfileRecord +
// ProductCategoryRecord do DB e delega a decisão para a função pura
// canRecommendProduct(...) do pacote core. Mantém o domínio (regra) puro
// e o storage (acesso a DB) trivial.

export type SuitabilityGateLookup =
  | { ok: true; outcome: SuitabilityGateOutcome }
  | {
      ok: false;
      errorCode: 'unknown_lead' | 'unknown_product_category';
      detail?: { leadId?: string; productCategoryKey?: string };
    };

export function evaluateSuitabilityGateForProductKey(params: {
  leadId: string;
  productCategoryKey: string;
  context?: RecommendationContext;
}): SuitabilityGateLookup {
  const { leadId, productCategoryKey, context } = params;

  const profile = getCurrentClientProfile(leadId);
  // Ausência de perfil é uma decisão válida do gate (blocked_missing_profile),
  // não erro de lookup. Encaminhamos profile=null para que a decisão venha do
  // domínio canônico em vez de duplicar regra aqui.

  const productCategory = getProductCategoryByKey(productCategoryKey);
  if (!productCategory) {
    return {
      ok: false,
      errorCode: 'unknown_product_category',
      detail: { productCategoryKey }
    };
  }

  const outcome = canRecommendProduct(profile, productCategory, context);
  return { ok: true, outcome };
}

// Gate básico que NÃO depende de product_category — só verifica que o lead
// tem client_profile ativo, com validUntil no futuro e riskProfile definido.
// Usado como porta mínima na publicação de recomendações enquanto o vínculo
// recomendação ↔ product_category não é introduzido (ver débito do Cycle 2).

export type BasicSuitabilityGateOutcome = {
  readonly ok: boolean;
  readonly decision: 'allowed' | 'blocked_missing_profile' | 'blocked_expired_profile';
  readonly reasons: readonly string[];
  readonly cvmReferences: readonly string[];
};

export function evaluateBasicSuitabilityGateForLead(leadId: string, nowIso?: string): BasicSuitabilityGateOutcome {
  const profile = getCurrentClientProfile(leadId);

  if (!profile) {
    return {
      ok: false,
      decision: 'blocked_missing_profile',
      reasons: ['missing_client_profile'],
      cvmReferences: [
        cvm30OperationalReferences.recommendation_prohibitions.cvmReference,
        cvm30OperationalReferences.client_risk_profile_classification.cvmReference
      ]
    };
  }

  const eligibility = isClientProfileActiveForRecommendation(profile, nowIso);
  if (eligibility.ok) {
    return {
      ok: true,
      decision: 'allowed',
      reasons: [],
      cvmReferences: [
        cvm30OperationalReferences.recommendation_scope.cvmReference,
        cvm30OperationalReferences.client_risk_profile_classification.cvmReference
      ]
    };
  }

  const expired =
    eligibility.reasons.includes('profile_expired') ||
    eligibility.reasons.includes('invalid_valid_until') ||
    profile.status === 'expired';

  return {
    ok: false,
    decision: expired ? 'blocked_expired_profile' : 'blocked_missing_profile',
    reasons: eligibility.reasons,
    cvmReferences: [
      cvm30OperationalReferences.recommendation_prohibitions.cvmReference,
      cvm30OperationalReferences.profile_update_obligations.cvmReference
    ]
  };
}
