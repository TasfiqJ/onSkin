import { track } from '@/lib/analytics/track';
import {
  awaitAccountGenerationLease,
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { runSerializedConsentWorkflow } from '@/lib/consent/workflow';
import { withdrawConsent } from '@/lib/consent/withdrawal';

import { TREND_COPY } from './copy';
import { deleteTrendState, setTrendInsightsLocal } from './store';

// PHOTO-05A preserves only the cleanup half of the reserved photo_trend_insights
// consent contract (docs/12 §8, root D-072). No validated engine means no read and no
// new grant. Explicit revocation still disables the local legacy flag, deletes reserved
// derived state, and records withdrawal so an installed-base user can clean up data
// without reopening the unavailable feature.

export async function isTrendInsightsConsentedWithLease(
  lease: AccountGenerationLease,
): Promise<boolean> {
  lease.assertCurrent();
  // Legacy ledger/local grants cannot issue admission while no validated engine
  // exists. Do not read either source: even observing stale health-inference consent
  // would be unnecessary private-data work on the unavailable path.
  return false;
}

export async function isTrendInsightsConsented(): Promise<boolean> {
  return false;
}

export const TREND_ENGINE_UNAVAILABLE = 'TREND_ENGINE_UNAVAILABLE';

export async function grantTrendInsightsConsent(): Promise<void> {
  // A direct caller is not a second admission authority. Reject before local state,
  // consent ledger, network, workflow, or analytics work.
  throw new Error(TREND_ENGINE_UNAVAILABLE);
}

export async function revokeTrendInsightsConsent(): Promise<void> {
  await runAccountGenerationOperation(async (lease) => {
    await runSerializedConsentWorkflow(lease, async () => {
      await awaitAccountGenerationLease(lease, () => setTrendInsightsLocal(false));
      lease.assertCurrent();
      await awaitAccountGenerationLease(lease, deleteTrendState); // deletion-on-revocation (§8/§10)
      lease.assertCurrent();
      await awaitAccountGenerationLease(lease, () =>
        withdrawConsent({
          type: 'photo_trend_insights',
          version: TREND_COPY.consentVersion,
          consentText: `[PLACEHOLDER photo_trend_insights withdrawal. B-PRIVACY-COPY]`,
        }),
      );
      lease.assertCurrent();
      track('trend_consent_revoked');
    });
  });
}
