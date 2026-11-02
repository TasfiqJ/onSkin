import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearLocalPrivateData } from './localPrivateData';

const mocks = vi.hoisted(() => ({
  beginEncryptedPhotoAccountBoundary: vi.fn(),
  beginPrivateKVAccountBoundary: vi.fn(),
  cancelAllScheduledNotificationsAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  clearLastNotificationResponseAsync: vi.fn(),
  clearEncryptedPhotoStorage: vi.fn(),
  clearRoutineWidgetNativeState: vi.fn(),
  clearPrivateKVContentKey: vi.fn(),
  deleteAsync: vi.fn(),
  dismissAllNotificationsAsync: vi.fn(),
  dismissNotificationAsync: vi.fn(),
  endEncryptedPhotoAccountBoundary: vi.fn(),
  endPrivateKVAccountBoundary: vi.fn(),
  multiRemove: vi.fn(),
  platformOS: 'ios',
  readDirectoryAsync: vi.fn(),
  resetAnalyticsIdentity: vi.fn(),
  resetRevenueCatIdentity: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  setBadgeCountAsync: vi.fn(),
  setItem: vi.fn(),
  getItem: vi.fn(),
  removeItem: vi.fn(),
  waitForEncryptedPhotoWritesToSettle: vi.fn(),
  waitForPrivateKVWritesToSettle: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    multiRemove: mocks.multiRemove,
    setItem: mocks.setItem,
    getItem: mocks.getItem,
    removeItem: mocks.removeItem,
  },
}));

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file://cache/',
  deleteAsync: mocks.deleteAsync,
  readDirectoryAsync: mocks.readDirectoryAsync,
}));

vi.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: mocks.cancelAllScheduledNotificationsAsync,
  cancelScheduledNotificationAsync: mocks.cancelScheduledNotificationAsync,
  clearLastNotificationResponseAsync: mocks.clearLastNotificationResponseAsync,
  dismissAllNotificationsAsync: mocks.dismissAllNotificationsAsync,
  dismissNotificationAsync: mocks.dismissNotificationAsync,
  scheduleNotificationAsync: mocks.scheduleNotificationAsync,
  setBadgeCountAsync: mocks.setBadgeCountAsync,
}));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mocks.platformOS;
    },
  },
}));

vi.mock('expo-crypto', () => ({}));

vi.mock('@/features/photos/encryptedStorage', () => ({
  beginEncryptedPhotoAccountBoundary: mocks.beginEncryptedPhotoAccountBoundary,
  clearEncryptedPhotoStorage: mocks.clearEncryptedPhotoStorage,
  endEncryptedPhotoAccountBoundary: mocks.endEncryptedPhotoAccountBoundary,
  waitForEncryptedPhotoWritesToSettle: mocks.waitForEncryptedPhotoWritesToSettle,
}));

vi.mock('@/features/widgets/lifecycleCoordinator', () => ({
  clearRoutineWidgetLifecycleForPrivacy: mocks.clearRoutineWidgetNativeState,
}));

vi.mock('@/lib/analytics/track', () => ({
  resetAnalyticsIdentity: mocks.resetAnalyticsIdentity,
}));

vi.mock('@/lib/iap/revenuecat', () => ({
  resetRevenueCatIdentity: mocks.resetRevenueCatIdentity,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  beginPrivateKVAccountBoundary: mocks.beginPrivateKVAccountBoundary,
  clearPrivateKVContentKey: mocks.clearPrivateKVContentKey,
  endPrivateKVAccountBoundary: mocks.endPrivateKVAccountBoundary,
  waitForPrivateKVWritesToSettle: mocks.waitForPrivateKVWritesToSettle,
}));

