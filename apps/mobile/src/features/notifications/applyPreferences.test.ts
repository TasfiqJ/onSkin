import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyNotificationPreferencePatch } from './applyPreferences';
import type { NotifPrefs, NotifPrefsSaveResult } from './store';

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
  timezone: 'UTC',
  liveActivityEnabled: false,
  promotionalOptIn: false,
  lockscreenDiscreet: true,
};

const deps = {
  saveAndReschedule: vi.fn<(patch: Partial<NotifPrefs>) => Promise<NotifPrefsSaveResult>>(),
};

describe('notification preference application', () => {
  beforeEach(() => {
    deps.saveAndReschedule.mockReset();
    deps.saveAndReschedule.mockResolvedValue({ prefs: next, changed: true });
  });

  it('uses one serialized persistence-and-reconciliation operation', async () => {
    const patch = { amEnabled: false };

    await expect(applyNotificationPreferencePatch(patch, deps)).resolves.toBe(next);

    expect(deps.saveAndReschedule).toHaveBeenCalledWith(patch);
  });

  it('fails closed when local preference persistence rejects', async () => {
    deps.saveAndReschedule.mockRejectedValueOnce(new Error('private storage unavailable'));

    await expect(applyNotificationPreferencePatch({ amEnabled: false }, deps)).rejects.toThrow(
      'private storage unavailable',
    );

  });

  it('still reconciles native schedules after a semantic local no-op', async () => {
    deps.saveAndReschedule.mockResolvedValueOnce({ prefs: next, changed: false });

    await expect(applyNotificationPreferencePatch({ amEnabled: false }, deps)).resolves.toBe(next);

    expect(deps.saveAndReschedule).toHaveBeenCalledWith({ amEnabled: false });
  });

  it('keeps the hook from applying visible state before persistence succeeds', () => {
    const source = readSource('features/notifications/useNotifications.ts');

    expect(source).toContain('applyNotificationPreferencePatch');
    expect(source).toContain('qc.setQueryData<NotifPrefsRead>');
    expect(source).toContain("status: 'available'");
    expect(source).toContain('if (!isOwnerQueryScopeCurrent(ownerScope)) return;');
    expect(source).toContain("networkMode: 'always'");
    expect(source).not.toContain('onMutate');
    expect(source).not.toContain('qc.setQueryData<NotifPrefs>(KEY, { ...prev');
  });
});
