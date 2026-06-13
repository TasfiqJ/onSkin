import AsyncStorage from '@react-native-async-storage/async-storage';

// Whether the biometric app-lock is enabled (opt-in, docs/01 §5). Stored locally;
// the lock state itself is in-memory in AppLockProvider.
const KEY = 'onskin.appLock.enabled';

export async function getAppLockEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setAppLockEnabledStored(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, enabled ? '1' : '0');
}
