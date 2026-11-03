import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  LOCAL_DATA_CLEANUP_MARKER_SCOPE_INVALID,
  LOCAL_DATA_CLEANUP_MARKER_UNCONFIRMED,
  LOCAL_DATA_CLEANUP_MARKER_RESTORE_FAILED,
  type LocalDataCleanupMarkerRequest,
  type LocalDataCleanupMarkerScope,
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

describe('Campaign44 shared cleanup marker ownership and native ordering', () => {
  const requests: LocalDataCleanupMarkerRequest[] = [];
  const releases = new Set<() => void>();
  const pending = new Set<Promise<unknown>>();

  function track<T>(promise: Promise<T>): Promise<T> {
    pending.add(promise);
    void promise.catch(() => undefined);
    return promise;
  }

  function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => { resolve = done; });
    releases.add(resolve);
    return { promise, resolve };
  }

  function request(preserveExisting = false) {
    const marker: LocalDataCleanupMarkerRequest = { preserveExisting };
    requests.push(marker);
    const marking = track(markLocalDataCleanupRequired(marker));
    expect(marker.scope).toBeDefined();
    expect(Object.isFrozen(marker.scope)).toBe(true);
    return { scope: marker.scope!, marking, marker };
  }

  beforeEach(async () => {
    mocks.getItem.mockImplementation(async (key: string) => mocks.storage.get(key) ?? null);
    mocks.multiGet.mockImplementation(async (keys: readonly string[]) =>
      keys.map((key) => [key, mocks.storage.get(key) ?? null] as [string, string | null]),
    );
    mocks.removeItem.mockImplementation(async (key: string) => { mocks.storage.delete(key); });
    mocks.setItem.mockImplementation(async (key: string, value: string) => { mocks.storage.set(key, value); });
    await clearLocalDataCleanupRequired();
    mocks.storage.clear();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    for (const marker of requests) marker.scope?.abandon();
    requests.length = 0;
    for (const release of releases) release();
    releases.clear();
    await Promise.allSettled([...pending]);
    pending.clear();
    mocks.getItem.mockImplementation(async (key: string) => mocks.storage.get(key) ?? null);
    mocks.removeItem.mockImplementation(async (key: string) => { mocks.storage.delete(key); });
    mocks.setItem.mockImplementation(async (key: string, value: string) => { mocks.storage.set(key, value); });
    await clearLocalDataCleanupRequired();
  });

  it('assigns opaque ownership synchronously and keeps both original no-argument return contracts', async () => {
    const owned = request();
    await owned.marking;
    await expect(readLocalDataOwnership(null)).resolves.toBe('cleanup_required');
    await expect(clearLocalDataCleanupRequired(owned.scope)).resolves.toBe(true);
    await expect(markLocalDataCleanupRequired()).resolves.toBeUndefined();
    await expect(clearLocalDataCleanupRequired()).resolves.toBeUndefined();
    await expect(readLocalDataOwnership(null)).resolves.toBe('unclaimed');
  });

  it('never lets a newer whole reset erase an active older owner or that owner\'s later failure', async () => {
    const older = request();
    await older.marking;
    const newer = request();
    await newer.marking;
    await expect(clearLocalDataCleanupRequired(newer.scope)).resolves.toBe(false);
    expect(mocks.storage.get(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe('1');
    older.scope.abandon();
    await expect(readLocalDataOwnership(null)).resolves.toBe('cleanup_required');
    const retry = request();
    await retry.marking;
    await expect(clearLocalDataCleanupRequired(retry.scope)).resolves.toBe(true);
    await expect(readLocalDataOwnership(null)).resolves.toBe('unclaimed');
  });

  it('does not adopt a failed older scope that was still active when the newer scope entered', async () => {
    const older = request();
    await older.marking;
    const newer = request();
    await newer.marking;
    older.scope.abandon();
    await expect(clearLocalDataCleanupRequired(newer.scope)).resolves.toBe(false);
    expect(mocks.storage.get(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe('1');
    const retry = request();
    await retry.marking;
    await expect(clearLocalDataCleanupRequired(retry.scope)).resolves.toBe(true);
  });

  it('releases successful overlapping owners without stranding a marker after the last owner completes', async () => {
    const older = request();
    await older.marking;
    const newer = request(true);
    await newer.marking;
    await expect(clearLocalDataCleanupRequired(older.scope)).resolves.toBe(false);
    await expect(clearLocalDataCleanupRequired(newer.scope)).resolves.toBe(true);
    expect(mocks.storage.has(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe(false);
  });

  it('preserves an unowned preexisting broader marker for a private-only helper, while a new whole retry can adopt it', async () => {
    mocks.storage.set(LOCAL_DATA_CLEANUP_REQUIRED_KEY, '1');
    const partial = request(true);
    await partial.marking;
    await expect(clearLocalDataCleanupRequired(partial.scope)).resolves.toBe(false);
    await expect(readLocalDataOwnership(null)).resolves.toBe('cleanup_required');
    const whole = request();
    await whole.marking;
    await expect(clearLocalDataCleanupRequired(whole.scope)).resolves.toBe(true);
  });

  it('invalidates an older scope when a bare mark commits but native Promise delivery is held', async () => {
    const older = request();
    await older.marking;
    const entered = deferred();
    const release = deferred();
    mocks.setItem.mockImplementationOnce(async (key: string, value: string) => {
      mocks.storage.set(key, value);
      entered.resolve();
      await release.promise;
    });
    const bare = track(markLocalDataCleanupRequired());
    await entered.promise;
    const clearing = track(clearLocalDataCleanupRequired(older.scope));
    expect(mocks.removeItem).not.toHaveBeenCalled();
    release.resolve();
    await bare;
    await expect(clearing).resolves.toBe(false);
    expect(mocks.storage.get(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe('1');
    const retry = request();
    await retry.marking;
    await expect(clearLocalDataCleanupRequired(retry.scope)).resolves.toBe(true);
  });

  it('restores required bytes inside the same native queue when a new request arrives during removal', async () => {
    const older = request();
    await older.marking;
    const removed = deferred();
    const deliverRemove = deferred();
    mocks.removeItem.mockImplementationOnce(async (key: string) => {
      mocks.storage.delete(key);
      removed.resolve();
      await deliverRemove.promise;
    });
    let cleared = false;
    const clearing = track(clearLocalDataCleanupRequired(older.scope));
    void clearing.then(() => { cleared = true; });
    await removed.promise;
    const newer = request();
    const restored = deferred();
    const deliverRestore = deferred();
    mocks.setItem.mockImplementationOnce(async (key: string, value: string) => {
      mocks.storage.set(key, value);
      restored.resolve();
      await deliverRestore.promise;
    });
    deliverRemove.resolve();
    await restored.promise;
    expect(cleared).toBe(false);
    expect(mocks.storage.get(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe('1');
    deliverRestore.resolve();
    await expect(clearing).resolves.toBe(false);
    await newer.marking;
    await expect(clearLocalDataCleanupRequired(newer.scope)).resolves.toBe(true);
  });

  it.each(['before', 'after'] as const)('preserves original no-volatile-authority semantics for a %s-commit mark rejection', async (when) => {
    mocks.setItem.mockImplementationOnce(async (key: string, value: string) => {
      if (when === 'after') mocks.storage.set(key, value);
      throw new Error('SYNTHETIC_MARK_REJECTED');
    });
    const owned = request();
    await expect(owned.marking).rejects.toThrow('SYNTHETIC_MARK_REJECTED');
    owned.scope.abandon();
    await expect(readLocalDataOwnership(null)).resolves.toBe(
      when === 'after' ? 'cleanup_required' : 'unclaimed',
    );
  });

  it('refuses a silently omitted marker write without creating cleanup authority', async () => {
    mocks.setItem.mockImplementationOnce(async () => undefined);
    const owned = request();
    await expect(owned.marking).rejects.toThrow(LOCAL_DATA_CLEANUP_MARKER_UNCONFIRMED);
    owned.scope.abandon();
    await expect(readLocalDataOwnership(null)).resolves.toBe('unclaimed');
  });

  it.each(['reject-after-commit', 'omit'] as const)('never reports a clear after native %s', async (fault) => {
    const owned = request();
    await owned.marking;
    mocks.removeItem.mockImplementationOnce(async (key: string) => {
      if (fault === 'reject-after-commit') {
        mocks.storage.delete(key);
        throw new Error('SYNTHETIC_REMOVE_REJECTED');
      }
    });
    await expect(clearLocalDataCleanupRequired(owned.scope)).rejects.toThrow(
      fault === 'omit' ? LOCAL_DATA_CLEANUP_MARKER_UNCONFIRMED : 'SYNTHETIC_REMOVE_REJECTED',
    );
    expect(mocks.storage.get(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe('1');
    owned.scope.abandon();
    await expect(readLocalDataOwnership(null)).resolves.toBe('cleanup_required');
  });

  it('surfaces failed compensation and retains volatile quarantine after an ambiguous native clear', async () => {
    const owned = request();
    await owned.marking;
    mocks.removeItem.mockImplementationOnce(async (key: string) => {
      mocks.storage.delete(key);
      throw new Error('SYNTHETIC_REMOVE_REJECTED');
    });
    mocks.setItem.mockRejectedValueOnce(new Error('SYNTHETIC_RESTORE_REJECTED'));
    await expect(clearLocalDataCleanupRequired(owned.scope)).rejects.toThrow(
      LOCAL_DATA_CLEANUP_MARKER_RESTORE_FAILED,
    );
    expect(mocks.storage.has(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe(false);
    await expect(readLocalDataOwnership(null)).resolves.toBe('cleanup_required');
    owned.scope.abandon();
  });

  it('refuses forged, already completed, and reused request capabilities', async () => {
    const forged: LocalDataCleanupMarkerScope = Object.freeze({ abandon: () => undefined });
    await expect(clearLocalDataCleanupRequired(forged)).rejects.toThrow(LOCAL_DATA_CLEANUP_MARKER_SCOPE_INVALID);
    const owned = request();
    await owned.marking;
    await expect(markLocalDataCleanupRequired(owned.marker)).rejects.toThrow(LOCAL_DATA_CLEANUP_MARKER_SCOPE_INVALID);
    await expect(clearLocalDataCleanupRequired(owned.scope)).resolves.toBe(true);
    await expect(clearLocalDataCleanupRequired(owned.scope)).rejects.toThrow(LOCAL_DATA_CLEANUP_MARKER_SCOPE_INVALID);
  });

  it('revalidates a duplicate clear capability after it waited in the native marker queue', async () => {
    const owned = request();
    await owned.marking;
    const first = track(clearLocalDataCleanupRequired(owned.scope));
    const duplicate = track(clearLocalDataCleanupRequired(owned.scope));
    await expect(first).resolves.toBe(true);
    await expect(duplicate).rejects.toThrow(LOCAL_DATA_CLEANUP_MARKER_SCOPE_INVALID);
  });

  it('quarantines an ambiguous committed mark when both readback and recovery reads are unavailable', async () => {
    mocks.getItem
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('SYNTHETIC_MARK_READBACK_UNAVAILABLE'))
      .mockRejectedValueOnce(new Error('SYNTHETIC_MARK_RECOVERY_UNAVAILABLE'));
    const owned = request();
    await expect(owned.marking).rejects.toThrow('SYNTHETIC_MARK_READBACK_UNAVAILABLE');
    expect(mocks.storage.get(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe('1');
    owned.scope.abandon();
    // A later native absence report cannot turn the unconfirmed mutation into
    // owner admission. Only an actual successful whole retry may clear it.
    mocks.storage.delete(LOCAL_DATA_CLEANUP_REQUIRED_KEY);
    await expect(readLocalDataOwnership(null)).resolves.toBe('cleanup_required');
    const retry = request();
    await retry.marking;
    await expect(clearLocalDataCleanupRequired(retry.scope)).resolves.toBe(true);
  });

  it('retains quarantine when a rejected mark cannot confirm native absence', async () => {
    mocks.getItem
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('SYNTHETIC_MARK_RECOVERY_UNAVAILABLE'));
    mocks.setItem.mockRejectedValueOnce(new Error('SYNTHETIC_MARK_REJECTED'));
    const owned = request();
    await expect(owned.marking).rejects.toThrow('SYNTHETIC_MARK_REJECTED');
    owned.scope.abandon();
    expect(mocks.storage.has(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe(false);
    await expect(readLocalDataOwnership(null)).resolves.toBe('cleanup_required');
  });

  it('still attempts restoration if the rollback pre-read is unavailable, while refusing unverified success', async () => {
    const owned = request();
    await owned.marking;
    const setsBeforeClear = mocks.setItem.mock.calls.length;
    mocks.getItem
      .mockResolvedValueOnce('1')
      .mockRejectedValueOnce(new Error('SYNTHETIC_ROLLBACK_PREREAD_UNAVAILABLE'))
      .mockRejectedValueOnce(new Error('SYNTHETIC_ROLLBACK_READBACK_UNAVAILABLE'));
    mocks.removeItem.mockImplementationOnce(async (key: string) => {
      mocks.storage.delete(key);
      throw new Error('SYNTHETIC_REMOVE_REJECTED');
    });
    await expect(clearLocalDataCleanupRequired(owned.scope)).rejects.toThrow(
      LOCAL_DATA_CLEANUP_MARKER_RESTORE_FAILED,
    );
    expect(mocks.setItem.mock.calls.length).toBe(setsBeforeClear + 1);
    expect(mocks.storage.get(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe('1');
    owned.scope.abandon();
    await expect(readLocalDataOwnership(null)).resolves.toBe('cleanup_required');
  });

  it('retains quarantine when restoration commits then rejects and canonical readback is unavailable', async () => {
    const owned = request();
    await owned.marking;
    mocks.getItem
      .mockResolvedValueOnce('1')
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('SYNTHETIC_ROLLBACK_READBACK_UNAVAILABLE'));
    mocks.removeItem.mockImplementationOnce(async (key: string) => {
      mocks.storage.delete(key);
      throw new Error('SYNTHETIC_REMOVE_REJECTED');
    });
    mocks.setItem.mockImplementationOnce(async (key: string, value: string) => {
      mocks.storage.set(key, value);
      throw new Error('SYNTHETIC_RESTORE_COMMITTED_THEN_REJECTED');
    });
    await expect(clearLocalDataCleanupRequired(owned.scope)).rejects.toThrow(
      LOCAL_DATA_CLEANUP_MARKER_RESTORE_FAILED,
    );
    owned.scope.abandon();
    await expect(readLocalDataOwnership(null)).resolves.toBe('cleanup_required');
  });

  it.each(['before', 'after'] as const)(
    'retains an abandoned pending owner held %s native commit until a fresh whole retry', async (when) => {
      const entered = deferred();
      const release = deferred();
      mocks.setItem.mockImplementationOnce(async (key: string, value: string) => {
        if (when === 'after') mocks.storage.set(key, value);
        entered.resolve();
        await release.promise;
        if (when === 'before') mocks.storage.set(key, value);
      });
      const abandoned = request();
      await entered.promise;
      abandoned.scope.abandon();
      const overlapping = request();
      release.resolve();
      await abandoned.marking;
      await overlapping.marking;
      await expect(clearLocalDataCleanupRequired(overlapping.scope)).resolves.toBe(false);
      expect(mocks.storage.get(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe('1');
      await expect(readLocalDataOwnership(null)).resolves.toBe('cleanup_required');
      const retry = request();
      await retry.marking;
      await expect(clearLocalDataCleanupRequired(retry.scope)).resolves.toBe(true);
    },
  );
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
    expect(mocks.digest).toHaveBeenCalledWith('SHA-256', 'layerwell:local-data-owner:v1:user-a');
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
