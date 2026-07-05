import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PRIVATE_KV_CONTENT_KEY_NAME,
  clearStoredPrivateKVContentKey,
  getStoredPrivateKVContentKey,
  setStoredPrivateKVContentKey,
} from './privateKVContentKey';

const mocks = vi.hoisted(() => ({
  asyncStorage: new Map<string, string>(),
  secureStorage: new Map<string, string>(),
  secureAvailable: true,
  secureGetThrows: false,
  secureSetThrows: false,
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

vi.mock('expo-secure-store', () => ({
  isAvailableAsync: vi.fn(async () => mocks.secureAvailable),
  getItemAsync: vi.fn(async (key: string) => {
    if (mocks.secureGetThrows) throw new Error('secure store unavailable');
    return mocks.secureStorage.get(key) ?? null;
  }),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    if (mocks.secureSetThrows) throw new Error('secure store unavailable');
    mocks.secureStorage.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    mocks.secureStorage.delete(key);
  }),
}));

describe('private KV content key storage', () => {
  beforeEach(() => {
    mocks.asyncStorage.clear();
    mocks.secureStorage.clear();
    mocks.secureAvailable = true;
    mocks.secureGetThrows = false;
    mocks.secureSetThrows = false;
  });

  it('stores the content key in SecureStore when available', async () => {
    await setStoredPrivateKVContentKey('native-key');

    expect(await getStoredPrivateKVContentKey()).toBe('native-key');
    expect(mocks.secureStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBe('native-key');
    expect(mocks.asyncStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBeUndefined();
  });

  it('falls back to AsyncStorage when SecureStore is unavailable', async () => {
    mocks.secureAvailable = false;

    await setStoredPrivateKVContentKey('web-key');

    expect(await getStoredPrivateKVContentKey()).toBe('web-key');
    expect(mocks.secureStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBeUndefined();
    expect(mocks.asyncStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBe('web-key');
  });

  it('uses the AsyncStorage fallback when SecureStore throws at runtime', async () => {
    mocks.secureSetThrows = true;
    await setStoredPrivateKVContentKey('fallback-key');

    mocks.secureSetThrows = false;
    mocks.secureGetThrows = true;

    expect(await getStoredPrivateKVContentKey()).toBe('fallback-key');
  });

  it('clears native and fallback content keys together', async () => {
    mocks.secureStorage.set(PRIVATE_KV_CONTENT_KEY_NAME, 'native-key');
    mocks.asyncStorage.set(PRIVATE_KV_CONTENT_KEY_NAME, 'fallback-key');

    await clearStoredPrivateKVContentKey();

    expect(mocks.secureStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBeUndefined();
    expect(mocks.asyncStorage.get(PRIVATE_KV_CONTENT_KEY_NAME)).toBeUndefined();
  });
});
