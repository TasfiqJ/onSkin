import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearCommerceState, getCommerceConsentLocal, setCommerceConsentLocal } from './store';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => '00000000-0000-4000-8000-000000000000'),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
  }),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
}));

const CONSENT_KEY = 'onskin.commerceConsent.v1';

describe('commerce consent store', () => {
  beforeEach(() => {
    mocks.storage.clear();
  });

  it('reads legacy commerce consent grants without repair and writes versioned flags', async () => {
    mocks.storage.set(CONSENT_KEY, ' true ');

    await expect(getCommerceConsentLocal()).resolves.toBe(true);
    expect(mocks.storage.get(CONSENT_KEY)).toBe(' true ');

    await setCommerceConsentLocal(false);
    expect(mocks.storage.get(CONSENT_KEY)).toBe('v1:0');
  });

  it('fails closed and preserves malformed commerce consent values', async () => {
    mocks.storage.set(CONSENT_KEY, 'allowed');

    await expect(getCommerceConsentLocal()).resolves.toBe(false);

    expect(mocks.storage.get(CONSENT_KEY)).toBe('allowed');
  });

  it('clears the local commerce consent gate', async () => {
    mocks.storage.set(CONSENT_KEY, '1');

    await clearCommerceState();

    expect(mocks.storage.has(CONSENT_KEY)).toBe(false);
  });
});
