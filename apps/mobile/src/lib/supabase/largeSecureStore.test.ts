import * as aesjs from 'aes-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bytesToHex, hexToBytes } from '@noble/ciphers/utils.js';
import * as SecureStore from 'expo-secure-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LARGE_SECURE_STORE_CONTENT_KEY_INVALID,
  LARGE_SECURE_STORE_CONTENT_KEY_MISSING,
  LARGE_SECURE_STORE_CONTENT_KEY_STORAGE_UNAVAILABLE,
  LARGE_SECURE_STORE_DECRYPTION_FAILED,
  LARGE_SECURE_STORE_ENVELOPE_UNSUPPORTED,
  LARGE_SECURE_STORE_ROLLBACK_FAILED,
  LargeSecureStore,
} from './largeSecureStore';
import {
  decryptLargeSecureStoreValue,
  encryptLargeSecureStoreValue,
} from './largeSecureStoreCrypto';

const mocks = vi.hoisted(() => ({
  asyncGetItem: vi.fn(),
  asyncRemoveItem: vi.fn(),
  asyncSetItem: vi.fn(),
  asyncStorage: new Map<string, string>(),
  secureDeleteItem: vi.fn(),
  secureGetItem: vi.fn(),
  secureSetItem: vi.fn(),
  secureStorage: new Map<string, string>(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: mocks.asyncGetItem,
    setItem: mocks.asyncSetItem,
    removeItem: mocks.asyncRemoveItem,
  },
}));

vi.mock('react-native-get-random-values', () => ({}));

vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7,
  getItemAsync: mocks.secureGetItem,
  setItemAsync: mocks.secureSetItem,
  deleteItemAsync: mocks.secureDeleteItem,
}));

const KEY_NAME = 'supabase.auth.token';
const CONTENT_KEY = Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 1));

function legacyAesCtrCiphertext(value: string): string {
  const cipher = new aesjs.ModeOfOperation.ctr(CONTENT_KEY, new aesjs.Counter(1));
  return aesjs.utils.hex.fromBytes(cipher.encrypt(aesjs.utils.utf8.toBytes(value)));
}

function tamperCiphertext(encrypted: string): string {
  const envelope = JSON.parse(encrypted) as { ciphertextHex: string };
  const last = envelope.ciphertextHex.at(-1);
  envelope.ciphertextHex = `${envelope.ciphertextHex.slice(0, -1)}${last === '0' ? '1' : '0'}`;
  return JSON.stringify(envelope);
}

