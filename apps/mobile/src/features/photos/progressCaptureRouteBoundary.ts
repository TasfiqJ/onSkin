export type ProgressCaptureReviewParams = Readonly<{
  captureSessionId: string;
  capturedUri: string;
  photoHeight: string;
  photoWidth: string;
  takenLocalDate: string;
  timeOfDay: string;
}>;

export type ProtectedProgressCaptureNavigation<Action> =
  | Readonly<{ kind: 'action'; action: Action }>
  | Readonly<{ kind: 'progress' }>
  | Readonly<{ kind: 'review'; params: ProgressCaptureReviewParams }>;

export type ProgressCaptureRawLifecycle = Readonly<{
  discard: () => Promise<void>;
  dispose: () => Promise<void>;
  hasPendingCleanup: () => boolean;
}>;

export type ProgressCaptureRouteBoundarySnapshot = Readonly<{
  cleanupBusy: boolean;
  cleanupFailed: boolean;
  cleanupPending: boolean;
  routeRemovalReady: boolean;
  shutterInFlight: boolean;
}>;

export type ProgressCaptureNavigationHandlers<Action> = Readonly<{
  dispatchAction: (action: Action) => void;
  exitProgress: () => void;
  replaceReview: (params: ProgressCaptureReviewParams) => void;
}>;

export type ProgressCaptureRouteBoundary<Action> = Readonly<{
  adoptRawCapture: (uri: string) => void;
  beginShutter: () => boolean;
  dispatchAuthorizedNavigation: (handlers: ProgressCaptureNavigationHandlers<Action>) => boolean;
  dispose: () => Promise<void>;
  finishShutter: () => void;
  getSnapshot: () => ProgressCaptureRouteBoundarySnapshot;
  handoffToReview: (params: ProgressCaptureReviewParams) => void;
  registerCaptureInvalidator: (invalidate: (() => void) | null) => void;
  requestNavigation: (pending: ProtectedProgressCaptureNavigation<Action>) => void;
  requestProgressExit: () => void;
  retryCleanup: () => Promise<boolean>;
  subscribe: (listener: () => void) => () => void;
}>;

const INITIAL_SNAPSHOT: ProgressCaptureRouteBoundarySnapshot = Object.freeze({
  cleanupBusy: false,
  cleanupFailed: false,
  cleanupPending: false,
  routeRemovalReady: false,
  shutterInFlight: false,
});

/**
 * Route-owned state machine for one Progress capture route. React gates may
 * replace the camera child, but this coordinator continues to own an admitted
 * shutter and its exact raw-file lifecycle until cleanup or review handoff.
 */
