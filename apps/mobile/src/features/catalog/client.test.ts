import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { searchCatalog } from './client';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  track: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  isSupabaseConfigured: false,
}));

vi.mock('@/lib/analytics/track', () => ({
  track: mocks.track,
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mocks.invoke,
    },
  },
}));

const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };
const originalDev = runtime.__DEV__;

describe('catalog client E2E fixtures', () => {
  beforeEach(() => {
    runtime.__DEV__ = true;
    mocks.invoke.mockClear();
    mocks.track.mockClear();
    delete process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT;
  });

  afterEach(() => {
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
    delete process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT;
  });

  it('supports a dev-only catalog search no-match fixture', async () => {
    process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT = 'no_match';

    await expect(searchCatalog('definitely not a catalog item')).resolves.toEqual({
      result: 'no_match',
      products: [],
      manualFallback: true,
    });

    expect(mocks.track).toHaveBeenCalledWith('catalog_search', { result: 'no_match' });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('ignores catalog search fixtures outside development runtime', async () => {
    runtime.__DEV__ = false;
    process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT = 'no_match';

    await expect(searchCatalog('definitely not a catalog item')).resolves.toEqual({
      result: 'offline',
      products: [],
      manualFallback: true,
    });

    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
