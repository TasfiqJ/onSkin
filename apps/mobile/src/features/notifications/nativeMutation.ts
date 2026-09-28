import * as Notifications from 'expo-notifications';

export const NOTIFICATION_NATIVE_MUTATION_FENCED = 'NOTIFICATION_NATIVE_MUTATION_FENCED';
export const NOTIFICATION_NATIVE_MUTATION_SUPERSEDED = 'NOTIFICATION_NATIVE_MUTATION_SUPERSEDED';
export const NOTIFICATION_NATIVE_COMPENSATION_FAILED = 'NOTIFICATION_NATIVE_COMPENSATION_FAILED';
export const NOTIFICATION_NATIVE_CLEANUP_FAILED = 'NOTIFICATION_NATIVE_CLEANUP_FAILED';
export const NOTIFICATION_NATIVE_CLEANUP_TIMEOUT = 'NOTIFICATION_NATIVE_CLEANUP_TIMEOUT';

export const NOTIFICATION_NATIVE_CLEANUP_TIMEOUT_MS = 2_000;

export class NotificationNativeMutationFencedError extends Error {
  readonly code = NOTIFICATION_NATIVE_MUTATION_FENCED;

  constructor() {
    super(NOTIFICATION_NATIVE_MUTATION_FENCED);
    this.name = 'NotificationNativeMutationFencedError';
  }
}

export class NotificationNativeMutationSupersededError extends Error {
  readonly code = NOTIFICATION_NATIVE_MUTATION_SUPERSEDED;

  constructor() {
    super(NOTIFICATION_NATIVE_MUTATION_SUPERSEDED);
    this.name = 'NotificationNativeMutationSupersededError';
  }
}

export class NotificationNativeCompensationError extends Error {
  readonly code = NOTIFICATION_NATIVE_COMPENSATION_FAILED;

  constructor() {
    super(NOTIFICATION_NATIVE_COMPENSATION_FAILED);
    this.name = 'NotificationNativeCompensationError';
  }
}

export class NotificationNativeCleanupError extends Error {
  readonly code = NOTIFICATION_NATIVE_CLEANUP_FAILED;

  constructor() {
    super(NOTIFICATION_NATIVE_CLEANUP_FAILED);
    this.name = 'NotificationNativeCleanupError';
  }
}

export class NotificationNativeCleanupTimeoutError extends Error {
  readonly code = NOTIFICATION_NATIVE_CLEANUP_TIMEOUT;

  constructor() {
    super(NOTIFICATION_NATIVE_CLEANUP_TIMEOUT);
    this.name = 'NotificationNativeCleanupTimeoutError';
  }
}

export type NotificationNativeMutationBackend = Readonly<{
  cancelAllScheduledNotificationsAsync: () => Promise<void>;
  cancelScheduledNotificationAsync: (identifier: string) => Promise<void>;
  clearLastNotificationResponseAsync: () => Promise<void>;
  dismissAllNotificationsAsync: () => Promise<void>;
  dismissNotificationAsync: (identifier: string) => Promise<void>;
  scheduleNotificationAsync: (request: Notifications.NotificationRequestInput) => Promise<string>;
  setBadgeCountAsync: (badgeCount: number) => Promise<boolean>;
}>;

type MutationTerminalOutcome = Readonly<{ safe: boolean }>;

type ActiveMutation = {
  readonly identifier: string;
  readonly kind: 'cancel' | 'schedule';
  requiresCompensation: boolean;
  readonly terminal: Promise<MutationTerminalOutcome>;
};

type ActiveCleanup = Readonly<{
  terminal: Promise<void>;
}>;

type Deferred<T> = Readonly<{
  promise: Promise<T>;
  reject: (error: unknown) => void;
  resolve: (value: T | PromiseLike<T>) => void;
}>;

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function invokeNative(operation: () => Promise<void>): Promise<void> {
  try {
    return Promise.resolve(operation());
  } catch (error) {
    return Promise.reject(error);
  }
}

function withCleanupDeadline<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new NotificationNativeCleanupTimeoutError());
    }, timeoutMs);

    void operation.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

/**
 * Owns every native notification mutation in this JavaScript runtime.
 *
 * Ordinary schedule/cancel work is exclusive. Account cleanup is the sole
 * destructive exception: it may run while an earlier native operation is
 * unresolved, but it cannot report success until that operation and any exact
 * stale-schedule compensation are terminal.
 */
