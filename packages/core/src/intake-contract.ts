export const leadStatusValues = [
  'new',
  'triage_pending',
  'qualificacao_agendada',
  'fit_preliminar_aprovado',
  'encerrado_sem_fit'
] as const;

export type LeadStatus = (typeof leadStatusValues)[number];

export const leadFieldDefinitions = {
  leadId: { type: 'string', required: true, scope: 'system' },
  fullName: { type: 'string', required: true, scope: 'public_intake' },
  email: { type: 'string', required: true, scope: 'public_intake' },
  phone: { type: 'string', required: true, scope: 'public_intake' },
  city: { type: 'string', required: false, scope: 'public_intake' },
  state: { type: 'string', required: false, scope: 'public_intake' },
  investableAssetsBand: { type: 'enum', required: true, scope: 'public_intake' },
  primaryChallenge: { type: 'string', required: true, scope: 'public_intake' },
  sourceChannel: { type: 'enum', required: true, scope: 'system' },
  sourceLabel: { type: 'string', required: false, scope: 'public_intake' },
  sourceCampaign: { type: 'string', required: false, scope: 'system' },
  sourceMedium: { type: 'string', required: false, scope: 'system' },
  sourceContent: { type: 'string', required: false, scope: 'system' },
  intakeFormVersion: { type: 'string', required: true, scope: 'system' },
  privacyConsentAccepted: { type: 'boolean', required: true, scope: 'public_intake' },
  termsConsentAccepted: { type: 'boolean', required: true, scope: 'public_intake' },
  status: { type: 'enum', required: true, scope: 'system' },
  statusReason: { type: 'string', required: false, scope: 'internal' },
  fitSummary: { type: 'string', required: false, scope: 'internal' },
  internalOwner: { type: 'string', required: false, scope: 'internal' },
  submittedAt: { type: 'datetime', required: true, scope: 'system' },
  createdAt: { type: 'datetime', required: true, scope: 'system' },
  updatedAt: { type: 'datetime', required: true, scope: 'system' },
  firstCapturedAt: { type: 'datetime', required: true, scope: 'system' },
  lastStatusChangedAt: { type: 'datetime', required: true, scope: 'system' }
} as const;

export const requiredIntakeFields = [
  'fullName',
  'email',
  'phone',
  'investableAssetsBand',
  'primaryChallenge',
  'sourceLabel',
  'privacyConsentAccepted',
  'termsConsentAccepted'
] as const;

export const optionalIntakeFields = ['city', 'state'] as const;

export const sourceFields = [
  'sourceChannel',
  'sourceLabel',
  'sourceCampaign',
  'sourceMedium',
  'sourceContent'
] as const;

export const timestampFields = [
  'submittedAt',
  'createdAt',
  'updatedAt',
  'firstCapturedAt',
  'lastStatusChangedAt'
] as const;

export const minimumCockpitColumns = [
  'createdAt',
  'fullName',
  'email',
  'phone',
  'investableAssetsBand',
  'sourceChannel',
  'sourceLabel',
  'status',
  'fitSummary'
] as const;

export const intakeAnalyticsEvents = [
  't2_landing_viewed',
  't2_primary_cta_clicked',
  't2_intake_viewed',
  't2_intake_started',
  't2_intake_submitted',
  't2_intake_submit_succeeded',
  't2_intake_submit_failed'
] as const;

export const investableAssetsBandValues = [
  'ate_1m',
  '1m_a_3m',
  '3m_a_10m',
  '10m_a_20m',
  'acima_20m'
] as const;

export const sourceChannelValues = [
  'site_home',
  'site_offer',
  'site_contact',
  'referral',
  'direct_outreach',
  'unknown'
] as const;

export const intakeContract = {
  canonicalArtifact: 'packages/core/src/intake-contract.ts',
  tranche: 'T2',
  cycle: 1,
  objective: 'Lock the canonical intake contract before ornamental UI work.',
  leadDefaults: {
    status: 'new' as LeadStatus,
    sourceChannel: 'unknown',
    intakeFormVersion: 't2-cycle-1',
    fitSummary: null,
    internalOwner: null,
    statusReason: null
  },
  publicBoundary: {
    allowedPublicFields: [...requiredIntakeFields, ...optionalIntakeFields],
    disallowedPublicFields: [
      'documentUpload',
      'cpf',
      'rg',
      'fullBrokerageStatement',
      'bankAccountNumber',
      'kycAttachment'
    ]
  },
  leadSchema: leadFieldDefinitions,
  leadStatuses: leadStatusValues,
  requiredIntakeFields,
  optionalIntakeFields,
  sourceFields,
  timestampFields,
  minimumCockpitColumns,
  intakeAnalyticsEvents,
  enums: {
    investableAssetsBandValues,
    sourceChannelValues
  }
} as const;

