import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import NotificationPreferenceScheduleReconciler from './NotificationPreferenceScheduleReconciler';
import type { NotifPrefs } from './store';

const mocks = vi.hoisted(() => ({
  NotificationPermissionUnavailableError: class NotificationPermissionUnavailableError extends Error {
    readonly code = 'NOTIFICATION_PERMISSION_UNAVAILABLE';

    constructor(readonly reason: 'bridge_failure' | 'invalid_response') {
      super(`Notification permission is unavailable: ${reason}`);
      this.name = 'NotificationPermissionUnavailableError';
    }
  },
  devWarn: vi.fn(),
  reconcileLocalEntitlementTrialReminder: vi.fn<
    (
      _scope: unknown,
      _options?: {
        loadDelivery?: () => Promise<{
          cancelTrialReminder: () => Promise<void>;
          scheduleTrialReminder: (input: {
            expiresAt: string;
            priceLabel: string | null;
          }) => Promise<boolean>;
        }>;
      },
    ) => Promise<'cancelled' | 'failed' | 'scheduled'>
  >(async () => 'scheduled'),
  reconcileRootNotificationSchedules: vi.fn<
    (
      _prefs: unknown,
      _generation: number,
      _lifecycle: Readonly<{ isCurrent: () => boolean; signal: AbortSignal }>,
    ) => Promise<'not_applicable' | 'scheduled' | 'suspended_denied' | 'suspended_undetermined'>
  >(async () => 'scheduled'),
  appState: 'active',
  appStateReadCount: 0,
  appStateReadSequence: [] as string[],
  appStateListeners: new Set<(state: string) => void>(),
  cancelTrialReminder: vi.fn<(_lifecycle?: unknown) => Promise<void>>(async () => undefined),
  effectCleanups: [] as (() => void)[],
  scheduleTrialReminder: vi.fn<
    (
      _input: { expiresAt: string; priceLabel: string | null },
      _lifecycle?: unknown,
    ) => Promise<boolean>
  >(async () => true),
  useEffect: vi.fn(),
  useNotifPrefs: vi.fn(),
  useOwnerQueryScope: vi.fn(),
}));

vi.mock('react', () => ({ useEffect: mocks.useEffect }));
vi.mock('react-native', () => ({
  AppState: {
    get currentState() {
      mocks.appStateReadCount += 1;
      const next = mocks.appStateReadSequence.shift();
      if (next !== undefined) mocks.appState = next;
      return mocks.appState;
    },
    addEventListener: vi.fn((_event: 'change', listener: (state: string) => void) => {
      mocks.appStateListeners.add(listener);
      return {
        remove: vi.fn(() => mocks.appStateListeners.delete(listener)),
      };
    }),
  },
}));
vi.mock('@/features/subscription/entitlementReminder', () => ({
  reconcileLocalEntitlementTrialReminder: mocks.reconcileLocalEntitlementTrialReminder,
}));
vi.mock('@/lib/observability/safeLog', () => ({ devWarn: mocks.devWarn }));
vi.mock('@/lib/query/useOwnerQueryScope', () => ({
  useOwnerQueryScope: mocks.useOwnerQueryScope,
}));
vi.mock('./deliver', () => ({
  cancelTrialReminder: mocks.cancelTrialReminder,
  reconcileRootNotificationSchedules: mocks.reconcileRootNotificationSchedules,
  scheduleTrialReminder: mocks.scheduleTrialReminder,
}));
vi.mock('./permission', () => ({
  NotificationPermissionUnavailableError: mocks.NotificationPermissionUnavailableError,
}));
vi.mock('./useNotifications', () => ({ useNotifPrefs: mocks.useNotifPrefs }));

const prefs: NotifPrefs = {
  amEnabled: true,
  pmEnabled: false,
  amTime: '07:30',
  pmTime: '21:30',
  streakNudges: false,
  replenishmentAlerts: false,
  captureReminders: false,
  quietStart: '22:00',
  quietEnd: '07:00',
  timezone: 'UTC',
  liveActivityEnabled: false,
  promotionalOptIn: false,
  lockscreenDiscreet: true,
};

let nextGeneration = 100;

function emitAppState(state: string): void {
  mocks.appState = state;
  for (const listener of [...mocks.appStateListeners]) listener(state);
}

