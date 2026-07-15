import { track } from '@/lib/analytics/track';
import {
  awaitAccountGenerationLease,
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { getLatestConsentsWithLease, recordConsent } from '@/lib/consent/consent';
import { withdrawConsent } from '@/lib/consent/withdrawal';
import { requirePrivateBoolean } from '@/lib/storage/privateBoolean';

import { resolveCommerceConsent } from './consentLogic';
import { COMMERCE_COPY } from './copy';
import { readCommerceConsentLocal, setCommerceConsentLocal } from './store';

// The MHMDA "sharing" consent gate for commerce (docs/10 §6). The deep-research pass
// confirmed: inferred skincare-concern data is regulated consumer health data, and
// SHARING anything health-adjacent with an affiliate needs a SEPARATE, distinct,
// opt-in consent (RCW 19.373.030). With a live private right of action. We reuse the
// `data_sharing` consent type (the only third-party-sharing consent in the docs/01
// enum), recorded with commerce-specific copy + version so the immutable ledger proves
// what was shown. Local-first (the local flag is the v1 source of truth, offline-safe);
// the ledger reconciles when the backend exists (B-SUPABASE).
//
// MHMDA-strict default (D-061): no consent => NO paid links are shown at all (stricter
// than the mock's "links still work with zero tracking"). Decline leaves only the
// "add it to your shelf" path. Revocable from the You-tab "Share data with partners"
// toggle (a new ledger row). Which re-locks the affordance.

export async function isCommerceConsentedWithLease(
  lease: AccountGenerationLease,
): Promise<boolean> {
  // Ledger authoritative-if-present, else the local-first flag (resolveCommerceConsent,
  // tested). A revocation re-locks even against a stale local flag (review fix, D-061);
  // the You-tab toggle ALSO mirrors the local flag (you.tsx) so v1 (no backend)
  // revocation re-locks too.
  lease.assertCurrent();
  let ledger: boolean | undefined;
  try {
    const consents = await getLatestConsentsWithLease(lease);
    lease.assertCurrent();
    if ('data_sharing' in consents) ledger = consents['data_sharing'];
  } catch {
    lease.assertCurrent();
    /* offline / no DB. Fall back to the local-first flag */
  }
  if (ledger !== undefined) return resolveCommerceConsent(ledger, false);

  const local = await awaitAccountGenerationLease(lease, readCommerceConsentLocal);
  lease.assertCurrent();
  return resolveCommerceConsent(ledger, requirePrivateBoolean(local));
}

export function isCommerceConsented(): Promise<boolean> {
  return runAccountGenerationOperation(isCommerceConsentedWithLease);
}

export async function grantCommerceConsent(): Promise<void> {
  await runAccountGenerationOperation(async (lease) => {
    await setCommerceConsentLocal(true);
    lease.assertCurrent();
    try {
      await recordConsent({
        type: 'data_sharing',
        granted: true,
        version: COMMERCE_COPY.consentVersion,
        consentText: `[PLACEHOLDER commerce data-sharing consent. B-PRIVACY-COPY] ${COMMERCE_COPY.consent.body}`,
      });
      lease.assertCurrent();
    } catch {
      lease.assertCurrent();
      /* offline / no DB. Keep the local-first flag; ledger reconciles later. */
    }
    track('commerce_consent_granted');
  });
}

export async function declineCommerceConsent(): Promise<void> {
  await runAccountGenerationOperation(async (lease) => {
    await setCommerceConsentLocal(false);
    lease.assertCurrent();
    try {
      await withdrawConsent({
        type: 'data_sharing',
        version: COMMERCE_COPY.consentVersion,
        consentText: `[PLACEHOLDER commerce data-sharing withdrawal. B-PRIVACY-COPY]`,
      });
      lease.assertCurrent();
    } catch {
      lease.assertCurrent();
      /* offline / no DB. Keep the local revocation authoritative. */
    }
    track('commerce_consent_declined');
  });
}
