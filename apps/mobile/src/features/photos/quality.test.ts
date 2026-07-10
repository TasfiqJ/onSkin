import { describe, expect, it } from 'vitest';

import {
  unavailableFraming,
  unavailableLighting,
  type FramingAssessment,
  type LightingAssessment,
} from './captureAnalysis';
import { reviewQuality } from './quality';

const MATCHED: FramingAssessment = {
  state: 'matched',
  score: 0.92,
  headRoll: 1,
  headYaw: 2,
  headPitch: -1,
  centerOffsetX: 0.02,
  centerOffsetY: 0.03,
  faceHeightRatio: 0.56,
};

const GOOD_LIGHT: LightingAssessment = {
  state: 'good',
  score: 0.88,
  meanLuminance: 0.56,
  sideDifference: 0.04,
  clippedFraction: 0.03,
};

describe('measured photo review verdict', () => {
  it('is matched only when both measurements pass', () => {
    expect(reviewQuality({ framing: MATCHED, lighting: GOOD_LIGHT })).toEqual({
      flag: 'matched',
      aligned: true,
      wellLit: true,
    });
  });

  it('flags lighting variation from the frame or reference', () => {
    expect(
      reviewQuality({
        framing: MATCHED,
        lighting: { ...GOOD_LIGHT, state: 'too_dark', score: 0.4 },
      }).flag,
    ).toBe('lighting_varies');
    expect(
      reviewQuality({
        framing: MATCHED,
        lighting: { ...GOOD_LIGHT, score: 0.55 },
        refLighting: 0.8,
      }).flag,
    ).toBe('lighting_varies');
  });

  it('distinguishes framing-only and combined variation', () => {
    const adjusted = { ...MATCHED, state: 'adjust' as const, score: 0.45 };
    expect(reviewQuality({ framing: adjusted, lighting: GOOD_LIGHT }).flag).toBe('misaligned');
    expect(
      reviewQuality({
        framing: adjusted,
        lighting: { ...GOOD_LIGHT, state: 'uneven', score: 0.42 },
      }).flag,
    ).toBe('low');
  });

  it('never invents a verdict when measurement is unavailable', () => {
    expect(
      reviewQuality({ framing: unavailableFraming(), lighting: unavailableLighting() }),
    ).toEqual({ flag: 'unmeasured', aligned: null, wellLit: null });
    expect(
      reviewQuality({
        framing: { ...unavailableFraming(), state: 'no_face' },
        lighting: GOOD_LIGHT,
      }).flag,
    ).toBe('unmeasured');
  });
});
