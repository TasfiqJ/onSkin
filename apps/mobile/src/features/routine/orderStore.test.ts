import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';

import type { GeneratedPlan, PlanStep } from './generate';
import {
  applyRoutineOrderOverrides,
  loadRoutineOrderOverrides,
  reconcileRoutineSteps,
  ROUTINE_ORDER_INVALID,
  ROUTINE_ORDER_UNSUPPORTED_VERSION,
  type RoutineOrderOverrides,
  type RoutineOrderSaveTransaction,
  routineOrderOverrideForPhase,
  saveRoutineOrderOverrides,
} from './orderStore';

const mocks = vi.hoisted(() => ({
  getPrivateItem: vi.fn(),
  updatePrivateItem: vi.fn(),
  storage: new Map<string, string>(),
  updateFailure: null as Error | null,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: mocks.getPrivateItem,
  updatePrivateItem: mocks.updatePrivateItem,
}));

const KEY = 'layerwell.routineOrder.v1';
const EMPTY_OVERRIDES: RoutineOrderOverrides = { schemaVersion: 1, am: [], pm: [] };

function saveOverrides(
  next: RoutineOrderOverrides,
  previous: RoutineOrderOverrides = EMPTY_OVERRIDES,
) {
  return saveRoutineOrderOverrides({ previous, next });
}

function step(productId: string, name = productId, order = 10): PlanStep {
  return {
    productId,
    name,
    instruction: 'Use as directed.',
    order,
    cadence: 'stable',
    role: 'toner',
  };
}

function plan(am: PlanStep[], pm: PlanStep[]): GeneratedPlan {
  return {
    am,
    pm,
    cycle: null,
    ramp: [],
    safetyExclusions: [],
    cadenceWithheld: [],
    sequencingWithheld: [],
    unplacedProducts: [],
    gaps: [],
    conflicts: [],
    conflictCoverageStatus: 'compatible',
    unsupportedConflictPairs: [],
  };
}

const malformedWriteCases: { name: string; value: unknown }[] = [
  { name: 'null record', value: null },
  { name: 'array record', value: [] },
  { name: 'missing AM phase', value: { schemaVersion: 1, pm: [] } },
  { name: 'missing PM phase', value: { schemaVersion: 1, am: [] } },
  { name: 'missing schema version', value: { am: [], pm: [] } },
  { name: 'string schema version', value: { schemaVersion: '1', am: [], pm: [] } },
  {
    name: 'unexpected phase',
    value: { schemaVersion: 1, am: [], pm: [], evening: [] },
  },
  { name: 'non-array AM phase', value: { schemaVersion: 1, am: 'cleanser', pm: [] } },
  { name: 'non-array PM phase', value: { schemaVersion: 1, am: [], pm: {} } },
  { name: 'non-string product ID', value: { schemaVersion: 1, am: [42], pm: [] } },
  { name: 'empty product ID', value: { schemaVersion: 1, am: [''], pm: [] } },
  { name: 'whitespace product ID', value: { schemaVersion: 1, am: ['   '], pm: [] } },
  { name: 'untrimmed product ID', value: { schemaVersion: 1, am: [' cleanser '], pm: [] } },
  {
    name: 'duplicate AM product ID',
    value: { schemaVersion: 1, am: ['cleanser', 'cleanser'], pm: [] },
  },
  {
    name: 'duplicate PM product ID',
    value: { schemaVersion: 1, am: [], pm: ['retinol', 'retinol'] },
  },
];

