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

export function runAccountGenerationOperation<T>(
  operation: (lease: AccountGenerationLease) => T | Promise<T>,
): Promise<T> {
  if (accountBoundaryDepth > 0) return Promise.reject(invalidLeaseError());

  const controller = new AbortController();
  let lease!: AccountGenerationLease;
  lease = Object.freeze({
    generation: accountGeneration,
    signal: controller.signal,
    assertCurrent: () => assertAccountGenerationLease(lease),
  });

  let resolveCompletion!: (value: T | PromiseLike<T>) => void;
  let rejectCompletion!: (reason?: unknown) => void;
  const completion = new Promise<T>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });
  const activeOperation: ActiveAccountGenerationOperation = {
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