export type LeadFieldName = keyof typeof leadFieldDefinitions;
export type RequiredIntakeField = (typeof requiredIntakeFields)[number];
export type OptionalIntakeField = (typeof optionalIntakeFields)[number];
export type SourceField = (typeof sourceFields)[number];
export type TimestampField = (typeof timestampFields)[number];
export type MinimumCockpitColumn = (typeof minimumCockpitColumns)[number];
export type IntakeAnalyticsEvent = (typeof intakeAnalyticsEvents)[number];
export type InvestableAssetsBand = (typeof investableAssetsBandValues)[number];
export type SourceChannel = (typeof sourceChannelValues)[number];

export type PublicIntakePayload = {
  fullName: string;
  email: string;
  phone: string;
  city?: string;
  state?: string;
  investableAssetsBand: InvestableAssetsBand;
  primaryChallenge: string;
  sourceLabel: string;
  privacyConsentAccepted: boolean;
  termsConsentAccepted: boolean;
};

export type PublicIntakeValidationError = {
  field: string;
  message: string;
};

export type PublicIntakeValidationResult =
  | { ok: true; data: PublicIntakePayload }
  | { ok: false; errors: PublicIntakeValidationError[] };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeString(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function normalizeOptionalString(value: unknown) {
  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true' || value === 'on' || value === '1') {
    return true;
  }

  if (value === 'false' || value === '0') {
    return false;
  }

  return undefined;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function validatePublicIntakePayload(input: unknown): PublicIntakeValidationResult {
  if (!isObjectRecord(input)) {
    return {
      ok: false,
      errors: [{ field: 'payload', message: 'Payload inválido.' }]
    };
  }

  const errors: PublicIntakeValidationError[] = [];
  const blockedKeys = intakeContract.publicBoundary.disallowedPublicFields.filter((key) => key in input);

  if (blockedKeys.length > 0) {
    errors.push({
      field: 'payload',
      message: `Campos não permitidos no intake público: ${blockedKeys.join(', ')}.`
    });
  }

  const fullName = normalizeString(input.fullName);
  const email = normalizeString(input.email).toLowerCase();
  const phone = normalizeString(input.phone);
  const city = normalizeOptionalString(input.city);
  const state = normalizeOptionalString(input.state);
  const investableAssetsBand = normalizeString(input.investableAssetsBand);
  const primaryChallenge = normalizeString(input.primaryChallenge);
  const sourceLabel = normalizeString(input.sourceLabel);
  const privacyConsentAccepted = normalizeBoolean(input.privacyConsentAccepted);
  const termsConsentAccepted = normalizeBoolean(input.termsConsentAccepted);

  if (fullName.length < 3) {
    errors.push({ field: 'fullName', message: 'Informe nome completo (mínimo 3 caracteres).' });
  }

  if (!emailPattern.test(email)) {
    errors.push({ field: 'email', message: 'Informe um e-mail válido.' });
  }

  if (phone.replace(/\D/g, '').length < 10) {
    errors.push({ field: 'phone', message: 'Informe um telefone com DDD.' });
  }

  if (!investableAssetsBandValues.includes(investableAssetsBand as InvestableAssetsBand)) {
    errors.push({
      field: 'investableAssetsBand',
      message: 'Selecione uma faixa de patrimônio investível válida.'
    });
  }

  if (primaryChallenge.length < 15) {
    errors.push({
      field: 'primaryChallenge',
      message: 'Descreva o desafio principal com pelo menos 15 caracteres.'
    });
  }

  if (sourceLabel.length < 2) {
    errors.push({
      field: 'sourceLabel',
      message: 'Origem do contato inválida.'
    });
  }

  if (privacyConsentAccepted !== true) {
    errors.push({
      field: 'privacyConsentAccepted',
      message: 'É obrigatório aceitar a política de privacidade.'
    });
  }

  if (termsConsentAccepted !== true) {
    errors.push({
      field: 'termsConsentAccepted',
      message: 'É obrigatório aceitar os termos.'
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      fullName,
      email,
      phone,
      city,
      state,
      investableAssetsBand: investableAssetsBand as InvestableAssetsBand,
      primaryChallenge,
      sourceLabel,
      privacyConsentAccepted: true,
      termsConsentAccepted: true
    }
  };
}
