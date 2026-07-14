import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GeneratedPlan, PlanStep } from './generate';
import {
  applyRoutineOrderOverrides,
  loadRoutineOrderOverrides,
  readRoutineOrderState,
  reconcileRoutineSteps,
  ROUTINE_ORDER_INVALID,
  ROUTINE_ORDER_UNAVAILABLE,
  ROUTINE_ORDER_UNSUPPORTED_VERSION,
  routineOrderOverrideForPhase,
  saveRoutineOrderOverrides,
} from './orderStore';

const mocks = vi.hoisted(() => ({
  readPrivateItem: vi.fn(),
  updatePrivateItem: vi.fn(),
  storage: new Map<string, string>(),
  updateFailure: null as Error | null,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  readPrivateItem: mocks.readPrivateItem,
  updatePrivateItem: mocks.updatePrivateItem,
}));

const KEY = 'routinekind.routineOrder.v1';

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
    unplacedProducts: [],
    gaps: [],
    conflicts: [],
  };
}

describe('routine order persistence', () => {
  beforeEach(() => {
    mocks.readPrivateItem.mockReset();
    mocks.updatePrivateItem.mockReset();
    mocks.storage.clear();
    mocks.updateFailure = null;
    mocks.readPrivateItem.mockImplementation(async (key: string) => {
      const value = mocks.storage.get(key);
      return value === undefined ? { status: 'absent' } : { status: 'available', value };
    });
    mocks.updatePrivateItem.mockImplementation(
      async (key: string, updater: (current: string | null) => string | null) => {
        if (mocks.updateFailure) throw mocks.updateFailure;
        const next = updater(mocks.storage.get(key) ?? null);
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
      },
    );
  });

  it('returns an empty versioned record when no preference exists', async () => {
    await expect(readRoutineOrderState()).resolves.toEqual({
      status: 'absent',
      overrides: { schemaVersion: 1, am: [], pm: [] },
    });
    await expect(loadRoutineOrderOverrides()).resolves.toEqual({
      schemaVersion: 1,
      am: [],
      pm: [],
    });
  });

  it('preserves malformed or future-version state instead of applying it', async () => {
    const malformed = '{bad json';
    mocks.storage.set(KEY, malformed);
    await expect(readRoutineOrderState()).resolves.toEqual({
      status: 'corrupt',
      overrides: null,
    });
    await expect(loadRoutineOrderOverrides()).rejects.toThrow(ROUTINE_ORDER_INVALID);
    await expect(
      saveRoutineOrderOverrides({ schemaVersion: 1, am: ['cleanser'], pm: [] }),
    ).rejects.toThrow(ROUTINE_ORDER_INVALID);
    expect(mocks.storage.get(KEY)).toBe(malformed);

    const future = JSON.stringify({ schemaVersion: 2, am: ['cleanser'], pm: [] });
    mocks.storage.set(KEY, future);
    await expect(readRoutineOrderState()).resolves.toEqual({
      status: 'unsupported_version',
      overrides: null,
    });
    await expect(loadRoutineOrderOverrides()).rejects.toThrow(ROUTINE_ORDER_UNSUPPORTED_VERSION);
    await expect(
      saveRoutineOrderOverrides({ schemaVersion: 1, am: ['cleanser'], pm: [] }),
    ).rejects.toThrow(ROUTINE_ORDER_UNSUPPORTED_VERSION);
    expect(mocks.storage.get(KEY)).toBe(future);

    const fractionalVersion = JSON.stringify({ schemaVersion: 1.5, am: [], pm: [] });
    mocks.storage.set(KEY, fractionalVersion);
    await expect(readRoutineOrderState()).resolves.toEqual({
      status: 'corrupt',
      overrides: null,
    });
    expect(mocks.storage.get(KEY)).toBe(fractionalVersion);
  });

  it('accepts current fields in any JSON property order without rewriting storage', async () => {
    const current = JSON.stringify({ pm: ['retinol'], am: ['cleanser'], schemaVersion: 1 });
    mocks.storage.set(KEY, current);

    await expect(readRoutineOrderState()).resolves.toEqual({
      status: 'available',
      format: 'current',
      overrides: { schemaVersion: 1, am: ['cleanser'], pm: ['retinol'] },
    });
    expect(mocks.storage.get(KEY)).toBe(current);
  });

  it('normalizes legacy ids in memory without rewriting storage during a read', async () => {
    const legacy = JSON.stringify({
      am: [' moisturizer ', 'cleanser', 'cleanser', 4],
      pm: [null, 'retinol'],
    });
    mocks.storage.set(KEY, legacy);

    await expect(readRoutineOrderState()).resolves.toEqual({
      status: 'available',
      format: 'legacy',
      overrides: {
        schemaVersion: 1,
        am: ['moisturizer', 'cleanser'],
        pm: ['retinol'],
      },
    });
    await expect(loadRoutineOrderOverrides()).resolves.toEqual({
      schemaVersion: 1,
      am: ['moisturizer', 'cleanser'],
      pm: ['retinol'],
    });
    expect(mocks.storage.get(KEY)).toBe(legacy);
  });

  it('classifies low-level private read failures without treating them as empty overrides', async () => {
    for (const stored of [
      { status: 'unavailable', reason: 'storage_unavailable' },
      { status: 'corrupt', reason: 'decryption_failed' },
      { status: 'unsupported_version' },
    ] as const) {
      mocks.readPrivateItem.mockResolvedValueOnce(stored);
      const state = await readRoutineOrderState();
      expect(state.overrides).toBeNull();
      expect(state.status).toBe(stored.status);
    }

    mocks.readPrivateItem.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(readRoutineOrderState()).resolves.toEqual({
      status: 'unavailable',
      overrides: null,
    });
    mocks.readPrivateItem.mockResolvedValueOnce({
      status: 'unavailable',
      reason: 'storage_unavailable',
    });
    await expect(loadRoutineOrderOverrides()).rejects.toThrow(ROUTINE_ORDER_UNAVAILABLE);
  });

  it('accepts schema-zero routine order as legacy without rewriting it during a read', async () => {
    const legacy = JSON.stringify({ schemaVersion: 0, am: ['cleanser'], pm: ['retinol'] });
    mocks.storage.set(KEY, legacy);

    await expect(readRoutineOrderState()).resolves.toEqual({
      status: 'available',
      format: 'legacy',
      overrides: { schemaVersion: 1, am: ['cleanser'], pm: ['retinol'] },
    });
    expect(mocks.storage.get(KEY)).toBe(legacy);
  });

  it('removes storage when both phases return to canonical order', async () => {
    await expect(saveRoutineOrderOverrides({ schemaVersion: 1, am: [], pm: [] })).resolves.toEqual({
      schemaVersion: 1,
      am: [],
      pm: [],
    });
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('propagates private-storage failures instead of claiming a save succeeded', async () => {
    mocks.updateFailure = new Error('storage unavailable');

    await expect(
      saveRoutineOrderOverrides({ schemaVersion: 1, am: ['b', 'a'], pm: [] }),
    ).rejects.toThrow('storage unavailable');
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
