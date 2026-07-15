import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NotificationNativeMutationSupersededError,
  scheduleNativeNotificationExact,
} from '@/features/notifications/nativeMutation';

import { clearLocalPrivateData } from './localPrivateData';
import {
  LOCAL_PRIVATE_BULK_CLEANUP_KEYS,
  LOCAL_PRIVATE_CONTROL_KEYS,
} from './localPrivateDataRegistry';

const mocks = vi.hoisted(() => ({
  cancelAllScheduledNotificationsAsync: vi.fn(),
  dismissAllNotificationsAsync: vi.fn(),
  dismissNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  clearAccountDeletionVendorFreezeAfterCleanup: vi.fn(),
  clearEncryptedPhotoStorage: vi.fn(),
  clearPrivateKVContentKey: vi.fn(),
  deleteAsync: vi.fn(),
  platformOS: 'ios',
  readDirectoryAsync: vi.fn(),
  removePrivateItemsForAuthorizedReset: vi.fn(),
  resetAnalyticsIdentity: vi.fn(),
  resetRevenueCatIdentity: vi.fn(),
}));

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file://cache/',
  deleteAsync: mocks.deleteAsync,
  readDirectoryAsync: mocks.readDirectoryAsync,
}));

vi.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: mocks.cancelAllScheduledNotificationsAsync,
  cancelScheduledNotificationAsync: mocks.cancelScheduledNotificationAsync,
  dismissAllNotificationsAsync: mocks.dismissAllNotificationsAsync,
  dismissNotificationAsync: mocks.dismissNotificationAsync,
  scheduleNotificationAsync: mocks.scheduleNotificationAsync,
}));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mocks.platformOS;
    },
  },
}));

vi.mock('@/features/photos/encryptedStorage', () => ({
  clearEncryptedPhotoStorage: mocks.clearEncryptedPhotoStorage,
}));

vi.mock('@/lib/auth/accountDeletionVendorFreeze', () => ({
  clearAccountDeletionVendorFreezeAfterCleanup: mocks.clearAccountDeletionVendorFreezeAfterCleanup,
}));

vi.mock('@/lib/analytics/track', () => ({
  resetAnalyticsIdentity: mocks.resetAnalyticsIdentity,
}));

vi.mock('@/lib/iap/revenuecat', () => ({
  resetRevenueCatIdentity: mocks.resetRevenueCatIdentity,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  clearPrivateKVContentKey: mocks.clearPrivateKVContentKey,
  removePrivateItemsForAuthorizedReset: mocks.removePrivateItemsForAuthorizedReset,
}));

