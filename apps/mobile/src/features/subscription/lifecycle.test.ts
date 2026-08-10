import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pendingLifecycleRoute } from './lifecycle';

const mocks = vi.hoisted(() => ({
  entitlement: null as null | Record<string, unknown>,
  storage: new Map<string, string>(),
  updateFailure: null as Error | null,
}));

vi.mock('./store', () => ({
  loadEntitlement: vi.fn(async () => mocks.entitlement),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      if (mocks.updateFailure) throw mocks.updateFailure;
      const next = updater(mocks.storage.get(key) ?? null);
      if (next === null) mocks.storage.delete(key);
      else mocks.storage.set(key, next);
    },
  ),
}));

const KEY = 'layerwell.subscription.promptedExpiry';
const NOW = '2026-07-12T12:00:00.000Z';

function entitlement(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tier: 'pro',
    isActive: false,
    expiresAt: '2026-07-11T12:00:00.000Z',
    periodType: 'reverse_trial',
    ...overrides,
  };
}

describe('subscription expiry lifecycle prompt', () => {
  beforeEach(() => {
    mocks.entitlement = entitlement();
    mocks.storage.clear();
    mocks.updateFailure = null;
  });

  it('atomically reserves a reverse-trial expiry and returns it only once', async () => {
    await expect(pendingLifecycleRoute(NOW)).resolves.toBe('/paywall/reoffer');
    await expect(pendingLifecycleRoute(NOW)).resolves.toBeNull();

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      expiresAt: '2026-07-11T12:00:00.000Z',
    });
  });

  it('routes a lapsed paid period to graceful downgrade', async () => {
    mocks.entitlement = entitlement({ periodType: 'normal' });

    await expect(pendingLifecycleRoute(NOW)).resolves.toBe('/paywall/downgrade');
  });

  it('does not reserve or route an active unexpired entitlement', async () => {
    mocks.entitlement = entitlement({
      isActive: true,
      expiresAt: '2026-07-13T12:00:00.000Z',
    });

    await expect(pendingLifecycleRoute(NOW)).resolves.toBeNull();
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('serializes simultaneous callers so only one receives the route', async () => {
    const routes = await Promise.all([pendingLifecycleRoute(NOW), pendingLifecycleRoute(NOW)]);

    expect(routes.filter(Boolean)).toEqual(['/paywall/reoffer']);
  });

  it('preserves malformed and future prompt state and fails closed', async () => {
    for (const stored of [
      'not-an-iso-date',
      JSON.stringify({ version: 2, expiresAt: '2026-07-10T12:00:00.000Z' }),
    ]) {
      mocks.storage.set(KEY, stored);

      await expect(pendingLifecycleRoute(NOW)).resolves.toBeNull();
      expect(mocks.storage.get(KEY)).toBe(stored);
    }
  });

  it('reads an equal legacy expiry without rewriting or presenting it again', async () => {
    const legacy = '2026-07-11T12:00:00.000Z';
    mocks.storage.set(KEY, legacy);

    await expect(pendingLifecycleRoute(NOW)).resolves.toBeNull();
    expect(mocks.storage.get(KEY)).toBe(legacy);
  });

  it('does not present when the durable reservation fails', async () => {
    mocks.updateFailure = new Error('storage unavailable');

    await expect(pendingLifecycleRoute(NOW)).resolves.toBeNull();
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('rejects invalid wall-clock input without touching state', async () => {
    await expect(pendingLifecycleRoute('not-a-date')).resolves.toBeNull();
    expect(mocks.storage.has(KEY)).toBe(false);
  });
});
