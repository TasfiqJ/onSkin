import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearLocalDataCleanupRequired,
  claimLocalDataOwnership,
  LocalDataCleanupMarkerError,
  LocalDataOwnerMarkerError,
  LOCAL_DATA_CLEANUP_REQUIRED_KEY,
  LOCAL_DATA_OWNER_CLAIM_INTENT_KEY,
  LOCAL_DATA_OWNER_CLAIM_NONCE_KEY,
  LOCAL_DATA_OWNER_HASH_KEY,
  markLocalDataCleanupRequired,
  readLocalDataOwnership,
} from './sessionOwner';

const mocks = vi.hoisted(() => ({
  digest: vi.fn(async (_algorithm: string, value: string) => {
    if (value.startsWith('routinekind:local-data-owner-claim-intent:v1:')) {
      const ownerHashLastCharacter = value.slice(-1);
      return (ownerHashLastCharacter === 'a'
        ? 'e'
        : ownerHashLastCharacter === 'b'
          ? 'f'
          : '0'
      ).repeat(64);
    }
    return value.slice(-1).repeat(64);
  }),
  getThrows: false,
  removeMode: 'normal' as 'normal' | 'commit-then-throw' | 'drop',
  setMode: 'normal' as
    | 'normal'
    | 'commit-then-throw'
    | 'drop'
    | 'wrong-intent'
    | 'wrong-owner',
  storage: new Map<string, string>(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => {
      if (mocks.getThrows) throw new Error('owner marker unavailable');
      return mocks.storage.get(key) ?? null;
    }),
    removeItem: vi.fn(async (key: string) => {
      if (mocks.removeMode === 'drop') return;
      mocks.storage.delete(key);
      if (mocks.removeMode === 'commit-then-throw') {
        throw new Error('remove acknowledgement lost');
      }
    }),
    setItem: vi.fn(async (key: string, value: string) => {
      if (mocks.setMode === 'drop') return;
      mocks.storage.set(
        key,
        mocks.setMode === 'wrong-intent' && key === LOCAL_DATA_OWNER_CLAIM_INTENT_KEY
          ? `v1:${'b'.repeat(64)}`
          : mocks.setMode === 'wrong-owner' && key === LOCAL_DATA_OWNER_HASH_KEY
            ? `v1:${'c'.repeat(64)}`
            : value,
      );
      if (mocks.setMode === 'commit-then-throw') throw new Error('write acknowledgement lost');
    }),
  },
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digest,
  getRandomBytesAsync: vi.fn(async () => new Uint8Array(32).fill(0xdd)),
}));

