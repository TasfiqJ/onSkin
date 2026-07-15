import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { LOCAL_PRIVATE_READ_ONLY_KEYS } from '@/features/settings/localPrivateDataRegistry';

import {
  assertPrivateKVReadable,
  beginPrivateKVAccountBoundary,
  endPrivateKVAccountBoundary,
  getPrivateItem,
  getPrivateItems,
  PRIVATE_KV_AUTHORIZED_RESET_REASON_INVALID,
  PRIVATE_KV_CONTENT_KEY_CONFLICT,
  PRIVATE_KV_CONTENT_KEY_INVALID,
  PRIVATE_KV_CONTENT_KEY_MISSING,
  PRIVATE_KV_DECRYPTION_FAILED,
  PRIVATE_KV_ENVELOPE_FOREIGN,
  PRIVATE_KV_ENVELOPE_INVALID,
  PRIVATE_KV_ENVELOPE_UNSUPPORTED,
  PRIVATE_KV_RESERVED_KEY,
  PRIVATE_KV_READ_ONLY_KEY,
  PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
  PRIVATE_KV_WRITE_BLOCKED_AFTER_READ_FAILURE,
  PRIVATE_KV_WRITE_CONFLICT,
  removePrivateItem,
  removePrivateItemsForAuthorizedReset,
  multiRemovePrivateItems,
  privateKVEncryptionInfo,
  readPrivateItem,
  setPrivateItem,
  updatePrivateItem,
  waitForPrivateKVWritesToSettle,
  type PrivateKVCorruptReason,
  type PrivateKVReadResult,
  type PrivateKVUnavailableReason,
} from './privateKV';

const mocks = vi.hoisted(() => ({
  asyncStorage: new Map<string, string>(),
  getAllKeysGate: null as Promise<void> | null,
  getAllKeysStarted: null as (() => void) | null,
  getItemGate: null as Promise<void> | null,
  getItemSnapshotBeforeGate: false,
  getItemStarted: null as (() => void) | null,
  multiGetGate: null as Promise<void> | null,
  multiGetStarted: null as (() => void) | null,
  platformOS: 'ios',
  removeItemGate: null as Promise<void> | null,
  removeItemStarted: null as (() => void) | null,
  secureGetThrows: false,
  secureGetGate: null as Promise<void> | null,
  secureGetStarted: null as (() => void) | null,
  secureStorage: new Map<string, string>(),
  setItemGate: null as Promise<void> | null,
  setItemStarted: null as (() => void) | null,
}));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mocks.platformOS;
    },
  },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => {
      const snapshotBeforeGate = mocks.getItemSnapshotBeforeGate;
      const snapshot = snapshotBeforeGate
        ? (mocks.asyncStorage.get(key) ?? null)
        : null;
      mocks.getItemStarted?.();
      if (mocks.getItemGate) await mocks.getItemGate;
      return snapshotBeforeGate ? snapshot : (mocks.asyncStorage.get(key) ?? null);
    }),
    getAllKeys: vi.fn(async () => {
      mocks.getAllKeysStarted?.();
      if (mocks.getAllKeysGate) await mocks.getAllKeysGate;
      return [...mocks.asyncStorage.keys()];
    }),
    multiGet: vi.fn(async (keys: string[]) => {
      mocks.multiGetStarted?.();
      if (mocks.multiGetGate) await mocks.multiGetGate;
      return keys.map(
        (key) => [key, mocks.asyncStorage.get(key) ?? null] as [string, string | null],
      );
    }),
    setItem: vi.fn(async (key: string, value: string) => {
      mocks.setItemStarted?.();
      if (mocks.setItemGate) await mocks.setItemGate;
      mocks.asyncStorage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      mocks.removeItemStarted?.();
      if (mocks.removeItemGate) await mocks.removeItemGate;
      mocks.asyncStorage.delete(key);
    }),
    multiRemove: vi.fn(async (keys: string[]) => {
      mocks.removeItemStarted?.();
      if (mocks.removeItemGate) await mocks.removeItemGate;
      for (const key of keys) mocks.asyncStorage.delete(key);
    }),
  },
}));

vi.mock('react-native-get-random-values', () => ({}));

vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7,
  isAvailableAsync: vi.fn(async () => true),
  getItemAsync: vi.fn(async (key: string) => {
    mocks.secureGetStarted?.();
    if (mocks.secureGetGate) await mocks.secureGetGate;
    if (mocks.secureGetThrows) throw new Error('secure read failed');
    return mocks.secureStorage.get(key) ?? null;
  }),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    mocks.secureStorage.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    mocks.secureStorage.delete(key);
  }),
}));

