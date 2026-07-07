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
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
}));

const CYCLE_KEY = 'onskin.cycle.v1';
const LEGACY_ANCHOR_KEY = 'onskin.cycleAnchor';

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

  it('clears malformed cycle config and falls back to the legacy anchor', async () => {
    mocks.storage.set(CYCLE_KEY, JSON.stringify({ variant: 'fast', anchorISO: 'tomorrow' }));
    mocks.storage.set(LEGACY_ANCHOR_KEY, '2026-01-10');

    await expect(loadCycleConfig()).resolves.toMatchObject({
      variant: 'auto',
      anchorISO: '2026-01-10',
      pausedFrom: null,
      pauseReason: null,
      recovery: null,
      skips: [],
      stagingOverrides: [],
    });
    expect(mocks.storage.has(CYCLE_KEY)).toBe(false);
  });

  it('rejects impossible calendar dates before projection reads the cycle', async () => {
    mocks.storage.set(
      CYCLE_KEY,
      JSON.stringify({
        variant: 'classic',
        anchorISO: '2026-02-31',
        pausedFrom: null,
        pauseReason: null,
        recovery: null,
        skips: [],
        stagingOverrides: [],
      }),
    );
    mocks.storage.set(LEGACY_ANCHOR_KEY, '2026-01-10');

    await expect(loadCycleConfig()).resolves.toMatchObject({
      variant: 'auto',
      anchorISO: '2026-01-10',
    });
    expect(mocks.storage.has(CYCLE_KEY)).toBe(false);
  });

  it('normalizes valid legacy partial cycle config with new default fields', async () => {
    mocks.storage.set(
      CYCLE_KEY,
      JSON.stringify({
        variant: 'gentle',
        anchorISO: '2026-01-01',
        skips: ['2026-01-02'],
      }),
    );

    await expect(loadCycleConfig()).resolves.toMatchObject({
      variant: 'gentle',
      anchorISO: '2026-01-01',
      pausedFrom: null,
      pauseReason: null,
      recovery: null,
      skips: ['2026-01-02'],
      stagingOverrides: [],
    });
    expect(JSON.parse(mocks.storage.get(CYCLE_KEY) ?? '{}')).toMatchObject({
      variant: 'gentle',
      anchorISO: '2026-01-01',
      pausedFrom: null,
      pauseReason: null,
      recovery: null,
      skips: ['2026-01-02'],
      stagingOverrides: [],
    });
  });

  it('normalizes padded and duplicate skipped nights', async () => {
    mocks.storage.set(
      CYCLE_KEY,
      JSON.stringify({
        variant: 'gentle',
        anchorISO: ' 2026-01-01 ',
        skips: [' 2026-01-02 ', '2026-01-02'],
      }),
    );

    await expect(loadCycleConfig()).resolves.toMatchObject({
      variant: 'gentle',
      anchorISO: '2026-01-01',
      skips: ['2026-01-02'],
    });
    expect(JSON.parse(mocks.storage.get(CYCLE_KEY) ?? '{}')).toMatchObject({
      anchorISO: '2026-01-01',
      skips: ['2026-01-02'],
    });
  });
});
