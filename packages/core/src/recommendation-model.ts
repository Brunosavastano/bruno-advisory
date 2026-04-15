export const recommendationVisibilities = ['draft', 'published'] as const;
export type RecommendationVisibility = (typeof recommendationVisibilities)[number];

export const recommendationCategories = [
  'asset_allocation',
  'risk_management',
  'tax_planning',
  'general'
] as const;
export type RecommendationCategory = (typeof recommendationCategories)[number];

export const recommendationModel = {
  canonicalArtifact: 'packages/core/src/recommendation-model.ts',
  visibilities: recommendationVisibilities,
  categories: recommendationCategories,
  fields: [
    'recommendationId',
    'leadId',
    'title',
    'body',
    'category',
    'visibility',
    'createdAt',
    'publishedAt',
    'createdBy'
  ]
} as const;

export type RecommendationRecord = {
  recommendationId: string;
  leadId: string;
  title: string;
  body: string;
  category: RecommendationCategory | null;
  visibility: RecommendationVisibility;
  createdAt: string;
  publishedAt: string | null;
  createdBy: string;
};
