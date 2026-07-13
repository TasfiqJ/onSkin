import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import {
  deletePrivateSecureStoreItemAsync,
  getPrivateSecureStoreItemAsync,
  isPrivateSecureStoreAvailableAsync,
  setPrivateSecureStoreItemAsync,
} from './privateSecureStore';

export const PRIVATE_KV_CONTENT_KEY_NAME = 'onskin.private_kv.content_key.v1';
export const PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE =
  'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE';
export const PRIVATE_KV_CONTENT_KEY_CONFLICT = 'PRIVATE_KV_CONTENT_KEY_CONFLICT';

function storageUnavailable(): Error {
  return new Error(PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE);
}

async function readNativeContentKeyCandidates(): Promise<{
  secureValue: string | null;
  legacyFallback: string | null;
}> {
  let secureStoreAvailable: boolean;
  try {
    secureStoreAvailable =
      typeof isPrivateSecureStoreAvailableAsync === 'function' &&
      (await isPrivateSecureStoreAvailableAsync());
  } catch {
    throw storageUnavailable();
  }

  if (!secureStoreAvailable) {
    throw storageUnavailable();
  }

  let secureValue: string | null;
  try {
    secureValue = await getPrivateSecureStoreItemAsync(PRIVATE_KV_CONTENT_KEY_NAME);
  } catch {
    // A fallback is authoritative only after a definitive SecureStore miss.
    // During a transient native read failure another, conflicting candidate
    // may still exist, so using the fallback could split keys or authorize a
    // destructive mutation with the wrong key.
    throw storageUnavailable();
  }

  let legacyFallback: string | null;
  try {
    legacyFallback = await AsyncStorage.getItem(PRIVATE_KV_CONTENT_KEY_NAME);
  } catch {
    throw storageUnavailable();
  }
  return { secureValue, legacyFallback };
}

export async function getStoredPrivateKVContentKey(): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(PRIVATE_KV_CONTENT_KEY_NAME);

  const { secureValue, legacyFallback } = await readNativeContentKeyCandidates();
  if (secureValue) {
    if (legacyFallback && legacyFallback !== secureValue) {
      // This layer cannot know which candidate authenticates existing ciphertext.
      // Preserve both until a higher-level, authenticated recovery resolves it.
      throw new Error(PRIVATE_KV_CONTENT_KEY_CONFLICT);
    }
    return secureValue;
  }

  // Ordinary reads never migrate or delete authority bytes. The next explicit
  // private-KV mutation performs the crash-safe copy/verify/cleanup step.
  return legacyFallback;
}

export async function migrateStoredPrivateKVContentKey(): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(PRIVATE_KV_CONTENT_KEY_NAME);

  const { secureValue, legacyFallback } = await readNativeContentKeyCandidates();
  if (secureValue) {
    if (legacyFallback && legacyFallback !== secureValue) {
      throw new Error(PRIVATE_KV_CONTENT_KEY_CONFLICT);
    }
    if (legacyFallback === secureValue) {
      await AsyncStorage.removeItem(PRIVATE_KV_CONTENT_KEY_NAME).catch(() => undefined);
    }
    return secureValue;
  }
  if (!legacyFallback) return null;
  try {
    await setPrivateSecureStoreItemAsync(PRIVATE_KV_CONTENT_KEY_NAME, legacyFallback);
    const verified = await getPrivateSecureStoreItemAsync(PRIVATE_KV_CONTENT_KEY_NAME);
    if (verified !== legacyFallback) throw storageUnavailable();
    await AsyncStorage.removeItem(PRIVATE_KV_CONTENT_KEY_NAME).catch(() => undefined);
  } catch {
    // The fallback remains authoritative until a later explicit mutation can
    // prove the native copy. Never delete or replace it on uncertainty.
    throw storageUnavailable();
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
      typeof isPrivateSecureStoreAvailableAsync === 'function' &&
      (await isPrivateSecureStoreAvailableAsync());
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
    await setPrivateSecureStoreItemAsync(PRIVATE_KV_CONTENT_KEY_NAME, value);
    const verified = await getPrivateSecureStoreItemAsync(PRIVATE_KV_CONTENT_KEY_NAME);
    if (verified !== value) throw storageUnavailable();
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
    deletePrivateSecureStoreItemAsync(PRIVATE_KV_CONTENT_KEY_NAME),
    AsyncStorage.removeItem(PRIVATE_KV_CONTENT_KEY_NAME),
  ]);
  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length > 0) {
    throw new Error(`PRIVATE_KV_CONTENT_KEY_CLEAR_FAILED:${failures.length}`);
  }
}
