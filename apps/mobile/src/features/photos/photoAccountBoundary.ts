import {
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';

export const PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY = 'PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY';

const inFlightPhotoMutations = new Set<Promise<unknown>>();
const activePhotoReadInvalidators = new Set<() => void>();
let destructivePhotoOperationTail: Promise<void> = Promise.resolve();
let accountBoundaryWriteBlockDepth = 0;
let accountBoundaryWriteGeneration = 0;

function photoWritesBlocked(): boolean {
  return accountBoundaryWriteBlockDepth > 0;
}

export function assertPhotoWriteAllowed(generation: number): void {
  if (photoWritesBlocked() || generation !== accountBoundaryWriteGeneration) {
    throw new Error(PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY);
  }
}

export async function runAccountScopedPhotoMutation<T>(
  operation: (generation: number) => Promise<T>,
): Promise<T> {
  if (photoWritesBlocked()) throw new Error(PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY);
  const generation = accountBoundaryWriteGeneration;
  const pending = operation(generation);
  inFlightPhotoMutations.add(pending);
  try {
    const result = await pending;
    assertPhotoWriteAllowed(generation);
    return result;
  } finally {
    inFlightPhotoMutations.delete(pending);
  }
}

/**
 * Detaches a pure read from native work that cannot accept AbortSignal. Either
 * account boundary rejects the public wrapper synchronously, while handlers
 * remain attached to the native promise so a late resolution or rejection can
 * neither publish owner-A plaintext nor become unhandled.
 */
function awaitAccountScopedPhotoRead<T>(
  lease: AccountGenerationLease,
  generation: number,
  operation: (assertCurrent: () => void) => PromiseLike<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const assertCurrent = () => {
      lease.assertCurrent();
      assertPhotoWriteAllowed(generation);
    };

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      lease.signal.removeEventListener('abort', onAccountBoundary);
      activePhotoReadInvalidators.delete(onPhotoBoundary);
      callback();
    };
    const onAccountBoundary = () => {
      try {
        assertCurrent();
        finish(() => reject(new Error(PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY)));
      } catch (error) {
        finish(() => reject(error));
      }
    };
    const onPhotoBoundary = () =>
      finish(() => reject(new Error(PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY)));

    try {
      assertCurrent();
    } catch (error) {
      reject(error);
      return;
    }

    lease.signal.addEventListener('abort', onAccountBoundary, { once: true });
    activePhotoReadInvalidators.add(onPhotoBoundary);

    // Close the gap between the initial assertions and listener registration.
    if (lease.signal.aborted) {
      onAccountBoundary();
      return;
    }
    try {
      assertCurrent();
    } catch (error) {
      finish(() => reject(error));
      return;
    }

    let pending: PromiseLike<T>;
    try {
      pending = operation(assertCurrent);
    } catch (error) {
      finish(() => reject(error));
      return;
    }

    void Promise.resolve(pending).then(
      (value) => {
        try {
          assertCurrent();
          finish(() => resolve(value));
        } catch (error) {
          finish(() => reject(error));
        }
      },
      (error: unknown) => finish(() => reject(error)),
    );
  });
}

export function runAccountScopedPhotoRead<T>(
  operation: (assertCurrent: () => void) => PromiseLike<T>,
): Promise<T> {
  if (photoWritesBlocked()) {
    return Promise.reject(new Error(PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY));
  }
  const generation = accountBoundaryWriteGeneration;
  return runAccountGenerationOperation((lease) =>
    awaitAccountScopedPhotoRead(lease, generation, operation),
  );
}

/**
 * Destructive filesystem work must be owned by both the photo-storage boundary
 * and the app-wide account generation. The outer lease is captured when the
 * public API is called, so an account switch can abort and drain the exact
 * operation even when it is waiting on the filesystem.
 */
export function runDestructiveAccountScopedPhotoOperation<T>(
  operation: (assertCurrent: () => void) => Promise<T>,
): Promise<T> {
  return runAccountGenerationOperation((lease) =>
    runAccountScopedPhotoMutation(async (generation) => {
      const assertCurrent = () => {
        lease.assertCurrent();
        assertPhotoWriteAllowed(generation);
      };
      const guardedOperation = async () => {
        assertCurrent();
        const result = await operation(assertCurrent);
        assertCurrent();
        return result;
      };
      const pending = destructivePhotoOperationTail.then(guardedOperation, guardedOperation);
      destructivePhotoOperationTail = pending.then(
        () => undefined,
        () => undefined,
      );
      return pending;
    }),
  );
}

export function beginEncryptedPhotoAccountBoundary(): void {
  if (accountBoundaryWriteBlockDepth === 0) {
    accountBoundaryWriteGeneration += 1;
    for (const invalidate of [...activePhotoReadInvalidators]) invalidate();
  }
  accountBoundaryWriteBlockDepth += 1;
}

export async function waitForEncryptedPhotoWritesToSettle(): Promise<void> {
  while (inFlightPhotoMutations.size > 0) {
    await Promise.allSettled([...inFlightPhotoMutations]);
  }
}

export function endEncryptedPhotoAccountBoundary(): void {
  if (accountBoundaryWriteBlockDepth === 0) return;
  accountBoundaryWriteBlockDepth -= 1;
}
