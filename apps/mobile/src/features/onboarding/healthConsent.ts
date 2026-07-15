import type { QueryClient } from '@tanstack/react-query';

import {
  declineAuthoritativeInitialHealthDataConsent,
  grantAuthoritativeHealthDataConsent,
  reconcileHealthDataLifecycle,
} from '@/features/healthConsent/lifecycle';

export async function resetHealthProfileConsumers(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.resetQueries({ queryKey: ['skinProfileBits'] }),
    queryClient.resetQueries({ queryKey: ['shelf'] }),
    queryClient.resetQueries({ queryKey: ['ramp'] }),
  ]);
}

export async function grantHealthDataCollectionConsent(
  ownerUserId: string,
) {
  const lifecycle = await reconcileHealthDataLifecycle(ownerUserId);
  if (lifecycle.state === 'active') {
    return grantAuthoritativeHealthDataConsent({
      ownerUserId,
      expectedProcessingEpoch: lifecycle.processingEpoch,
    });
  }
  if (
    lifecycle.state !== 'unconsented' &&
    !(lifecycle.state === 'withdrawn' && lifecycle.localCleanupComplete)
  ) {
    throw new Error('HEALTH_DATA_CONSENT_NOT_GRANTABLE');
  }
  return grantAuthoritativeHealthDataConsent({
    ownerUserId,
    expectedProcessingEpoch: lifecycle.processingEpoch,
  });
}

export async function declineHealthDataCollectionConsent(
  ownerUserId: string,
): Promise<void> {
  const lifecycle = await reconcileHealthDataLifecycle(ownerUserId);
  if (lifecycle.state !== 'unconsented') {
    throw new Error('HEALTH_DATA_CONSENT_DECLINE_NOT_ALLOWED');
  }
  await declineAuthoritativeInitialHealthDataConsent(ownerUserId);
}
