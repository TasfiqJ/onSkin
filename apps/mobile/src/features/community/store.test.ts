import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearCommunityState,
  readAgeConfirmedLocal,
  readCommunityConsentLocal,
  setAgeConfirmedLocal,
  setCommunityConsentLocal,
} from './store';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  readPrivateItem: vi.fn(async (key: string) => {
    const value = mocks.storage.get(key);
    return value === undefined ? { status: 'absent' } : { status: 'available', value };
  }),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
  }),
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      const next = updater(mocks.storage.get(key) ?? null);
      if (next === null) mocks.storage.delete(key);
      else mocks.storage.set(key, next);
    },
  ),
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

  it('reads legacy consent and age grants without merging or repairing the gates', async () => {
    mocks.storage.set(CONSENT_KEY, 'true');
    mocks.storage.set(AGE_KEY, ' 1 ');

    await expect(readCommunityConsentLocal()).resolves.toEqual({
      status: 'available',
      value: true,
      format: 'legacy',
    });
    await expect(readAgeConfirmedLocal()).resolves.toEqual({
      status: 'available',
      value: true,
      format: 'legacy',
    });

    expect(mocks.storage.get(CONSENT_KEY)).toBe('true');
    expect(mocks.storage.get(AGE_KEY)).toBe(' 1 ');
  });

  it('writes compact canonical flags for consent and age confirmation', async () => {
    await setCommunityConsentLocal(false);
    await setAgeConfirmedLocal(true);

    expect(mocks.storage.get(CONSENT_KEY)).toBe('v1:0');
    expect(mocks.storage.get(AGE_KEY)).toBe('v1:1');
  });

  it('classifies and preserves malformed community gate values', async () => {
    mocks.storage.set(CONSENT_KEY, 'granted');
    mocks.storage.set(AGE_KEY, 'old-enough');

    await expect(readCommunityConsentLocal()).resolves.toEqual({
      status: 'corrupt',
      reason: 'invalid_value',
    });
    await expect(readAgeConfirmedLocal()).resolves.toEqual({
      status: 'corrupt',
      reason: 'invalid_value',
    });

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