describe('private KV encrypted storage', () => {
  beforeEach(() => {
    mocks.asyncStorage.clear();
    mocks.getAllKeysGate = null;
    mocks.getAllKeysStarted = null;
    mocks.getItemGate = null;
    mocks.getItemSnapshotBeforeGate = false;
    mocks.getItemStarted = null;
    mocks.multiGetGate = null;
    mocks.multiGetStarted = null;
    mocks.platformOS = 'ios';
    mocks.removeItemGate = null;
    mocks.removeItemStarted = null;
    mocks.secureGetThrows = false;
    mocks.secureGetGate = null;
    mocks.secureGetStarted = null;
    mocks.secureStorage.clear();
    mocks.setItemGate = null;
    mocks.setItemStarted = null;
    endPrivateKVAccountBoundary();
  });

  it('keeps legacy plaintext values readable', async () => {
    mocks.asyncStorage.set('legacy-key', 'legacy-value');

    await expect(getPrivateItem('legacy-key')).resolves.toBe('legacy-value');
  });

  it('keeps absent and valid empty private values distinct in typed reads', async () => {
    mocks.asyncStorage.set('routinekind.empty', '');

    await expect(readPrivateItem('routinekind.absent')).resolves.toEqual({ status: 'absent' });
    await expect(readPrivateItem('routinekind.empty')).resolves.toEqual({
      status: 'available',
      value: '',
    });
    await expect(getPrivateItem('routinekind.empty')).resolves.toBe('');
  });

  it('classifies corrupt and unsupported private envelopes without changing bytes', async () => {
    const corrupt = JSON.stringify({
      version: privateKVEncryptionInfo.version,
      nonceHex: 'not-hex',
      ciphertextHex: 'not-hex',
    });
    const future = JSON.stringify({
      version: 'xchacha20poly1305:v2',
      nonceHex: '00'.repeat(24),
      ciphertextHex: '00'.repeat(16),
    });
    mocks.asyncStorage.set('routinekind.corrupt', corrupt);
    mocks.asyncStorage.set('routinekind.future', future);

    await expect(readPrivateItem('routinekind.corrupt')).resolves.toEqual({
      status: 'corrupt',
      reason: 'envelope_invalid',
    });
    await expect(readPrivateItem('routinekind.future')).resolves.toEqual({
      status: 'unsupported_version',
    });
    expect(mocks.asyncStorage.get('routinekind.corrupt')).toBe(corrupt);
    expect(mocks.asyncStorage.get('routinekind.future')).toBe(future);
  });

  it('classifies an unreadable content key as unavailable and preserves ciphertext', async () => {
    await setPrivateItem('routinekind.authoritative', 'value');
    const raw = mocks.asyncStorage.get('routinekind.authoritative');
    mocks.secureGetThrows = true;

    await expect(readPrivateItem('routinekind.authoritative')).resolves.toEqual({
      status: 'unavailable',
      reason: 'content_key_storage_unavailable',
    });

    expect(mocks.asyncStorage.get('routinekind.authoritative')).toBe(raw);
  });

  it('roundtrips encrypted values through AsyncStorage', async () => {
    await setPrivateItem('routine-key', 'routine-value');

    const raw = mocks.asyncStorage.get('routine-key');
    expect(raw).toContain(privateKVEncryptionInfo.version);
    expect(raw).not.toContain('routine-value');
    await expect(getPrivateItem('routine-key')).resolves.toBe('routine-value');
  });

  it('keeps unavailable and corrupt reasons on their own discriminants', () => {
    expectTypeOf<
      Extract<PrivateKVReadResult, { status: 'unavailable' }>['reason']
    >().toEqualTypeOf<PrivateKVUnavailableReason>();
    expectTypeOf<
      Extract<PrivateKVReadResult, { status: 'corrupt' }>['reason']
    >().toEqualTypeOf<PrivateKVCorruptReason>();
  });

  it('freezes the exact registry-derived read-only inventory', () => {
    expect(LOCAL_PRIVATE_READ_ONLY_KEYS).toEqual([
      'onskin.completions.firstCompletion.v1',
      'onskin.cycle.v1',
      'onskin.photos.captureConsent',
      'onskin.photos.cloudBackup',
      'onskin.trendState.v1',
    ]);
    expect(Object.isFrozen(LOCAL_PRIVATE_READ_ONLY_KEYS)).toBe(true);
  });

  it.each(LOCAL_PRIVATE_READ_ONLY_KEYS)(
    'blocks writes to registry read-only key %s while retaining explicit deletion',
    async (key) => {
      mocks.asyncStorage.set(key, 'legacy-value');

      await expect(setPrivateItem(key, 'replacement')).rejects.toThrow(PRIVATE_KV_READ_ONLY_KEY);
      await expect(updatePrivateItem(key, () => 'replacement')).rejects.toThrow(
        PRIVATE_KV_READ_ONLY_KEY,
      );
      expect(mocks.asyncStorage.get(key)).toBe('legacy-value');

      await expect(removePrivateItem(key)).resolves.toBeUndefined();
      expect(mocks.asyncStorage.has(key)).toBe(false);
    },
  );

  it('preserves structurally invalid encrypted envelopes and blocks replacement', async () => {
    await setPrivateItem('onskin.seed', 'seed');
    const raw = JSON.stringify({
      version: privateKVEncryptionInfo.version,
      nonceHex: 'not-hex',
      ciphertextHex: 'also-not-hex',
    });
    const key = 'onskin.corrupt-key';
    mocks.asyncStorage.set(key, raw);

    await expect(getPrivateItem(key)).rejects.toThrow(PRIVATE_KV_ENVELOPE_INVALID);
    await expect(setPrivateItem(key, 'replacement')).rejects.toThrow(
      PRIVATE_KV_WRITE_BLOCKED_AFTER_READ_FAILURE,
    );
    expect(mocks.asyncStorage.get(key)).toBe(raw);
  });

  it.each([
    ['truncated JSON', `{"version":"${privateKVEncryptionInfo.version}","nonceHex":"00"`],
    [
      'missing ciphertext',
      JSON.stringify({ version: privateKVEncryptionInfo.version, nonceHex: '00'.repeat(24) }),
    ],
    [
      'wrong field type',
      JSON.stringify({
        version: privateKVEncryptionInfo.version,
        nonceHex: ['00'],
        ciphertextHex: '00'.repeat(16),
      }),
    ],
  ])('fails the full audit without changing a %s envelope', async (_label, raw) => {
    mocks.asyncStorage.set('onskin.corrupt', raw);

    await expect(assertPrivateKVReadable()).rejects.toThrow(PRIVATE_KV_ENVELOPE_INVALID);
    expect(mocks.asyncStorage.get('onskin.corrupt')).toBe(raw);
  });

  it('preserves unsupported private envelope versions', async () => {
    const raw = JSON.stringify({
      version: 'xchacha20poly1305:v2',
      nonceHex: '00'.repeat(24),
      ciphertextHex: '00'.repeat(16),
    });
    mocks.asyncStorage.set('onskin.future', raw);

    await expect(assertPrivateKVReadable()).rejects.toThrow(PRIVATE_KV_ENVELOPE_UNSUPPORTED);
    expect(mocks.asyncStorage.get('onskin.future')).toBe(raw);
  });

  it('rejects a direct overwrite of malformed ciphertext before creating a key', async () => {
    const raw = JSON.stringify({
      version: privateKVEncryptionInfo.version,
      nonceHex: '00'.repeat(24),
      ciphertextHex: '00',
    });
    mocks.asyncStorage.set('onskin.corrupt', raw);

    await expect(setPrivateItem('onskin.corrupt', 'replacement')).rejects.toThrow(
      PRIVATE_KV_ENVELOPE_INVALID,
    );
    expect(mocks.asyncStorage.get('onskin.corrupt')).toBe(raw);
    expect(mocks.secureStorage.size).toBe(0);
  });

  it('treats malformed private envelopes as orphaned ciphertext before key creation', async () => {
    const raw = `{"version":"${privateKVEncryptionInfo.version}","nonceHex":"00"`;
    mocks.asyncStorage.set('onskin.orphaned', raw);

    await expect(setPrivateItem('onskin.new-record', 'new-value')).rejects.toThrow(
      PRIVATE_KV_CONTENT_KEY_MISSING,
    );
    expect(mocks.asyncStorage.get('onskin.orphaned')).toBe(raw);
    expect(mocks.asyncStorage.has('onskin.new-record')).toBe(false);
    expect(mocks.secureStorage.size).toBe(0);
  });

  it('batch-reads encrypted and legacy values with one complete result map', async () => {
    await setPrivateItem('encrypted-a', 'value-a');
    await setPrivateItem('encrypted-b', JSON.stringify({ value: 'b' }));
    mocks.asyncStorage.set('legacy', 'legacy-value');

    await expect(
      getPrivateItems(['encrypted-a', 'encrypted-b', 'legacy', 'missing']),
    ).resolves.toEqual(
      new Map([
        ['legacy', 'legacy-value'],
        ['missing', null],
        ['encrypted-a', 'value-a'],
        ['encrypted-b', JSON.stringify({ value: 'b' })],
      ]),
    );
  });

  it('audits every private envelope without treating other encrypted formats as private KV', async () => {
    await setPrivateItem('onskin.profile', 'profile-value');
    mocks.asyncStorage.set('legacy', 'legacy-value');
    const foreignRaw = JSON.stringify({
      version: privateKVEncryptionInfo.version,
      keyId: 'supabase-session-key-v1',
      nonceHex: 'not-private-kv',
      ciphertextHex: 'not-private-kv',
    });
    const foreignKey = 'sb-placeholder-auth-token';
    mocks.asyncStorage.set(foreignKey, foreignRaw);

    await expect(assertPrivateKVReadable()).resolves.toBeUndefined();
    await expect(getPrivateItem('onskin.profile')).resolves.toBe('profile-value');
    await expect(getPrivateItem(foreignKey)).rejects.toThrow(PRIVATE_KV_ENVELOPE_FOREIGN);
    await expect(getPrivateItems([foreignKey])).rejects.toThrow(PRIVATE_KV_ENVELOPE_FOREIGN);
    await expect(setPrivateItem(foreignKey, 'replacement')).rejects.toThrow(
      PRIVATE_KV_ENVELOPE_FOREIGN,
    );
    expect(mocks.asyncStorage.get(foreignKey)).toBe(foreignRaw);
  });

  it('rejects reads, writes, and removals against reserved storage authorities', async () => {
    const foreignKey = 'sb-placeholder-auth-token';
    const contentKey = privateKVEncryptionInfo.secureStoreKey;
    mocks.asyncStorage.set(foreignKey, 'foreign-session');
    mocks.asyncStorage.set(contentKey, 'legacy-content-key');

    await expect(removePrivateItem(foreignKey)).rejects.toThrow(PRIVATE_KV_ENVELOPE_FOREIGN);
    await expect(multiRemovePrivateItems(['onskin.profile', foreignKey])).rejects.toThrow(
      PRIVATE_KV_ENVELOPE_FOREIGN,
    );
    await expect(getPrivateItem(contentKey)).rejects.toThrow(PRIVATE_KV_RESERVED_KEY);
    await expect(getPrivateItems([contentKey])).rejects.toThrow(PRIVATE_KV_RESERVED_KEY);
    await expect(setPrivateItem(contentKey, 'replacement')).rejects.toThrow(
      PRIVATE_KV_RESERVED_KEY,
    );
    await expect(removePrivateItem(contentKey)).rejects.toThrow(PRIVATE_KV_RESERVED_KEY);
    await expect(multiRemovePrivateItems(['onskin.profile', contentKey])).rejects.toThrow(
      PRIVATE_KV_RESERVED_KEY,
    );
    beginPrivateKVAccountBoundary();
    await expect(
      removePrivateItemsForAuthorizedReset(['onskin.profile', foreignKey], 'account_isolation'),
    ).rejects.toThrow(PRIVATE_KV_AUTHORIZED_RESET_REASON_INVALID);
    await expect(
      removePrivateItemsForAuthorizedReset(['onskin.profile', contentKey], 'account_isolation'),
    ).rejects.toThrow(PRIVATE_KV_AUTHORIZED_RESET_REASON_INVALID);

    expect(mocks.asyncStorage.get(foreignKey)).toBe('foreign-session');
    expect(mocks.asyncStorage.get(contentKey)).toBe('legacy-content-key');
  });

  it('rejects an arbitrary keyId on an app-owned private envelope', async () => {
    const raw = JSON.stringify({
      version: privateKVEncryptionInfo.version,
      keyId: 'not-a-known-authority',
      nonceHex: '00'.repeat(24),
      ciphertextHex: '00'.repeat(16),
    });
    mocks.asyncStorage.set('onskin.profile', raw);

    await expect(assertPrivateKVReadable()).rejects.toThrow(PRIVATE_KV_ENVELOPE_INVALID);
    expect(mocks.asyncStorage.get('onskin.profile')).toBe(raw);
  });

  it('keeps unrelated legacy nonce/ciphertext payloads outside private-KV ownership', async () => {
    const raw = JSON.stringify({ nonceHex: 'aa', ciphertextHex: 'bb' });
    mocks.asyncStorage.set('third-party-cache', raw);

    await expect(assertPrivateKVReadable()).resolves.toBeUndefined();
    await expect(getPrivateItem('third-party-cache')).resolves.toBe(raw);
  });

  it('preserves every private envelope when the shared content key is unavailable', async () => {
    await setPrivateItem('onskin.profile', 'profile-value');
    await setPrivateItem('onskin.shelf', 'shelf-value');
    const profileCiphertext = mocks.asyncStorage.get('onskin.profile');
    const shelfCiphertext = mocks.asyncStorage.get('onskin.shelf');
    mocks.secureGetThrows = true;

    await expect(assertPrivateKVReadable()).rejects.toThrow(
      'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE',
    );

    expect(mocks.asyncStorage.get('onskin.profile')).toBe(profileCiphertext);
    expect(mocks.asyncStorage.get('onskin.shelf')).toBe(shelfCiphertext);
    expect(mocks.secureStorage.size).toBe(1);
  });

  it('shares one content key across concurrent first writes', async () => {
    await Promise.all([
      setPrivateItem('onskin.concurrent-a', 'value-a'),
      setPrivateItem('onskin.concurrent-b', 'value-b'),
    ]);

    await expect(getPrivateItems(['onskin.concurrent-a', 'onskin.concurrent-b'])).resolves.toEqual(
      new Map([
        ['onskin.concurrent-a', 'value-a'],
        ['onskin.concurrent-b', 'value-b'],
      ]),
    );
  });

  it('serializes concurrent writes to the same private key', async () => {
    let releaseFirstWrite!: () => void;
    let markFirstWriteStarted!: () => void;
    let writeStarts = 0;
    mocks.setItemGate = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    const firstWriteStarted = new Promise<void>((resolve) => {
      markFirstWriteStarted = resolve;
    });
    mocks.setItemStarted = () => {
      writeStarts += 1;
      if (writeStarts === 1) markFirstWriteStarted();
    };

    const first = setPrivateItem('onskin.serialized', 'first');
    await firstWriteStarted;
    const second = setPrivateItem('onskin.serialized', 'second');
    await Promise.resolve();
    expect(writeStarts).toBe(1);

    releaseFirstWrite();
    await first;
    await second;

    expect(writeStarts).toBe(2);
    await expect(getPrivateItem('onskin.serialized')).resolves.toBe('second');
  });

  it('preserves a concurrent replacement detected before the final write', async () => {
    await setPrivateItem('onskin.race', 'original');
    const replacement = JSON.stringify({
      version: privateKVEncryptionInfo.version,
      keyId: 'unexpected-authority',
      nonceHex: '00'.repeat(24),
      ciphertextHex: '00'.repeat(16),
    });
    let releaseSecureRead!: () => void;
    let markSecureReadStarted!: () => void;
    mocks.secureGetGate = new Promise<void>((resolve) => {
      releaseSecureRead = resolve;
    });
    const secureReadStarted = new Promise<void>((resolve) => {
      markSecureReadStarted = resolve;
    });
    mocks.secureGetStarted = markSecureReadStarted;

    const write = setPrivateItem('onskin.race', 'updated');
    await secureReadStarted;
    mocks.asyncStorage.set('onskin.race', replacement);
    releaseSecureRead();

    await expect(write).rejects.toThrow(PRIVATE_KV_WRITE_CONFLICT);
    expect(mocks.asyncStorage.get('onskin.race')).toBe(replacement);
  });

  it('blocks private writes while an account boundary is active', async () => {
    beginPrivateKVAccountBoundary();

    await expect(setPrivateItem('onskin.account-b', 'value-b')).rejects.toThrow(
      PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
    );
    expect(mocks.asyncStorage.has('onskin.account-b')).toBe(false);
  });

  it('invalidates active never-resolving reads without adding them to the mutation drain', async () => {
    let readsStartedCount = 0;
    let markReadsStarted!: () => void;
    const readsStarted = new Promise<void>((resolve) => {
      markReadsStarted = resolve;
    });
    mocks.getItemGate = new Promise<void>(() => undefined);
    mocks.getItemStarted = () => {
      readsStartedCount += 1;
      if (readsStartedCount === 2) markReadsStarted();
    };

    const rawRead = getPrivateItem('onskin.account-a.raw');
    const typedRead = readPrivateItem('onskin.account-a.typed');
    const rawRejection = expect(rawRead).rejects.toThrow(
      PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
    );
    await readsStarted;

    beginPrivateKVAccountBoundary();
    try {
      await rawRejection;
      await expect(typedRead).resolves.toEqual({
        status: 'unavailable',
        reason: 'account_boundary',
      });
      await expect(waitForPrivateKVWritesToSettle()).resolves.toBeUndefined();
    } finally {
      endPrivateKVAccountBoundary();
    }
  });

  it('invalidates a never-resolving batch read without holding the mutation drain', async () => {
    let markReadStarted!: () => void;
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve;
    });
    mocks.multiGetGate = new Promise<void>(() => undefined);
    mocks.multiGetStarted = markReadStarted;

    const read = getPrivateItems(['onskin.account-a.batch']);
    const rejection = expect(read).rejects.toThrow(
      PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
    );
    await readStarted;

    beginPrivateKVAccountBoundary();
    try {
      await rejection;
      await expect(waitForPrivateKVWritesToSettle()).resolves.toBeUndefined();
    } finally {
      endPrivateKVAccountBoundary();
    }
  });

  it('coordinates a never-resolving full-audit enumeration with the read boundary', async () => {
    let markEnumerationStarted!: () => void;
    const enumerationStarted = new Promise<void>((resolve) => {
      markEnumerationStarted = resolve;
    });
    mocks.getAllKeysGate = new Promise<void>(() => undefined);
    mocks.getAllKeysStarted = markEnumerationStarted;

    const audit = assertPrivateKVReadable();
    const rejection = expect(audit).rejects.toThrow(
      PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
    );
    await enumerationStarted;

    beginPrivateKVAccountBoundary();
    try {
      await rejection;
      await expect(waitForPrivateKVWritesToSettle()).resolves.toBeUndefined();
    } finally {
      endPrivateKVAccountBoundary();
    }
  });

  it('blocks reads until the outermost nested account boundary ends', async () => {
    const markReadStarted = vi.fn();
    mocks.getItemStarted = markReadStarted;
    let boundaryDepth = 0;

    try {
      beginPrivateKVAccountBoundary();
      boundaryDepth += 1;
      beginPrivateKVAccountBoundary();
      boundaryDepth += 1;

      await expect(readPrivateItem('onskin.account-b')).resolves.toEqual({
        status: 'unavailable',
        reason: 'account_boundary',
      });
      endPrivateKVAccountBoundary();
      boundaryDepth -= 1;
      await expect(readPrivateItem('onskin.account-b')).resolves.toEqual({
        status: 'unavailable',
        reason: 'account_boundary',
      });
      expect(markReadStarted).not.toHaveBeenCalled();

      endPrivateKVAccountBoundary();
      boundaryDepth -= 1;
      mocks.asyncStorage.set('onskin.account-b', 'owner-b-value');
      await expect(getPrivateItem('onskin.account-b')).resolves.toBe('owner-b-value');
      expect(markReadStarted).toHaveBeenCalledOnce();
    } finally {
      while (boundaryDepth > 0) {
        endPrivateKVAccountBoundary();
        boundaryDepth -= 1;
      }
    }
  });

  it('prevents a late owner-A read from clearing owner-B failed-read protection', async () => {
    const key = 'onskin.account-boundary.failed-read';
    mocks.asyncStorage.set(key, 'owner-a-legacy');
    mocks.getItemSnapshotBeforeGate = true;
    let releaseOwnerARead!: () => void;
    let markOwnerAReadStarted!: () => void;
    mocks.getItemGate = new Promise<void>((resolve) => {
      releaseOwnerARead = resolve;
    });
    const ownerAReadStarted = new Promise<void>((resolve) => {
      markOwnerAReadStarted = resolve;
    });
    mocks.getItemStarted = markOwnerAReadStarted;

    const ownerARead = getPrivateItem(key);
    const ownerARejection = expect(ownerARead).rejects.toThrow(
      PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
    );
    await ownerAReadStarted;
    beginPrivateKVAccountBoundary();
    await ownerARejection;
    endPrivateKVAccountBoundary();

    mocks.getItemGate = null;
    mocks.getItemSnapshotBeforeGate = false;
    mocks.getItemStarted = null;
    const ownerBMalformed = JSON.stringify({
      version: privateKVEncryptionInfo.version,
      nonceHex: '00',
      ciphertextHex: '00'.repeat(16),
    });
    mocks.asyncStorage.set(key, ownerBMalformed);
    await expect(getPrivateItem(key)).rejects.toThrow(PRIVATE_KV_ENVELOPE_INVALID);

    releaseOwnerARead();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    await expect(setPrivateItem(key, 'replacement')).rejects.toThrow(
      PRIVATE_KV_WRITE_BLOCKED_AFTER_READ_FAILURE,
    );
    expect(mocks.asyncStorage.get(key)).toBe(ownerBMalformed);
  });

  it('consumes a late SecureStore rejection without recording an owner-A failed snapshot', async () => {
    const key = 'onskin.account-boundary.secure-read';
    await setPrivateItem(key, 'owner-a-value');
    let releaseSecureRead!: () => void;
    let markSecureReadStarted!: () => void;
    mocks.secureGetGate = new Promise<void>((resolve) => {
      releaseSecureRead = resolve;
    });
    const secureReadStarted = new Promise<void>((resolve) => {
      markSecureReadStarted = resolve;
    });
    mocks.secureGetStarted = markSecureReadStarted;
    mocks.secureGetThrows = true;

    const ownerARead = getPrivateItem(key);
    const ownerARejection = expect(ownerARead).rejects.toThrow(
      PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
    );
    await secureReadStarted;
    beginPrivateKVAccountBoundary();
    try {
      await ownerARejection;
      await expect(waitForPrivateKVWritesToSettle()).resolves.toBeUndefined();
      releaseSecureRead();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    } finally {
      endPrivateKVAccountBoundary();
    }

    mocks.secureGetGate = null;
    mocks.secureGetStarted = null;
    mocks.secureGetThrows = false;
    await expect(setPrivateItem(key, 'owner-b-value')).resolves.toBeUndefined();
    await expect(getPrivateItem(key)).resolves.toBe('owner-b-value');
  });

  it('rejects a write that had not reached storage before the boundary began', async () => {
    let releaseRead!: () => void;
    let markReadStarted!: () => void;
    mocks.getItemGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve;
    });
    mocks.getItemStarted = markReadStarted;

    const write = setPrivateItem('onskin.account-a', 'late-value');
    await readStarted;
    beginPrivateKVAccountBoundary();
    releaseRead();

    await expect(write).rejects.toThrow(PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY);
    expect(mocks.asyncStorage.has('onskin.account-a')).toBe(false);
  });

  it('waits for a storage write already in progress before account cleanup continues', async () => {
    let releaseWrite!: () => void;
    let markWriteStarted!: () => void;
    mocks.setItemGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const writeStarted = new Promise<void>((resolve) => {
      markWriteStarted = resolve;
    });
    mocks.setItemStarted = markWriteStarted;

    const write = setPrivateItem('onskin.account-a', 'committed-before-clear');
    await writeStarted;
    beginPrivateKVAccountBoundary();
    let drainFinished = false;
    const drain = waitForPrivateKVWritesToSettle().then(() => {
      drainFinished = true;
    });
    await Promise.resolve();
    expect(drainFinished).toBe(false);

    releaseWrite();
    await write;
    await drain;
    expect(drainFinished).toBe(true);
    expect(mocks.asyncStorage.has('onskin.account-a')).toBe(true);
  });

  it('tracks a queued same-key mutation until the account boundary rejects it', async () => {
    let releaseWrite!: () => void;
    let markWriteStarted!: () => void;
    mocks.setItemGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const writeStarted = new Promise<void>((resolve) => {
      markWriteStarted = resolve;
    });
    mocks.setItemStarted = markWriteStarted;

    const first = setPrivateItem('onskin.account-a', 'first');
    await writeStarted;
    const queued = setPrivateItem('onskin.account-a', 'second');
    beginPrivateKVAccountBoundary();
    const queuedRejection = expect(queued).rejects.toThrow(
      PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
    );
    let drainFinished = false;
    const drain = waitForPrivateKVWritesToSettle().then(() => {
      drainFinished = true;
    });
    await Promise.resolve();
    expect(drainFinished).toBe(false);

    releaseWrite();
    await first;
    await queuedRejection;
    await drain;
    expect(drainFinished).toBe(true);
    endPrivateKVAccountBoundary();
    await expect(getPrivateItem('onskin.account-a')).resolves.toBe('first');
  });

  it('blocks new removals and drains a removal already in progress', async () => {
    mocks.asyncStorage.set('onskin.account-a', 'account-a-value');
    let releaseRemoval!: () => void;
    let markRemovalStarted!: () => void;
    mocks.removeItemGate = new Promise<void>((resolve) => {
      releaseRemoval = resolve;
    });
    const removalStarted = new Promise<void>((resolve) => {
      markRemovalStarted = resolve;
    });
    mocks.removeItemStarted = markRemovalStarted;

    const removal = removePrivateItem('onskin.account-a');
    await removalStarted;
    beginPrivateKVAccountBoundary();
    await expect(multiRemovePrivateItems(['onskin.account-b'])).rejects.toThrow(
      PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
    );
    let drainFinished = false;
    const drain = waitForPrivateKVWritesToSettle().then(() => {
      drainFinished = true;
    });
    await Promise.resolve();
    expect(drainFinished).toBe(false);

    releaseRemoval();
    await removal;
    await drain;
    expect(drainFinished).toBe(true);
    expect(mocks.asyncStorage.has('onskin.account-a')).toBe(false);
  });

  it('authenticates healthy ciphertext before routine deletion', async () => {
    await setPrivateItem('onskin.removable', 'private-value');

    await expect(removePrivateItem('onskin.removable')).resolves.toBeUndefined();

    expect(mocks.asyncStorage.has('onskin.removable')).toBe(false);
  });

  it('preserves keyless ciphertext until an explicitly authorized reset', async () => {
    await setPrivateItem('onskin.shelf.v1', 'private-value');
    const ciphertext = mocks.asyncStorage.get('onskin.shelf.v1');
    mocks.secureStorage.delete(privateKVEncryptionInfo.secureStoreKey);

    await expect(removePrivateItem('onskin.shelf.v1')).rejects.toThrow(
      PRIVATE_KV_CONTENT_KEY_MISSING,
    );
    expect(mocks.asyncStorage.get('onskin.shelf.v1')).toBe(ciphertext);

    beginPrivateKVAccountBoundary();
    await expect(
      removePrivateItemsForAuthorizedReset(['onskin.shelf.v1'], 'account_isolation'),
    ).resolves.toBeUndefined();
    expect(mocks.asyncStorage.has('onskin.shelf.v1')).toBe(false);
  });

  it('preserves every ciphertext when a malformed key blocks a batch deletion', async () => {
    await setPrivateItem('onskin.malformed-delete-a', 'value-a');
    await setPrivateItem('onskin.malformed-delete-b', 'value-b');
    const ciphertextA = mocks.asyncStorage.get('onskin.malformed-delete-a');
    const ciphertextB = mocks.asyncStorage.get('onskin.malformed-delete-b');
    mocks.secureStorage.set(privateKVEncryptionInfo.secureStoreKey, 'malformed-key');

    await expect(
      multiRemovePrivateItems(['onskin.malformed-delete-a', 'onskin.malformed-delete-b']),
    ).rejects.toThrow(PRIVATE_KV_CONTENT_KEY_INVALID);

    expect(mocks.asyncStorage.get('onskin.malformed-delete-a')).toBe(ciphertextA);
    expect(mocks.asyncStorage.get('onskin.malformed-delete-b')).toBe(ciphertextB);
  });

  it('preserves every ciphertext when a wrong valid key blocks a batch deletion', async () => {
    await setPrivateItem('onskin.wrong-key-delete-a', 'value-a');
    await setPrivateItem('onskin.wrong-key-delete-b', 'value-b');
    const ciphertextA = mocks.asyncStorage.get('onskin.wrong-key-delete-a');
    const ciphertextB = mocks.asyncStorage.get('onskin.wrong-key-delete-b');
    const originalKey = mocks.secureStorage.get(privateKVEncryptionInfo.secureStoreKey);
    const wrongKey = originalKey === 'a'.repeat(64) ? 'b'.repeat(64) : 'a'.repeat(64);
    mocks.secureStorage.set(privateKVEncryptionInfo.secureStoreKey, wrongKey);

    await expect(
      multiRemovePrivateItems(['onskin.wrong-key-delete-a', 'onskin.wrong-key-delete-b']),
    ).rejects.toThrow(PRIVATE_KV_DECRYPTION_FAILED);

    expect(mocks.asyncStorage.get('onskin.wrong-key-delete-a')).toBe(ciphertextA);
    expect(mocks.asyncStorage.get('onskin.wrong-key-delete-b')).toBe(ciphertextB);
  });

  it('preserves ciphertext when key storage is unavailable during routine deletion', async () => {
    await setPrivateItem('onskin.unavailable-delete', 'private-value');
    const ciphertext = mocks.asyncStorage.get('onskin.unavailable-delete');
    mocks.secureGetThrows = true;

    await expect(removePrivateItem('onskin.unavailable-delete')).rejects.toThrow(
      'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE',
    );

    expect(mocks.asyncStorage.get('onskin.unavailable-delete')).toBe(ciphertext);
  });

  it('requires a successful authenticated read before deleting a failed-read snapshot', async () => {
    await setPrivateItem('onskin.failed-read-delete', 'private-value');
    const contentKey = mocks.secureStorage.get(privateKVEncryptionInfo.secureStoreKey)!;
    const ciphertext = mocks.asyncStorage.get('onskin.failed-read-delete');
    mocks.secureStorage.delete(privateKVEncryptionInfo.secureStoreKey);

    await expect(getPrivateItem('onskin.failed-read-delete')).rejects.toThrow(
      PRIVATE_KV_CONTENT_KEY_MISSING,
    );
    mocks.secureStorage.set(privateKVEncryptionInfo.secureStoreKey, contentKey);

    await expect(removePrivateItem('onskin.failed-read-delete')).rejects.toThrow(
      PRIVATE_KV_WRITE_BLOCKED_AFTER_READ_FAILURE,
    );
    expect(mocks.asyncStorage.get('onskin.failed-read-delete')).toBe(ciphertext);

    await expect(getPrivateItem('onskin.failed-read-delete')).resolves.toBe('private-value');
    await expect(removePrivateItem('onskin.failed-read-delete')).resolves.toBeUndefined();
    expect(mocks.asyncStorage.has('onskin.failed-read-delete')).toBe(false);
  });

  it('preserves conflicting native and fallback keys during routine deletion', async () => {
    await setPrivateItem('onskin.conflicting-key-delete', 'private-value');
    const ciphertext = mocks.asyncStorage.get('onskin.conflicting-key-delete');
    const validFallback = mocks.secureStorage.get(privateKVEncryptionInfo.secureStoreKey)!;
    const wrongSecureKey = validFallback === 'a'.repeat(64) ? 'b'.repeat(64) : 'a'.repeat(64);
    mocks.asyncStorage.set(privateKVEncryptionInfo.secureStoreKey, validFallback);
    mocks.secureStorage.set(privateKVEncryptionInfo.secureStoreKey, wrongSecureKey);

    await expect(removePrivateItem('onskin.conflicting-key-delete')).rejects.toThrow(
      PRIVATE_KV_CONTENT_KEY_CONFLICT,
    );

    expect(mocks.asyncStorage.get('onskin.conflicting-key-delete')).toBe(ciphertext);
    expect(mocks.asyncStorage.get(privateKVEncryptionInfo.secureStoreKey)).toBe(validFallback);
    expect(mocks.secureStorage.get(privateKVEncryptionInfo.secureStoreKey)).toBe(wrongSecureKey);
  });

  it('allows authorized account isolation to remove unreadable registered bytes during a boundary', async () => {
    const malformed = '{"version":"xchacha20poly1305:v1","nonceHex":"invalid"';
    mocks.asyncStorage.set('onskin.shelf.v1', malformed);
    beginPrivateKVAccountBoundary();

    await expect(
      removePrivateItemsForAuthorizedReset(['onskin.shelf.v1'], 'account_isolation'),
    ).resolves.toBeUndefined();

    expect(mocks.asyncStorage.has('onskin.shelf.v1')).toBe(false);
  });

  it('allows account isolation to remove registered owner metadata', async () => {
    mocks.asyncStorage.set('routinekind.localDataOwnerHash.v1', 'owner-hash');
    beginPrivateKVAccountBoundary();

    await expect(
      removePrivateItemsForAuthorizedReset(
        ['routinekind.localDataOwnerHash.v1'],
        'account_isolation',
      ),
    ).resolves.toBeUndefined();

    expect(mocks.asyncStorage.has('routinekind.localDataOwnerHash.v1')).toBe(false);
  });

  it('rejects account-isolation authority for control, delegated, and unknown keys', async () => {
    const excludedKeys = [
      'routinekind.accountDeletionVendorFreeze.v1',
      'onskin.plaintext_staging_journal.v1',
      'onskin.private_kv.content_key.v1',
      'onskin.unregistered.v1',
    ];
    for (const key of excludedKeys) mocks.asyncStorage.set(key, `${key}:bytes`);
    beginPrivateKVAccountBoundary();

    for (const key of excludedKeys) {
      await expect(
        removePrivateItemsForAuthorizedReset([key], 'account_isolation'),
      ).rejects.toThrow(PRIVATE_KV_AUTHORIZED_RESET_REASON_INVALID);
      expect(mocks.asyncStorage.get(key)).toBe(`${key}:bytes`);
    }
  });

  it('allows device-authenticated repair to remove only the app-lock preference', async () => {
    const malformed = '{"version":"xchacha20poly1305:v1","nonceHex":"invalid"';
    mocks.asyncStorage.set('onskin.appLock.enabled', malformed);

    await expect(
      removePrivateItemsForAuthorizedReset(
        ['onskin.appLock.enabled'],
        'device_authenticated_app_lock_repair',
      ),
    ).resolves.toBeUndefined();

    expect(mocks.asyncStorage.has('onskin.appLock.enabled')).toBe(false);
  });

  it('rejects app-lock repair authority for every other private key', async () => {
    mocks.asyncStorage.set('onskin.appLock.enabled', 'app-lock-bytes');
    mocks.asyncStorage.set('onskin.shelf.v1', 'shelf-bytes');

    await expect(
      removePrivateItemsForAuthorizedReset(
        ['onskin.appLock.enabled', 'onskin.shelf.v1'],
        'device_authenticated_app_lock_repair',
      ),
    ).rejects.toThrow(PRIVATE_KV_AUTHORIZED_RESET_REASON_INVALID);
    await expect(
      removePrivateItemsForAuthorizedReset(
        ['onskin.shelf.v1'],
        'device_authenticated_app_lock_repair',
      ),
    ).rejects.toThrow(PRIVATE_KV_AUTHORIZED_RESET_REASON_INVALID);

    expect(mocks.asyncStorage.get('onskin.appLock.enabled')).toBe('app-lock-bytes');
    expect(mocks.asyncStorage.get('onskin.shelf.v1')).toBe('shelf-bytes');
  });

  it('rejects an unreviewed destructive-reset reason at runtime', async () => {
    mocks.asyncStorage.set('onskin.protected-reset', 'private-bytes');

    await expect(
      removePrivateItemsForAuthorizedReset(
        ['onskin.protected-reset'],
        'routine_feature_clear' as never,
      ),
    ).rejects.toThrow(PRIVATE_KV_AUTHORIZED_RESET_REASON_INVALID);

    expect(mocks.asyncStorage.get('onskin.protected-reset')).toBe('private-bytes');
  });

  it('rejects account-isolation reset authority outside the active boundary', async () => {
    mocks.asyncStorage.set('onskin.protected-reset', 'private-bytes');

    await expect(
      removePrivateItemsForAuthorizedReset(['onskin.protected-reset'], 'account_isolation'),
    ).rejects.toThrow(PRIVATE_KV_AUTHORIZED_RESET_REASON_INVALID);

    expect(mocks.asyncStorage.get('onskin.protected-reset')).toBe('private-bytes');
  });

  it('preserves keyless ciphertext and refuses replacement key material', async () => {
    await setPrivateItem('custom.encrypted-a', 'value-a');
    mocks.secureStorage.clear();

    await expect(getPrivateItems(['custom.encrypted-a'])).rejects.toThrow(
      PRIVATE_KV_CONTENT_KEY_MISSING,
    );
    await expect(setPrivateItem('onskin.new-record', 'new-value')).rejects.toThrow(
      PRIVATE_KV_CONTENT_KEY_MISSING,
    );

    expect(mocks.secureStorage.size).toBe(0);
    expect(mocks.asyncStorage.has('custom.encrypted-a')).toBe(true);
    expect(mocks.asyncStorage.has('onskin.new-record')).toBe(false);
  });

  it('preserves ciphertext and rejects a malformed existing content key', async () => {
    await setPrivateItem('onskin.encrypted-a', 'value-a');
    mocks.secureStorage.set(privateKVEncryptionInfo.secureStoreKey, 'malformed-key');

    await expect(getPrivateItem('onskin.encrypted-a')).rejects.toThrow(
      PRIVATE_KV_CONTENT_KEY_INVALID,
    );

    expect(mocks.secureStorage.get(privateKVEncryptionInfo.secureStoreKey)).toBe('malformed-key');
    expect(mocks.asyncStorage.has('onskin.encrypted-a')).toBe(true);
  });

  it('preserves ciphertext when a different valid content key cannot authenticate it', async () => {
    await setPrivateItem('onskin.encrypted-a', 'value-a');
    const originalCiphertext = mocks.asyncStorage.get('onskin.encrypted-a');
    mocks.secureStorage.set(privateKVEncryptionInfo.secureStoreKey, 'a'.repeat(64));

    await expect(setPrivateItem('onskin.encrypted-a', 'replacement')).rejects.toThrow(
      PRIVATE_KV_DECRYPTION_FAILED,
    );
    await expect(getPrivateItem('onskin.encrypted-a')).rejects.toThrow(
      PRIVATE_KV_DECRYPTION_FAILED,
    );

    expect(mocks.asyncStorage.get('onskin.encrypted-a')).toBe(originalCiphertext);
  });

  it('blocks a fallback rewrite until the failed encrypted read succeeds', async () => {
    await setPrivateItem('onskin.profile', 'original-value');
    const originalCiphertext = mocks.asyncStorage.get('onskin.profile');
    mocks.secureGetThrows = true;

    await expect(getPrivateItem('onskin.profile')).rejects.toThrow(
      'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE',
    );
    mocks.secureGetThrows = false;

    await expect(setPrivateItem('onskin.profile', 'fallback-value')).rejects.toThrow(
      PRIVATE_KV_WRITE_BLOCKED_AFTER_READ_FAILURE,
    );
    expect(mocks.asyncStorage.get('onskin.profile')).toBe(originalCiphertext);

    await expect(getPrivateItem('onskin.profile')).resolves.toBe('original-value');
    await expect(setPrivateItem('onskin.profile', 'updated-value')).resolves.toBeUndefined();
    await expect(getPrivateItem('onskin.profile')).resolves.toBe('updated-value');
  });

  it('serializes complete read-modify-write transforms for one private key', async () => {
    await setPrivateItem('onskin.conflict.overrides', JSON.stringify({ first: true }));

    await Promise.all([
      updatePrivateItem('onskin.conflict.overrides', (raw) =>
        JSON.stringify({ ...(JSON.parse(raw ?? '{}') as object), second: true }),
      ),
      updatePrivateItem('onskin.conflict.overrides', (raw) =>
        JSON.stringify({ ...(JSON.parse(raw ?? '{}') as object), third: true }),
      ),
    ]);

    const stored = await getPrivateItem('onskin.conflict.overrides');
    expect(JSON.parse(stored ?? '{}')).toEqual({ first: true, second: true, third: true });
  });
});
