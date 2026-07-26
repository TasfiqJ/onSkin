import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificationTier } from '@onskin/types';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  getAccountGeneration,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';

import type { NotifPrefs } from './store';
import type { SentTierCountRead } from './sentStore';

const mocks = vi.hoisted(() => ({
  cancelAllScheduledNotificationsAsync: vi.fn(async () => {}),
  cancelScheduledNotificationAsync: vi.fn(async () => {}),
  dismissAllNotificationsAsync: vi.fn(async () => {}),
  dismissNotificationAsync: vi.fn(async () => {}),
  getAllScheduledNotificationsAsync: vi.fn(async () => [] as { identifier: string }[]),
  getPermissionsAsync: vi.fn(),
  getUser: vi.fn(async () => ({ data: { user: null as { id: string } | null } })),
  insertNotificationLog: vi.fn(),
  insertNotificationLogAbortSignal: vi.fn(async () => ({ error: null })),
  confirmSentLocalDelivery: vi.fn(async () => ({ changed: true, outboxQueued: false })),
  readNotifPrefs: vi.fn(),
  loadEntitlement: vi.fn(async (): Promise<unknown> => null),
  reserveSentLocal: vi.fn(async () => {}),
  randomUUID: vi.fn(() => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  requestPermissionsAsync: vi.fn(),
  scheduleOutboxFlush: vi.fn(),
  saveNotifPrefs: vi.fn(),
  scheduleNotificationAsync: vi.fn(async (request: { identifier?: string }) =>
    Promise.resolve(request.identifier ?? 'notification-id'),
  ),
  setNotificationChannelAsync: vi.fn(async () => {}),
  setNotificationHandler: vi.fn(),
  sentThisWeekForTierLocal: vi.fn<
    (tier: NotificationTier, now: number) => Promise<SentTierCountRead>
  >(async () => ({ status: 'available', count: 0 })),
}));

vi.mock('expo-crypto', () => ({
  randomUUID: mocks.randomUUID,
}));

vi.mock('@/lib/offline/outbox', () => ({
  scheduleOutboxFlush: mocks.scheduleOutboxFlush,
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
  dismissAllNotificationsAsync: mocks.dismissAllNotificationsAsync,
  dismissNotificationAsync: mocks.dismissNotificationAsync,
  getAllScheduledNotificationsAsync: mocks.getAllScheduledNotificationsAsync,
  getPermissionsAsync: mocks.getPermissionsAsync,
  requestPermissionsAsync: mocks.requestPermissionsAsync,
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
      bodyFor: vi.fn((date: string, price: string | null) =>
        price ? `Trial ends ${date} at ${price}` : `Trial ends ${date}; check the App Store`,
      ),
      title: 'Your free trial ends in 2 days',
    },
  },
}));

vi.mock('@/features/subscription/store', () => ({
  loadEntitlement: mocks.loadEntitlement,
}));