describe('routine order persistence', () => {
  beforeEach(() => {
    mocks.getPrivateItem.mockReset();
    mocks.updatePrivateItem.mockReset();
    mocks.storage.clear();
    mocks.updateFailure = null;
    mocks.getPrivateItem.mockImplementation(async (key: string) => mocks.storage.get(key) ?? null);
    mocks.updatePrivateItem.mockImplementation(
      async (key: string, updater: (current: string | null) => string | null) => {
        if (mocks.updateFailure) throw mocks.updateFailure;
        const next = updater(mocks.storage.get(key) ?? null);
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
      },
    );
    setActiveHealthProcessingEpoch(1, { ownerUserId: 'user-a', accountGeneration: 0 });
  });

  it('returns an empty versioned record when no preference exists', async () => {
    await expect(loadRoutineOrderOverrides()).resolves.toEqual({
      schemaVersion: 1,
      am: [],
      pm: [],
    });
  });

  it('loads valid schema-v1 records regardless of property order without rewriting', async () => {
    const raw = '{"pm":["retinol"],"schemaVersion":1,"am":["cleanser"]}';
    mocks.storage.set(KEY, raw);

    await expect(loadRoutineOrderOverrides()).resolves.toEqual({
      schemaVersion: 1,
      am: ['cleanser'],
      pm: ['retinol'],
    });
    expect(mocks.storage.get(KEY)).toBe(raw);
  });

  it.each(['{}', '{"unrelated":true}'])(
    'rejects and preserves unknown unversioned records rather than treating them as empty: %s',
    async (raw) => {
      mocks.storage.set(KEY, raw);

      await expect(loadRoutineOrderOverrides()).rejects.toThrow(ROUTINE_ORDER_INVALID);
      expect(mocks.storage.get(KEY)).toBe(raw);
    },
  );

  it.each([
    ['am', '{"am":["cleanser"]}', { schemaVersion: 1, am: ['cleanser'], pm: [] }],
    ['pm', '{"pm":["retinol"]}', { schemaVersion: 1, am: [], pm: ['retinol'] }],
  ])('normalizes a supported partial legacy %s envelope read-only', async (_phase, raw, expected) => {
    mocks.storage.set(KEY, raw);

    await expect(loadRoutineOrderOverrides()).resolves.toEqual(expected);
    expect(mocks.storage.get(KEY)).toBe(raw);
  });

  it.each([
    ['malformed', '{bad json', ROUTINE_ORDER_INVALID],
    ['current-schema', '{"schemaVersion":1,"am":[]}', ROUTINE_ORDER_INVALID],
    ['future-version', '{"schemaVersion":2,"am":[],"pm":[]}', ROUTINE_ORDER_UNSUPPORTED_VERSION],
  ])('preserves malformed or future-version state instead of applying it: %s', async (_name, raw, error) => {
    mocks.storage.set(KEY, raw);

    await expect(loadRoutineOrderOverrides()).rejects.toThrow(error);
    await expect(saveOverrides({ schemaVersion: 1, am: ['cleanser'], pm: [] })).rejects.toThrow(error);
    expect(mocks.storage.get(KEY)).toBe(raw);
  });

  it('normalizes legacy ids in memory without rewriting storage during a read', async () => {
    const legacy = JSON.stringify({
      am: [' moisturizer ', 'cleanser', 'cleanser', 4],
      pm: [null, 'retinol'],
    });
    mocks.storage.set(KEY, legacy);

    await expect(loadRoutineOrderOverrides()).resolves.toEqual({
      schemaVersion: 1,
      am: ['moisturizer', 'cleanser'],
      pm: ['retinol'],
    });
    expect(mocks.storage.get(KEY)).toBe(legacy);
  });

  it.each(malformedWriteCases)(
    'preserves prior bytes and refuses storage for malformed caller input: $name',
    async ({ value }) => {
      const previous = '{"schemaVersion":1,"am":["cleanser","serum"],"pm":["retinol"]}';
      mocks.storage.set(KEY, previous);

      await expect(
        saveRoutineOrderOverrides({
          previous: EMPTY_OVERRIDES,
          next: value as RoutineOrderOverrides,
        }),
      ).rejects.toThrow(ROUTINE_ORDER_INVALID);

      expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
      expect(mocks.storage.get(KEY)).toBe(previous);
    },
  );

  it('preserves prior bytes when a future-version caller attempts a save', async () => {
    const previous = '{"schemaVersion":1,"am":["cleanser","serum"],"pm":["retinol"]}';
    mocks.storage.set(KEY, previous);

    await expect(
      saveRoutineOrderOverrides({
        previous: EMPTY_OVERRIDES,
        next: {
          schemaVersion: 2,
          am: [],
          pm: [],
        } as unknown as RoutineOrderOverrides,
      }),
    ).rejects.toThrow(ROUTINE_ORDER_UNSUPPORTED_VERSION);

    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.get(KEY)).toBe(previous);
  });

  it('preserves prior bytes when the caller prior snapshot is malformed', async () => {
    const previousRaw = '{"schemaVersion":1,"am":["cleanser","serum"],"pm":["retinol"]}';
    mocks.storage.set(KEY, previousRaw);

    await expect(
      saveRoutineOrderOverrides({
        previous: { schemaVersion: 1, am: ['cleanser', 'cleanser'], pm: [] },
        next: { schemaVersion: 1, am: ['serum', 'cleanser'], pm: [] },
      }),
    ).rejects.toThrow(ROUTINE_ORDER_INVALID);

    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.get(KEY)).toBe(previousRaw);
  });

  it.each([
    { name: 'null transaction', transaction: null },
    { name: 'missing prior snapshot', transaction: { next: EMPTY_OVERRIDES } },
    { name: 'missing next snapshot', transaction: { previous: EMPTY_OVERRIDES } },
    {
      name: 'unexpected transaction field',
      transaction: { previous: EMPTY_OVERRIDES, next: EMPTY_OVERRIDES, overwrite: true },
    },
  ])('rejects a malformed save transaction before storage: $name', async ({ transaction }) => {
    const previousRaw = '{"schemaVersion":1,"am":["cleanser"],"pm":["retinol"]}';
    mocks.storage.set(KEY, previousRaw);

    await expect(
      saveRoutineOrderOverrides(transaction as RoutineOrderSaveTransaction),
    ).rejects.toThrow(ROUTINE_ORDER_INVALID);

    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.get(KEY)).toBe(previousRaw);
  });

  it('rejects a future-version prior snapshot before storage', async () => {
    const previousRaw = '{"schemaVersion":1,"am":["cleanser"],"pm":["retinol"]}';
    mocks.storage.set(KEY, previousRaw);

    await expect(
      saveRoutineOrderOverrides({
        previous: { schemaVersion: 2, am: [], pm: [] } as unknown as RoutineOrderOverrides,
        next: EMPTY_OVERRIDES,
      }),
    ).rejects.toThrow(ROUTINE_ORDER_UNSUPPORTED_VERSION);

    expect(mocks.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.get(KEY)).toBe(previousRaw);
  });

  it('removes an existing valid record when both phases explicitly return to canonical order', async () => {
    const previous: RoutineOrderOverrides = {
      schemaVersion: 1,
      am: ['cleanser', 'serum'],
      pm: ['retinol'],
    };
    mocks.storage.set(KEY, JSON.stringify(previous));

    await expect(saveOverrides(EMPTY_OVERRIDES, previous)).resolves.toEqual({
      schemaVersion: 1,
      am: [],
      pm: [],
    });
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('clears one phase while preserving a valid override in the other phase', async () => {
    const previous: RoutineOrderOverrides = {
      schemaVersion: 1,
      am: ['cleanser', 'serum'],
      pm: ['retinol', 'oil'],
    };
    mocks.storage.set(KEY, JSON.stringify(previous));

    await expect(
      saveOverrides({ schemaVersion: 1, am: [], pm: ['oil', 'retinol'] }, previous),
    ).resolves.toEqual({
      schemaVersion: 1,
      am: [],
      pm: ['oil', 'retinol'],
    });
    expect(mocks.storage.get(KEY)).toBe('{"schemaVersion":1,"am":[],"pm":["oil","retinol"]}');
  });

  it('allows the same product once in each independent phase', async () => {
    await expect(
      saveOverrides({
        schemaVersion: 1,
        am: ['cleanser'],
        pm: ['cleanser'],
      }),
    ).resolves.toEqual({
      schemaVersion: 1,
      am: ['cleanser'],
      pm: ['cleanser'],
    });
  });

  it('merges concurrent independent AM and PM edits against the latest serialized value', async () => {
    const previous = { ...EMPTY_OVERRIDES };

    const [, secondCommit] = await Promise.all([
      saveOverrides({ schemaVersion: 1, am: ['cleanser'], pm: [] }, previous),
      saveOverrides({ schemaVersion: 1, am: [], pm: ['retinol'] }, previous),
    ]);

    expect(secondCommit).toEqual({
      schemaVersion: 1,
      am: ['cleanser'],
      pm: ['retinol'],
    });
    expect(mocks.storage.get(KEY)).toBe('{"schemaVersion":1,"am":["cleanser"],"pm":["retinol"]}');
  });

  it('does not resurrect a concurrently cleared phase while another phase is reordered', async () => {
    const previous: RoutineOrderOverrides = {
      schemaVersion: 1,
      am: ['cleanser', 'serum'],
      pm: ['retinol', 'oil'],
    };
    mocks.storage.set(KEY, JSON.stringify(previous));

    await Promise.all([
      saveOverrides({ ...previous, am: [] }, previous),
      saveOverrides({ ...previous, pm: ['oil', 'retinol'] }, previous),
    ]);

    expect(mocks.storage.get(KEY)).toBe('{"schemaVersion":1,"am":[],"pm":["oil","retinol"]}');
  });

  it('treats a stale no-op snapshot as a no-op instead of erasing a concurrent edit', async () => {
    await saveOverrides({ schemaVersion: 1, am: ['cleanser'], pm: [] });

    await expect(saveOverrides(EMPTY_OVERRIDES)).resolves.toEqual({
      schemaVersion: 1,
      am: ['cleanser'],
      pm: [],
    });
    expect(mocks.storage.get(KEY)).toBe('{"schemaVersion":1,"am":["cleanser"],"pm":[]}');
  });

  it('propagates private-storage failures instead of claiming a save succeeded', async () => {
    mocks.updateFailure = new Error('storage unavailable');

    await expect(saveOverrides({ schemaVersion: 1, am: ['b', 'a'], pm: [] })).rejects.toThrow(
      'storage unavailable',
    );
  });

  it('propagates private-storage read failures so the plan exposes its unavailable state', async () => {
    mocks.getPrivateItem.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(loadRoutineOrderOverrides()).rejects.toThrow('storage unavailable');
  });
});

