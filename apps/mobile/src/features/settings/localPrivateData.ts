import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { clearEncryptedPhotoStorage } from '@/features/photos/encryptedStorage';
import { resetAnalyticsIdentity } from '@/lib/analytics/track';
import { resetRevenueCatIdentity } from '@/lib/iap/revenuecat';
import {
  LOCAL_DATA_OWNER_HASH_KEY,
  LOCAL_DATA_RETAINED_OWNER_HASH_KEY,
  LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY,
} from '@/lib/auth/sessionOwnerKey';
import { clearPrivateKVContentKey } from '@/lib/storage/privateKV';

import {
  LOCAL_PRIVATE_CACHE_FILENAMES,
  LOCAL_PRIVATE_DATA_KEYS,
  LOCAL_PRIVATE_METADATA_KEYS,
  localPrivateCachePrefixes,
} from './localPrivateDataKeys';

async function clearGeneratedCacheFiles(): Promise<void> {
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) return;

  const entries = await FileSystem.readDirectoryAsync(cacheDirectory);
  const cachePrefixes = localPrivateCachePrefixes();
  const targets = entries.filter(
    (name) =>
      LOCAL_PRIVATE_CACHE_FILENAMES.includes(
        name as (typeof LOCAL_PRIVATE_CACHE_FILENAMES)[number],
      ) || cachePrefixes.some((prefix) => name.startsWith(prefix)),
  );

  const results = await Promise.allSettled(
    targets.map((name) => FileSystem.deleteAsync(`${cacheDirectory}${name}`, { idempotent: true })),
  );
  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length > 0) {
    throw new Error(`LOCAL_PRIVATE_CACHE_CLEAR_FAILED:${failures.length}`);
  }
}

export async function clearLocalPrivateData(): Promise<void> {
  const ownerProofKeys = [
    LOCAL_DATA_OWNER_HASH_KEY,
    LOCAL_DATA_RETAINED_OWNER_HASH_KEY,
    LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY,
  ] as const;
  const metadataWithoutOwnerProof = LOCAL_PRIVATE_METADATA_KEYS.filter(
    (key) => !ownerProofKeys.includes(key as (typeof ownerProofKeys)[number]),
  );
  const operations = [
    {
      label: 'registered_records',
      promise: AsyncStorage.multiRemove([...LOCAL_PRIVATE_DATA_KEYS, ...metadataWithoutOwnerProof]),
    },
    { label: 'encrypted_photos', promise: clearEncryptedPhotoStorage() },
    { label: 'private_kv_key', promise: clearPrivateKVContentKey() },
    { label: 'generated_cache', promise: clearGeneratedCacheFiles() },
    {
      label: 'scheduled_notifications',
      promise:
        Platform.OS === 'web'
          ? Promise.resolve()
          : Notifications.cancelAllScheduledNotificationsAsync(),
    },
    { label: 'analytics_identity', promise: resetAnalyticsIdentity() },
    { label: 'revenuecat_identity', promise: resetRevenueCatIdentity() },
  ] as const;
  const results = await Promise.allSettled(operations.map(({ promise }) => promise));
  const failed = results.flatMap((result, index) =>
    result.status === 'rejected' ? [operations[index]!.label] : [],
  );
  if (failed.length > 0) throw new Error(`LOCAL_PRIVATE_DATA_CLEAR_FAILED:${failed.join(',')}`);

  // Keep every ownership/quarantine proof across every partial-cleanup outcome.
  // A later session cannot mount or claim retained private state while any
  // sensitive cleanup stage remains uncommitted.
  try {
    await AsyncStorage.multiRemove([...ownerProofKeys]);
  } catch {
    throw new Error('LOCAL_PRIVATE_DATA_CLEAR_FAILED:owner_proof');
  }
}
