import { track } from '@/lib/analytics/track';
import {
  awaitAccountGenerationLease,
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { recordConsent } from '@/lib/consent/consent';
import { isSupabaseConfigured } from '@/lib/env';
import {
  runRequestWithLease,
  supabaseRequestFailure,
} from '@/lib/network/requestPolicy';
import { withdrawConsent } from '@/lib/consent/withdrawal';
import { requirePrivateBoolean } from '@/lib/storage/privateBoolean';
import { supabase } from '@/lib/supabase/client';

import { TREND_COPY } from './copy';
import { deleteTrendState, readTrendInsightsLocal, setTrendInsightsLocal } from './store';

// The photo_trend_insights consent (docs/12 §8, D-072). A NEW, separate, explicit,
// revocable, DEFAULT-OFF consent for the on-device within-person trend insight. The
// derived insight is STILL a health inference (MHMDA / GDPR Art. 9), so it is excluded
// from cloud backup and DELETED on revocation. NEVER reused from photo_capture /
// photo_cloud_backup, and never default-on: the installed base (who onboarded under the
// "no AI grades" refusal) is re-consented here, never silently enrolled. Ledger-
// authoritative-then-local (the Slice-24 precedence) so a withdrawal re-locks.

export async function isTrendInsightsConsentedWithLease(
  lease: AccountGenerationLease,
): Promise<boolean> {
  lease.assertCurrent();
  if (isSupabaseConfigured) {
    try {
      const data = await runRequestWithLease(
        lease,
        {
          endpoint: 'trend_consent',
          deadlineMs: 8_000,
          idempotent: true,
          maxAttempts: 2,
          maxResponseBytes: 64 * 1024,
        },
        async ({ signal }) => {
          const response = await supabase
            .from('consents')
            .select('granted')
            .eq('consent_type', 'photo_trend_insights')
            .order('granted_at', { ascending: false })
            .limit(1)
            .abortSignal(signal)
            .maybeSingle();
          if (response.error) {
            throw supabaseRequestFailure(response.error, response.status);
          }
          return response.data;
        },
      );
      lease.assertCurrent();
      // A reachable ledger is authoritative. Missing is the default-off state;
      // never reuse a stale local grant for an installed-base user.
      return data?.granted === true;
    } catch {
      // Account-generation cancellation is asserted, not collapsed into the
      // local fallback. Ordinary offline/server failure remains local-first.
      lease.assertCurrent();
      /* offline / no DB. Fall back to the local-first flag */
    }
  }

  const local = await awaitAccountGenerationLease(lease, () => readTrendInsightsLocal());
  lease.assertCurrent();
  return requirePrivateBoolean(local);
}

export function isTrendInsightsConsented(): Promise<boolean> {
  return runAccountGenerationOperation(isTrendInsightsConsentedWithLease);
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
