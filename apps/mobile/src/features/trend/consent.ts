import { track } from '@/lib/analytics/track';
import { withdrawHealthDependentConsent } from '@/lib/consent/dependentConsentLifecycle';

import { clearTrendStore } from './store';

// PHOTO-05A preserves only the cleanup half of the reserved photo_trend_insights
// consent contract (docs/12 §8, root D-072). No validated engine means no read and no
// new grant. Explicit revocation still deletes the local legacy receipt and reserved
// derived state through the shared dependent-consent lifecycle.

export async function isTrendInsightsConsented(): Promise<boolean> {
  // Do not inspect a legacy local/server receipt while the feature cannot be admitted.
  return false;
}

export const TREND_ENGINE_UNAVAILABLE = 'TREND_ENGINE_UNAVAILABLE';

export async function grantTrendInsightsConsent(): Promise<void> {
  // A direct caller is not a second admission authority. Reject before local state,
  // consent ledger, network, workflow, or analytics work.
  throw new Error(TREND_ENGINE_UNAVAILABLE);
}

export async function revokeTrendInsightsConsent(): Promise<void> {
  await withdrawHealthDependentConsent({
    type: 'photo_trend_insights',
    deleteLocal: clearTrendStore,
  });
  track('trend_consent_revoked');
}
