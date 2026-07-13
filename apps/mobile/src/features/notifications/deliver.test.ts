import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';

import type { NotifPrefs } from './store';

const mocks = vi.hoisted(() => ({
  cancelAllScheduledNotificationsAsync: vi.fn(async () => {}),
  cancelScheduledNotificationAsync: vi.fn(async () => {}),
  getUser: vi.fn(async () => ({ data: { user: null as { id: string } | null } })),
  insertNotificationLog: vi.fn(),
  insertNotificationLogAbortSignal: vi.fn(async () => ({ error: null })),
  loadNotifPrefs: vi.fn(),
  loadEntitlement: vi.fn(async (): Promise<unknown> => null),
  notificationLogAbortSignal: vi.fn(async () => ({ count: 0 })),
  notificationLogGte: vi.fn(),
  recordSentLocal: vi.fn(async () => {}),
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
mocks.notificationLogGte.mockReturnValue({ abortSignal: mocks.notificationLogAbortSignal });

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

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
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

let boundaryActive = false;

afterEach(() => {
  if (boundaryActive) {
    endAccountGenerationBoundary();
    boundaryActive = false;
  }
});

describe('rescheduleReminders', () => {
  beforeEach(() => {
    mocks.cancelAllScheduledNotificationsAsync.mockClear();
    mocks.cancelScheduledNotificationAsync.mockClear();
    mocks.loadEntitlement.mockClear();
    mocks.loadEntitlement.mockResolvedValue(null);
    mocks.getUser.mockClear();
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.insertNotificationLog.mockClear();
    mocks.insertNotificationLog.mockReturnValue({
      abortSignal: mocks.insertNotificationLogAbortSignal,
    });
    mocks.insertNotificationLogAbortSignal.mockClear();
    mocks.insertNotificationLogAbortSignal.mockResolvedValue({ error: null });
    mocks.loadNotifPrefs.mockClear();
    mocks.loadNotifPrefs.mockResolvedValue(prefs);
    mocks.notificationLogGte.mockClear();
    mocks.notificationLogGte.mockReturnValue({ abortSignal: mocks.notificationLogAbortSignal });
    mocks.notificationLogAbortSignal.mockClear();
    mocks.notificationLogAbortSignal.mockResolvedValue({ count: 0 });
    mocks.recordSentLocal.mockClear();
    mocks.recordSentLocal.mockResolvedValue(undefined);
    mocks.scheduleNotificationAsync.mockClear();
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
});

describe('scheduleTrialReminder', () => {
  beforeEach(() => {
    mocks.cancelScheduledNotificationAsync.mockClear();
    mocks.loadEntitlement.mockClear();
    mocks.loadEntitlement.mockResolvedValue(null);
    mocks.scheduleNotificationAsync.mockClear();
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
    mocks.cancelAllScheduledNotificationsAsync.mockClear();
    mocks.cancelScheduledNotificationAsync.mockClear();
    mocks.getUser.mockClear();
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.insertNotificationLog.mockClear();
    mocks.insertNotificationLog.mockReturnValue({
      abortSignal: mocks.insertNotificationLogAbortSignal,
    });
    mocks.insertNotificationLogAbortSignal.mockClear();
    mocks.insertNotificationLogAbortSignal.mockResolvedValue({ error: null });
    mocks.loadEntitlement.mockClear();
    mocks.loadNotifPrefs.mockClear();
    mocks.loadNotifPrefs.mockResolvedValue(prefs);
    mocks.notificationLogGte.mockClear();
    mocks.notificationLogGte.mockReturnValue({ abortSignal: mocks.notificationLogAbortSignal });
    mocks.notificationLogAbortSignal.mockClear();
    mocks.notificationLogAbortSignal.mockResolvedValue({ count: 0 });
    mocks.recordSentLocal.mockClear();
    mocks.recordSentLocal.mockResolvedValue(undefined);
    mocks.scheduleNotificationAsync.mockClear();
    mocks.selectNotificationLog.mockClear();
    mocks.selectNotificationLog.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      gte: mocks.notificationLogGte,
    });
    mocks.sentThisWeekForTierLocal.mockClear();
    mocks.sentThisWeekForTierLocal.mockResolvedValue(0);
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
    mocks.notificationLogAbortSignal.mockResolvedValueOnce({ count: 3 });

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.recordSentLocal).not.toHaveBeenCalled();
  });

  it('still reports sent when the best-effort server log write fails after local delivery', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    mocks.insertNotificationLogAbortSignal.mockRejectedValueOnce(new Error('offline'));

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(true);

    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mocks.recordSentLocal).toHaveBeenCalledWith('replenishment', expect.any(Number));
    expect(mocks.insertNotificationLog).toHaveBeenCalledWith({
      user_id: 'user-1',
      tier: 'behavioural',
      kind: 'replenishment',
    });
  });

  it('cancels a delayed owner-A notification when an account boundary starts', async () => {
    const { notifyBehavioural } = await import('./deliver');
    let releaseSchedule!: (id: string) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    mocks.scheduleNotificationAsync.mockImplementationOnce(() => {
      markStarted();
      return new Promise<string>((resolve) => {
        releaseSchedule = resolve;
      });
    });

    const notification = notifyBehavioural('replenishment', '12:00');
    await started;
    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseSchedule('owner-a-notification');

    await expect(notification).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(mocks.cancelScheduledNotificationAsync).toHaveBeenCalledWith('owner-a-notification');
    expect(mocks.recordSentLocal).not.toHaveBeenCalled();
  });

  it('keeps a delayed notification-log mirror scoped to owner A across an A-to-B boundary', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'owner-a' } } });
    let releaseInsert!: (value: { error: null }) => void;
    let markInsertStarted!: () => void;
    const insertStarted = new Promise<void>((resolve) => {
      markInsertStarted = resolve;
    });
    mocks.insertNotificationLogAbortSignal.mockImplementationOnce(() => {
      markInsertStarted();
      return new Promise((resolve) => {
        releaseInsert = resolve;
      });
    });

    const notification = notifyBehavioural('replenishment', '12:00');
    await insertStarted;
    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseInsert({ error: null });

    await expect(notification).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(mocks.insertNotificationLog).toHaveBeenCalledWith({
      user_id: 'owner-a',
      tier: 'behavioural',
      kind: 'replenishment',
    });
  });
});
