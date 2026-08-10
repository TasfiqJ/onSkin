import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearHealthPurposeLocalData, HEALTH_PURPOSE_PRIVATE_DATA_KEYS } from './selectiveCleanup';

const mocks = vi.hoisted(() => ({
  beginAccount: vi.fn(),
  beginPhoto: vi.fn(),
  beginPrivate: vi.fn(),
  cancelNotifications: vi.fn(async () => {}),
  cancelQueries: vi.fn(async () => {}),
  clearCache: vi.fn(async () => {}),
  clearNativeWidgets: vi.fn(async () => {}),
  clearPhotos: vi.fn(async () => {}),
  clearQueries: vi.fn(),
  endAccount: vi.fn(),
  endPhoto: vi.fn(),
  endPrivate: vi.fn(),
  multiRemove: vi.fn(async () => {}),
  purgeImages: vi.fn(async () => true),
  resetAnalyticsIdentity: vi.fn(async () => {}),
  scavenge: vi.fn(async () => 0),
  scheduleTrialReminder: vi.fn(async () => {}),
  waitAccount: vi.fn(async () => {}),
  waitPhoto: vi.fn(async () => {}),
  waitPrivate: vi.fn(async () => {}),
  waitNotifications: vi.fn(async () => {}),
  ownership: 'match',
  runAccountGenerationOperation: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { multiRemove: mocks.multiRemove },
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: mocks.cancelNotifications,
}));
vi.mock('@/features/photos/encryptedStorage', () => ({
  beginEncryptedPhotoAccountBoundary: mocks.beginPhoto,
  clearEncryptedPhotoStorage: mocks.clearPhotos,
  endEncryptedPhotoAccountBoundary: mocks.endPhoto,
  waitForEncryptedPhotoWritesToSettle: mocks.waitPhoto,
}));
vi.mock('@/features/notifications/deliver', () => ({
  scheduleTrialReminder: mocks.scheduleTrialReminder,
  waitForHealthNotificationOperationsToSettle: mocks.waitNotifications,
}));
vi.mock('@/features/photos/sensitiveImageMemory', () => ({
  purgeSensitiveImageMemory: mocks.purgeImages,
}));
vi.mock('@/features/settings/localPrivateData', () => ({
  clearGeneratedPrivateCacheFiles: mocks.clearCache,
}));
vi.mock('@/features/widgets/lifecycleCoordinator', () => ({
  clearRoutineWidgetLifecycleForPrivacy: mocks.clearNativeWidgets,
}));
vi.mock('@/lib/analytics/track', () => ({
  resetAnalyticsIdentity: mocks.resetAnalyticsIdentity,
}));
vi.mock('@/lib/auth/accountGeneration', () => ({
  beginAccountGenerationBoundaryFromLease: mocks.beginAccount,
  runAccountGenerationOperation: mocks.runAccountGenerationOperation,
  waitForAccountGenerationOperationsToSettle: mocks.waitAccount,
}));
vi.mock('@/lib/auth/sessionOwner', () => ({
  readLocalDataOwnership: vi.fn(async () => mocks.ownership),
}));
vi.mock('@/lib/env', () => ({ isSupabaseConfigured: true }));
vi.mock('@/lib/query/queryClient', () => ({
  queryClient: { cancelQueries: mocks.cancelQueries, clear: mocks.clearQueries },
}));
vi.mock('@/lib/storage/privateKV', () => ({
  beginPrivateKVAccountBoundary: mocks.beginPrivate,
  endPrivateKVAccountBoundary: mocks.endPrivate,
  waitForPrivateKVWritesToSettle: mocks.waitPrivate,
}));
vi.mock('@/lib/storage/plaintextStaging', () => ({
  scavengePlaintextStaging: mocks.scavenge,
}));

