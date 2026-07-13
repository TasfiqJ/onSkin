// LargeSecureStore (docs/01 §5): SecureStore has a ~2KB limit and the Supabase
// session JSON exceeds it. So we keep the content key in SecureStore (small) and
// store an authenticated encrypted session envelope in AsyncStorage.
import 'react-native-get-random-values'; // polyfills crypto.getRandomValues
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bytesToHex, hexToBytes, randomBytes } from '@noble/ciphers/utils.js';
import * as SecureStore from 'expo-secure-store';

import {
  decryptLargeSecureStoreValue,
  encryptLargeSecureStoreValue,
} from './largeSecureStoreCrypto';

const CONTENT_KEY_BYTES = 32;

export const LARGE_SECURE_STORE_CONTENT_KEY_MISSING = 'LARGE_SECURE_STORE_CONTENT_KEY_MISSING';
export const LARGE_SECURE_STORE_CONTENT_KEY_INVALID = 'LARGE_SECURE_STORE_CONTENT_KEY_INVALID';
export const LARGE_SECURE_STORE_CONTENT_KEY_STORAGE_UNAVAILABLE =
  'LARGE_SECURE_STORE_CONTENT_KEY_STORAGE_UNAVAILABLE';
export const LARGE_SECURE_STORE_DECRYPTION_FAILED = 'LARGE_SECURE_STORE_DECRYPTION_FAILED';

const contentKeyCreations = new Map<string, Promise<Uint8Array>>();

export class LargeSecureStore {
  private async getContentKey(key: string): Promise<Uint8Array | null> {
    let existing: string | null;
    try {
      existing = await SecureStore.getItemAsync(key);
    } catch {
      throw new Error(LARGE_SECURE_STORE_CONTENT_KEY_STORAGE_UNAVAILABLE);
    }
    if (!existing) return null;
    if (!/^[0-9a-f]{64}$/i.test(existing)) {
      throw new Error(LARGE_SECURE_STORE_CONTENT_KEY_INVALID);
    }
    try {
      const decoded = hexToBytes(existing);
      if (decoded.length !== CONTENT_KEY_BYTES) {
        throw new Error(LARGE_SECURE_STORE_CONTENT_KEY_INVALID);
      }
      return decoded;
    } catch {
      throw new Error(LARGE_SECURE_STORE_CONTENT_KEY_INVALID);
    }
  }

  private async ensureContentKey(key: string): Promise<Uint8Array> {
    const existing = await this.getContentKey(key);
    if (existing) return existing;

    let creation = contentKeyCreations.get(key);
    if (!creation) {
      creation = (async () => {
        const rechecked = await this.getContentKey(key);
        if (rechecked) return rechecked;
        if ((await AsyncStorage.getItem(key)) !== null) {
          throw new Error(LARGE_SECURE_STORE_CONTENT_KEY_MISSING);
        }

        const contentKey = randomBytes(CONTENT_KEY_BYTES);
        try {
          await SecureStore.setItemAsync(key, bytesToHex(contentKey));
        } catch {
          throw new Error(LARGE_SECURE_STORE_CONTENT_KEY_STORAGE_UNAVAILABLE);
        }
        return contentKey;
      })();
      contentKeyCreations.set(key, creation);
    }

    try {
      return await creation;
    } finally {
      if (contentKeyCreations.get(key) === creation) contentKeyCreations.delete(key);
    }
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (encrypted === null) return null;
    const contentKey = await this.getContentKey(key);
    if (!contentKey) {
      throw new Error(LARGE_SECURE_STORE_CONTENT_KEY_MISSING);
    }

    const result = decryptLargeSecureStoreValue(encrypted, contentKey);
    if (result.plaintext === null) {
      throw new Error(LARGE_SECURE_STORE_DECRYPTION_FAILED);
    }
    if (result.needsMigration) {
      await AsyncStorage.setItem(key, encryptLargeSecureStoreValue(result.plaintext, contentKey));
    }
    return result.plaintext;
  }

  async setItem(key: string, value: string): Promise<void> {
    const contentKey = await this.ensureContentKey(key);
    const encrypted = encryptLargeSecureStoreValue(value, contentKey);
    await AsyncStorage.setItem(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }
}
