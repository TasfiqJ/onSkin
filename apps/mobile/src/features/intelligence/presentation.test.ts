import { describe, expect, it } from 'vitest';

import type { DetectedConflict } from './engine';
import { bannerSubhead } from './presentation';
import { STARTER_RULES } from './rules';

function conflictFor(ruleId: string): DetectedConflict {
  const rule = STARTER_RULES.find((r) => r.id === ruleId);
  if (!rule) throw new Error(`Missing starter rule ${ruleId}`);
  return {
    rule,
    productAId: 'a',
    productBId: 'b',
    productAName: 'Retinol 0.3%',
    productBName: 'Glycolic 7%',
    computedSeverity: 'moderate',
  };
}

describe('conflict presentation copy', () => {
  it('does not claim alternate-night placement without scheduler output', () => {
    const copy = bannerSubhead(conflictFor('00000000-0000-4000-8000-000000000001'));

    expect(copy).toBe('Use them on alternate nights.');
    expect(copy).not.toMatch(/\bwe('ve| have)?\b/i);
    expect(copy).not.toMatch(/\b(set|placed)\b/i);
  });

  it('does not claim safety items were already set aside from shelf detection alone', () => {
    const copy = bannerSubhead(conflictFor('00000000-0000-4000-8000-00000000000b'));

    expect(copy).toBe('Set this aside until you can ask your doctor.');
    expect(copy).not.toMatch(/\bwe('ve| have)?\b/i);
  });
});
