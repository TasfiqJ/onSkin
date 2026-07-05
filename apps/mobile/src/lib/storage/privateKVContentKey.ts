import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export const PRIVATE_KV_CONTENT_KEY_NAME = 'onskin.private_kv.content_key.v1';

async function isSecureStoreAvailable(): Promise<boolean> {
  try {
    return (
      typeof SecureStore.isAvailableAsync === 'function' && (await SecureStore.isAvailableAsync())
    );
  } catch {
    return false;
  }
}

export async function getStoredPrivateKVContentKey(): Promise<string | null> {
  if (await isSecureStoreAvailable()) {
    try {
      const value = await SecureStore.getItemAsync(PRIVATE_KV_CONTENT_KEY_NAME);
      if (value) return value;
    } catch {
      /* Fall back for runtimes like Expo web where the JS API exists but native storage does not. */
    }
  }
  return AsyncStorage.getItem(PRIVATE_KV_CONTENT_KEY_NAME);
}

export async function setStoredPrivateKVContentKey(value: string): Promise<void> {
  if (await isSecureStoreAvailable()) {
    try {
      await SecureStore.setItemAsync(PRIVATE_KV_CONTENT_KEY_NAME, value);
      return;
    } catch {
      /* Fall back for runtimes like Expo web where the JS API exists but native storage does not. */
    }
  }
  await AsyncStorage.setItem(PRIVATE_KV_CONTENT_KEY_NAME, value);
}

export async function clearStoredPrivateKVContentKey(): Promise<void> {
  await SecureStore.deleteItemAsync(PRIVATE_KV_CONTENT_KEY_NAME).catch(() => {});
  await AsyncStorage.removeItem(PRIVATE_KV_CONTENT_KEY_NAME).catch(() => {});
}
