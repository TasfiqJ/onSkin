import type { GeneratedPlan, PlanStep } from '@/features/routine/generate';
import type { SchedulerSlot } from '@/features/scheduler/orchestrate';
import type { CycleData } from '@/features/scheduler/useCycle';

export type TodayPlanSource = {
  plan: GeneratedPlan;
  isExample: boolean;
};

export type TodayCycleSource = Pick<
  CycleData,
  | 'cycle'
  | 'tonight'
  | 'weekAhead'
  | 'nextAcidNight'
  | 'recovery'
  | 'paused'
  | 'skippedTonight'
  | 'stagedActiveIds'
  | 'conflictChoices'
>;

export type TodayRoutineStep = Omit<PlanStep, 'role'> & {
  /** A reconciled custom-cycle step can lack a matching generated-plan role. */
  role?: PlanStep['role'];
};

export type TodayRoutinePhaseProjection = {
  steps: TodayRoutineStep[];
  stepKeys: string[];
  completedCount: number;
  firstUndoneKey: string | null;
};

export type TodayRoutineProjection = {
  source: 'unavailable' | 'example' | 'real';
  hasExamplePlan: boolean;
  hasRealRoutine: boolean;
  safetyExclusionCount: number;
  cadenceWithheldCount: number;
  sequencingWithheldCount: number;
  am: TodayRoutinePhaseProjection;
  pm: TodayRoutinePhaseProjection;
  cycle: TodayCycleSource['cycle'];
  tonight: TodayCycleSource['tonight'];
  cycleStripNights: TodayCycleSource['weekAhead'][number]['night'][];
  tonightSlot: SchedulerSlot | null;
  nightNumber: number;
  nightTotal: number;
  skippedTonight: boolean;
  recoveryActive: boolean;
  paused: boolean;
  cycleActive: boolean;
  hasScheduledRetinoid: boolean;
  suppressedAcidName: string | null;
  nextAcidISO: string | null;
};

type ProjectTodayRoutineInput = {
  planData?: TodayPlanSource | null;
  cycleData?: TodayCycleSource | null;
  completedStepKeys?: ReadonlySet<string>;
};

const EMPTY_COMPLETED_STEP_KEYS: ReadonlySet<string> = new Set();

/**
 * The phase-scoped key is intentionally identical to completionsStore.stepKey.
 * Keeping this tiny formatter in the pure projection avoids importing storage,
 * consent, or account modules into widget timeline generation.
 */
export function todayRoutineStepKey(phase: 'AM' | 'PM', productId: string): string {
  return `${phase}:${productId}`;
}

function hasUseTogetherChoiceBetween(
  choices: TodayCycleSource['conflictChoices'],
  productAId: string | null | undefined,
  productBId: string | null | undefined,
): boolean {
  if (!productAId || !productBId || productAId === productBId) return false;
  return choices.some(
    (record) =>
      record.choice === 'use_together' &&
      record.resolutionType === 'alternate_nights' &&
      record.productIds.includes(productAId) &&
      record.productIds.includes(productBId),
  );
}

function projectPhase(
  phase: 'AM' | 'PM',
  steps: TodayRoutineStep[],
  completedStepKeys: ReadonlySet<string>,
): TodayRoutinePhaseProjection {
  const stepKeys = steps.map((step) => todayRoutineStepKey(phase, step.productId));
  return {
    steps,
    stepKeys,
    completedCount: stepKeys.filter((key) => completedStepKeys.has(key)).length,
    firstUndoneKey: stepKeys.find((key) => !completedStepKeys.has(key)) ?? null,
  };
}

/**
 * Produces the single canonical Today checklist for both the in-app surface and
 * native glance surfaces. It is deliberately pure and fail-closed: example
 * plans never leave the design-only usePlan fallback, while pause, skip,
 * recovery, staging, cadence, and profile-safety rules all suppress cycled
 * actives before a step can be published.
 */
