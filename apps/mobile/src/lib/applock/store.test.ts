import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearMalformedAppLockPreference,
  isRepairableAppLockPreferenceResult,
  readAppLockPreference,
  setAppLockEnabledStored,
} from './store';

const codes = {
  PRIVATE_KV_CONTENT_KEY_INVALID: 'PRIVATE_KV_CONTENT_KEY_INVALID',
  PRIVATE_KV_CONTENT_KEY_MISSING: 'PRIVATE_KV_CONTENT_KEY_MISSING',
  PRIVATE_KV_DECRYPTION_FAILED: 'PRIVATE_KV_DECRYPTION_FAILED',
  PRIVATE_KV_ENVELOPE_INVALID: 'PRIVATE_KV_ENVELOPE_INVALID',
  PRIVATE_KV_ENVELOPE_UNSUPPORTED: 'PRIVATE_KV_ENVELOPE_UNSUPPORTED',
  PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY: 'PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY',
} as const;

const mocks = vi.hoisted(() => ({
  privateKV: new Map<string, string>(),
  readError: null as Error | null,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  PRIVATE_KV_CONTENT_KEY_INVALID: 'PRIVATE_KV_CONTENT_KEY_INVALID',
  PRIVATE_KV_CONTENT_KEY_MISSING: 'PRIVATE_KV_CONTENT_KEY_MISSING',
  PRIVATE_KV_DECRYPTION_FAILED: 'PRIVATE_KV_DECRYPTION_FAILED',
  PRIVATE_KV_ENVELOPE_INVALID: 'PRIVATE_KV_ENVELOPE_INVALID',
  PRIVATE_KV_ENVELOPE_UNSUPPORTED: 'PRIVATE_KV_ENVELOPE_UNSUPPORTED',
  PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY: 'PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY',
  getPrivateItem: vi.fn(async (key: string) => {
    if (mocks.readError) throw mocks.readError;
    return mocks.privateKV.get(key) ?? null;
  }),
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      const next = updater(mocks.privateKV.get(key) ?? null);
      if (next === null) mocks.privateKV.delete(key);
      else mocks.privateKV.set(key, next);
    },
  ),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.privateKV.delete(key);
  }),
}));

const KEY = 'layerwell.appLock.enabled';
const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };
const originalDev = runtime.__DEV__;

describe('app lock preference storage', () => {
  beforeEach(() => {
    mocks.privateKV.clear();
    mocks.readError = null;
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

  it('keeps absence distinct from canonical disabled state', async () => {
    await expect(readAppLockPreference()).resolves.toEqual({ status: 'absent', enabled: false });
    mocks.privateKV.set(KEY, 'v1:0');
    await expect(readAppLockPreference()).resolves.toEqual({
      status: 'available',
      enabled: false,
      format: 'current',
    });
  });

  it('uses the Layerwell key and atomically roundtrips canonical settings', async () => {
    await setAppLockEnabledStored(true);
    expect(mocks.privateKV.get(KEY)).toBe('v1:1');
    await setAppLockEnabledStored(false);
    expect(mocks.privateKV.get(KEY)).toBe('v1:0');
  });

  it.each([
    [' true ', true],
    ['FALSE', false],
    [' 1 ', true],
    [' 0 ', false],
  ] as const)('classifies legacy %j without rewriting it', async (raw, enabled) => {
    mocks.privateKV.set(KEY, raw);
    await expect(readAppLockPreference()).resolves.toEqual({
      status: 'available',
      enabled,
      format: 'legacy',
    });
    expect(mocks.privateKV.get(KEY)).toBe(raw);
  });

  it.each(['', 'enabled', 'v1:true'])('preserves and classifies invalid value %j', async (raw) => {
    mocks.privateKV.set(KEY, raw);
    await expect(readAppLockPreference()).resolves.toEqual({
      status: 'corrupt',
      enabled: null,
      reason: 'invalid_value',
    });
    await expect(setAppLockEnabledStored(false)).rejects.toThrow(
      'APP_LOCK_PREFERENCE_NOT_WRITABLE',
    );
    expect(mocks.privateKV.get(KEY)).toBe(raw);
  });

  it('preserves and classifies future application state', async () => {
    mocks.privateKV.set(KEY, 'v2:1');
    await expect(readAppLockPreference()).resolves.toEqual({
      status: 'unsupported_version',
      enabled: null,
    });
    await expect(setAppLockEnabledStored(true)).rejects.toThrow('APP_LOCK_PREFERENCE_NOT_WRITABLE');
    expect(mocks.privateKV.get(KEY)).toBe('v2:1');
  });

  it.each([
    [
      codes.PRIVATE_KV_ENVELOPE_INVALID,
      { status: 'corrupt', enabled: null, reason: 'envelope_invalid' },
    ],
    [codes.PRIVATE_KV_ENVELOPE_UNSUPPORTED, { status: 'unsupported_version', enabled: null }],
    [
      codes.PRIVATE_KV_CONTENT_KEY_MISSING,
      { status: 'unavailable', enabled: null, reason: 'content_key_missing' },
    ],
    [
      codes.PRIVATE_KV_CONTENT_KEY_INVALID,
      { status: 'unavailable', enabled: null, reason: 'content_key_invalid' },
    ],
    [
      codes.PRIVATE_KV_DECRYPTION_FAILED,
      { status: 'unavailable', enabled: null, reason: 'decryption_failed' },
    ],
    [
      codes.PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
      { status: 'unavailable', enabled: null, reason: 'account_boundary' },
    ],
    [
      'native storage failed',
      { status: 'unavailable', enabled: null, reason: 'storage_unavailable' },
    ],
  ] as const)('maps private storage failure %s without mutation', async (code, expected) => {
    mocks.readError = new Error(code);
    await expect(readAppLockPreference()).resolves.toEqual(expected);
    expect(mocks.privateKV.size).toBe(0);
  });

  it('allows authenticated repair only for invalid app/envelope/future state', () => {
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
        status: 'unavailable',
        enabled: null,
        reason: 'decryption_failed',
      }),
    ).toBe(false);
  });

  it('removes only the Layerwell preference during explicit authenticated repair', async () => {
    mocks.privateKV.set(KEY, 'invalid');
    mocks.privateKV.set('layerwell.shelf.v1', 'shelf');
    await clearMalformedAppLockPreference();
    expect(mocks.privateKV.has(KEY)).toBe(false);
    expect(mocks.privateKV.get('layerwell.shelf.v1')).toBe('shelf');
  });

  it('supports persistent dev-only typed read failure before enabled fixtures', async () => {
    runtime.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_APP_LOCK_ENABLED = 'enabled';
    process.env.EXPO_PUBLIC_E2E_APP_LOCK_READ_FAILURE = 'always';
    await expect(readAppLockPreference()).resolves.toEqual({
      status: 'unavailable',
      enabled: null,
      reason: 'storage_unavailable',
    });
  });

  it('supports a one-shot dev-only read failure followed by a real reread', async () => {
    runtime.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_APP_LOCK_ENABLED = 'enabled';
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
  });

  it('uses the dev fixture and ignores it outside development', async () => {
    runtime.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_APP_LOCK_ENABLED = 'enabled';
    await expect(readAppLockPreference()).resolves.toMatchObject({ enabled: true });
    runtime.__DEV__ = false;
    await expect(readAppLockPreference()).resolves.toEqual({ status: 'absent', enabled: false });
  });
});
