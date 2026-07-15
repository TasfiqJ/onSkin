import { track } from '@/lib/analytics/track';
import {
  grantHealthDependentConsent,
  isHealthDependentConsentActive,
  withdrawHealthDependentConsent,
} from '@/lib/consent/dependentConsentLifecycle';

import { clearCommunityState, setAgeConfirmedLocal } from './store';

/** Posting consent is authoritative-only: no transport means no disclosure. */
export function isCommunityConsented(): Promise<boolean> {
  return isHealthDependentConsentActive('community_participation', {
    deleteLocalOnAuthoritativeClose: clearCommunityState,
  });
}

export async function grantCommunityConsent(): Promise<void> {
  await grantHealthDependentConsent('community_participation');
  track('community_consent_granted');
}

/** The 16+ affirmation remains separate from participation consent. */
export async function confirmCommunityAge(): Promise<void> {
  await setAgeConfirmedLocal(true);
}

export async function withdrawCommunityConsent(): Promise<void> {
  await withdrawHealthDependentConsent({
    type: 'community_participation',
    deleteLocal: clearCommunityState,
  });
  track('community_consent_withdrawn');
}