export class NotificationNativeMutationCoordinator {
  private readonly activeCleanups = new Set<ActiveCleanup>();
  private readonly activeMutations = new Set<ActiveMutation>();
  private readonly unsafeCompensations = new Set<ActiveMutation>();
  private cleanupFailureFenced = false;

  constructor(
    private readonly backend: NotificationNativeMutationBackend,
    private readonly cleanupTimeoutMs = NOTIFICATION_NATIVE_CLEANUP_TIMEOUT_MS,
  ) {}

  isOrdinaryMutationFenced(): boolean {
    return (
      this.activeMutations.size > 0 ||
      this.activeCleanups.size > 0 ||
      this.cleanupFailureFenced ||
      this.unsafeCompensations.size > 0
    );
  }

  assertOrdinaryMutationAvailable(): void {
    if (this.isOrdinaryMutationFenced()) {
      throw new NotificationNativeMutationFencedError();
    }
  }

  private async compensateExactIdentifiers(identifiers: readonly string[]): Promise<boolean> {
    const uniqueIdentifiers = [...new Set(identifiers)];
    const results = await Promise.allSettled(
      uniqueIdentifiers.flatMap((identifier) => [
        invokeNative(() => this.backend.cancelScheduledNotificationAsync(identifier)),
        invokeNative(() => this.backend.dismissNotificationAsync(identifier)),
      ]),
    );
    return results.every((result) => result.status === 'fulfilled');
  }

  scheduleExact(
    signal: AbortSignal,
    request: Notifications.NotificationRequestInput & Readonly<{ identifier: string }>,
  ): Promise<string> {
    if (!request.identifier) throw new Error('NOTIFICATION_NATIVE_IDENTIFIER_REQUIRED');
    this.assertOrdinaryMutationAvailable();

    const result = deferred<string>();
    const terminal = deferred<MutationTerminalOutcome>();
    const record: ActiveMutation = {
      identifier: request.identifier,
      kind: 'schedule',
      requiresCompensation: signal.aborted,
      terminal: terminal.promise,
    };
    const markStale = () => {
      record.requiresCompensation = true;
    };
    const finish = (safe: boolean) => {
      signal.removeEventListener('abort', markStale);
      this.activeMutations.delete(record);
      terminal.resolve({ safe });
    };

    // The record exists before native code is invoked. This closes the
    // synchronous gap in which another owner could otherwise launch work.
    this.activeMutations.add(record);
    signal.addEventListener('abort', markStale, { once: true });

    let nativeSchedule: Promise<string>;
    try {
      nativeSchedule = this.backend.scheduleNotificationAsync(request);
    } catch (error) {
      // Treat a synchronous adapter/bridge throw as commit-ambiguous too. A
      // native call may side-effect before its JavaScript wrapper throws, so
      // keep the global mutation fence until the predeclared ID is reconciled.
      void this.compensateExactIdentifiers([request.identifier]).then((compensated) => {
        if (!compensated) {
          this.unsafeCompensations.add(record);
          finish(false);
          result.reject(new NotificationNativeCompensationError());
          return;
        }
        finish(true);
        result.reject(error);
      });
      return result.promise;
    }

    void Promise.resolve(nativeSchedule).then(
      async (resolvedIdentifier) => {
        const identifierMismatch = resolvedIdentifier !== request.identifier;
        if (record.requiresCompensation || identifierMismatch) {
          const compensated = await this.compensateExactIdentifiers(
            identifierMismatch ? [request.identifier, resolvedIdentifier] : [request.identifier],
          );
          if (!compensated) {
            this.unsafeCompensations.add(record);
            finish(false);
            result.reject(new NotificationNativeCompensationError());
            return;
          }
          finish(true);
          result.reject(new NotificationNativeMutationSupersededError());
          return;
        }

        finish(true);
        result.resolve(resolvedIdentifier);
      },
      async (error: unknown) => {
        // A bridge rejection can be commit-then-response-loss even without an
        // account change. Reconcile the predeclared ID before releasing any
        // later same-owner or owner-B mutation.
        const compensated = await this.compensateExactIdentifiers([request.identifier]);
        if (!compensated) {
          this.unsafeCompensations.add(record);
          finish(false);
          result.reject(new NotificationNativeCompensationError());
          return;
        }
        finish(true);
        result.reject(error);
      },
    );

    return result.promise;
  }

