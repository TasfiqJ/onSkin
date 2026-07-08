type RoutinePhase = 'AM' | 'PM';

export function shouldTrackCycleNightCompleted({
  completedBefore,
  completedKey,
  cycleActive,
  phase,
  stepKeys,
  completionDone,
}: {
  completedBefore: ReadonlySet<string>;
  completedKey: string;
  cycleActive: boolean;
  phase: RoutinePhase;
  stepKeys: readonly string[];
  completionDone: boolean;
}): boolean {
  if (!completionDone || phase !== 'PM' || !cycleActive || stepKeys.length === 0) return false;

  const completedAfter = new Set(completedBefore);
  completedAfter.add(completedKey);

  return stepKeys.every((key) => completedAfter.has(key));
}
