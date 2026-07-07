import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';

import { clearEncryptedPhotoStorage } from '@/features/photos/encryptedStorage';
import { resetAnalyticsIdentity } from '@/lib/analytics/track';
import { resetRevenueCatIdentity } from '@/lib/iap/revenuecat';
import { clearPrivateKVContentKey } from '@/lib/storage/privateKV';

import {
  LOCAL_PRIVATE_CACHE_FILENAMES,
  LOCAL_PRIVATE_DATA_KEYS,
  localPrivateCachePrefixes,
} from './localPrivateDataKeys';

async function clearGeneratedCacheFiles(): Promise<void> {
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) return;

  const entries = await FileSystem.readDirectoryAsync(cacheDirectory).catch(() => []);
  const cachePrefixes = localPrivateCachePrefixes();
  const targets = entries.filter(
    (name) =>
      LOCAL_PRIVATE_CACHE_FILENAMES.includes(name as (typeof LOCAL_PRIVATE_CACHE_FILENAMES)[number]) ||
      cachePrefixes.some((prefix) => name.startsWith(prefix)),
  );

  await Promise.all(
    targets.map((name) =>
      FileSystem.deleteAsync(`${cacheDirectory}${name}`, { idempotent: true }).catch(() => {}),
    ),
  );
}

export async function clearLocalPrivateData(): Promise<void> {
  const results = await Promise.allSettled([
    AsyncStorage.multiRemove([...LOCAL_PRIVATE_DATA_KEYS]),
    clearEncryptedPhotoStorage(),
    clearPrivateKVContentKey(),
    clearGeneratedCacheFiles(),
    Notifications.cancelAllScheduledNotificationsAsync().catch(() => {}),
    resetAnalyticsIdentity(),
    resetRevenueCatIdentity(),
  ]);

  const failed = results.filter((result) => result.status === 'rejected');
  if (failed.length > 0) throw new Error(`LOCAL_PRIVATE_DATA_CLEAR_FAILED:${failed.length}`);
}
