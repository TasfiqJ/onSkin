export const ACCOUNT_GENERATION_CHANGED = 'ACCOUNT_GENERATION_CHANGED';
export const ACCOUNT_GENERATION_LEASE_INVALID_CODE = ACCOUNT_GENERATION_CHANGED;
export const ACCOUNT_GENERATION_LEASE_INVALID_MESSAGE = ACCOUNT_GENERATION_CHANGED;

export class AccountGenerationLeaseError extends Error {
  readonly code = ACCOUNT_GENERATION_LEASE_INVALID_CODE;

  constructor() {
    super(ACCOUNT_GENERATION_LEASE_INVALID_MESSAGE);
    this.name = 'AccountGenerationLeaseError';
  }
}

export type AccountGenerationLease = Readonly<{
  generation: number;
  signal: AbortSignal;
  assertCurrent: () => void;
  /** Terminal handoff into account isolation. Removes only this operation from
   * drain tracking, starts the boundary synchronously, and returns its release. */
  beginBoundaryHandoff: () => () => void;
}>;

type ActiveAccountGenerationOperation = {
  completion: Promise<unknown>;
  controller: AbortController;
};

let accountGeneration = 0;
let accountBoundaryDepth = 0;
const activeOperations = new Set<ActiveAccountGenerationOperation>();

/** Opaque in-memory owner epoch for cache namespacing; never a raw account identifier. */
export function getAccountGeneration(): number {
  if (accountBoundaryDepth > 0) throw invalidLeaseError();
  return accountGeneration;
}

function invalidLeaseError(): AccountGenerationLeaseError {
  return new AccountGenerationLeaseError();
}

export function assertAccountGenerationLease(lease: AccountGenerationLease): void {
  if (accountBoundaryDepth > 0 || lease.generation !== accountGeneration || lease.signal.aborted) {
    throw invalidLeaseError();
  }
}

/**
 * Await an API that cannot accept AbortSignal directly without allowing it to
 * pin the account boundary forever. The underlying read may still finish later,
 * but its result is detached and can never publish after this lease is aborted.
 */
export function awaitAccountGenerationLease<T>(
  lease: AccountGenerationLease,
  operation: () => PromiseLike<T>,
): Promise<T> {
  try {
    lease.assertCurrent();
  } catch (error) {
    return Promise.reject(error);
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      lease.signal.removeEventListener('abort', onAbort);
      callback();
    };
    const onAbort = () => finish(() => reject(invalidLeaseError()));

    lease.signal.addEventListener('abort', onAbort, { once: true });
    if (lease.signal.aborted) {
      onAbort();
      return;
    }

    let pending: PromiseLike<T>;
    try {
      pending = operation();
    } catch (error) {
      finish(() => reject(error));
      return;
    }

    void Promise.resolve(pending).then(
      (value) => {
        try {
          lease.assertCurrent();
          finish(() => resolve(value));
        } catch (error) {
          finish(() => reject(error));
        }
      },
      (error: unknown) => finish(() => reject(error)),
    );
  });
}

export function runAccountGenerationOperation<T>(
  operation: (lease: AccountGenerationLease) => T | Promise<T>,
): Promise<T> {
  if (accountBoundaryDepth > 0) return Promise.reject(invalidLeaseError());

  const controller = new AbortController();
  let lease!: AccountGenerationLease;
  let activeOperation!: ActiveAccountGenerationOperation;
  lease = Object.freeze({
    generation: accountGeneration,
    signal: controller.signal,
    assertCurrent: () => assertAccountGenerationLease(lease),
    beginBoundaryHandoff: () => {
      assertAccountGenerationLease(lease);
      if (!activeOperations.delete(activeOperation)) throw invalidLeaseError();
      beginAccountGenerationBoundary();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        endAccountGenerationBoundary();
      };
    },
  });

  let resolveCompletion!: (value: T | PromiseLike<T>) => void;
  let rejectCompletion!: (reason?: unknown) => void;
  const completion = new Promise<T>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });
  activeOperation = {
    completion,
    controller,
  };
  activeOperations.add(activeOperation);

  void (async () => {
    try {
      resolveCompletion(await operation(lease));
    } catch (error) {
      rejectCompletion(error);
    } finally {
      activeOperations.delete(activeOperation);
    }
  })();

  return completion;
}

export function beginAccountGenerationBoundary(): void {
  if (accountBoundaryDepth === 0) {
    accountBoundaryDepth = 1;
    accountGeneration += 1;
    for (const operation of activeOperations) {
      operation.controller.abort();
    }
    return;
  }

  accountBoundaryDepth += 1;
}

export async function waitForAccountGenerationOperationsToSettle(): Promise<void> {
  while (activeOperations.size > 0) {
    await Promise.allSettled([...activeOperations].map(({ completion }) => completion));
  }
}

export function endAccountGenerationBoundary(): void {
  accountBoundaryDepth = Math.max(0, accountBoundaryDepth - 1);
}
