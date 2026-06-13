import { track } from '@/lib/analytics/track';
import { getLatestConsents, recordConsent } from '@/lib/consent/consent';

import { COMMUNITY_COPY } from './copy';
import { getCommunityConsentLocal, setAgeConfirmedLocal, setCommunityConsentLocal } from './store';

// The community_participation consent (docs/11 §8, D-066) — a NEW, separate, unbundled
// MHMDA/GDPR-Art.9 consent for posting health-adjacent info to others, NEVER reused from
// the photo or data_sharing grants. Recorded with community-specific copy + version into
// the immutable ledger so it proves what was shown. Local-first (offline-safe);
// ledger-authoritative-when-present so a withdrawal re-locks (the Slice-24 precedence).
// Withdrawal deletes the user's questions (Edge Function, deferred B-COMMUNITY-MOD).

export async function isCommunityConsented(): Promise<boolean> {
  try {
    const consents = await getLatestConsents();
    if ('community_participation' in consents) return consents['community_participation'] === true;
  } catch {
    /* offline / no DB — fall back to the local-first flag */
  }
  return getCommunityConsentLocal();
}

/** Grant the consent + confirm 16+ (the hard age gate, COPPA + "Sephora kids"). */
export async function grantCommunityConsent(): Promise<void> {
  await setCommunityConsentLocal(true);
  await setAgeConfirmedLocal(true);
  track('community_consent_granted');
  try {
    await recordConsent({
      type: 'community_participation',
      granted: true,
      version: COMMUNITY_COPY.consentVersion,
      consentText: `[PLACEHOLDER community_participation consent — B-PRIVACY-COPY] ${COMMUNITY_COPY.consent.body}`,
    });
  } catch {
    /* best-effort until backend configured */
  }
}

export async function withdrawCommunityConsent(): Promise<void> {
  await setCommunityConsentLocal(false);
  try {
    await recordConsent({
      type: 'community_participation',
      granted: false,
      version: COMMUNITY_COPY.consentVersion,
      consentText: `[PLACEHOLDER community_participation withdrawal — B-PRIVACY-COPY]`,
    });
  } catch {
    /* best-effort */
  }
}