describe('local private data cleanup', () => {
  beforeEach(() => {
    mocks.beginEncryptedPhotoAccountBoundary.mockReset();
    mocks.beginPrivateKVAccountBoundary.mockReset();
    mocks.endEncryptedPhotoAccountBoundary.mockReset();
    mocks.endPrivateKVAccountBoundary.mockReset();
    mocks.waitForEncryptedPhotoWritesToSettle.mockReset().mockResolvedValue(undefined);
    mocks.waitForPrivateKVWritesToSettle.mockReset().mockResolvedValue(undefined);
    mocks.cancelAllScheduledNotificationsAsync.mockReset();
    mocks.cancelScheduledNotificationAsync.mockReset();
    mocks.clearLastNotificationResponseAsync.mockReset();
    mocks.clearEncryptedPhotoStorage.mockReset();
    mocks.clearRoutineWidgetNativeState.mockReset();
    mocks.clearPrivateKVContentKey.mockReset();
    mocks.deleteAsync.mockReset();
    mocks.dismissAllNotificationsAsync.mockReset();
    mocks.dismissNotificationAsync.mockReset();
    mocks.multiRemove.mockReset();
    mocks.platformOS = 'ios';
    mocks.readDirectoryAsync.mockReset();
    mocks.resetAnalyticsIdentity.mockReset();
    mocks.resetRevenueCatIdentity.mockReset();
    mocks.scheduleNotificationAsync.mockReset();
    mocks.setBadgeCountAsync.mockReset();
    mocks.setItem.mockReset().mockResolvedValue(undefined);
    mocks.getItem.mockReset().mockResolvedValue(null);
    mocks.removeItem.mockReset().mockResolvedValue(undefined);

    mocks.cancelAllScheduledNotificationsAsync.mockResolvedValue(undefined);
    mocks.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
    mocks.clearLastNotificationResponseAsync.mockResolvedValue(undefined);
    mocks.clearEncryptedPhotoStorage.mockResolvedValue(undefined);
    mocks.clearRoutineWidgetNativeState.mockResolvedValue(undefined);
    mocks.clearPrivateKVContentKey.mockResolvedValue(undefined);
    mocks.deleteAsync.mockResolvedValue(undefined);
    mocks.dismissAllNotificationsAsync.mockResolvedValue(undefined);
    mocks.dismissNotificationAsync.mockResolvedValue(undefined);
    mocks.multiRemove.mockResolvedValue(undefined);
    mocks.readDirectoryAsync.mockResolvedValue([
      'layerwell-export-456.json',
      'layerwell-share-card.png',
      'layerwell-export-123.json',
      'layerwell-share-card.png',
      'public-cache.json',
    ]);
    mocks.resetAnalyticsIdentity.mockResolvedValue(undefined);
    mocks.resetRevenueCatIdentity.mockResolvedValue(undefined);
    mocks.scheduleNotificationAsync.mockResolvedValue('notice');
    mocks.setBadgeCountAsync.mockResolvedValue(true);
  });

  it('clears local stores, cache files, notifications, and client vendor identities', async () => {
    await expect(clearLocalPrivateData()).resolves.toBeUndefined();

    expect(mocks.multiRemove).toHaveBeenCalledWith(
      expect.arrayContaining([
        'layerwell.routineActivation.v1',
        'layerwell.routineOrder.v1',
        'layerwell.photo.content_key_created.v1',
        'layerwell.skinprofile.v1',
      ]),
    );
    expect(mocks.clearRoutineWidgetNativeState).toHaveBeenCalledOnce();
    expect(mocks.clearRoutineWidgetNativeState.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.multiRemove.mock.invocationCallOrder[0]!,
    );
    expect(mocks.multiRemove.mock.calls[0]?.[0]).not.toContain('layerwell.localDataOwnerHash.v1');
    expect(mocks.multiRemove.mock.calls[0]?.[0]).not.toContain(
      'layerwell.localDataRetainedOwnerHash.v1',
    );
    expect(mocks.multiRemove.mock.calls[0]?.[0]).not.toContain(
      'layerwell.localDataUnclaimedQuarantine.v1',
    );
    expect(mocks.multiRemove).toHaveBeenNthCalledWith(2, [
      'layerwell.localDataOwnerHash.v1',
      'layerwell.localDataRetainedOwnerHash.v1',
      'layerwell.localDataUnclaimedQuarantine.v1',
    ]);
    expect(mocks.multiRemove.mock.invocationCallOrder[1]).toBeGreaterThan(
      mocks.resetRevenueCatIdentity.mock.invocationCallOrder[0]!,
    );
    expect(mocks.multiRemove.mock.calls[0]?.[0]).not.toContain(
      'layerwell.localDataCleanupRequired.v1',
    );
    expect(mocks.multiRemove.mock.calls.flatMap(([keys]) => keys)).not.toContain(
      'layerwell.authDerivedCleanupRequired.v1',
    );
    expect(mocks.multiRemove.mock.calls.flatMap(([keys]) => keys)).not.toContain(
      'layerwell.store_transaction_notice.v2',
    );
    expect(
      mocks.multiRemove.mock.calls
        .flatMap(([keys]) => keys as string[])
        .some((key) => key.startsWith('layerwell.health_dependent_withdrawal.owner.')),
    ).toBe(false);
    expect(mocks.clearEncryptedPhotoStorage).toHaveBeenCalledTimes(1);
    expect(mocks.clearPrivateKVContentKey).toHaveBeenCalledTimes(1);
    expect(mocks.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mocks.dismissAllNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mocks.clearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
    expect(mocks.setBadgeCountAsync).toHaveBeenCalledExactlyOnceWith(0);
    expect(mocks.deleteAsync).toHaveBeenCalledWith('file://cache/layerwell-export-123.json', {
      idempotent: true,
    });
    expect(mocks.deleteAsync).toHaveBeenCalledWith('file://cache/layerwell-share-card.png', {
      idempotent: true,
    });
    expect(mocks.deleteAsync).toHaveBeenCalledWith('file://cache/layerwell-export-456.json', {
      idempotent: true,
    });
    expect(mocks.deleteAsync).toHaveBeenCalledWith('file://cache/layerwell-share-card.png', {
      idempotent: true,
    });
    expect(mocks.deleteAsync).not.toHaveBeenCalledWith('file://cache/public-cache.json', {
      idempotent: true,
    });
    expect(mocks.resetAnalyticsIdentity).toHaveBeenCalledTimes(1);
    expect(mocks.resetRevenueCatIdentity).toHaveBeenCalledTimes(1);
  });

  it('fails the account-boundary cleanup when a client identity reset fails', async () => {
    mocks.resetRevenueCatIdentity.mockRejectedValueOnce(new Error('revenuecat reset failed'));

    await expect(clearLocalPrivateData()).rejects.toThrow(
      'LOCAL_PRIVATE_DATA_CLEAR_FAILED:revenuecat_identity',
    );

    expect(mocks.multiRemove).toHaveBeenCalledTimes(1);
    expect(mocks.resetAnalyticsIdentity).toHaveBeenCalledTimes(1);
    expect(mocks.resetRevenueCatIdentity).toHaveBeenCalledTimes(1);
  });

  it('retains every owner proof when native widget privacy cleanup fails', async () => {
    mocks.clearRoutineWidgetNativeState.mockRejectedValueOnce(
      new Error('native widget cleanup unavailable'),
    );

    await expect(clearLocalPrivateData()).rejects.toThrow(
      'LOCAL_PRIVATE_DATA_CLEAR_FAILED:routine_widget_native_state',
    );

    expect(mocks.clearRoutineWidgetNativeState).toHaveBeenCalledOnce();
    expect(mocks.multiRemove).toHaveBeenCalledTimes(1);
    expect(mocks.clearEncryptedPhotoStorage).toHaveBeenCalledOnce();
    expect(mocks.clearPrivateKVContentKey).toHaveBeenCalledOnce();
    expect(mocks.resetRevenueCatIdentity).toHaveBeenCalledOnce();
  });

  it('fails closed if the final owner-proof removal cannot be committed', async () => {
    mocks.multiRemove
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(clearLocalPrivateData()).rejects.toThrow(
      'LOCAL_PRIVATE_DATA_CLEAR_FAILED:owner_proof',
    );

    expect(mocks.multiRemove).toHaveBeenCalledTimes(2);
    expect(mocks.clearEncryptedPhotoStorage).toHaveBeenCalledTimes(1);
    expect(mocks.resetRevenueCatIdentity).toHaveBeenCalledTimes(1);
    expect(mocks.multiRemove).toHaveBeenNthCalledWith(2, [
      'layerwell.localDataOwnerHash.v1',
      'layerwell.localDataRetainedOwnerHash.v1',
      'layerwell.localDataUnclaimedQuarantine.v1',
    ]);
  });

  it('fails closed when cache enumeration or notification cancellation fails', async () => {
    mocks.readDirectoryAsync.mockRejectedValueOnce(new Error('cache unavailable'));
    mocks.cancelAllScheduledNotificationsAsync.mockRejectedValueOnce(
      new Error('notifications unavailable'),
    );

    await expect(clearLocalPrivateData()).rejects.toThrow(
      'LOCAL_PRIVATE_DATA_CLEAR_FAILED:generated_cache,scheduled_notifications',
    );

    expect(mocks.multiRemove).toHaveBeenCalledTimes(1);
    expect(mocks.clearEncryptedPhotoStorage).toHaveBeenCalledTimes(1);
    expect(mocks.clearPrivateKVContentKey).toHaveBeenCalledTimes(1);
    expect(mocks.resetAnalyticsIdentity).toHaveBeenCalledTimes(1);
    expect(mocks.resetRevenueCatIdentity).toHaveBeenCalledTimes(1);
  });

  it('does not call the unavailable scheduled-notification backend on web', async () => {
    mocks.platformOS = 'web';

    await expect(clearLocalPrivateData()).resolves.toBeUndefined();

    expect(mocks.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  });

  it('closes and drains direct cleanup before its widget prelude or native destructive calls', async () => {
    let release!: () => void;
    mocks.waitForPrivateKVWritesToSettle.mockReturnValueOnce(
      new Promise<void>((resolve) => { release = resolve; }),
    );
    const cleanup = clearLocalPrivateData();
    await Promise.resolve();
    expect(mocks.beginPrivateKVAccountBoundary).toHaveBeenCalledOnce();
    await Promise.resolve();
    expect(mocks.multiRemove).not.toHaveBeenCalled();
    expect(mocks.clearPrivateKVContentKey).not.toHaveBeenCalled();
    release();
    await cleanup;
    expect(mocks.waitForPrivateKVWritesToSettle.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.clearRoutineWidgetNativeState.mock.invocationCallOrder[0]!,
    );
    expect(mocks.waitForEncryptedPhotoWritesToSettle.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.clearEncryptedPhotoStorage.mock.invocationCallOrder[0]!,
    );
    expect(mocks.endPrivateKVAccountBoundary).toHaveBeenCalledOnce();
    expect(mocks.endEncryptedPhotoAccountBoundary).toHaveBeenCalledOnce();
  });

  it('releases its own exclusion on a partial cleanup failure', async () => {
    mocks.clearPrivateKVContentKey.mockRejectedValueOnce(new Error('key unavailable'));
    await expect(clearLocalPrivateData()).rejects.toThrow('private_kv_key');
    expect(mocks.multiRemove).toHaveBeenCalledTimes(1);
    expect(mocks.endPrivateKVAccountBoundary).toHaveBeenCalledOnce();
    expect(mocks.endEncryptedPhotoAccountBoundary).toHaveBeenCalledOnce();
  });
});
