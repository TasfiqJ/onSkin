import { describe, expect, it } from 'vitest';

import {
  compareDividerValueText,
  moveCompareDividerPercent,
  normalizeCompareDividerPercent,
} from './compareAccessibility';

describe('comparison divider accessibility', () => {
  it('moves in deterministic ten-percent screen-reader steps', () => {
    expect(moveCompareDividerPercent(52, 'increment')).toBe(62);
    expect(moveCompareDividerPercent(52, 'decrement')).toBe(42);
    expect(moveCompareDividerPercent(52, 'activate')).toBe(52);
  });

  it('clamps actions and gesture publication to the spoken range', () => {
    expect(moveCompareDividerPercent(95, 'increment')).toBe(100);
    expect(moveCompareDividerPercent(5, 'decrement')).toBe(0);
    expect(normalizeCompareDividerPercent(-20)).toBe(0);
    expect(normalizeCompareDividerPercent(120)).toBe(100);
    expect(normalizeCompareDividerPercent(Number.NaN)).toBe(52);
  });

  it('describes the visible before-photo share without a skin judgment', () => {
    expect(compareDividerValueText(61.6)).toBe('62 percent of the before photo visible');
  });
});
