import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AccountGenerationLeaseError,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';

import {
  CYCLE_CONFIG_INVALID,
  CYCLE_CONFIG_UNAVAILABLE,
  CYCLE_CONFIG_UNSUPPORTED_VERSION,
  endRecovery,
  loadCycleConfig,
  overrideStagingProducts,
  pauseCycle,
  readCycleConfig,
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
  writes: 0,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: mocks.getPrivateItem,
  removePrivateItem: mocks.removePrivateItem,
  updatePrivateItem: mocks.updatePrivateItem,
}));

const CYCLE_KEY = 'routinekind.cycle.v2';
const LEGACY_CYCLE_KEY = 'onskin.cycle.v1';
const LEGACY_ANCHOR_KEY = 'onskin.cycleAnchor';
const TODAY = '2026-07-10';

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
  let boundaryActive = false;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 10, 12, 0, 0));
    delete process.env.EXPO_PUBLIC_E2E_CYCLE_CONFIG_SAVE_FAILURE;
    mocks.storage.clear();
    mocks.writes = 0;
    mocks.getPrivateItem.mockReset();
    mocks.removePrivateItem.mockReset();
    mocks.updatePrivateItem.mockReset();
    mocks.getPrivateItem.mockImplementation(async (key: string) => mocks.storage.get(key) ?? null);
    mocks.removePrivateItem.mockImplementation(async (key: string) => {
      mocks.storage.delete(key);
    });
    mocks.updatePrivateItem.mockImplementation(
      async (key: string, updater: (current: string | null) => string | null) => {
        const current = mocks.storage.get(key) ?? null;
        const next = updater(current);
        if (next === current) return;
        mocks.writes += 1;
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    if (!boundaryActive) return;
    endAccountGenerationBoundary();
    boundaryActive = false;
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

    await expect(loadCycleConfig()).rejects.toThrow(CYCLE_CONFIG_INVALID);
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
    expect(mocks.removePrivateItem).not.toHaveBeenCalledWith(CYCLE_KEY);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('returns typed missing defaults without creating cycle or anchor bytes', async () => {
    await expect(readCycleConfig()).resolves.toMatchObject({
      status: 'missing',
      source: 'default',
      config: {
        schemaVersion: 1,
        variant: 'auto',
        anchorISO: TODAY,
      },
    });
    expect(mocks.storage.size).toBe(0);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('classifies authenticated plaintext decode failure as corrupt without fallback', async () => {
    const before = storeCycle(config());
    mocks.getPrivateItem.mockRejectedValueOnce(new Error('PRIVATE_KV_DECRYPTION_FAILED'));

    await expect(readCycleConfig()).resolves.toEqual({ status: 'corrupt', config: null });
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('rejects impossible calendar dates without deleting the record', async () => {
    const before = storeCycle(config({ anchorISO: '2026-02-31' }));
    mocks.storage.set(LEGACY_ANCHOR_KEY, '2026-01-10');

    await expect(loadCycleConfig()).rejects.toThrow(CYCLE_CONFIG_INVALID);
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('rejects non-canonical current records instead of normalizing them on read', async () => {
    const before = storeCycle({
      ...config(),
      skips: [' 2026-07-11 ', '2026-07-11'],
    });

    await expect(readCycleConfig()).resolves.toEqual({ status: 'corrupt', config: null });
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('projects a valid legacy partial config without migrating it on read', async () => {
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
    expect(mocks.storage.has(CYCLE_KEY)).toBe(false);
    expect(mocks.storage.get(LEGACY_CYCLE_KEY)).toBe(legacyRaw);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('upgrades legacy on explicit mutation and then ignores later downgrade writes', async () => {
    storeLegacyCycle(config({ variant: 'gentle' }));
    await expect(loadCycleConfig()).resolves.toMatchObject({ variant: 'gentle' });
    expect(mocks.storage.has(CYCLE_KEY)).toBe(false);

    await expect(updateCycleConfig({ variant: 'gentle' })).resolves.toMatchObject({
      variant: 'gentle',
    });
    expect(mocks.storage.has(CYCLE_KEY)).toBe(true);

    storeLegacyCycle(config({ variant: 'advanced' }));
    await expect(loadCycleConfig()).resolves.toMatchObject({ variant: 'gentle' });
  });

  it('preserves invalid legacy state and does not create a current record', async () => {
    const legacyRaw = storeLegacyCycle({ ...config(), schemaVersion: 2 });

    await expect(loadCycleConfig()).rejects.toThrow(CYCLE_CONFIG_UNSUPPORTED_VERSION);
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

    await expect(loadCycleConfig()).rejects.toThrow(CYCLE_CONFIG_INVALID);
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
  });

  it('preserves a future top-level schema for a newer app build', async () => {
    const before = storeCycle({ ...config(), schemaVersion: 2 });

    await expect(loadCycleConfig()).rejects.toThrow(CYCLE_CONFIG_UNSUPPORTED_VERSION);
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('refuses to overwrite corrupt and future current records during mutation', async () => {
    for (const value of [
      { ...config(), anchorISO: 'tomorrow' },
      { ...config(), schemaVersion: 2 },
    ]) {
      const before = storeCycle(value);
      await expect(skipTonight()).rejects.toThrow();
      expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
    }
  });

  it('requires an explicit schema on the current key while legacy migration stays compatible', async () => {
    const missingSchema: Record<string, unknown> = { ...config() };
    delete missingSchema.schemaVersion;
    const before = storeCycle(missingSchema);

    await expect(loadCycleConfig()).rejects.toThrow(CYCLE_CONFIG_INVALID);
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
  });

  it('returns and throws typed unavailable on private read failures', async () => {
    const before = storeCycle(config());
    mocks.getPrivateItem.mockImplementation(async (key: string) => {
      if (key === CYCLE_KEY) throw new Error('private read failed');
      return mocks.storage.get(key) ?? null;
    });

    await expect(readCycleConfig()).resolves.toEqual({ status: 'unavailable', config: null });
    await expect(loadCycleConfig()).rejects.toThrow(CYCLE_CONFIG_UNAVAILABLE);
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('normalizes legacy values only in memory and writes canonical v2 on mutation', async () => {
    const legacyRaw = storeLegacyCycle({
      variant: 'classic',
      anchorISO: ' 2026-07-01 ',
      skips: [' 2026-07-11 ', '2026-07-11'],
      stagingOverrides: [' retinol ', 'retinol', ''],
    });

    await expect(loadCycleConfig()).resolves.toMatchObject({
      anchorISO: '2026-07-01',
      skips: ['2026-07-11'],
      stagingOverrides: ['retinol'],
    });
    expect(mocks.storage.get(LEGACY_CYCLE_KEY)).toBe(legacyRaw);
    expect(mocks.storage.has(CYCLE_KEY)).toBe(false);

    await updateCycleConfig({ variant: 'gentle' });
    expect(JSON.parse(mocks.storage.get(CYCLE_KEY) ?? '{}')).toMatchObject({
      schemaVersion: 1,
      variant: 'gentle',
      anchorISO: '2026-07-01',
      skips: ['2026-07-11'],
      stagingOverrides: ['retinol'],
    });
  });

  it('rejects malformed direct patches and preserves the prior value', async () => {
    const before = storeCycle(config({ stagingOverrides: ['retinol'] }));

    await expect(updateCycleConfig({ anchorISO: 'tomorrow' })).rejects.toThrow(
      CYCLE_CONFIG_INVALID,
    );
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
  });

  it('rejects an invalid recovery duration before touching private storage', async () => {
    const before = storeCycle(config());

    await expect(startRecovery(0, 'irritation')).rejects.toThrow('CYCLE_RECOVERY_INPUT_INVALID');
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

  it('reconciles an expired recovery in memory and persists it only on explicit mutation', async () => {
    const before = storeCycle(
      config({
        recovery: { startISO: '2026-07-02', days: 5, reason: 'procedure' },
        skips: ['2026-07-01'],
      }),
    );

    await expect(loadCycleConfig()).resolves.toMatchObject({
      anchorISO: '2026-07-06',
      recovery: null,
    });
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();

    await expect(updateCycleConfig({ variant: 'classic' })).resolves.toMatchObject({
      anchorISO: '2026-07-06',
      recovery: null,
      skips: [],
    });
    expect(JSON.parse(mocks.storage.get(CYCLE_KEY) ?? '{}')).toMatchObject({
      anchorISO: '2026-07-06',
      recovery: null,
      skips: [],
    });
    expect(mocks.writes).toBe(1);
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

  it('reconciles pause and recovery overlap in memory without repairing on read', async () => {
    const before = storeCycle(
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
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('projects a newer legacy pause that superseded recovery without a read write', async () => {
    const before = storeCycle(
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
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
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

  it('preserves all 100 simultaneous staging mutations', async () => {
    await Promise.all(
      Array.from({ length: 100 }, (_, index) => overrideStagingProducts([`product-${index}`])),
    );

    const loaded = await loadCycleConfig();
    expect(loaded.anchorISO).toBe(TODAY);
    expect(loaded.stagingOverrides).toHaveLength(100);
    expect(new Set(loaded.stagingOverrides)).toEqual(
      new Set(Array.from({ length: 100 }, (_, index) => `product-${index}`)),
    );
  });

  it('rejects a delayed owner-A legacy migration after an account boundary with zero writes', async () => {
    let releaseLegacyRead!: () => void;
    mocks.getPrivateItem.mockImplementation(async (key: string) => {
      if (key === CYCLE_KEY) return null;
      if (key === LEGACY_CYCLE_KEY) {
        return new Promise<string>((resolve) => {
          releaseLegacyRead = () => resolve(JSON.stringify(config({ variant: 'gentle' })));
        });
      }
      return mocks.storage.get(key) ?? null;
    });

    const mutation = updateCycleConfig({ variant: 'advanced' });
    await vi.waitFor(() => expect(mocks.getPrivateItem).toHaveBeenCalledWith(LEGACY_CYCLE_KEY));

    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseLegacyRead();

    await expect(mutation).rejects.toBeInstanceOf(AccountGenerationLeaseError);
    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.has(CYCLE_KEY)).toBe(false);
  });

  it('does zero writes for a canonical explicit no-op', async () => {
    const before = storeCycle(config());

    await expect(updateCycleConfig({ variant: 'classic' })).resolves.toMatchObject({
      variant: 'classic',
    });
    expect(mocks.storage.get(CYCLE_KEY)).toBe(before);
    expect(mocks.writes).toBe(0);
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

  it('reports future recovery as inactive without producing a negative day', () => {
    expect(
      recoveryProgress({ startISO: '2026-07-12', days: 5, reason: 'procedure' }, TODAY),
    ).toEqual({ active: false, day: 0, days: 5 });
  });
});