describe('local account data ownership marker', () => {
  beforeEach(async () => {
    mocks.digest.mockClear();
    mocks.getThrows = false;
    mocks.removeMode = 'normal';
    mocks.setMode = 'normal';
    mocks.storage.clear();
    await clearLocalDataCleanupRequired();
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
    expect(stored).toBe(`v1:${'a'.repeat(64)}`);
    expect(stored).not.toBe('user-a');
    expect(mocks.digest).toHaveBeenCalledWith('SHA-256', 'routinekind:local-data-owner:v1:user-a');
  });

  it('reads the installed-base raw hash without mutating it', async () => {
    const legacy = 'a'.repeat(64);
    mocks.storage.set(LOCAL_DATA_OWNER_HASH_KEY, legacy);

    await expect(readLocalDataOwnership('user-a')).resolves.toBe('match');
    await expect(readLocalDataOwnership('user-b')).resolves.toBe('mismatch');
    await expect(readLocalDataOwnership(null)).resolves.toBe('mismatch');
    expect(mocks.storage.get(LOCAL_DATA_OWNER_HASH_KEY)).toBe(legacy);
  });

  it('reconciles a committed owner claim whose native acknowledgement is lost', async () => {
    mocks.setMode = 'commit-then-throw';

    await expect(claimLocalDataOwnership('user-a')).resolves.toBeUndefined();
    expect(mocks.storage.get(LOCAL_DATA_OWNER_HASH_KEY)).toBe(`v1:${'a'.repeat(64)}`);
  });

  it('rejects an invalid digest without persisting an owner marker', async () => {
    mocks.digest.mockResolvedValueOnce('not-a-sha256');

    await expect(claimLocalDataOwnership('user-a')).rejects.toEqual(
      new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_INVALID'),
    );
    expect(mocks.storage.has(LOCAL_DATA_OWNER_HASH_KEY)).toBe(false);
  });

  it('rejects an unconfirmed owner claim instead of reporting false success', async () => {
    mocks.setMode = 'drop';

    await expect(claimLocalDataOwnership('user-a')).rejects.toMatchObject({
      code: 'LOCAL_DATA_OWNER_WRITE_UNCONFIRMED',
    });
  });

  it('repairs a valid-but-wrong owner write only from its nonce-bound intent', async () => {
    mocks.setMode = 'wrong-owner';

    await expect(claimLocalDataOwnership('user-a')).rejects.toEqual(
      new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_WRITE_UNCONFIRMED'),
    );
    expect(mocks.storage.get(LOCAL_DATA_OWNER_CLAIM_INTENT_KEY)).toBe(
      `v1:${'e'.repeat(64)}`,
    );
    expect(mocks.storage.get(LOCAL_DATA_OWNER_CLAIM_NONCE_KEY)).toBe(
      `v1:${'d'.repeat(64)}`,
    );
    expect(mocks.storage.get(LOCAL_DATA_OWNER_HASH_KEY)).toBe(`v1:${'c'.repeat(64)}`);
    await expect(readLocalDataOwnership('user-a')).resolves.toBe('match');

    mocks.setMode = 'normal';
    await expect(claimLocalDataOwnership('user-a')).resolves.toBeUndefined();
    expect(mocks.storage.get(LOCAL_DATA_OWNER_HASH_KEY)).toBe(`v1:${'a'.repeat(64)}`);
    expect(mocks.storage.get(LOCAL_DATA_OWNER_CLAIM_INTENT_KEY)).toBe(
      `v1:${'e'.repeat(64)}`,
    );
    expect(mocks.storage.get(LOCAL_DATA_OWNER_CLAIM_NONCE_KEY)).toBe(
      `v1:${'d'.repeat(64)}`,
    );
    expect(mocks.storage.has(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe(false);
  });

  it('blocks a nonce-bound owner intent for a different authenticated owner without cleanup', async () => {
    mocks.storage.set(
      LOCAL_DATA_OWNER_CLAIM_INTENT_KEY,
      `v1:${'e'.repeat(64)}`,
    );
    mocks.storage.set(LOCAL_DATA_OWNER_CLAIM_NONCE_KEY, `v1:${'d'.repeat(64)}`);
    mocks.storage.set(LOCAL_DATA_OWNER_HASH_KEY, `v1:${'c'.repeat(64)}`);

    await expect(readLocalDataOwnership('user-b')).rejects.toEqual(
      new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_CLAIM_INCOMPLETE'),
    );
    expect(mocks.storage.get(LOCAL_DATA_OWNER_CLAIM_INTENT_KEY)).toBe(
      `v1:${'e'.repeat(64)}`,
    );
    expect(mocks.storage.get(LOCAL_DATA_OWNER_HASH_KEY)).toBe(`v1:${'c'.repeat(64)}`);
    expect(mocks.storage.has(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe(false);
  });

  it('does not reinterpret a wrong first claim record as another owner\'s authority', async () => {
    mocks.setMode = 'wrong-intent';

    await expect(claimLocalDataOwnership('user-a')).rejects.toEqual(
      new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_WRITE_UNCONFIRMED'),
    );
    expect(mocks.storage.get(LOCAL_DATA_OWNER_CLAIM_INTENT_KEY)).toBe(
      `v1:${'b'.repeat(64)}`,
    );
    expect(mocks.storage.get(LOCAL_DATA_OWNER_CLAIM_NONCE_KEY)).toBe(
      `v1:${'d'.repeat(64)}`,
    );
    expect(mocks.storage.has(LOCAL_DATA_OWNER_HASH_KEY)).toBe(false);
    await expect(readLocalDataOwnership('user-b')).rejects.toEqual(
      new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_CLAIM_INCOMPLETE'),
    );
    expect(mocks.storage.has(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe(false);
  });

  it('treats an interrupted owner-neutral nonce preflight as normal owner state', async () => {
    mocks.storage.set(LOCAL_DATA_OWNER_HASH_KEY, `v1:${'a'.repeat(64)}`);
    mocks.storage.set(LOCAL_DATA_OWNER_CLAIM_NONCE_KEY, `v1:${'d'.repeat(64)}`);

    await expect(readLocalDataOwnership('user-a')).resolves.toBe('match');
    await expect(readLocalDataOwnership('user-b')).resolves.toBe('mismatch');
    await expect(readLocalDataOwnership(null)).resolves.toBe('mismatch');
  });

  it('resumes an owner-neutral nonce preflight when the namespace is still unclaimed', async () => {
    mocks.storage.set(LOCAL_DATA_OWNER_CLAIM_NONCE_KEY, `v1:${'d'.repeat(64)}`);

    await expect(readLocalDataOwnership('user-a')).resolves.toBe('unclaimed');
    await expect(claimLocalDataOwnership('user-a')).resolves.toBeUndefined();
    expect(mocks.storage.get(LOCAL_DATA_OWNER_CLAIM_INTENT_KEY)).toBe(
      `v1:${'e'.repeat(64)}`,
    );
    expect(mocks.storage.get(LOCAL_DATA_OWNER_HASH_KEY)).toBe(`v1:${'a'.repeat(64)}`);
  });

  it.each([
    ['', 'LOCAL_DATA_OWNER_INVALID'],
    ['a'.repeat(64), 'LOCAL_DATA_OWNER_INVALID'],
    ['v1:not-a-hash', 'LOCAL_DATA_OWNER_INVALID'],
    [`v2:${'a'.repeat(64)}`, 'LOCAL_DATA_OWNER_UNSUPPORTED_VERSION'],
  ] as const)(
    'preserves an invalid or future owner-claim intent (%s)',
    async (marker, expectedCode) => {
      mocks.storage.set(LOCAL_DATA_OWNER_CLAIM_NONCE_KEY, `v1:${'d'.repeat(64)}`);
      mocks.storage.set(LOCAL_DATA_OWNER_CLAIM_INTENT_KEY, marker);

      await expect(readLocalDataOwnership('user-a')).rejects.toEqual(
        new LocalDataOwnerMarkerError(expectedCode),
      );
      await expect(claimLocalDataOwnership('user-a')).rejects.toEqual(
        new LocalDataOwnerMarkerError(expectedCode),
      );
      expect(mocks.storage.get(LOCAL_DATA_OWNER_CLAIM_INTENT_KEY)).toBe(marker);
      expect(mocks.storage.has(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe(false);
    },
  );

  it.each([
    ['', 'LOCAL_DATA_OWNER_INVALID'],
    ['a'.repeat(64), 'LOCAL_DATA_OWNER_INVALID'],
    ['v1:not-a-hash', 'LOCAL_DATA_OWNER_INVALID'],
    [`v2:${'a'.repeat(64)}`, 'LOCAL_DATA_OWNER_UNSUPPORTED_VERSION'],
  ] as const)(
    'preserves an invalid or future owner-claim nonce (%s)',
    async (marker, expectedCode) => {
      mocks.storage.set(LOCAL_DATA_OWNER_CLAIM_NONCE_KEY, marker);

      await expect(readLocalDataOwnership('user-a')).rejects.toEqual(
        new LocalDataOwnerMarkerError(expectedCode),
      );
      await expect(claimLocalDataOwnership('user-a')).rejects.toEqual(
        new LocalDataOwnerMarkerError(expectedCode),
      );
      expect(mocks.storage.get(LOCAL_DATA_OWNER_CLAIM_NONCE_KEY)).toBe(marker);
      expect(mocks.storage.has(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe(false);
    },
  );

  it('keeps a failed partial cleanup mismatched until the cleanup marker clears', async () => {
    await claimLocalDataOwnership('user-a');
    await markLocalDataCleanupRequired();
    mocks.storage.delete(LOCAL_DATA_OWNER_HASH_KEY);

    expect(mocks.storage.get(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe('v1:required');
    await expect(readLocalDataOwnership('user-b')).resolves.toBe('mismatch');
    await expect(readLocalDataOwnership(null)).resolves.toBe('mismatch');

    mocks.storage.delete(LOCAL_DATA_OWNER_CLAIM_INTENT_KEY);
    mocks.storage.delete(LOCAL_DATA_OWNER_CLAIM_NONCE_KEY);
    await clearLocalDataCleanupRequired();
    await expect(readLocalDataOwnership('user-b')).resolves.toBe('unclaimed');
  });

  it('verifies cleanup authority and reconciles a committed write response loss', async () => {
    mocks.setMode = 'commit-then-throw';

    await expect(markLocalDataCleanupRequired()).resolves.toBeUndefined();
    expect(mocks.storage.get(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe('v1:required');
    await expect(readLocalDataOwnership('user-a')).resolves.toBe('mismatch');
  });

  it('blocks cleanup when the cleanup-authority write is silently dropped', async () => {
    mocks.setMode = 'drop';

    await expect(markLocalDataCleanupRequired()).rejects.toEqual(
      new LocalDataCleanupMarkerError('LOCAL_DATA_CLEANUP_MARKER_WRITE_UNCONFIRMED'),
    );
    expect(mocks.storage.has(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe(false);
    // The in-memory latch also keeps this process fail-closed after uncertainty.
    await expect(readLocalDataOwnership('user-a')).resolves.toBe('mismatch');
  });

  it('reconciles a committed cleanup-marker removal response loss', async () => {
    await markLocalDataCleanupRequired();
    mocks.removeMode = 'commit-then-throw';

    await expect(clearLocalDataCleanupRequired()).resolves.toBeUndefined();
    expect(mocks.storage.has(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe(false);
    await expect(readLocalDataOwnership('user-a')).resolves.toBe('unclaimed');
  });

  it('keeps cleanup required when marker removal is silently dropped', async () => {
    await markLocalDataCleanupRequired();
    mocks.removeMode = 'drop';

    await expect(clearLocalDataCleanupRequired()).rejects.toEqual(
      new LocalDataCleanupMarkerError('LOCAL_DATA_CLEANUP_MARKER_CLEAR_UNCONFIRMED'),
    );
    expect(mocks.storage.get(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe('v1:required');
    await expect(readLocalDataOwnership('user-a')).resolves.toBe('mismatch');
  });

  it.each(['v1:required', '1'])(
    'accepts an exact supported cleanup marker (%s) as cleanup-required',
    async (marker) => {
      await claimLocalDataOwnership('user-a');
      mocks.storage.set(LOCAL_DATA_CLEANUP_REQUIRED_KEY, marker);

      await expect(readLocalDataOwnership('user-a')).resolves.toBe('mismatch');

      await clearLocalDataCleanupRequired();
      await expect(readLocalDataOwnership('user-a')).resolves.toBe('match');
    },
  );

  it.each(['', '0', 'corrupt', 'v1:not-required', 'x'.repeat(65)])(
    'preserves a malformed cleanup marker without authorizing cleanup (%s)',
    async (marker) => {
      await claimLocalDataOwnership('user-a');
      mocks.storage.set(LOCAL_DATA_CLEANUP_REQUIRED_KEY, marker);

      await expect(readLocalDataOwnership('user-a')).rejects.toEqual(
        new LocalDataCleanupMarkerError('LOCAL_DATA_CLEANUP_MARKER_INVALID'),
      );
      await expect(markLocalDataCleanupRequired()).rejects.toEqual(
        new LocalDataCleanupMarkerError('LOCAL_DATA_CLEANUP_MARKER_INVALID'),
      );
      await expect(clearLocalDataCleanupRequired()).rejects.toEqual(
        new LocalDataCleanupMarkerError('LOCAL_DATA_CLEANUP_MARKER_INVALID'),
      );
      expect(mocks.storage.get(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe(marker);
    },
  );

  it.each(['v2:required', 'v999:required'])(
    'preserves a future cleanup marker without authorizing cleanup (%s)',
    async (marker) => {
      await claimLocalDataOwnership('user-a');
      mocks.storage.set(LOCAL_DATA_CLEANUP_REQUIRED_KEY, marker);

      await expect(readLocalDataOwnership('user-a')).rejects.toEqual(
        new LocalDataCleanupMarkerError('LOCAL_DATA_CLEANUP_MARKER_UNSUPPORTED_VERSION'),
      );
      await expect(markLocalDataCleanupRequired()).rejects.toEqual(
        new LocalDataCleanupMarkerError('LOCAL_DATA_CLEANUP_MARKER_UNSUPPORTED_VERSION'),
      );
      await expect(clearLocalDataCleanupRequired()).rejects.toEqual(
        new LocalDataCleanupMarkerError('LOCAL_DATA_CLEANUP_MARKER_UNSUPPORTED_VERSION'),
      );
      expect(mocks.storage.get(LOCAL_DATA_CLEANUP_REQUIRED_KEY)).toBe(marker);
    },
  );

  it.each([
    '',
    'not-a-hash',
    'A'.repeat(64),
    'v1:not-a-hash',
    `v1:${'a'.repeat(64)}:extra`,
    JSON.stringify({ version: 1, ownerHash: 'a'.repeat(64) }),
    'x'.repeat(129),
  ])(
    'rejects a malformed owner marker without rewriting it (%s)',
    async (marker) => {
      mocks.storage.set(LOCAL_DATA_OWNER_HASH_KEY, marker);

      await expect(readLocalDataOwnership('user-a')).rejects.toEqual(
        new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_INVALID'),
      );
      expect(mocks.storage.get(LOCAL_DATA_OWNER_HASH_KEY)).toBe(marker);
    },
  );

  it.each([`v2:${'a'.repeat(64)}`, `v999:${'b'.repeat(64)}`])(
    'rejects a future owner marker without rewriting it (%s)',
    async (marker) => {
      mocks.storage.set(LOCAL_DATA_OWNER_HASH_KEY, marker);

      await expect(readLocalDataOwnership('user-a')).rejects.toEqual(
        new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_UNSUPPORTED_VERSION'),
      );
      expect(mocks.storage.get(LOCAL_DATA_OWNER_HASH_KEY)).toBe(marker);
    },
  );

  it('propagates marker storage unavailability so the session boundary stays closed', async () => {
    mocks.getThrows = true;

    await expect(readLocalDataOwnership('user-a')).rejects.toThrow('owner marker unavailable');
  });
});
