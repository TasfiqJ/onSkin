import { describe, expect, it, vi } from 'vitest';

import {
  createProgressCaptureRouteBoundary,
  type ProgressCaptureNavigationHandlers,
  type ProgressCaptureRawLifecycle,
  type ProgressCaptureReviewParams,
} from './progressCaptureRouteBoundary';

type TestAction = Readonly<{ type: string }>;

const REVIEW_PARAMS: ProgressCaptureReviewParams = Object.freeze({
  captureSessionId: '123e4567-e89b-42d3-a456-426614174000',
  capturedUri: 'file:///cache/Camera/00000000-0000-4000-8000-000000000001.jpg',
  photoHeight: '1200',
  photoWidth: '900',
  takenLocalDate: '2026-07-19',
  timeOfDay: 'morning',
});

function navigationHandlers(): ProgressCaptureNavigationHandlers<TestAction> & {
  dispatchAction: ReturnType<typeof vi.fn<(action: TestAction) => void>>;
  exitProgress: ReturnType<typeof vi.fn<() => void>>;
  replaceReview: ReturnType<typeof vi.fn<(params: ProgressCaptureReviewParams) => void>>;
} {
  return {
    dispatchAction: vi.fn<(action: TestAction) => void>(),
    exitProgress: vi.fn<() => void>(),
    replaceReview: vi.fn<(params: ProgressCaptureReviewParams) => void>(),
  };
}

function lifecycleWithDeleteAttempts(failures: number) {
  let pending = true;
  let attempts = 0;
  const lifecycle: ProgressCaptureRawLifecycle = {
    discard: vi.fn(async () => {
      attempts += 1;
      if (attempts <= failures) throw new Error('DELETE_FAILED');
      pending = false;
    }),
    dispose: vi.fn(async () => {
      pending = false;
    }),
    hasPendingCleanup: () => pending,
  };
  return lifecycle;
}

