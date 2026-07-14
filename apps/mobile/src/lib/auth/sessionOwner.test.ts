import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearLocalDataCleanupRequired,
  claimLocalDataOwnership,
  LOCAL_DATA_CLEANUP_REQUIRED_KEY,
  LOCAL_DATA_OWNER_HASH_KEY,
  LOCAL_DATA_RETAINED_OWNER_HASH_KEY,
  LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY,
  markLocalDataCleanupRequired,
  preserveLocalDataForForcedSignOut,
  quarantineUnclaimedLocalDataForSignedOutRestore,
  readLocalDataOwnership,
  retainLocalDataOwnerForSignedOutRestore,
} from './sessionOwner';

const mocks = vi.hoisted(() => {
  const storage = new Map<string, string>();
  return {
    digest: vi.fn(async (_algorithm: string, value: string) =>
      (value.endsWith('user-a') ? 'a1' : 'b2').repeat(32),
    ),
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    multiGet: vi.fn(async (keys: readonly string[]) =>
      keys.map((key) => [key, storage.get(key) ?? null] as [string, string | null]),
    ),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    storage,
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: mocks.getItem,
    multiGet: mocks.multiGet,
    removeItem: mocks.removeItem,
    setItem: mocks.setItem,
  },
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digest,
}));

describe('local account data ownership marker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getItem.mockImplementation(async (key: string) => mocks.storage.get(key) ?? null);
    mocks.multiGet.mockImplementation(async (keys: readonly string[]) =>
      keys.map((key) => [key, mocks.storage.get(key) ?? null] as [string, string | null]),
    );
    mocks.removeItem.mockImplementation(async (key: string) => {
      mocks.storage.delete(key);
    });
    mocks.setItem.mockImplementation(async (key: string, value: string) => {
      mocks.storage.set(key, value);
    });
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
    expect(stored).toBe('a1'.repeat(32));
    expect(stored).not.toBe('user-a');
    expect(mocks.digest).toHaveBeenCalledWith('SHA-256', 'routinekind:local-data-owner:v1:user-a');
  });

  it('durably preserves signed-out data until the exact owner reauthenticates', async () => {
    await claimLocalDataOwnership('user-a');
    await retainLocalDataOwnerForSignedOutRestore();

    expect(mocks.storage.get(LOCAL_DATA_RETAINED_OWNER_HASH_KEY)).toBe('a1'.repeat(32));
    await expect(readLocalDataOwnership(null)).resolves.toBe('retained');
    await expect(readLocalDataOwnership(null)).resolves.toBe('retained');

    await expect(readLocalDataOwnership('user-a')).resolves.toBe('match');
    expect(mocks.storage.get(LOCAL_DATA_RETAINED_OWNER_HASH_KEY)).toBe('a1'.repeat(32));
    await claimLocalDataOwnership('user-a');
    expect(mocks.storage.get(LOCAL_DATA_RETAINED_OWNER_HASH_KEY)).toBeUndefined();
    expect(mocks.storage.get(LOCAL_DATA_OWNER_HASH_KEY)).toBe('a1'.repeat(32));
  });

  it('keeps a retained owner quarantined from a foreign login', async () => {
    await claimLocalDataOwnership('user-a');
    await retainLocalDataOwnerForSignedOutRestore();

    await expect(readLocalDataOwnership('user-b')).resolves.toBe('mismatch');
    expect(mocks.storage.get(LOCAL_DATA_RETAINED_OWNER_HASH_KEY)).toBe('a1'.repeat(32));
  });

  it('refuses to create preservation proof without a canonical owner binding', async () => {
    await expect(retainLocalDataOwnerForSignedOutRestore()).rejects.toThrow(
      'LOCAL_DATA_RETAINED_OWNER_INVALID',
    );
    mocks.storage.set(LOCAL_DATA_OWNER_HASH_KEY, 'not-an-owner-binding');
    await expect(retainLocalDataOwnerForSignedOutRestore()).rejects.toThrow(
      'LOCAL_DATA_OWNER_PROOF_INVALID',
    );
    expect(mocks.storage.has(LOCAL_DATA_RETAINED_OWNER_HASH_KEY)).toBe(false);
  });

  it('quarantines ownerless data across cold restore and rejects direct adoption', async () => {
    await expect(quarantineUnclaimedLocalDataForSignedOutRestore()).resolves.toBeUndefined();

    expect(mocks.storage.get(LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY)).toBe('1');
    await expect(readLocalDataOwnership(null)).resolves.toBe('retained');
    await expect(readLocalDataOwnership(null)).resolves.toBe('retained');
    await expect(readLocalDataOwnership('user-a')).resolves.toBe('mismatch');
    await expect(claimLocalDataOwnership('user-a')).rejects.toThrow(
      'LOCAL_DATA_UNCLAIMED_QUARANTINED',
    );
    expect(mocks.storage.has(LOCAL_DATA_OWNER_HASH_KEY)).toBe(false);
  });

  it('chooses an idempotent forced-sign-out proof from canonical local state', async () => {
    await expect(preserveLocalDataForForcedSignOut()).resolves.toBe('unclaimed-quarantine');
    await expect(preserveLocalDataForForcedSignOut()).resolves.toBe('unclaimed-quarantine');
    expect(mocks.storage.get(LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY)).toBe('1');

    mocks.storage.clear();
    await claimLocalDataOwnership('user-a');
    await expect(preserveLocalDataForForcedSignOut()).resolves.toBe('retained-owner');
    await expect(preserveLocalDataForForcedSignOut()).resolves.toBe('retained-owner');
    expect(mocks.storage.get(LOCAL_DATA_RETAINED_OWNER_HASH_KEY)).toBe('a1'.repeat(32));
  });

  it('resumes authorized cleanup without downgrading ownerless remnants to quarantine', async () => {
    await claimLocalDataOwnership('user-a');
    await markLocalDataCleanupRequired();
    mocks.storage.delete(LOCAL_DATA_OWNER_HASH_KEY);

    await expect(preserveLocalDataForForcedSignOut()).resolves.toBe('resume-cleanup');
    expect(mocks.storage.get(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe('1');
    expect(mocks.storage.has(LOCAL_DATA_RETAINED_OWNER_HASH_KEY)).toBe(false);
    expect(mocks.storage.has(LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY)).toBe(false);

    await clearLocalDataCleanupRequired();
  });

  it('fails closed when forced-sign-out proof is malformed or cannot be read', async () => {
    mocks.storage.set(LOCAL_DATA_OWNER_HASH_KEY, 'not-an-owner-binding');
    await expect(preserveLocalDataForForcedSignOut()).rejects.toThrow(
      'LOCAL_DATA_OWNER_PROOF_INVALID',
    );

    mocks.storage.clear();
    mocks.storage.set(LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY, 'unexpected');
    await expect(readLocalDataOwnership(null)).rejects.toThrow('LOCAL_DATA_OWNER_PROOF_INVALID');
    await expect(claimLocalDataOwnership('user-a')).rejects.toThrow(
      'LOCAL_DATA_OWNER_PROOF_INVALID',
    );

    mocks.storage.clear();
    mocks.multiGet.mockResolvedValueOnce([
      [LOCAL_DATA_CLEANUP_REQUIRED_KEY, 1],
      [LOCAL_DATA_OWNER_HASH_KEY, null],
      [LOCAL_DATA_RETAINED_OWNER_HASH_KEY, null],
      [LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY, null],
    ] as unknown as [string, string | null][]);
    await expect(readLocalDataOwnership(null)).rejects.toThrow('LOCAL_DATA_OWNER_PROOF_INVALID');

    mocks.multiGet.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(preserveLocalDataForForcedSignOut()).rejects.toThrow('storage unavailable');

    mocks.multiGet.mockRejectedValue(new Error('quarantine marker unreadable'));
    await expect(readLocalDataOwnership(null)).rejects.toThrow('quarantine marker unreadable');
    await expect(claimLocalDataOwnership('user-a')).rejects.toThrow('quarantine marker unreadable');
    await expect(preserveLocalDataForForcedSignOut()).rejects.toThrow(
      'quarantine marker unreadable',
    );
  });

  it('rejects every internally inconsistent full-proof snapshot', async () => {
    mocks.storage.set(LOCAL_DATA_RETAINED_OWNER_HASH_KEY, 'a1'.repeat(32));
    await expect(readLocalDataOwnership(null)).rejects.toThrow('LOCAL_DATA_OWNER_PROOF_INVALID');

    mocks.storage.clear();
    mocks.storage.set(LOCAL_DATA_OWNER_HASH_KEY, 'a1'.repeat(32));
    mocks.storage.set(LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY, '1');
    await expect(readLocalDataOwnership('user-a')).rejects.toThrow(
      'LOCAL_DATA_OWNER_PROOF_INVALID',
    );

    mocks.storage.clear();
    mocks.storage.set(LOCAL_DATA_CLEANUP_REQUIRED_KEY, 'unexpected');
    await expect(readLocalDataOwnership(null)).rejects.toThrow('LOCAL_DATA_OWNER_PROOF_INVALID');
  });

  it('fails when the ownerless quarantine cannot be committed', async () => {
    mocks.setItem.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(quarantineUnclaimedLocalDataForSignedOutRestore()).rejects.toThrow(
      'storage unavailable',
    );
    expect(mocks.storage.has(LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY)).toBe(false);
  });

  it('does not create volatile cleanup authority when its durable marker write fails', async () => {
    mocks.setItem.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(markLocalDataCleanupRequired()).rejects.toThrow('storage unavailable');
    expect(mocks.storage.has(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe(false);
    await expect(readLocalDataOwnership(null)).resolves.toBe('unclaimed');
  });

  it('keeps a failed partial cleanup mismatched until the cleanup marker clears', async () => {
    await claimLocalDataOwnership('user-a');
    await markLocalDataCleanupRequired();
    mocks.storage.delete(LOCAL_DATA_OWNER_HASH_KEY);

    expect(mocks.storage.get(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe('1');
    await expect(readLocalDataOwnership('user-b')).resolves.toBe('cleanup_required');
    await expect(readLocalDataOwnership(null)).resolves.toBe('cleanup_required');

    await clearLocalDataCleanupRequired();
    await expect(readLocalDataOwnership('user-b')).resolves.toBe('unclaimed');
  });
});
