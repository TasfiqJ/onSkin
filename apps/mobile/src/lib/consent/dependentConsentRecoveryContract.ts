import type { HealthDependentConsentType } from './dependentConsentContract';

export const HEALTH_DEPENDENT_CONSENT_RECOVERY_KEY_PREFIX =
  'layerwell.health_dependent_withdrawal.owner.';
export const HEALTH_DEPENDENT_CONSENT_RECOVERY_TYPES = Object.freeze([
  'photo_capture',
  'photo_cloud_backup',
  'photo_trend_insights',
  'ask_layerwell',
  'community_participation',
  'data_sharing',
] satisfies HealthDependentConsentType[]);
