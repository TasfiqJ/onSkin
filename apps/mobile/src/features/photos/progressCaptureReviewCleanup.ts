import type { ProgressCaptureReviewLifecycle } from './progressCapturePrivacy';

type DisposableReviewLifecycle = Pick<ProgressCaptureReviewLifecycle, 'dispose'>;

/**
 * Process-owned fallback for gate/account forced unmounts. The route guard
 * cannot remain mounted in that case, so failed cleanup must outlive React.
 */
export function createProgressReviewCleanupOwner() {
  const pending = new Set<DisposableReviewLifecycle>();
  let tail: Promise<void> = Promise.resolve();

  const serialize = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation, operation);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const disposeRetained = async (lifecycle: DisposableReviewLifecycle): Promise<void> => {
    try {
      await lifecycle.dispose();
      pending.delete(lifecycle);
    } catch (error) {
      pending.add(lifecycle);
      throw error;
    }
  };

  return Object.freeze({
    hasPending: () => pending.size > 0,
    retainAndDispose: (lifecycle: DisposableReviewLifecycle): Promise<void> =>
      serialize(async () => {
        pending.add(lifecycle);
        await disposeRetained(lifecycle);
      }),
    retry: (): Promise<number> =>
      serialize(async () => {
        let cleaned = 0;
        let firstError: unknown = null;
        for (const lifecycle of [...pending]) {
          try {
            await disposeRetained(lifecycle);
            cleaned += 1;
          } catch (error) {
            if (firstError === null) firstError = error;
          }
        }
        if (firstError !== null) throw firstError;
        return cleaned;
      }),
  });
}

const processCleanupOwner = createProgressReviewCleanupOwner();

export function retainProgressReviewCleanup(lifecycle: DisposableReviewLifecycle): Promise<void> {
  return processCleanupOwner.retainAndDispose(lifecycle);
}

export function retryPendingProgressReviewCleanup(): Promise<number> {
  return processCleanupOwner.retry();
}

export function hasPendingProgressReviewCleanup(): boolean {
  return processCleanupOwner.hasPending();
}
