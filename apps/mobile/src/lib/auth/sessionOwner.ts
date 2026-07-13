import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import type { LocalDataOwnership } from './sessionBoundary';
import { LOCAL_DATA_CLEANUP_REQUIRED_KEY, LOCAL_DATA_OWNER_HASH_KEY } from './sessionOwnerKey';

export { LOCAL_DATA_CLEANUP_REQUIRED_KEY, LOCAL_DATA_OWNER_HASH_KEY } from './sessionOwnerKey';
const OWNER_HASH_DOMAIN = 'routinekind:local-data-owner:v1:';
const CLEANUP_REQUIRED_VALUE = 'v1:required';
let cleanupRequiredInMemory = false;

async function ownerHash(userId: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${OWNER_HASH_DOMAIN}${userId}`,
  );
}

export async function readLocalDataOwnership(userId: string | null): Promise<LocalDataOwnership> {
  const cleanupMarker = await AsyncStorage.getItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY);
  // Any persisted marker means a destructive boundary did not prove complete.
  // Legacy `1`, corrupt bytes, empty strings, and future versions all remain
  // fail-closed until the authorized cleanup path removes the key entirely.
  if (cleanupRequiredInMemory || cleanupMarker !== null) {
    cleanupRequiredInMemory = true;
    return 'mismatch';
  }
  const storedHash = await AsyncStorage.getItem(LOCAL_DATA_OWNER_HASH_KEY);
  if (storedHash === null) return 'unclaimed';
  if (!userId) return 'mismatch';
  return storedHash === (await ownerHash(userId)) ? 'match' : 'mismatch';
}

export async function claimLocalDataOwnership(userId: string): Promise<void> {
  await AsyncStorage.setItem(LOCAL_DATA_OWNER_HASH_KEY, await ownerHash(userId));
}

export async function markLocalDataCleanupRequired(): Promise<void> {
  cleanupRequiredInMemory = true;
  await AsyncStorage.setItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY, CLEANUP_REQUIRED_VALUE);
}

export async function clearLocalDataCleanupRequired(): Promise<void> {
  await AsyncStorage.removeItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY);
  cleanupRequiredInMemory = false;
}
