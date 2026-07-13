import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PRIVATE_KV_CONTENT_KEY_CONFLICT,
  PRIVATE_KV_CONTENT_KEY_NAME,
  clearStoredPrivateKVContentKey,
  getStoredPrivateKVContentKey,
  setStoredPrivateKVContentKey,
} from './privateKVContentKey';

const mocks = vi.hoisted(() => ({
  asyncStorage: new Map<string, string>(),
  asyncRemoveThrows: false,
  platformOS: 'ios',
  secureDeleteThrows: false,
  secureStorage: new Map<string, string>(),
  secureAvailable: true,
  secureAvailableThrows: false,
  secureGetThrows: false,
  secureSetThrows: false,
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
    getItem: vi.fn(async (key: string) => mocks.asyncStorage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      mocks.asyncStorage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      if (mocks.asyncRemoveThrows) throw new Error('async remove failed');
      mocks.asyncStorage.delete(key);
    }),
  },
}));

vi.mock('expo-secure-store', () => ({
  isAvailableAsync: vi.fn(async () => {
    if (mocks.secureAvailableThrows) throw new Error('secure availability unavailable');
    return mocks.secureAvailable;
  }),
  getItemAsync: vi.fn(async (key: string) => {
    if (mocks.secureGetThrows) throw new Error('secure store unavailable');
    return mocks.secureStorage.get(key) ?? null;
  }),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    if (mocks.secureSetThrows) throw new Error('secure store unavailable');
    mocks.secureStorage.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    if (mocks.secureDeleteThrows) throw new Error('secure delete failed');
    mocks.secureStorage.delete(key);
  }),
}));

