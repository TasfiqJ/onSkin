import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';

import type { NotifPrefs } from './store';

const mocks = vi.hoisted(() => ({
  assertHealthDataWriteLease: vi.fn(),
  canUseRoutineCadence: vi.fn(),
  canUseRoutineRecovery: vi.fn(),
  cancelAllScheduledNotificationsAsync: vi.fn(async () => {}),
  cancelScheduledNotificationAsync: vi.fn(async (_id: string) => {}),
  getPermissionsAsync: vi.fn(async () => ({
    status: 'granted',
    granted: true,
    canAskAgain: true,
    expires: 'never',
  })),
  requestPermissionsAsync: vi.fn(async () => ({
    status: 'denied',
    granted: false,
    canAskAgain: false,
    expires: 'never',
  })),
  healthOpen: true,
  loadNotifPrefs: vi.fn(),
  loadEntitlement: vi.fn(async (): Promise<unknown> => null),
  reserveNotificationSlotLocal: vi.fn(async () => true),
  captureHealthDataWriteLease: vi.fn(),
  scheduleNotificationAsync: vi.fn(async () => 'notification-id'),
  setNotificationChannelAsync: vi.fn(async () => {}),
  setNotificationHandler: vi.fn(),
}));

vi.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  IosAuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
  SchedulableTriggerInputTypes: {
    DAILY: 'DAILY',
    DATE: 'DATE',
    WEEKLY: 'WEEKLY',
  },
  cancelAllScheduledNotificationsAsync: mocks.cancelAllScheduledNotificationsAsync,
  cancelScheduledNotificationAsync: mocks.cancelScheduledNotificationAsync,
  getPermissionsAsync: mocks.getPermissionsAsync,
  requestPermissionsAsync: mocks.requestPermissionsAsync,
  scheduleNotificationAsync: mocks.scheduleNotificationAsync,
  setNotificationChannelAsync: mocks.setNotificationChannelAsync,
  setNotificationHandler: mocks.setNotificationHandler,
}));

