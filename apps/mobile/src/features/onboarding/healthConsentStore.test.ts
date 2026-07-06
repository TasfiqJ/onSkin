import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearHealthDataCollectionConsentLocal,
  getHealthDataCollectionConsentLocal,
  setHealthDataCollectionConsentLocal,
} from './healthConsentStore';

const mocks = vi.hoisted(() => ({
  privateStore: new Map<string, string>(),
  digestStringAsync: vi.fn(async (_algorithm: string, value: string) => `sha256:${value}`),
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digestStringAsync,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.privateStore.get(key) ?? null),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.privateStore.delete(key);
  }),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.privateStore.set(key, value);
  }),
}));

describe('health-data local consent store', () => {
  beforeEach(() => {
    mocks.privateStore.clear();
    mocks.digestStringAsync.mockClear();
  });

  it('stores the explicit choice with version and consent-text hash', async () => {
    await setHealthDataCollectionConsentLocal({
      granted: true,
      version: 'draft-v1',
      consentText: 'shown consent text',
    });

    const record = await getHealthDataCollectionConsentLocal();

    expect(record).toMatchObject({
      type: 'health_data_collection',
      granted: true,
      version: 'draft-v1',
      consentTextHash: 'sha256:shown consent text',
    });
    expect(record?.recordedAt).toEqual(expect.any(String));
  });

  it('ignores malformed local consent records', async () => {
    mocks.privateStore.set(
      'onskin.healthDataCollectionConsent.v1',
      JSON.stringify({ granted: true }),
    );

    await expect(getHealthDataCollectionConsentLocal()).resolves.toBeNull();
  });

  it('clears the local consent record for test and reset flows', async () => {
    await setHealthDataCollectionConsentLocal({
      granted: false,
      version: 'draft-v1',
      consentText: 'decline text',
    });

    await clearHealthDataCollectionConsentLocal();

    await expect(getHealthDataCollectionConsentLocal()).resolves.toBeNull();
  });
});