export function createProgressCaptureRouteBoundary<Action>(dependencies: {
  createRawCaptureLifecycle: (uri: string) => ProgressCaptureRawLifecycle;
}): ProgressCaptureRouteBoundary<Action> {
  let snapshot = INITIAL_SNAPSHOT;
  let shutterInFlight = false;
  let pendingRawCaptureLifecycle: ProgressCaptureRawLifecycle | null = null;
  let rawCaptureCleanupInFlight: Promise<boolean> | null = null;
  let navigationInFlight = false;
  let pendingNavigation: ProtectedProgressCaptureNavigation<Action> | null = null;
  let invalidateCapture: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const updateSnapshot = (patch: Partial<ProgressCaptureRouteBoundarySnapshot>) => {
    const next = Object.freeze({ ...snapshot, ...patch });
    if (
      next.cleanupBusy === snapshot.cleanupBusy &&
      next.cleanupFailed === snapshot.cleanupFailed &&
      next.cleanupPending === snapshot.cleanupPending &&
      next.routeRemovalReady === snapshot.routeRemovalReady &&
      next.shutterInFlight === snapshot.shutterInFlight
    ) {
      return;
    }
    snapshot = next;
    listeners.forEach((listener) => listener());
  };

  const markRouteRemovalReady = () => {
    updateSnapshot({ routeRemovalReady: true });
  };

  const retryCleanup = (): Promise<boolean> => {
    if (rawCaptureCleanupInFlight !== null) return rawCaptureCleanupInFlight;

    const lifecycle = pendingRawCaptureLifecycle;
    if (lifecycle === null || !lifecycle.hasPendingCleanup()) {
      pendingRawCaptureLifecycle = null;
      updateSnapshot({ cleanupBusy: false, cleanupFailed: false, cleanupPending: false });
      if (pendingNavigation !== null && !shutterInFlight) markRouteRemovalReady();
      return Promise.resolve(true);
    }

    updateSnapshot({ cleanupBusy: true, cleanupPending: true });
    const operation = lifecycle.discard().then(
      () => {
        if (pendingRawCaptureLifecycle === lifecycle) pendingRawCaptureLifecycle = null;
        updateSnapshot({ cleanupFailed: false, cleanupPending: false });
        if (pendingNavigation !== null && !shutterInFlight) markRouteRemovalReady();
        return true;
      },
      () => {
        // Keep this exact lifecycle reachable for a visible idempotent retry.
        if (pendingRawCaptureLifecycle === lifecycle) {
          updateSnapshot({ cleanupFailed: true, cleanupPending: true });
        }
        return false;
      },
    );
    let trackedOperation: Promise<boolean>;
    trackedOperation = operation.finally(() => {
      if (rawCaptureCleanupInFlight === trackedOperation) rawCaptureCleanupInFlight = null;
      updateSnapshot({ cleanupBusy: false });
    });
    rawCaptureCleanupInFlight = trackedOperation;
    return trackedOperation;
  };

  const requestNavigation = (pending: ProtectedProgressCaptureNavigation<Action>) => {
    if (snapshot.routeRemovalReady) return;
    if (navigationInFlight) {
      // Preserve the latest user intent while the same exact cleanup retries.
      pendingNavigation = pending;
      if (pendingRawCaptureLifecycle?.hasPendingCleanup()) void retryCleanup();
      return;
    }

    invalidateCapture?.();
    navigationInFlight = true;
    pendingNavigation = pending;
    if (shutterInFlight && pendingRawCaptureLifecycle === null) return;
    if (pendingRawCaptureLifecycle?.hasPendingCleanup()) {
      void retryCleanup();
      return;
    }
    markRouteRemovalReady();
  };

  const adoptRawCapture = (uri: string) => {
    if (pendingRawCaptureLifecycle?.hasPendingCleanup()) {
      throw new Error('PROGRESS_CAPTURE_CLEANUP_PENDING');
    }
    pendingRawCaptureLifecycle = dependencies.createRawCaptureLifecycle(uri);
    updateSnapshot({ cleanupPending: true });
  };

  const beginShutter = (): boolean => {
    if (
      shutterInFlight ||
      pendingRawCaptureLifecycle?.hasPendingCleanup() ||
      navigationInFlight ||
      snapshot.routeRemovalReady
    ) {
      return false;
    }
    shutterInFlight = true;
    updateSnapshot({ shutterInFlight: true });
    return true;
  };

  const finishShutter = () => {
    shutterInFlight = false;
    updateSnapshot({ shutterInFlight: false });
    if (pendingNavigation === null || snapshot.routeRemovalReady) return;
    if (pendingRawCaptureLifecycle?.hasPendingCleanup()) void retryCleanup();
    else markRouteRemovalReady();
  };

  const handoffToReview = (params: ProgressCaptureReviewParams) => {
    if (!pendingRawCaptureLifecycle?.hasPendingCleanup()) {
      throw new Error('PROGRESS_CAPTURE_SOURCE_MISSING');
    }
    navigationInFlight = true;
    pendingNavigation = { kind: 'review', params };
    markRouteRemovalReady();
  };

  const dispatchAuthorizedNavigation = (
    handlers: ProgressCaptureNavigationHandlers<Action>,
  ): boolean => {
    if (!snapshot.routeRemovalReady || pendingNavigation === null) return false;
    const pending = pendingNavigation;
    pendingNavigation = null;

    if (pending.kind === 'review') {
      const transferredLifecycle = pendingRawCaptureLifecycle;
      pendingRawCaptureLifecycle = null;
      updateSnapshot({ cleanupPending: false });
      try {
        handlers.replaceReview(pending.params);
      } catch {
        pendingRawCaptureLifecycle = transferredLifecycle;
        navigationInFlight = false;
        updateSnapshot({
          cleanupFailed: true,
          cleanupPending: transferredLifecycle?.hasPendingCleanup() ?? false,
          routeRemovalReady: false,
        });
        return false;
      }
      return true;
    }

    try {
      if (pending.kind === 'action') handlers.dispatchAction(pending.action);
      else handlers.exitProgress();
    } catch {
      // The handler may have partially acted, so do not retry it automatically.
      // Return route ownership to the UI and require a fresh navigation intent.
      navigationInFlight = false;
      updateSnapshot({ routeRemovalReady: false });
      return false;
    }
    return true;
  };

  const dispose = async (): Promise<void> => {
    invalidateCapture?.();
    invalidateCapture = null;
    const lifecycle = pendingRawCaptureLifecycle;
    if (lifecycle !== null) await lifecycle.dispose();
  };

  return Object.freeze({
    adoptRawCapture,
    beginShutter,
    dispatchAuthorizedNavigation,
    dispose,
    finishShutter,
    getSnapshot: () => snapshot,
    handoffToReview,
    registerCaptureInvalidator: (invalidate: (() => void) | null) => {
      invalidateCapture = invalidate;
    },
    requestNavigation,
    requestProgressExit: () => requestNavigation({ kind: 'progress' }),
    retryCleanup,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}
