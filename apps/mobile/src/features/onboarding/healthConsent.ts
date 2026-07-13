import type { QueryClient } from '@tanstack/react-query';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { recordConsent } from '@/lib/consent/consent';
import {
  isOwnerQueryScopeCurrent,
  ownerQueryPrefixes,
  type OwnerQueryScope,
} from '@/lib/query/queryKeys';

import { HEALTH_DATA_CONSENT } from './consentCopy';
import { setHealthDataCollectionConsentLocal } from './healthConsentStore';

type RecordConsent = typeof recordConsent;

type HealthConsentDeps = {
  recordConsent: RecordConsent;
};

const defaultDeps: HealthConsentDeps = { recordConsent };

let healthConsentMutationTail: Promise<void> = Promise.resolve();

function runHealthConsentMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = healthConsentMutationTail.then(operation, operation);
  healthConsentMutationTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function resetHealthProfileConsumers(
  queryClient: QueryClient,
  ownerScope: OwnerQueryScope,
): Promise<void> {
  if (!isOwnerQueryScopeCurrent(ownerScope)) return;
  await Promise.all([
    queryClient.resetQueries({ queryKey: ownerQueryPrefixes.skinProfile(ownerScope) }),
    queryClient.resetQueries({ queryKey: ownerQueryPrefixes.shelf(ownerScope) }),
    queryClient.resetQueries({ queryKey: ownerQueryPrefixes.ramp(ownerScope) }),
  ]);
}

export async function grantHealthDataCollectionConsent(
  deps: HealthConsentDeps = defaultDeps,
): Promise<void> {
  await runAccountGenerationOperation(async (lease) => {
    await runHealthConsentMutation(async () => {
      lease.assertCurrent();
      await setHealthDataCollectionConsentLocal({
        granted: true,
        version: HEALTH_DATA_CONSENT.version,
        consentText: HEALTH_DATA_CONSENT.fullText,
      });
      lease.assertCurrent();
      try {
        await deps.recordConsent({
          type: 'health_data_collection',
          granted: true,
          version: HEALTH_DATA_CONSENT.version,
          consentText: HEALTH_DATA_CONSENT.fullText,
        });
        lease.assertCurrent();
      } catch {
        lease.assertCurrent();
        /* offline / no anonymous session. Keep the local-first consent proof. */
      }
    });
  });
}

export async function declineHealthDataCollectionConsent(
  deps: HealthConsentDeps = defaultDeps,
): Promise<void> {
  await runAccountGenerationOperation(async (lease) => {
    await runHealthConsentMutation(async () => {
      lease.assertCurrent();
      await setHealthDataCollectionConsentLocal({
        granted: false,
        version: HEALTH_DATA_CONSENT.version,
        consentText: HEALTH_DATA_CONSENT.declineText,
      });
      lease.assertCurrent();
      try {
        await deps.recordConsent({
          type: 'health_data_collection',
          granted: false,
          version: HEALTH_DATA_CONSENT.version,
          consentText: HEALTH_DATA_CONSENT.declineText,
        });
        lease.assertCurrent();
      } catch {
        lease.assertCurrent();
        /* Declines are recorded locally first; ledger decline is best-effort pre-account. */
      }
    });
  });
}
