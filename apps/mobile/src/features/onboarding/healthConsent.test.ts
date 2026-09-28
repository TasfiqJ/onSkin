import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  declineHealthDataCollectionConsent,
  grantHealthDataCollectionConsent,
  resetHealthProfileConsumers,
} from './healthConsent';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const mocks = vi.hoisted(() => ({
  declineAuthoritative: vi.fn(async () => ({})),
  grantAuthoritative: vi.fn(async () => ({})),
  reconcile: vi.fn(async () => ({
    state: 'unconsented',
    processingEpoch: 0,
    localCleanupComplete: true,
  })),
}));

vi.mock('@/features/healthConsent/lifecycle', () => ({
  declineAuthoritativeInitialHealthDataConsent: mocks.declineAuthoritative,
  grantAuthoritativeHealthDataConsent: mocks.grantAuthoritative,
  reconcileHealthDataLifecycle: mocks.reconcile,
}));

describe('health-data onboarding consent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reconcile.mockResolvedValue({
      state: 'unconsented',
      processingEpoch: 0,
      localCleanupComplete: true,
    });
  });

  it('uses the authoritative lifecycle before quiz access', async () => {
    await grantHealthDataCollectionConsent(OWNER);

    expect(mocks.reconcile).toHaveBeenCalledWith(OWNER);
    expect(mocks.grantAuthoritative).toHaveBeenCalledWith({
      ownerUserId: OWNER,
      expectedProcessingEpoch: 0,
    });
  });

  it('records an initial decline through the authoritative lifecycle', async () => {
    await declineHealthDataCollectionConsent(OWNER);

    expect(mocks.reconcile).toHaveBeenCalledWith(OWNER);
    expect(mocks.declineAuthoritative).toHaveBeenCalledWith(OWNER);
  });

  it('refreshes the exact authoritative proof when the server already reports active', async () => {
    mocks.reconcile.mockResolvedValueOnce({
      state: 'active',
      processingEpoch: 4,
      localCleanupComplete: true,
    });

    await grantHealthDataCollectionConsent(OWNER);

    expect(mocks.grantAuthoritative).toHaveBeenCalledWith({
      ownerUserId: OWNER,
      expectedProcessingEpoch: 4,
    });
  });

  it('fails closed while withdrawal is not terminal', async () => {
    mocks.reconcile.mockResolvedValueOnce({
      state: 'withdrawing',
      processingEpoch: 2,
      localCleanupComplete: true,
    });

    await expect(grantHealthDataCollectionConsent(OWNER)).rejects.toThrow(
      'HEALTH_DATA_CONSENT_NOT_GRANTABLE',
    );
  });

  it('clears cached profile consumers immediately after consent is declined', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['skinProfileBits'], { pregnancySafety: 'clear' });
    queryClient.setQueryData(['shelf'], { items: ['retinoid'] });
    queryClient.setQueryData(['ramp'], { items: ['retinoid'] });

    await resetHealthProfileConsumers(queryClient);

    expect(queryClient.getQueryData(['skinProfileBits'])).toBeUndefined();
    expect(queryClient.getQueryData(['shelf'])).toBeUndefined();
    expect(queryClient.getQueryData(['ramp'])).toBeUndefined();
  });
});
