import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

import {
  ROUTINE_CADENCE_MUTATION_ADMISSION_CLOSED,
  ROUTINE_RECOVERY_ADMISSION_CLOSED,
  endRecovery,
  loadCycleConfig,
  overrideStagingProducts,
  pauseCycle,
  recoveryProgress,
  resumeCycle,
  saveCustomCycleDefinition,
  skipTonight,
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
  updateGate: null as Promise<void> | null,
  updateStarted: null as (() => void) | null,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: mocks.getPrivateItem,
  removePrivateItem: mocks.removePrivateItem,
  updatePrivateItem: mocks.updatePrivateItem,
}));

const CYCLE_KEY = 'layerwell.cycle.v2';
const LEGACY_CYCLE_KEY = 'layerwell.cycle.v1';
const LEGACY_ANCHOR_KEY = 'layerwell.cycleAnchor';
const TODAY = '2026-07-10';
const runtime = globalThis as { __DEV__?: boolean };
const originalDev = runtime.__DEV__;

function config(overrides: Partial<CycleConfig> = {}): CycleConfig {
  return {
    schemaVersion: 1,
    variant: 'classic',
    anchorISO: '2026-07-01',
    pausedFrom: null,
    pauseReason: null,
    recovery: null,
    skips: [],
    stagingOverrides: [],
    customCycle: null,
    ...overrides,
  };
}

function storeCycle(value: CycleConfig | Record<string, unknown>): string {
  const raw = JSON.stringify(value);
  mocks.storage.set(CYCLE_KEY, raw);
  return raw;
}

function storeLegacyCycle(value: CycleConfig | Record<string, unknown>): string {
  const raw = JSON.stringify(value);
  mocks.storage.set(LEGACY_CYCLE_KEY, raw);
  return raw;
}

