import { track } from '@/lib/analytics/track';
import {
  grantHealthDependentConsent,
  isHealthDependentConsentActive,
  withdrawHealthDependentConsent,
} from '@/lib/consent/dependentConsentLifecycle';

import { clearTrendStore } from './store';

/** On-device trend may use only a full exact local receipt when no backend exists. */
export function isTrendInsightsConsented(): Promise<boolean> {
  return isHealthDependentConsentActive('photo_trend_insights', {
    allowExactLocalReceiptWhenUnconfigured: true,
    deleteLocalOnAuthoritativeClose: clearTrendStore,
  });
}

export async function grantTrendInsightsConsent(): Promise<void> {
  await grantHealthDependentConsent('photo_trend_insights', {
    allowExactLocalReceiptWhenUnconfigured: true,
  });
  track('trend_insights_opted_in');
}

export async function revokeTrendInsightsConsent(): Promise<void> {
  await withdrawHealthDependentConsent({
    type: 'photo_trend_insights',
    deleteLocal: clearTrendStore,
  });
  track('trend_consent_revoked');
}
