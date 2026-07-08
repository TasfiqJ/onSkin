import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };
const originalDev = runtime.__DEV__;

describe('app lock preference storage', () => {
  beforeEach(() => {
    mocks.privateKV.clear();
    vi.clearAllMocks();
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
    delete process.env.EXPO_PUBLIC_E2E_APP_LOCK_ENABLED;
  });

  afterEach(() => {
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
    delete process.env.EXPO_PUBLIC_E2E_APP_LOCK_ENABLED;
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

  it('keeps a legacy enabled value active if canonical repair fails', async () => {
    const privateKV = await import('@/lib/storage/privateKV');
    mocks.privateKV.set(KEY, 'true');
    vi.mocked(privateKV.setPrivateItem).mockRejectedValueOnce(
      new Error('encrypted preference write unavailable'),
    );

    await expect(getAppLockEnabled()).resolves.toBe(true);
    expect(mocks.privateKV.get(KEY)).toBe('true');
  });

  it('still returns disabled for malformed values if cleanup repair fails', async () => {
    const privateKV = await import('@/lib/storage/privateKV');
    mocks.privateKV.set(KEY, 'enabled');
    vi.mocked(privateKV.setPrivateItem).mockRejectedValueOnce(
      new Error('encrypted preference write unavailable'),
    );

    await expect(getAppLockEnabled()).resolves.toBe(false);
    expect(mocks.privateKV.get(KEY)).toBe('enabled');
  });

  it('fails open without rewriting when private storage cannot be read', async () => {
    const privateKV = await import('@/lib/storage/privateKV');
    vi.mocked(privateKV.getPrivateItem).mockRejectedValueOnce(new Error('private kv unavailable'));

    await expect(getAppLockEnabled()).resolves.toBe(false);
    expect(mocks.privateKV.get(KEY)).toBeUndefined();
  });

  it('uses the dev-only E2E fixture before private storage', async () => {
    runtime.__DEV__ = true;
    mocks.privateKV.set(KEY, '0');
    process.env.EXPO_PUBLIC_E2E_APP_LOCK_ENABLED = 'enabled';

    await expect(getAppLockEnabled()).resolves.toBe(true);

    process.env.EXPO_PUBLIC_E2E_APP_LOCK_ENABLED = 'disabled';
    await expect(getAppLockEnabled()).resolves.toBe(false);
    expect(mocks.privateKV.get(KEY)).toBe('0');
  });

  it('ignores the E2E app-lock fixture outside dev builds', async () => {
    runtime.__DEV__ = false;
    process.env.EXPO_PUBLIC_E2E_APP_LOCK_ENABLED = 'enabled';

    await expect(getAppLockEnabled()).resolves.toBe(false);
  });
});
