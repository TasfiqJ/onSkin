import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import type { LocalDataOwnership } from './sessionBoundary';
import { LOCAL_DATA_CLEANUP_REQUIRED_KEY, LOCAL_DATA_OWNER_HASH_KEY } from './sessionOwnerKey';

export { LOCAL_DATA_CLEANUP_REQUIRED_KEY, LOCAL_DATA_OWNER_HASH_KEY } from './sessionOwnerKey';
const OWNER_HASH_DOMAIN = 'routinekind:local-data-owner:v1:';
let cleanupRequiredInMemory = false;

async function ownerHash(userId: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${OWNER_HASH_DOMAIN}${userId}`,
  );
}

export async function readLocalDataOwnership(userId: string | null): Promise<LocalDataOwnership> {
  if (
    cleanupRequiredInMemory ||
    (await AsyncStorage.getItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY)) === '1'
  ) {
    cleanupRequiredInMemory = true;
    return 'mismatch';
  }
  const storedHash = await AsyncStorage.getItem(LOCAL_DATA_OWNER_HASH_KEY);
  if (!storedHash) return 'unclaimed';
  if (!userId) return 'mismatch';
  return storedHash === (await ownerHash(userId)) ? 'match' : 'mismatch';
}

export async function claimLocalDataOwnership(userId: string): Promise<void> {
  await AsyncStorage.setItem(LOCAL_DATA_OWNER_HASH_KEY, await ownerHash(userId));
}

export async function markLocalDataCleanupRequired(): Promise<void> {
  cleanupRequiredInMemory = true;
  await AsyncStorage.setItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY, '1');
}

export async function clearLocalDataCleanupRequired(): Promise<void> {
  await AsyncStorage.removeItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY);
  cleanupRequiredInMemory = false;
}
