export type SessionBoundaryQueueRecord = Readonly<{
  effectEpoch: number;
  promise: Promise<void>;
  targetUserId: string | null;
}>;

export type SessionBoundaryQueueState = {
  inFlight: SessionBoundaryQueueRecord | null;
  sequence: number;
};

export type SessionBoundaryQueueContext = Readonly<{
  isCurrent: () => boolean;
  sequence: number;
}>;

export function createSessionBoundaryQueueState(): SessionBoundaryQueueState {
  return { inFlight: null, sequence: 0 };
}

export function enqueueSessionBoundaryOperation(
  state: SessionBoundaryQueueState,
  options: Readonly<{
    effectEpoch: number;
    forceQueue?: boolean;
    onQueued: (sequence: number) => void;
    resumeAfterInherited: () => Promise<void>;
    run: (context: SessionBoundaryQueueContext) => Promise<void>;
    targetUserId: string | null;
  }>,
): Promise<void> {
  const existing = state.inFlight;
  if (!options.forceQueue && existing?.targetUserId === options.targetUserId) {
    if (existing.effectEpoch === options.effectEpoch) return existing.promise;
    return existing.promise.then(options.resumeAfterInherited);
  }

  const sequence = ++state.sequence;
  options.onQueued(sequence);
  const previous = existing?.promise;
  const promise = (async () => {
    if (previous) await previous;
    await options.run({
      isCurrent: () => state.sequence === sequence,
      sequence,
    });
  })();

  state.inFlight = {
    effectEpoch: options.effectEpoch,
    promise,
    targetUserId: options.targetUserId,
  };
  const clearIfCurrent = () => {
    if (state.inFlight?.promise === promise) state.inFlight = null;
  };
  void promise.then(clearIfCurrent, clearIfCurrent);
  return promise;
}
