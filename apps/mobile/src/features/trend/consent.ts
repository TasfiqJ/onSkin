import { track } from '@/lib/analytics/track';
import { getLatestConsents, recordConsent } from '@/lib/consent/consent';
import { withdrawConsent } from '@/lib/consent/withdrawal';

import { TREND_COPY } from './copy';
import { deleteTrendState, getTrendInsightsLocal, setTrendInsightsLocal } from './store';

// The photo_trend_insights consent (docs/12 §8, D-072). A NEW, separate, explicit,
// revocable, DEFAULT-OFF consent for the on-device within-person trend insight. The
// derived insight is STILL a health inference (MHMDA / GDPR Art. 9), so it is excluded
// from cloud backup and DELETED on revocation. NEVER reused from photo_capture /
// photo_cloud_backup, and never default-on: the installed base (who onboarded under the
// "no AI grades" refusal) is re-consented here, never silently enrolled. Ledger-
// authoritative-then-local (the Slice-24 precedence) so a withdrawal re-locks.

export async function isTrendInsightsConsented(): Promise<boolean> {
  try {
    const consents = await getLatestConsents();
    if ('photo_trend_insights' in consents) return consents['photo_trend_insights'] === true;
  } catch {
    /* offline / no DB. Fall back to the local-first flag */
  }
  return getTrendInsightsLocal();
}

export async function grantTrendInsightsConsent(): Promise<void> {
  await setTrendInsightsLocal(true);
  track('trend_insights_opted_in');
  try {
    await recordConsent({
      type: 'photo_trend_insights',
      granted: true,
      version: TREND_COPY.consentVersion,
      consentText: `[PLACEHOLDER photo_trend_insights consent. B-PRIVACY-COPY] ${TREND_COPY.consentLedgerBody}`,
    });
  } catch {
    /* best-effort until backend configured */
  }
}

export async function revokeTrendInsightsConsent(): Promise<void> {
  await setTrendInsightsLocal(false);
  await deleteTrendState(); // deletion-on-revocation (§8/§10)
  await withdrawConsent({
    type: 'photo_trend_insights',
    version: TREND_COPY.consentVersion,
    consentText: `[PLACEHOLDER photo_trend_insights withdrawal. B-PRIVACY-COPY]`,
  });
  track('trend_consent_revoked');
}
