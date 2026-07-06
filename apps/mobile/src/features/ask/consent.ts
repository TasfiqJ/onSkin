import { track } from '@/lib/analytics/track';
import { getLatestConsents, recordConsent } from '@/lib/consent/consent';
import { withdrawConsent } from '@/lib/consent/withdrawal';

import { ASK_COPY } from './copy';
import { clearAskStore, getAskConsentLocal, setAskConsentLocal } from './store';

// The ask_onskin consent (docs/13 §7, D-053). A NEW, separate, explicit, revocable,
// DEFAULT-OFF consent for the CLOUD-grounded language layer. The user's question is a
// health disclosure transmitted to the cloud (MHMDA / GDPR Art. 9 attaches to the
// TRANSMISSION, not just storage), so this is never reused from any other consent and
// never default-on. NOTE: the deterministic, on-device advisor needs NO consent. This
// gates only the cloud path. Ledger-authoritative-then-local (the Slice-24 precedence)
// so a withdrawal re-locks even before the backend exists. Final copy: B-PRIVACY-COPY.

export async function isAskConsented(): Promise<boolean> {
  try {
    const consents = await getLatestConsents();
    if ('ask_onskin' in consents) return consents['ask_onskin'] === true;
  } catch {
    /* offline / no DB. Fall back to the local-first flag */
  }
  return getAskConsentLocal();
}

export async function grantAskConsent(): Promise<void> {
  await setAskConsentLocal(true);
  try {
    await recordConsent({
      type: 'ask_onskin',
      granted: true,
      version: ASK_COPY.consentVersion,
      consentText: `[PLACEHOLDER ask_onskin consent. B-PRIVACY-COPY] ${ASK_COPY.consentLedgerBody}`,
    });
    track('ask_consent_granted');
  } catch (error) {
    await setAskConsentLocal(false).catch(() => undefined);
    throw error;
  }
}

export async function revokeAskConsent(): Promise<void> {
  // Deletion-on-revocation (docs/13 §7/§10): clear the local consent flag AND the grounded-
  // turn counter; the short server-side safety-audit window is purged by an Edge Function on
  // withdrawal. No conversation content is stored locally (no transcript).
  await clearAskStore();
  await withdrawConsent({
    type: 'ask_onskin',
    version: ASK_COPY.consentVersion,
    consentText: `[PLACEHOLDER ask_onskin withdrawal. B-PRIVACY-COPY]`,
  });
  track('ask_consent_revoked');
}
