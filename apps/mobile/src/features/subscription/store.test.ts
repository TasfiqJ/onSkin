import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deriveState } from './entitlement';
import { clearEntitlement, loadEntitlement, startReverseTrialOnServer } from './store';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  env: { appEnvironment: 'development' as 'development' | 'staging' | 'production' },
  isSupabaseConfigured: false,
  invoke: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: mocks.env,
  get isSupabaseConfigured() {
    return mocks.isSupabaseConfigured;
  },
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
  }),
  multiRemovePrivateItems: vi.fn(async (keys: readonly string[]) => {
    keys.forEach((key) => mocks.storage.delete(key));
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mocks.invoke,
    },
    from: vi.fn(),
  },
}));

const NOW = new Date('2026-07-05T12:00:00.000Z');

describe('subscription store reverse trial', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.storage.clear();
    mocks.invoke.mockReset();
    mocks.env.appEnvironment = 'development';
    mocks.isSupabaseConfigured = false;
  });

  it('grants and persists a development reverse trial when Supabase is not configured', async () => {
    const entitlement = await startReverseTrialOnServer();

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(entitlement).toMatchObject({
      tier: 'pro',
      isActive: true,
      periodType: 'reverse_trial',
      store: 'app_granted',
      source: 'app_granted',
      environment: 'development',
      willRenew: false,
      productId: 'onskin_pro_reverse_trial_local',
    });
    expect(entitlement.expiresAt).toBe('2026-07-12T12:00:00.000Z');
    await expect(loadEntitlement()).resolves.toMatchObject(entitlement);

    const state = deriveState(entitlement, NOW.toISOString());
    expect(state).toMatchObject({ isPro: true, inReverseTrial: true, daysLeft: 7 });
  });

  it('still fails closed outside development when Supabase is not configured', async () => {
    mocks.env.appEnvironment = 'production';

    await expect(startReverseTrialOnServer()).rejects.toThrow(
      'Reverse trial is unavailable until Supabase is configured.',
    );
    await expect(loadEntitlement()).resolves.toBeNull();
  });

  it('clears persisted entitlement records', async () => {
    await startReverseTrialOnServer();

    await clearEntitlement();

    await expect(loadEntitlement()).resolves.toBeNull();
  });
});