describe('local private data cleanup', () => {
  beforeEach(() => {
    mocks.cancelAllScheduledNotificationsAsync.mockReset();
    mocks.cancelScheduledNotificationAsync.mockReset();
    mocks.clearAccountDeletionVendorFreezeAfterCleanup.mockReset();
    mocks.clearEncryptedPhotoStorage.mockReset();
    mocks.clearPrivateKVContentKey.mockReset();
    mocks.deleteAsync.mockReset();
    mocks.dismissAllNotificationsAsync.mockReset();
    mocks.dismissNotificationAsync.mockReset();
    mocks.platformOS = 'ios';
    mocks.readDirectoryAsync.mockReset();
    mocks.removePrivateItemsForAuthorizedReset.mockReset();
    mocks.resetAnalyticsIdentity.mockReset();
    mocks.resetRevenueCatIdentity.mockReset();
    mocks.scheduleNotificationAsync.mockReset();

    mocks.cancelAllScheduledNotificationsAsync.mockResolvedValue(undefined);
    mocks.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
    mocks.clearAccountDeletionVendorFreezeAfterCleanup.mockResolvedValue(undefined);
    mocks.clearEncryptedPhotoStorage.mockResolvedValue(undefined);
    mocks.clearPrivateKVContentKey.mockResolvedValue(undefined);
    mocks.deleteAsync.mockResolvedValue(undefined);
    mocks.dismissAllNotificationsAsync.mockResolvedValue(undefined);
    mocks.dismissNotificationAsync.mockResolvedValue(undefined);
    mocks.removePrivateItemsForAuthorizedReset.mockResolvedValue(undefined);
    mocks.readDirectoryAsync.mockResolvedValue([
      'routinekind-export-456.json',
      'routinekind-share-card.png',
      'onskin-export-123.json',
      'onskin-share-card.png',
      'public-cache.json',
    ]);
    mocks.resetAnalyticsIdentity.mockResolvedValue(undefined);
    mocks.resetRevenueCatIdentity.mockResolvedValue(undefined);
    mocks.scheduleNotificationAsync.mockResolvedValue('notification-id');
  });

  it('clears local stores, cache files, notifications, and client vendor identities', async () => {
    await expect(clearLocalPrivateData()).resolves.toBeUndefined();

    expect(mocks.removePrivateItemsForAuthorizedReset).toHaveBeenCalledWith(
      LOCAL_PRIVATE_BULK_CLEANUP_KEYS,
      'account_isolation',
    );
    expect(mocks.removePrivateItemsForAuthorizedReset.mock.calls[0]?.[0]).toEqual(
      LOCAL_PRIVATE_BULK_CLEANUP_KEYS,
    );
    for (const controlKey of LOCAL_PRIVATE_CONTROL_KEYS) {
      expect(mocks.removePrivateItemsForAuthorizedReset.mock.calls[0]?.[0]).not.toContain(
        controlKey,
      );
    }
    expect(mocks.clearEncryptedPhotoStorage).toHaveBeenCalledTimes(1);
    expect(mocks.clearPrivateKVContentKey).toHaveBeenCalledTimes(1);
    expect(mocks.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mocks.dismissAllNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mocks.deleteAsync).toHaveBeenCalledWith('file://cache/onskin-export-123.json', {
      idempotent: true,
    });
    expect(mocks.deleteAsync).toHaveBeenCalledWith('file://cache/onskin-share-card.png', {
      idempotent: true,
    });
    expect(mocks.deleteAsync).toHaveBeenCalledWith('file://cache/routinekind-export-456.json', {
      idempotent: true,
    });
    expect(mocks.deleteAsync).toHaveBeenCalledWith('file://cache/routinekind-share-card.png', {
      idempotent: true,
    });
    expect(mocks.deleteAsync).not.toHaveBeenCalledWith('file://cache/public-cache.json', {
      idempotent: true,
    });
    expect(mocks.resetAnalyticsIdentity).toHaveBeenCalledTimes(1);
    expect(mocks.resetRevenueCatIdentity).toHaveBeenCalledTimes(1);
    expect(mocks.clearAccountDeletionVendorFreezeAfterCleanup).toHaveBeenCalledTimes(1);
    expect(mocks.resetAnalyticsIdentity.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.clearAccountDeletionVendorFreezeAfterCleanup.mock.invocationCallOrder[0]!,
    );
    expect(mocks.resetRevenueCatIdentity.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.clearAccountDeletionVendorFreezeAfterCleanup.mock.invocationCallOrder[0]!,
    );
  });

  it('withholds cleanup success until a prior owner schedule is exactly compensated', async () => {
    const ownerA = new AbortController();
    const identifier = 'owner-a-immediate';
    let resolveSchedule!: (value: string) => void;
    mocks.scheduleNotificationAsync.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSchedule = resolve;
        }),
    );
    const scheduled = scheduleNativeNotificationExact(ownerA.signal, {
      identifier,
      content: { title: 'RoutineKind' },
      trigger: null,
    });
    ownerA.abort();

    let cleanupSettled = false;
    const cleanup = clearLocalPrivateData().then(() => {
      cleanupSettled = true;
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(cleanupSettled).toBe(false);
    expect(mocks.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mocks.dismissAllNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mocks.clearAccountDeletionVendorFreezeAfterCleanup).not.toHaveBeenCalled();

    resolveSchedule(identifier);
    await expect(scheduled).rejects.toBeInstanceOf(NotificationNativeMutationSupersededError);
    await expect(cleanup).resolves.toBeUndefined();

    expect(mocks.cancelScheduledNotificationAsync).toHaveBeenCalledWith(identifier);
    expect(mocks.dismissNotificationAsync).toHaveBeenCalledWith(identifier);
    expect(mocks.clearAccountDeletionVendorFreezeAfterCleanup).toHaveBeenCalledTimes(1);
  });

  it('fails the account-boundary cleanup when a client identity reset fails', async () => {
    mocks.resetRevenueCatIdentity.mockRejectedValueOnce(new Error('revenuecat reset failed'));

    await expect(clearLocalPrivateData()).rejects.toThrow(
      'LOCAL_PRIVATE_DATA_CLEAR_FAILED:revenuecat_identity',
    );

    expect(mocks.removePrivateItemsForAuthorizedReset).toHaveBeenCalledTimes(1);
    expect(mocks.resetAnalyticsIdentity).toHaveBeenCalledTimes(1);
    expect(mocks.resetRevenueCatIdentity).toHaveBeenCalledTimes(1);
    expect(mocks.clearAccountDeletionVendorFreezeAfterCleanup).not.toHaveBeenCalled();
  });

  it('bounds a wedged client identity reset and preserves the deletion receipt', async () => {
    vi.useFakeTimers();
    try {
      mocks.resetRevenueCatIdentity.mockReturnValueOnce(new Promise<void>(() => undefined));

      const clearing = expect(clearLocalPrivateData()).rejects.toThrow(
        'LOCAL_PRIVATE_DATA_CLEAR_FAILED:revenuecat_identity',
      );
      await vi.advanceTimersByTimeAsync(2_001);
      await clearing;

      expect(mocks.clearAccountDeletionVendorFreezeAfterCleanup).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails the boundary and stays fail-closed when receipt removal is unavailable', async () => {
    mocks.clearAccountDeletionVendorFreezeAfterCleanup.mockRejectedValueOnce(
      new Error('ACCOUNT_DELETION_VENDOR_FREEZE_CLEAR_FAILED'),
    );

    await expect(clearLocalPrivateData()).rejects.toThrow(
      'ACCOUNT_DELETION_VENDOR_FREEZE_CLEAR_FAILED',
    );

    expect(mocks.removePrivateItemsForAuthorizedReset).toHaveBeenCalledTimes(1);
    expect(mocks.resetAnalyticsIdentity).toHaveBeenCalledTimes(1);
    expect(mocks.resetRevenueCatIdentity).toHaveBeenCalledTimes(1);
  });

  it('fails closed when cache enumeration or notification cancellation fails', async () => {
    mocks.readDirectoryAsync.mockRejectedValueOnce(new Error('cache unavailable'));
    mocks.cancelAllScheduledNotificationsAsync.mockRejectedValueOnce(
      new Error('notifications unavailable'),
    );

    await expect(clearLocalPrivateData()).rejects.toThrow(
      'LOCAL_PRIVATE_DATA_CLEAR_FAILED:generated_cache,scheduled_notifications',
    );

    expect(mocks.removePrivateItemsForAuthorizedReset).toHaveBeenCalledTimes(1);
    expect(mocks.clearEncryptedPhotoStorage).toHaveBeenCalledTimes(1);
    expect(mocks.clearPrivateKVContentKey).toHaveBeenCalledTimes(1);
    expect(mocks.resetAnalyticsIdentity).toHaveBeenCalledTimes(1);
    expect(mocks.resetRevenueCatIdentity).toHaveBeenCalledTimes(1);
    expect(mocks.dismissAllNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mocks.clearAccountDeletionVendorFreezeAfterCleanup).not.toHaveBeenCalled();
  });

  it('bounds a wedged native notification cleanup and permits an explicit retry', async () => {
    vi.useFakeTimers();
    let resolveFirstCancellation!: () => void;
    try {
      mocks.cancelAllScheduledNotificationsAsync
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              resolveFirstCancellation = resolve;
            }),
        )
        .mockResolvedValue(undefined);

      const firstClear = clearLocalPrivateData().catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(2_001);

      await expect(firstClear).resolves.toEqual(
        expect.objectContaining({
          message: 'LOCAL_PRIVATE_DATA_CLEAR_FAILED:scheduled_notifications',
        }),
      );
      expect(mocks.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
      expect(mocks.dismissAllNotificationsAsync).toHaveBeenCalledTimes(1);
      expect(mocks.clearAccountDeletionVendorFreezeAfterCleanup).not.toHaveBeenCalled();

      await expect(clearLocalPrivateData()).resolves.toBeUndefined();
      expect(mocks.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(2);
      expect(mocks.dismissAllNotificationsAsync).toHaveBeenCalledTimes(2);
      expect(mocks.clearAccountDeletionVendorFreezeAfterCleanup).toHaveBeenCalledTimes(1);

      resolveFirstCancellation();
      await Promise.resolve();
      await Promise.resolve();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not call the unavailable scheduled-notification backend on web', async () => {
    mocks.platformOS = 'web';

    await expect(clearLocalPrivateData()).resolves.toBeUndefined();

    expect(mocks.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(mocks.dismissAllNotificationsAsync).not.toHaveBeenCalled();
  });
});
