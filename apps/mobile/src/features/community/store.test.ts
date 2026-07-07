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

const CONSENT_KEY = 'onskin.communityConsent.v1';
const AGE_KEY = 'onskin.communityAge16.v1';

describe('community consent store', () => {
  beforeEach(() => {
    mocks.storage.clear();
  });

  it('normalizes legacy consent and age grants without merging the two gates', async () => {
    mocks.storage.set(CONSENT_KEY, 'true');
    mocks.storage.set(AGE_KEY, ' 1 ');

    await expect(getCommunityConsentLocal()).resolves.toBe(true);
    await expect(getAgeConfirmedLocal()).resolves.toBe(true);

    expect(mocks.storage.get(CONSENT_KEY)).toBe('1');
    expect(mocks.storage.get(AGE_KEY)).toBe('1');
  });

  it('writes compact canonical flags for consent and age confirmation', async () => {
    await setCommunityConsentLocal(false);
    await setAgeConfirmedLocal(true);

    expect(mocks.storage.get(CONSENT_KEY)).toBe('0');
    expect(mocks.storage.get(AGE_KEY)).toBe('1');
  });

  it('fails closed and repairs malformed community gate values', async () => {
    mocks.storage.set(CONSENT_KEY, 'granted');
    mocks.storage.set(AGE_KEY, 'old-enough');

    await expect(getCommunityConsentLocal()).resolves.toBe(false);
    await expect(getAgeConfirmedLocal()).resolves.toBe(false);

    expect(mocks.storage.get(CONSENT_KEY)).toBe('0');
    expect(mocks.storage.get(AGE_KEY)).toBe('0');
  });

  it('clears both local community gates', async () => {
    mocks.storage.set(CONSENT_KEY, '1');
    mocks.storage.set(AGE_KEY, '1');

    await clearCommunityState();

    expect(mocks.storage.has(CONSENT_KEY)).toBe(false);
    expect(mocks.storage.has(AGE_KEY)).toBe(false);
  });
});
