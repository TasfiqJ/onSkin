import { describe, expect, it } from 'vitest';

import { detectConflicts, isReassuring } from '@/features/intelligence/engine';
import { conflictKey } from '@/features/intelligence/conflictIdentity';
import { STARTER_RULES } from '@/features/intelligence/rules';

import { pairedProductIdsForResolvedConflicts } from './pairedConflicts';

const profile = { sensitivity: 'sensitive', pregnancy: false } as const;

describe('shelf paired badge resolution gate', () => {
  it('does not mark alternate-night advice as paired until scheduler placement resolves it', () => {
    const [conflict] = detectConflicts(
      [
        { id: 'retinol', name: 'Retinol 0.3%', tags: ['retinoid'] },
        { id: 'glycolic', name: 'Glycolic 7%', tags: ['aha'] },
      ],
      profile,
      STARTER_RULES,
    );

    expect(conflict?.rule.resolutionType).toBe('alternate_nights');
    expect(pairedProductIdsForResolvedConflicts([conflict!], new Set())).toEqual(new Set());

    const resolved = pairedProductIdsForResolvedConflicts(
      [conflict!],
      new Set([conflictKey(conflict!)]),
    );
    expect(resolved).toEqual(new Set(['retinol', 'glycolic']));
  });

  it('does not mark overridden or reassuring interactions as paired', () => {
    const conflicts = detectConflicts(
      [
        { id: 'niacinamide', name: 'Niacinamide 10%', tags: ['niacinamide'] },
        { id: 'vitc', name: 'Vitamin C serum', tags: ['vitamin_c'] },
      ],
      profile,
      STARTER_RULES,
    );
    const reassurance = conflicts.find(isReassuring);
    expect(reassurance).toBeDefined();

    expect(
      pairedProductIdsForResolvedConflicts(
        [reassurance!],
        new Set([conflictKey(reassurance!)]),
      ),
    ).toEqual(new Set());

    const [conflict] = detectConflicts(
      [
        { id: 'retinol', name: 'Retinol 0.3%', tags: ['retinoid'] },
        { id: 'glycolic', name: 'Glycolic 7%', tags: ['aha'] },
      ],
      profile,
      STARTER_RULES,
    );
    const key = conflictKey(conflict!);
    expect(pairedProductIdsForResolvedConflicts([conflict!], new Set([key]), new Set([key]))).toEqual(
      new Set(),
    );
  });
});