vi.mock('./sentStore', () => ({
  confirmSentLocalDelivery: mocks.confirmSentLocalDelivery,
  reserveSentLocal: mocks.reserveSentLocal,
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

function activeRootScheduleLifecycle() {
  return {
    isCurrent: () => true,
    signal: new AbortController().signal,
  } as const;
}

beforeEach(() => {
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
    canAskAgain: true,
    expires: 'never',
  });
});

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
    mocks.dismissAllNotificationsAsync.mockClear();
    mocks.dismissNotificationAsync.mockClear();
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
    mocks.confirmSentLocalDelivery.mockClear();
    mocks.confirmSentLocalDelivery.mockResolvedValue({ changed: true, outboxQueued: false });
    mocks.reserveSentLocal.mockClear();
    mocks.reserveSentLocal.mockResolvedValue(undefined);
    mocks.randomUUID.mockClear();
    mocks.randomUUID.mockReturnValue('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    mocks.saveNotifPrefs.mockClear();
    mocks.saveNotifPrefs.mockResolvedValue({ prefs, changed: true });
    mocks.scheduleOutboxFlush.mockClear();
    mocks.scheduleNotificationAsync.mockClear();
    mocks.sentThisWeekForTierLocal.mockClear();
    mocks.sentThisWeekForTierLocal.mockResolvedValue({ status: 'available', count: 0 });
  });

  it('reports content-free notification schedule health', async () => {
    const { readNotificationScheduleHealth } = await import('./deliver');
    mocks.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'onskin-am-reminder' },
      { identifier: 'onskin-pm-reminder' },
      { identifier: 'onskin-capture-reminder' },
    ]);

    await expect(readNotificationScheduleHealth()).resolves.toBe('healthy');

    mocks.getAllScheduledNotificationsAsync.mockResolvedValue([{ identifier: 'unrelated' }]);
    await expect(readNotificationScheduleHealth()).resolves.toBe('mismatch');
  });

  it('fails notification schedule diagnostics closed without exposing errors', async () => {
    const { readNotificationScheduleHealth } = await import('./deliver');
    mocks.readNotifPrefs.mockRejectedValueOnce(new Error('private schedule payload'));

    await expect(readNotificationScheduleHealth()).resolves.toBe('unavailable');
  });

  it('distinguishes denial from an unavailable permission bridge', async () => {
    const { getPermissionStatus, requestPermission } = await import('./deliver');
    mocks.getPermissionsAsync.mockResolvedValueOnce({
      status: 'denied',
      granted: false,
      canAskAgain: false,
      expires: 'never',
    });
    await expect(getPermissionStatus()).resolves.toBe('denied');

    mocks.getPermissionsAsync.mockRejectedValueOnce(new Error('raw permission provider detail'));
    await expect(getPermissionStatus()).resolves.toBe('unavailable');

    mocks.requestPermissionsAsync.mockResolvedValueOnce({
      status: 'undetermined',
      granted: false,
      canAskAgain: true,
      expires: 'never',
    });
    await expect(requestPermission()).rejects.toMatchObject({
      code: 'NOTIFICATION_PERMISSION_REQUEST_UNAVAILABLE',
      reason: 'unresolved',
    });

    mocks.requestPermissionsAsync.mockRejectedValueOnce(new Error('raw request provider detail'));
    const rejected = requestPermission().catch((error: unknown) => error);
    await expect(rejected).resolves.toMatchObject({
      code: 'NOTIFICATION_PERMISSION_REQUEST_UNAVAILABLE',
      reason: 'bridge_failure',
    });
    await expect(rejected).resolves.not.toHaveProperty(
      'message',
      expect.stringContaining('provider detail'),
    );
  });

  it('rejects a malformed active permission response without reporting a denial or leaking provider data', async () => {
    const { requestPermission } = await import('./deliver');
    const privateProviderDetail = 'private native permission payload';
    mocks.requestPermissionsAsync.mockResolvedValueOnce({
      status: 'granted',
      granted: false,
      canAskAgain: true,
      expires: 'never',
      privateProviderDetail,
    });

    const rejected = await requestPermission().then(
      (value) => ({ kind: 'resolved' as const, value }),
      (error: unknown) => ({ kind: 'rejected' as const, error }),
    );

    expect(rejected.kind).toBe('rejected');
    if (rejected.kind !== 'rejected') {
      expect(rejected.value).not.toBe(false);
      return;
    }
    expect(rejected.error).toMatchObject({
      code: 'NOTIFICATION_PERMISSION_REQUEST_UNAVAILABLE',
      reason: 'invalid_response',
    });
    expect(String(rejected.error)).not.toContain(privateProviderDetail);
    expect(JSON.stringify(rejected.error)).not.toContain(privateProviderDetail);
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
    mocks.dismissNotificationAsync.mockClear();
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

  it('bypasses the signature fast path on revocation, cleans exact IDs, and restores from intent', async () => {
    const { rescheduleReminders } = await import('./deliver');
    const revocationPrefs = { ...prefs, timezone: 'America/Halifax' };

    await expect(rescheduleReminders(revocationPrefs)).resolves.toBe('scheduled');
    mocks.cancelScheduledNotificationAsync.mockClear();
    mocks.getAllScheduledNotificationsAsync.mockClear();
    mocks.scheduleNotificationAsync.mockClear();
    mocks.getPermissionsAsync.mockResolvedValueOnce({
      status: 'denied',
      granted: false,
      canAskAgain: false,
      expires: 'never',
    });

    await expect(rescheduleReminders(revocationPrefs)).resolves.toBe('suspended_denied');
    expect(mocks.cancelScheduledNotificationAsync.mock.calls).toEqual([
      ['onskin-am-reminder'],
      ['onskin-pm-reminder'],
      ['onskin-capture-reminder'],
    ]);
    expect(mocks.getAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();

    mocks.cancelScheduledNotificationAsync.mockClear();
    await expect(rescheduleReminders(revocationPrefs)).resolves.toBe('scheduled');
    expect(mocks.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(3);
    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
  });

  it('cleans exact fixed IDs and surfaces unavailable permission as retryable', async () => {
    const { rescheduleReminders } = await import('./deliver');
    mocks.getPermissionsAsync.mockRejectedValueOnce(new Error('native bridge raw message'));

    const rejected = rescheduleReminders({ ...prefs, timezone: 'America/Winnipeg' }).catch(
      (error: unknown) => error,
    );

    await expect(rejected).resolves.toMatchObject({
      code: 'NOTIFICATION_PERMISSION_UNAVAILABLE',
      reason: 'bridge_failure',
    });
    expect(mocks.cancelScheduledNotificationAsync.mock.calls.slice(-3)).toEqual([
      ['onskin-am-reminder'],
      ['onskin-pm-reminder'],
      ['onskin-capture-reminder'],
    ]);
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('audits trial permission without inventing preferences and fences the mounted generation', async () => {
    const { reconcileRootNotificationSchedules } = await import('./deliver');
    mocks.cancelScheduledNotificationAsync.mockClear();
    mocks.getPermissionsAsync.mockClear();

    await expect(
      reconcileRootNotificationSchedules(
        null,
        getAccountGeneration(),
        activeRootScheduleLifecycle(),
      ),
    ).resolves.toBe('scheduled');

    expect(mocks.getPermissionsAsync).toHaveBeenCalledOnce();
    expect(mocks.cancelScheduledNotificationAsync.mock.calls).toEqual([
      ['onskin-am-reminder'],
      ['onskin-pm-reminder'],
      ['onskin-capture-reminder'],
    ]);

    mocks.cancelScheduledNotificationAsync.mockClear();
    mocks.getPermissionsAsync.mockClear();
    await expect(
      reconcileRootNotificationSchedules(
        null,
        getAccountGeneration() + 1,
        activeRootScheduleLifecycle(),
      ),
    ).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(mocks.getPermissionsAsync).not.toHaveBeenCalled();
    expect(mocks.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it.each([
    ['denied', false],
    ['undetermined', true],
  ] as const)(
    'globally cleans exact fixed and trial IDs for trial-only %s permission',
    async (status, canAskAgain) => {
      const { reconcileRootNotificationSchedules } = await import('./deliver');
      mocks.cancelScheduledNotificationAsync.mockClear();
      mocks.getPermissionsAsync.mockResolvedValueOnce({
        status,
        granted: false,
        canAskAgain,
        expires: 'never',
      });

      await expect(
        reconcileRootNotificationSchedules(
          null,
          getAccountGeneration(),
          activeRootScheduleLifecycle(),
        ),
      ).resolves.toBe(status === 'denied' ? 'suspended_denied' : 'suspended_undetermined');

      expect(mocks.cancelScheduledNotificationAsync.mock.calls).toEqual([
        ['onskin-am-reminder'],
        ['onskin-pm-reminder'],
        ['onskin-capture-reminder'],
        ['onskin-trial-reminder'],
      ]);
      expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    },
  );

  it('cleans trial-only schedules before surfacing unavailable root permission', async () => {
    const { reconcileRootNotificationSchedules } = await import('./deliver');
    mocks.cancelScheduledNotificationAsync.mockClear();
    mocks.getPermissionsAsync.mockRejectedValueOnce(new Error('private provider failure'));

    await expect(
      reconcileRootNotificationSchedules(
        null,
        getAccountGeneration(),
        activeRootScheduleLifecycle(),
      ),
    ).rejects.toMatchObject({
      code: 'NOTIFICATION_PERMISSION_UNAVAILABLE',
      reason: 'bridge_failure',
    });

    expect(mocks.cancelScheduledNotificationAsync.mock.calls).toEqual([
      ['onskin-am-reminder'],
      ['onskin-pm-reminder'],
      ['onskin-capture-reminder'],
      ['onskin-trial-reminder'],
    ]);
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('performs zero permission or native work for an already-invalid lifecycle', async () => {
    const { reconcileRootNotificationSchedules } = await import('./deliver');
    const controller = new AbortController();
    controller.abort();

    await expect(
      reconcileRootNotificationSchedules(
        { ...prefs, timezone: 'America/Iqaluit' },
        getAccountGeneration(),
        {
          isCurrent: () => false,
          signal: controller.signal,
        },
      ),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_GENERATION_CHANGED',
    });
    expect(mocks.getPermissionsAsync).not.toHaveBeenCalled();
    expect(mocks.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('fences every native root mutation when lifecycle invalidates during permission read', async () => {
    const { reconcileRootNotificationSchedules } = await import('./deliver');
    const controller = new AbortController();
    let current = true;
    let resolvePermission!: (value: {
      status: string;
      granted: boolean;
      canAskAgain: boolean;
      expires: string;
    }) => void;
    let markPermissionStarted!: () => void;
    const permissionStarted = new Promise<void>((resolve) => {
      markPermissionStarted = resolve;
    });
    mocks.getPermissionsAsync.mockImplementationOnce(() => {
      markPermissionStarted();
      return new Promise((resolve) => {
        resolvePermission = resolve;
      });
    });

    const reconciliation = reconcileRootNotificationSchedules(
      { ...prefs, timezone: 'America/Yellowknife' },
      getAccountGeneration(),
      {
        isCurrent: () => current,
        signal: controller.signal,
      },
    ).catch((error: unknown) => error);
    await permissionStarted;

    current = false;
    controller.abort();
    resolvePermission({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });

    await expect(reconciliation).resolves.toMatchObject({
      code: 'ACCOUNT_GENERATION_CHANGED',
    });
    expect(mocks.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('stops a root cancellation sequence at the exact lifecycle boundary', async () => {
    const { reconcileRootNotificationSchedules } = await import('./deliver');
    const controller = new AbortController();
    let current = true;
    let resolveFirstCancellation!: () => void;
    mocks.cancelScheduledNotificationAsync.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstCancellation = resolve;
        }),
    );

    const reconciliation = reconcileRootNotificationSchedules(null, getAccountGeneration(), {
      isCurrent: () => current,
      signal: controller.signal,
    }).catch((error: unknown) => error);
    await vi.waitFor(() => {
      expect(mocks.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    });

    current = false;
    controller.abort();
    resolveFirstCancellation();

    await expect(reconciliation).resolves.toMatchObject({
      code: 'ACCOUNT_GENERATION_CHANGED',
    });
    expect(mocks.cancelScheduledNotificationAsync.mock.calls).toEqual([['onskin-am-reminder']]);
    expect(mocks.getPermissionsAsync).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('compensates an in-flight root schedule and starts no later schedule after invalidation', async () => {
    const { reconcileRootNotificationSchedules } = await import('./deliver');
    const controller = new AbortController();
    let current = true;
    let resolveSchedule!: (identifier: string) => void;
    const lifecyclePrefs = { ...prefs, timezone: 'America/Whitehorse' };
    mocks.scheduleNotificationAsync.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSchedule = resolve;
        }),
    );

    const reconciliation = reconcileRootNotificationSchedules(
      lifecyclePrefs,
      getAccountGeneration(),
      {
        isCurrent: () => current,
        signal: controller.signal,
      },
    ).catch((error: unknown) => error);
    await vi.waitFor(() => {
      expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    });

    current = false;
    controller.abort();
    await expect(reconciliation).resolves.toMatchObject({
      code: 'ACCOUNT_GENERATION_CHANGED',
    });
    resolveSchedule('onskin-am-reminder');

    await vi.waitFor(() => {
      expect(mocks.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(4);
      expect(mocks.dismissNotificationAsync).toHaveBeenCalledWith('onskin-am-reminder');
    });
    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mocks.cancelScheduledNotificationAsync).toHaveBeenNthCalledWith(4, 'onskin-am-reminder');

    mocks.getAllScheduledNotificationsAsync.mockClear();
    mocks.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'onskin-am-reminder' },
      { identifier: 'onskin-pm-reminder' },
      { identifier: 'onskin-capture-reminder' },
    ]);
    await expect(
      reconcileRootNotificationSchedules(
        lifecyclePrefs,
        getAccountGeneration(),
        activeRootScheduleLifecycle(),
      ),
    ).resolves.toBe('scheduled');

    expect(mocks.getAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(
      mocks.scheduleNotificationAsync.mock.calls.slice(1).map(([request]) => request.identifier),
    ).toEqual(['onskin-am-reminder', 'onskin-pm-reminder', 'onskin-capture-reminder']);
  });

  it('detaches a pending permission read at an account boundary before any native mutation', async () => {
    const { rescheduleReminders } = await import('./deliver');
    let resolvePermission!: (value: {
      status: string;
      granted: boolean;
      canAskAgain: boolean;
      expires: string;
    }) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    mocks.getPermissionsAsync.mockImplementationOnce(() => {
      markStarted();
      return new Promise((resolve) => {
        resolvePermission = resolve;
      });
    });

    const reconciliation = rescheduleReminders({
      ...prefs,
      timezone: 'America/Regina',
    });
    const rejected = reconciliation.catch((error: unknown) => error);
    await started;
    beginAccountGenerationBoundary();
    boundaryActive = true;
    await waitForAccountGenerationOperationsToSettle();

    await expect(rejected).resolves.toMatchObject({
      code: 'ACCOUNT_GENERATION_CHANGED',
    });
    expect(mocks.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();

    resolvePermission({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });
    await Promise.resolve();
    endAccountGenerationBoundary();
    boundaryActive = false;
  });

  it('detaches a never-settling schedule inventory read and queued owner-A work at the boundary', async () => {
    const { rescheduleReminders } = await import('./deliver');
    const ownerAPrefs = { ...prefs, timezone: 'Etc/GMT+7' };

    await rescheduleReminders(ownerAPrefs);

    let resolveInventory!: (requests: { identifier: string }[]) => void;
    let markInventoryStarted!: () => void;
    const inventoryStarted = new Promise<void>((resolve) => {
      markInventoryStarted = resolve;
    });
    mocks.getAllScheduledNotificationsAsync.mockImplementationOnce(() => {
      markInventoryStarted();
      return new Promise((resolve) => {
        resolveInventory = resolve;
      });
    });

    const inventory = rescheduleReminders(ownerAPrefs);
    const queued = rescheduleReminders({
      ...ownerAPrefs,
      amEnabled: false,
      pmEnabled: false,
      captureReminders: false,
    });
    const inventoryResult = inventory.catch((error: unknown) => error);
    const queuedResult = queued.catch((error: unknown) => error);
    await inventoryStarted;

    beginAccountGenerationBoundary();
    boundaryActive = true;
    await waitForAccountGenerationOperationsToSettle();

    await expect(inventoryResult).resolves.toMatchObject({
      code: 'ACCOUNT_GENERATION_CHANGED',
    });
    await expect(queuedResult).resolves.toMatchObject({
      code: 'ACCOUNT_GENERATION_CHANGED',
    });

    resolveInventory([]);
    await Promise.resolve();
    endAccountGenerationBoundary();
    boundaryActive = false;

    await expect(
      rescheduleReminders({
        ...ownerAPrefs,
        amEnabled: false,
        pmEnabled: false,
        captureReminders: false,
        timezone: 'America/Edmonton',
      }),
    ).resolves.toBe('scheduled');
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
    expect(mocks.reserveSentLocal).not.toHaveBeenCalled();
  });

  it('schedules durable convergence after an authenticated local commit', async () => {
    const { saveAndRescheduleNotifPrefs } = await import('./deliver');
    const owner = {
      ownerId: 'user-1',
      ownerGeneration: getAccountGeneration(),
      assertCurrent: vi.fn(),
    };

    await expect(saveAndRescheduleNotifPrefs({ pmEnabled: true }, owner)).resolves.toEqual({
      prefs,
      changed: true,
    });

    expect(mocks.saveNotifPrefs).toHaveBeenCalledWith(
      { pmEnabled: true },
      expect.objectContaining({
        ownerId: 'user-1',
        ownerGeneration: getAccountGeneration(),
        assertCurrent: expect.any(Function),
      }),
    );
    expect(mocks.scheduleOutboxFlush).toHaveBeenCalledTimes(1);
    expect(mocks.saveNotifPrefs.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.scheduleOutboxFlush.mock.invocationCallOrder[0]!,
    );
  });

  it('cleans fixed IDs and surfaces a partial native scheduling failure', async () => {
    const { rescheduleReminders } = await import('./deliver');
    mocks.scheduleNotificationAsync.mockRejectedValueOnce(new Error('native schedule failed'));

    await expect(rescheduleReminders({ ...prefs, amTime: '08:02' })).rejects.toThrow(
      'native schedule failed',
    );

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
    mocks.dismissNotificationAsync.mockClear();
    mocks.loadEntitlement.mockClear();
    mocks.loadEntitlement.mockResolvedValue(null);
    mocks.scheduleNotificationAsync.mockClear();
  });

  it('performs zero native or permission work for an already-invalid trial lifecycle', async () => {
    const { scheduleTrialReminder } = await import('./deliver');
    const controller = new AbortController();
    controller.abort();

    await expect(
      scheduleTrialReminder(
        {
          expiresAt: '2099-07-12T12:00:00.000Z',
          priceLabel: null,
        },
        {
          isCurrent: () => false,
          signal: controller.signal,
        },
      ),
    ).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });

    expect(mocks.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.getPermissionsAsync).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('stops the trial schedule pipeline when lifecycle invalidates during cancellation', async () => {
    const { scheduleTrialReminder } = await import('./deliver');
    const controller = new AbortController();
    let current = true;
    let resolveCancellation!: () => void;
    mocks.cancelScheduledNotificationAsync.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCancellation = resolve;
        }),
    );

    const scheduling = scheduleTrialReminder(
      {
        expiresAt: '2099-07-12T12:00:00.000Z',
        priceLabel: null,
      },
      {
        isCurrent: () => current,
        signal: controller.signal,
      },
    );
    await vi.waitFor(() => {
      expect(mocks.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    });

    current = false;
    controller.abort();
    await expect(scheduling).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    resolveCancellation();
    await Promise.resolve();

    expect(mocks.cancelScheduledNotificationAsync.mock.calls).toEqual([['onskin-trial-reminder']]);
    expect(mocks.getPermissionsAsync).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('compensates an in-flight trial schedule when its lifecycle becomes stale', async () => {
    const { scheduleTrialReminder } = await import('./deliver');
    const { assertNativeNotificationMutationAvailable } = await import('./nativeMutation');
    const controller = new AbortController();
    let current = true;
    let resolveSchedule!: (identifier: string) => void;
    mocks.scheduleNotificationAsync.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSchedule = resolve;
        }),
    );

    const scheduling = scheduleTrialReminder(
      {
        expiresAt: '2099-07-12T12:00:00.000Z',
        priceLabel: 'CA$69.99',
      },
      {
        isCurrent: () => current,
        signal: controller.signal,
      },
    );
    await vi.waitFor(() => {
      expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    });

    current = false;
    controller.abort();
    await expect(scheduling).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    resolveSchedule('onskin-trial-reminder');

    await vi.waitFor(() => {
      expect(mocks.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
      expect(mocks.dismissNotificationAsync).toHaveBeenCalledWith('onskin-trial-reminder');
    });
    await vi.waitFor(() => {
      expect(() => assertNativeNotificationMutationAvailable()).not.toThrow();
    });
    expect(mocks.cancelScheduledNotificationAsync).toHaveBeenNthCalledWith(
      1,
      'onskin-trial-reminder',
    );
    expect(mocks.cancelScheduledNotificationAsync).toHaveBeenNthCalledWith(
      2,
      'onskin-trial-reminder',
    );
    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('does not begin trial cancellation for an already-invalid conversion lifecycle', async () => {
    const { cancelTrialReminder } = await import('./deliver');
    const controller = new AbortController();
    controller.abort();

    await expect(
      cancelTrialReminder({
        isCurrent: () => false,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });

    expect(mocks.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('uses the localized RevenueCat price stored on the trial entitlement', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-05T12:00:00.000Z'));

    try {
      const { scheduleTrialReminder } = await import('./deliver');
      await scheduleTrialReminder({
        expiresAt: '2026-07-12T12:00:00.000Z',
        priceLabel: 'CA$69.99',
      });

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

  it('does not invent a hardcoded renewal price when exact store metadata is absent', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-05T12:00:00.000Z'));

    try {
      const { scheduleTrialReminder } = await import('./deliver');
      await scheduleTrialReminder({
        expiresAt: '2026-07-12T12:00:00.000Z',
        priceLabel: null,
      });

      expect(mocks.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: {
            body: 'Trial ends Jul 12; check the App Store',
            title: 'Your free trial ends in 2 days',
          },
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ['denied', false],
    ['undetermined', true],
  ] as const)(
    'cancels the old trial ID and returns false when permission is %s',
    async (status, canAskAgain) => {
      const { scheduleTrialReminder } = await import('./deliver');
      mocks.getPermissionsAsync.mockResolvedValueOnce({
        status,
        granted: false,
        canAskAgain,
        expires: 'never',
      });

      await expect(
        scheduleTrialReminder({
          expiresAt: '2099-07-12T12:00:00.000Z',
          priceLabel: 'CA$69.99',
        }),
      ).resolves.toBe(false);

      expect(mocks.cancelScheduledNotificationAsync).toHaveBeenCalledWith('onskin-trial-reminder');
      expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    },
  );

  it('cancels the old trial ID and surfaces an unavailable permission read', async () => {
    const { scheduleTrialReminder } = await import('./deliver');
    mocks.getPermissionsAsync.mockRejectedValueOnce(new Error('permission bridge provider detail'));

    await expect(
      scheduleTrialReminder({
        expiresAt: '2099-07-12T12:00:00.000Z',
        priceLabel: 'CA$69.99',
      }),
    ).rejects.toMatchObject({
      code: 'NOTIFICATION_PERMISSION_UNAVAILABLE',
      reason: 'bridge_failure',
    });

    expect(mocks.cancelScheduledNotificationAsync).toHaveBeenCalledWith('onskin-trial-reminder');
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('surfaces a native trial scheduling failure to its caller', async () => {
    const { scheduleTrialReminder } = await import('./deliver');
    const nativeError = new Error('trial schedule unavailable');
    mocks.scheduleNotificationAsync.mockRejectedValueOnce(nativeError);

    await expect(
      scheduleTrialReminder({
        expiresAt: '2099-07-12T12:00:00.000Z',
        priceLabel: 'CA$69.99',
      }),
    ).rejects.toBe(nativeError);

    expect(mocks.cancelScheduledNotificationAsync).toHaveBeenCalledWith('onskin-trial-reminder');
    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('surfaces failure to clear the prior fixed trial request before rescheduling', async () => {
    const { scheduleTrialReminder } = await import('./deliver');
    const cancelError = new Error('trial cancellation unavailable');
    mocks.cancelScheduledNotificationAsync.mockRejectedValueOnce(cancelError);

    await expect(
      scheduleTrialReminder({
        expiresAt: '2099-07-12T12:00:00.000Z',
        priceLabel: 'CA$69.99',
      }),
    ).rejects.toBe(cancelError);

    expect(mocks.loadEntitlement).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('surfaces a native trial cancellation failure to conversion callers', async () => {
    const { cancelTrialReminder } = await import('./deliver');
    const cancelError = new Error('trial cancellation unavailable');
    mocks.cancelScheduledNotificationAsync.mockRejectedValueOnce(cancelError);

    await expect(cancelTrialReminder()).rejects.toBe(cancelError);

    expect(mocks.cancelScheduledNotificationAsync).toHaveBeenCalledWith('onskin-trial-reminder');
  });
});

describe('notifyBehavioural', () => {
  beforeEach(() => {
    mocks.cancelAllScheduledNotificationsAsync.mockClear();
    mocks.cancelScheduledNotificationAsync.mockClear();
    mocks.dismissNotificationAsync.mockClear();
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
    mocks.confirmSentLocalDelivery.mockClear();
    mocks.confirmSentLocalDelivery.mockResolvedValue({ changed: true, outboxQueued: false });
    mocks.reserveSentLocal.mockClear();
    mocks.reserveSentLocal.mockResolvedValue(undefined);
    mocks.randomUUID.mockClear();
    mocks.randomUUID.mockReturnValue('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    mocks.saveNotifPrefs.mockClear();
    mocks.saveNotifPrefs.mockResolvedValue({ prefs, changed: true });
    mocks.scheduleOutboxFlush.mockClear();
    mocks.scheduleNotificationAsync.mockClear();
    mocks.sentThisWeekForTierLocal.mockClear();
    mocks.sentThisWeekForTierLocal.mockResolvedValue({ status: 'available', count: 0 });
  });

  it('sends an allowed behavioural notification and records the local cap ledger', async () => {
    const { notifyBehavioural } = await import('./deliver');

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(true);

    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'onskin-behavioural-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      content: { body: 'body:replenishment', title: 'RoutineKind' },
      trigger: null,
    });
    expect(mocks.reserveSentLocal).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'replenishment',
      expect.any(Number),
    );
    expect(mocks.reserveSentLocal.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.scheduleNotificationAsync.mock.invocationCallOrder[0]!,
    );
  });

  it.each([
    ['denied', false],
    ['undetermined', true],
  ] as const)('does not consume a cap slot when permission is %s', async (status, canAskAgain) => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.getPermissionsAsync.mockResolvedValueOnce({
      status,
      granted: false,
      canAskAgain,
      expires: 'never',
    });

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

    expect(mocks.randomUUID).not.toHaveBeenCalled();
    expect(mocks.reserveSentLocal).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.confirmSentLocalDelivery).not.toHaveBeenCalled();
    expect(mocks.scheduleOutboxFlush).not.toHaveBeenCalled();
  });

  it('fails closed before cap reservation when permission status is unavailable', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.getPermissionsAsync.mockRejectedValueOnce(new Error('permission provider raw detail'));

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

    expect(mocks.randomUUID).not.toHaveBeenCalled();
    expect(mocks.reserveSentLocal).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.confirmSentLocalDelivery).not.toHaveBeenCalled();
  });

  it('never asks the OS to present when the cap reservation cannot be persisted', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.reserveSentLocal.mockRejectedValueOnce(new Error('ledger unavailable'));

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

    expect(mocks.reserveSentLocal).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it('does not reserve a cap slot when an exact immediate identifier is unavailable', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.randomUUID.mockImplementationOnce(() => {
      throw new Error('secure random unavailable');
    });

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

    expect(mocks.reserveSentLocal).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('allocates the outbox operation identity before reserving or asking the OS', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.randomUUID
      .mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .mockImplementationOnce(() => {
        throw new Error('secure random unavailable');
      });

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

    expect(mocks.randomUUID).toHaveBeenCalledTimes(2);
    expect(mocks.reserveSentLocal).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.confirmSentLocalDelivery).not.toHaveBeenCalled();
  });

  it('conservatively retains the reserved cap slot when the native schedule request fails', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.scheduleNotificationAsync.mockRejectedValueOnce(new Error('native schedule failed'));

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

    expect(mocks.reserveSentLocal).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'replenishment',
      expect.any(Number),
    );
    expect(mocks.reserveSentLocal.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.scheduleNotificationAsync.mock.invocationCallOrder[0]!,
    );
    expect(mocks.confirmSentLocalDelivery).not.toHaveBeenCalled();
    expect(mocks.scheduleOutboxFlush).not.toHaveBeenCalled();
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
    expect(mocks.reserveSentLocal).not.toHaveBeenCalled();
  });

  it('rejects a mismatched owner generation before reading preferences or storage', async () => {
    const { notifyBehavioural } = await import('./deliver');
    const owner = {
      ownerId: 'owner-a',
      ownerGeneration: getAccountGeneration() + 1,
      assertCurrent: vi.fn(),
    };

    await expect(notifyBehavioural('replenishment', '12:00', owner)).rejects.toMatchObject({
      code: 'ACCOUNT_GENERATION_CHANGED',
    });

    expect(mocks.readNotifPrefs).not.toHaveBeenCalled();
    expect(mocks.sentThisWeekForTierLocal).not.toHaveBeenCalled();
    expect(mocks.reserveSentLocal).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('does not send inside quiet hours', async () => {
    const { notifyBehavioural } = await import('./deliver');

    await expect(notifyBehavioural('replenishment', '23:30')).resolves.toBe(false);

    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.reserveSentLocal).not.toHaveBeenCalled();
  });

  it('enforces the local behavioural weekly cap before sending', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.sentThisWeekForTierLocal.mockResolvedValueOnce({ status: 'available', count: 3 });

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocks.reserveSentLocal).not.toHaveBeenCalled();
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
    expect(mocks.reserveSentLocal).toHaveBeenCalledTimes(1);
  });

  it.each([
    { status: 'unavailable', count: null, reason: 'storage_unavailable' },
    { status: 'corrupt', count: null, reason: 'invalid_payload' },
    { status: 'unsupported_version', count: null },
  ] as const)(
    'suppresses delivery when the local cap ledger is not authoritative',
    async (state) => {
      const { notifyBehavioural } = await import('./deliver');
      mocks.sentThisWeekForTierLocal.mockResolvedValueOnce(state);

      await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

      expect(mocks.getUser).not.toHaveBeenCalled();
      expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(mocks.reserveSentLocal).not.toHaveBeenCalled();
    },
  );

  it.each([
    { status: 'unavailable', prefs: null, reason: 'storage_unavailable' },
    { status: 'corrupt', prefs: null, reason: 'invalid_payload' },
    { status: 'unsupported_version', prefs: null },
  ] as const)(
    'suppresses delivery when notification preferences are not authoritative',
    async (state) => {
      const { notifyBehavioural } = await import('./deliver');
      mocks.readNotifPrefs.mockResolvedValueOnce(state);

      await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);

      expect(mocks.sentThisWeekForTierLocal).not.toHaveBeenCalled();
      expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    },
  );

  it('serializes concurrent evaluations within the cap left after the capture reservation', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.sentThisWeekForTierLocal.mockImplementation(async () => ({
      status: 'available',
      count: mocks.reserveSentLocal.mock.calls.length,
    }));

    const results = await Promise.all(
      Array.from({ length: 20 }, () => notifyBehavioural('replenishment', '12:00')),
    );

    expect(results.filter(Boolean)).toHaveLength(2);
    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mocks.reserveSentLocal).toHaveBeenCalledTimes(2);
  });

  it('still reports sent when local confirmation fails after native acceptance', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.confirmSentLocalDelivery.mockRejectedValueOnce(new Error('private transaction failed'));

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(true);

    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mocks.reserveSentLocal).toHaveBeenCalledTimes(1);
    expect(mocks.confirmSentLocalDelivery).toHaveBeenCalledOnce();
    expect(mocks.scheduleOutboxFlush).not.toHaveBeenCalled();
  });

  it('atomically confirms an authenticated delivery and schedules its outbox flush', async () => {
    const { notifyBehavioural } = await import('./deliver');
    mocks.randomUUID
      .mockReturnValueOnce('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .mockReturnValueOnce('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    mocks.confirmSentLocalDelivery.mockResolvedValueOnce({ changed: true, outboxQueued: true });
    const owner = {
      ownerId: 'owner-a',
      ownerGeneration: getAccountGeneration(),
      assertCurrent: vi.fn(),
    };

    await expect(notifyBehavioural('replenishment', '12:00', owner)).resolves.toBe(true);

    expect(mocks.confirmSentLocalDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        kind: 'replenishment',
        owner: expect.objectContaining({
          ownerId: 'owner-a',
          ownerGeneration: owner.ownerGeneration,
        }),
      }),
    );
    expect(mocks.scheduleOutboxFlush).toHaveBeenCalledOnce();
  });

  it('fences an account boundary while confirmation is pending after OS acceptance', async () => {
    const { notifyBehavioural } = await import('./deliver');
    let releaseConfirm!: (result: { changed: boolean; outboxQueued: boolean }) => void;
    let markConfirmStarted!: () => void;
    const confirmStarted = new Promise<void>((resolve) => {
      markConfirmStarted = resolve;
    });
    mocks.confirmSentLocalDelivery.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseConfirm = resolve;
          markConfirmStarted();
        }),
    );
    const owner = {
      ownerId: 'owner-a',
      ownerGeneration: getAccountGeneration(),
      assertCurrent: vi.fn(),
    };

    const notification = notifyBehavioural('replenishment', '12:00', owner);
    await confirmStarted;
    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledOnce();
    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseConfirm({ changed: true, outboxQueued: true });

    await expect(notification).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    expect(mocks.scheduleOutboxFlush).not.toHaveBeenCalled();
  });

  it('detaches a delayed owner-A native request, fences B, and compensates its exact ID', async () => {
    const { notifyBehavioural } = await import('./deliver');
    let releaseSchedule!: (id: string) => void;
    let markStarted!: () => void;
    let ownerANotificationId = '';
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    mocks.scheduleNotificationAsync.mockImplementationOnce((request) => {
      ownerANotificationId = request.identifier ?? '';
      markStarted();
      return new Promise<string>((resolve) => {
        releaseSchedule = resolve;
      });
    });

    const notification = notifyBehavioural('replenishment', '12:00');
    await started;
    beginAccountGenerationBoundary();
    boundaryActive = true;
    await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();

    await expect(notification).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    endAccountGenerationBoundary();
    boundaryActive = false;

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(false);
    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mocks.reserveSentLocal).toHaveBeenCalledTimes(1);

    releaseSchedule(ownerANotificationId);
    await vi.waitFor(() => {
      expect(mocks.cancelScheduledNotificationAsync).toHaveBeenCalledWith(ownerANotificationId);
      expect(mocks.dismissNotificationAsync).toHaveBeenCalledWith(ownerANotificationId);
    });
    await Promise.resolve();
    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(true);
    expect(mocks.reserveSentLocal).toHaveBeenCalledTimes(2);
    expect(mocks.reserveSentLocal.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.scheduleNotificationAsync.mock.invocationCallOrder[0]!,
    );
  });

  it('keeps signed-out delivery local-only', async () => {
    const { notifyBehavioural } = await import('./deliver');

    await expect(notifyBehavioural('replenishment', '12:00')).resolves.toBe(true);

    expect(mocks.confirmSentLocalDelivery).toHaveBeenCalledWith(
      expect.not.objectContaining({ owner: expect.anything() }),
    );
    expect(mocks.scheduleOutboxFlush).not.toHaveBeenCalled();
  });
});
