import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearLocalPrivateData } from './localPrivateData';

const mocks = vi.hoisted(() => ({
  cancelAllScheduledNotificationsAsync: vi.fn(),
  clearEncryptedPhotoStorage: vi.fn(),
  clearRoutineWidgetNativeState: vi.fn(),
  clearPrivateKVContentKey: vi.fn(),
  deleteAsync: vi.fn(),
  multiRemove: vi.fn(),
  platformOS: 'ios',
  readDirectoryAsync: vi.fn(),
  resetAnalyticsIdentity: vi.fn(),
  resetRevenueCatIdentity: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    multiRemove: mocks.multiRemove,
  },
}));

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file://cache/',
  deleteAsync: mocks.deleteAsync,
  readDirectoryAsync: mocks.readDirectoryAsync,
}));

vi.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: mocks.cancelAllScheduledNotificationsAsync,
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
  clearPrivateKVContentKey: mocks.clearPrivateKVContentKey,
}));

describe('local private data cleanup', () => {
  beforeEach(() => {
    mocks.cancelAllScheduledNotificationsAsync.mockReset();
    mocks.clearEncryptedPhotoStorage.mockReset();
    mocks.clearRoutineWidgetNativeState.mockReset();
    mocks.clearPrivateKVContentKey.mockReset();
    mocks.deleteAsync.mockReset();
    mocks.multiRemove.mockReset();
    mocks.platformOS = 'ios';
    mocks.readDirectoryAsync.mockReset();
    mocks.resetAnalyticsIdentity.mockReset();
    mocks.resetRevenueCatIdentity.mockReset();

    mocks.cancelAllScheduledNotificationsAsync.mockResolvedValue(undefined);
    mocks.clearEncryptedPhotoStorage.mockResolvedValue(undefined);
    mocks.clearRoutineWidgetNativeState.mockResolvedValue(undefined);
    mocks.clearPrivateKVContentKey.mockResolvedValue(undefined);
    mocks.deleteAsync.mockResolvedValue(undefined);
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
});
