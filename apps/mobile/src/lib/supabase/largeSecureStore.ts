// LargeSecureStore (docs/01 §5): SecureStore has a ~2KB limit and the Supabase
// session JSON exceeds it. So we keep the content key in SecureStore (small) and
// store an authenticated encrypted session envelope in AsyncStorage.
import 'react-native-get-random-values'; // polyfills crypto.getRandomValues
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bytesToHex, hexToBytes, randomBytes } from '@noble/ciphers/utils.js';
import * as SecureStore from 'expo-secure-store';

import { decryptLargeSecureStoreValue, encryptLargeSecureStoreValue } from './largeSecureStoreCrypto';

export class LargeSecureStore {
  private async getContentKey(key: string): Promise<Uint8Array | null> {
    const existing = await SecureStore.getItemAsync(key);
    if (!existing) return null;
    try {
      return hexToBytes(existing);
    } catch {
      return null;
    }
  }

  private async ensureContentKey(key: string): Promise<Uint8Array> {
    const existing = await this.getContentKey(key);
    if (existing) return existing;
    const contentKey = randomBytes(32);
    await SecureStore.setItemAsync(key, bytesToHex(contentKey));
    return contentKey;
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    const contentKey = await this.getContentKey(key);
    if (!contentKey) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    const result = decryptLargeSecureStoreValue(encrypted, contentKey);
    if (result.plaintext === null) {
      await this.removeItem(key);
      return null;
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
