import { clearActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';

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

export function isAccountGenerationLeaseError(error: unknown): boolean {
  return (
    error instanceof AccountGenerationLeaseError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === ACCOUNT_GENERATION_LEASE_INVALID_CODE)
  );
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
// Unlike `accountGeneration`, this counter describes Auth identity/session
// continuity rather than private-store exclusion. Purpose-limited health-data
// cleanup intentionally opens an account boundary, but it must not make a
// still-current owner workflow look stale. Every real Auth boundary advances
// this counter, including nested A -> B -> A transitions.
let accountIdentityGeneration = 0;
let accountBoundaryDepth = 0;
const activeOperations = new Set<ActiveAccountGenerationOperation>();

function invalidLeaseError(): AccountGenerationLeaseError {
  return new AccountGenerationLeaseError();
}

export function assertAccountGenerationLease(lease: AccountGenerationLease): void {
  if (accountBoundaryDepth > 0 || lease.generation !== accountGeneration || lease.signal.aborted) {
    throw invalidLeaseError();
  }
}

export function captureAccountIdentityGeneration(): number {
  return accountIdentityGeneration;
}

export function assertAccountIdentityGeneration(expectedGeneration: number): void {
  if (
    !Number.isSafeInteger(expectedGeneration) ||
    expectedGeneration < 0 ||
    expectedGeneration !== accountIdentityGeneration
  ) {
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

function beginBoundary(advanceAccountIdentity: boolean): void {
  // Closing the process-wide health lease is part of the synchronous boundary
  // transition. It must happen before any await/drain so no request can borrow
  // the previous account's health authority while the stores are rotating.
  clearActiveHealthProcessingEpoch();
  if (advanceAccountIdentity) accountIdentityGeneration += 1;

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

export function beginAccountGenerationBoundary(): void {
  beginBoundary(true);
}

/**
 * Atomically converts a still-current tracked operation into the destructive
 * account boundary it is about to own. The caller must return from its tracked
 * operation immediately after acquiring this release handle: beginning the
 * boundary intentionally invalidates that lease and aborts every other tracked
 * continuation.
 *
 * This is the safe hand-off for purpose-limited cleanup. Wrapping the whole
 * cleanup in `runAccountGenerationOperation` would make cleanup wait on itself;
 * checking a generation and beginning a boundary in separate turns would let an
 * A-to-B account transition land in between.
 */
export function beginAccountGenerationBoundaryFromLease(
  lease: AccountGenerationLease,
): () => void {
  assertAccountGenerationLease(lease);
  // Purpose-limited cleanup rotates the private stores but does not represent
  // a new Auth subject/session. Keep the identity generation stable while the
  // ordinary account-generation lease still fences all concurrent work.
  beginBoundary(false);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    endAccountGenerationBoundary();
  };
}

export async function waitForAccountGenerationOperationsToSettle(): Promise<void> {
  while (activeOperations.size > 0) {
    await Promise.allSettled([...activeOperations].map(({ completion }) => completion));
  }
}

export function endAccountGenerationBoundary(): void {
  accountBoundaryDepth = Math.max(0, accountBoundaryDepth - 1);
}
