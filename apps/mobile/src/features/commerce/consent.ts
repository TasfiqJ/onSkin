import { track } from '@/lib/analytics/track';
import {
  grantHealthDependentConsent,
  isHealthDependentConsentActive,
  refuseHealthDependentConsent,
  withdrawHealthDependentConsent,
} from '@/lib/consent/dependentConsentLifecycle';

import { clearCommerceState } from './store';

/** Partner disclosure never falls back to a boolean or an offline local grant. */
export function isCommerceConsented(): Promise<boolean> {
  return isHealthDependentConsentActive('data_sharing', {
    deleteLocalOnAuthoritativeClose: clearCommerceState,
  });
}

export async function grantCommerceConsent(): Promise<void> {
  await grantHealthDependentConsent('data_sharing');
  track('commerce_consent_granted');
}

export async function declineCommerceConsent(): Promise<void> {
  await withdrawHealthDependentConsent({
    type: 'data_sharing',
    deleteLocal: clearCommerceState,
  });
  track('commerce_consent_declined');
}

/** Initial sheet refusal: confirm the authority is already off; record no revocation claim. */
export async function refuseCommerceConsent(): Promise<void> {
  await refuseHealthDependentConsent({
    type: 'data_sharing',
    deleteLocal: clearCommerceState,
  });
  track('commerce_consent_declined');
}
