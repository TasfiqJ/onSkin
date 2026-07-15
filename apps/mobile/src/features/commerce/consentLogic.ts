import type { HealthDependentConsentStatus } from '@/lib/consent/consent';

/** Pure presentation helper; partner disclosure never accepts a boolean ledger. */
export function resolveCommerceConsent(params: {
  configured: boolean;
  status: HealthDependentConsentStatus | null;
  exactLocalReceipt: boolean;
}): boolean {
  if (params.configured) {
    return (
      params.status?.consentType === 'data_sharing' &&
      params.status.state === 'active' &&
      params.status.generation > 0
    );
  }
  // Even an exact local receipt is intentionally insufficient for partner
  // disclosure; this field exists so tests make that policy explicit.
  return false;
}
