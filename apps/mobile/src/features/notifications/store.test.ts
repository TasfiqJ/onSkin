import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PREFS, loadNotifPrefs, saveNotifPrefs } from './store';

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

  it('refuses to persist or mirror a false lock-screen discretion value', async () => {
    const prefs = await saveNotifPrefs({ amEnabled: false, lockscreenDiscreet: false });
    await Promise.resolve();
    await Promise.resolve();

    expect(prefs).toMatchObject({ amEnabled: false, lockscreenDiscreet: true });
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toMatchObject({
      amEnabled: false,
      lockscreenDiscreet: true,
    });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ lockscreen_discreet: true }));
  });
});
