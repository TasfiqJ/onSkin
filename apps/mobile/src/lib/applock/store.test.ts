import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  APP_LOCK_PREFERENCE_INVALID,
  APP_LOCK_PREFERENCE_UNSUPPORTED_VERSION,
  clearMalformedAppLockPreference,
  getAppLockEnabled,
  isRepairableAppLockPreferenceError,
  setAppLockEnabledStored,
} from './store';

const mocks = vi.hoisted(() => ({
  privateKV: new Map<string, string>(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.privateKV.get(key) ?? null),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.privateKV.set(key, value);
  }),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.privateKV.delete(key);
  }),
  PRIVATE_KV_ENVELOPE_INVALID: 'PRIVATE_KV_ENVELOPE_INVALID',
  PRIVATE_KV_ENVELOPE_UNSUPPORTED: 'PRIVATE_KV_ENVELOPE_UNSUPPORTED',
}));

const KEY = 'layerwell.appLock.enabled';
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
    expect(mocks.privateKV.get(KEY)).toBe('v1:1');

    await setAppLockEnabledStored(false);
    await expect(getAppLockEnabled()).resolves.toBe(false);
    expect(mocks.privateKV.get(KEY)).toBe('v1:0');
  });

  it('reads known legacy boolean strings without repairing private bytes', async () => {
    mocks.privateKV.set(KEY, 'true');
    await expect(getAppLockEnabled()).resolves.toBe(true);
    expect(mocks.privateKV.get(KEY)).toBe('true');

    mocks.privateKV.set(KEY, 'FALSE');
    await expect(getAppLockEnabled()).resolves.toBe(false);
    expect(mocks.privateKV.get(KEY)).toBe('FALSE');
  });

  it('fails closed without changing malformed stored values', async () => {
    mocks.privateKV.set(KEY, 'enabled');

    await expect(getAppLockEnabled()).rejects.toThrow(APP_LOCK_PREFERENCE_INVALID);
    expect(mocks.privateKV.get(KEY)).toBe('enabled');
  });

  it('preserves an unsupported future application schema until explicit recovery', async () => {
    mocks.privateKV.set(KEY, 'v2:1');

    await expect(getAppLockEnabled()).rejects.toThrow(APP_LOCK_PREFERENCE_UNSUPPORTED_VERSION);
    expect(mocks.privateKV.get(KEY)).toBe('v2:1');
  });

  it('does not attempt a cleanup write for malformed values', async () => {
    const privateKV = await import('@/lib/storage/privateKV');
    mocks.privateKV.set(KEY, 'enabled');

    await expect(getAppLockEnabled()).rejects.toThrow(APP_LOCK_PREFERENCE_INVALID);
    expect(privateKV.setPrivateItem).not.toHaveBeenCalled();
    expect(mocks.privateKV.get(KEY)).toBe('enabled');
  });

  it('propagates private-storage read failure so the provider can fail closed', async () => {
    const privateKV = await import('@/lib/storage/privateKV');
    vi.mocked(privateKV.getPrivateItem).mockRejectedValueOnce(new Error('private kv unavailable'));

    await expect(getAppLockEnabled()).rejects.toThrow('private kv unavailable');
    expect(mocks.privateKV.get(KEY)).toBeUndefined();
  });

  it('identifies only locally repairable malformed preference failures', () => {
    expect(isRepairableAppLockPreferenceError(new Error(APP_LOCK_PREFERENCE_INVALID))).toBe(true);
    expect(
      isRepairableAppLockPreferenceError(new Error(APP_LOCK_PREFERENCE_UNSUPPORTED_VERSION)),
    ).toBe(true);
    expect(isRepairableAppLockPreferenceError(new Error('PRIVATE_KV_ENVELOPE_INVALID'))).toBe(true);
    expect(isRepairableAppLockPreferenceError(new Error('PRIVATE_KV_ENVELOPE_UNSUPPORTED'))).toBe(
      true,
    );
    expect(isRepairableAppLockPreferenceError(new Error('PRIVATE_KV_DECRYPTION_FAILED'))).toBe(
      false,
    );
    expect(isRepairableAppLockPreferenceError(new Error('PRIVATE_KV_CONTENT_KEY_MISSING'))).toBe(
      false,
    );
  });

  it('removes only the malformed app-lock preference during explicit recovery', async () => {
    mocks.privateKV.set(KEY, 'enabled');
    mocks.privateKV.set('layerwell.shelf.v1', 'shelf-ciphertext');

    await clearMalformedAppLockPreference();

    expect(mocks.privateKV.has(KEY)).toBe(false);
    expect(mocks.privateKV.get('layerwell.shelf.v1')).toBe('shelf-ciphertext');
  });

  it('uses the dev-only E2E fixture before private storage', async () => {
    runtime.__DEV__ = true;
    mocks.privateKV.set(KEY, 'v1:0');
    process.env.EXPO_PUBLIC_E2E_APP_LOCK_ENABLED = 'enabled';

    await expect(getAppLockEnabled()).resolves.toBe(true);

    process.env.EXPO_PUBLIC_E2E_APP_LOCK_ENABLED = 'disabled';
    await expect(getAppLockEnabled()).resolves.toBe(false);
    expect(mocks.privateKV.get(KEY)).toBe('v1:0');
  });

  it('ignores the E2E app-lock fixture outside dev builds', async () => {
    runtime.__DEV__ = false;
    process.env.EXPO_PUBLIC_E2E_APP_LOCK_ENABLED = 'enabled';

    await expect(getAppLockEnabled()).resolves.toBe(false);
  });
});
