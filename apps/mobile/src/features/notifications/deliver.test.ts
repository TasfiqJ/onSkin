import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificationTier } from '@onskin/types';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';

import type { NotifPrefs } from './store';
import type { SentTierCountRead } from './sentStore';

const mocks = vi.hoisted(() => ({
  cancelAllScheduledNotificationsAsync: vi.fn(async () => {}),
  cancelScheduledNotificationAsync: vi.fn(async () => {}),
  getAllScheduledNotificationsAsync: vi.fn(async () => [] as { identifier: string }[]),
  getUser: vi.fn(async () => ({ data: { user: null as { id: string } | null } })),
  insertNotificationLog: vi.fn(),
  insertNotificationLogAbortSignal: vi.fn(async () => ({ error: null })),
  readNotifPrefs: vi.fn(),
  loadEntitlement: vi.fn(async (): Promise<unknown> => null),
  recordSentLocal: vi.fn(async () => {}),
  saveNotifPrefs: vi.fn(),
  scheduleNotificationAsync: vi.fn(async () => 'notification-id'),
  setNotificationChannelAsync: vi.fn(async () => {}),
  setNotificationHandler: vi.fn(),
  sentThisWeekForTierLocal: vi.fn<
    (tier: NotificationTier, now: number) => Promise<SentTierCountRead>
  >(async () => ({ status: 'available', count: 0 })),
}));

