import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readAgeVerification, setAgeVerified } from './ageGateStore';

const mocks = vi.hoisted(() => ({
  privateKV: new Map<string, string>(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.privateKV.get(key) ?? null),
  readPrivateItem: vi.fn(async (key: string) => {
    const value = mocks.privateKV.get(key);
    return value === undefined ? { status: 'absent' } : { status: 'available', value };
  }),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.privateKV.set(key, value);
  }),
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      const next = updater(mocks.privateKV.get(key) ?? null);
      if (next === null) mocks.privateKV.delete(key);
      else mocks.privateKV.set(key, next);
    },
  ),
}));

const KEY = 'onskin.ageVerified';
const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };
const originalDev = runtime.__DEV__;

describe('age-gate local pass flag', () => {
  beforeEach(() => {
    mocks.privateKV.clear();
    vi.clearAllMocks();
    runtime.__DEV__ = true;
    delete process.env.EXPO_PUBLIC_E2E_AGE_VERIFICATION_READ_FAILURE;
    delete process.env.EXPO_PUBLIC_E2E_AGE_VERIFICATION_WRITE_FAILURE;
  });

  afterEach(() => {
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
    delete process.env.EXPO_PUBLIC_E2E_AGE_VERIFICATION_READ_FAILURE;
    delete process.env.EXPO_PUBLIC_E2E_AGE_VERIFICATION_WRITE_FAILURE;
  });

  it('stores a minimized pass flag without birth-date data', async () => {
    await setAgeVerified();

    await expect(readAgeVerification()).resolves.toEqual({
      status: 'available',
      value: true,
      format: 'current',
    });
    expect(mocks.privateKV.get(KEY)).toBe('v1:1');
  });

  it('classifies a missing flag as absent instead of verified or unreadable', async () => {
    await expect(readAgeVerification()).resolves.toEqual({ status: 'absent' });
  });

  it('classifies canonical false without rewriting it', async () => {
    mocks.privateKV.set(KEY, 'v1:0');

    await expect(readAgeVerification()).resolves.toEqual({
      status: 'available',
      value: false,
      format: 'current',
    });
    expect(mocks.privateKV.get(KEY)).toBe('v1:0');
  });

  it('reads known legacy boolean strings without repairing bytes', async () => {
    mocks.privateKV.set(KEY, 'true');
    await expect(readAgeVerification()).resolves.toEqual({
      status: 'available',
      value: true,
      format: 'legacy',
    });
    expect(mocks.privateKV.get(KEY)).toBe('true');

    mocks.privateKV.set(KEY, 'FALSE');
    await expect(readAgeVerification()).resolves.toEqual({
      status: 'available',
      value: false,
      format: 'legacy',
    });
    expect(mocks.privateKV.get(KEY)).toBe('FALSE');
  });

  it('preserves and classifies malformed stored values', async () => {
    mocks.privateKV.set(KEY, 'verified');

    await expect(readAgeVerification()).resolves.toEqual({
      status: 'corrupt',
      reason: 'invalid_value',
    });
    expect(mocks.privateKV.get(KEY)).toBe('verified');
  });

  it('preserves and classifies future application versions', async () => {
    mocks.privateKV.set(KEY, 'v2:1');

    await expect(readAgeVerification()).resolves.toEqual({ status: 'unsupported_version' });
    expect(mocks.privateKV.get(KEY)).toBe('v2:1');
  });

  it('passes private-storage failures through without rewriting', async () => {
    const privateKV = await import('@/lib/storage/privateKV');
    vi.mocked(privateKV.readPrivateItem).mockResolvedValueOnce({
      status: 'unavailable',
      reason: 'storage_unavailable',
    });

    await expect(readAgeVerification()).resolves.toEqual({
      status: 'unavailable',
      reason: 'storage_unavailable',
    });
    vi.mocked(privateKV.readPrivateItem).mockResolvedValueOnce({
      status: 'corrupt',
      reason: 'envelope_invalid',
    });
    await expect(readAgeVerification()).resolves.toEqual({
      status: 'corrupt',
      reason: 'envelope_invalid',
    });
    expect(mocks.privateKV.get(KEY)).toBeUndefined();
  });

  it.each(['verified', 'v2:1'])('refuses to overwrite unreadable value %s', async (value) => {
    mocks.privateKV.set(KEY, value);

    await expect(setAgeVerified()).rejects.toThrow();
    expect(mocks.privateKV.get(KEY)).toBe(value);
  });

  it('upgrades a valid legacy value only during an explicit write', async () => {
    mocks.privateKV.set(KEY, 'false');

    await setAgeVerified();

    expect(mocks.privateKV.get(KEY)).toBe('v1:1');
  });

  it('provides non-destructive persistent and one-shot E2E read failures', async () => {
    mocks.privateKV.set(KEY, 'v1:1');
    process.env.EXPO_PUBLIC_E2E_AGE_VERIFICATION_READ_FAILURE = 'always';

    await expect(readAgeVerification()).resolves.toEqual({
      status: 'unavailable',
      reason: 'storage_unavailable',
    });
    expect(mocks.privateKV.get(KEY)).toBe('v1:1');

    process.env.EXPO_PUBLIC_E2E_AGE_VERIFICATION_READ_FAILURE = 'once';
    await expect(readAgeVerification()).resolves.toEqual({
      status: 'unavailable',
      reason: 'storage_unavailable',
    });
    await expect(readAgeVerification()).resolves.toEqual({
      status: 'available',
      value: true,
      format: 'current',
    });
    expect(mocks.privateKV.get(KEY)).toBe('v1:1');
  });

  it('provides a non-destructive write-failure E2E fixture', async () => {
    mocks.privateKV.set(KEY, 'v1:0');
    process.env.EXPO_PUBLIC_E2E_AGE_VERIFICATION_WRITE_FAILURE = 'always';

    await expect(setAgeVerified()).rejects.toThrow('E2E_AGE_VERIFICATION_WRITE_FAILURE');
    expect(mocks.privateKV.get(KEY)).toBe('v1:0');
  });

  it('ignores every E2E failure fixture outside development', async () => {
    runtime.__DEV__ = false;
    mocks.privateKV.set(KEY, 'v1:0');
    process.env.EXPO_PUBLIC_E2E_AGE_VERIFICATION_READ_FAILURE = 'always';
    process.env.EXPO_PUBLIC_E2E_AGE_VERIFICATION_WRITE_FAILURE = 'always';

    await expect(readAgeVerification()).resolves.toEqual({
      status: 'available',
      value: false,
      format: 'current',
    });
    await setAgeVerified();
    expect(mocks.privateKV.get(KEY)).toBe('v1:1');
  });
});
