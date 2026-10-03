import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import {
  scheduleTrialReminder,
  waitForHealthNotificationOperationsToSettle,
} from '@/features/notifications/deliver';
import { clearNativeNotificationsForAccountIsolation } from '@/features/notifications/nativeMutation';
import {
  beginEncryptedPhotoAccountBoundary,
  clearEncryptedPhotoStorage,
  endEncryptedPhotoAccountBoundary,
  waitForEncryptedPhotoWritesToSettle,
} from '@/features/photos/encryptedStorage';
import { purgeSensitiveImageMemory } from '@/features/photos/sensitiveImageMemory';
import { clearGeneratedPrivateCacheFiles } from '@/features/settings/localPrivateData';
import { clearRoutineWidgetLifecycleForPrivacy } from '@/features/widgets/lifecycleCoordinator';
import { resetAnalyticsIdentity } from '@/lib/analytics/track';
import {
  beginAccountGenerationBoundaryFromLease,
  isAccountGenerationLeaseError,
  runAccountGenerationOperation,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import { readLocalDataOwnership } from '@/lib/auth/sessionOwner';
import { HEALTH_PURPOSE_PRIVATE_DATA_KEYS } from '@/lib/consent/healthDataWriteAdmission';
import { isSupabaseConfigured } from '@/lib/env';
import { queryClient } from '@/lib/query/queryClient';
import {
  beginPrivateKVAccountBoundary,
  endPrivateKVAccountBoundary,
  waitForPrivateKVWritesToSettle,
} from '@/lib/storage/privateKV';
import { scavengePlaintextStaging } from '@/lib/storage/plaintextStaging';

/**
 * Records whose purpose depends on health-data consent. This intentionally does
 * not contain Auth storage, account-owner proofs, App Lock, RevenueCat/
 * entitlement state, commerce safety journals, age verification, or the health
 * lifecycle authority record itself.
 */
export { HEALTH_PURPOSE_PRIVATE_DATA_KEYS } from '@/lib/consent/healthDataWriteAdmission';

export async function clearHealthPurposeLocalData(ownerUserId: string): Promise<void> {
  if (!ownerUserId || ownerUserId !== ownerUserId.trim() || ownerUserId.length > 128) {
    throw new Error('HEALTH_PURPOSE_LOCAL_CLEAR_OWNER_INVALID');
  }

  let firstFailure: unknown = null;
  const attempt = async (operation: () => void | Promise<unknown>) => {
    try {
      await operation();
    } catch (error) {
      firstFailure ??= error;
    }
  };

  // Prove A still owns the mounted private store and atomically turn that
  // tracked lease into the destructive boundary. Splitting the proof and the
  // boundary would let an A-to-B Auth transition land between them; wrapping
  // all cleanup in the lease would make the boundary wait on itself.
  const releaseAccountBoundary = await runAccountGenerationOperation(async (lease) => {
    if (isSupabaseConfigured) {
      const ownership = await readLocalDataOwnership(ownerUserId);
      lease.assertCurrent();
      if (ownership !== 'match') throw new Error('HEALTH_PURPOSE_LOCAL_CLEAR_OWNER_MISMATCH');
    }
    return beginAccountGenerationBoundaryFromLease(lease);
  });
  // The App Group is a separate process boundary. Close its native admission
  // immediately after the exact-owner proof becomes destructive authority;
  // awaiting JS/account writer drains first would let a stalled writer keep
  // prior-owner counts visible and AppIntents admissible indefinitely. Keep
  // this exact promise so its queued purge is still observed in-order below.
  const routineWidgetPrivacyCleanup = clearRoutineWidgetLifecycleForPrivacy();
  void routineWidgetPrivacyCleanup.catch(() => undefined);
  beginPrivateKVAccountBoundary();
  beginEncryptedPhotoAccountBoundary();
  try {
    await attempt(waitForAccountGenerationOperationsToSettle);
    await attempt(waitForPrivateKVWritesToSettle);
    await attempt(waitForEncryptedPhotoWritesToSettle);
    await attempt(waitForHealthNotificationOperationsToSettle);
    // Admission is already synchronously closed. Observe the same queued purge
    // before local records remove evidence needed to retry this boundary.
    await attempt(() => routineWidgetPrivacyCleanup);
    await attempt(() => queryClient.cancelQueries());
    await attempt(() => purgeSensitiveImageMemory());
    // Analytics identity and every legacy PostHog persistence key are part of
    // the health-purpose teardown contract. Treat a failed purge exactly like
    // a failed encrypted-store purge: cleanup remains durably incomplete.
    await attempt(resetAnalyticsIdentity);
    await attempt(scavengePlaintextStaging);
    await attempt(clearGeneratedPrivateCacheFiles);
    await attempt(() => AsyncStorage.multiRemove([...HEALTH_PURPOSE_PRIVATE_DATA_KEYS]));
    await attempt(clearEncryptedPhotoStorage);
    await attempt(() =>
      Platform.OS === 'web'
        ? Promise.resolve()
        : clearNativeNotificationsForAccountIsolation(),
    );
    await attempt(() => queryClient.clear());

    // Abort-ignoring reads must not repopulate a just-cleared health cache.
    await attempt(() => queryClient.cancelQueries());
    await attempt(() => queryClient.clear());
    // The boundary prevents new tracked schedules. Drain explicitly and make a
    // final native cancellation after every abort/rollback continuation exits.
    await attempt(waitForHealthNotificationOperationsToSettle);
    await attempt(() =>
      Platform.OS === 'web'
        ? Promise.resolve()
        : clearNativeNotificationsForAccountIsolation(),
    );
  } finally {
    endEncryptedPhotoAccountBoundary();
    endPrivateKVAccountBoundary();
    releaseAccountBoundary();
  }

  // Routine/photo reminders are health-purpose data, but the promised
  // pre-charge reminder is billing safety. Its entitlement read must happen
  // only after private/account boundaries reopen; inside the boundary the read
  // correctly fails closed and the reminder would silently never be restored.
  try {
    await runAccountGenerationOperation(async (lease) => {
      if (Platform.OS !== 'web') await scheduleTrialReminder();
      lease.assertCurrent();
    });
  } catch (error) {
    // An Auth boundary during the post-cleanup await invalidates the caller's
    // continuation. Never collapse that signal into a generic cleanup error,
    // which lifecycle reconciliation might otherwise catch and write around.
    if (isAccountGenerationLeaseError(error)) throw error;
    firstFailure ??= error;
  }

  if (firstFailure) throw new Error('HEALTH_PURPOSE_LOCAL_CLEAR_FAILED');
}
