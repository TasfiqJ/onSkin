import type { HealthDependentConsentStatus } from '@/lib/consent/consent';

/** Compatibility resolver. COM-01A has no positive commerce consent issuer. */
export function resolveCommerceConsent(_params: {
  configured: boolean;
  status: HealthDependentConsentStatus | null;
  exactLocalReceipt: boolean;
}): false {
  return false;
}
