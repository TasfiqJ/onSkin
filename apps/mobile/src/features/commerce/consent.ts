import { track } from '@/lib/analytics/track';
import { getLatestConsents, recordConsent } from '@/lib/consent/consent';
import { withdrawConsent } from '@/lib/consent/withdrawal';

import { resolveCommerceConsent } from './consentLogic';
import { COMMERCE_COPY } from './copy';
import { getCommerceConsentLocal, setCommerceConsentLocal } from './store';

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

export async function isCommerceConsented(): Promise<boolean> {
  // Ledger authoritative-if-present, else the local-first flag (resolveCommerceConsent,
  // tested). A revocation re-locks even against a stale local flag (review fix, D-061);
  // the You-tab toggle ALSO mirrors the local flag (you.tsx) so v1 (no backend)
  // revocation re-locks too.
  let ledger: boolean | undefined;
  try {
    const consents = await getLatestConsents();
    if ('data_sharing' in consents) ledger = consents['data_sharing'];
  } catch {
    /* offline / no DB. Fall back to the local-first flag */
  }
  return resolveCommerceConsent(ledger, await getCommerceConsentLocal());
}

export async function grantCommerceConsent(): Promise<void> {
  await setCommerceConsentLocal(true);
  track('commerce_consent_granted');
  try {
    await recordConsent({
      type: 'data_sharing',
      granted: true,
      version: COMMERCE_COPY.consentVersion,
      consentText: `[PLACEHOLDER commerce data-sharing consent. B-PRIVACY-COPY] ${COMMERCE_COPY.consent.body}`,
    });
  } catch {
    /* best-effort until backend configured */
  }
}

export async function declineCommerceConsent(): Promise<void> {
  await setCommerceConsentLocal(false);
  track('commerce_consent_declined');
  await withdrawConsent({
    type: 'data_sharing',
    version: COMMERCE_COPY.consentVersion,
    consentText: `[PLACEHOLDER commerce data-sharing withdrawal. B-PRIVACY-COPY]`,
  });
}
