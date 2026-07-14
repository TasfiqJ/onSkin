import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
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

  it('does not apply owner-A permission results after an account boundary starts', async () => {
    const d = deps(true);
    let releasePermission!: (granted: boolean) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    d.requestPermission.mockImplementationOnce(() => {
      markStarted();
      return new Promise<boolean>((resolve) => {
        releasePermission = resolve;
      });
    });

    const accepting = acceptRoutineReminderSoftAsk(d);
    await started;
    beginAccountGenerationBoundary();
    boundaryActive = true;
    releasePermission(true);

    await expect(accepting).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(d.saveAndReschedule).not.toHaveBeenCalled();
  });
});
