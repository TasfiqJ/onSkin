import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAgeVerified, setAgeVerified } from './ageGateStore';

const mocks = vi.hoisted(() => ({
  privateKV: new Map<string, string>(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.privateKV.get(key) ?? null),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.privateKV.set(key, value);
  }),
}));

const KEY = 'onskin.ageVerified';

describe('age-gate local pass flag', () => {
  beforeEach(() => {
    mocks.privateKV.clear();
    vi.clearAllMocks();
  });

  it('stores a minimized pass flag without birth-date data', async () => {
    await setAgeVerified();

    await expect(getAgeVerified()).resolves.toBe(true);
    expect(mocks.privateKV.get(KEY)).toBe('v1:1');
  });

  it('reads known legacy boolean strings without repairing bytes', async () => {
    mocks.privateKV.set(KEY, 'true');
    await expect(getAgeVerified()).resolves.toBe(true);
    expect(mocks.privateKV.get(KEY)).toBe('true');

    mocks.privateKV.set(KEY, 'FALSE');
    await expect(getAgeVerified()).resolves.toBe(false);
    expect(mocks.privateKV.get(KEY)).toBe('FALSE');
  });

  it('preserves malformed stored values while failing the age gate closed', async () => {
    mocks.privateKV.set(KEY, 'verified');

    await expect(getAgeVerified()).resolves.toBe(false);
    expect(mocks.privateKV.get(KEY)).toBe('verified');
  });

  it('keeps a legacy passed gate active without a repair write', async () => {
    mocks.privateKV.set(KEY, 'true');

    await expect(getAgeVerified()).resolves.toBe(true);
    expect(mocks.privateKV.get(KEY)).toBe('true');
  });

  it('fails closed for future application versions without overwriting them', async () => {
    mocks.privateKV.set(KEY, 'v2:1');

    await expect(getAgeVerified()).resolves.toBe(false);
    expect(mocks.privateKV.get(KEY)).toBe('v2:1');
  });

  it('fails closed without rewriting when private storage cannot be read', async () => {
    const privateKV = await import('@/lib/storage/privateKV');
    vi.mocked(privateKV.getPrivateItem).mockRejectedValueOnce(new Error('private kv unavailable'));

    await expect(getAgeVerified()).resolves.toBe(false);
    expect(mocks.privateKV.get(KEY)).toBeUndefined();
  });
});
