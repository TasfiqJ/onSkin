type RoutinePhase = 'AM' | 'PM';

export type CycleNightCompletionCandidate = {
  completedAfter: ReadonlySet<string>;
  cycleActive: boolean;
  phase: RoutinePhase;
  stepKeys: readonly string[];
  changed: boolean;
};

export function shouldTrackCycleNightCompleted({
  completedAfter,
  cycleActive,
  phase,
  stepKeys,
  changed,
}: CycleNightCompletionCandidate): boolean {
  if (!changed || phase !== 'PM' || !cycleActive || stepKeys.length === 0) return false;

  return stepKeys.every((key) => completedAfter.has(key));
}
