import { track } from '@/lib/analytics/track';
import {
  grantHealthDependentConsent,
  isHealthDependentConsentActive,
  withdrawHealthDependentConsent,
} from '@/lib/consent/dependentConsentLifecycle';

import { clearAskStore } from './store';

/** Cloud Ask is default-off and requires an exact authoritative receipt. */
export function isAskConsented(): Promise<boolean> {
  return isHealthDependentConsentActive('ask_layerwell', {
    deleteLocalOnAuthoritativeClose: clearAskStore,
  });
}

export async function grantAskConsent(): Promise<void> {
  await grantHealthDependentConsent('ask_layerwell');
  track('ask_consent_granted');
}

export async function revokeAskConsent(): Promise<void> {
  await withdrawHealthDependentConsent({
    type: 'ask_layerwell',
    deleteLocal: clearAskStore,
  });
  track('ask_consent_revoked');
}
