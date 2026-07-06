import { describe, expect, it } from 'vitest';

import { moistureFromAxis, sensitivityFromAxis } from './profileMapping';

describe('skin profile axis mapping', () => {
  it('maps sensitivity axis scores into coarse planner buckets', () => {
    expect(sensitivityFromAxis(null)).toBe('neutral');
    expect(sensitivityFromAxis(0)).toBe('neutral');
    expect(sensitivityFromAxis(2)).toBe('sensitive');
    expect(sensitivityFromAxis(-2)).toBe('resistant');
  });

  it('maps oil/moisture axis scores into coarse routine labels', () => {
    expect(moistureFromAxis(null)).toBe('balanced');
    expect(moistureFromAxis(0)).toBe('balanced');
    expect(moistureFromAxis(2)).toBe('oily');
    expect(moistureFromAxis(-2)).toBe('dry');
  });
});
