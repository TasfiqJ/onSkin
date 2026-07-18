import type { DetectedConflict } from '@/features/intelligence/engine';
import { STARTER_RULES, type ConflictRule } from '@/features/intelligence/rules';
import { describe, expect, it } from 'vitest';

import { type GeneratedPlan } from './generate';
import { routineFirstInsightCopy, routineInsightCount } from './firstInsight';

const basePlan: GeneratedPlan = {
  am: [],
  pm: [],
  cycle: null,
  ramp: [],
  safetyExclusions: [],
  cadenceWithheld: [],
  sequencingWithheld: [],
  unplacedProducts: [],
  gaps: [],
  conflicts: [],
};

function plan(overrides: Partial<GeneratedPlan>): GeneratedPlan {
  return { ...basePlan, ...overrides };
}

function ruleFor(interactionType: ConflictRule['interactionType']): ConflictRule {
  const rule = STARTER_RULES.find((candidate) => candidate.interactionType === interactionType);
  if (!rule) throw new Error(`Missing starter rule for ${interactionType}`);
  return rule;
}

function conflict(rule: ConflictRule): DetectedConflict {
  return {
    rule,
    productAId: 'a',
    productBId: 'b',
    productAName: 'Product A',
    productBName: 'Product B',
    computedSeverity: rule.baseSeverity,
  };
}

describe('routine first insight copy', () => {
  it('labels example plans without implying personalized guidance', () => {
    expect(
      routineFirstInsightCopy(
        plan({
          gaps: ['A daily SPF would round this out.'],
          conflicts: [conflict(ruleFor('irritation'))],
        }),
        true,
      ),
    ).toEqual({
      eyebrow: 'First insight',
      title: 'Example only',
      body: 'Add products to see an insight from your own shelf.',
    });
  });

  it('prioritizes actionable timing conflicts over lower-priority insight types', () => {
    expect(
      routineFirstInsightCopy(
        plan({
          gaps: ['A moisturiser would help seal everything in.'],
          conflicts: [conflict(ruleFor('irritation')), conflict(ruleFor('synergy'))],
        }),
        false,
      ),
    ).toMatchObject({
      title: 'Timing handled',
      body: 'Products that need different timing are separated before the first check-off.',
    });
  });

  it('surfaces reassurance without inventing a separation warning', () => {
    expect(
      routineFirstInsightCopy(plan({ conflicts: [conflict(ruleFor('synergy'))] }), false),
    ).toMatchObject({
      title: 'No extra separation',
      body: 'Compatible pairings stay together instead of adding unnecessary rules.',
    });
  });

  it('prioritizes unplaced shelf items before generic gaps or reassurance', () => {
    expect(
      routineFirstInsightCopy(
        plan({
          unplacedProducts: [{ productId: 'unknown', name: 'Mystery drops' }],
          gaps: ['A gentle cleanser would give your routine a clean base.'],
          conflicts: [conflict(ruleFor('synergy'))],
        }),
        false,
      ),
    ).toMatchObject({
      title: 'Product needs details',
      body: 'Mystery drops needs a category or ingredient clue before it can be placed.',
    });
  });

  it('prioritizes applied safety exclusions over ordinary conflicts and gaps', () => {
    expect(
      routineFirstInsightCopy(
        plan({
          safetyExclusions: [{ productId: 'retinoid', name: 'Retinol 0.3%', reason: 'retinoid' }],
          gaps: ['A gentle cleanser would give your routine a clean base.'],
          conflicts: [conflict(ruleFor('irritation'))],
        }),
        false,
      ),
    ).toEqual({
      eyebrow: 'Safety setting applied',
      title: 'Caution products paused',
      body: 'Retinol 0.3% is staying off this routine based on your pregnancy and breastfeeding setting.',
    });
  });

  it('explains when an active is withheld by the clinical cadence gate', () => {
    expect(
      routineFirstInsightCopy(
        plan({
          cadenceWithheld: [{ productId: 'retinoid', name: 'Retinol 0.3%' }],
        }),
        false,
      ),
    ).toEqual({
      eyebrow: 'Routine timing',
      title: 'Active timing not set',
      body: 'Retinol 0.3% does not have reviewed routine timing yet, so it stays off Today for now.',
    });
  });

  it('explains routine withholding without promising a nonexistent manual-placement flow', () => {
    expect(
      routineFirstInsightCopy(
        plan({
          sequencingWithheld: [
            {
              productId: 'cleanser',
              name: 'Cream cleanser',
              role: 'cleanser',
              placement: 'withheld',
              reason: 'review_required',
            },
          ],
        }),
        false,
      ),
    ).toEqual({
      eyebrow: 'Application order',
      title: 'Automatic order not set',
      body: 'Cream cleanser does not have reviewed application-order guidance yet, so it stays on your shelf but out of your routine and Today for now. No use instructions are added.',
    });
  });

  it('keeps missing categories visible instead of filling the plan with fake products', () => {
    expect(
      routineFirstInsightCopy(
        plan({ gaps: ['A gentle cleanser would give your routine a clean base.'] }),
        false,
      ),
    ).toMatchObject({
      title: 'Missing step flagged',
      body: 'Useful gaps stay visible instead of being filled with products you do not own.',
    });
  });

  it('uses cadence as the first insight when there are no conflicts or gaps', () => {
    expect(
      routineFirstInsightCopy(
        plan({ cycle: { id: 'gentle_5' } as NonNullable<GeneratedPlan['cycle']> }),
        false,
      ),
    ).toMatchObject({
      title: 'Active nights spaced out',
      body: 'Recovery nights are built into the plan before Today starts.',
    });
  });

  it('falls back to a simple start-ready insight', () => {
    expect(routineFirstInsightCopy(basePlan, false)).toMatchObject({
      title: 'Shelf is enough to start',
      body: 'Your current products become a simple AM and PM order.',
    });
  });

  it('counts visible insight signals consistently for analytics', () => {
    expect(
      routineInsightCount(
        plan({
          gaps: ['A gentle cleanser would give your routine a clean base.'],
          unplacedProducts: [{ productId: 'unknown', name: 'Mystery drops' }],
          sequencingWithheld: [
            {
              productId: 'cleanser',
              name: 'Cream cleanser',
              role: 'cleanser',
              placement: 'withheld',
              reason: 'review_required',
            },
          ],
          conflicts: [conflict(ruleFor('irritation')), conflict(ruleFor('synergy'))],
        }),
      ),
    ).toBe(6);
  });
});
