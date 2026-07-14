import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTH_DERIVED_CLEANUP_REQUIRED_KEY,
  clearAuthDerivedCleanupRequired,
  markAuthDerivedCleanupRequired,
  readAuthDerivedCleanupRequired,
} from './authDerivedCleanupRequired';

const mocks = vi.hoisted(() => ({
  getItem: vi.fn(),
  removeItem: vi.fn(),
  setItem: vi.fn(),
  storage: new Map<string, string>(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: mocks.getItem,
    removeItem: mocks.removeItem,
    setItem: mocks.setItem,
  },
}));

describe('auth-derived cleanup required control', () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.getItem.mockReset();
    mocks.removeItem.mockReset();
    mocks.setItem.mockReset();

    mocks.getItem.mockImplementation(async (key: string) => mocks.storage.get(key) ?? null);
    mocks.removeItem.mockImplementation(async (key: string) => {
      mocks.storage.delete(key);
    });
    mocks.setItem.mockImplementation(async (key: string, value: string) => {
      mocks.storage.set(key, value);
    });
  });

  it('persists exactly 1 until cleanup completion explicitly clears it', async () => {
    await expect(readAuthDerivedCleanupRequired()).resolves.toBe(false);

    await markAuthDerivedCleanupRequired();
    expect(mocks.storage.get(AUTH_DERIVED_CLEANUP_REQUIRED_KEY)).toBe('1');
    await expect(readAuthDerivedCleanupRequired()).resolves.toBe(true);

    await clearAuthDerivedCleanupRequired();
    await expect(readAuthDerivedCleanupRequired()).resolves.toBe(false);
  });

  it.each(['', '0', 'true', 'required'])('fails closed for malformed value %j', async (value) => {
    mocks.storage.set(AUTH_DERIVED_CLEANUP_REQUIRED_KEY, value);

    await expect(readAuthDerivedCleanupRequired()).rejects.toThrow(
      'AUTH_DERIVED_CLEANUP_REQUIRED_INVALID',
    );
  });

  it('fails closed when storage cannot read, commit, or clear the marker', async () => {
    mocks.getItem.mockRejectedValueOnce(new Error('read unavailable'));
    await expect(readAuthDerivedCleanupRequired()).rejects.toThrow('read unavailable');

    mocks.setItem.mockRejectedValueOnce(new Error('write unavailable'));
    await expect(markAuthDerivedCleanupRequired()).rejects.toThrow('write unavailable');
    expect(mocks.storage.has(AUTH_DERIVED_CLEANUP_REQUIRED_KEY)).toBe(false);

    mocks.storage.set(AUTH_DERIVED_CLEANUP_REQUIRED_KEY, '1');
    mocks.removeItem.mockRejectedValueOnce(new Error('clear unavailable'));
    await expect(clearAuthDerivedCleanupRequired()).rejects.toThrow('clear unavailable');
    expect(mocks.storage.get(AUTH_DERIVED_CLEANUP_REQUIRED_KEY)).toBe('1');
  });
});
