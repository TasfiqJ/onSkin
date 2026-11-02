import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import {
  beginEncryptedPhotoAccountBoundary,
  clearEncryptedPhotoStorage,
  endEncryptedPhotoAccountBoundary,
  waitForEncryptedPhotoWritesToSettle,
} from '@/features/photos/encryptedStorage';
import { clearNativeNotificationsForAccountIsolation } from '@/features/notifications/nativeMutation';
import { clearRoutineWidgetLifecycleForPrivacy } from '@/features/widgets/lifecycleCoordinator';
import { resetAnalyticsIdentity } from '@/lib/analytics/track';
import { resetRevenueCatIdentity } from '@/lib/iap/revenuecat';
import {
  LOCAL_DATA_OWNER_HASH_KEY,
  LOCAL_DATA_CLEANUP_REQUIRED_KEY,
  LOCAL_DATA_RETAINED_OWNER_HASH_KEY,
  LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY,
} from '@/lib/auth/sessionOwnerKey';
import {
  AccountGenerationLeaseError,
  beginAccountGenerationBoundaryFromLease,
  runAccountGenerationOperation,
} from '@/lib/auth/accountGeneration';
import {
  clearLocalDataCleanupRequired,
  markLocalDataCleanupRequired,
} from '@/lib/auth/sessionOwner';
import {
  beginPrivateKVAccountBoundary,
  clearPrivateKVContentKey,
  endPrivateKVAccountBoundary,
  waitForPrivateKVWritesToSettle,
} from '@/lib/storage/privateKV';

import {
  LOCAL_PRIVATE_CACHE_FILENAMES,
  LOCAL_PRIVATE_DATA_KEYS,
  LOCAL_PRIVATE_METADATA_KEYS,
  localPrivateCachePrefixes,
} from './localPrivateDataKeys';

