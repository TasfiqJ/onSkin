import { track } from '@/lib/analytics/track';
import {
  awaitAccountGenerationLease,
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { getLatestConsentsWithLease, recordConsent } from '@/lib/consent/consent';
import { withdrawConsent } from '@/lib/consent/withdrawal';
import { requirePrivateBoolean } from '@/lib/storage/privateBoolean';

import { COMMUNITY_COPY } from './copy';
import {
  readCommunityConsentLocal,
  setAgeConfirmedLocal,
  setCommunityConsentLocal,
} from './store';

// The community_participation consent (docs/11 §8, D-066). A NEW, separate, unbundled
// MHMDA/GDPR-Art.9 consent for posting health-adjacent info to others, NEVER reused from
// the photo or data_sharing grants. Recorded with community-specific copy + version into
// the immutable ledger so it proves what was shown. Local-first (offline-safe);
// ledger-authoritative-when-present so a withdrawal re-locks (the Slice-24 precedence).
// Withdrawal deletes the user's questions (Edge Function, deferred B-COMMUNITY-MOD).

export async function isCommunityConsentedWithLease(
  lease: AccountGenerationLease,
): Promise<boolean> {
  lease.assertCurrent();
  try {
    const consents = await getLatestConsentsWithLease(lease);
    lease.assertCurrent();
    if ('community_participation' in consents) {
      return consents['community_participation'] === true;
    }
  } catch {
    lease.assertCurrent();
    /* offline / no DB. Fall back to the local-first flag */
  }
  const local = await awaitAccountGenerationLease(lease, readCommunityConsentLocal);
  lease.assertCurrent();
  return requirePrivateBoolean(local);
}

export function isCommunityConsented(): Promise<boolean> {
  return runAccountGenerationOperation(isCommunityConsentedWithLease);
}

/** Grant the community_participation consent. The 16+ age gate is a SEPARATE
 *  affirmative action (confirmCommunityAge), never auto-set here, so the composer
 *  can require both (docs/11 §8: the hard age gate is a real control, not copy). */
export async function grantCommunityConsent(): Promise<void> {
  await runAccountGenerationOperation(async (lease) => {
    await setCommunityConsentLocal(true);
    lease.assertCurrent();
    try {
      await recordConsent({
        type: 'community_participation',
        granted: true,
        version: COMMUNITY_COPY.consentVersion,
        consentText: `[PLACEHOLDER community_participation consent. B-PRIVACY-COPY] ${COMMUNITY_COPY.consent.body}`,
      });
      lease.assertCurrent();
      track('community_consent_granted');
    } catch {
      lease.assertCurrent();
      // Local-first/offline-safe: keep the local gate usable when the immutable
      // ledger mirror is unavailable. Ledger state still wins on future reads when present.
    }
  });
}

/** Record the explicit 16+ affirmation (COPPA + the Apple/store age floor). Must
 *  be an affirmative user action (a ticked box), never bundled into the consent. */
export async function confirmCommunityAge(): Promise<void> {
  await setAgeConfirmedLocal(true);
}

export async function withdrawCommunityConsent(): Promise<void> {
  await runAccountGenerationOperation(async (lease) => {
    await setCommunityConsentLocal(false);
    lease.assertCurrent();
    await withdrawConsent({
      type: 'community_participation',
      version: COMMUNITY_COPY.consentVersion,
      consentText: `[PLACEHOLDER community_participation withdrawal. B-PRIVACY-COPY]`,
    });
    lease.assertCurrent();
  });
}
