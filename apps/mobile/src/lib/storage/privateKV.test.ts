import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getPrivateItem,
  getPrivateItems,
  privateKVEncryptionInfo,
  setPrivateItem,
} from './privateKV';

const mocks = vi.hoisted(() => ({
  asyncStorage: new Map<string, string>(),
  secureStorage: new Map<string, string>(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => mocks.asyncStorage.get(key) ?? null),
    multiGet: vi.fn(async (keys: string[]) =>
      keys.map((key) => [key, mocks.asyncStorage.get(key) ?? null] as [string, string | null]),
    ),
    setItem: vi.fn(async (key: string, value: string) => {
      mocks.asyncStorage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      mocks.asyncStorage.delete(key);
    }),
    multiRemove: vi.fn(async (keys: string[]) => {
      for (const key of keys) mocks.asyncStorage.delete(key);
    }),
  },
}));

vi.mock('react-native-get-random-values', () => ({}));

vi.mock('expo-secure-store', () => ({
  isAvailableAsync: vi.fn(async () => true),
  getItemAsync: vi.fn(async (key: string) => mocks.secureStorage.get(key) ?? null),
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
    mocks.secureStorage.clear();
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

  it('removes corrupt encrypted envelopes instead of throwing', async () => {
    mocks.asyncStorage.set(
      'corrupt-key',
      JSON.stringify({
        version: privateKVEncryptionInfo.version,
        nonceHex: 'not-hex',
        ciphertextHex: 'also-not-hex',
      }),
    );

    await expect(getPrivateItem('corrupt-key')).resolves.toBeNull();
    expect(mocks.asyncStorage.get('corrupt-key')).toBeUndefined();
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

  it('does not create replacement key material while batch-reading keyless ciphertext', async () => {
    await setPrivateItem('encrypted-a', 'value-a');
    mocks.secureStorage.clear();

    await expect(getPrivateItems(['encrypted-a'])).resolves.toEqual(
      new Map([['encrypted-a', null]]),
    );

    expect(mocks.secureStorage.size).toBe(0);
    expect(mocks.asyncStorage.has('encrypted-a')).toBe(false);
  });
});
