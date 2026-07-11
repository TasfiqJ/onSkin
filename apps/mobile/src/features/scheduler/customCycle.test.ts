import { describe, expect, it } from 'vitest';

import type { Cycle } from './orchestrate';
import {
  adjustCustomCycleFrequency,
  allowedCustomCycleOccurrences,
  applyCustomCycleDefinition,
  approximateWeeklyFrequency,
  assignCustomCycleNight,
  customCycleFromCycle,
  customCycleLimitViolations,
  customCycleOccurrences,
  emptyCustomCycleDefinition,
  fitCustomCycleToCadence,
  hasAdjacentSameClass,
  MAX_CUSTOM_CYCLE_LENGTH,
  minimumCycleLengthForOccurrences,
  normalizeCustomCycleDefinition,
  pruneMissingCustomCycleProducts,
  resizeCustomCycle,
  type CustomCycleDefinition,
  type CycleEditorActive,
} from './customCycle';

function editorActive(
  id: string,
  className: CycleEditorActive['className'],
  maxFrequencyPerWeek: number,
  overrides: Partial<CycleEditorActive> = {},
): CycleEditorActive {
  return {
    id,
    name: id.toUpperCase(),
    className,
    eligible: true,
    staged: false,
    maxFrequencyPerWeek,
    ...overrides,
  };
}

function definition(productIds: (string | null)[]): CustomCycleDefinition {
  return {
    schemaVersion: 1,
    lengthNights: productIds.length,
    nights: productIds.map((productId) => ({ productId })),
  };
}

describe('custom cycle definition', () => {
  it('normalizes only schema-versioned 1-14 night records with recovery', () => {
    expect(normalizeCustomCycleDefinition(definition(['r', null]))).toEqual(
      definition(['r', null]),
    );
    expect(normalizeCustomCycleDefinition({ ...definition(['r', null]), schemaVersion: 2 })).toBe(
      null,
    );
    expect(normalizeCustomCycleDefinition(definition(['r']))).toBe(null);
    expect(
      normalizeCustomCycleDefinition(
        definition(Array.from({ length: MAX_CUSTOM_CYCLE_LENGTH + 1 }, () => null)),
      ),
    ).toBe(null);
  });

  it('turns a generated cycle into stable product-id intent', () => {
    const cycle: Cycle = {
      variant: 'classic',
      lengthNights: 4,
      nights: [
        { index: 0, slot: 'exfoliate', productId: 'a', productName: 'A', className: 'aha' },
        { index: 1, slot: 'retinoid', productId: 'r', productName: 'R', className: 'retinoid' },
        { index: 2, slot: 'recover', productId: null, productName: null, className: null },
        { index: 3, slot: 'recover', productId: null, productName: null, className: null },
      ],
      amDaily: [],
      notes: [],
    };

    expect(customCycleFromCycle(cycle)).toEqual(definition(['a', 'r', null, null]));
    expect(customCycleFromCycle(null)).toEqual(emptyCustomCycleDefinition());
  });

  it('resizes deterministically and never drops the final recovery slot', () => {
    expect(resizeCustomCycle(definition(['a', null]), 4)).toEqual(
      definition(['a', null, null, null]),
    );
    expect(resizeCustomCycle(definition(['a', 'r', null]), 2)).toEqual(definition(['a', null]));
    expect(resizeCustomCycle(definition(['a', null]), 99).lengthNights).toBe(
      MAX_CUSTOM_CYCLE_LENGTH,
    );
  });

  it('derives honest weekly cadence and length-aware occurrence budgets', () => {
    expect(approximateWeeklyFrequency(1, 4)).toBeCloseTo(1.75);
    expect(allowedCustomCycleOccurrences(1, 1)).toBe(0);
    expect(allowedCustomCycleOccurrences(1, 4)).toBe(0);
    expect(allowedCustomCycleOccurrences(1, 7)).toBe(1);
    expect(allowedCustomCycleOccurrences(2, 14)).toBe(4);
    expect(minimumCycleLengthForOccurrences(1, 1)).toBe(7);
    expect(minimumCycleLengthForOccurrences(7, 7)).toBe(8);
    expect(minimumCycleLengthForOccurrences(14, 7)).toBeNull();
  });

  it('adds frequency by extending recovery until the cadence fits', () => {
    const aha = editorActive('a', 'aha', 1);
    const result = adjustCustomCycleFrequency(definition([null]), aha, 1);

    expect(result.blocked).toBe(null);
    expect(result.definition.lengthNights).toBe(7);
    expect(customCycleOccurrences(result.definition, 'a')).toBe(1);
    expect(result.definition.nights.some((night) => night.productId === null)).toBe(true);
  });

  it('removes the last authored occurrence without touching the ramp', () => {
    const retinoid = editorActive('r', 'retinoid', 4);
    const result = adjustCustomCycleFrequency(
      definition(['r', null, 'r', null, 'r', null, null]),
      retinoid,
      -1,
    );

    expect(result.blocked).toBe(null);
    expect(result.definition.nights.map((night) => night.productId)).toEqual([
      'r',
      null,
      'r',
      null,
      null,
      null,
      null,
    ]);
  });

  it('blocks unavailable assignments, over-cap assignments, and removal of the last recovery', () => {
    const paused = editorActive('r', 'retinoid', 2, { eligible: false });
    expect(assignCustomCycleNight(definition([null]), 0, 'r', [paused]).blocked).toBe(
      'active_unavailable',
    );

    const aha = editorActive('a', 'aha', 1);
    expect(assignCustomCycleNight(definition(['a', null]), 1, 'a', [aha]).blocked).toBe(
      'cadence_limit',
    );

    const maxed = definition([
      'r',
      null,
      ...Array.from({ length: MAX_CUSTOM_CYCLE_LENGTH - 2 }, () => 'r'),
    ]);
    const frequent = editorActive('r', 'retinoid', 7);
    expect(assignCustomCycleNight(maxed, 1, 'r', [frequent]).blocked).toBe('recovery_required');
  });

  it('reports and repairs limits without depending on active input order', () => {
    const actives = [editorActive('a', 'aha', 1), editorActive('r', 'retinoid', 2)];
    const raw = definition(['a', 'r', 'r', null]);

    expect(customCycleLimitViolations(raw, actives)).toEqual([
      { productId: 'a', requestedOccurrences: 1, allowedOccurrences: 0 },
      { productId: 'r', requestedOccurrences: 2, allowedOccurrences: 1 },
    ]);
    expect(fitCustomCycleToCadence(raw, actives)).toEqual(
      fitCustomCycleToCadence(raw, [...actives].reverse()),
    );
    expect(customCycleLimitViolations(fitCustomCycleToCadence(raw, actives), actives)).toEqual([]);
  });

  it('prunes only products absent from the known shelf identity set', () => {
    expect(pruneMissingCustomCycleProducts(definition(['a', 'r', null]), ['r'])).toEqual(
      definition([null, 'r', null]),
    );
  });
});