vi.mock('@/lib/consent/healthDataWriteAdmission', () => ({
  assertHealthDataWriteLease: mocks.assertHealthDataWriteLease,
  captureHealthDataWriteLease: mocks.captureHealthDataWriteLease,
  HEALTH_DATA_WRITE_ADMISSION_CLOSED: 'HEALTH_DATA_WRITE_ADMISSION_CLOSED',
  HEALTH_DATA_WRITE_OWNER_MISMATCH: 'HEALTH_DATA_WRITE_OWNER_MISMATCH',
  runHealthDataWriteOperation: async (
    ownerUserId: string,
    operation: (lease: { ownerUserId: string; assertCurrent: () => void }) => unknown,
  ) => {
    const assertCurrent = () => {
      if (!mocks.healthOpen) throw new Error('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    };
    assertCurrent();
    const result = await operation({ ownerUserId, assertCurrent });
    assertCurrent();
    return result;
  },
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

vi.mock('@/features/routine/reviewGate', () => ({
  canUseRoutineCadence: mocks.canUseRoutineCadence,
  canUseRoutineRecovery: mocks.canUseRoutineRecovery,
}));

vi.mock('./copy', () => ({
  notificationContentForLockScreen: vi.fn((kind: string) => ({
    body: `body:${kind}`,
    title: 'RoutineKind',
  })),
}));

vi.mock('@/features/subscription/copy', () => ({
  PAYWALL_COPY: {
    trialReminder: {
      bodyFor: vi.fn(
        (date: string, price: string, cadence: string) =>
          `Trial ends ${date} at ${price}/${cadence}`,
      ),
      title: 'Your free trial ends in 2 days',
    },
  },
}));

vi.mock('@/features/subscription/plans', () => ({
  PLANS: {
    annual: {
      priceLabel: '$49.99',
    },
  },
}));

vi.mock('@/features/subscription/store', () => ({
  loadEntitlement: mocks.loadEntitlement,
}));

vi.mock('./sentStore', () => ({
  reserveNotificationSlotLocal: mocks.reserveNotificationSlotLocal,
}));

vi.mock('./store', () => ({
  loadNotifPrefs: mocks.loadNotifPrefs,
}));

const prefs: NotifPrefs = {
  amEnabled: true,
  pmEnabled: true,
  amTime: '06:30',
  pmTime: '21:30',
  streakNudges: true,
  replenishmentAlerts: true,
  captureReminders: true,
  quietStart: '22:00',
  quietEnd: '07:00',
  timezone: 'UTC',
  liveActivityEnabled: false,
  promotionalOptIn: false,
  lockscreenDiscreet: true,
};

beforeEach(() => {
  mocks.healthOpen = true;
  mocks.canUseRoutineCadence.mockReset();
  mocks.canUseRoutineCadence.mockReturnValue(true);
  mocks.canUseRoutineRecovery.mockReset();
  mocks.canUseRoutineRecovery.mockReturnValue(true);
  mocks.assertHealthDataWriteLease.mockReset();
  mocks.captureHealthDataWriteLease.mockReset();
  mocks.captureHealthDataWriteLease.mockImplementation(() => {
    if (!mocks.healthOpen) throw new Error('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    return { generation: 1, epoch: 1, ownerUserId: 'test-owner' };
  });
  mocks.assertHealthDataWriteLease.mockImplementation(() => {
    if (!mocks.healthOpen) throw new Error('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
  });
  mocks.getPermissionsAsync.mockReset();
  mocks.getPermissionsAsync.mockResolvedValue({
    status: 'granted',
    granted: true,
    canAskAgain: true,
    expires: 'never',
  });
  mocks.requestPermissionsAsync.mockReset();
  mocks.requestPermissionsAsync.mockResolvedValue({
    status: 'denied',
    granted: false,
    canAskAgain: false,
    expires: 'never',
  });
  mocks.reserveNotificationSlotLocal.mockReset();
  mocks.reserveNotificationSlotLocal.mockResolvedValue(true);
});

describe('notification authorization', () => {
  it.each([
    [0, 'not_determined'],
    [1, 'denied'],
    [2, 'authorized'],
    [3, 'provisional'],
    [4, 'ephemeral'],
  ] as const)('preserves iOS authorization status %s as %s', async (iosStatus, expected) => {
    mocks.getPermissionsAsync.mockResolvedValueOnce({
      status: 'undetermined',
      granted: false,
      canAskAgain: true,
      expires: 'never',
      ios: { status: iosStatus },
    } as never);
    const { getPermissionStatus } = await import('./deliver');

    await expect(getPermissionStatus()).resolves.toBe(expected);
  });

  it('does not request again when authorization is already deliverable', async () => {
    const { requestPermission } = await import('./deliver');

    await expect(requestPermission()).resolves.toEqual({
      kind: 'already_authorized',
      state: 'authorized',
      requestAttempted: false,
    });

    expect(mocks.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('does not call the OS request when denial is permanently blocked', async () => {
    mocks.getPermissionsAsync.mockResolvedValueOnce({
      status: 'denied',
      granted: false,
      canAskAgain: false,
      expires: 'never',
    });
    const { requestPermission } = await import('./deliver');

    await expect(requestPermission()).resolves.toEqual({
      kind: 'blocked',
      state: 'denied',
      requestAttempted: false,
    });

    expect(mocks.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('requests only alerts and reports the observed result without prompt claims', async () => {
    mocks.getPermissionsAsync.mockResolvedValueOnce({
      status: 'undetermined',
      granted: false,
      canAskAgain: true,
      expires: 'never',
    });
    mocks.requestPermissionsAsync.mockResolvedValueOnce({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });
    const { requestPermission } = await import('./deliver');

    await expect(requestPermission()).resolves.toEqual({
      kind: 'authorized',
      state: 'authorized',
      requestAttempted: true,
    });
    expect(mocks.requestPermissionsAsync).toHaveBeenCalledWith({
      ios: { allowAlert: true, allowBadge: false, allowSound: false },
    });
  });

  it('reports authorization API failure separately from denial', async () => {
    mocks.getPermissionsAsync.mockRejectedValueOnce(new Error('native unavailable'));
    const { getPermissionStatus, requestPermission } = await import('./deliver');

    await expect(getPermissionStatus()).resolves.toBe('unavailable');
    mocks.getPermissionsAsync.mockRejectedValueOnce(new Error('native unavailable'));
    await expect(requestPermission()).resolves.toEqual({
      kind: 'error',
      state: 'unavailable',
      requestAttempted: false,
    });
  });
});

describe('rescheduleReminders', () => {
  beforeEach(() => {
    mocks.cancelAllScheduledNotificationsAsync.mockReset();
    mocks.cancelAllScheduledNotificationsAsync.mockResolvedValue(undefined);
    mocks.cancelScheduledNotificationAsync.mockReset();
    mocks.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
    mocks.loadEntitlement.mockClear();
    mocks.loadEntitlement.mockResolvedValue(null);
    mocks.loadNotifPrefs.mockClear();
    mocks.loadNotifPrefs.mockResolvedValue(prefs);
    mocks.scheduleNotificationAsync.mockReset();
    mocks.scheduleNotificationAsync.mockResolvedValue('notification-id');
  });

  it('shifts scheduled reminders inside quiet hours to the quiet-hours end', async () => {
    const { rescheduleReminders } = await import('./deliver');

    await rescheduleReminders(prefs);

    expect(mocks.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
    expect(mocks.scheduleNotificationAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        trigger: expect.objectContaining({
          type: 'DAILY',
          hour: 7,
          minute: 0,
        }),
      }),
    );
    expect(mocks.scheduleNotificationAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        trigger: expect.objectContaining({
          type: 'DAILY',
          hour: 21,
          minute: 30,
        }),
      }),
    );
    expect(mocks.scheduleNotificationAsync).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        trigger: expect.objectContaining({
          type: 'WEEKLY',
          hour: 7,
          minute: 0,
        }),
      }),
    );
  });

  it('cancels stale health schedules and creates none when authorization is not deliverable', async () => {
    mocks.getPermissionsAsync.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
      expires: 'never',
    });
    const { rescheduleReminders } = await import('./deliver');

    await rescheduleReminders(prefs);

    expect(mocks.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('drains a delayed native schedule and removes it before withdrawal cancellation finishes', async () => {
    const { rescheduleReminders, waitForHealthNotificationOperationsToSettle } =
      await import('./deliver');
    let releaseSchedule!: () => void;
    let markScheduleStarted!: () => void;
    const scheduleGate = new Promise<void>((resolve) => {
      releaseSchedule = resolve;
    });
    const scheduleStarted = new Promise<void>((resolve) => {
      markScheduleStarted = resolve;
    });
    let healthReminderAlive = false;
    mocks.scheduleNotificationAsync.mockImplementationOnce(async () => {
      markScheduleStarted();
      await scheduleGate;
      healthReminderAlive = true;
      return 'delayed-health-reminder';
    });
    mocks.cancelScheduledNotificationAsync.mockImplementation(async (id: string) => {
      if (id === 'delayed-health-reminder') healthReminderAlive = false;
    });
    mocks.cancelAllScheduledNotificationsAsync.mockImplementation(async () => {
      healthReminderAlive = false;
    });

    const scheduling = rescheduleReminders(prefs);
    await scheduleStarted;
    beginAccountGenerationBoundary();
    let cleanupFinished = false;
    const withdrawalCleanup = (async () => {
      await waitForHealthNotificationOperationsToSettle();
      await mocks.cancelAllScheduledNotificationsAsync();
      cleanupFinished = true;
    })();

    try {
      await Promise.resolve();
      expect(cleanupFinished).toBe(false);

      releaseSchedule();
      await scheduling;
      await withdrawalCleanup;

      expect(healthReminderAlive).toBe(false);
      expect(mocks.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'delayed-health-reminder',
      );
      expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    } finally {
      releaseSchedule();
      await withdrawalCleanup;
      endAccountGenerationBoundary();
    }
  });

  it('cancels a just-created reminder when the health lease closes during native scheduling', async () => {
    const { rescheduleReminders } = await import('./deliver');
    let releaseSchedule!: () => void;
    let markScheduleStarted!: () => void;
    const scheduleGate = new Promise<void>((resolve) => {
      releaseSchedule = resolve;
    });
    const scheduleStarted = new Promise<void>((resolve) => {
      markScheduleStarted = resolve;
    });
    let healthReminderAlive = false;
    mocks.scheduleNotificationAsync.mockImplementationOnce(async () => {
      markScheduleStarted();
      await scheduleGate;
      healthReminderAlive = true;
      return 'expired-health-reminder';
    });
    mocks.cancelScheduledNotificationAsync.mockImplementation(async (id: string) => {
      if (id === 'expired-health-reminder') healthReminderAlive = false;
    });

    const scheduling = rescheduleReminders(prefs);
    await scheduleStarted;
    mocks.healthOpen = false;
    releaseSchedule();
    await scheduling;

    expect(healthReminderAlive).toBe(false);
    expect(mocks.cancelScheduledNotificationAsync).toHaveBeenCalledWith('expired-health-reminder');
    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('keeps the billing-only trial reminder independent when health admission is closed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-05T12:00:00.000Z'));
    mocks.healthOpen = false;
    mocks.loadEntitlement.mockResolvedValueOnce({
      isActive: true,
      periodType: 'trial',
      expiresAt: '2026-07-12T12:00:00.000Z',
      productId: 'routinekind_pro_annual_dev',
      priceLabel: 'CA$69.99',
    });

    try {
      const { rescheduleReminders } = await import('./deliver');
      await rescheduleReminders(prefs);

      expect(mocks.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
      expect(mocks.scheduleNotificationAsync).toHaveBeenCalledOnce();
      expect(mocks.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: 'onskin-trial-reminder' }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('scheduleTrialReminder', () => {
  beforeEach(() => {
    mocks.cancelScheduledNotificationAsync.mockReset();
    mocks.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
    mocks.loadEntitlement.mockClear();
    mocks.loadEntitlement.mockResolvedValue(null);
    mocks.scheduleNotificationAsync.mockReset();
    mocks.scheduleNotificationAsync.mockResolvedValue('notification-id');
  });

  it('uses the localized RevenueCat price stored on the trial entitlement', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-05T12:00:00.000Z'));

    try {
      const { scheduleTrialReminder } = await import('./deliver');
      mocks.loadEntitlement.mockResolvedValueOnce({
        isActive: true,
        periodType: 'trial',
        expiresAt: '2026-07-12T12:00:00.000Z',
        productId: 'routinekind_pro_annual_dev',
        priceLabel: 'CA$69.99',
      });

      await scheduleTrialReminder();

      expect(mocks.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: {
            body: 'Trial ends Jul 12 at CA$69.99/annual',
            title: 'Your free trial ends in 2 days',
          },
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('notifyBehavioural', () => {
  beforeEach(() => {
    mocks.cancelAllScheduledNotificationsAsync.mockReset();
    mocks.cancelAllScheduledNotificationsAsync.mockResolvedValue(undefined);
    mocks.cancelScheduledNotificationAsync.mockReset();
    mocks.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
    mocks.loadEntitlement.mockClear();
    mocks.loadNotifPrefs.mockClear();
    mocks.loadNotifPrefs.mockResolvedValue(prefs);
    mocks.scheduleNotificationAsync.mockReset();
    mocks.scheduleNotificationAsync.mockResolvedValue('notification-id');
  });

  it('refuses ramp-up before preference reads or notification side effects when cadence is closed', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.canUseRoutineCadence.mockReturnValue(false);

    await expect(notifyBehavioural('rampup', '12:00')).resolves.toBe(false);

    expect(mocks.loadNotifPrefs).not.toHaveBeenCalled();
    expect(mocks.captureHealthDataWriteLease).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.reserveNotificationSlotLocal).not.toHaveBeenCalled();
  });

  it('refuses de-escalation before preference reads or side effects when recovery is closed', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.canUseRoutineRecovery.mockReturnValue(false);

    await expect(notifyBehavioural('deescalation', '12:00')).resolves.toBe(false);

    expect(mocks.loadNotifPrefs).not.toHaveBeenCalled();
    expect(mocks.captureHealthDataWriteLease).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.reserveNotificationSlotLocal).not.toHaveBeenCalled();
  });

  it('reserves the local cap before scheduling an allowed behavioural notification', async () => {
    const { notifyBehavioural } = await import('./deliver');

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(true);

    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { body: 'body:replenishment', title: 'RoutineKind' },
      trigger: null,
    });
    expect(mocks.reserveNotificationSlotLocal).toHaveBeenCalledWith(
      'replenishment',
      expect.any(Number),
    );
    expect(mocks.reserveNotificationSlotLocal.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.scheduleNotificationAsync.mock.invocationCallOrder[0]!,
    );
  });

  it('keeps reserved capacity when native scheduling fails', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.scheduleNotificationAsync.mockRejectedValueOnce(new Error('native schedule failed'));

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

    expect(mocks.reserveNotificationSlotLocal).toHaveBeenCalledOnce();
    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledOnce();
  });

  it('does not send when the kind-specific user toggle is off', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.loadNotifPrefs.mockResolvedValueOnce({ ...prefs, replenishmentAlerts: false });

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.reserveNotificationSlotLocal).not.toHaveBeenCalled();
  });

  it('does not send inside quiet hours', async () => {
    const { notifyBehavioural } = await import('./deliver');

    await expect(notifyBehavioural('replenishment', '23:30')).resolves.toBe(false);

    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.reserveNotificationSlotLocal).not.toHaveBeenCalled();
  });

  it('does not reserve or schedule after authorization is revoked', async () => {
    mocks.getPermissionsAsync.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
      expires: 'never',
    });
    const { notifyBehavioural } = await import('./deliver');

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

    expect(mocks.reserveNotificationSlotLocal).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('enforces the local behavioural weekly cap before sending', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.reserveNotificationSlotLocal.mockResolvedValueOnce(false);

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.reserveNotificationSlotLocal).toHaveBeenCalledOnce();
  });

  it('serializes concurrent native operations so only the atomically admitted call schedules', async () => {
    let remainingSlots = 1;
    mocks.reserveNotificationSlotLocal.mockImplementation(async () => {
      if (remainingSlots === 0) return false;
      remainingSlots -= 1;
      return true;
    });
    const { notifyBehavioural } = await import('./deliver');

    const outcomes = await Promise.all(
      Array.from({ length: 10 }, () => notifyBehavioural('replenishment', '12:00')),
    );

    expect(outcomes.filter(Boolean)).toHaveLength(1);
    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('keeps scheduling decisions device-local without a remote notification log', async () => {
    const { notifyBehavioural } = await import('./deliver');

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(true);

    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('does not reserve or schedule after an A-to-B boundary interrupts authorization refresh', async () => {
    const { notifyBehavioural } = await import('./deliver');
    let releaseAuthorization!: () => void;
    const authorizationGate = new Promise<void>((resolve) => {
      releaseAuthorization = resolve;
    });
    let signalAuthorizationRead!: () => void;
    const authorizationReadStarted = new Promise<void>((resolve) => {
      signalAuthorizationRead = resolve;
    });
    mocks.getPermissionsAsync.mockImplementationOnce(async () => {
      signalAuthorizationRead();
      await authorizationGate;
      return {
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      };
    });

    const delivery = notifyBehavioural('replenishment', '12:00');
    await authorizationReadStarted;
    beginAccountGenerationBoundary();
    const drained = waitForAccountGenerationOperationsToSettle();
    try {
      releaseAuthorization();
      await expect(delivery).resolves.toBe(false);
      await drained;

      expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(mocks.reserveNotificationSlotLocal).not.toHaveBeenCalled();
    } finally {
      releaseAuthorization();
      await drained;
      endAccountGenerationBoundary();
    }
  });

  it('keeps boundary drain open through a delayed native schedule and cancels stale work', async () => {
    const { notifyBehavioural } = await import('./deliver');
    let releaseSchedule!: () => void;
    const scheduleGate = new Promise<void>((resolve) => {
      releaseSchedule = resolve;
    });
    let signalScheduleStarted!: () => void;
    const scheduleStarted = new Promise<void>((resolve) => {
      signalScheduleStarted = resolve;
    });
    mocks.scheduleNotificationAsync.mockImplementationOnce(async () => {
      signalScheduleStarted();
      await scheduleGate;
      return 'notification-id';
    });

    const delivery = notifyBehavioural('replenishment', '12:00');
    await scheduleStarted;
    beginAccountGenerationBoundary();
    let drainSettled = false;
    const drained = waitForAccountGenerationOperationsToSettle().then(() => {
      drainSettled = true;
    });
    try {
      await Promise.resolve();
      expect(drainSettled).toBe(false);

      releaseSchedule();
      await expect(delivery).resolves.toBe(false);
      await drained;

      expect(mocks.scheduleNotificationAsync).toHaveBeenCalledOnce();
      expect(mocks.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notification-id');
      expect(mocks.reserveNotificationSlotLocal).toHaveBeenCalledOnce();
    } finally {
      releaseSchedule();
      await drained;
      endAccountGenerationBoundary();
    }
  });

  it('cancels immediate delivery when health authorization closes during the native call', async () => {
    const { notifyBehavioural } = await import('./deliver');
    let releaseSchedule!: () => void;
    let markScheduleStarted!: () => void;
    const scheduleGate = new Promise<void>((resolve) => {
      releaseSchedule = resolve;
    });
    const scheduleStarted = new Promise<void>((resolve) => {
      markScheduleStarted = resolve;
    });
    let healthNotificationAlive = false;
    mocks.scheduleNotificationAsync.mockImplementationOnce(async () => {
      markScheduleStarted();
      await scheduleGate;
      healthNotificationAlive = true;
      return 'behavioural-health-reminder';
    });
    mocks.cancelScheduledNotificationAsync.mockImplementation(async (id: string) => {
      if (id === 'behavioural-health-reminder') healthNotificationAlive = false;
    });

    const delivery = notifyBehavioural('replenishment', '12:00');
    await scheduleStarted;
    mocks.healthOpen = false;
    releaseSchedule();

    await expect(delivery).resolves.toBe(false);
    expect(healthNotificationAlive).toBe(false);
    expect(mocks.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'behavioural-health-reminder',
    );
    expect(mocks.reserveNotificationSlotLocal).toHaveBeenCalledOnce();
  });
});
