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
  getUser: vi.fn(async () => ({ data: { user: null as { id: string } | null } })),
  healthOpen: true,
  insertNotificationLog: vi.fn(async () => ({ error: null })),
  loadNotifPrefs: vi.fn(),
  loadEntitlement: vi.fn(async (): Promise<unknown> => null),
  notificationLogGte: vi.fn(async () => ({ count: 0 })),
  recordSentLocal: vi.fn(async () => {}),
  captureHealthDataWriteLease: vi.fn(),
  scheduleNotificationAsync: vi.fn(async () => 'notification-id'),
  selectNotificationLog: vi.fn(),
  setNotificationChannelAsync: vi.fn(async () => {}),
  setNotificationHandler: vi.fn(),
  sentThisWeekForTierLocal: vi.fn(async () => 0),
}));

mocks.selectNotificationLog.mockReturnValue({
  eq: vi.fn().mockReturnThis(),
  gte: mocks.notificationLogGte,
});

vi.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: {
    DAILY: 'DAILY',
    DATE: 'DATE',
    WEEKLY: 'WEEKLY',
  },
  cancelAllScheduledNotificationsAsync: mocks.cancelAllScheduledNotificationsAsync,
  cancelScheduledNotificationAsync: mocks.cancelScheduledNotificationAsync,
  getPermissionsAsync: vi.fn(async () => ({ status: 'undetermined' })),
  requestPermissionsAsync: vi.fn(async () => ({ status: 'denied' })),
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
      bodyFor: vi.fn((date: string, price: string) => `Trial ends ${date} at ${price}`),
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
  recordSentLocal: mocks.recordSentLocal,
  sentThisWeekForTierLocal: mocks.sentThisWeekForTierLocal,
}));

vi.mock('./store', () => ({
  loadNotifPrefs: mocks.loadNotifPrefs,
}));

