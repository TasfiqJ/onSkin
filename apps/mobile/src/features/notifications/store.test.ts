import { beforeEach, describe, expect, it, vi } from 'vitest';

import { currentDeviceTimezone, DEFAULT_PREFS, loadNotifPrefs, saveNotifPrefs } from './store';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })),
  upsert: vi.fn(async () => ({ error: null })),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
  }),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
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
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      replenishmentAlerts: false,
      replenishmentAlertsOptInConfirmed: false,
    });
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
      replenishmentAlerts: true,
      replenishmentAlertsOptInConfirmed: true,
    });
    expect(mocks.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ replenishment_alerts: true }),
    );
  });

  it('removes unreadable local prefs and falls back to defaults', async () => {
    mocks.storage.set(KEY, '{not-json');

    await expect(loadNotifPrefs()).resolves.toEqual(DEFAULT_PREFS);

    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('removes wrong-shaped local prefs and falls back to defaults', async () => {
    mocks.storage.set(KEY, JSON.stringify(['amEnabled']));

    await expect(loadNotifPrefs()).resolves.toEqual(DEFAULT_PREFS);

    expect(mocks.storage.has(KEY)).toBe(false);
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
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      amTime: '08:15',
      pmTime: DEFAULT_PREFS.pmTime,
      quietEnd: '06:30',
      timezone,
      lockscreenDiscreet: true,
    });
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
      amEnabled: false,
      lockscreenDiscreet: true,
      timezone: currentDeviceTimezone(),
    });
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        lockscreen_discreet: true,
        timezone: currentDeviceTimezone(),
      }),
    );
  });
});
