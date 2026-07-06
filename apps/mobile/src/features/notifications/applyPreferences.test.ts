import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyNotificationPreferencePatch } from './applyPreferences';
import type { NotifPrefs } from './store';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

const next: NotifPrefs = {
  amEnabled: false,
  pmEnabled: true,
  amTime: '07:30',
  pmTime: '21:30',
  streakNudges: true,
  replenishmentAlerts: true,
  captureReminders: false,
  quietStart: '22:00',
  quietEnd: '07:00',
  liveActivityEnabled: false,
  promotionalOptIn: false,
  lockscreenDiscreet: true,
};

const deps = {
  save: vi.fn<(patch: Partial<NotifPrefs>) => Promise<NotifPrefs>>(),
  reschedule: vi.fn<(prefs: NotifPrefs) => Promise<void>>(),
};

describe('notification preference application', () => {
  beforeEach(() => {
    deps.save.mockReset();
    deps.reschedule.mockReset();
    deps.save.mockResolvedValue(next);
    deps.reschedule.mockResolvedValue(undefined);
  });

  it('saves local private prefs before rescheduling reminders', async () => {
    const patch = { amEnabled: false };

    await expect(applyNotificationPreferencePatch(patch, deps)).resolves.toBe(next);

    expect(deps.save).toHaveBeenCalledWith(patch);
    expect(deps.reschedule).toHaveBeenCalledWith(next);
    expect(deps.save.mock.invocationCallOrder[0]).toBeLessThan(
      deps.reschedule.mock.invocationCallOrder[0],
    );
  });

  it('fails closed when local preference persistence rejects', async () => {
    deps.save.mockRejectedValueOnce(new Error('private storage unavailable'));

    await expect(applyNotificationPreferencePatch({ amEnabled: false }, deps)).rejects.toThrow(
      'private storage unavailable',
    );

    expect(deps.reschedule).not.toHaveBeenCalled();
  });

  it('keeps the hook from applying visible state before persistence succeeds', () => {
    const source = readSource('features/notifications/useNotifications.ts');

    expect(source).toContain('applyNotificationPreferencePatch');
    expect(source).toContain('onSuccess: (next) => qc.setQueryData<NotifPrefs>(KEY, next)');
    expect(source).not.toContain('onMutate');
    expect(source).not.toContain('qc.setQueryData<NotifPrefs>(KEY, { ...prev');
  });
});
