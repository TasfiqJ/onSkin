import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const PRIVATE_KV_CONTENT_KEY_NAME = 'onskin.private_kv.content_key.v1';
export const PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE =
  'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE';
export const PRIVATE_KV_CONTENT_KEY_CONFLICT = 'PRIVATE_KV_CONTENT_KEY_CONFLICT';

function storageUnavailable(): Error {
  return new Error(PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE);
}

export async function getStoredPrivateKVContentKey(): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(PRIVATE_KV_CONTENT_KEY_NAME);

  let secureStoreAvailable: boolean;
  try {
    secureStoreAvailable =
      typeof SecureStore.isAvailableAsync === 'function' && (await SecureStore.isAvailableAsync());
  } catch {
    throw storageUnavailable();
  }

  if (!secureStoreAvailable) {
    throw storageUnavailable();
  }

  let secureValue: string | null;
  try {
    secureValue = await SecureStore.getItemAsync(PRIVATE_KV_CONTENT_KEY_NAME);
  } catch {
    // A fallback is authoritative only after a definitive SecureStore miss.
    // During a transient native read failure another, conflicting candidate
    // may still exist, so using the fallback could split keys or authorize a
    // destructive mutation with the wrong key.
    throw storageUnavailable();
  }

  const legacyFallback = await AsyncStorage.getItem(PRIVATE_KV_CONTENT_KEY_NAME);
  if (secureValue) {
    if (legacyFallback && legacyFallback !== secureValue) {
      // This layer cannot know which candidate authenticates existing ciphertext.
      // Preserve both until a higher-level, authenticated recovery resolves it.
      throw new Error(PRIVATE_KV_CONTENT_KEY_CONFLICT);
    }
    if (legacyFallback === secureValue) {
      await AsyncStorage.removeItem(PRIVATE_KV_CONTENT_KEY_NAME).catch(() => undefined);
    }
    return secureValue;
  }

  if (!legacyFallback) return null;
  try {
    await SecureStore.setItemAsync(PRIVATE_KV_CONTENT_KEY_NAME, legacyFallback);
    await AsyncStorage.removeItem(PRIVATE_KV_CONTENT_KEY_NAME).catch(() => undefined);
  } catch {
    /* Preserve and use the existing fallback until a later read can migrate it. */
  }
  return legacyFallback;
}

export async function setStoredPrivateKVContentKey(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(PRIVATE_KV_CONTENT_KEY_NAME, value);
    return;
  }

  let secureStoreAvailable: boolean;
  try {
    secureStoreAvailable =
      typeof SecureStore.isAvailableAsync === 'function' && (await SecureStore.isAvailableAsync());
  } catch {
    throw storageUnavailable();
  }
  if (!secureStoreAvailable) throw storageUnavailable();

  let legacyFallback: string | null;
  try {
    legacyFallback = await AsyncStorage.getItem(PRIVATE_KV_CONTENT_KEY_NAME);
  } catch {
    throw storageUnavailable();
  }
  if (legacyFallback && legacyFallback !== value) {
    throw new Error(PRIVATE_KV_CONTENT_KEY_CONFLICT);
  }

  try {
    await SecureStore.setItemAsync(PRIVATE_KV_CONTENT_KEY_NAME, value);
    if (legacyFallback === value) {
      await AsyncStorage.removeItem(PRIVATE_KV_CONTENT_KEY_NAME).catch(() => undefined);
    }
  } catch {
    throw storageUnavailable();
  }
}

export async function clearStoredPrivateKVContentKey(): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(PRIVATE_KV_CONTENT_KEY_NAME);
    return;
  }
  const results = await Promise.allSettled([
    SecureStore.deleteItemAsync(PRIVATE_KV_CONTENT_KEY_NAME),
    AsyncStorage.removeItem(PRIVATE_KV_CONTENT_KEY_NAME),
  ]);
  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length > 0) {
    throw new Error(`PRIVATE_KV_CONTENT_KEY_CLEAR_FAILED:${failures.length}`);
  }
}
