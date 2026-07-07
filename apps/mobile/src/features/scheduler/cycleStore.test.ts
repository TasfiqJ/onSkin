import { beforeEach, describe, expect, it, vi } from 'vitest';

import { localDateString } from '@/features/today/useToday';

import { loadCycleConfig, startCycleToday } from './cycleStore';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
  }),
}));

const CYCLE_KEY = 'onskin.cycle.v1';

describe('cycle store first-session handoff', () => {
  beforeEach(() => {
    mocks.storage.clear();
  });

  it('re-anchors an existing cycle config when the plan CTA starts today', async () => {
    const today = localDateString();
    const oldSkip = '2026-01-04';
    mocks.storage.set(
      CYCLE_KEY,
      JSON.stringify({
        variant: 'classic',
        anchorISO: '2026-01-01',
        pausedFrom: '2026-01-03',
        pauseReason: 'travel',
        recovery: null,
        skips: [oldSkip, today],
        stagingOverrides: ['retinol'],
      }),
    );

    await startCycleToday();

    await expect(loadCycleConfig()).resolves.toMatchObject({
      variant: 'classic',
      anchorISO: today,
      pausedFrom: null,
      pauseReason: null,
      recovery: null,
      skips: [oldSkip],
      stagingOverrides: ['retinol'],
    });
  });
});
