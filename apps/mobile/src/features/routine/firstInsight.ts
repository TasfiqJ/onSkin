import { isReassuring } from '@/features/intelligence/engine';

import type { GeneratedPlan } from './generate';

export type RoutineFirstInsightCopy = {
  eyebrow: string;
  title: string;
  body: string;
};

export function routineFirstInsightCopy(
  plan: GeneratedPlan,
  isExample: boolean,
): RoutineFirstInsightCopy {
  if (isExample) {
    return {
      eyebrow: 'First insight',
      title: 'Example only',
      body: 'Add products to see an insight from your own shelf.',
    };
  }

  const actionableConflictCount = plan.conflicts.filter((conflict) => !isReassuring(conflict))
    .length;
  if (actionableConflictCount > 0) {
    return {
      eyebrow: 'First insight',
      title: 'Timing handled',
      body: 'Products that need different timing are separated before the first check-off.',
    };
  }

  if (plan.unplacedProducts.length > 0) {
    const firstName = plan.unplacedProducts[0]?.name ?? 'One shelf item';
    return {
      eyebrow: 'First insight',
      title: 'Product needs details',
      body:
        plan.unplacedProducts.length === 1
          ? `${firstName} needs a category or ingredient clue before it can be placed.`
          : `${firstName} and ${plan.unplacedProducts.length - 1} more shelf item${
              plan.unplacedProducts.length === 2 ? '' : 's'
            } need categories or ingredient clues before they can be placed.`,
    };
  }

  const reassuringCount = plan.conflicts.length - actionableConflictCount;
  if (reassuringCount > 0) {
    return {
      eyebrow: 'First insight',
      title: 'No extra separation',
      body: 'Compatible pairings stay together instead of adding unnecessary rules.',
    };
  }

  if (plan.gaps.length > 0) {
    return {
      eyebrow: 'First insight',
      title: 'Missing step flagged',
      body: 'Useful gaps stay visible instead of being filled with products you do not own.',
    };
  }

  if (plan.cycle) {
    return {
      eyebrow: 'First insight',
      title: 'Active nights spaced out',
      body: 'Recovery nights are built into the plan before Today starts.',
    };
  }

  return {
    eyebrow: 'First insight',
    title: 'Shelf is enough to start',
    body: 'Your current products become a simple AM and PM order.',
  };
}
