import AsyncStorage from '@react-native-async-storage/async-storage';

export const APPLE_CREDENTIAL_QUARANTINE_KEY = 'layerwell.appleCredentialQuarantine.v1';

export async function isAppleCredentialQuarantined(): Promise<boolean> {
  // Any non-null value is a fail-closed quarantine. Treating corrupt control
  // state as absent could republish a revoked session after a crash.
  return (await AsyncStorage.getItem(APPLE_CREDENTIAL_QUARANTINE_KEY)) !== null;
}

export async function markAppleCredentialQuarantined(): Promise<void> {
  await AsyncStorage.setItem(APPLE_CREDENTIAL_QUARANTINE_KEY, '1');
}

export async function clearAppleCredentialQuarantine(): Promise<void> {
  await AsyncStorage.removeItem(APPLE_CREDENTIAL_QUARANTINE_KEY);
}
