import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import NotificationPreferenceScheduleReconciler from './NotificationPreferenceScheduleReconciler';
import type { NotifPrefs } from './store';

const mocks = vi.hoisted(() => ({
  rescheduleReminders: vi.fn(async () => undefined),
  suspendPreferenceOwnedReminders: vi.fn(async () => undefined),
  useEffect: vi.fn((effect: () => void) => effect()),
  useNotifPrefs: vi.fn(),
}));

vi.mock('react', () => ({ useEffect: mocks.useEffect }));
vi.mock('./deliver', () => ({
  rescheduleReminders: mocks.rescheduleReminders,
  suspendPreferenceOwnedReminders: mocks.suspendPreferenceOwnedReminders,
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

describe('root notification preference schedule reconciliation', () => {
  beforeEach(() => {
    mocks.rescheduleReminders.mockReset();
    mocks.rescheduleReminders.mockResolvedValue(undefined);
    mocks.suspendPreferenceOwnedReminders.mockReset();
    mocks.suspendPreferenceOwnedReminders.mockResolvedValue(undefined);
    mocks.useNotifPrefs.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reconciles only an authoritative available snapshot', () => {
    mocks.useNotifPrefs.mockReturnValue({
      data: { status: 'available', prefs, format: 'current' },
      dataUpdatedAt: 1,
      isError: false,
      isFetched: true,
    });

    expect(NotificationPreferenceScheduleReconciler()).toBeNull();

    expect(mocks.rescheduleReminders).toHaveBeenCalledWith(prefs);
    expect(mocks.suspendPreferenceOwnedReminders).not.toHaveBeenCalled();
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
  ])('suspends fixed schedules for every non-authoritative settled state', (state) => {
    mocks.useNotifPrefs.mockReturnValue({ ...state, dataUpdatedAt: 2, isFetched: true });

    expect(NotificationPreferenceScheduleReconciler()).toBeNull();

    expect(mocks.suspendPreferenceOwnedReminders).toHaveBeenCalledTimes(1);
    expect(mocks.rescheduleReminders).not.toHaveBeenCalled();
  });

  it('waits for the first read and keys retries to every completed refetch', () => {
    mocks.useNotifPrefs.mockReturnValue({
      data: undefined,
      dataUpdatedAt: 0,
      isError: false,
      isFetched: false,
    });

    expect(NotificationPreferenceScheduleReconciler()).toBeNull();
    expect(mocks.suspendPreferenceOwnedReminders).not.toHaveBeenCalled();

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
    mocks.rescheduleReminders
      .mockRejectedValueOnce(new Error('NATIVE_RECONCILIATION_FAILED'))
      .mockResolvedValueOnce(undefined);
    mocks.useNotifPrefs.mockReturnValue({
      data: { status: 'available', prefs, format: 'current' },
      dataUpdatedAt: 3,
      isError: false,
      isFetched: true,
    });

    expect(NotificationPreferenceScheduleReconciler()).toBeNull();
    expect(mocks.rescheduleReminders).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(mocks.rescheduleReminders).toHaveBeenCalledTimes(2);
  });
});
