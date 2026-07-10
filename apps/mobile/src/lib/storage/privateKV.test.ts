import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertPrivateKVReadable,
  beginPrivateKVAccountBoundary,
  endPrivateKVAccountBoundary,
  getPrivateItem,
  getPrivateItems,
  PRIVATE_KV_CONTENT_KEY_INVALID,
  PRIVATE_KV_CONTENT_KEY_MISSING,
  PRIVATE_KV_DECRYPTION_FAILED,
  PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
  PRIVATE_KV_WRITE_BLOCKED_AFTER_READ_FAILURE,
  removePrivateItem,
  multiRemovePrivateItems,
  privateKVEncryptionInfo,
  setPrivateItem,
  waitForPrivateKVWritesToSettle,
} from './privateKV';

const mocks = vi.hoisted(() => ({
  asyncStorage: new Map<string, string>(),
  getItemGate: null as Promise<void> | null,
  getItemStarted: null as (() => void) | null,
  platformOS: 'ios',
  removeItemGate: null as Promise<void> | null,
  removeItemStarted: null as (() => void) | null,
  secureGetThrows: false,
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
      mocks.getItemStarted?.();
      if (mocks.getItemGate) await mocks.getItemGate;
      return mocks.asyncStorage.get(key) ?? null;
    }),
    getAllKeys: vi.fn(async () => [...mocks.asyncStorage.keys()]),
    multiGet: vi.fn(async (keys: string[]) =>
      keys.map((key) => [key, mocks.asyncStorage.get(key) ?? null] as [string, string | null]),
    ),
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
  isAvailableAsync: vi.fn(async () => true),
  getItemAsync: vi.fn(async (key: string) => {
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
    mocks.getItemGate = null;
    mocks.getItemStarted = null;
    mocks.platformOS = 'ios';
    mocks.removeItemGate = null;
    mocks.removeItemStarted = null;
    mocks.secureGetThrows = false;
    mocks.secureStorage.clear();
    mocks.setItemGate = null;
    mocks.setItemStarted = null;
    endPrivateKVAccountBoundary();
  });

  it('keeps legacy plaintext values readable', async () => {
    mocks.asyncStorage.set('legacy-key', 'legacy-value');

    await expect(getPrivateItem('legacy-key')).resolves.toBe('legacy-value');
  });

  it('roundtrips encrypted values through AsyncStorage', async () => {
    await setPrivateItem('routine-key', 'routine-value');

    const raw = mocks.asyncStorage.get('routine-key');
    expect(raw).toContain(privateKVEncryptionInfo.version);
    expect(raw).not.toContain('routine-value');
    await expect(getPrivateItem('routine-key')).resolves.toBe('routine-value');
  });

  it('preserves corrupt encrypted envelopes and reports decryption failure', async () => {
    await setPrivateItem('onskin.seed', 'seed');
    mocks.asyncStorage.set(
      'corrupt-key',
      JSON.stringify({
        version: privateKVEncryptionInfo.version,
        nonceHex: 'not-hex',
        ciphertextHex: 'also-not-hex',
      }),
    );

    await expect(getPrivateItem('corrupt-key')).rejects.toThrow(PRIVATE_KV_DECRYPTION_FAILED);
    expect(mocks.asyncStorage.get('corrupt-key')).toBeDefined();
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
    mocks.asyncStorage.set(
      'supabase.auth.token',
      JSON.stringify({
        version: privateKVEncryptionInfo.version,
        keyId: 'supabase-session-key-v1',
        nonceHex: 'not-private-kv',
        ciphertextHex: 'not-private-kv',
      }),
    );

    await expect(assertPrivateKVReadable()).resolves.toBeUndefined();
    await expect(getPrivateItem('onskin.profile')).resolves.toBe('profile-value');
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

  it('blocks private writes while an account boundary is active', async () => {
    beginPrivateKVAccountBoundary();

    await expect(setPrivateItem('onskin.account-b', 'value-b')).rejects.toThrow(
      PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
    );
    expect(mocks.asyncStorage.has('onskin.account-b')).toBe(false);
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
});
