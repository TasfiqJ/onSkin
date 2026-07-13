import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';

import {
  currentDeviceTimezone,
  DEFAULT_PREFS,
  loadNotifPrefs,
  NOTIF_PREFS_INVALID,
  NOTIF_PREFS_UNSUPPORTED_VERSION,
  saveNotifPrefs,
} from './store';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })),
  upsert: vi.fn(async () => ({ error: null })),
  tails: new Map<string, Promise<void>>(),
  updateFailure: null as Error | null,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      const previous = mocks.tails.get(key) ?? Promise.resolve();
      let release!: () => void;
      const tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      mocks.tails.set(key, tail);
      await previous;
      try {
        if (mocks.updateFailure) throw mocks.updateFailure;
        const next = updater(mocks.storage.get(key) ?? null);
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
      } finally {
        release();
        if (mocks.tails.get(key) === tail) mocks.tails.delete(key);
      }
    },
  ),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
    },
    from: vi.fn(() => ({
      upsert: mocks.upsert,
    })),
  },
}));

const KEY = 'onskin.notifPrefs.v1';

describe('notification lock-screen privacy preference', () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.getUser.mockClear();
    mocks.upsert.mockClear();
    mocks.tails.clear();
    mocks.updateFailure = null;
  });

  it('coerces legacy local prefs that tried to disable discreet lock-screen copy', async () => {
    mocks.storage.set(KEY, JSON.stringify({ ...DEFAULT_PREFS, lockscreenDiscreet: false }));

    await expect(loadNotifPrefs()).resolves.toMatchObject({ lockscreenDiscreet: true });
  });

  it('keeps replenishment alerts off until the user explicitly opts in', async () => {
    expect(DEFAULT_PREFS.replenishmentAlerts).toBe(false);
    await expect(loadNotifPrefs()).resolves.toMatchObject({ replenishmentAlerts: false });
  });

  it('fails closed for legacy true values with no explicit opt-in marker', async () => {
    mocks.storage.set(KEY, JSON.stringify({ ...DEFAULT_PREFS, replenishmentAlerts: true }));

    await expect(loadNotifPrefs()).resolves.toMatchObject({ replenishmentAlerts: false });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).not.toHaveProperty(
      'replenishmentAlertsOptInConfirmed',
    );
  });

  it('persists and mirrors an explicit replenishment opt-in across unrelated edits', async () => {
    await expect(saveNotifPrefs({ replenishmentAlerts: true })).resolves.toMatchObject({
      replenishmentAlerts: true,
    });
    await expect(saveNotifPrefs({ pmEnabled: false })).resolves.toMatchObject({
      pmEnabled: false,
      replenishmentAlerts: true,
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      version: 1,
      prefs: {
        replenishmentAlerts: true,
        replenishmentAlertsOptInConfirmed: true,
      },
    });
    expect(mocks.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ replenishment_alerts: true }),
    );
  });

  it('preserves unreadable local prefs and fails every optional notification closed', async () => {
    const original = '{not-json';
    mocks.storage.set(KEY, original);

    await expect(loadNotifPrefs()).resolves.toMatchObject({
      amEnabled: false,
      pmEnabled: false,
      streakNudges: false,
      replenishmentAlerts: false,
      captureReminders: false,
      liveActivityEnabled: false,
      promotionalOptIn: false,
      lockscreenDiscreet: true,
    });

    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('preserves wrong-shaped and future-version preference records', async () => {
    for (const [raw, code] of [
      [JSON.stringify(['amEnabled']), NOTIF_PREFS_INVALID],
      [JSON.stringify({ version: 2, prefs: {} }), NOTIF_PREFS_UNSUPPORTED_VERSION],
    ] as const) {
      mocks.storage.set(KEY, raw);

      await expect(loadNotifPrefs()).resolves.toMatchObject({ amEnabled: false, pmEnabled: false });
      await expect(saveNotifPrefs({ pmEnabled: true })).rejects.toThrow(code);

      expect(mocks.storage.get(KEY)).toBe(raw);
    }
  });

  it('normalizes stored booleans and reminder times before scheduling reads them', async () => {
    const timezone = currentDeviceTimezone();

    mocks.storage.set(
      KEY,
      JSON.stringify({
        amEnabled: 'yes',
        pmEnabled: false,
        amTime: ' 08:15 ',
        pmTime: '99:99',
        quietStart: null,
        quietEnd: ' 06:30 ',
        timezone: 'bad timezone',
        liveActivityEnabled: true,
        promotionalOptIn: 'true',
        lockscreenDiscreet: false,
      }),
    );

    await expect(loadNotifPrefs()).resolves.toMatchObject({
      amEnabled: true,
      pmEnabled: false,
      amTime: '08:15',
      pmTime: DEFAULT_PREFS.pmTime,
      quietStart: null,
      quietEnd: '06:30',
      timezone,
      liveActivityEnabled: true,
      promotionalOptIn: false,
      lockscreenDiscreet: true,
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({ amTime: ' 08:15 ' });
  });

  it('refuses to persist or mirror a false lock-screen discretion value', async () => {
    const prefs = await saveNotifPrefs({ amEnabled: false, lockscreenDiscreet: false });
    await Promise.resolve();
    await Promise.resolve();

    expect(prefs).toMatchObject({
      amEnabled: false,
      lockscreenDiscreet: true,
      timezone: currentDeviceTimezone(),
    });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      version: 1,
      prefs: {
        amEnabled: false,
        lockscreenDiscreet: true,
        timezone: currentDeviceTimezone(),
      },
    });
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        lockscreen_discreet: true,
        timezone: currentDeviceTimezone(),
      }),
    );
  });

  it('serializes simultaneous partial preference edits without losing either writer', async () => {
    await Promise.all([
      saveNotifPrefs({ amEnabled: false }),
      saveNotifPrefs({ pmEnabled: false }),
      saveNotifPrefs({ captureReminders: true }),
    ]);

    await expect(loadNotifPrefs()).resolves.toMatchObject({
      amEnabled: false,
      pmEnabled: false,
      captureReminders: true,
    });
  });

  it('does not mirror or replace the prior envelope when an atomic write fails', async () => {
    await saveNotifPrefs({ amEnabled: false });
    await Promise.resolve();
    await Promise.resolve();
    const original = mocks.storage.get(KEY);
    mocks.upsert.mockClear();
    mocks.updateFailure = new Error('PRIVATE_WRITE_FAILED');

    await expect(saveNotifPrefs({ pmEnabled: false })).rejects.toThrow('PRIVATE_WRITE_FAILED');

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('does not publish an old preference mirror after an account boundary begins', async () => {
    let releaseUser!: () => void;
    const userGate = new Promise<void>((resolve) => {
      releaseUser = resolve;
    });
    mocks.getUser.mockImplementationOnce(async () => {
      await userGate;
      return { data: { user: { id: 'user-1' } } };
    });

    await saveNotifPrefs({ amEnabled: false });
    beginAccountGenerationBoundary();
    try {
      releaseUser();
      await waitForAccountGenerationOperationsToSettle();
    } finally {
      endAccountGenerationBoundary();
    }

    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
