import { track } from '@/lib/analytics/track';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { getLatestConsents, recordConsent } from '@/lib/consent/consent';
import { isSupabaseConfigured } from '@/lib/env';
import { withdrawConsent } from '@/lib/consent/withdrawal';
import { requirePrivateBoolean } from '@/lib/storage/privateBoolean';

import { TREND_COPY } from './copy';
import { deleteTrendState, readTrendInsightsLocal, setTrendInsightsLocal } from './store';

// The photo_trend_insights consent (docs/12 §8, D-072). A NEW, separate, explicit,
// revocable, DEFAULT-OFF consent for the on-device within-person trend insight. The
// derived insight is STILL a health inference (MHMDA / GDPR Art. 9), so it is excluded
// from cloud backup and DELETED on revocation. NEVER reused from photo_capture /
// photo_cloud_backup, and never default-on: the installed base (who onboarded under the
// "no AI grades" refusal) is re-consented here, never silently enrolled. Ledger-
// authoritative-then-local (the Slice-24 precedence) so a withdrawal re-locks.

export async function isTrendInsightsConsented(): Promise<boolean> {
  return runAccountGenerationOperation(async (lease) => {
    try {
      const consents = await getLatestConsents();
      lease.assertCurrent();
      if ('photo_trend_insights' in consents) return consents['photo_trend_insights'] === true;
      if (isSupabaseConfigured) return false;
    } catch {
      lease.assertCurrent();
      /* offline / no DB. Fall back to the local-first flag */
    }
    const local = await readTrendInsightsLocal();
    lease.assertCurrent();
    return requirePrivateBoolean(local);
  });
}

export async function grantTrendInsightsConsent(): Promise<void> {
  await runAccountGenerationOperation(async (lease) => {
    await setTrendInsightsLocal(true);
    lease.assertCurrent();
    try {
      await recordConsent({
        type: 'photo_trend_insights',
        granted: true,
        version: TREND_COPY.consentVersion,
        consentText: `[PLACEHOLDER photo_trend_insights consent. B-PRIVACY-COPY] ${TREND_COPY.consentLedgerBody}`,
      });
      lease.assertCurrent();
      track('trend_insights_opted_in');
    } catch (error) {
      lease.assertCurrent();
      await setTrendInsightsLocal(false).catch(() => undefined);
      lease.assertCurrent();
      await deleteTrendState().catch(() => undefined);
      lease.assertCurrent();
      throw error;
    }
  });
}

export async function revokeTrendInsightsConsent(): Promise<void> {
  await runAccountGenerationOperation(async (lease) => {
    await setTrendInsightsLocal(false);
    lease.assertCurrent();
    await deleteTrendState(); // deletion-on-revocation (§8/§10)
    lease.assertCurrent();
    await withdrawConsent({
      type: 'photo_trend_insights',
      version: TREND_COPY.consentVersion,
      consentText: `[PLACEHOLDER photo_trend_insights withdrawal. B-PRIVACY-COPY]`,
    });
    lease.assertCurrent();
    track('trend_consent_revoked');
  });
}
