import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';

import { DEFAULT_PREFS, type NotifPrefs } from './store';
import { acceptRoutineReminderSoftAsk, declineRoutineReminderSoftAsk } from './onboarding';

const mocks = vi.hoisted(() => ({
  defaultPrefs: {
    amEnabled: true,
    pmEnabled: true,
    amTime: '07:30',
    pmTime: '21:30',
    streakNudges: true,
    replenishmentAlerts: true,
    captureReminders: false,
    quietStart: '22:00',
    quietEnd: '07:00',
    timezone: 'UTC',
    liveActivityEnabled: false,
    promotionalOptIn: false,
    lockscreenDiscreet: true,
  },
  saveAndReschedule: vi.fn(async (patch: Partial<NotifPrefs>) => ({
    prefs: { ...mocks.defaultPrefs, ...patch },
    changed: true,
  })),
}));

vi.mock('./deliver', () => ({
  requestPermission: vi.fn(async () => false),
  saveAndRescheduleNotifPrefs: mocks.saveAndReschedule,
}));

vi.mock('./store', () => ({
  DEFAULT_PREFS: mocks.defaultPrefs,
}));

function deps(requestGranted: boolean) {
  const saveAndReschedule = vi.fn(async (patch: Partial<NotifPrefs>) => ({
    prefs: { ...DEFAULT_PREFS, ...patch },
    changed: true,
  }));
  return {
    requestPermission: vi.fn(async () => requestGranted),
    saveAndReschedule,
  };
}

let boundaryActive = false;

afterEach(() => {
  if (boundaryActive) {
    endAccountGenerationBoundary();
    boundaryActive = false;
  }
});

describe('notification onboarding choice', () => {
  it('enables and schedules routine reminders only when permission is granted', async () => {
    const d = deps(true);

    await expect(acceptRoutineReminderSoftAsk(d)).resolves.toBe(true);

    expect(d.requestPermission).toHaveBeenCalledTimes(1);
    expect(d.saveAndReschedule).toHaveBeenCalledWith({ amEnabled: true, pmEnabled: true });
  });

  it('persists routine reminders off when the OS prompt is denied', async () => {
    const d = deps(false);

    await expect(acceptRoutineReminderSoftAsk(d)).resolves.toBe(false);

    expect(d.saveAndReschedule).toHaveBeenCalledWith({ amEnabled: false, pmEnabled: false });
  });

  it('persists routine reminders off when the soft ask is skipped', async () => {
    const d = deps(true);

    await expect(declineRoutineReminderSoftAsk(d)).resolves.toBeUndefined();

    expect(d.requestPermission).not.toHaveBeenCalled();
    expect(d.saveAndReschedule).toHaveBeenCalledWith({ amEnabled: false, pmEnabled: false });
  });

  it.each(['resolve', 'reject'] as const)(
    'detaches a pending owner-A permission prompt and contains its late %s',
    async (lateOutcome) => {
      const d = deps(true);
      let resolvePermission!: (granted: boolean) => void;
      let rejectPermission!: (error: Error) => void;
      let markStarted!: () => void;
      const started = new Promise<void>((resolve) => {
        markStarted = resolve;
      });
      d.requestPermission.mockImplementationOnce(() => {
        markStarted();
        return new Promise<boolean>((resolve, reject) => {
          resolvePermission = resolve;
          rejectPermission = reject;
        });
      });

      const accepting = acceptRoutineReminderSoftAsk(d);
      const rejected = expect(accepting).rejects.toMatchObject({
        code: 'ACCOUNT_GENERATION_CHANGED',
      });
      await started;
      beginAccountGenerationBoundary();
      boundaryActive = true;

      await waitForAccountGenerationOperationsToSettle();
      await rejected;
      expect(d.saveAndReschedule).not.toHaveBeenCalled();

      if (lateOutcome === 'resolve') resolvePermission(true);
      else rejectPermission(new Error('late permission failure'));
      await Promise.resolve();
      expect(d.saveAndReschedule).not.toHaveBeenCalled();
    },
  );

  it('preserves a same-owner permission failure', async () => {
    const d = deps(true);
    const permissionError = new Error('permission unavailable');
    d.requestPermission.mockRejectedValueOnce(permissionError);

    await expect(acceptRoutineReminderSoftAsk(d)).rejects.toBe(permissionError);
    expect(d.saveAndReschedule).not.toHaveBeenCalled();
  });

  it('keeps typed request unavailability retryable instead of persisting a denial', async () => {
    const d = deps(true);
    const permissionError = Object.assign(
      new Error('Notification permission request is unavailable.'),
      {
        code: 'NOTIFICATION_PERMISSION_REQUEST_UNAVAILABLE' as const,
        reason: 'invalid_response' as const,
      },
    );
    d.requestPermission.mockRejectedValueOnce(permissionError);

    await expect(acceptRoutineReminderSoftAsk(d)).rejects.toMatchObject({
      code: 'NOTIFICATION_PERMISSION_REQUEST_UNAVAILABLE',
      reason: 'invalid_response',
    });
    expect(d.saveAndReschedule).not.toHaveBeenCalled();
  });
});
