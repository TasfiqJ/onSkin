import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  endRecovery,
  loadCycleConfig,
  overrideStagingProducts,
  pauseCycle,
  recoveryProgress,
  resumeCycle,
  startCycleToday,
  startRecovery,
  updateCycleConfig,
  type CycleConfig,
} from './cycleStore';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  getPrivateItem: vi.fn(),
  removePrivateItem: vi.fn(),
  updatePrivateItem: vi.fn(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: mocks.getPrivateItem,
  removePrivateItem: mocks.removePrivateItem,
  updatePrivateItem: mocks.updatePrivateItem,
}));

const CYCLE_KEY = 'onskin.cycle.v1';
const LEGACY_ANCHOR_KEY = 'onskin.cycleAnchor';
const TODAY = '2026-07-10';

function config(overrides: Partial<CycleConfig> = {}): CycleConfig {
  return {
    variant: 'classic',
    anchorISO: '2026-07-01',
    pausedFrom: null,
    pauseReason: null,
    recovery: null,
    skips: [],
    stagingOverrides: [],
    ...overrides,
  };
}

function storeCycle(value: CycleConfig | Record<string, unknown>): string {
  const raw = JSON.stringify(value);
  mocks.storage.set(CYCLE_KEY, raw);
  return raw;
}

describe('cycle configuration persistence and reconciliation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 10, 12, 0, 0));
    delete process.env.EXPO_PUBLIC_E2E_CYCLE_CONFIG_SAVE_FAILURE;
    mocks.storage.clear();
    mocks.getPrivateItem.mockReset();
    mocks.removePrivateItem.mockReset();
    mocks.updatePrivateItem.mockReset();
    mocks.getPrivateItem.mockImplementation(async (key: string) => mocks.storage.get(key) ?? null);
    mocks.removePrivateItem.mockImplementation(async (key: string) => {
      mocks.storage.delete(key);
    });
    mocks.updatePrivateItem.mockImplementation(
      async (key: string, updater: (current: string | null) => string | null) => {
        const next = updater(mocks.storage.get(key) ?? null);
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('restarts today and clears every active disruption without retaining stale skips', async () => {
    storeCycle(
      config({
        anchorISO: '2026-01-01',
        pausedFrom: '2026-07-08',
        pauseReason: 'travel',
        recovery: { startISO: TODAY, days: 5, reason: 'procedure' },
        skips: ['2026-01-04', TODAY],
        stagingOverrides: ['retinol'],
      }),
    );

    await expect(startCycleToday()).resolves.toMatchObject({
      anchorISO: TODAY,
      pausedFrom: null,
      pauseReason: null,
      recovery: null,
      skips: [],
      stagingOverrides: ['retinol'],
    });
  });

  it('clears malformed cycle state and falls back to the legacy anchor', async () => {
    mocks.storage.set(CYCLE_KEY, JSON.stringify({ variant: 'fast', anchorISO: 'tomorrow' }));
    mocks.storage.set(LEGACY_ANCHOR_KEY, '2026-01-10');

    await expect(loadCycleConfig()).resolves.toMatchObject({
      variant: 'auto',
      anchorISO: '2026-01-10',
      pausedFrom: null,
      recovery: null,
    });
    expect(mocks.storage.has(CYCLE_KEY)).toBe(false);
  });

  it('rejects impossible calendar dates before projection reads the cycle', async () => {
    storeCycle(config({ anchorISO: '2026-02-31' }));
    mocks.storage.set(LEGACY_ANCHOR_KEY, '2026-01-10');

    await expect(loadCycleConfig()).resolves.toMatchObject({
      variant: 'auto',
      anchorISO: '2026-01-10',
    });
    expect(mocks.storage.has(CYCLE_KEY)).toBe(false);
  });

  it('normalizes a valid legacy partial config and writes the stable shape', async () => {
    storeCycle({
      variant: 'gentle',
      anchorISO: '2026-07-01',
      skips: ['2026-07-11'],
    });

    await expect(loadCycleConfig()).resolves.toEqual({
      variant: 'gentle',
      anchorISO: '2026-07-01',
      pausedFrom: null,
      pauseReason: null,
      recovery: null,
      skips: ['2026-07-11'],
      stagingOverrides: [],
    });
    expect(JSON.parse(mocks.storage.get(CYCLE_KEY) ?? '{}')).toMatchObject({
      pauseReason: null,
      recovery: null,
      stagingOverrides: [],
    });
  });

  it('trims and deduplicates stored dates and product ids', async () => {
    storeCycle({
      ...config(),
      anchorISO: ' 2026-07-01 ',
      skips: [' 2026-07-11 ', '2026-07-11'],
      stagingOverrides: [' retinol ', 'retinol', ''],
    });

    await expect(loadCycleConfig()).resolves.toMatchObject({
      anchorISO: '2026-07-01',
      skips: ['2026-07-11'],
      stagingOverrides: ['retinol'],
    });
  });

  it('rejects malformed direct patches and preserves the prior value', async () => {
    const before = storeCycle(config({ stagingOverrides: ['retinol'] }));

    await expect(updateCycleConfig({ anchorISO: 'tomorrow' })).rejects.toThrow(
      'CYCLE_CONFIG_INVALID',
    );
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
  });

  it('rejects an invalid recovery duration before touching private storage', async () => {
    const before = storeCycle(config());

    await expect(startRecovery(0, 'irritation')).rejects.toThrow(
      'CYCLE_RECOVERY_INPUT_INVALID',
    );
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
  });

  it('propagates failed private writes and leaves the previous cycle unchanged', async () => {
    const before = storeCycle(config());
    mocks.updatePrivateItem.mockRejectedValueOnce(new Error('private write failed'));

    await expect(pauseCycle('travel')).rejects.toThrow('private write failed');
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
  });

  it('resumes on the same cycle night by shifting the anchor by paused days', async () => {
    storeCycle(config());
    await pauseCycle('travel');

    vi.setSystemTime(new Date(2026, 6, 13, 12, 0, 0));
    await expect(resumeCycle()).resolves.toMatchObject({
      anchorISO: '2026-07-04',
      pausedFrom: null,
      pauseReason: null,
    });
  });

  it('finishes recovery early and shifts only the elapsed recovery days', async () => {
    storeCycle(config());
    await startRecovery(7, 'irritation');

    vi.setSystemTime(new Date(2026, 6, 12, 12, 0, 0));
    await expect(endRecovery()).resolves.toMatchObject({
      anchorISO: '2026-07-03',
      recovery: null,
    });
  });

  it('reconciles an expired recovery once and advances normally after its end', async () => {
    storeCycle(
      config({
        recovery: { startISO: '2026-07-02', days: 5, reason: 'procedure' },
      }),
    );

    await expect(loadCycleConfig()).resolves.toMatchObject({
      anchorISO: '2026-07-06',
      recovery: null,
    });
    await expect(loadCycleConfig()).resolves.toMatchObject({
      anchorISO: '2026-07-06',
      recovery: null,
    });
  });

  it('settles an existing pause before beginning recovery', async () => {
    storeCycle(
      config({
        pausedFrom: '2026-07-08',
        pauseReason: 'break',
      }),
    );

    await expect(startRecovery(5, 'procedure')).resolves.toMatchObject({
      anchorISO: '2026-07-03',
      pausedFrom: null,
      pauseReason: null,
      recovery: { startISO: TODAY, days: 5, reason: 'procedure' },
    });
  });

  it('settles elapsed recovery before changing to an open-ended pause', async () => {
    storeCycle(
      config({
        recovery: { startISO: '2026-07-08', days: 7, reason: 'irritation' },
      }),
    );

    await expect(pauseCycle('travel')).resolves.toMatchObject({
      anchorISO: '2026-07-03',
      pausedFrom: TODAY,
      pauseReason: 'travel',
      recovery: null,
    });
  });

  it('repairs legacy pause and recovery overlap without counting the overlap twice', async () => {
    storeCycle(
      config({
        pausedFrom: '2026-07-01',
        pauseReason: 'break',
        recovery: { startISO: '2026-07-03', days: 10, reason: 'procedure' },
      }),
    );

    await expect(loadCycleConfig()).resolves.toMatchObject({
      anchorISO: '2026-07-03',
      pausedFrom: null,
      pauseReason: null,
      recovery: { startISO: '2026-07-03', days: 10, reason: 'procedure' },
    });
  });

  it('preserves a newer legacy pause that superseded recovery', async () => {
    storeCycle(
      config({
        recovery: { startISO: '2026-07-01', days: 10, reason: 'procedure' },
        pausedFrom: '2026-07-03',
        pauseReason: 'travel',
      }),
    );

    await expect(loadCycleConfig()).resolves.toMatchObject({
      anchorISO: '2026-07-03',
      pausedFrom: '2026-07-03',
      pauseReason: 'travel',
      recovery: null,
    });
  });

  it('saves all staged products in one deduplicated atomic update', async () => {
    storeCycle(config({ stagingOverrides: ['retinol'] }));

    await expect(
      overrideStagingProducts([' azelaic ', 'retinol', 'azelaic']),
    ).resolves.toMatchObject({
      stagingOverrides: ['retinol', 'azelaic'],
    });
    expect(mocks.updatePrivateItem).toHaveBeenCalledTimes(1);
  });

  it('serializes independent staging updates without dropping either product', async () => {
    storeCycle(config());

    await Promise.all([
      overrideStagingProducts(['retinol']),
      overrideStagingProducts(['azelaic']),
    ]);

    await expect(loadCycleConfig()).resolves.toMatchObject({
      stagingOverrides: ['retinol', 'azelaic'],
    });
  });

  it('reports future recovery as inactive without producing a negative day', () => {
    expect(
      recoveryProgress({ startISO: '2026-07-12', days: 5, reason: 'procedure' }, TODAY),
    ).toEqual({ active: false, day: 0, days: 5 });
  });
});
