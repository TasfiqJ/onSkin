import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { clearNativeNotificationsForAccountIsolation } from '@/features/notifications/nativeMutation';
import { clearEncryptedPhotoStorage } from '@/features/photos/encryptedStorage';
import { resetAnalyticsIdentity } from '@/lib/analytics/track';
import { clearAccountDeletionVendorFreezeAfterCleanup } from '@/lib/auth/accountDeletionVendorFreeze';
import { resetRevenueCatIdentity } from '@/lib/iap/revenuecat';
import {
  clearPrivateKVContentKey,
  removePrivateItemsForAuthorizedReset,
} from '@/lib/storage/privateKV';

import { LOCAL_PRIVATE_CACHE_FILENAMES, localPrivateCachePrefixes } from './localPrivateDataKeys';
import { LOCAL_PRIVATE_BULK_CLEANUP_KEYS } from './localPrivateDataRegistry';

const LOCAL_PRIVATE_VENDOR_RESET_TIMEOUT_MS = 2_000;

async function resetVendorIdentityWithinBound(operation: () => Promise<void>): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const reset = Promise.resolve().then(operation);
  const deadline = new Promise<void>((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error('LOCAL_PRIVATE_VENDOR_RESET_TIMEOUT')),
      LOCAL_PRIVATE_VENDOR_RESET_TIMEOUT_MS,
    );
  });

  try {
    await Promise.race([reset, deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

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
  const operations = [
    {
      label: 'registered_records',
      promise: removePrivateItemsForAuthorizedReset(
        LOCAL_PRIVATE_BULK_CLEANUP_KEYS,
        'account_isolation',
      ),
    },
    { label: 'encrypted_photos', promise: clearEncryptedPhotoStorage() },
    { label: 'private_kv_key', promise: clearPrivateKVContentKey() },
    { label: 'generated_cache', promise: clearGeneratedCacheFiles() },
    {
      label: 'scheduled_notifications',
      promise:
        Platform.OS === 'web' ? Promise.resolve() : clearNativeNotificationsForAccountIsolation(),
    },
    {
      label: 'analytics_identity',
      promise: resetVendorIdentityWithinBound(resetAnalyticsIdentity),
    },
    {
      label: 'revenuecat_identity',
      promise: resetVendorIdentityWithinBound(resetRevenueCatIdentity),
    },
  ] as const;
  const results = await Promise.allSettled(operations.map(({ promise }) => promise));
  const failed = results.flatMap((result, index) =>
    result.status === 'rejected' ? [operations[index]!.label] : [],
  );
  if (failed.length > 0) throw new Error(`LOCAL_PRIVATE_DATA_CLEAR_FAILED:${failed.join(',')}`);

  // This is intentionally last. A persisted deletion freeze is the recovery
  // receipt for an interrupted account boundary and may only be removed after
  // every account-bound private store and vendor identity proved clean.
  await clearAccountDeletionVendorFreezeAfterCleanup();
}
