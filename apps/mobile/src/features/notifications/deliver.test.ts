import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotifPrefs } from './store';

const mocks = vi.hoisted(() => ({
  cancelAllScheduledNotificationsAsync: vi.fn(async () => {}),
  cancelScheduledNotificationAsync: vi.fn(async () => {}),
  loadEntitlement: vi.fn(async () => null),
  scheduleNotificationAsync: vi.fn(async () => 'notification-id'),
  setNotificationChannelAsync: vi.fn(async () => {}),
  setNotificationHandler: vi.fn(),
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
  recordSentLocal: vi.fn(async () => {}),
  sentThisWeekForTierLocal: vi.fn(async () => 0),
}));

vi.mock('./store', () => ({
  loadNotifPrefs: vi.fn(async () => prefs),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    from: vi.fn(() => ({
      insert: vi.fn(async () => ({ error: null })),
      select: vi.fn(() => ({
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn(async () => ({ count: 0 })),
      })),
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
  liveActivityEnabled: false,
  promotionalOptIn: false,
  lockscreenDiscreet: true,
};

describe('rescheduleReminders', () => {
  beforeEach(() => {
    mocks.cancelAllScheduledNotificationsAsync.mockClear();
    mocks.cancelScheduledNotificationAsync.mockClear();
    mocks.loadEntitlement.mockClear();
    mocks.loadEntitlement.mockResolvedValue(null);
    mocks.scheduleNotificationAsync.mockClear();
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