function deferred<T>(): Readonly<{
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
}> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe('root notification preference schedule reconciliation', () => {
  beforeEach(() => {
    nextGeneration += 1;
    mocks.appState = 'active';
    mocks.appStateReadCount = 0;
    mocks.appStateReadSequence = [];
    mocks.appStateListeners.clear();
    mocks.effectCleanups.length = 0;
    mocks.useEffect.mockReset();
    mocks.useEffect.mockImplementation((effect: () => void | (() => void)) => {
      const cleanup = effect();
      if (cleanup) mocks.effectCleanups.push(cleanup);
    });
    mocks.devWarn.mockReset();
    mocks.reconcileLocalEntitlementTrialReminder.mockReset();
    mocks.reconcileLocalEntitlementTrialReminder.mockResolvedValue('scheduled');
    mocks.reconcileRootNotificationSchedules.mockReset();
    mocks.reconcileRootNotificationSchedules.mockResolvedValue('scheduled');
    mocks.cancelTrialReminder.mockReset();
    mocks.cancelTrialReminder.mockResolvedValue(undefined);
    mocks.scheduleTrialReminder.mockReset();
    mocks.scheduleTrialReminder.mockResolvedValue(true);
    mocks.useNotifPrefs.mockReset();
    mocks.useOwnerQueryScope.mockReset();
    mocks.useOwnerQueryScope.mockReturnValue({ generation: nextGeneration });
  });

  afterEach(() => {
    for (const cleanup of mocks.effectCleanups.reverse()) cleanup();
    mocks.effectCleanups.length = 0;
    mocks.appStateListeners.clear();
    vi.useRealTimers();
  });

  it('reconciles an authoritative snapshot and audits the trial once per generation', async () => {
    mocks.useNotifPrefs.mockReturnValue({
      data: { status: 'available', prefs, format: 'current' },
      dataUpdatedAt: 1,
      isError: false,
      isFetched: true,
    });

    expect(NotificationPreferenceScheduleReconciler()).toBeNull();
    await vi.waitFor(() => {
      expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledWith(
        prefs,
        nextGeneration,
        expect.objectContaining({
          isCurrent: expect.any(Function),
          signal: expect.any(AbortSignal),
        }),
      );
      expect(mocks.reconcileLocalEntitlementTrialReminder).toHaveBeenCalledWith(
        { generation: nextGeneration },
        expect.objectContaining({ loadDelivery: expect.any(Function) }),
      );
    });

    expect(NotificationPreferenceScheduleReconciler()).toBeNull();
    await Promise.resolve();
    expect(mocks.reconcileLocalEntitlementTrialReminder).toHaveBeenCalledTimes(1);
  });

  it.each([
    { data: { status: 'absent', prefs }, isError: false },
    { data: { status: 'corrupt', prefs: null, reason: 'invalid_payload' }, isError: false },
    { data: { status: 'unsupported_version', prefs: null }, isError: false },
    {
      data: { status: 'unavailable', prefs: null, reason: 'storage_unavailable' },
      isError: false,
    },
    { data: undefined, isError: true },
  ])('passes no invented preferences for every non-authoritative settled state', async (state) => {
    mocks.useNotifPrefs.mockReturnValue({ ...state, dataUpdatedAt: 2, isFetched: true });

    expect(NotificationPreferenceScheduleReconciler()).toBeNull();
    await vi.waitFor(() => {
      expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledWith(
        null,
        nextGeneration,
        expect.objectContaining({
          isCurrent: expect.any(Function),
          signal: expect.any(AbortSignal),
        }),
      );
      expect(mocks.reconcileLocalEntitlementTrialReminder).toHaveBeenCalledWith(
        { generation: nextGeneration },
        expect.objectContaining({ loadDelivery: expect.any(Function) }),
      );
    });
  });

  it('waits for the first read and keys retries to every completed refetch', () => {
    mocks.useNotifPrefs.mockReturnValue({
      data: undefined,
      dataUpdatedAt: 0,
      isError: false,
      isFetched: false,
    });

    expect(NotificationPreferenceScheduleReconciler()).toBeNull();
    expect(mocks.reconcileRootNotificationSchedules).not.toHaveBeenCalled();

    const source = readFileSync(
      fileURLToPath(new URL('./NotificationPreferenceScheduleReconciler.tsx', import.meta.url)),
      'utf8',
    );
    const root = readFileSync(
      fileURLToPath(new URL('../../app/_layout.tsx', import.meta.url)),
      'utf8',
    );
    expect(source).toContain('query.dataUpdatedAt');
    expect(root).toContain(
      "lazy(\n  () => import('@/features/notifications/NotificationPreferenceScheduleReconciler')",
    );
    expect(root).toContain('<NotificationPreferenceScheduleReconciler />');
  });

  it('reads startup state once and does not reconcile when that snapshot is backgrounded', async () => {
    mocks.appStateReadSequence = ['background', 'active'];
    mocks.useNotifPrefs.mockReturnValue({
      data: { status: 'available', prefs, format: 'current' },
      dataUpdatedAt: 10,
      isError: false,
      isFetched: true,
    });

    expect(NotificationPreferenceScheduleReconciler()).toBeNull();
    await Promise.resolve();

    expect(mocks.appStateReadCount).toBe(1);
    expect(mocks.reconcileRootNotificationSchedules).not.toHaveBeenCalled();
    expect(mocks.reconcileLocalEntitlementTrialReminder).not.toHaveBeenCalled();

    emitAppState('active');
    await vi.waitFor(() => {
      expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledTimes(1);
    });
  });

  it('clears a pending retry in background and starts one fresh pass on foreground', async () => {
    vi.useFakeTimers();
    mocks.reconcileRootNotificationSchedules
      .mockRejectedValueOnce(new Error('NATIVE_RECONCILIATION_FAILED'))
      .mockResolvedValueOnce('scheduled');
    mocks.useNotifPrefs.mockReturnValue({
      data: { status: 'available', prefs, format: 'current' },
      dataUpdatedAt: 11,
      isError: false,
      isFetched: true,
    });

    expect(NotificationPreferenceScheduleReconciler()).toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledTimes(1);

    emitAppState('background');
    await vi.advanceTimersByTimeAsync(5_000);
    expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledTimes(1);

    emitAppState('active');
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => {
      expect(mocks.reconcileLocalEntitlementTrialReminder).toHaveBeenCalledTimes(1);
    });
  });

  it('invalidates a deferred background-crossing result and coalesces one foreground pass', async () => {
    const stale = deferred<'scheduled'>();
    const foreground = deferred<'scheduled'>();
    mocks.reconcileRootNotificationSchedules
      .mockImplementationOnce(() => stale.promise)
      .mockImplementationOnce(() => foreground.promise);
    mocks.useNotifPrefs.mockReturnValue({
      data: { status: 'available', prefs, format: 'current' },
      dataUpdatedAt: 12,
      isError: false,
      isFetched: true,
    });

    expect(NotificationPreferenceScheduleReconciler()).toBeNull();
    expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledTimes(1);

    emitAppState('background');
    emitAppState('active');
    emitAppState('active');
    expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledTimes(1);

    stale.resolve('scheduled');
    await vi.waitFor(() => {
      expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledTimes(2);
    });
    expect(mocks.reconcileLocalEntitlementTrialReminder).not.toHaveBeenCalled();

    foreground.resolve('scheduled');
    await vi.waitFor(() => {
      expect(mocks.reconcileLocalEntitlementTrialReminder).toHaveBeenCalledTimes(1);
    });
    expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledTimes(2);
  });

  it('routes one lifecycle through the full root and trial pass after backgrounding', async () => {
    const staleTrialSchedule = deferred<boolean>();
    mocks.scheduleTrialReminder
      .mockImplementationOnce(() => staleTrialSchedule.promise)
      .mockResolvedValueOnce(true);
    mocks.reconcileLocalEntitlementTrialReminder.mockImplementation(async (_scope, options) => {
      const delivery = await options!.loadDelivery!();
      const scheduled = await delivery.scheduleTrialReminder({
        expiresAt: '2099-07-12T12:00:00.000Z',
        priceLabel: null,
      });
      return scheduled ? 'scheduled' : 'failed';
    });
    mocks.useNotifPrefs.mockReturnValue({
      data: { status: 'available', prefs, format: 'current' },
      dataUpdatedAt: 121,
      isError: false,
      isFetched: true,
    });

    expect(NotificationPreferenceScheduleReconciler()).toBeNull();
    await vi.waitFor(() => {
      expect(mocks.scheduleTrialReminder).toHaveBeenCalledTimes(1);
    });

    const rootLifecycle = mocks.reconcileRootNotificationSchedules.mock.calls[0]![2];
    expect(mocks.scheduleTrialReminder.mock.calls[0]![1]).toBe(rootLifecycle);

    emitAppState('background');
    expect(rootLifecycle.signal.aborted).toBe(true);
    emitAppState('active');
    emitAppState('active');
    expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledTimes(1);

    staleTrialSchedule.resolve(true);
    await vi.waitFor(() => {
      expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledTimes(2);
      expect(mocks.reconcileLocalEntitlementTrialReminder).toHaveBeenCalledTimes(2);
      expect(mocks.scheduleTrialReminder).toHaveBeenCalledTimes(2);
    });

    const foregroundLifecycle = mocks.reconcileRootNotificationSchedules.mock.calls[1]![2];
    expect(foregroundLifecycle).not.toBe(rootLifecycle);
    expect(foregroundLifecycle.signal.aborted).toBe(false);
    expect(mocks.scheduleTrialReminder.mock.calls[1]![1]).toBe(foregroundLifecycle);
  });

  it('blocks deferred continuation and removes the lifecycle listener on unmount', async () => {
    const rootResult = deferred<'scheduled'>();
    mocks.reconcileRootNotificationSchedules.mockImplementationOnce(() => rootResult.promise);
    mocks.useNotifPrefs.mockReturnValue({
      data: { status: 'available', prefs, format: 'current' },
      dataUpdatedAt: 13,
      isError: false,
      isFetched: true,
    });

    expect(NotificationPreferenceScheduleReconciler()).toBeNull();
    expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledTimes(1);
    expect(mocks.appStateListeners.size).toBe(1);

    mocks.effectCleanups.at(-1)!();
    expect(mocks.appStateListeners.size).toBe(0);
    rootResult.resolve('scheduled');
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.reconcileLocalEntitlementTrialReminder).not.toHaveBeenCalled();
    emitAppState('active');
    expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledTimes(1);

    expect(NotificationPreferenceScheduleReconciler()).toBeNull();
    await vi.waitFor(() => {
      expect(mocks.reconcileLocalEntitlementTrialReminder).toHaveBeenCalledTimes(1);
    });
    expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledTimes(2);
  });

  it('retries a transient native convergence failure without waiting for another query fetch', async () => {
    vi.useFakeTimers();
    mocks.reconcileRootNotificationSchedules
      .mockRejectedValueOnce(new Error('NATIVE_RECONCILIATION_FAILED'))
      .mockResolvedValueOnce('scheduled');
    mocks.useNotifPrefs.mockReturnValue({
      data: { status: 'available', prefs, format: 'current' },
      dataUpdatedAt: 3,
      isError: false,
      isFetched: true,
    });

    expect(NotificationPreferenceScheduleReconciler()).toBeNull();
    expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledTimes(2);
    expect(mocks.reconcileLocalEntitlementTrialReminder).toHaveBeenCalledTimes(1);
  });

  it.each(['suspended_denied', 'suspended_undetermined'] as const)(
    'remembers terminal permission outcome %s without retrying',
    async (outcome) => {
      mocks.reconcileRootNotificationSchedules.mockResolvedValue(outcome);
      mocks.useNotifPrefs.mockReturnValue({
        data: { status: 'available', prefs, format: 'current' },
        dataUpdatedAt: 4,
        isError: false,
        isFetched: true,
      });

      expect(NotificationPreferenceScheduleReconciler()).toBeNull();

      await vi.waitFor(() => {
        expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledTimes(1);
      });
      expect(mocks.reconcileLocalEntitlementTrialReminder).not.toHaveBeenCalled();
      expect(mocks.devWarn).not.toHaveBeenCalled();
    },
  );

  it('keeps the bounded retry sequence for unavailable permission', async () => {
    vi.useFakeTimers();
    mocks.reconcileRootNotificationSchedules.mockRejectedValue(
      new mocks.NotificationPermissionUnavailableError('bridge_failure'),
    );
    mocks.useNotifPrefs.mockReturnValue({
      data: { status: 'available', prefs, format: 'current' },
      dataUpdatedAt: 5,
      isError: false,
      isFetched: true,
    });

    expect(NotificationPreferenceScheduleReconciler()).toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(4_000);
    expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledTimes(3);
    expect(mocks.devWarn).toHaveBeenCalledTimes(1);
    expect(mocks.reconcileLocalEntitlementTrialReminder).not.toHaveBeenCalled();
  });

  it('restores the local trial only after the same blocked generation becomes scheduled', async () => {
    mocks.reconcileRootNotificationSchedules.mockResolvedValueOnce('suspended_denied');
    mocks.useNotifPrefs.mockReturnValue({
      data: { status: 'available', prefs, format: 'current' },
      dataUpdatedAt: 6,
      isError: false,
      isFetched: true,
    });

    expect(NotificationPreferenceScheduleReconciler()).toBeNull();
    await vi.waitFor(() => {
      expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledTimes(1);
    });

    mocks.reconcileRootNotificationSchedules.mockResolvedValue('scheduled');
    expect(NotificationPreferenceScheduleReconciler()).toBeNull();

    await vi.waitFor(() => {
      expect(mocks.reconcileLocalEntitlementTrialReminder).toHaveBeenCalledWith(
        { generation: nextGeneration },
        expect.objectContaining({ loadDelivery: expect.any(Function) }),
      );
    });
    expect(mocks.reconcileLocalEntitlementTrialReminder).toHaveBeenCalledTimes(1);

    expect(NotificationPreferenceScheduleReconciler()).toBeNull();
    await Promise.resolve();
    expect(mocks.reconcileLocalEntitlementTrialReminder).toHaveBeenCalledTimes(1);
  });

  it('retries a failed blocked-to-granted trial restoration before marking recovery', async () => {
    mocks.reconcileRootNotificationSchedules.mockResolvedValueOnce('suspended_undetermined');
    mocks.useNotifPrefs.mockReturnValue({
      data: { status: 'available', prefs, format: 'current' },
      dataUpdatedAt: 7,
      isError: false,
      isFetched: true,
    });

    expect(NotificationPreferenceScheduleReconciler()).toBeNull();
    await vi.waitFor(() => {
      expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledTimes(1);
    });

    vi.useFakeTimers();
    mocks.reconcileRootNotificationSchedules.mockResolvedValue('scheduled');
    mocks.reconcileLocalEntitlementTrialReminder
      .mockResolvedValueOnce('failed')
      .mockResolvedValueOnce('cancelled');

    expect(NotificationPreferenceScheduleReconciler()).toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.reconcileLocalEntitlementTrialReminder).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(mocks.reconcileLocalEntitlementTrialReminder).toHaveBeenCalledTimes(2);

    expect(NotificationPreferenceScheduleReconciler()).toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.reconcileLocalEntitlementTrialReminder).toHaveBeenCalledTimes(2);
  });

  it('audits the new account without replaying the prior generation scope', async () => {
    mocks.reconcileRootNotificationSchedules.mockResolvedValueOnce('suspended_denied');
    mocks.useNotifPrefs.mockReturnValue({
      data: { status: 'available', prefs, format: 'current' },
      dataUpdatedAt: 8,
      isError: false,
      isFetched: true,
    });

    expect(NotificationPreferenceScheduleReconciler()).toBeNull();
    await vi.waitFor(() => {
      expect(mocks.reconcileRootNotificationSchedules).toHaveBeenCalledTimes(1);
    });

    mocks.reconcileRootNotificationSchedules.mockResolvedValue('scheduled');
    mocks.useOwnerQueryScope.mockReturnValue({ generation: nextGeneration + 1 });
    expect(NotificationPreferenceScheduleReconciler()).toBeNull();
    await vi.waitFor(() => {
      expect(mocks.reconcileLocalEntitlementTrialReminder).toHaveBeenCalledWith(
        { generation: nextGeneration + 1 },
        expect.objectContaining({ loadDelivery: expect.any(Function) }),
      );
    });
    expect(
      mocks.reconcileLocalEntitlementTrialReminder.mock.calls.map(([scope]) => scope),
    ).not.toContainEqual({ generation: nextGeneration });
  });
});