vi.mock('@/lib/supabase/client', () => ({
  getPersistedSupabaseUser: mocks.getUser,
  supabase: {
    auth: { getUser: mocks.getUser },
    from: vi.fn(() => ({
      insert: mocks.insertNotificationLog,
      select: mocks.selectNotificationLog,
    })),
  },
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
});

describe('rescheduleReminders', () => {
  beforeEach(() => {
    mocks.cancelAllScheduledNotificationsAsync.mockReset();
    mocks.cancelAllScheduledNotificationsAsync.mockResolvedValue(undefined);
    mocks.cancelScheduledNotificationAsync.mockReset();
    mocks.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
    mocks.loadEntitlement.mockClear();
    mocks.loadEntitlement.mockResolvedValue(null);
    mocks.getUser.mockClear();
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.insertNotificationLog.mockClear();
    mocks.insertNotificationLog.mockResolvedValue({ error: null });
    mocks.loadNotifPrefs.mockClear();
    mocks.loadNotifPrefs.mockResolvedValue(prefs);
    mocks.notificationLogGte.mockClear();
    mocks.notificationLogGte.mockResolvedValue({ count: 0 });
    mocks.recordSentLocal.mockClear();
    mocks.recordSentLocal.mockResolvedValue(undefined);
    mocks.scheduleNotificationAsync.mockReset();
    mocks.scheduleNotificationAsync.mockResolvedValue('notification-id');
    mocks.selectNotificationLog.mockClear();
    mocks.selectNotificationLog.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      gte: mocks.notificationLogGte,
    });
    mocks.sentThisWeekForTierLocal.mockClear();
    mocks.sentThisWeekForTierLocal.mockResolvedValue(0);
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
        priceLabel: 'CA$69.99',
      });

      await scheduleTrialReminder();

      expect(mocks.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: {
            body: 'Trial ends Jul 12 at CA$69.99',
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
    mocks.getUser.mockClear();
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.insertNotificationLog.mockClear();
    mocks.insertNotificationLog.mockResolvedValue({ error: null });
    mocks.loadEntitlement.mockClear();
    mocks.loadNotifPrefs.mockClear();
    mocks.loadNotifPrefs.mockResolvedValue(prefs);
    mocks.notificationLogGte.mockClear();
    mocks.notificationLogGte.mockResolvedValue({ count: 0 });
    mocks.recordSentLocal.mockClear();
    mocks.recordSentLocal.mockResolvedValue(undefined);
    mocks.scheduleNotificationAsync.mockReset();
    mocks.scheduleNotificationAsync.mockResolvedValue('notification-id');
    mocks.selectNotificationLog.mockClear();
    mocks.selectNotificationLog.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      gte: mocks.notificationLogGte,
    });
    mocks.sentThisWeekForTierLocal.mockClear();
    mocks.sentThisWeekForTierLocal.mockResolvedValue(0);
  });

  it('refuses ramp-up before preference reads or notification side effects when cadence is closed', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.canUseRoutineCadence.mockReturnValue(false);

    await expect(notifyBehavioural('rampup', '12:00')).resolves.toBe(false);

    expect(mocks.loadNotifPrefs).not.toHaveBeenCalled();
    expect(mocks.captureHealthDataWriteLease).not.toHaveBeenCalled();
    expect(mocks.sentThisWeekForTierLocal).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.recordSentLocal).not.toHaveBeenCalled();
    expect(mocks.insertNotificationLog).not.toHaveBeenCalled();
  });

  it('refuses de-escalation before preference reads or side effects when recovery is closed', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.canUseRoutineRecovery.mockReturnValue(false);

    await expect(notifyBehavioural('deescalation', '12:00')).resolves.toBe(false);

    expect(mocks.loadNotifPrefs).not.toHaveBeenCalled();
    expect(mocks.captureHealthDataWriteLease).not.toHaveBeenCalled();
    expect(mocks.sentThisWeekForTierLocal).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.recordSentLocal).not.toHaveBeenCalled();
    expect(mocks.insertNotificationLog).not.toHaveBeenCalled();
  });

  it('sends an allowed behavioural notification and records the local cap ledger', async () => {
    const { notifyBehavioural } = await import('./deliver');

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(true);

    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { body: 'body:replenishment', title: 'RoutineKind' },
      trigger: null,
    });
    expect(mocks.recordSentLocal).toHaveBeenCalledWith('replenishment', expect.any(Number));
  });

  it('does not send when the kind-specific user toggle is off', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.loadNotifPrefs.mockResolvedValueOnce({ ...prefs, replenishmentAlerts: false });

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.recordSentLocal).not.toHaveBeenCalled();
  });

  it('does not send inside quiet hours', async () => {
    const { notifyBehavioural } = await import('./deliver');

    await expect(notifyBehavioural('replenishment', '23:30')).resolves.toBe(false);

    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.recordSentLocal).not.toHaveBeenCalled();
  });

  it('enforces the local behavioural weekly cap before sending', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.sentThisWeekForTierLocal.mockResolvedValueOnce(3);

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.recordSentLocal).not.toHaveBeenCalled();
  });

  it('unions the server cap count when a signed-in user exists', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    mocks.notificationLogGte.mockResolvedValueOnce({ count: 3 });

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.recordSentLocal).not.toHaveBeenCalled();
  });

  it('still reports sent when the best-effort server log write fails after local delivery', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    mocks.insertNotificationLog.mockRejectedValueOnce(new Error('offline'));

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(true);

    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mocks.recordSentLocal).toHaveBeenCalledWith('replenishment', expect.any(Number));
    expect(mocks.insertNotificationLog).toHaveBeenCalledWith({
      user_id: 'user-1',
      tier: 'behavioural',
      kind: 'replenishment',
    });
  });

  it('does not schedule or write after an A-to-B boundary interrupts user verification', async () => {
    const { notifyBehavioural } = await import('./deliver');
    let releaseUser!: () => void;
    const userGate = new Promise<void>((resolve) => {
      releaseUser = resolve;
    });
    let signalUserRead!: () => void;
    const userReadStarted = new Promise<void>((resolve) => {
      signalUserRead = resolve;
    });
    mocks.getUser.mockImplementationOnce(async () => {
      signalUserRead();
      await userGate;
      return { data: { user: { id: 'account-a' } } };
    });

    const delivery = notifyBehavioural('replenishment', '12:00');
    await userReadStarted;
    beginAccountGenerationBoundary();
    const drained = waitForAccountGenerationOperationsToSettle();
    try {
      releaseUser();
      await expect(delivery).resolves.toBe(false);
      await drained;

      expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(mocks.recordSentLocal).not.toHaveBeenCalled();
      expect(mocks.insertNotificationLog).not.toHaveBeenCalled();
    } finally {
      releaseUser();
      await drained;
      endAccountGenerationBoundary();
    }
  });

  it('keeps boundary drain open through a delayed native schedule and never records stale A', async () => {
    const { notifyBehavioural } = await import('./deliver');
    let releaseSchedule!: () => void;
    const scheduleGate = new Promise<void>((resolve) => {
      releaseSchedule = resolve;
    });
    let signalScheduleStarted!: () => void;
    const scheduleStarted = new Promise<void>((resolve) => {
      signalScheduleStarted = resolve;
    });
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'account-a' } } });
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
      expect(mocks.recordSentLocal).not.toHaveBeenCalled();
      expect(mocks.insertNotificationLog).not.toHaveBeenCalled();
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
    expect(mocks.recordSentLocal).not.toHaveBeenCalled();
    expect(mocks.insertNotificationLog).not.toHaveBeenCalled();
  });
});
