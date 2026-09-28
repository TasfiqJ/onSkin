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
  it('does not render candidate timing copy as production guidance', () => {
    const copy = bannerSubhead(conflictFor('00000000-0000-4000-8000-000000000001'));

    expect(copy).toContain("won't show a compatibility result");
    expect(copy).not.toContain('alternate nights');
  });

  it('does not render candidate pregnancy copy as production guidance', () => {
    const copy = bannerSubhead(conflictFor('00000000-0000-4000-8000-00000000000b'));

    expect(copy).toContain("won't show a compatibility result");
    expect(copy).not.toMatch(/\bdoctor|pregnan|set this aside/iu);
  });
});