describe('Progress capture route boundary', () => {
  it('admits only one shutter until the first shutter finishes', () => {
    const coordinator = createProgressCaptureRouteBoundary<TestAction>({
      createRawCaptureLifecycle: () => lifecycleWithDeleteAttempts(0),
    });

    expect(coordinator.beginShutter()).toBe(true);
    expect(coordinator.beginShutter()).toBe(false);
    expect(coordinator.getSnapshot().shutterInFlight).toBe(true);

    coordinator.finishShutter();
    expect(coordinator.beginShutter()).toBe(true);
  });

  it('blocks a back removal while the shutter is pending, invalidates capture, then dispatches once', () => {
    const coordinator = createProgressCaptureRouteBoundary<TestAction>({
      createRawCaptureLifecycle: () => lifecycleWithDeleteAttempts(0),
    });
    const handlers = navigationHandlers();
    const invalidateCapture = vi.fn();
    const backAction = Object.freeze({ type: 'GO_BACK' });
    coordinator.registerCaptureInvalidator(invalidateCapture);

    expect(coordinator.beginShutter()).toBe(true);
    coordinator.requestNavigation({ kind: 'action', action: backAction });

    expect(invalidateCapture).toHaveBeenCalledOnce();
    expect(coordinator.getSnapshot()).toMatchObject({
      routeRemovalReady: false,
      shutterInFlight: true,
    });
    expect(coordinator.dispatchAuthorizedNavigation(handlers)).toBe(false);
    expect(handlers.dispatchAction).not.toHaveBeenCalled();

    coordinator.finishShutter();
    expect(coordinator.getSnapshot().routeRemovalReady).toBe(true);
    expect(coordinator.dispatchAuthorizedNavigation(handlers)).toBe(true);
    expect(handlers.dispatchAction).toHaveBeenCalledOnce();
    expect(handlers.dispatchAction).toHaveBeenCalledWith(backAction);
    expect(coordinator.dispatchAuthorizedNavigation(handlers)).toBe(false);
    expect(handlers.dispatchAction).toHaveBeenCalledOnce();
  });

  it('retains a failed raw deletion, blocks navigation, then releases to the latest intent once', async () => {
    const lifecycle = lifecycleWithDeleteAttempts(1);
    const coordinator = createProgressCaptureRouteBoundary<TestAction>({
      createRawCaptureLifecycle: () => lifecycle,
    });
    const handlers = navigationHandlers();
    const invalidateCapture = vi.fn();
    const firstAction = Object.freeze({ type: 'GO_BACK' });
    const latestAction = Object.freeze({ type: 'POP_TO_TOP' });
    coordinator.registerCaptureInvalidator(invalidateCapture);
    coordinator.adoptRawCapture(REVIEW_PARAMS.capturedUri);

    coordinator.requestNavigation({ kind: 'action', action: firstAction });
    coordinator.requestNavigation({ kind: 'action', action: latestAction });
    await expect(coordinator.retryCleanup()).resolves.toBe(false);

    expect(invalidateCapture).toHaveBeenCalledOnce();
    expect(lifecycle.discard).toHaveBeenCalledOnce();
    expect(lifecycle.hasPendingCleanup()).toBe(true);
    expect(coordinator.getSnapshot()).toMatchObject({
      cleanupBusy: false,
      cleanupFailed: true,
      cleanupPending: true,
      routeRemovalReady: false,
    });
    expect(coordinator.beginShutter()).toBe(false);
    expect(coordinator.dispatchAuthorizedNavigation(handlers)).toBe(false);
    expect(handlers.dispatchAction).not.toHaveBeenCalled();

    await expect(coordinator.retryCleanup()).resolves.toBe(true);
    expect(lifecycle.discard).toHaveBeenCalledTimes(2);
    expect(lifecycle.hasPendingCleanup()).toBe(false);
    expect(coordinator.getSnapshot()).toMatchObject({
      cleanupFailed: false,
      cleanupPending: false,
      routeRemovalReady: true,
    });
    expect(coordinator.dispatchAuthorizedNavigation(handlers)).toBe(true);
    expect(handlers.dispatchAction).toHaveBeenCalledOnce();
    expect(handlers.dispatchAction).toHaveBeenCalledWith(latestAction);
    expect(coordinator.dispatchAuthorizedNavigation(handlers)).toBe(false);
    expect(handlers.dispatchAction).toHaveBeenCalledOnce();
  });

  it('transfers a review handoff exactly once without deleting or disposing its raw source', async () => {
    const lifecycle = lifecycleWithDeleteAttempts(0);
    const coordinator = createProgressCaptureRouteBoundary<TestAction>({
      createRawCaptureLifecycle: () => lifecycle,
    });
    const handlers = navigationHandlers();

    expect(coordinator.beginShutter()).toBe(true);
    coordinator.adoptRawCapture(REVIEW_PARAMS.capturedUri);
    coordinator.handoffToReview(REVIEW_PARAMS);

    expect(coordinator.getSnapshot().routeRemovalReady).toBe(true);
    expect(coordinator.dispatchAuthorizedNavigation(handlers)).toBe(true);
    expect(handlers.replaceReview).toHaveBeenCalledOnce();
    expect(handlers.replaceReview).toHaveBeenCalledWith(REVIEW_PARAMS);
    expect(lifecycle.discard).not.toHaveBeenCalled();
    expect(coordinator.getSnapshot().cleanupPending).toBe(false);

    coordinator.finishShutter();
    expect(coordinator.dispatchAuthorizedNavigation(handlers)).toBe(false);
    await coordinator.dispose();
    expect(handlers.replaceReview).toHaveBeenCalledOnce();
    expect(lifecycle.discard).not.toHaveBeenCalled();
    expect(lifecycle.dispose).not.toHaveBeenCalled();
  });

  it('releases a reserved review session when review navigation throws', () => {
    const lifecycle = lifecycleWithDeleteAttempts(0);
    const onReviewHandoffAborted = vi.fn();
    const coordinator = createProgressCaptureRouteBoundary<TestAction>({
      createRawCaptureLifecycle: () => lifecycle,
      onReviewHandoffAborted,
    });
    const handlers = navigationHandlers();
    handlers.replaceReview.mockImplementationOnce(() => {
      throw new Error('REVIEW_NAVIGATION_FAILED');
    });

    coordinator.adoptRawCapture(REVIEW_PARAMS.capturedUri);
    coordinator.handoffToReview(REVIEW_PARAMS);

    expect(coordinator.dispatchAuthorizedNavigation(handlers)).toBe(false);
    expect(onReviewHandoffAborted).toHaveBeenCalledOnce();
    expect(onReviewHandoffAborted).toHaveBeenCalledWith(REVIEW_PARAMS.captureSessionId);
    expect(coordinator.getSnapshot()).toMatchObject({
      cleanupFailed: true,
      cleanupPending: true,
      routeRemovalReady: false,
    });
  });

  it('hands failed forced-unmount raw cleanup to the process owner', async () => {
    const lifecycle: ProgressCaptureRawLifecycle = {
      discard: vi.fn(async () => undefined),
      dispose: vi.fn(async () => {
        throw new Error('RAW_CLEANUP_FAILED');
      }),
      hasPendingCleanup: () => true,
    };
    const retainFailedCleanup = vi.fn();
    const coordinator = createProgressCaptureRouteBoundary<TestAction>({
      createRawCaptureLifecycle: () => lifecycle,
      retainFailedCleanup,
    });

    coordinator.adoptRawCapture(REVIEW_PARAMS.capturedUri);

    await expect(coordinator.dispose()).rejects.toThrow('RAW_CLEANUP_FAILED');
    expect(retainFailedCleanup).toHaveBeenCalledOnce();
    expect(retainFailedCleanup).toHaveBeenCalledWith(lifecycle);
  });

  it('returns route ownership after a non-review navigation handler throws', () => {
    const coordinator = createProgressCaptureRouteBoundary<TestAction>({
      createRawCaptureLifecycle: () => lifecycleWithDeleteAttempts(0),
    });
    const handlers = navigationHandlers();
    const firstAction = Object.freeze({ type: 'GO_BACK' });
    const freshAction = Object.freeze({ type: 'POP_TO_TOP' });
    handlers.dispatchAction.mockImplementationOnce(() => {
      throw new Error('NAVIGATION_FAILED');
    });

    coordinator.requestNavigation({ kind: 'action', action: firstAction });
    expect(coordinator.getSnapshot().routeRemovalReady).toBe(true);
    expect(coordinator.dispatchAuthorizedNavigation(handlers)).toBe(false);
    expect(handlers.dispatchAction).toHaveBeenCalledOnce();
    expect(coordinator.getSnapshot().routeRemovalReady).toBe(false);

    coordinator.requestNavigation({ kind: 'action', action: freshAction });
    expect(coordinator.getSnapshot().routeRemovalReady).toBe(true);
    expect(coordinator.dispatchAuthorizedNavigation(handlers)).toBe(true);
    expect(handlers.dispatchAction).toHaveBeenCalledTimes(2);
    expect(handlers.dispatchAction).toHaveBeenLastCalledWith(freshAction);
    expect(coordinator.dispatchAuthorizedNavigation(handlers)).toBe(false);
  });

  it('keeps route-owned shutter and raw state while a replacing gate swaps child invalidators', async () => {
    const lifecycle = lifecycleWithDeleteAttempts(0);
    const coordinator = createProgressCaptureRouteBoundary<TestAction>({
      createRawCaptureLifecycle: () => lifecycle,
    });
    const firstChildInvalidator = vi.fn();
    const replacementChildInvalidator = vi.fn();
    const handlers = navigationHandlers();

    coordinator.registerCaptureInvalidator(firstChildInvalidator);
    expect(coordinator.beginShutter()).toBe(true);
    coordinator.registerCaptureInvalidator(null);
    coordinator.adoptRawCapture(REVIEW_PARAMS.capturedUri);
    expect(coordinator.getSnapshot()).toMatchObject({
      cleanupPending: true,
      shutterInFlight: true,
    });

    coordinator.registerCaptureInvalidator(replacementChildInvalidator);
    coordinator.requestProgressExit();
    coordinator.finishShutter();
    await expect(coordinator.retryCleanup()).resolves.toBe(true);

    expect(firstChildInvalidator).not.toHaveBeenCalled();
    expect(replacementChildInvalidator).toHaveBeenCalledOnce();
    expect(lifecycle.discard).toHaveBeenCalledOnce();
    expect(coordinator.getSnapshot().routeRemovalReady).toBe(true);
    expect(coordinator.dispatchAuthorizedNavigation(handlers)).toBe(true);
    expect(handlers.exitProgress).toHaveBeenCalledOnce();
  });
});
