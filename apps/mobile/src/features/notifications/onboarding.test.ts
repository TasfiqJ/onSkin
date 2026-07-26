import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PREFS, type NotifPrefs } from './store';
import {
  acceptRoutineReminderSoftAsk,
  declineRoutineReminderSoftAsk,
  PROPOSED_ROUTINE_REMINDER_TIMES,
} from './onboarding';
import { SOFT_ASK } from './copy';
import type { NotificationPermissionOutcome } from './deliver';

const leaseState = vi.hoisted(() => ({ current: true }));

vi.mock('@/lib/consent/healthProcessingEpoch', () => ({
  activeHealthProcessingOwnerUserId: () => 'user-1',
}));

vi.mock('@/lib/consent/healthDataWriteAdmission', () => ({
  HEALTH_DATA_WRITE_ADMISSION_CLOSED: 'HEALTH_DATA_WRITE_ADMISSION_CLOSED',
  runHealthDataWriteOperation: async (
    expectedOwnerUserId: string,
    operation: (lease: { ownerUserId: string; assertCurrent: () => void }) => Promise<unknown>,
  ) =>
    operation({
      ownerUserId: expectedOwnerUserId,
      assertCurrent: () => {
        if (!leaseState.current) throw new Error('HEALTH_DATA_WRITE_ADMISSION_CHANGED');
      },
    }),
}));

const mocks = vi.hoisted(() => ({
  defaultPrefs: {
    amEnabled: false,
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
  },
  saveNotifPrefs: vi.fn(async (patch: Partial<NotifPrefs>) => ({
    ...mocks.defaultPrefs,
    ...patch,
  })),
}));

vi.mock('./deliver', () => ({
  isDeliverableAuthorizationState: (state: string) =>
    state === 'authorized' || state === 'provisional' || state === 'ephemeral',
  requestPermission: vi.fn(async () => ({
    kind: 'denied',
    state: 'denied',
    requestAttempted: true,
  })),
  rescheduleReminders: vi.fn(async () => {}),
}));

vi.mock('./store', () => ({
  DEFAULT_PREFS: mocks.defaultPrefs,
  saveNotifPrefs: mocks.saveNotifPrefs,
}));

function deps(outcome: NotificationPermissionOutcome) {
  const saveNotifPrefs = vi.fn(async (patch: Partial<NotifPrefs>) => ({
    ...DEFAULT_PREFS,
    ...patch,
  }));
  return {
    requestPermission: vi.fn(async () => outcome),
    saveNotifPrefs,
    rescheduleReminders: vi.fn(async () => {}),
  };
}

describe('notification onboarding choice', () => {
  beforeEach(() => {
    leaseState.current = true;
  });

  it('derives the visible proposal from the same defaults passed to persistence', () => {
    expect(PROPOSED_ROUTINE_REMINDER_TIMES).toEqual({
      amTime: DEFAULT_PREFS.amTime,
      pmTime: DEFAULT_PREFS.pmTime,
    });
    expect(SOFT_ASK.bullets).toEqual([
      'Morning at 7:30 AM',
      'Evening at 9:30 PM',
      'Discreet on your lock screen',
    ]);
  });

  it('enables and schedules routine reminders only when permission is granted', async () => {
    const d = deps({ kind: 'authorized', state: 'authorized', requestAttempted: true });

    await expect(acceptRoutineReminderSoftAsk(PROPOSED_ROUTINE_REMINDER_TIMES, d)).resolves.toEqual(
      {
        kind: 'authorized',
        state: 'authorized',
        requestAttempted: true,
      },
    );

    expect(d.requestPermission).toHaveBeenCalledTimes(1);
    expect(d.saveNotifPrefs).toHaveBeenCalledWith({
      amEnabled: true,
      pmEnabled: true,
      amTime: '07:30',
      pmTime: '21:30',
      streakNudges: false,
      replenishmentAlerts: false,
      captureReminders: false,
      liveActivityEnabled: false,
      promotionalOptIn: false,
    });
    expect(d.rescheduleReminders).toHaveBeenCalledWith(
      expect.objectContaining({ amEnabled: true, pmEnabled: true }),
    );
  });

  it('persists routine reminders off when the OS prompt is denied', async () => {
    const d = deps({ kind: 'denied', state: 'denied', requestAttempted: true });

    await expect(acceptRoutineReminderSoftAsk(PROPOSED_ROUTINE_REMINDER_TIMES, d)).resolves.toEqual(
      {
        kind: 'denied',
        state: 'denied',
        requestAttempted: true,
      },
    );

    expect(d.saveNotifPrefs).toHaveBeenCalledWith(
      expect.objectContaining({
        amEnabled: false,
        pmEnabled: false,
        amTime: '07:30',
        pmTime: '21:30',
        streakNudges: false,
      }),
    );
    expect(d.rescheduleReminders).toHaveBeenCalledWith(
      expect.objectContaining({ amEnabled: false, pmEnabled: false }),
    );
  });

  it.each([
    {
      kind: 'already_authorized',
      state: 'provisional',
      requestAttempted: false,
      enabled: true,
    },
    { kind: 'blocked', state: 'denied', requestAttempted: false, enabled: false },
    { kind: 'unchanged', state: 'not_determined', requestAttempted: true, enabled: false },
    { kind: 'error', state: 'unavailable', requestAttempted: true, enabled: false },
  ] as const)(
    'maps $kind to an exact effective reminder state',
    async ({ enabled, ...outcome }) => {
      const d = deps(outcome);

      await expect(
        acceptRoutineReminderSoftAsk(PROPOSED_ROUTINE_REMINDER_TIMES, d),
      ).resolves.toEqual(outcome);

      expect(d.saveNotifPrefs).toHaveBeenCalledWith(
        expect.objectContaining({
          amEnabled: enabled,
          pmEnabled: enabled,
          amTime: '07:30',
          pmTime: '21:30',
        }),
      );
    },
  );

  it('persists routine reminders off when the soft ask is skipped', async () => {
    const d = deps({ kind: 'authorized', state: 'authorized', requestAttempted: true });

    await expect(declineRoutineReminderSoftAsk(d)).resolves.toBeUndefined();

    expect(d.requestPermission).not.toHaveBeenCalled();
    expect(d.saveNotifPrefs).toHaveBeenCalledWith(
      expect.objectContaining({
        amEnabled: false,
        pmEnabled: false,
        streakNudges: false,
        replenishmentAlerts: false,
        captureReminders: false,
        promotionalOptIn: false,
      }),
    );
    expect(d.rescheduleReminders).toHaveBeenCalledWith(
      expect.objectContaining({ amEnabled: false, pmEnabled: false }),
    );
  });

  it('does not persist a permission result after its health-data lease becomes stale', async () => {
    const d = deps({ kind: 'authorized', state: 'authorized', requestAttempted: true });
    d.requestPermission.mockImplementationOnce(async () => {
      leaseState.current = false;
      return { kind: 'authorized', state: 'authorized', requestAttempted: true };
    });

    await expect(acceptRoutineReminderSoftAsk(PROPOSED_ROUTINE_REMINDER_TIMES, d)).rejects.toThrow(
      'HEALTH_DATA_WRITE_ADMISSION_CHANGED',
    );

    expect(d.saveNotifPrefs).not.toHaveBeenCalled();
    expect(d.rescheduleReminders).not.toHaveBeenCalled();
  });
});
