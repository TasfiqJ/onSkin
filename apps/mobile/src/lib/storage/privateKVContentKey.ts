import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const PRIVATE_KV_CONTENT_KEY_NAME = 'onskin.private_kv.content_key.v1';
export const PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE =
  'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE';

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
    const legacyFallback = await AsyncStorage.getItem(PRIVATE_KV_CONTENT_KEY_NAME);
    if (legacyFallback) return legacyFallback;
    throw storageUnavailable();
  }

  if (!secureStoreAvailable) {
    const legacyFallback = await AsyncStorage.getItem(PRIVATE_KV_CONTENT_KEY_NAME);
    if (legacyFallback) return legacyFallback;
    throw storageUnavailable();
  }

  try {
    const value = await SecureStore.getItemAsync(PRIVATE_KV_CONTENT_KEY_NAME);
    if (value) {
      await AsyncStorage.removeItem(PRIVATE_KV_CONTENT_KEY_NAME).catch(() => undefined);
      return value;
    }
  } catch {
    const legacyFallback = await AsyncStorage.getItem(PRIVATE_KV_CONTENT_KEY_NAME);
    if (legacyFallback) return legacyFallback;
    throw storageUnavailable();
  }

  const legacyFallback = await AsyncStorage.getItem(PRIVATE_KV_CONTENT_KEY_NAME);
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

  try {
    await SecureStore.setItemAsync(PRIVATE_KV_CONTENT_KEY_NAME, value);
    await AsyncStorage.removeItem(PRIVATE_KV_CONTENT_KEY_NAME).catch(() => undefined);
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
