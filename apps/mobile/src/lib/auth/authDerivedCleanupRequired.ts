import AsyncStorage from '@react-native-async-storage/async-storage';

export const AUTH_DERIVED_CLEANUP_REQUIRED_KEY = 'routinekind.authDerivedCleanupRequired.v1';

const AUTH_DERIVED_CLEANUP_REQUIRED_VALUE = '1';

/**
 * Read the crash-recovery marker without treating corrupt or unavailable
 * storage as a safe, completed cleanup boundary.
 */
export async function readAuthDerivedCleanupRequired(): Promise<boolean> {
  const value = await AsyncStorage.getItem(AUTH_DERIVED_CLEANUP_REQUIRED_KEY);
  if (value === null) return false;
  if (value === AUTH_DERIVED_CLEANUP_REQUIRED_VALUE) return true;
  throw new Error('AUTH_DERIVED_CLEANUP_REQUIRED_INVALID');
}

export async function markAuthDerivedCleanupRequired(): Promise<void> {
  await AsyncStorage.setItem(
    AUTH_DERIVED_CLEANUP_REQUIRED_KEY,
    AUTH_DERIVED_CLEANUP_REQUIRED_VALUE,
  );
}

export async function clearAuthDerivedCleanupRequired(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_DERIVED_CLEANUP_REQUIRED_KEY);
}
