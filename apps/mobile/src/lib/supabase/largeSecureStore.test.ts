import * as aesjs from 'aes-js';
import { bytesToHex } from '@noble/ciphers/utils.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LargeSecureStore } from './largeSecureStore';
import {
  decryptLargeSecureStoreValue,
  encryptLargeSecureStoreValue,
} from './largeSecureStoreCrypto';

const mocks = vi.hoisted(() => ({
  asyncStorage: new Map<string, string>(),
  secureStorage: new Map<string, string>(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => mocks.asyncStorage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      mocks.asyncStorage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      mocks.asyncStorage.delete(key);
    }),
  },
}));

vi.mock('react-native-get-random-values', () => ({}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => mocks.secureStorage.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    mocks.secureStorage.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    mocks.secureStorage.delete(key);
  }),
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

describe('LargeSecureStore session wrapper', () => {
  beforeEach(() => {
    mocks.asyncStorage.clear();
    mocks.secureStorage.clear();
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

  it('removes the encrypted session when the SecureStore content key is missing', async () => {
    const store = new LargeSecureStore();
    mocks.asyncStorage.set(KEY_NAME, 'not readable without a key');

    await expect(store.getItem(KEY_NAME)).resolves.toBeNull();

    expect(mocks.asyncStorage.has(KEY_NAME)).toBe(false);
    expect(mocks.secureStorage.has(KEY_NAME)).toBe(false);
  });

  it('removes both stores when the SecureStore content key is malformed', async () => {
    const store = new LargeSecureStore();
    mocks.secureStorage.set(KEY_NAME, 'not-hex');
    mocks.asyncStorage.set(KEY_NAME, 'not readable with a malformed key');

    await expect(store.getItem(KEY_NAME)).resolves.toBeNull();

    expect(mocks.asyncStorage.has(KEY_NAME)).toBe(false);
    expect(mocks.secureStorage.has(KEY_NAME)).toBe(false);
  });

  it('removes both stores when the encrypted session envelope is tampered', async () => {
    const store = new LargeSecureStore();
    mocks.secureStorage.set(KEY_NAME, bytesToHex(CONTENT_KEY));
    mocks.asyncStorage.set(
      KEY_NAME,
      tamperCiphertext(encryptLargeSecureStoreValue('session', CONTENT_KEY)),
    );

    await expect(store.getItem(KEY_NAME)).resolves.toBeNull();

    expect(mocks.asyncStorage.has(KEY_NAME)).toBe(false);
    expect(mocks.secureStorage.has(KEY_NAME)).toBe(false);
  });

  it('migrates legacy AES-CTR session ciphertext to the authenticated envelope', async () => {
    const store = new LargeSecureStore();
    const session = JSON.stringify({ access_token: 'legacy-at', refresh_token: 'legacy-rt' });
    mocks.secureStorage.set(KEY_NAME, bytesToHex(CONTENT_KEY));
    mocks.asyncStorage.set(KEY_NAME, legacyAesCtrCiphertext(session));

    await expect(store.getItem(KEY_NAME)).resolves.toBe(session);

    const migrated = mocks.asyncStorage.get(KEY_NAME);
    expect(migrated).toBeDefined();
    expect(migrated).not.toBe(legacyAesCtrCiphertext(session));
    expect(decryptLargeSecureStoreValue(migrated ?? '', CONTENT_KEY)).toEqual({
      plaintext: session,
      needsMigration: false,
    });
  });
});
