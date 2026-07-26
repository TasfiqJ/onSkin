import { isReassuring } from '@/features/intelligence/engine';

import type { GeneratedPlan } from './generate';

export type RoutineFirstInsightCopy = {
  eyebrow: string;
  title: string;
  body: string;
};

export function routineInsightCount(plan: GeneratedPlan): number {
  return (
    plan.conflicts.length +
    plan.gaps.length +
    plan.unplacedProducts.length +
    plan.safetyExclusions.length +
    plan.cadenceWithheld.length +
    plan.sequencingWithheld.length +
    1
  );
}

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

  if (plan.safetyExclusions.length > 0) {
    const firstName = plan.safetyExclusions[0]?.name ?? 'One product';
    const remaining = plan.safetyExclusions.length - 1;
    return {
      eyebrow: 'Safety setting applied',
      title: 'Caution products paused',
      body:
        remaining === 0
          ? `${firstName} is staying off this routine based on your pregnancy and breastfeeding setting.`
          : `${firstName} and ${remaining} more product${remaining === 1 ? '' : 's'} are staying off this routine based on your pregnancy and breastfeeding setting.`,
    };
  }

  if (plan.cadenceWithheld.length > 0) {
    const firstName = plan.cadenceWithheld[0]?.name ?? 'One active';
    const remaining = plan.cadenceWithheld.length - 1;
    return {
      eyebrow: 'Routine timing',
      title: 'Active timing not set',
      body:
        remaining === 0
          ? `${firstName} does not have reviewed routine timing yet, so it stays off Today for now.`
          : `${firstName} and ${remaining} more active${
              remaining === 1 ? '' : 's'
            } do not have reviewed routine timing yet, so they stay off Today for now.`,
    };
  }

  if (plan.sequencingWithheld.length > 0) {
    const firstName = plan.sequencingWithheld[0]?.name ?? 'One product';
    const remaining = plan.sequencingWithheld.length - 1;
    return {
      eyebrow: 'Application order',
      title: 'Automatic order not set',
      body:
        remaining === 0
          ? `${firstName} does not have reviewed application-order guidance yet, so it stays on your shelf but out of your routine and Today for now. No use instructions are added.`
          : `${firstName} and ${remaining} more product${
              remaining === 1 ? '' : 's'
            } do not have reviewed application-order guidance yet, so they stay on your shelf but out of your routine and Today for now. No use instructions are added.`,
    };
  }

  if (
    plan.conflictCoverageStatus === 'unsupported_unreviewed' &&
    plan.unsupportedConflictPairs.length > 0
  ) {
    return {
      eyebrow: 'Interaction checking',
      title: 'Pair review in progress',
      body: "We won't show a compatibility result for these products until that review is complete.",
    };
  }

  const actionableConflictCount = plan.conflicts.filter(
    (conflict) => !isReassuring(conflict),
  ).length;
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
