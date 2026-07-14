import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrivateKVReadResult } from '@/lib/storage/privateKV';

import {
  clearMalformedAppLockPreference,
  isRepairableAppLockPreferenceResult,
  readAppLockPreference,
  setAppLockEnabledStored,
} from './store';

const mocks = vi.hoisted(() => ({
  privateKV: new Map<string, string>(),
  readOverride: null as PrivateKVReadResult | null,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.privateKV.get(key) ?? null),
  readPrivateItem: vi.fn(async (key: string) => {
    if (mocks.readOverride) return mocks.readOverride;
    const value = mocks.privateKV.get(key);
    return value === undefined ? { status: 'absent' } : { status: 'available', value };
  }),
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      const next = updater(mocks.privateKV.get(key) ?? null);
      if (next === null) mocks.privateKV.delete(key);
      else mocks.privateKV.set(key, next);
    },
  ),
  removePrivateItemsForAuthorizedReset: vi.fn(async (keys: readonly string[], _reason: string) => {
    for (const key of keys) mocks.privateKV.delete(key);
  }),
}));

const KEY = 'onskin.appLock.enabled';
const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };
const originalDev = runtime.__DEV__;

describe('app lock preference storage', () => {
  beforeEach(() => {
    mocks.privateKV.clear();
    mocks.readOverride = null;
    vi.clearAllMocks();
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
    delete process.env.EXPO_PUBLIC_E2E_APP_LOCK_ENABLED;
    delete process.env.EXPO_PUBLIC_E2E_APP_LOCK_READ_FAILURE;
  });

  afterEach(() => {
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
    delete process.env.EXPO_PUBLIC_E2E_APP_LOCK_ENABLED;
    delete process.env.EXPO_PUBLIC_E2E_APP_LOCK_READ_FAILURE;
  });

  it('keeps absence distinct from an available disabled preference', async () => {
    await expect(readAppLockPreference()).resolves.toEqual({
      status: 'absent',
      enabled: false,
    });

    mocks.privateKV.set(KEY, 'v1:0');
    await expect(readAppLockPreference()).resolves.toEqual({
      status: 'available',
      enabled: false,
      format: 'current',
    });
  });

  it('roundtrips canonical app-lock settings through the atomic boolean writer', async () => {
    const privateKV = await import('@/lib/storage/privateKV');

    await setAppLockEnabledStored(true);
    await expect(readAppLockPreference()).resolves.toEqual({
      status: 'available',
      enabled: true,
      format: 'current',
    });
    expect(mocks.privateKV.get(KEY)).toBe('v1:1');

    await setAppLockEnabledStored(false);
    await expect(readAppLockPreference()).resolves.toEqual({
      status: 'available',
      enabled: false,
      format: 'current',
    });
    expect(mocks.privateKV.get(KEY)).toBe('v1:0');
    expect(privateKV.updatePrivateItem).toHaveBeenCalledTimes(2);
  });

  it.each([
    [' true ', true],
    ['FALSE', false],
    [' 1 ', true],
    [' 0 ', false],
  ] as const)('reads legacy value %j without repairing private bytes', async (raw, enabled) => {
    const privateKV = await import('@/lib/storage/privateKV');
    mocks.privateKV.set(KEY, raw);

    await expect(readAppLockPreference()).resolves.toEqual({
      status: 'available',
      enabled,
      format: 'legacy',
    });

    expect(mocks.privateKV.get(KEY)).toBe(raw);
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
  });

  it.each(['enabled', '', 'v1:true', 'v0:1', 'V1:1'])(
    'classifies malformed value %j without changing it',
    async (raw) => {
      const privateKV = await import('@/lib/storage/privateKV');
      mocks.privateKV.set(KEY, raw);

      await expect(readAppLockPreference()).resolves.toEqual({
        status: 'corrupt',
        enabled: null,
        reason: 'invalid_value',
      });

      expect(mocks.privateKV.get(KEY)).toBe(raw);
      expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    },
  );

  it.each(['v2:1', 'v999999999999999999999999:0'])(
    'preserves unsupported future value %s',
    async (raw) => {
      const privateKV = await import('@/lib/storage/privateKV');
      mocks.privateKV.set(KEY, raw);

      await expect(readAppLockPreference()).resolves.toEqual({
        status: 'unsupported_version',
        enabled: null,
      });

      expect(mocks.privateKV.get(KEY)).toBe(raw);
      expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      { status: 'unavailable', reason: 'content_key_storage_unavailable' },
      {
        status: 'unavailable',
        enabled: null,
        reason: 'content_key_storage_unavailable',
      },
    ],
    [
      { status: 'corrupt', reason: 'envelope_invalid' },
      { status: 'corrupt', enabled: null, reason: 'envelope_invalid' },
    ],
    [
      { status: 'corrupt', reason: 'decryption_failed' },
      { status: 'corrupt', enabled: null, reason: 'decryption_failed' },
    ],
    [{ status: 'unsupported_version' }, { status: 'unsupported_version', enabled: null }],
  ] as const)('preserves typed private-storage result %j', async (source, expected) => {
    mocks.readOverride = source;

    await expect(readAppLockPreference()).resolves.toEqual(expected);
  });

  it('limits authenticated setting reset to malformed or unsupported preference bytes', () => {
    expect(
      isRepairableAppLockPreferenceResult({
        status: 'corrupt',
        enabled: null,
        reason: 'invalid_value',
      }),
    ).toBe(true);
    expect(
      isRepairableAppLockPreferenceResult({
        status: 'corrupt',
        enabled: null,
        reason: 'envelope_invalid',
      }),
    ).toBe(true);
    expect(
      isRepairableAppLockPreferenceResult({
        status: 'unsupported_version',
        enabled: null,
      }),
    ).toBe(true);

    expect(isRepairableAppLockPreferenceResult({ status: 'absent', enabled: false })).toBe(false);
    expect(
      isRepairableAppLockPreferenceResult({
        status: 'available',
        enabled: true,
        format: 'current',
      }),
    ).toBe(false);
    expect(
      isRepairableAppLockPreferenceResult({
        status: 'corrupt',
        enabled: null,
        reason: 'content_key_invalid',
      }),
    ).toBe(false);
    expect(
      isRepairableAppLockPreferenceResult({
        status: 'corrupt',
        enabled: null,
        reason: 'decryption_failed',
      }),
    ).toBe(false);
    expect(
      isRepairableAppLockPreferenceResult({
        status: 'unavailable',
        enabled: null,
        reason: 'content_key_missing',
      }),
    ).toBe(false);
    expect(
      isRepairableAppLockPreferenceResult({
        status: 'unavailable',
        enabled: null,
        reason: 'content_key_storage_unavailable',
      }),
    ).toBe(false);
    expect(
      isRepairableAppLockPreferenceResult({
        status: 'unavailable',
        enabled: null,
        reason: 'storage_unavailable',
      }),
    ).toBe(false);
  });

  it.each(['enabled', 'v1:true', 'v2:1'])(
    'refuses to overwrite corrupt or future application value %s',
    async (raw) => {
      mocks.privateKV.set(KEY, raw);

      await expect(setAppLockEnabledStored(false)).rejects.toThrow();
      expect(mocks.privateKV.get(KEY)).toBe(raw);
    },
  );

  it('canonically upgrades a valid legacy value only during an explicit write', async () => {
    mocks.privateKV.set(KEY, ' TRUE ');

    await expect(readAppLockPreference()).resolves.toMatchObject({
      status: 'available',
      enabled: true,
      format: 'legacy',
    });
    expect(mocks.privateKV.get(KEY)).toBe(' TRUE ');

    await setAppLockEnabledStored(false);
    expect(mocks.privateKV.get(KEY)).toBe('v1:0');
  });

  it('removes only the malformed app-lock preference during explicit recovery', async () => {
    const privateKV = await import('@/lib/storage/privateKV');
    mocks.privateKV.set(KEY, 'enabled');
    mocks.privateKV.set('onskin.shelf.v1', 'shelf-ciphertext');

    await clearMalformedAppLockPreference();

    expect(mocks.privateKV.has(KEY)).toBe(false);
    expect(mocks.privateKV.get('onskin.shelf.v1')).toBe('shelf-ciphertext');
    expect(privateKV.removePrivateItemsForAuthorizedReset).toHaveBeenCalledWith(
      [KEY],
      'device_authenticated_app_lock_repair',
    );
  });

  it('uses the dev-only enabled fixture without touching private storage', async () => {
    const privateKV = await import('@/lib/storage/privateKV');
    runtime.__DEV__ = true;
    mocks.privateKV.set(KEY, 'v1:0');
    process.env.EXPO_PUBLIC_E2E_APP_LOCK_ENABLED = 'enabled';

    await expect(readAppLockPreference()).resolves.toEqual({
      status: 'available',
      enabled: true,
      format: 'current',
    });

    process.env.EXPO_PUBLIC_E2E_APP_LOCK_ENABLED = 'disabled';
    await expect(readAppLockPreference()).resolves.toEqual({
      status: 'available',
      enabled: false,
      format: 'current',
    });
    expect(mocks.privateKV.get(KEY)).toBe('v1:0');
    expect(privateKV.readPrivateItem).not.toHaveBeenCalled();
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('supports persistent and one-shot dev-only read failures before enabled fixtures', async () => {
    const privateKV = await import('@/lib/storage/privateKV');
    runtime.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_APP_LOCK_ENABLED = 'enabled';
    process.env.EXPO_PUBLIC_E2E_APP_LOCK_READ_FAILURE = 'always';

    await expect(readAppLockPreference()).resolves.toEqual({
      status: 'unavailable',
      enabled: null,
      reason: 'storage_unavailable',
    });
    await expect(readAppLockPreference()).resolves.toEqual({
      status: 'unavailable',
      enabled: null,
      reason: 'storage_unavailable',
    });
    expect(privateKV.readPrivateItem).not.toHaveBeenCalled();

    process.env.EXPO_PUBLIC_E2E_APP_LOCK_READ_FAILURE = 'once';
    await expect(readAppLockPreference()).resolves.toEqual({
      status: 'unavailable',
      enabled: null,
      reason: 'storage_unavailable',
    });
    await expect(readAppLockPreference()).resolves.toEqual({
      status: 'available',
      enabled: true,
      format: 'current',
    });
    expect(privateKV.readPrivateItem).not.toHaveBeenCalled();
  });

  it('ignores every E2E fixture outside development builds', async () => {
    const privateKV = await import('@/lib/storage/privateKV');
    runtime.__DEV__ = false;
    process.env.EXPO_PUBLIC_E2E_APP_LOCK_ENABLED = 'enabled';
    process.env.EXPO_PUBLIC_E2E_APP_LOCK_READ_FAILURE = 'always';

    await expect(readAppLockPreference()).resolves.toEqual({
      status: 'absent',
      enabled: false,
    });
    expect(privateKV.readPrivateItem).toHaveBeenCalledWith(KEY);
  });
});