describe('private KV content key storage', () => {
  beforeEach(() => {
    mocks.asyncStorage.clear();
    mocks.asyncRemoveThrows = false;
    mocks.secureStorage.clear();
    mocks.platformOS = 'ios';
    mocks.secureAvailable = true;
    mocks.secureAvailableThrows = false;
    mocks.secureDeleteThrows = false;
    mocks.secureGetThrows = false;
    mocks.secureSetThrows = false;
  });

  it('stores the content key in SecureStore when available', async () => {
    await setStoredPrivateKVContentKey('native-key');

    expect(await getStoredPrivateKVContentKey()).toBe('native-key');
    expect(mocks.secureStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBe('native-key');
    expect(mocks.asyncStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBeUndefined();
  });

  it('uses AsyncStorage explicitly on web', async () => {
    mocks.platformOS = 'web';
    mocks.secureAvailable = false;

    await setStoredPrivateKVContentKey('web-key');

    expect(await getStoredPrivateKVContentKey()).toBe('web-key');
    expect(mocks.secureStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBeUndefined();
    expect(mocks.asyncStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBe('web-key');

    mocks.secureDeleteThrows = true;
    await expect(clearStoredPrivateKVContentKey()).resolves.toBeUndefined();
    expect(mocks.asyncStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBeUndefined();
  });

  it('fails closed when native SecureStore reports unavailable without a legacy fallback', async () => {
    mocks.secureAvailable = false;

    await expect(getStoredPrivateKVContentKey()).rejects.toThrow(
      'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE',
    );
    await expect(setStoredPrivateKVContentKey('native-key')).rejects.toThrow(
      'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE',
    );
    expect(mocks.asyncStorage.size).toBe(0);
  });

  it('preserves but does not trust a legacy fallback when native SecureStore read throws', async () => {
    mocks.asyncStorage.set(PRIVATE_KV_CONTENT_KEY_NAME, 'fallback-key');
    mocks.secureGetThrows = true;

    await expect(getStoredPrivateKVContentKey()).rejects.toThrow(
      'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE',
    );
    expect(mocks.asyncStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBe('fallback-key');
  });

  it.each(['unavailable', 'availability-error'] as const)(
    'preserves but does not trust a fallback when native SecureStore is %s',
    async (mode) => {
      mocks.asyncStorage.set(PRIVATE_KV_CONTENT_KEY_NAME, 'fallback-key');
      mocks.secureAvailable = mode !== 'unavailable';
      mocks.secureAvailableThrows = mode === 'availability-error';

      await expect(getStoredPrivateKVContentKey()).rejects.toThrow(
        'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE',
      );
      expect(mocks.asyncStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBe('fallback-key');
    },
  );

  it('migrates an existing native fallback into SecureStore after a definitive miss', async () => {
    mocks.asyncStorage.set(PRIVATE_KV_CONTENT_KEY_NAME, 'fallback-key');

    expect(await getStoredPrivateKVContentKey()).toBe('fallback-key');
    expect(mocks.secureStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBe('fallback-key');
    expect(mocks.asyncStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBeUndefined();
  });

  it('removes only an identical native fallback when SecureStore already has the key', async () => {
    const key = 'a'.repeat(64);
    mocks.secureStorage.set(PRIVATE_KV_CONTENT_KEY_NAME, key);
    mocks.asyncStorage.set(PRIVATE_KV_CONTENT_KEY_NAME, key);

    expect(await getStoredPrivateKVContentKey()).toBe(key);
    expect(mocks.asyncStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBeUndefined();
  });

  it('preserves a valid fallback when the SecureStore candidate is malformed', async () => {
    const fallback = 'b'.repeat(64);
    mocks.secureStorage.set(PRIVATE_KV_CONTENT_KEY_NAME, 'malformed-secure-key');
    mocks.asyncStorage.set(PRIVATE_KV_CONTENT_KEY_NAME, fallback);

    await expect(getStoredPrivateKVContentKey()).rejects.toThrow(
      PRIVATE_KV_CONTENT_KEY_CONFLICT,
    );

    expect(mocks.secureStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBe('malformed-secure-key');
    expect(mocks.asyncStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBe(fallback);
  });

  it('preserves both well-formed candidates when only ciphertext can prove which is correct', async () => {
    const secureCandidate = 'a'.repeat(64);
    const fallback = 'b'.repeat(64);
    mocks.secureStorage.set(PRIVATE_KV_CONTENT_KEY_NAME, secureCandidate);
    mocks.asyncStorage.set(PRIVATE_KV_CONTENT_KEY_NAME, fallback);

    await expect(getStoredPrivateKVContentKey()).rejects.toThrow(
      PRIVATE_KV_CONTENT_KEY_CONFLICT,
    );

    expect(mocks.secureStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBe(secureCandidate);
    expect(mocks.asyncStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBe(fallback);
  });

  it('refuses to overwrite or delete a conflicting fallback during key creation', async () => {
    const fallback = 'b'.repeat(64);
    mocks.asyncStorage.set(PRIVATE_KV_CONTENT_KEY_NAME, fallback);

    await expect(setStoredPrivateKVContentKey('a'.repeat(64))).rejects.toThrow(
      PRIVATE_KV_CONTENT_KEY_CONFLICT,
    );

    expect(mocks.secureStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBeUndefined();
    expect(mocks.asyncStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBe(fallback);
  });

  it('fails closed when native SecureStore cannot be read and no fallback exists', async () => {
    mocks.secureGetThrows = true;

    await expect(getStoredPrivateKVContentKey()).rejects.toThrow(
      'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE',
    );
    expect(mocks.asyncStorage.size).toBe(0);
  });

  it('does not downgrade new native key material when SecureStore write fails', async () => {
    mocks.secureSetThrows = true;

    await expect(setStoredPrivateKVContentKey('native-key')).rejects.toThrow(
      'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE',
    );
    expect(mocks.secureStorage.size).toBe(0);
    expect(mocks.asyncStorage.size).toBe(0);
  });

  it('clears native and fallback content keys together', async () => {
    mocks.secureStorage.set(PRIVATE_KV_CONTENT_KEY_NAME, 'native-key');
    mocks.asyncStorage.set(PRIVATE_KV_CONTENT_KEY_NAME, 'fallback-key');

    await clearStoredPrivateKVContentKey();

    expect(mocks.secureStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBeUndefined();
    expect(mocks.asyncStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBeUndefined();
  });

  it('reports key cleanup failure after attempting native and fallback deletion', async () => {
    mocks.secureStorage.set(PRIVATE_KV_CONTENT_KEY_NAME, 'native-key');
    mocks.asyncStorage.set(PRIVATE_KV_CONTENT_KEY_NAME, 'fallback-key');
    mocks.secureDeleteThrows = true;

    await expect(clearStoredPrivateKVContentKey()).rejects.toThrow(
      'PRIVATE_KV_CONTENT_KEY_CLEAR_FAILED:1',
    );

    expect(mocks.secureStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBe('native-key');
    expect(mocks.asyncStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBeUndefined();
  });
});