export async function clearGeneratedPrivateCacheFiles(): Promise<void> {
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

async function clearLocalPrivateDataRecords(finishDevReset?: () => Promise<void>): Promise<void> {
  const ownerProofKeys = [
    LOCAL_DATA_OWNER_HASH_KEY,
    LOCAL_DATA_RETAINED_OWNER_HASH_KEY,
    LOCAL_DATA_UNCLAIMED_QUARANTINE_KEY,
  ] as const;
  const metadataWithoutOwnerProof = LOCAL_PRIVATE_METADATA_KEYS.filter(
    (key) => !ownerProofKeys.includes(key as (typeof ownerProofKeys)[number]),
  );
  const failed: string[] = [];
  // Complete the owner-agnostic native privacy kill lane before starting any
  // destructive JS storage operation. If it fails, continue attempting every
  // other purge but retain all ownership/quarantine proofs for a safe retry.
  try {
    await clearRoutineWidgetLifecycleForPrivacy();
  } catch {
    failed.push('routine_widget_native_state');
  }
  const operations = [
    {
      label: 'registered_records',
      promise: AsyncStorage.multiRemove([...LOCAL_PRIVATE_DATA_KEYS, ...metadataWithoutOwnerProof]),
    },
    { label: 'encrypted_photos', promise: clearEncryptedPhotoStorage() },
    { label: 'private_kv_key', promise: clearPrivateKVContentKey() },
    { label: 'generated_cache', promise: clearGeneratedPrivateCacheFiles() },
    {
      label: 'scheduled_notifications',
      promise:
        Platform.OS === 'web'
          ? Promise.resolve()
          : clearNativeNotificationsForAccountIsolation(),
    },
    { label: 'analytics_identity', promise: resetAnalyticsIdentity() },
    { label: 'revenuecat_identity', promise: resetRevenueCatIdentity() },
  ] as const;
  const results = await Promise.allSettled(operations.map(({ promise }) => promise));
  failed.push(
    ...results.flatMap((result, index) =>
      result.status === 'rejected' ? [operations[index]!.label] : [],
    ),
  );
  if (failed.length > 0) throw new Error(`LOCAL_PRIVATE_DATA_CLEAR_FAILED:${failed.join(',')}`);

  // Development control/journal clearance is allowed only after all private
  // cleanup stages succeeded, while their exclusion still holds. A failed
  // finalizer retains the same owner proofs as every other partial cleanup.
  if (finishDevReset) {
    try {
      await finishDevReset();
    } catch {
      throw new Error('LOCAL_PRIVATE_DATA_CLEAR_FAILED:dev_control_state');
    }
  }

  // Keep every ownership/quarantine proof across every partial-cleanup outcome.
  // A later session cannot mount or claim retained private state while any
  // sensitive cleanup stage remains uncommitted.
  try {
    await AsyncStorage.multiRemove([...ownerProofKeys]);
  } catch {
    throw new Error('LOCAL_PRIVATE_DATA_CLEAR_FAILED:owner_proof');
  }
}

async function clearLocalPrivateDataWithBoundary(
  finishDevReset?: () => Promise<void>,
): Promise<void> {
  // Close synchronously, before the account handoff or widget prelude yields.
  // Native purge and content-key destruction must follow every older private
  // operation, including its compensation after an ambiguous native mutation.
  beginPrivateKVAccountBoundary();
  let releaseAccountBoundary: (() => void) | null = null;
  let enteredAccountHandoff = false;
  let ownsPhotoBoundary = false;
  let clearsDirectCleanupMarker = false;
  try {
    try {
      releaseAccountBoundary = await runAccountGenerationOperation((lease) => {
        enteredAccountHandoff = true;
        return beginAccountGenerationBoundaryFromLease(lease);
      });
    } catch (error) {
      // Existing account/consent cleanup already owns account and photo
      // exclusion and awaits this helper before releasing it. Do not advance
      // subject identity again or reopen that enclosing boundary.
      if (enteredAccountHandoff || !(error instanceof AccountGenerationLeaseError)) throw error;
    }
    if (releaseAccountBoundary) {
      beginEncryptedPhotoAccountBoundary();
      ownsPhotoBoundary = true;
      // A direct caller lacks clearAccountIsolatedState's durable retry mark.
      // If it cannot be committed, do not start destructive cleanup.
      const previousCleanupMarker = await AsyncStorage.getItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY);
      // An existing recovery marker may cover staging/query cleanup outside
      // this helper. Only an explicit dev reset may clear that wider state.
      clearsDirectCleanupMarker = previousCleanupMarker === null || finishDevReset !== undefined;
      await markLocalDataCleanupRequired();
    }
    await waitForPrivateKVWritesToSettle();
    if (ownsPhotoBoundary) await waitForEncryptedPhotoWritesToSettle();
    // Do not drain account operations here: a tracked caller can be awaiting
    // this helper. The handoff invalidates its old authority; the storage
    // drains above cover every native write and rollback before destruction.
    await clearLocalPrivateDataRecords(finishDevReset);
    if (clearsDirectCleanupMarker) await clearLocalDataCleanupRequired();
  } finally {
    if (ownsPhotoBoundary) endEncryptedPhotoAccountBoundary();
    releaseAccountBoundary?.();
    endPrivateKVAccountBoundary();
  }
}

export function clearLocalPrivateData(): Promise<void> {
  return enqueueLocalPrivateDataCleanup();
}

// Serialize only destructive cleanup invocations. Actual account/privateKV/
// photo boundaries above still exclude and drain writers. Without this FIFO,
// overlapping direct calls could mistake each other's boundary for an outer
// caller's scope and the first completion could reopen the second purge.
let localPrivateDataCleanupTail: Promise<void> = Promise.resolve();

function enqueueLocalPrivateDataCleanup(finishDevReset?: () => Promise<void>): Promise<void> {
  const cleanup = localPrivateDataCleanupTail.then(() =>
    clearLocalPrivateDataWithBoundary(finishDevReset),
  );
  localPrivateDataCleanupTail = cleanup.then(() => undefined, () => undefined);
  return cleanup;
}

/** Keep the existing development-only Welcome reset inside one cleanup scope. */
export function clearLocalPrivateDataForDevReset(
  finishDevReset: () => Promise<void>,
): Promise<void> {
  if (
    typeof __DEV__ === 'undefined' || !__DEV__ ||
    process.env.EXPO_PUBLIC_E2E_LOCAL_RESET !== '1'
  ) {
    return Promise.reject(new Error('DEV_LOCAL_RESET_DISABLED'));
  }
  return enqueueLocalPrivateDataCleanup(finishDevReset);
}
