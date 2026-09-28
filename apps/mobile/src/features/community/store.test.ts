import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearCommunityState,
  getAgeConfirmedLocal,
  getCommunityConsentLocal,
  setAgeConfirmedLocal,
  setCommunityConsentLocal,
} from './store';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
  }),
  multiRemovePrivateItems: vi.fn(async (keys: readonly string[]) => {
    for (const key of keys) mocks.storage.delete(key);
  }),
}));

const CONSENT_KEY = 'layerwell.communityConsent.v1';
const AGE_KEY = 'layerwell.communityAge16.v1';

describe('community consent store', () => {
  beforeEach(() => {
    mocks.storage.clear();
  });

  it('reads legacy consent and age grants without merging or repairing the gates', async () => {
    mocks.storage.set(CONSENT_KEY, 'true');
    mocks.storage.set(AGE_KEY, ' 1 ');

    await expect(getCommunityConsentLocal()).resolves.toBe(true);
    await expect(getAgeConfirmedLocal()).resolves.toBe(true);

    expect(mocks.storage.get(CONSENT_KEY)).toBe('true');
    expect(mocks.storage.get(AGE_KEY)).toBe(' 1 ');
  });

  it('writes compact canonical flags for consent and age confirmation', async () => {
    await setCommunityConsentLocal(false);
    await setAgeConfirmedLocal(true);

    expect(mocks.storage.get(CONSENT_KEY)).toBe('v1:0');
    expect(mocks.storage.get(AGE_KEY)).toBe('v1:1');
  });

  it('fails closed and preserves malformed community gate values', async () => {
    mocks.storage.set(CONSENT_KEY, 'granted');
    mocks.storage.set(AGE_KEY, 'old-enough');

    await expect(getCommunityConsentLocal()).resolves.toBe(false);
    await expect(getAgeConfirmedLocal()).resolves.toBe(false);

    expect(mocks.storage.get(CONSENT_KEY)).toBe('granted');
    expect(mocks.storage.get(AGE_KEY)).toBe('old-enough');
  });

  it('clears both local community gates', async () => {
    mocks.storage.set(CONSENT_KEY, '1');
    mocks.storage.set(AGE_KEY, '1');

    await clearCommunityState();

    expect(mocks.storage.has(CONSENT_KEY)).toBe(false);
    expect(mocks.storage.has(AGE_KEY)).toBe(false);
  });
});
