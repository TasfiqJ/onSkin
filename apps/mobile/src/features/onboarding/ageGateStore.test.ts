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
    expect(mocks.privateKV.get(KEY)).toBe('1');
  });

  it('migrates known legacy boolean strings to canonical values', async () => {
    mocks.privateKV.set(KEY, 'true');
    await expect(getAgeVerified()).resolves.toBe(true);
    expect(mocks.privateKV.get(KEY)).toBe('1');

    mocks.privateKV.set(KEY, 'FALSE');
    await expect(getAgeVerified()).resolves.toBe(false);
    expect(mocks.privateKV.get(KEY)).toBe('0');
  });

  it('rewrites malformed stored values to a failed age gate', async () => {
    mocks.privateKV.set(KEY, 'verified');

    await expect(getAgeVerified()).resolves.toBe(false);
    expect(mocks.privateKV.get(KEY)).toBe('0');
  });

  it('keeps a legacy passed gate active if canonical repair fails', async () => {
    const privateKV = await import('@/lib/storage/privateKV');
    mocks.privateKV.set(KEY, 'true');
    vi.mocked(privateKV.setPrivateItem).mockRejectedValueOnce(
      new Error('encrypted preference write unavailable'),
    );

    await expect(getAgeVerified()).resolves.toBe(true);
    expect(mocks.privateKV.get(KEY)).toBe('true');
  });

  it('still fails closed for malformed values if cleanup repair fails', async () => {
    const privateKV = await import('@/lib/storage/privateKV');
    mocks.privateKV.set(KEY, 'verified');
    vi.mocked(privateKV.setPrivateItem).mockRejectedValueOnce(
      new Error('encrypted preference write unavailable'),
    );

    await expect(getAgeVerified()).resolves.toBe(false);
    expect(mocks.privateKV.get(KEY)).toBe('verified');
  });

  it('fails closed without rewriting when private storage cannot be read', async () => {
    const privateKV = await import('@/lib/storage/privateKV');
    vi.mocked(privateKV.getPrivateItem).mockRejectedValueOnce(new Error('private kv unavailable'));

    await expect(getAgeVerified()).resolves.toBe(false);
    expect(mocks.privateKV.get(KEY)).toBeUndefined();
  });
});