export function projectTodayRoutine({
  planData,
  cycleData,
  completedStepKeys = EMPTY_COMPLETED_STEP_KEYS,
}: ProjectTodayRoutineInput): TodayRoutineProjection {
  const hasExamplePlan = planData?.isExample === true;
  const hasRealRoutine = Boolean(planData && !planData.isExample);
  const plan = hasRealRoutine ? planData?.plan : undefined;
  const safetyExcludedIds = new Set(
    plan?.safetyExclusions.map((exclusion) => exclusion.productId) ?? [],
  );
  const safetyExclusionCount = plan?.safetyExclusions.length ?? 0;
  const cadenceWithheldCount = plan?.cadenceWithheld.length ?? 0;
  const sequencingWithheldCount = plan?.sequencingWithheld.length ?? 0;

  const rawCycle = hasRealRoutine ? (cycleData?.cycle ?? null) : null;
  const amPlanIds = new Set(plan?.am.map((step) => step.productId) ?? []);
  const pmPlanIds = new Set(plan?.pm.map((step) => step.productId) ?? []);
  const cycleMatchesReviewedPlan = Boolean(
    rawCycle &&
    rawCycle.amDaily.every((item) => amPlanIds.has(item.productId)) &&
    rawCycle.nights.every((night) => !night.productId || pmPlanIds.has(night.productId)),
  );
  const cycle = cycleMatchesReviewedPlan ? rawCycle : null;
  const tonight = cycle ? (cycleData?.tonight ?? null) : null;
  const skippedTonight = cycleData?.skippedTonight ?? false;
  const recoveryActive = cycleData?.recovery.active ?? false;
  const paused = cycleData?.paused ?? false;
  const tonightSlot = tonight?.night.slot ?? null;
  const stagedActiveIds = new Set(cycleData?.stagedActiveIds ?? []);

  const amSteps = (plan?.am ?? []).filter((step) => !safetyExcludedIds.has(step.productId));
  const scheduledCyclePlanStep = tonight?.night.productId
    ? plan?.pm.find((step) => step.productId === tonight.night.productId)
    : undefined;
  const cycledStep: TodayRoutineStep | null =
    !skippedTonight &&
    !recoveryActive &&
    !paused &&
    tonight?.night.productId &&
    scheduledCyclePlanStep &&
    !stagedActiveIds.has(tonight.night.productId) &&
    !safetyExcludedIds.has(tonight.night.productId)
      ? {
          productId: tonight.night.productId,
          name: scheduledCyclePlanStep.name,
          instruction: scheduledCyclePlanStep.instruction,
          cadence: 'cycle',
          order: scheduledCyclePlanStep.order,
          role: scheduledCyclePlanStep.role,
        }
      : null;
  const dailyPm = (plan?.pm ?? []).filter(
    (step) => step.cadence !== 'cycle' && !safetyExcludedIds.has(step.productId),
  );
  const pmSteps = [...dailyPm, ...(cycledStep ? [cycledStep] : [])].sort(
    (a, b) => a.order - b.order,
  );
  const hasScheduledRetinoid = cycledStep?.role === 'treatment';
  const suppressedAcidName =
    hasScheduledRetinoid && tonightSlot === 'retinoid' && cycle
      ? (cycle.nights.find(
          (night) =>
            night.slot === 'exfoliate' &&
            !hasUseTogetherChoiceBetween(
              cycleData?.conflictChoices ?? [],
              tonight?.night.productId,
              night.productId,
            ),
        )?.productName ?? null)
      : null;

  return {
    source: hasExamplePlan ? 'example' : hasRealRoutine ? 'real' : 'unavailable',
    hasExamplePlan,
    hasRealRoutine,
    safetyExclusionCount,
    cadenceWithheldCount,
    sequencingWithheldCount,
    am: projectPhase('AM', amSteps, completedStepKeys),
    pm: projectPhase('PM', pmSteps, completedStepKeys),
    cycle,
    tonight,
    cycleStripNights: cycle ? (cycleData?.weekAhead.map((projected) => projected.night) ?? []) : [],
    tonightSlot,
    nightNumber: tonight ? tonight.index + 1 : 0,
    nightTotal: cycle?.lengthNights ?? 0,
    skippedTonight,
    recoveryActive,
    paused,
    cycleActive: cycledStep != null,
    hasScheduledRetinoid,
    suppressedAcidName,
    nextAcidISO: cycle ? (cycleData?.nextAcidNight ?? null) : null,
  };
}
