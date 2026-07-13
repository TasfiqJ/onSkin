import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearLocalDataCleanupRequired,
  claimLocalDataOwnership,
  LOCAL_DATA_CLEANUP_REQUIRED_KEY,
  LOCAL_DATA_OWNER_HASH_KEY,
  markLocalDataCleanupRequired,
  readLocalDataOwnership,
} from './sessionOwner';

const mocks = vi.hoisted(() => ({
  digest: vi.fn(async (_algorithm: string, value: string) => `sha256:${value}`),
  getThrows: false,
  storage: new Map<string, string>(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => {
      if (mocks.getThrows) throw new Error('owner marker unavailable');
      return mocks.storage.get(key) ?? null;
    }),
    removeItem: vi.fn(async (key: string) => {
      mocks.storage.delete(key);
    }),
    setItem: vi.fn(async (key: string, value: string) => {
      mocks.storage.set(key, value);
    }),
  },
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digest,
}));

describe('local account data ownership marker', () => {
  beforeEach(() => {
    mocks.digest.mockClear();
    mocks.getThrows = false;
    mocks.storage.clear();
  });

  it('distinguishes unclaimed, matching, and mismatched local data', async () => {
    await expect(readLocalDataOwnership('user-a')).resolves.toBe('unclaimed');
    await expect(readLocalDataOwnership(null)).resolves.toBe('unclaimed');

    await claimLocalDataOwnership('user-a');

    await expect(readLocalDataOwnership('user-a')).resolves.toBe('match');
    await expect(readLocalDataOwnership('user-b')).resolves.toBe('mismatch');
    await expect(readLocalDataOwnership(null)).resolves.toBe('mismatch');
  });

  it('stores only a domain-separated hash rather than the raw user id', async () => {
    await claimLocalDataOwnership('user-a');

    const stored = mocks.storage.get(LOCAL_DATA_OWNER_HASH_KEY);
    expect(stored).toBe('sha256:routinekind:local-data-owner:v1:user-a');
    expect(stored).not.toBe('user-a');
    expect(mocks.digest).toHaveBeenCalledWith('SHA-256', 'routinekind:local-data-owner:v1:user-a');
  });

  it('keeps a failed partial cleanup mismatched until the cleanup marker clears', async () => {
    await claimLocalDataOwnership('user-a');
    await markLocalDataCleanupRequired();
    mocks.storage.delete(LOCAL_DATA_OWNER_HASH_KEY);

    expect(mocks.storage.get(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe('v1:required');
    await expect(readLocalDataOwnership('user-b')).resolves.toBe('mismatch');
    await expect(readLocalDataOwnership(null)).resolves.toBe('mismatch');

    await clearLocalDataCleanupRequired();
    await expect(readLocalDataOwnership('user-b')).resolves.toBe('unclaimed');
  });

  it.each(['1', '', '0', 'corrupt', 'v2:required'])(
    'treats every non-null cleanup marker (%s) as cleanup-required',
    async (marker) => {
      await claimLocalDataOwnership('user-a');
      mocks.storage.set(LOCAL_DATA_CLEANUP_REQUIRED_KEY, marker);

      await expect(readLocalDataOwnership('user-a')).resolves.toBe('mismatch');

      await clearLocalDataCleanupRequired();
      await expect(readLocalDataOwnership('user-a')).resolves.toBe('match');
    },
  );

  it.each(['', 'not-a-hash', 'future:owner-hash'])(
    'treats a non-null nonmatching owner marker (%s) as claimed by another owner',
    async (marker) => {
      mocks.storage.set(LOCAL_DATA_OWNER_HASH_KEY, marker);

      await expect(readLocalDataOwnership('user-a')).resolves.toBe('mismatch');
      await expect(readLocalDataOwnership(null)).resolves.toBe('mismatch');
    },
  );

  it('propagates marker storage unavailability so the session boundary stays closed', async () => {
    mocks.getThrows = true;

    await expect(readLocalDataOwnership('user-a')).rejects.toThrow('owner marker unavailable');
  });
});