describe('cycle configuration persistence and reconciliation', () => {
  beforeEach(() => {
    runtime.__DEV__ = true;
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 10, 12, 0, 0));
    delete process.env.EXPO_PUBLIC_E2E_CYCLE_CONFIG_SAVE_FAILURE;
    delete process.env.EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE;
    process.env.EXPO_PUBLIC_E2E_ROUTINE_RECOVERY_REVIEW_GATE = 'open_fixture';
    mocks.storage.clear();
    mocks.getPrivateItem.mockReset();
    mocks.removePrivateItem.mockReset();
    mocks.updatePrivateItem.mockReset();
    mocks.updateGate = null;
    mocks.updateStarted = null;
    mocks.getPrivateItem.mockImplementation(async (key: string) => mocks.storage.get(key) ?? null);
    mocks.removePrivateItem.mockImplementation(async (key: string) => {
      mocks.storage.delete(key);
    });
    mocks.updatePrivateItem.mockImplementation(
      async (key: string, updater: (current: string | null) => string | null) => {
        mocks.updateStarted?.();
        if (mocks.updateGate) await mocks.updateGate;
        const next = updater(mocks.storage.get(key) ?? null);
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
      },
    );
    setActiveHealthProcessingEpoch(1, { ownerUserId: 'user-a', accountGeneration: 0 });
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE;
    delete process.env.EXPO_PUBLIC_E2E_ROUTINE_RECOVERY_REVIEW_GATE;
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
    vi.useRealTimers();
  });

  it('refuses every cycle mutation before private storage when cadence admission is closed', async () => {
    const before = storeCycle(config({ stagingOverrides: ['existing'] }));
    process.env.EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE = 'closed';

    const customCycle = {
      schemaVersion: 1 as const,
      lengthNights: 2,
      nights: [{ productId: 'retinol' }, { productId: null }],
    };
    const mutations: (() => Promise<unknown>)[] = [
      () => updateCycleConfig({ variant: 'gentle' }),
      () => saveCustomCycleDefinition(customCycle),
      () => pauseCycle('travel'),
      () => resumeCycle(),
      () => startCycleToday(),
      () => skipTonight(),
      () => overrideStagingProducts(['retinol']),
      () => startRecovery(7, 'irritation'),
      () => endRecovery(),
    ];

    for (const mutate of mutations) {
      await expect(mutate()).rejects.toThrow(ROUTINE_CADENCE_MUTATION_ADMISSION_CLOSED);
    }

    expect(mocks.getPrivateItem).not.toHaveBeenCalled();
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.removePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
  });

  it('refuses automatic cycle-state reconciliation before writing when cadence admission is closed', async () => {
    const before = storeCycle(config({ skips: ['2026-01-01', '2026-07-11'] }));
    process.env.EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE = 'closed';

    await expect(loadCycleConfig()).rejects.toThrow(ROUTINE_CADENCE_MUTATION_ADMISSION_CLOSED);

    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
  });

  it('refuses legacy cycle migration before writing when cadence admission is closed', async () => {
    const before = storeLegacyCycle(config({ variant: 'gentle' }));
    process.env.EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE = 'closed';

    await expect(loadCycleConfig()).rejects.toThrow(ROUTINE_CADENCE_MUTATION_ADMISSION_CLOSED);

    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.get(LEGACY_CYCLE_KEY)).toBe(before);
    expect(mocks.storage.has(CYCLE_KEY)).toBe(false);
  });

  it('does not reconcile or rewrite stale recovery when only cadence is admitted', async () => {
    const recovery = { startISO: '2026-07-01', days: 5, reason: 'procedure' as const };
    const before = storeCycle(
      config({
        anchorISO: '2026-06-20',
        recovery,
        skips: ['2026-01-01', '2026-07-11'],
      }),
    );
    delete process.env.EXPO_PUBLIC_E2E_ROUTINE_RECOVERY_REVIEW_GATE;

    await expect(loadCycleConfig()).resolves.toMatchObject({
      anchorISO: '2026-06-20',
      recovery,
      skips: ['2026-01-01', '2026-07-11'],
    });

    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
  });

  it('defers legacy migration rather than rewriting stale recovery without its authority', async () => {
    const recovery = { startISO: '2026-07-01', days: 5, reason: 'procedure' as const };
    const before = storeLegacyCycle(config({ anchorISO: '2026-06-20', recovery }));
    delete process.env.EXPO_PUBLIC_E2E_ROUTINE_RECOVERY_REVIEW_GATE;

    await expect(loadCycleConfig()).resolves.toMatchObject({
      anchorISO: '2026-06-20',
      recovery,
    });

    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.get(LEGACY_CYCLE_KEY)).toBe(before);
    expect(mocks.storage.has(CYCLE_KEY)).toBe(false);
  });

  it('preserves stale recovery across ordinary variant, custom, staging, and skip writes', async () => {
    const recovery = { startISO: '2026-07-01', days: 5, reason: 'procedure' as const };
    const customCycle = {
      schemaVersion: 1 as const,
      lengthNights: 2,
      nights: [{ productId: 'retinol' }, { productId: null }],
    };
    const cases: {
      mutate: () => Promise<CycleConfig>;
      expected: Partial<CycleConfig>;
    }[] = [
      {
        mutate: () => updateCycleConfig({ variant: 'gentle' }),
        expected: { variant: 'gentle' },
      },
      {
        mutate: () => saveCustomCycleDefinition(customCycle),
        expected: { variant: 'custom', customCycle, stagingOverrides: ['retinol'] },
      },
      {
        mutate: () => overrideStagingProducts(['retinol']),
        expected: { stagingOverrides: ['retinol'] },
      },
      {
        mutate: () => skipTonight(),
        expected: { skips: [TODAY] },
      },
    ];
    delete process.env.EXPO_PUBLIC_E2E_ROUTINE_RECOVERY_REVIEW_GATE;

    for (const testCase of cases) {
      mocks.storage.clear();
      mocks.updatePrivateItem.mockClear();
      storeCycle(config({ anchorISO: '2026-06-20', recovery }));

      await expect(testCase.mutate()).resolves.toMatchObject({
        anchorISO: '2026-06-20',
        recovery,
        ...testCase.expected,
      });

      expect(JSON.parse(mocks.storage.get(CYCLE_KEY) ?? '{}')).toMatchObject({
        anchorISO: '2026-06-20',
        recovery,
        ...testCase.expected,
      });
      expect(mocks.updatePrivateItem).toHaveBeenCalledTimes(1);
    }
  });

  it('fails pause and restart before storage changes when they would clear stale recovery', async () => {
    const stored = config({
      anchorISO: '2026-06-20',
      recovery: { startISO: '2026-07-01', days: 5, reason: 'procedure' },
    });
    const mutations = [() => pauseCycle('travel'), () => startCycleToday()];
    delete process.env.EXPO_PUBLIC_E2E_ROUTINE_RECOVERY_REVIEW_GATE;

    for (const mutate of mutations) {
      mocks.storage.clear();
      mocks.updatePrivateItem.mockClear();
      const before = storeCycle(stored);

      await expect(mutate()).rejects.toThrow(ROUTINE_RECOVERY_ADMISSION_CLOSED);

      expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
    }
  });

  it('rejects direct recovery patches and recovery commands before private storage access', async () => {
    const before = storeCycle(
      config({
        recovery: { startISO: '2026-07-01', days: 5, reason: 'procedure' },
      }),
    );
    delete process.env.EXPO_PUBLIC_E2E_ROUTINE_RECOVERY_REVIEW_GATE;

    await expect(updateCycleConfig({ recovery: null })).rejects.toThrow(
      ROUTINE_RECOVERY_ADMISSION_CLOSED,
    );
    await expect(startRecovery(5, 'procedure')).rejects.toThrow(ROUTINE_RECOVERY_ADMISSION_CLOSED);
    await expect(endRecovery()).rejects.toThrow(ROUTINE_RECOVERY_ADMISSION_CLOSED);

    expect(mocks.getPrivateItem).not.toHaveBeenCalled();
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
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

  it('fails closed and preserves malformed current cycle state', async () => {
    const before = storeCycle({ variant: 'fast', anchorISO: 'tomorrow' });
    mocks.storage.set(LEGACY_ANCHOR_KEY, '2026-01-10');

    await expect(loadCycleConfig()).rejects.toThrow('CYCLE_CONFIG_INVALID');
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
    expect(mocks.removePrivateItem).not.toHaveBeenCalledWith(CYCLE_KEY);
  });

  it('rejects impossible calendar dates without deleting the record', async () => {
    const before = storeCycle(config({ anchorISO: '2026-02-31' }));
    mocks.storage.set(LEGACY_ANCHOR_KEY, '2026-01-10');

    await expect(loadCycleConfig()).rejects.toThrow('CYCLE_CONFIG_INVALID');
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
  });

  it('migrates a valid legacy partial config into the isolated current key', async () => {
    const legacyRaw = storeLegacyCycle({
      variant: 'gentle',
      anchorISO: '2026-07-01',
      skips: ['2026-07-11'],
    });

    await expect(loadCycleConfig()).resolves.toEqual({
      schemaVersion: 1,
      variant: 'gentle',
      anchorISO: '2026-07-01',
      pausedFrom: null,
      pauseReason: null,
      recovery: null,
      skips: ['2026-07-11'],
      stagingOverrides: [],
      customCycle: null,
    });
    expect(JSON.parse(mocks.storage.get(CYCLE_KEY) ?? '{}')).toMatchObject({
      pauseReason: null,
      recovery: null,
      stagingOverrides: [],
      customCycle: null,
    });
    expect(mocks.storage.get(LEGACY_CYCLE_KEY)).toBe(legacyRaw);
  });

  it('ignores later downgrade writes to the isolated legacy key', async () => {
    storeLegacyCycle(config({ variant: 'gentle' }));
    await expect(loadCycleConfig()).resolves.toMatchObject({ variant: 'gentle' });

    storeLegacyCycle(config({ variant: 'advanced' }));
    await expect(loadCycleConfig()).resolves.toMatchObject({ variant: 'gentle' });
  });

  it('preserves invalid legacy state and does not create a current record', async () => {
    const legacyRaw = storeLegacyCycle({ ...config(), schemaVersion: 2 });

    await expect(loadCycleConfig()).rejects.toThrow('CYCLE_CONFIG_INVALID');
    expect(mocks.storage.get(LEGACY_CYCLE_KEY)).toBe(legacyRaw);
    expect(mocks.storage.has(CYCLE_KEY)).toBe(false);
  });

  it('preserves unknown custom-cycle schemas instead of projecting or deleting them', async () => {
    const before = storeCycle({
      ...config(),
      variant: 'custom',
      customCycle: {
        schemaVersion: 2,
        lengthNights: 2,
        nights: [{ productId: 'retinol' }, { productId: null }],
      },
    });
    mocks.storage.set(LEGACY_ANCHOR_KEY, '2026-01-10');

    await expect(loadCycleConfig()).rejects.toThrow('CYCLE_CONFIG_INVALID');
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
  });

  it('preserves a future top-level schema for a newer app build', async () => {
    const before = storeCycle({ ...config(), schemaVersion: 2 });

    await expect(loadCycleConfig()).rejects.toThrow('CYCLE_CONFIG_INVALID');
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
  });

  it('requires an explicit schema on the current key while legacy migration stays compatible', async () => {
    const missingSchema: Record<string, unknown> = { ...config() };
    delete missingSchema.schemaVersion;
    const before = storeCycle(missingSchema);

    await expect(loadCycleConfig()).rejects.toThrow('CYCLE_CONFIG_INVALID');
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
  });

  it('requires a complete exact current schema instead of defaulting partial or unknown fields', async () => {
    const partial = storeCycle({ schemaVersion: 1 });

    await expect(loadCycleConfig()).rejects.toThrow('CYCLE_CONFIG_INVALID');
    expect(mocks.storage.get(CYCLE_KEY)).toBe(partial);

    const withUnknownField = storeCycle({ ...config(), futureField: true });
    await expect(loadCycleConfig()).rejects.toThrow('CYCLE_CONFIG_INVALID');
    expect(mocks.storage.get(CYCLE_KEY)).toBe(withUnknownField);
  });

  it('propagates private read failures without creating fallback state', async () => {
    const before = storeCycle(config());
    mocks.getPrivateItem.mockImplementation(async (key: string) => {
      if (key === CYCLE_KEY) throw new Error('private read failed');
      return mocks.storage.get(key) ?? null;
    });

    await expect(loadCycleConfig()).rejects.toThrow('private read failed');
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
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

    await expect(startRecovery(0, 'irritation')).rejects.toThrow('CYCLE_RECOVERY_INPUT_INVALID');
    await expect(startRecovery(5, 'irritation')).rejects.toThrow('CYCLE_RECOVERY_INPUT_INVALID');
    await expect(startRecovery(4, 'procedure')).rejects.toThrow('CYCLE_RECOVERY_INPUT_INVALID');
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
  });

  it('propagates failed private writes and leaves the previous cycle unchanged', async () => {
    const before = storeCycle(config());
    mocks.updatePrivateItem.mockRejectedValueOnce(new Error('private write failed'));

    await expect(pauseCycle('travel')).rejects.toThrow('private write failed');
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
  });

  it('does not pre-commit reconciliation when the requested mutation fails', async () => {
    const before = storeCycle(
      config({
        anchorISO: '2026-06-20',
        recovery: { startISO: '2026-07-01', days: 5, reason: 'procedure' },
        skips: ['2026-01-01', '2026-07-11'],
      }),
    );
    process.env.EXPO_PUBLIC_E2E_CYCLE_CONFIG_SAVE_FAILURE = 'once';

    const pending = updateCycleConfig({ variant: 'gentle' });
    const rejection = expect(pending).rejects.toThrow('E2E_CYCLE_CONFIG_PRIVATE_WRITE_FAILURE');
    await vi.advanceTimersByTimeAsync(600);

    await rejection;
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
  });

  it('applies a mutation to legacy state in the same first v2 write', async () => {
    const legacyRaw = storeLegacyCycle({
      variant: 'gentle',
      anchorISO: '2026-07-01',
      skips: ['2026-07-11'],
    });

    await expect(updateCycleConfig({ variant: 'advanced' })).resolves.toMatchObject({
      schemaVersion: 1,
      variant: 'advanced',
      anchorISO: '2026-07-01',
      skips: ['2026-07-11'],
    });
    expect(mocks.updatePrivateItem).toHaveBeenCalledTimes(1);
    expect(mocks.storage.get(LEGACY_CYCLE_KEY)).toBe(legacyRaw);
  });

  it('does not migrate or overwrite legacy recovery during an unauthorized mutation', async () => {
    const recovery = { startISO: '2026-07-01', days: 5, reason: 'procedure' as const };
    const legacyRaw = storeLegacyCycle(config({ recovery }));
    delete process.env.EXPO_PUBLIC_E2E_ROUTINE_RECOVERY_REVIEW_GATE;

    await expect(updateCycleConfig({ variant: 'gentle' })).rejects.toThrow(
      ROUTINE_RECOVERY_ADMISSION_CLOSED,
    );

    expect(mocks.storage.get(LEGACY_CYCLE_KEY)).toBe(legacyRaw);
    expect(mocks.storage.has(CYCLE_KEY)).toBe(false);
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

  it('saves the complete custom definition and phased choices in one atomic update', async () => {
    storeCycle(
      config({
        pausedFrom: '2026-07-09',
        pauseReason: 'break',
        stagingOverrides: ['existing'],
      }),
    );
    const customCycle = {
      schemaVersion: 1 as const,
      lengthNights: 7,
      nights: [
        { productId: 'aha' },
        { productId: null },
        { productId: 'retinoid' },
        { productId: null },
        { productId: null },
        { productId: null },
        { productId: null },
      ],
    };

    await expect(saveCustomCycleDefinition(customCycle)).resolves.toMatchObject({
      schemaVersion: 1,
      variant: 'custom',
      anchorISO: '2026-07-01',
      pausedFrom: '2026-07-09',
      customCycle,
      stagingOverrides: ['existing', 'aha', 'retinoid'],
    });
    expect(mocks.updatePrivateItem).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid custom definitions before touching private storage', async () => {
    const before = storeCycle(config());

    await expect(
      saveCustomCycleDefinition({
        schemaVersion: 1,
        lengthNights: 1,
        nights: [{ productId: 'retinoid' }],
      }),
    ).rejects.toThrow('CUSTOM_CYCLE_INVALID');
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
  });

  it('keeps a saved custom definition when a preset is selected', async () => {
    const customCycle = {
      schemaVersion: 1 as const,
      lengthNights: 2,
      nights: [{ productId: 'retinoid' }, { productId: null }],
    };
    storeCycle(config({ variant: 'custom', customCycle }));

    await expect(updateCycleConfig({ variant: 'gentle' })).resolves.toMatchObject({
      variant: 'gentle',
      customCycle,
    });
  });

  it('serializes independent staging updates without dropping either product', async () => {
    storeCycle(config());

    await Promise.all([overrideStagingProducts(['retinol']), overrideStagingProducts(['azelaic'])]);

    await expect(loadCycleConfig()).resolves.toMatchObject({
      stagingOverrides: ['retinol', 'azelaic'],
    });
  });

  it('preserves a concurrent disruption while saving a complete Custom definition', async () => {
    storeCycle(config());
    const customCycle = {
      schemaVersion: 1 as const,
      lengthNights: 2,
      nights: [{ productId: 'retinol' }, { productId: null }],
    };

    await Promise.all([pauseCycle('travel'), saveCustomCycleDefinition(customCycle)]);

    await expect(loadCycleConfig()).resolves.toMatchObject({
      variant: 'custom',
      pausedFrom: TODAY,
      pauseReason: 'travel',
      customCycle,
      stagingOverrides: ['retinol'],
    });
  });

  it('does not write a stale cycle mutation after same-owner same-epoch re-grant', async () => {
    const before = storeCycle(config({ variant: 'classic' }));
    let releaseUpdate!: () => void;
    let markUpdateStarted!: () => void;
    mocks.updateGate = new Promise<void>((resolve) => {
      releaseUpdate = resolve;
    });
    const updateStarted = new Promise<void>((resolve) => {
      markUpdateStarted = resolve;
    });
    mocks.updateStarted = markUpdateStarted;

    const pending = updateCycleConfig({ variant: 'gentle' });
    await updateStarted;
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(1, { ownerUserId: 'user-a', accountGeneration: 0 });
    releaseUpdate();

    await expect(pending).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
  });

  it('reports future recovery as inactive without producing a negative day', () => {
    expect(
      recoveryProgress({ startISO: '2026-07-12', days: 5, reason: 'procedure' }, TODAY),
    ).toEqual({ active: false, day: 0, days: 5 });
  });
});
