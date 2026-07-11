import { describe, expect, it } from 'vitest';

import { conflictDetailRoute } from './conflictIdentity';
import { detectConflicts } from './engine';
import { STARTER_RULES } from './rules';

describe('conflict route identity', () => {
  it('carries both product IDs for an ordinary two-product conflict', () => {
    const [conflict] = detectConflicts(
      [
        { id: 'retinol', name: 'Retinol 0.3%', tags: ['retinoid'] },
        { id: 'glycolic', name: 'Glycolic 7%', tags: ['aha'] },
      ],
      { sensitivity: 'sensitive', pregnancy: false },
      STARTER_RULES,
    );

    expect(conflictDetailRoute(conflict!)).toEqual({
      pathname: '/conflict/[ruleId]',
      params: {
        ruleId: conflict!.rule.id,
        productAId: 'retinol',
        productBId: 'glycolic',
      },
    });
  });

  it('keeps two products under one safety rule independently addressable', () => {
    const safetyConflicts = detectConflicts(
      [
        { id: 'retinol-a', name: 'Retinol A', tags: ['retinoid'] },
        { id: 'retinol-b', name: 'Retinol B', tags: ['retinoid'] },
      ],
      { sensitivity: 'neutral', pregnancy: true },
      STARTER_RULES,
    ).filter((conflict) => conflict.rule.interactionType === 'safety');

    expect(safetyConflicts).toHaveLength(2);
    expect(safetyConflicts.map(conflictDetailRoute)).toEqual([
      {
        pathname: '/conflict/[ruleId]',
        params: { ruleId: safetyConflicts[0]!.rule.id, subjectProductId: 'retinol-a' },
      },
      {
        pathname: '/conflict/[ruleId]',
        params: { ruleId: safetyConflicts[1]!.rule.id, subjectProductId: 'retinol-b' },
      },
    ]);
  });
});
