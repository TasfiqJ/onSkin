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
    () => Promise<'cancelled' | 'failed' | 'scheduled'>
  >(async () => 'scheduled'),
  reconcileRootNotificationSchedules: vi.fn<
    (_prefs: unknown, _generation: number) => Promise<
      'not_applicable' | 'scheduled' | 'suspended_denied' | 'suspended_undetermined'
    >
  >(async () => 'scheduled'),
  useEffect: vi.fn((effect: () => void) => effect()),
  useNotifPrefs: vi.fn(),
  useOwnerQueryScope: vi.fn(),
}));

vi.mock('react', () => ({ useEffect: mocks.useEffect }));
vi.mock('@/features/subscription/entitlementReminder', () => ({
  reconcileLocalEntitlementTrialReminder: mocks.reconcileLocalEntitlementTrialReminder,
}));
vi.mock('@/lib/observability/safeLog', () => ({ devWarn: mocks.devWarn }));
vi.mock('@/lib/query/useOwnerQueryScope', () => ({
  useOwnerQueryScope: mocks.useOwnerQueryScope,
}));
vi.mock('./deliver', () => ({
  reconcileRootNotificationSchedules: mocks.reconcileRootNotificationSchedules,
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

describe('root notification preference schedule reconciliation', () => {
  beforeEach(() => {
    nextGeneration += 1;
    mocks.devWarn.mockReset();
    mocks.reconcileLocalEntitlementTrialReminder.mockReset();
    mocks.reconcileLocalEntitlementTrialReminder.mockResolvedValue('scheduled');
    mocks.reconcileRootNotificationSchedules.mockReset();
    mocks.reconcileRootNotificationSchedules.mockResolvedValue('scheduled');
    mocks.useNotifPrefs.mockReset();
    mocks.useOwnerQueryScope.mockReset();
    mocks.useOwnerQueryScope.mockReturnValue({ generation: nextGeneration });
  });

  afterEach(() => {
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
      );
      expect(mocks.reconcileLocalEntitlementTrialReminder).toHaveBeenCalledWith({
        generation: nextGeneration,
      });
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
      );
      expect(mocks.reconcileLocalEntitlementTrialReminder).toHaveBeenCalledWith({
        generation: nextGeneration,
      });
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
    const root = readFileSync(fileURLToPath(new URL('../../app/_layout.tsx', import.meta.url)), 'utf8');
    expect(source).toContain('query.dataUpdatedAt');
    expect(root).toContain("lazy(\n  () => import('@/features/notifications/NotificationPreferenceScheduleReconciler')");
    expect(root).toContain('<NotificationPreferenceScheduleReconciler />');
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
      expect(mocks.reconcileLocalEntitlementTrialReminder).toHaveBeenCalledWith({
        generation: nextGeneration,
      });
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
      expect(mocks.reconcileLocalEntitlementTrialReminder).toHaveBeenCalledWith({
        generation: nextGeneration + 1,
      });
    });
    expect(mocks.reconcileLocalEntitlementTrialReminder).not.toHaveBeenCalledWith({
      generation: nextGeneration,
    });
  });
});