vi.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: {
    DAILY: 'DAILY',
    DATE: 'DATE',
    WEEKLY: 'WEEKLY',
  },
  cancelAllScheduledNotificationsAsync: mocks.cancelAllScheduledNotificationsAsync,
  cancelScheduledNotificationAsync: mocks.cancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync: mocks.getAllScheduledNotificationsAsync,
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
  readNotifPrefs: mocks.readNotifPrefs,
  saveNotifPrefs: mocks.saveNotifPrefs,
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: vi.fn(() => ({
      insert: mocks.insertNotificationLog,
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
    mocks.getAllScheduledNotificationsAsync.mockClear();
    mocks.getAllScheduledNotificationsAsync.mockResolvedValue([]);
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
    mocks.readNotifPrefs.mockClear();
    mocks.readNotifPrefs.mockResolvedValue({ status: 'available', prefs, format: 'current' });
    mocks.recordSentLocal.mockClear();
    mocks.recordSentLocal.mockResolvedValue(undefined);
    mocks.saveNotifPrefs.mockClear();
    mocks.saveNotifPrefs.mockResolvedValue({ prefs, changed: true });
    mocks.scheduleNotificationAsync.mockClear();
    mocks.sentThisWeekForTierLocal.mockClear();
    mocks.sentThisWeekForTierLocal.mockResolvedValue({ status: 'available', count: 0 });
  });

  it('shifts scheduled reminders inside quiet hours to the quiet-hours end', async () => {
    const { rescheduleReminders } = await import('./deliver');

    await rescheduleReminders(prefs);

    expect(mocks.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(mocks.cancelScheduledNotificationAsync.mock.calls.slice(0, 3)).toEqual([
      ['onskin-am-reminder'],
      ['onskin-pm-reminder'],
      ['onskin-capture-reminder'],
    ]);
    expect(mocks.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
      'onskin-trial-reminder',
    );
    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
    expect(mocks.scheduleNotificationAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        identifier: 'onskin-am-reminder',
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
        identifier: 'onskin-pm-reminder',
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
        identifier: 'onskin-capture-reminder',
        trigger: expect.objectContaining({
          type: 'WEEKLY',
          hour: 7,
          minute: 0,
        }),
      }),
    );
  });

  it('serializes overlapping reconciliations so the newest snapshot wins', async () => {
    const { rescheduleReminders } = await import('./deliver');
    let releaseFirst!: (id: string) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    mocks.scheduleNotificationAsync.mockImplementationOnce(() => {
      markStarted();
      return new Promise<string>((resolve) => {
        releaseFirst = resolve;
      });
    });
    const firstPrefs = { ...prefs, amTime: '08:01', pmEnabled: false, captureReminders: false };
    const finalPrefs = {
      ...firstPrefs,
      amEnabled: false,
      timezone: 'America/Toronto',
    };

    const first = rescheduleReminders(firstPrefs);
    await started;
    const second = rescheduleReminders(finalPrefs);
    releaseFirst('onskin-am-reminder');
    await Promise.all([first, second]);

    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mocks.cancelScheduledNotificationAsync.mock.calls.slice(-3)).toEqual([
      ['onskin-am-reminder'],
      ['onskin-pm-reminder'],
      ['onskin-capture-reminder'],
    ]);
  });

  it('rebuilds a matching intent when a fixed native schedule disappeared externally', async () => {
    const { rescheduleReminders } = await import('./deliver');
    const healthPrefs = { ...prefs, timezone: 'America/St_Johns' };

    await rescheduleReminders(healthPrefs);
    mocks.cancelScheduledNotificationAsync.mockClear();
    mocks.scheduleNotificationAsync.mockClear();

    await rescheduleReminders(healthPrefs);

    expect(mocks.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mocks.cancelScheduledNotificationAsync.mock.calls).toEqual([
      ['onskin-am-reminder'],
      ['onskin-pm-reminder'],
      ['onskin-capture-reminder'],
    ]);
    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
  });

  it('keeps preference persistence and reconciliation in one queue before later delivery', async () => {
    const { notifyBehavioural, saveAndRescheduleNotifPrefs } = await import('./deliver');
    const disabledPrefs: NotifPrefs = {
      ...prefs,
      amEnabled: false,
      pmEnabled: false,
      captureReminders: false,
      replenishmentAlerts: false,
      timezone: 'America/Vancouver',
    };
    let authoritativePrefs = prefs;
    let releaseSave!: () => void;
    let markSaveStarted!: () => void;
    const saveStarted = new Promise<void>((resolve) => {
      markSaveStarted = resolve;
    });
    mocks.readNotifPrefs.mockImplementation(async () => ({
      status: 'available',
      prefs: authoritativePrefs,
      format: 'current',
    }));
    mocks.saveNotifPrefs.mockImplementationOnce((patch: Partial<NotifPrefs>) => {
      expect(patch).toEqual({ replenishmentAlerts: false });
      markSaveStarted();
      return new Promise((resolve) => {
        releaseSave = () => {
          authoritativePrefs = disabledPrefs;
          resolve({ prefs: disabledPrefs, changed: true });
        };
      });
    });

    const saving = saveAndRescheduleNotifPrefs({ replenishmentAlerts: false });
    await saveStarted;
    const delivery = notifyBehavioural('replenishment', '12:00');

    expect(mocks.readNotifPrefs).not.toHaveBeenCalled();
    releaseSave();
    await expect(saving).resolves.toEqual({ prefs: disabledPrefs, changed: true });
    await expect(delivery).resolves.toBe(false);

    expect(mocks.readNotifPrefs).toHaveBeenCalledTimes(1);
    expect(mocks.saveNotifPrefs.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.readNotifPrefs.mock.invocationCallOrder[0]!,
    );
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.recordSentLocal).not.toHaveBeenCalled();
  });

  it('cleans fixed IDs and surfaces a partial native scheduling failure', async () => {
    const { rescheduleReminders } = await import('./deliver');
    mocks.scheduleNotificationAsync.mockRejectedValueOnce(new Error('native schedule failed'));

    await expect(
      rescheduleReminders({ ...prefs, amTime: '08:02' }),
    ).rejects.toThrow('native schedule failed');

    expect(mocks.cancelScheduledNotificationAsync.mock.calls.slice(-3)).toEqual([
      ['onskin-am-reminder'],
      ['onskin-pm-reminder'],
      ['onskin-capture-reminder'],
    ]);
  });

  it('suspends only preference-owned fixed schedules', async () => {
    const { suspendPreferenceOwnedReminders } = await import('./deliver');

    await suspendPreferenceOwnedReminders();

    expect(mocks.cancelScheduledNotificationAsync.mock.calls.slice(-3)).toEqual([
      ['onskin-am-reminder'],
      ['onskin-pm-reminder'],
      ['onskin-capture-reminder'],
    ]);
    expect(mocks.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
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

  it('surfaces a native trial scheduling failure to its caller', async () => {
    const { scheduleTrialReminder } = await import('./deliver');
    const nativeError = new Error('trial schedule unavailable');
    mocks.loadEntitlement.mockResolvedValueOnce({
      isActive: true,
      periodType: 'trial',
      expiresAt: '2099-07-12T12:00:00.000Z',
      priceLabel: 'CA$69.99',
    });
    mocks.scheduleNotificationAsync.mockRejectedValueOnce(nativeError);

    await expect(scheduleTrialReminder()).rejects.toBe(nativeError);

    expect(mocks.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'onskin-trial-reminder',
    );
    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('surfaces failure to clear the prior fixed trial request before rescheduling', async () => {
    const { scheduleTrialReminder } = await import('./deliver');
    const cancelError = new Error('trial cancellation unavailable');
    mocks.cancelScheduledNotificationAsync.mockRejectedValueOnce(cancelError);

    await expect(scheduleTrialReminder()).rejects.toBe(cancelError);

    expect(mocks.loadEntitlement).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('surfaces a native trial cancellation failure to conversion callers', async () => {
    const { cancelTrialReminder } = await import('./deliver');
    const cancelError = new Error('trial cancellation unavailable');
    mocks.cancelScheduledNotificationAsync.mockRejectedValueOnce(cancelError);

    await expect(cancelTrialReminder()).rejects.toBe(cancelError);

    expect(mocks.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'onskin-trial-reminder',
    );
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
    mocks.readNotifPrefs.mockClear();
    mocks.readNotifPrefs.mockResolvedValue({ status: 'available', prefs, format: 'current' });
    mocks.recordSentLocal.mockClear();
    mocks.recordSentLocal.mockResolvedValue(undefined);
    mocks.saveNotifPrefs.mockClear();
    mocks.saveNotifPrefs.mockResolvedValue({ prefs, changed: true });
    mocks.scheduleNotificationAsync.mockClear();
    mocks.sentThisWeekForTierLocal.mockClear();
    mocks.sentThisWeekForTierLocal.mockResolvedValue({ status: 'available', count: 0 });
  });

  it('sends an allowed behavioural notification and records the local cap ledger', async () => {
    const { notifyBehavioural } = await import('./deliver');

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(true);

    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { body: 'body:replenishment', title: 'RoutineKind' },
      trigger: null,
    });
    expect(mocks.recordSentLocal).toHaveBeenCalledWith('replenishment', expect.any(Number));
    expect(mocks.recordSentLocal.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.scheduleNotificationAsync.mock.invocationCallOrder[0]!,
    );
  });

  it('never asks the OS to present when the cap reservation cannot be persisted', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.recordSentLocal.mockRejectedValueOnce(new Error('ledger unavailable'));

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

    expect(mocks.recordSentLocal).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it('conservatively retains the reserved cap slot when native presentation fails', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.scheduleNotificationAsync.mockRejectedValueOnce(new Error('native schedule failed'));

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

    expect(mocks.recordSentLocal).toHaveBeenCalledWith('replenishment', expect.any(Number));
    expect(mocks.recordSentLocal.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.scheduleNotificationAsync.mock.invocationCallOrder[0]!,
    );
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it('does not send when the kind-specific user toggle is off', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.readNotifPrefs.mockResolvedValueOnce({
      status: 'available',
      prefs: { ...prefs, replenishmentAlerts: false },
      format: 'current',
    });

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
    mocks.sentThisWeekForTierLocal.mockResolvedValueOnce({ status: 'available', count: 3 });

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.recordSentLocal).not.toHaveBeenCalled();
  });

  it('reserves one behavioural-tier cap slot while the weekly capture schedule is enabled', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.sentThisWeekForTierLocal.mockResolvedValue({ status: 'available', count: 2 });

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

    mocks.readNotifPrefs.mockResolvedValueOnce({
      status: 'available',
      prefs: { ...prefs, captureReminders: false },
      format: 'current',
    });
    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(true);

    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mocks.recordSentLocal).toHaveBeenCalledTimes(1);
  });

  it.each([
    { status: 'unavailable', count: null, reason: 'storage_unavailable' },
    { status: 'corrupt', count: null, reason: 'invalid_payload' },
    { status: 'unsupported_version', count: null },
  ] as const)('suppresses delivery when the local cap ledger is not authoritative', async (state) => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.sentThisWeekForTierLocal.mockResolvedValueOnce(state);

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.recordSentLocal).not.toHaveBeenCalled();
  });

  it.each([
    { status: 'unavailable', prefs: null, reason: 'storage_unavailable' },
    { status: 'corrupt', prefs: null, reason: 'invalid_payload' },
    { status: 'unsupported_version', prefs: null },
  ] as const)('suppresses delivery when notification preferences are not authoritative', async (state) => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.readNotifPrefs.mockResolvedValueOnce(state);

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

    expect(mocks.sentThisWeekForTierLocal).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('serializes concurrent evaluations within the cap left after the capture reservation', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.sentThisWeekForTierLocal.mockImplementation(async () => ({
      status: 'available',
      count: mocks.recordSentLocal.mock.calls.length,
    }));

    const results = await Promise.all(
      Array.from({ length: 20 }, () => notifyBehavioural('replenishment', '12:00')),
    );

    expect(results.filter(Boolean)).toHaveLength(2);
    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mocks.recordSentLocal).toHaveBeenCalledTimes(2);
  });

  it('still reports sent when the best-effort server log write fails after local delivery', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    mocks.insertNotificationLogAbortSignal.mockRejectedValueOnce(new Error('offline'));

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(true);

    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mocks.recordSentLocal).toHaveBeenCalledWith('replenishment', expect.any(Number));
    await vi.waitFor(() => {
      expect(mocks.insertNotificationLog).toHaveBeenCalledWith({
        user_id: 'user-1',
        tier: 'behavioural',
        kind: 'replenishment',
      });
    });
    await waitForAccountGenerationOperationsToSettle();
  });

  it('does not hold the local scheduling queue while the optional server mirror is pending', async () => {
    const { notifyBehavioural, rescheduleReminders } = await import('./deliver');
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
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

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(true);
    await insertStarted;
    await expect(
      rescheduleReminders({
        ...prefs,
        amEnabled: false,
        pmEnabled: false,
        captureReminders: false,
        timezone: 'America/Halifax',
      }),
    ).resolves.toBeUndefined();

    releaseInsert({ error: null });
    await waitForAccountGenerationOperationsToSettle();
  });

  it('cancels a delayed owner-A native request but retains its pre-reserved cap slot', async () => {
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
    expect(mocks.recordSentLocal).toHaveBeenCalledTimes(1);
    expect(mocks.recordSentLocal.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.scheduleNotificationAsync.mock.invocationCallOrder[0]!,
    );
  });

  it('keeps a detached notification-log mirror scoped to owner A across an A-to-B boundary', async () => {
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
    await expect(notification).resolves.toBe(true);
    await insertStarted;
    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseInsert({ error: null });
    await waitForAccountGenerationOperationsToSettle();
    endAccountGenerationBoundary();
    boundaryActive = false;

    expect(mocks.insertNotificationLog).toHaveBeenCalledWith({
      user_id: 'owner-a',
      tier: 'behavioural',
      kind: 'replenishment',
    });
  });
});
