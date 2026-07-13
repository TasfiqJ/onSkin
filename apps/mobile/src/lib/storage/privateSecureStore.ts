import * as SecureStore from 'expo-secure-store';

/**
 * Native private keys must remain usable while the app is in the foreground,
 * but must not migrate to another iOS device through backup or restore.
 *
 * Expo SecureStore applies this accessibility class when an item is created.
 * Its iOS duplicate-item update path changes only the value, so this option is
 * not evidence that an already-existing key was migrated in place.
 */
export const PRIVATE_SECURE_STORE_OPTIONS: Readonly<SecureStore.SecureStoreOptions> = Object.freeze(
  {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  },
);

export function isPrivateSecureStoreAvailableAsync(): Promise<boolean> {
  return SecureStore.isAvailableAsync();
}

export function getPrivateSecureStoreItemAsync(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key, PRIVATE_SECURE_STORE_OPTIONS);
}

export function setPrivateSecureStoreItemAsync(key: string, value: string): Promise<void> {
  return SecureStore.setItemAsync(key, value, PRIVATE_SECURE_STORE_OPTIONS);
}

export function deletePrivateSecureStoreItemAsync(key: string): Promise<void> {
  return SecureStore.deleteItemAsync(key, PRIVATE_SECURE_STORE_OPTIONS);
}
