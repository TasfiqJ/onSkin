import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  APPLE_CREDENTIAL_QUARANTINE_KEY,
  clearAppleCredentialQuarantine,
  isAppleCredentialQuarantined,
  markAppleCredentialQuarantined,
} from './appleCredentialQuarantine';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
    removeItem: vi.fn(async (key: string) => {
      mocks.storage.delete(key);
    }),
    setItem: vi.fn(async (key: string, value: string) => {
      mocks.storage.set(key, value);
    }),
  },
}));

describe('Apple credential quarantine control', () => {
  beforeEach(() => {
    mocks.storage.clear();
  });

  it('persists fail-closed state until a fresh authenticated boundary clears it', async () => {
    await expect(isAppleCredentialQuarantined()).resolves.toBe(false);

    await markAppleCredentialQuarantined();
    expect(mocks.storage.get(APPLE_CREDENTIAL_QUARANTINE_KEY)).toBe('1');
    await expect(isAppleCredentialQuarantined()).resolves.toBe(true);

    await clearAppleCredentialQuarantine();
    await expect(isAppleCredentialQuarantined()).resolves.toBe(false);
  });

  it('treats every malformed non-null control value as an active quarantine', async () => {
    mocks.storage.set(APPLE_CREDENTIAL_QUARANTINE_KEY, 'true');
    await expect(isAppleCredentialQuarantined()).resolves.toBe(true);

    mocks.storage.set(APPLE_CREDENTIAL_QUARANTINE_KEY, '');
    await expect(isAppleCredentialQuarantined()).resolves.toBe(true);
  });
});
