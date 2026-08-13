import { afterEach, describe, expect, it } from 'vitest';

import {
  beginEncryptedPhotoAccountBoundary,
  endEncryptedPhotoAccountBoundary,
  PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY,
  runAccountScopedPhotoMutation,
  runDestructiveAccountScopedPhotoOperation,
  waitForEncryptedPhotoWritesToSettle,
} from './photoAccountBoundary';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe.sequential('photo account boundary coordination', () => {
  afterEach(() => {
    endEncryptedPhotoAccountBoundary();
  });

  it('rejects an old-generation mutation even after the account boundary reopens', async () => {
    const operation = deferred<string>();
    const mutation = runAccountScopedPhotoMutation(() => operation.promise);

    beginEncryptedPhotoAccountBoundary();
    endEncryptedPhotoAccountBoundary();
    operation.resolve('owner-a-result');

    await expect(mutation).rejects.toThrow(PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY);
    await expect(waitForEncryptedPhotoWritesToSettle()).resolves.toBeUndefined();
  });

  it('never starts queued destructive work captured before a boundary', async () => {
    const firstOperation = deferred<void>();
    let secondOperationStarted = false;
    const first = runDestructiveAccountScopedPhotoOperation(async () => {
      await firstOperation.promise;
      return 'first-owner-result';
    });
    const second = runDestructiveAccountScopedPhotoOperation(async () => {
      secondOperationStarted = true;
      return 'second-owner-result';
    });
    const firstRejection = expect(first).rejects.toThrow(PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY);
    const secondRejection = expect(second).rejects.toThrow(PHOTO_WRITE_BLOCKED_ACCOUNT_BOUNDARY);

    beginEncryptedPhotoAccountBoundary();
    endEncryptedPhotoAccountBoundary();
    firstOperation.resolve();

    await firstRejection;
    await secondRejection;
    await expect(waitForEncryptedPhotoWritesToSettle()).resolves.toBeUndefined();
    expect(secondOperationStarted).toBe(false);
  });
});
