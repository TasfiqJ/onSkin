import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GeneratedPlan, PlanStep } from './generate';
import {
  applyRoutineOrderOverrides,
  loadRoutineOrderOverrides,
  reconcileRoutineSteps,
  routineOrderOverrideForPhase,
  saveRoutineOrderOverrides,
} from './orderStore';

const mocks = vi.hoisted(() => ({
  getPrivateItem: vi.fn(),
  removePrivateItem: vi.fn(),
  setPrivateItem: vi.fn(),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: mocks.getPrivateItem,
  removePrivateItem: mocks.removePrivateItem,
  setPrivateItem: mocks.setPrivateItem,
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
    mocks.getPrivateItem.mockReset();
    mocks.removePrivateItem.mockReset();
    mocks.setPrivateItem.mockReset();
    mocks.getPrivateItem.mockResolvedValue(null);
    mocks.removePrivateItem.mockResolvedValue(undefined);
    mocks.setPrivateItem.mockResolvedValue(undefined);
  });

  it('returns an empty versioned record when no preference exists', async () => {
    await expect(loadRoutineOrderOverrides()).resolves.toEqual({
      schemaVersion: 1,
      am: [],
      pm: [],
    });
  });

  it('removes malformed or future-version state instead of applying it', async () => {
    mocks.getPrivateItem.mockResolvedValueOnce('{bad json');
    await expect(loadRoutineOrderOverrides()).resolves.toEqual({
      schemaVersion: 1,
      am: [],
      pm: [],
    });
    expect(mocks.removePrivateItem).toHaveBeenCalledWith(KEY);

    mocks.getPrivateItem.mockResolvedValueOnce(
      JSON.stringify({ schemaVersion: 2, am: ['cleanser'], pm: [] }),
    );
    await expect(loadRoutineOrderOverrides()).resolves.toEqual({
      schemaVersion: 1,
      am: [],
      pm: [],
    });
    expect(mocks.removePrivateItem).toHaveBeenCalledTimes(2);
  });

  it('repairs duplicate, padded, and invalid product ids while retaining valid choices', async () => {
    mocks.getPrivateItem.mockResolvedValueOnce(
      JSON.stringify({ am: [' moisturizer ', 'cleanser', 'cleanser', 4], pm: [null, 'retinol'] }),
    );

    await expect(loadRoutineOrderOverrides()).resolves.toEqual({
      schemaVersion: 1,
      am: ['moisturizer', 'cleanser'],
      pm: ['retinol'],
    });
    expect(mocks.setPrivateItem).toHaveBeenCalledWith(
      KEY,
      JSON.stringify({
        schemaVersion: 1,
        am: ['moisturizer', 'cleanser'],
        pm: ['retinol'],
      }),
    );
  });

  it('removes storage when both phases return to canonical order', async () => {
    await expect(saveRoutineOrderOverrides({ schemaVersion: 1, am: [], pm: [] })).resolves.toEqual({
      schemaVersion: 1,
      am: [],
      pm: [],
    });
    expect(mocks.removePrivateItem).toHaveBeenCalledWith(KEY);
    expect(mocks.setPrivateItem).not.toHaveBeenCalled();
  });

  it('propagates private-storage failures instead of claiming a save succeeded', async () => {
    mocks.setPrivateItem.mockRejectedValueOnce(new Error('storage unavailable'));

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
