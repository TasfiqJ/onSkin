import { describe, expect, it } from 'vitest';

import {
  BASE_MDC,
  classifyChange,
  isCelebratedState,
  MIN_CAPTURES,
  toneAdjustedMdc,
  toneAdjustmentFactor,
  type ClassifyInput,
} from './trend';

// The within-person trend engine (docs/12 §6/§7). It produces a CHANGE-STATE only ,
// never a score, grade, or number. The fairness-adjusted noise floor (higher for darker
// Monk tones) is the load-bearing safety property: a darker-skinned user is never handed
// a falsely confident trend.

function input(over: Partial<ClassifyInput>): ClassifyInput {
  return { deltaMetric: 0.05, captureCount: 6, lightingConsistent: true, monkBand: 2, ...over };
}

describe('change-state classification (no number, ever. Just which state to narrate)', () => {
  it('insufficient_data below the minimum capture count', () => {
    expect(classifyChange(input({ captureCount: MIN_CAPTURES - 1 })).changeState).toBe(
      'insufficient_data',
    );
  });
  it('inconclusive_lighting when the pair is not comparable', () => {
    expect(classifyChange(input({ lightingConsistent: false })).changeState).toBe(
      'inconclusive_lighting',
    );
  });
  it('insufficient_data when the delta is not computable', () => {
    expect(classifyChange(input({ deltaMetric: null })).changeState).toBe('insufficient_data');
  });
  it('change_observed only above the tone-adjusted MDC floor', () => {
    expect(classifyChange(input({ deltaMetric: 0.4, monkBand: 2 })).changeState).toBe(
      'change_observed',
    );
  });
  it('consistent below the floor. A celebrated adherence win, not failure', () => {
    const r = classifyChange(input({ deltaMetric: 0.05, monkBand: 2 }));
    expect(r.changeState).toBe('consistent');
    expect(isCelebratedState(r.changeState)).toBe(true);
  });
});

describe('fairness floor. Darker Monk tones get an equal-or-HIGHER threshold (D-071)', () => {
  it('the tone-adjustment factor is monotonic non-decreasing with darker tones', () => {
    const factors = [1, 3, 5, 7, 9, 10].map(toneAdjustmentFactor);
    for (let i = 1; i < factors.length; i++)
      expect(factors[i]!).toBeGreaterThanOrEqual(factors[i - 1]!);
    expect(toneAdjustmentFactor(10)).toBeGreaterThan(toneAdjustmentFactor(1));
  });
  it('unknown tone is conservative (a higher floor than the lightest band)', () => {
    expect(toneAdjustmentFactor(null)).toBeGreaterThan(toneAdjustmentFactor(1));
  });
  it('the SAME delta that reads "change" on light skin reads "consistent" on dark skin', () => {
    // A mid delta between the light floor and the dark floor.
    const lightFloor = toneAdjustedMdc(1);
    const darkFloor = toneAdjustedMdc(9);
    expect(darkFloor).toBeGreaterThan(lightFloor);
    const delta = (lightFloor + darkFloor) / 2;
    expect(classifyChange(input({ deltaMetric: delta, monkBand: 1 })).changeState).toBe(
      'change_observed',
    );
    expect(classifyChange(input({ deltaMetric: delta, monkBand: 9 })).changeState).toBe(
      'consistent',
    );
  });
  it('exposes the tone-adjusted threshold on the result (for the photo_trend row)', () => {
    expect(classifyChange(input({ monkBand: 9 })).mdcThreshold).toBeCloseTo(
      BASE_MDC * toneAdjustmentFactor(9),
    );
  });
});