function authoritySnapshot() {
  const sort = (entries: Iterable<[string, string]>) =>
    [...entries].sort(([left], [right]) => left.localeCompare(right));
  return {
    asyncStorage: sort(mocks.asyncStorage.entries()),
    secureStorage: sort(mocks.secureStorage.entries()),
  };
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('LargeSecureStore session wrapper', () => {
  beforeEach(() => {
    mocks.asyncStorage.clear();
    mocks.secureStorage.clear();
    mocks.asyncGetItem.mockReset();
    mocks.asyncRemoveItem.mockReset();
    mocks.asyncSetItem.mockReset();
    mocks.secureDeleteItem.mockReset();
    mocks.secureGetItem.mockReset();
    mocks.secureSetItem.mockReset();

    mocks.asyncGetItem.mockImplementation(
      async (key: string) => mocks.asyncStorage.get(key) ?? null,
    );
    mocks.asyncRemoveItem.mockImplementation(async (key: string) => {
      mocks.asyncStorage.delete(key);
    });
    mocks.asyncSetItem.mockImplementation(async (key: string, value: string) => {
      mocks.asyncStorage.set(key, value);
    });
    mocks.secureDeleteItem.mockImplementation(async (key: string) => {
      mocks.secureStorage.delete(key);
    });
    mocks.secureGetItem.mockImplementation(
      async (key: string) => mocks.secureStorage.get(key) ?? null,
    );
    mocks.secureSetItem.mockImplementation(async (key: string, value: string) => {
      mocks.secureStorage.set(key, value);
    });
  });

  it('roundtrips Supabase session JSON through encrypted AsyncStorage', async () => {
    const store = new LargeSecureStore();
    const session = JSON.stringify({ access_token: 'at', refresh_token: 'rt' });

    await store.setItem(KEY_NAME, session);

    const raw = mocks.asyncStorage.get(KEY_NAME);
    expect(raw).toBeDefined();
    expect(raw).not.toContain('access_token');
    expect(mocks.secureStorage.get(KEY_NAME)).toMatch(/^[0-9a-f]{64}$/);
    await expect(store.getItem(KEY_NAME)).resolves.toBe(session);
  });

  it('preserves the encrypted session when the SecureStore content key is missing', async () => {
    const store = new LargeSecureStore();
    const encrypted = encryptLargeSecureStoreValue('session', CONTENT_KEY);
    mocks.asyncStorage.set(KEY_NAME, encrypted);

    await expect(store.getItem(KEY_NAME)).rejects.toThrow(LARGE_SECURE_STORE_CONTENT_KEY_MISSING);

    expect(mocks.asyncStorage.get(KEY_NAME)).toBe(encrypted);
    expect(mocks.secureStorage.has(KEY_NAME)).toBe(false);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('preserves both stores when the SecureStore content key is malformed', async () => {
    const store = new LargeSecureStore();
    const malformedKey = 'not-hex';
    const encrypted = encryptLargeSecureStoreValue('session', CONTENT_KEY);
    mocks.secureStorage.set(KEY_NAME, malformedKey);
    mocks.asyncStorage.set(KEY_NAME, encrypted);

    await expect(store.getItem(KEY_NAME)).rejects.toThrow(LARGE_SECURE_STORE_CONTENT_KEY_INVALID);
    await expect(store.setItem(KEY_NAME, 'replacement')).rejects.toThrow(
      LARGE_SECURE_STORE_CONTENT_KEY_INVALID,
    );

    expect(mocks.asyncStorage.get(KEY_NAME)).toBe(encrypted);
    expect(mocks.secureStorage.get(KEY_NAME)).toBe(malformedKey);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('preserves both stores when the encrypted session envelope is tampered', async () => {
    const store = new LargeSecureStore();
    const contentKeyHex = bytesToHex(CONTENT_KEY);
    const encrypted = tamperCiphertext(encryptLargeSecureStoreValue('session', CONTENT_KEY));
    mocks.secureStorage.set(KEY_NAME, contentKeyHex);
    mocks.asyncStorage.set(KEY_NAME, encrypted);

    await expect(store.getItem(KEY_NAME)).rejects.toThrow(LARGE_SECURE_STORE_DECRYPTION_FAILED);
    await expect(store.setItem(KEY_NAME, 'replacement')).rejects.toThrow(
      LARGE_SECURE_STORE_DECRYPTION_FAILED,
    );

    expect(mocks.asyncStorage.get(KEY_NAME)).toBe(encrypted);
    expect(mocks.secureStorage.get(KEY_NAME)).toBe(contentKeyHex);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('preserves both stores when the encrypted session envelope is malformed', async () => {
    const store = new LargeSecureStore();
    const contentKeyHex = bytesToHex(CONTENT_KEY);
    const malformedEnvelope = '';
    mocks.secureStorage.set(KEY_NAME, contentKeyHex);
    mocks.asyncStorage.set(KEY_NAME, malformedEnvelope);

    await expect(store.getItem(KEY_NAME)).rejects.toThrow(LARGE_SECURE_STORE_DECRYPTION_FAILED);
    await expect(store.setItem(KEY_NAME, 'replacement')).rejects.toThrow(
      LARGE_SECURE_STORE_DECRYPTION_FAILED,
    );

    expect(mocks.asyncStorage.get(KEY_NAME)).toBe(malformedEnvelope);
    expect(mocks.secureStorage.get(KEY_NAME)).toBe(contentKeyHex);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('preserves both stores when a well-formed but incorrect content key cannot decrypt', async () => {
    const store = new LargeSecureStore();
    const incorrectKeyHex = 'a'.repeat(64);
    const encrypted = encryptLargeSecureStoreValue('session', CONTENT_KEY);
    mocks.secureStorage.set(KEY_NAME, incorrectKeyHex);
    mocks.asyncStorage.set(KEY_NAME, encrypted);

    await expect(store.getItem(KEY_NAME)).rejects.toThrow(LARGE_SECURE_STORE_DECRYPTION_FAILED);
    await expect(store.setItem(KEY_NAME, 'replacement')).rejects.toThrow(
      LARGE_SECURE_STORE_DECRYPTION_FAILED,
    );

    expect(mocks.asyncStorage.get(KEY_NAME)).toBe(encrypted);
    expect(mocks.secureStorage.get(KEY_NAME)).toBe(incorrectKeyHex);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('preserves both stores when SecureStore is temporarily unavailable', async () => {
    const store = new LargeSecureStore();
    const contentKeyHex = bytesToHex(CONTENT_KEY);
    const encrypted = encryptLargeSecureStoreValue('session', CONTENT_KEY);
    mocks.secureStorage.set(KEY_NAME, contentKeyHex);
    mocks.asyncStorage.set(KEY_NAME, encrypted);
    vi.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('temporarily unavailable'));

    await expect(store.getItem(KEY_NAME)).rejects.toThrow(
      LARGE_SECURE_STORE_CONTENT_KEY_STORAGE_UNAVAILABLE,
    );
    vi.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('temporarily unavailable'));
    await expect(store.setItem(KEY_NAME, 'replacement')).rejects.toThrow(
      LARGE_SECURE_STORE_CONTENT_KEY_STORAGE_UNAVAILABLE,
    );

    expect(mocks.asyncStorage.get(KEY_NAME)).toBe(encrypted);
    expect(mocks.secureStorage.get(KEY_NAME)).toBe(contentKeyHex);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('does not replace a missing content key while an encrypted session exists', async () => {
    const store = new LargeSecureStore();
    const encrypted = encryptLargeSecureStoreValue('existing session', CONTENT_KEY);
    mocks.asyncStorage.set(KEY_NAME, encrypted);

    await expect(store.setItem(KEY_NAME, 'replacement session')).rejects.toThrow(
      LARGE_SECURE_STORE_CONTENT_KEY_MISSING,
    );

    expect(mocks.asyncStorage.get(KEY_NAME)).toBe(encrypted);
    expect(mocks.secureStorage.has(KEY_NAME)).toBe(false);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('preserves future envelope and key bytes across reads and explicit sets', async () => {
    const store = new LargeSecureStore();
    const future = JSON.parse(
      encryptLargeSecureStoreValue('future session', CONTENT_KEY),
    ) as Record<string, unknown>;
    future.version = 'xchacha20poly1305:v2';
    const raw = JSON.stringify(future);
    mocks.asyncStorage.set(KEY_NAME, raw);
    mocks.secureStorage.set(KEY_NAME, bytesToHex(CONTENT_KEY));
    const before = authoritySnapshot();

    await expect(store.getItem(KEY_NAME)).rejects.toThrow(LARGE_SECURE_STORE_ENVELOPE_UNSUPPORTED);
    await expect(store.setItem(KEY_NAME, 'replacement')).rejects.toThrow(
      LARGE_SECURE_STORE_ENVELOPE_UNSUPPORTED,
    );

    expect(authoritySnapshot()).toEqual(before);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('returns a valid encrypted empty value without treating it as missing or rewriting it', async () => {
    const store = new LargeSecureStore();
    const encrypted = encryptLargeSecureStoreValue('', CONTENT_KEY);
    mocks.asyncStorage.set(KEY_NAME, encrypted);
    mocks.secureStorage.set(KEY_NAME, bytesToHex(CONTENT_KEY));

    await expect(store.getItem(KEY_NAME)).resolves.toBe('');

    expect(mocks.asyncStorage.get(KEY_NAME)).toBe(encrypted);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('preserves both authorities when the AsyncStorage read fails', async () => {
    const store = new LargeSecureStore();
    const encrypted = encryptLargeSecureStoreValue('session', CONTENT_KEY);
    mocks.asyncStorage.set(KEY_NAME, encrypted);
    mocks.secureStorage.set(KEY_NAME, bytesToHex(CONTENT_KEY));
    const before = authoritySnapshot();
    mocks.asyncGetItem.mockRejectedValueOnce(new Error('async read unavailable'));

    await expect(store.getItem(KEY_NAME)).rejects.toThrow('async read unavailable');
    mocks.asyncGetItem.mockRejectedValueOnce(new Error('async read unavailable'));
    await expect(store.setItem(KEY_NAME, 'replacement')).rejects.toThrow('async read unavailable');

    expect(authoritySnapshot()).toEqual(before);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('restores an existing current envelope byte-for-byte after an AsyncStorage write failure', async () => {
    const store = new LargeSecureStore();
    const encrypted = encryptLargeSecureStoreValue('original session', CONTENT_KEY);
    mocks.asyncStorage.set(KEY_NAME, encrypted);
    mocks.secureStorage.set(KEY_NAME, bytesToHex(CONTENT_KEY));
    const before = authoritySnapshot();
    mocks.asyncSetItem.mockImplementationOnce(async (key: string, value: string) => {
      mocks.asyncStorage.set(key, value);
      throw new Error('async write failed after commit');
    });

    await expect(store.setItem(KEY_NAME, 'replacement session')).rejects.toThrow(
      'async write failed after commit',
    );

    expect(authoritySnapshot()).toEqual(before);
    expect(mocks.asyncSetItem).toHaveBeenCalledTimes(2);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('removes a newly created content key when the first AsyncStorage write fails', async () => {
    const store = new LargeSecureStore();
    const before = authoritySnapshot();
    mocks.asyncSetItem.mockImplementationOnce(async (key: string, value: string) => {
      mocks.asyncStorage.set(key, value);
      throw new Error('first async write failed after commit');
    });

    await expect(store.setItem(KEY_NAME, 'new session')).rejects.toThrow(
      'first async write failed after commit',
    );

    expect(authoritySnapshot()).toEqual(before);
    expect(mocks.asyncRemoveItem).toHaveBeenCalledWith(KEY_NAME);
    expect(mocks.secureDeleteItem).toHaveBeenCalledWith(
      KEY_NAME,
      expect.objectContaining({ keychainAccessible: 7 }),
    );
  });

  it('keeps a newly created key when failed ciphertext cleanup cannot be verified', async () => {
    const store = new LargeSecureStore();
    mocks.asyncSetItem.mockImplementationOnce(async (key: string, value: string) => {
      mocks.asyncStorage.set(key, value);
      throw new Error('first async write failed after commit');
    });
    mocks.asyncRemoveItem.mockRejectedValueOnce(new Error('ciphertext removal unavailable'));

    await expect(store.setItem(KEY_NAME, 'recoverable session')).rejects.toThrow(
      LARGE_SECURE_STORE_ROLLBACK_FAILED,
    );

    const encrypted = mocks.asyncStorage.get(KEY_NAME);
    const contentKeyHex = mocks.secureStorage.get(KEY_NAME);
    expect(encrypted).toBeDefined();
    expect(contentKeyHex).toMatch(/^[0-9a-f]{64}$/);
    expect(decryptLargeSecureStoreValue(encrypted ?? '', hexToBytes(contentKeyHex ?? ''))).toEqual({
      kind: 'current',
      plaintext: 'recoverable session',
    });
    expect(mocks.secureDeleteItem).not.toHaveBeenCalled();
  });

  it('removes content-key bytes when SecureStore creation reports a post-commit failure', async () => {
    const store = new LargeSecureStore();
    const before = authoritySnapshot();
    mocks.secureSetItem.mockImplementationOnce(async (key: string, value: string) => {
      mocks.secureStorage.set(key, value);
      throw new Error('secure write failed after commit');
    });

    await expect(store.setItem(KEY_NAME, 'new session')).rejects.toThrow(
      'secure write failed after commit',
    );

    expect(authoritySnapshot()).toEqual(before);
    expect(mocks.asyncSetItem).not.toHaveBeenCalled();
    expect(mocks.secureDeleteItem).toHaveBeenCalledWith(
      KEY_NAME,
      expect.objectContaining({ keychainAccessible: 7 }),
    );
  });

  it('restores both stores if SecureStore deletion fails after removing bytes', async () => {
    const store = new LargeSecureStore();
    const encrypted = encryptLargeSecureStoreValue('session', CONTENT_KEY);
    mocks.asyncStorage.set(KEY_NAME, encrypted);
    mocks.secureStorage.set(KEY_NAME, bytesToHex(CONTENT_KEY));
    const before = authoritySnapshot();
    mocks.secureDeleteItem.mockImplementationOnce(async (key: string) => {
      mocks.secureStorage.delete(key);
      throw new Error('secure delete failed after commit');
    });

    await expect(store.removeItem(KEY_NAME)).rejects.toThrow('secure delete failed after commit');

    expect(authoritySnapshot()).toEqual(before);
    expect(mocks.asyncSetItem).toHaveBeenCalledWith(KEY_NAME, encrypted);
    expect(mocks.secureSetItem).toHaveBeenCalledWith(
      KEY_NAME,
      bytesToHex(CONTENT_KEY),
      expect.objectContaining({ keychainAccessible: 7 }),
    );
    expect(mocks.secureSetItem.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.asyncSetItem.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });

  it('does not restore removed ciphertext when its content key cannot be restored', async () => {
    const store = new LargeSecureStore();
    const encrypted = encryptLargeSecureStoreValue('session', CONTENT_KEY);
    mocks.asyncStorage.set(KEY_NAME, encrypted);
    mocks.secureStorage.set(KEY_NAME, bytesToHex(CONTENT_KEY));
    mocks.secureDeleteItem.mockImplementationOnce(async (key: string) => {
      mocks.secureStorage.delete(key);
      throw new Error('secure delete failed after commit');
    });
    mocks.secureSetItem.mockResolvedValueOnce(undefined);

    await expect(store.removeItem(KEY_NAME)).rejects.toThrow(LARGE_SECURE_STORE_ROLLBACK_FAILED);

    expect(mocks.secureStorage.has(KEY_NAME)).toBe(false);
    expect(mocks.asyncStorage.has(KEY_NAME)).toBe(false);
    expect(mocks.asyncSetItem).not.toHaveBeenCalled();
  });

  it('only destroys session bytes through an explicit removeItem call', async () => {
    const store = new LargeSecureStore();
    mocks.asyncStorage.set(KEY_NAME, 'encrypted session');
    mocks.secureStorage.set(KEY_NAME, bytesToHex(CONTENT_KEY));

    await store.removeItem(KEY_NAME);

    expect(mocks.asyncStorage.has(KEY_NAME)).toBe(false);
    expect(mocks.secureStorage.has(KEY_NAME)).toBe(false);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(KEY_NAME);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      KEY_NAME,
      expect.objectContaining({ keychainAccessible: 7 }),
    );
  });

  it('keeps legacy AES-CTR bytes read-only until the next explicit set writes v1', async () => {
    const store = new LargeSecureStore();
    const session = JSON.stringify({ access_token: 'legacy-at', refresh_token: 'legacy-rt' });
    const legacy = legacyAesCtrCiphertext(session);
    mocks.secureStorage.set(KEY_NAME, bytesToHex(CONTENT_KEY));
    mocks.asyncStorage.set(KEY_NAME, legacy);

    await expect(store.getItem(KEY_NAME)).resolves.toBe(session);

    expect(mocks.asyncStorage.get(KEY_NAME)).toBe(legacy);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    await store.setItem(KEY_NAME, session);

    const migrated = mocks.asyncStorage.get(KEY_NAME);
    expect(migrated).toBeDefined();
    expect(migrated).not.toBe(legacy);
    expect(decryptLargeSecureStoreValue(migrated ?? '', CONTENT_KEY)).toEqual({
      kind: 'current',
      plaintext: session,
    });
  });

  it('serializes a legacy migration-source read against a later set across store instances', async () => {
    const session = JSON.stringify({ access_token: 'legacy-at', refresh_token: 'legacy-rt' });
    const legacy = legacyAesCtrCiphertext(session);
    mocks.secureStorage.set(KEY_NAME, bytesToHex(CONTENT_KEY));
    mocks.asyncStorage.set(KEY_NAME, legacy);
    const readStarted = deferred();
    const releaseRead = deferred();
    mocks.secureGetItem.mockImplementationOnce(async (key: string) => {
      readStarted.resolve();
      await releaseRead.promise;
      return mocks.secureStorage.get(key) ?? null;
    });

    const read = new LargeSecureStore().getItem(KEY_NAME);
    await readStarted.promise;
    const write = new LargeSecureStore().setItem(KEY_NAME, 'new session');
    await Promise.resolve();

    expect(mocks.asyncGetItem).toHaveBeenCalledTimes(1);
    expect(mocks.asyncSetItem).not.toHaveBeenCalled();

    releaseRead.resolve();
    await expect(read).resolves.toBe(session);
    await write;

    expect(mocks.asyncSetItem).toHaveBeenCalledTimes(1);
    expect(
      decryptLargeSecureStoreValue(mocks.asyncStorage.get(KEY_NAME) ?? '', CONTENT_KEY),
    ).toEqual({ kind: 'current', plaintext: 'new session' });
  });

  it('serializes a legacy migration-source read against remove without resurrecting ciphertext', async () => {
    const session = JSON.stringify({ access_token: 'legacy-at', refresh_token: 'legacy-rt' });
    const legacy = legacyAesCtrCiphertext(session);
    mocks.secureStorage.set(KEY_NAME, bytesToHex(CONTENT_KEY));
    mocks.asyncStorage.set(KEY_NAME, legacy);
    const readStarted = deferred();
    const releaseRead = deferred();
    mocks.secureGetItem.mockImplementationOnce(async (key: string) => {
      readStarted.resolve();
      await releaseRead.promise;
      return mocks.secureStorage.get(key) ?? null;
    });

    const read = new LargeSecureStore().getItem(KEY_NAME);
    await readStarted.promise;
    const removal = new LargeSecureStore().removeItem(KEY_NAME);
    await Promise.resolve();

    expect(mocks.asyncGetItem).toHaveBeenCalledTimes(1);
    expect(mocks.asyncRemoveItem).not.toHaveBeenCalled();
    expect(mocks.secureDeleteItem).not.toHaveBeenCalled();

    releaseRead.resolve();
    await expect(read).resolves.toBe(session);
    await removal;

    expect(mocks.asyncStorage.has(KEY_NAME)).toBe(false);
    expect(mocks.secureStorage.has(KEY_NAME)).toBe(false);
    expect(mocks.asyncSetItem).not.toHaveBeenCalled();
  });

  it('serializes set against remove so the later explicit removal wins', async () => {
    const writeStarted = deferred();
    const releaseWrite = deferred();
    mocks.asyncSetItem.mockImplementationOnce(async (key: string, value: string) => {
      writeStarted.resolve();
      await releaseWrite.promise;
      mocks.asyncStorage.set(key, value);
    });

    const write = new LargeSecureStore().setItem(KEY_NAME, 'session');
    await writeStarted.promise;
    const removal = new LargeSecureStore().removeItem(KEY_NAME);
    await Promise.resolve();

    expect(mocks.asyncGetItem).toHaveBeenCalledTimes(1);
    expect(mocks.secureGetItem).toHaveBeenCalledTimes(1);
    expect(mocks.asyncRemoveItem).not.toHaveBeenCalled();
    expect(mocks.secureDeleteItem).not.toHaveBeenCalled();

    releaseWrite.resolve();
    await write;
    await removal;

    expect(mocks.asyncStorage.has(KEY_NAME)).toBe(false);
    expect(mocks.secureStorage.has(KEY_NAME)).toBe(false);
  });

  it('serializes 100 queued same-key get, set, and remove operations in invocation order', async () => {
    const firstWriteStarted = deferred();
    const releaseFirstWrite = deferred();
    mocks.asyncSetItem.mockImplementationOnce(async (key: string, value: string) => {
      firstWriteStarted.resolve();
      await releaseFirstWrite.promise;
      mocks.asyncStorage.set(key, value);
    });

    const operations = Array.from({ length: 100 }, (_, index) => {
      const store = new LargeSecureStore();
      if (index % 3 === 0) return store.setItem(KEY_NAME, String(index));
      if (index % 3 === 1) return store.getItem(KEY_NAME);
      return store.removeItem(KEY_NAME);
    });
    await firstWriteStarted.promise;

    expect(mocks.asyncGetItem).toHaveBeenCalledTimes(1);
    expect(mocks.secureGetItem).toHaveBeenCalledTimes(1);
    expect(mocks.asyncSetItem).toHaveBeenCalledTimes(1);

    releaseFirstWrite.resolve();
    const results = await Promise.all(operations);

    for (let index = 1; index < results.length; index += 3) {
      expect(results[index]).toBe(String(index - 1));
    }
    expect(mocks.asyncSetItem).toHaveBeenCalledTimes(34);
    await expect(new LargeSecureStore().getItem(KEY_NAME)).resolves.toBe('99');
  });
});
