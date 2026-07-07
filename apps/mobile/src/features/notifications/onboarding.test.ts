import { describe, expect, it, vi } from 'vitest';

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
  saveNotifPrefs: vi.fn(async (patch: Partial<NotifPrefs>) => ({
    ...mocks.defaultPrefs,
    ...patch,
  })),
}));

vi.mock('./deliver', () => ({
  requestPermission: vi.fn(async () => false),
  rescheduleReminders: vi.fn(async () => {}),
}));

vi.mock('./store', () => ({
  DEFAULT_PREFS: mocks.defaultPrefs,
  saveNotifPrefs: mocks.saveNotifPrefs,
}));

function deps(requestGranted: boolean) {
  const saveNotifPrefs = vi.fn(async (patch: Partial<NotifPrefs>) => ({
    ...DEFAULT_PREFS,
    ...patch,
  }));
  return {
    requestPermission: vi.fn(async () => requestGranted),
    saveNotifPrefs,
    rescheduleReminders: vi.fn(async () => {}),
  };
}

describe('notification onboarding choice', () => {
  it('enables and schedules routine reminders only when permission is granted', async () => {
    const d = deps(true);

    await expect(acceptRoutineReminderSoftAsk(d)).resolves.toBe(true);

    expect(d.requestPermission).toHaveBeenCalledTimes(1);
    expect(d.saveNotifPrefs).toHaveBeenCalledWith({ amEnabled: true, pmEnabled: true });
    expect(d.rescheduleReminders).toHaveBeenCalledWith(
      expect.objectContaining({ amEnabled: true, pmEnabled: true }),
    );
  });

  it('persists routine reminders off when the OS prompt is denied', async () => {
    const d = deps(false);

    await expect(acceptRoutineReminderSoftAsk(d)).resolves.toBe(false);

    expect(d.saveNotifPrefs).toHaveBeenCalledWith({ amEnabled: false, pmEnabled: false });
    expect(d.rescheduleReminders).toHaveBeenCalledWith(
      expect.objectContaining({ amEnabled: false, pmEnabled: false }),
    );
  });

  it('persists routine reminders off when the soft ask is skipped', async () => {
    const d = deps(true);

    await expect(declineRoutineReminderSoftAsk(d)).resolves.toBeUndefined();

    expect(d.requestPermission).not.toHaveBeenCalled();
    expect(d.saveNotifPrefs).toHaveBeenCalledWith({ amEnabled: false, pmEnabled: false });
    expect(d.rescheduleReminders).toHaveBeenCalledWith(
      expect.objectContaining({ amEnabled: false, pmEnabled: false }),
    );
  });
});
