import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createOwnerQueryScope, queryKeys, type OwnerQueryScope } from '@/lib/query/queryKeys';

import { HEALTH_DATA_CONSENT } from './consentCopy';
import {
  declineHealthDataCollectionConsent,
  grantHealthDataCollectionConsent,
  resetHealthProfileConsumers,
} from './healthConsent';

const mocks = vi.hoisted(() => ({
  recordConsent: vi.fn(async () => {}),
  setHealthDataCollectionConsentLocal: vi.fn(async () => {}),
}));

vi.mock('@/lib/consent/consent', () => ({
  recordConsent: mocks.recordConsent,
}));

vi.mock('./healthConsentStore', () => ({
  setHealthDataCollectionConsentLocal: mocks.setHealthDataCollectionConsentLocal,
}));

describe('health-data onboarding consent', () => {
  beforeEach(() => {
    mocks.recordConsent.mockClear();
    mocks.recordConsent.mockResolvedValue(undefined);
    mocks.setHealthDataCollectionConsentLocal.mockClear();
    mocks.setHealthDataCollectionConsentLocal.mockResolvedValue(undefined);
  });

  it('records an explicit local grant before mirroring the ledger', async () => {
    await grantHealthDataCollectionConsent();

    expect(mocks.setHealthDataCollectionConsentLocal).toHaveBeenCalledWith({
      granted: true,
      version: HEALTH_DATA_CONSENT.version,
      consentText: HEALTH_DATA_CONSENT.fullText,
    });
    expect(mocks.recordConsent).toHaveBeenCalledWith({
      type: 'health_data_collection',
      granted: true,
      version: HEALTH_DATA_CONSENT.version,
      consentText: HEALTH_DATA_CONSENT.fullText,
    });
    expect(mocks.setHealthDataCollectionConsentLocal.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.recordConsent.mock.invocationCallOrder[0],
    );
  });

  it('records an explicit local decline without granting quiz access', async () => {
    await declineHealthDataCollectionConsent();

    expect(mocks.setHealthDataCollectionConsentLocal).toHaveBeenCalledWith({
      granted: false,
      version: HEALTH_DATA_CONSENT.version,
      consentText: HEALTH_DATA_CONSENT.declineText,
    });
    expect(mocks.recordConsent).toHaveBeenCalledWith({
      type: 'health_data_collection',
      granted: false,
      version: HEALTH_DATA_CONSENT.version,
      consentText: HEALTH_DATA_CONSENT.declineText,
    });
    expect(mocks.setHealthDataCollectionConsentLocal.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.recordConsent.mock.invocationCallOrder[0],
    );
  });

  it('clears cached profile consumers immediately after consent is declined', async () => {
    const queryClient = new QueryClient();
    const ownerScope = createOwnerQueryScope();
    const otherScope: OwnerQueryScope = { generation: ownerScope.generation + 1 };
    const boundary = {
      localDate: '2026-07-13',
      timeZone: 'America/Toronto|offset:240',
    };
    const currentKeys = [
      queryKeys.skinProfile(ownerScope),
      queryKeys.shelf(ownerScope, boundary),
      queryKeys.ramp(ownerScope, boundary, 'retinoid'),
    ];
    const otherKeys = [
      queryKeys.skinProfile(otherScope),
      queryKeys.shelf(otherScope, boundary),
      queryKeys.ramp(otherScope, boundary, 'retinoid'),
    ];
    for (const key of currentKeys) queryClient.setQueryData(key, { owner: 'current' });
    for (const key of otherKeys) queryClient.setQueryData(key, { owner: 'other' });

    await resetHealthProfileConsumers(queryClient, ownerScope);

    for (const key of currentKeys) expect(queryClient.getQueryData(key)).toBeUndefined();
    for (const key of otherKeys) expect(queryClient.getQueryData(key)).toEqual({ owner: 'other' });
    queryClient.clear();
  });

  it('keeps pre-account quiz entry local-first when the ledger is unavailable', async () => {
    mocks.recordConsent.mockRejectedValueOnce(new Error('ledger unavailable'));

    await expect(grantHealthDataCollectionConsent()).resolves.toBeUndefined();
    expect(mocks.setHealthDataCollectionConsentLocal).toHaveBeenCalledWith({
      granted: true,
      version: HEALTH_DATA_CONSENT.version,
      consentText: HEALTH_DATA_CONSENT.fullText,
    });
  });

  it('keeps the decline branch best-effort when the ledger is unavailable', async () => {
    mocks.recordConsent.mockRejectedValueOnce(new Error('ledger unavailable'));

    await expect(declineHealthDataCollectionConsent()).resolves.toBeUndefined();
    expect(mocks.setHealthDataCollectionConsentLocal).toHaveBeenCalledWith({
      granted: false,
      version: HEALTH_DATA_CONSENT.version,
      consentText: HEALTH_DATA_CONSENT.declineText,
    });
  });

  it('propagates local grant persistence failure so the quiz can stay locked', async () => {
    mocks.setHealthDataCollectionConsentLocal.mockRejectedValueOnce(new Error('local unavailable'));

    await expect(grantHealthDataCollectionConsent()).rejects.toThrow('local unavailable');
    expect(mocks.recordConsent).not.toHaveBeenCalled();
  });
});