describe('routine order reconciliation', () => {
  it('reorders by stable product id even when product names are duplicated', () => {
    const canonical = [step('a', 'Daily serum', 10), step('b', 'Daily serum', 20)];

    expect(reconcileRoutineSteps(canonical, ['b', 'a']).map((item) => item.productId)).toEqual([
      'b',
      'a',
    ]);
  });

  it('retains the user order, drops removed ids, and inserts new products by canonical anchors', () => {
    const canonical = [
      step('cleanser', 'Cleanser', 10),
      step('toner', 'Toner', 20),
      step('serum', 'Serum', 30),
      step('moisturizer', 'Moisturizer', 40),
    ];

    const reconciled = reconcileRoutineSteps(canonical, [
      'removed-product',
      'cleanser',
      'moisturizer',
    ]);

    expect(reconciled.map((item) => item.productId)).toEqual([
      'cleanser',
      'toner',
      'serum',
      'moisturizer',
    ]);
  });

  it('keeps an intentional reversal while placing a new product after its nearest predecessor', () => {
    const canonical = [step('cleanser'), step('serum'), step('moisturizer')];

    const reconciled = reconcileRoutineSteps(canonical, ['moisturizer', 'cleanser']);

    expect(reconciled.map((item) => item.productId)).toEqual(['moisturizer', 'cleanser', 'serum']);
    expect(reconciled.map((item) => item.order)).toEqual([10, 20, 30]);
  });

  it('clears a phase override when the edited order matches current guidance', () => {
    const canonical = [step('a'), step('b')];
    expect(routineOrderOverrideForPhase(canonical, canonical)).toEqual([]);
    expect(routineOrderOverrideForPhase(canonical, [canonical[1]!, canonical[0]!])).toEqual([
      'b',
      'a',
    ]);
  });

  it('retains temporarily excluded product ids while updating visible order slots', () => {
    const canonical = [step('cleanser'), step('moisturizer')];
    const edited = [canonical[1]!, canonical[0]!];

    expect(
      routineOrderOverrideForPhase(
        canonical,
        edited,
        ['cleanser', 'retinoid-hidden', 'moisturizer'],
        ['cleanser', 'retinoid-hidden', 'moisturizer'],
      ),
    ).toEqual(['moisturizer', 'retinoid-hidden', 'cleanser']);
  });

  it('purges a removed or replenished unit id while allowing the new unit to enter canonically', () => {
    const canonical = [step('cleanser-new'), step('moisturizer')];

    expect(
      routineOrderOverrideForPhase(
        canonical,
        canonical,
        ['cleanser-old', 'moisturizer'],
        ['cleanser-new', 'moisturizer'],
      ),
    ).toEqual([]);
  });

  it('keeps a renamed product in the saved position because identity is its id', () => {
    const renamed = [step('a', 'New label'), step('b', 'Other product')];
    expect(reconcileRoutineSteps(renamed, ['b', 'a']).map((item) => item.name)).toEqual([
      'Other product',
      'New label',
    ]);
  });

  it('applies AM and PM overrides independently without changing other plan output', () => {
    const original = plan(
      [step('a', 'A', 10), step('b', 'B', 20)],
      [step('c', 'C', 10), step('d', 'D', 20)],
    );

    const customized = applyRoutineOrderOverrides(original, {
      schemaVersion: 1,
      am: ['b', 'a'],
      pm: ['d', 'c'],
    });

    expect(customized.am.map((item) => item.productId)).toEqual(['b', 'a']);
    expect(customized.pm.map((item) => item.productId)).toEqual(['d', 'c']);
    expect(customized.gaps).toBe(original.gaps);
  });
});
