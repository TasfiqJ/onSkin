type RemoveSubscription = { remove: () => void };

export type LocalDateBoundarySnapshot = {
  localDate: string;
  timeZone: string;
  millisecondsUntilNextDay: number;
};

export type LocalDateBoundaryDependencies = {
  appState: {
    currentState: string | null;
    addEventListener: (event: 'change', listener: (state: string) => void) => RemoveSubscription;
  };
  clearTimer: (handle: unknown) => void;
  invalidate: () => void | Promise<unknown>;
  publishSnapshot: (snapshot: LocalDateBoundarySnapshot) => void;
  readSnapshot: () => LocalDateBoundarySnapshot;
  setTimer: (callback: () => void, delayMs: number) => unknown;
};

export type LocalDateBoundaryConfiguration = 'configured' | 'already-configured';

const SNAPSHOT_RETRY_MS = 60_000;
const MAX_BOUNDARY_DELAY_MS = 26 * 60 * 60 * 1_000;

function boundedDelay(delayMs: number): number {
  if (!Number.isFinite(delayMs)) return SNAPSHOT_RETRY_MS;
  return Math.min(MAX_BOUNDARY_DELAY_MS, Math.max(1_000, Math.round(delayMs)));
}

function snapshotChanged(
  previous: LocalDateBoundarySnapshot,
  next: LocalDateBoundarySnapshot,
): boolean {
  return previous.localDate !== next.localDate || previous.timeZone !== next.timeZone;
}

export function createLocalDateBoundaryCoordinator(deps: LocalDateBoundaryDependencies): {
  configure: () => LocalDateBoundaryConfiguration;
  dispose: () => void;
  reconcile: () => void;
} {
  let configured = false;
  let disposed = false;
  let lastSnapshot: LocalDateBoundarySnapshot | null = null;
  let timer: unknown = null;
  let subscription: RemoveSubscription | null = null;
  let active = deps.appState.currentState === 'active';
  let invalidationPending = false;
  let invalidationInFlight: Promise<void> | null = null;

  const clearScheduledTimer = () => {
    if (timer === null) return;
    deps.clearTimer(timer);
    timer = null;
  };

  const schedule = (delayMs: number) => {
    clearScheduledTimer();
    if (disposed || !active) return;
    timer = deps.setTimer(() => {
      timer = null;
      if (disposed || !active) return;
      evaluate();
    }, boundedDelay(delayMs));
  };

  const publishInvalidation = () => {
    if (disposed || !invalidationPending || invalidationInFlight !== null) return;

    invalidationPending = false;
    let resolveInvalidation!: () => void;
    const operation = new Promise<void>((resolve) => {
      resolveInvalidation = resolve;
    });
    invalidationInFlight = operation;
    let failed = false;

    try {
      void Promise.resolve(deps.invalidate()).then(
        () => resolveInvalidation(),
        () => {
          failed = true;
          invalidationPending = true;
          resolveInvalidation();
        },
      );
    } catch {
      failed = true;
      invalidationPending = true;
      resolveInvalidation();
    }

    void operation.then(() => {
      if (invalidationInFlight === operation) invalidationInFlight = null;
      if (disposed) return;
      if (failed) schedule(SNAPSHOT_RETRY_MS);
      else publishInvalidation();
    });
  };

  function evaluate(): void {
    if (disposed) return;
    let next: LocalDateBoundarySnapshot;
    try {
      next = deps.readSnapshot();
    } catch {
      schedule(SNAPSHOT_RETRY_MS);
      return;
    }

    const firstSnapshot = lastSnapshot === null;
    const changed = lastSnapshot !== null && snapshotChanged(lastSnapshot, next);
    lastSnapshot = next;
    if (firstSnapshot || changed) deps.publishSnapshot(next);
    if (changed) invalidationPending = true;
    schedule(next.millisecondsUntilNextDay);
    publishInvalidation();
  }

  return {
    configure() {
      if (configured) return 'already-configured';
      configured = true;
      disposed = false;
      active = deps.appState.currentState === 'active';
      evaluate();
      try {
        subscription = deps.appState.addEventListener('change', (state) => {
          active = state === 'active';
          if (active) evaluate();
          else clearScheduledTimer();
        });
      } catch {
        // App-state events are an optimization; an active midnight timer still evaluates safely.
      }
      return 'configured';
    },

    dispose() {
      disposed = true;
      clearScheduledTimer();
      subscription?.remove();
      subscription = null;
    },

    reconcile() {
      if (active) evaluate();
    },
  };
}

const OFFSET_PROBE_MS = 30 * 60 * 1_000;
const OFFSET_HORIZON_MS = 26 * 60 * 60 * 1_000;
const OFFSET_PRECISION_MS = 1_000;

/** Find the next DST/UTC-offset transition without a foreground polling loop. */
export function millisecondsUntilNextTimeZoneOffsetChange(
  now: Date,
  readOffset: (at: Date) => number = (at) => at.getTimezoneOffset(),
): number | null {
  const start = now.getTime();
  const initialOffset = readOffset(now);
  let previousElapsed = 0;

  for (let elapsed = OFFSET_PROBE_MS; elapsed <= OFFSET_HORIZON_MS; elapsed += OFFSET_PROBE_MS) {
    if (readOffset(new Date(start + elapsed)) === initialOffset) {
      previousElapsed = elapsed;
      continue;
    }

    let low = previousElapsed;
    let high = elapsed;
    while (high - low > OFFSET_PRECISION_MS) {
      const middle = Math.floor((low + high) / 2);
      if (readOffset(new Date(start + middle)) === initialOffset) low = middle;
      else high = middle;
    }
    return Math.max(1_000, high + 25);
  }
  return null;
}

function localDateText(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localTimeZone(now: Date): string {
  let zone = 'local';
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone || zone;
  } catch {
    // The UTC offset below still detects travel and daylight-saving transitions.
  }
  return `${zone}|offset:${now.getTimezoneOffset()}`;
}

/** Cheap identity read for render-time coherence checks; it does not probe the
 * next DST transition or allocate a boundary timer deadline. */
export function readLocalDateBoundaryIdentity(
  now = new Date(),
): Pick<LocalDateBoundarySnapshot, 'localDate' | 'timeZone'> {
  return {
    localDate: localDateText(now),
    timeZone: localTimeZone(now),
  };
}

export function readLocalDateBoundarySnapshot(now = new Date()): LocalDateBoundarySnapshot {
  const nextDay = new Date(now);
  nextDay.setHours(24, 0, 0, 25);
  const untilNextDay = Math.max(1_000, nextDay.getTime() - now.getTime());
  const untilOffsetChange = millisecondsUntilNextTimeZoneOffsetChange(now);
  const identity = readLocalDateBoundaryIdentity(now);
  return {
    ...identity,
    millisecondsUntilNextDay:
      untilOffsetChange === null ? untilNextDay : Math.min(untilNextDay, untilOffsetChange),
  };
}
