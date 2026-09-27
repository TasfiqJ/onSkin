import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';

import { isPhotoAnalysisCleanupError, type CaptureAnalysisControl } from './photoAnalysisCleanup';

type AnalysisSession = {
  controller: AbortController;
  operations: Set<Promise<unknown>>;
  cleanupRetries: Set<() => Promise<void>>;
  uri: string;
};

export type CaptureAnalysisLease = Readonly<{
  run: <T>(operation: (control: CaptureAnalysisControl) => Promise<T>) => Promise<T>;
  uri: string;
}>;

export type CaptureAnalysisCoordinator = Readonly<{
  abort: () => void;
  abortAndDrain: () => Promise<void>;
  activate: (uri: string | null) => CaptureAnalysisLease | null;
  getActiveLease: () => CaptureAnalysisLease | null;
  hasPendingCleanup: () => boolean;
  subscribe: (listener: () => void) => () => void;
}>;

function abortError(): Error {
  return new Error('CAPTURE_ANALYSIS_ABORTED');
}

export function createCaptureAnalysisCoordinator(): CaptureAnalysisCoordinator {
  const sessions = new Set<AnalysisSession>();
  const leases = new WeakMap<AnalysisSession, CaptureAnalysisLease>();
  const listeners = new Set<() => void>();
  let active: AnalysisSession | null = null;

  const notify = () => listeners.forEach((listener) => listener());

  const prune = (session: AnalysisSession) => {
    if (session !== active && session.operations.size === 0 && session.cleanupRetries.size === 0) {
      sessions.delete(session);
    }
  };

  const leaseFor = (session: AnalysisSession): CaptureAnalysisLease => {
    const existing = leases.get(session);
    if (existing) return existing;
    const lease = Object.freeze({
      uri: session.uri,
      run: <T>(operation: (control: CaptureAnalysisControl) => Promise<T>): Promise<T> => {
        if (session.controller.signal.aborted) return Promise.reject(abortError());
        const tracked = runAccountGenerationOperation(async (accountLease) => {
          const operationController = new AbortController();
          const abort = () => operationController.abort();
          session.controller.signal.addEventListener('abort', abort, { once: true });
          accountLease.signal.addEventListener('abort', abort, { once: true });
          const control: CaptureAnalysisControl = Object.freeze({
            signal: operationController.signal,
            assertActive: () => {
              accountLease.assertCurrent();
              if (session.controller.signal.aborted || operationController.signal.aborted) {
                throw abortError();
              }
            },
          });
          try {
            control.assertActive();
            return await operation(control);
          } catch (error) {
            if (isPhotoAnalysisCleanupError(error)) {
              session.cleanupRetries.add(error.retryCleanup);
            }
            throw error;
          } finally {
            session.controller.signal.removeEventListener('abort', abort);
            accountLease.signal.removeEventListener('abort', abort);
          }
        });
        session.operations.add(tracked);
        void tracked
          .finally(() => {
            session.operations.delete(tracked);
            prune(session);
          })
          .catch(() => undefined);
        return tracked;
      },
    });
    leases.set(session, lease);
    return lease;
  };

  const abort = () => {
    active?.controller.abort();
  };

  const abortAndDrain = async (): Promise<void> => {
    for (const session of sessions) session.controller.abort();
    while ([...sessions].some((session) => session.operations.size > 0)) {
      await Promise.allSettled([...sessions].flatMap((session) => [...session.operations]));
    }

    let firstError: unknown = null;
    for (const session of sessions) {
      for (const retry of [...session.cleanupRetries]) {
        try {
          await retry();
          session.cleanupRetries.delete(retry);
        } catch (error) {
          if (firstError === null) firstError = error;
        }
      }
      prune(session);
    }
    if (firstError !== null) throw firstError;
  };

  return Object.freeze({
    abort,
    abortAndDrain,
    activate: (uri) => {
      if (uri === null) {
        active?.controller.abort();
        active = null;
        notify();
        return null;
      }
      if (active?.uri === uri && !active.controller.signal.aborted) return leaseFor(active);
      active?.controller.abort();
      const session: AnalysisSession = {
        controller: new AbortController(),
        operations: new Set(),
        cleanupRetries: new Set(),
        uri,
      };
      sessions.add(session);
      active = session;
      const lease = leaseFor(session);
      notify();
      return lease;
    },
    getActiveLease: () => (active ? leaseFor(active) : null),
    hasPendingCleanup: () => [...sessions].some((session) => session.cleanupRetries.size > 0),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}
