type RoutinePhase = 'AM' | 'PM';

export function shouldTrackCycleNightCompleted({
  completedStepKeysAfter,
  completedKey,
  cycleActive,
  phase,
  stepKeys,
  completionInserted,
}: {
  completedStepKeysAfter: ReadonlySet<string>;
  completedKey: string;
  cycleActive: boolean;
  phase: RoutinePhase;
  stepKeys: readonly string[];
  completionInserted: boolean;
}): boolean {
  if (
    !completionInserted ||
    phase !== 'PM' ||
    !cycleActive ||
    stepKeys.length === 0 ||
    !stepKeys.includes(completedKey)
  ) {
    return false;
  }

  return stepKeys.every((key) => completedStepKeysAfter.has(key));
}
