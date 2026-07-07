import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAppLockEnabled, setAppLockEnabledStored } from './store';

const mocks = vi.hoisted(() => ({
  privateKV: new Map<string, string>(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.privateKV.get(key) ?? null),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.privateKV.set(key, value);
  }),
}));

const KEY = 'onskin.appLock.enabled';

describe('app lock preference storage', () => {
  beforeEach(() => {
    mocks.privateKV.clear();
  });

  it('roundtrips the stored app-lock setting', async () => {
    await setAppLockEnabledStored(true);
    await expect(getAppLockEnabled()).resolves.toBe(true);

    await setAppLockEnabledStored(false);
    await expect(getAppLockEnabled()).resolves.toBe(false);
  });

  it('migrates known legacy boolean strings to canonical values', async () => {
    mocks.privateKV.set(KEY, 'true');
    await expect(getAppLockEnabled()).resolves.toBe(true);
    expect(mocks.privateKV.get(KEY)).toBe('1');

    mocks.privateKV.set(KEY, 'FALSE');
    await expect(getAppLockEnabled()).resolves.toBe(false);
    expect(mocks.privateKV.get(KEY)).toBe('0');
  });

  it('clears malformed stored values to the disabled state', async () => {
    mocks.privateKV.set(KEY, 'enabled');

    await expect(getAppLockEnabled()).resolves.toBe(false);
    expect(mocks.privateKV.get(KEY)).toBe('0');
  });

  it('fails open without rewriting when private storage cannot be read', async () => {
    const privateKV = await import('@/lib/storage/privateKV');
    vi.mocked(privateKV.getPrivateItem).mockRejectedValueOnce(new Error('private kv unavailable'));

    await expect(getAppLockEnabled()).resolves.toBe(false);
    expect(mocks.privateKV.get(KEY)).toBeUndefined();
  });
});
