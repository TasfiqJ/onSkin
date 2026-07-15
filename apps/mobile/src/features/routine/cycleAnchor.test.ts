import { beforeEach, describe, expect, it, vi } from 'vitest';

import { localDateString } from '@/features/today/useToday';
import { setActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';

import { getCycleAnchor, setCycleAnchor } from './cycleAnchor';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
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

const KEY = 'onskin.cycleAnchor';

describe('cycle anchor store', () => {
  beforeEach(() => {
    mocks.storage.clear();
    setActiveHealthProcessingEpoch(1, { ownerUserId: 'user-a', accountGeneration: 0 });
  });

  it('returns and preserves a valid local-date anchor', async () => {
    mocks.storage.set(KEY, '2026-07-07');

    await expect(getCycleAnchor()).resolves.toBe('2026-07-07');

    expect(mocks.storage.get(KEY)).toBe('2026-07-07');
  });

  it('removes impossible calendar dates and falls back to today', async () => {
    mocks.storage.set(KEY, '2026-02-31');

    await expect(getCycleAnchor()).resolves.toBe(localDateString());

    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('normalizes padded stored anchors before the scheduler reads them', async () => {
    mocks.storage.set(KEY, ' 2026-07-07 ');

    await expect(getCycleAnchor()).resolves.toBe('2026-07-07');

    expect(mocks.storage.get(KEY)).toBe('2026-07-07');
  });

  it('never persists an invalid requested anchor', async () => {
    await setCycleAnchor('tomorrow');

    expect(mocks.storage.get(KEY)).toBe(localDateString());
  });
});