  cancelExact(identifier: string): Promise<void> {
    if (!identifier) throw new Error('NOTIFICATION_NATIVE_IDENTIFIER_REQUIRED');
    this.assertOrdinaryMutationAvailable();

    const result = deferred<void>();
    const terminal = deferred<MutationTerminalOutcome>();
    const record: ActiveMutation = {
      identifier,
      kind: 'cancel',
      requiresCompensation: false,
      terminal: terminal.promise,
    };
    const finish = () => {
      this.activeMutations.delete(record);
      terminal.resolve({ safe: true });
    };

    this.activeMutations.add(record);
    let nativeCancellation: Promise<void>;
    try {
      nativeCancellation = this.backend.cancelScheduledNotificationAsync(identifier);
    } catch (error) {
      finish();
      result.reject(error);
      return result.promise;
    }

    void Promise.resolve(nativeCancellation).then(
      () => {
        finish();
        result.resolve(undefined);
      },
      (error: unknown) => {
        finish();
        result.reject(error);
      },
    );
    return result.promise;
  }

  clearAllWithinBound(timeoutMs = this.cleanupTimeoutMs): Promise<void> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return Promise.reject(new Error('NOTIFICATION_NATIVE_CLEANUP_TIMEOUT_INVALID'));
    }

    const priorMutations = [...this.activeMutations];
    for (const mutation of priorMutations) {
      if (mutation.kind === 'schedule') mutation.requiresCompensation = true;
    }

    const terminal = deferred<void>();
    const cleanup: ActiveCleanup = { terminal: terminal.promise };
    this.activeCleanups.add(cleanup);

    // Both global calls are launched for every cleanup attempt. Their promises
    // stay tracked after the caller's bounded wait expires, keeping ordinary
    // owner-B work quarantined until the native outcome is truly terminal.
    const nativeCleanup = Promise.allSettled([
      invokeNative(() => this.backend.cancelAllScheduledNotificationsAsync()),
      invokeNative(() => this.backend.clearLastNotificationResponseAsync()),
      invokeNative(() => this.backend.dismissAllNotificationsAsync()),
      invokeNative(async () => {
        if (!(await this.backend.setBadgeCountAsync(0))) {
          throw new Error('NOTIFICATION_NATIVE_BADGE_CLEAR_FAILED');
        }
      }),
    ]);
    const mutationCleanup = Promise.all(priorMutations.map(({ terminal: wait }) => wait));

    const cleanupWork = Promise.all([nativeCleanup, mutationCleanup])
      .then(([nativeResults, mutationOutcomes]) => {
        if (
          nativeResults.some((result) => result.status === 'rejected') ||
          mutationOutcomes.some((outcome) => !outcome.safe)
        ) {
          throw new NotificationNativeCleanupError();
        }

        // No ordinary mutation can begin while this cleanup is active, so a
        // successful global sweep may clear every terminal compensation fence.
        this.cleanupFailureFenced = false;
        this.unsafeCompensations.clear();
      })
      .catch((error: unknown) => {
        // A terminal cleanup rejection is still an unproven native state.
        // Keep ordinary work quarantined until a later full cleanup succeeds.
        this.cleanupFailureFenced = true;
        throw error;
      });

    void cleanupWork.then(
      () => {
        this.activeCleanups.delete(cleanup);
        terminal.resolve(undefined);
      },
      () => {
        this.activeCleanups.delete(cleanup);
        terminal.resolve(undefined);
      },
    );

    return withCleanupDeadline(cleanupWork, timeoutMs);
  }
}

const nativeNotificationMutationCoordinator = new NotificationNativeMutationCoordinator(
  Notifications,
);

export function scheduleNativeNotificationExact(
  signal: AbortSignal,
  request: Notifications.NotificationRequestInput & Readonly<{ identifier: string }>,
): Promise<string> {
  return nativeNotificationMutationCoordinator.scheduleExact(signal, request);
}

export function assertNativeNotificationMutationAvailable(): void {
  nativeNotificationMutationCoordinator.assertOrdinaryMutationAvailable();
}

export function cancelNativeScheduledNotificationExact(identifier: string): Promise<void> {
  return nativeNotificationMutationCoordinator.cancelExact(identifier);
}

export function clearNativeNotificationsForAccountIsolation(): Promise<void> {
  return nativeNotificationMutationCoordinator.clearAllWithinBound();
}