describe('custom cycle projection reconciliation', () => {
  it('keeps earliest allowed occurrences and converts later or ineligible intent to recovery', () => {
    const actives = [
      editorActive('a', 'aha', 1),
      editorActive('r', 'retinoid', 4, { eligible: false }),
      editorActive('b', 'bha', 3, { staged: true }),
    ];
    const cycle = applyCustomCycleDefinition({
      definition: definition(['a', 'a', 'r', 'b', null, null, null]),
      actives,
      amDaily: [],
      notes: ['kept'],
    });

    expect(cycle?.variant).toBe('custom');
    expect(cycle?.nights.map((night) => night.productId)).toEqual([
      'a',
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(cycle?.notes).toEqual(['kept']);
    expect(cycle.nights.map((night) => night.reconciliationReason)).toEqual([
      null,
      'cadence_cap',
      'safety',
      'staged',
      'authored_recovery',
      'authored_recovery',
      'authored_recovery',
    ]);
    expect(cycle.nights.map((night) => night.authoredProductId)).toEqual([
      'a',
      'a',
      'r',
      'b',
      null,
      null,
      null,
    ]);
  });

  it('keeps a real recovery-only Custom cycle when no authored active is eligible', () => {
    const cycle = applyCustomCycleDefinition({
      definition: definition(['r', null]),
      actives: [editorActive('r', 'retinoid', 2, { eligible: false })],
      amDaily: [],
      notes: [],
    });

    expect(cycle.variant).toBe('custom');
    expect(cycle.nights.map((night) => night.productId)).toEqual([null, null]);
    expect(cycle.nights.map((night) => night.reconciliationReason)).toEqual([
      'safety',
      'authored_recovery',
    ]);
  });

  it('records missing shelf intent as its own recovery reason', () => {
    const cycle = applyCustomCycleDefinition({
      definition: definition(['removed-product', null]),
      actives: [],
      amDaily: [],
      notes: [],
    });

    expect(cycle.nights[0]).toMatchObject({
      productId: null,
      authoredProductId: 'removed-product',
      reconciliationReason: 'missing',
    });
  });

  it('is deterministic across active input permutations and unchanged reruns', () => {
    const def = definition(['a', 'r', null, null, null, null, null]);
    const actives = [editorActive('r', 'retinoid', 2), editorActive('a', 'aha', 1)];
    const input = { definition: def, amDaily: [], notes: [] };
    const forward = applyCustomCycleDefinition({ ...input, actives });
    const reverse = applyCustomCycleDefinition({ ...input, actives: [...actives].reverse() });

    expect(forward).toEqual(reverse);
    expect(forward).toEqual(applyCustomCycleDefinition({ ...input, actives }));
  });

  it('detects repeated same-class adjacency, including across the wrap', () => {
    const actives = [editorActive('a', 'aha', 3), editorActive('b', 'bha', 3)];
    expect(hasAdjacentSameClass(definition(['a', 'b', null]), actives)).toBe(true);
    expect(hasAdjacentSameClass(definition(['a', null, 'b']), actives)).toBe(true);
    expect(hasAdjacentSameClass(definition(['a', null, null]), actives)).toBe(false);
  });
});
