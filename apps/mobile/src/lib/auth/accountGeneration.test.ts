import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_LEASE_INVALID_CODE,
  ACCOUNT_GENERATION_LEASE_INVALID_MESSAGE,
  AccountGenerationLeaseError,
  assertAccountGenerationLease,
  assertAccountIdentityGeneration,
  beginAccountGenerationBoundary,
  beginAccountGenerationBoundaryFromLease,
  captureAccountIdentityGeneration,
  endAccountGenerationBoundary,
  runAccountGenerationOperation,
  type AccountGenerationLease,
  waitForAccountGenerationOperationsToSettle,
} from './accountGeneration';
import {
  activeHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

let boundaryDepth = 0;

function beginBoundary(): void {
  beginAccountGenerationBoundary();
  boundaryDepth += 1;
}

function endBoundary(): void {
  endAccountGenerationBoundary();
  boundaryDepth = Math.max(0, boundaryDepth - 1);
}

afterEach(() => {
  while (boundaryDepth > 0) endBoundary();
});

describe('account generation operations', () => {
  it('aborts a delayed operation and waits for its cleanup to settle', async () => {
    let releaseCleanup!: () => void;
    const cleanupGate = new Promise<void>((resolve) => {
      releaseCleanup = resolve;
    });
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    let operationSignal!: AbortSignal;

    const operation = runAccountGenerationOperation(async (lease) => {
      operationSignal = lease.signal;
      markStarted();
      await new Promise<void>((resolve) => {
        lease.signal.addEventListener('abort', () => resolve(), {
          once: true,
        });
      });
      await cleanupGate;
      lease.assertCurrent();
    });
    await started;

    beginBoundary();
    expect(operationSignal.aborted).toBe(true);

    let drainFinished = false;
    const drain = waitForAccountGenerationOperationsToSettle().then(() => {
      drainFinished = true;
    });
    await Promise.resolve();
    expect(drainFinished).toBe(false);

    releaseCleanup();
    await expect(operation).rejects.toBeInstanceOf(AccountGenerationLeaseError);
    await drain;
    expect(drainFinished).toBe(true);
  });

  it('rejects a stale lease both during and after an account boundary', async () => {
    let lease!: AccountGenerationLease;
    await runAccountGenerationOperation((operationLease) => {
      lease = operationLease;
    });

    beginBoundary();
    expect(() => assertAccountGenerationLease(lease)).toThrow(
      ACCOUNT_GENERATION_LEASE_INVALID_MESSAGE,
    );
    endBoundary();

    expect(() => lease.assertCurrent()).toThrowError(
      expect.objectContaining({
        code: ACCOUNT_GENERATION_LEASE_INVALID_CODE,
        message: ACCOUNT_GENERATION_LEASE_INVALID_MESSAGE,
      }),
    );
  });

  it('blocks new operations until the outermost nested boundary ends', async () => {
    const operation = vi.fn(() => 'complete');

    beginBoundary();
    beginBoundary();
    await expect(runAccountGenerationOperation(operation)).rejects.toMatchObject({
      code: ACCOUNT_GENERATION_LEASE_INVALID_CODE,
      message: ACCOUNT_GENERATION_LEASE_INVALID_MESSAGE,
    });
    endBoundary();
    await expect(runAccountGenerationOperation(operation)).rejects.toBeInstanceOf(
      AccountGenerationLeaseError,
    );
    expect(operation).not.toHaveBeenCalled();

    endBoundary();
    await expect(runAccountGenerationOperation(operation)).resolves.toBe('complete');
    expect(operation).toHaveBeenCalledOnce();
  });

  it('advances Auth identity for every nested boundary and closes health authority synchronously', async () => {
    const identityBefore = captureAccountIdentityGeneration();
    let accountGeneration!: number;
    await runAccountGenerationOperation((lease) => {
      accountGeneration = lease.generation;
    });
    setActiveHealthProcessingEpoch(4, {
      ownerUserId: 'owner-a',
      accountGeneration,
      serverVerifiedAt: null,
    });

    beginBoundary();
    expect(activeHealthProcessingEpoch()).toBeNull();
    beginBoundary();
    expect(captureAccountIdentityGeneration()).toBe(identityBefore + 2);
    expect(() => assertAccountIdentityGeneration(identityBefore)).toThrow(
      ACCOUNT_GENERATION_LEASE_INVALID_MESSAGE,
    );
    endBoundary();
    endBoundary();
  });

  it('increments the generation only for the outermost boundary', async () => {
    let before!: AccountGenerationLease;
    let after!: AccountGenerationLease;
    await runAccountGenerationOperation((lease) => {
      before = lease;
    });

    beginBoundary();
    beginBoundary();
    endBoundary();
    endBoundary();

    await runAccountGenerationOperation((lease) => {
      after = lease;
    });
    expect(after.generation).toBe(before.generation + 1);
  });

  it('keeps leases valid while no real account boundary occurs', async () => {
    let first!: AccountGenerationLease;
    let second!: AccountGenerationLease;

    await runAccountGenerationOperation((lease) => {
      first = lease;
      lease.assertCurrent();
    });
    await runAccountGenerationOperation((lease) => {
      second = lease;
      assertAccountGenerationLease(first);
      lease.assertCurrent();
    });

    expect(second.generation).toBe(first.generation);
    expect(first.signal.aborted).toBe(false);
  });

  it('removes a thrown operation from tracking', async () => {
    const failure = new Error('operation failed');
    let failedLease!: AccountGenerationLease;

    await expect(
      runAccountGenerationOperation((lease) => {
        failedLease = lease;
        throw failure;
      }),
    ).rejects.toBe(failure);

    beginBoundary();
    await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    expect(failedLease.signal.aborted).toBe(false);
  });

  it('hands a current lease into a boundary without waiting on itself', async () => {
    const identityBefore = captureAccountIdentityGeneration();
    let releaseBoundary!: () => void;
    await runAccountGenerationOperation((lease) => {
      releaseBoundary = beginAccountGenerationBoundaryFromLease(lease);
    });
    boundaryDepth += 1;
    expect(captureAccountIdentityGeneration()).toBe(identityBefore);

    await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    await expect(runAccountGenerationOperation(async () => 'blocked')).rejects.toBeInstanceOf(
      AccountGenerationLeaseError,
    );

    releaseBoundary();
    boundaryDepth = Math.max(0, boundaryDepth - 1);
    await expect(runAccountGenerationOperation(async () => 'ready')).resolves.toBe('ready');
  });
});