describe('health-purpose local cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ownership = 'match';
    mocks.beginAccount.mockReturnValue(mocks.endAccount);
    mocks.runAccountGenerationOperation.mockImplementation(
      (operation: (lease: { signal: AbortSignal; assertCurrent: () => void }) => unknown) =>
        operation({ signal: new AbortController().signal, assertCurrent: vi.fn() }),
    );
  });

  it('clears health records and media behind all account boundaries', async () => {
    const order: string[] = [];
    mocks.endPrivate.mockImplementationOnce(() => order.push('end-private'));
    mocks.endAccount.mockImplementationOnce(() => order.push('end-account'));
    mocks.scheduleTrialReminder.mockImplementationOnce(async () => {
      order.push('trial-reminder');
    });
    await clearHealthPurposeLocalData('owner-a');

    expect(mocks.beginAccount).toHaveBeenCalledOnce();
    expect(mocks.beginPrivate).toHaveBeenCalledOnce();
    expect(mocks.beginPhoto).toHaveBeenCalledOnce();
    expect(mocks.multiRemove).toHaveBeenCalledWith([...HEALTH_PURPOSE_PRIVATE_DATA_KEYS]);
    expect(HEALTH_PURPOSE_PRIVATE_DATA_KEYS).toEqual(
      expect.arrayContaining(['layerwell.widgetActionMap.v1', 'layerwell.widgetActionMap.v2']),
    );
    expect(mocks.clearPhotos).toHaveBeenCalledOnce();
    expect(mocks.clearNativeWidgets).toHaveBeenCalledOnce();
    expect(mocks.purgeImages).toHaveBeenCalledOnce();
    expect(mocks.resetAnalyticsIdentity).toHaveBeenCalledOnce();
    expect(mocks.waitNotifications).toHaveBeenCalledTimes(2);
    expect(mocks.cancelNotifications).toHaveBeenCalledTimes(2);
    expect(mocks.scheduleTrialReminder).toHaveBeenCalledOnce();
    expect(mocks.endPhoto).toHaveBeenCalledOnce();
    expect(mocks.endPrivate).toHaveBeenCalledOnce();
    expect(mocks.endAccount).toHaveBeenCalledOnce();
    expect(order).toEqual(['end-private', 'end-account', 'trial-reminder']);
    expect(mocks.clearNativeWidgets.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.waitAccount.mock.invocationCallOrder[0]!,
    );
    expect(mocks.clearNativeWidgets.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.waitPrivate.mock.invocationCallOrder[0]!,
    );
    expect(mocks.clearNativeWidgets.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.waitPhoto.mock.invocationCallOrder[0]!,
    );
    expect(mocks.clearNativeWidgets.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.waitNotifications.mock.invocationCallOrder[0]!,
    );
    expect(mocks.clearNativeWidgets.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.multiRemove.mock.invocationCallOrder[0]!,
    );
  });

  it('closes native widget admission before a tracked writer can stall withdrawal', async () => {
    let releaseAccountWriter!: () => void;
    mocks.waitAccount.mockImplementationOnce(
      () => new Promise<void>((resolve) => (releaseAccountWriter = resolve)),
    );

    const cleanup = clearHealthPurposeLocalData('owner-a');
    await vi.waitFor(() => expect(mocks.clearNativeWidgets).toHaveBeenCalledOnce());
    expect(mocks.waitAccount).toHaveBeenCalledOnce();
    expect(mocks.waitPrivate).not.toHaveBeenCalled();

    releaseAccountWriter();
    await cleanup;
  });

  it('does not include account, App Lock, entitlement, or store-safety authority', () => {
    expect(HEALTH_PURPOSE_PRIVATE_DATA_KEYS).toContain('layerwell.commerceConsent.v1');
    expect(HEALTH_PURPOSE_PRIVATE_DATA_KEYS).toContain('layerwell.communityConsent.v1');
    expect(HEALTH_PURPOSE_PRIVATE_DATA_KEYS).not.toContain('layerwell.communityAge16.v1');
    expect(HEALTH_PURPOSE_PRIVATE_DATA_KEYS).not.toContain('layerwell.appLock.enabled');
    expect(HEALTH_PURPOSE_PRIVATE_DATA_KEYS).not.toContain('layerwell.entitlement.v2');
    expect(HEALTH_PURPOSE_PRIVATE_DATA_KEYS).not.toContain(
      'layerwell.store_transaction_notice.v2',
    );
    expect(HEALTH_PURPOSE_PRIVATE_DATA_KEYS).not.toContain('layerwell.healthDataLifecycle.v1');
    expect(HEALTH_PURPOSE_PRIVATE_DATA_KEYS).not.toContain('layerwell.ageVerified');
    expect(HEALTH_PURPOSE_PRIVATE_DATA_KEYS).not.toContain('layerwell.subscription.promptedExpiry');
  });

  it('keeps every boundary closed until a failed cleanup has been observed', async () => {
    mocks.clearPhotos.mockRejectedValueOnce(new Error('disk unavailable'));
    await expect(clearHealthPurposeLocalData('owner-a')).rejects.toThrow(
      'HEALTH_PURPOSE_LOCAL_CLEAR_FAILED',
    );
    expect(mocks.endPhoto).toHaveBeenCalledOnce();
    expect(mocks.endPrivate).toHaveBeenCalledOnce();
    expect(mocks.endAccount).toHaveBeenCalledOnce();
  });

  it('keeps cleanup incomplete when legacy analytics persistence cannot be purged', async () => {
    mocks.resetAnalyticsIdentity.mockRejectedValueOnce(new Error('analytics storage unavailable'));

    await expect(clearHealthPurposeLocalData('owner-a')).rejects.toThrow(
      'HEALTH_PURPOSE_LOCAL_CLEAR_FAILED',
    );

    expect(mocks.resetAnalyticsIdentity).toHaveBeenCalledOnce();
    expect(mocks.multiRemove).toHaveBeenCalledOnce();
    expect(mocks.clearPhotos).toHaveBeenCalledOnce();
    expect(mocks.endPhoto).toHaveBeenCalledOnce();
    expect(mocks.endPrivate).toHaveBeenCalledOnce();
    expect(mocks.endAccount).toHaveBeenCalledOnce();
  });

  it('attempts all later teardown while native widget privacy cleanup remains retryable', async () => {
    mocks.clearNativeWidgets.mockRejectedValueOnce(new Error('app group unavailable'));

    await expect(clearHealthPurposeLocalData('owner-a')).rejects.toThrow(
      'HEALTH_PURPOSE_LOCAL_CLEAR_FAILED',
    );

    expect(mocks.clearNativeWidgets).toHaveBeenCalledOnce();
    expect(mocks.multiRemove).toHaveBeenCalledOnce();
    expect(mocks.clearPhotos).toHaveBeenCalledOnce();
    expect(mocks.cancelNotifications).toHaveBeenCalledTimes(2);
    expect(mocks.endPhoto).toHaveBeenCalledOnce();
    expect(mocks.endPrivate).toHaveBeenCalledOnce();
    expect(mocks.endAccount).toHaveBeenCalledOnce();
  });

  it('does not open a destructive boundary for a foreign local owner', async () => {
    mocks.ownership = 'mismatch';

    await expect(clearHealthPurposeLocalData('owner-a')).rejects.toThrow(
      'HEALTH_PURPOSE_LOCAL_CLEAR_OWNER_MISMATCH',
    );
    expect(mocks.beginAccount).not.toHaveBeenCalled();
    expect(mocks.multiRemove).not.toHaveBeenCalled();
  });
});
