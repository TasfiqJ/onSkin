import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_LEASE_INVALID_CODE,
  ACCOUNT_GENERATION_LEASE_INVALID_MESSAGE,
  AccountGenerationLeaseError,
  assertAccountGenerationLease,
  assertAccountIdentityGeneration,
  beginAccountGenerationBoundary,
  beginAccountGenerationBoundaryFromLease,
  beginPrivateDataCleanupAccountBoundary,
  captureAccountIdentityGeneration,
  endAccountGenerationBoundary,
  runAccountGenerationOperation,
  type AccountGenerationLease,
  waitForAccountGenerationOperationsToSettle,
} from './accountGeneration';
import {
  activeHealthProcessingEpoch,
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';
import {
  assertHealthDataWriteLease,
  captureHealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';

let boundaryDepth = 0;
const cleanupBoundaryReleases = new Set<() => void>();

function beginCleanupBoundary(): () => void {
  const release = beginPrivateDataCleanupAccountBoundary();
  cleanupBoundaryReleases.add(release);
  return release;
}

function beginBoundary(): void {
  beginAccountGenerationBoundary();
  boundaryDepth += 1;
}

function endBoundary(): void {
  endAccountGenerationBoundary();
  boundaryDepth = Math.max(0, boundaryDepth - 1);
}

afterEach(() => {
  for (const release of cleanupBoundaryReleases) release();
  cleanupBoundaryReleases.clear();
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

describe('Campaign44 independently owned private-data cleanup account scopes', () => {
  it.each(['cleanup-first', 'auth-first'] as const)(
    'keeps admission closed across mixed boundaries released %s without extra identity advances', async (order) => {
      const identityBefore = captureAccountIdentityGeneration();
      const before = await runAccountGenerationOperation((lease) => lease);
      const firstCleanup = beginCleanupBoundary();
      beginBoundary();
      const secondCleanup = beginCleanupBoundary();
      expect(captureAccountIdentityGeneration()).toBe(identityBefore + 1);
      if (order === 'cleanup-first') firstCleanup();
      else endBoundary();
      await expect(runAccountGenerationOperation(() => undefined)).rejects.toBeInstanceOf(AccountGenerationLeaseError);
      secondCleanup();
      secondCleanup();
      await expect(runAccountGenerationOperation(() => undefined)).rejects.toBeInstanceOf(AccountGenerationLeaseError);
      if (order === 'cleanup-first') endBoundary();
      else firstCleanup();
      const after = await runAccountGenerationOperation((lease) => lease);
      expect(after.generation).toBe(before.generation + 1);
      expect(captureAccountIdentityGeneration()).toBe(identityBefore + 1);
      expect(() => before.assertCurrent()).toThrow(ACCOUNT_GENERATION_LEASE_INVALID_MESSAGE);
    },
  );

  it('owns exclusion after an unrelated purpose-limited scope releases', async () => {
    const identityBefore = captureAccountIdentityGeneration();
    const releaseOuter = await runAccountGenerationOperation((lease) =>
      beginAccountGenerationBoundaryFromLease(lease),
    );
    cleanupBoundaryReleases.add(releaseOuter);
    const releasePrivate = beginCleanupBoundary();
    releaseOuter();
    releaseOuter();
    await expect(runAccountGenerationOperation(() => undefined)).rejects.toBeInstanceOf(AccountGenerationLeaseError);
    expect(captureAccountIdentityGeneration()).toBe(identityBefore);
    releasePrivate();
    await expect(runAccountGenerationOperation(() => 'released')).resolves.toBe('released');
  });

  it('closes health and aborts original operations synchronously without draining its caller', async () => {
    const identityBefore = captureAccountIdentityGeneration();
    let releaseOperation!: () => void;
    const gate = new Promise<void>((resolve) => { releaseOperation = resolve; });
    let original!: AccountGenerationLease;
    const operation = runAccountGenerationOperation(async (lease) => {
      original = lease;
      setActiveHealthProcessingEpoch(44, {
        ownerUserId: 'owner-a', accountGeneration: lease.generation, serverVerifiedAt: null,
      });
      await gate;
      lease.assertCurrent();
    });
    const outcome = operation.then(() => null, (error: unknown) => error);
    const releaseCleanup = beginCleanupBoundary();
    try {
      expect(original.signal.aborted).toBe(true);
      expect(activeHealthProcessingEpoch()).toBeNull();
      expect(captureAccountIdentityGeneration()).toBe(identityBefore);
      await expect(runAccountGenerationOperation(() => undefined)).rejects.toBeInstanceOf(AccountGenerationLeaseError);
    } finally {
      releaseOperation();
      expect(await outcome).toBeInstanceOf(AccountGenerationLeaseError);
      releaseCleanup();
    }
    await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
  });

  it('can close cleanup from a tracked caller without waiting on that same operation', async () => {
    await runAccountGenerationOperation(async (lease) => {
      const releaseCleanup = beginCleanupBoundary();
      try {
        expect(lease.signal.aborted).toBe(true);
        await expect(runAccountGenerationOperation(() => undefined)).rejects.toBeInstanceOf(AccountGenerationLeaseError);
      } finally {
        releaseCleanup();
      }
      expect(() => lease.assertCurrent()).toThrow(ACCOUNT_GENERATION_LEASE_INVALID_MESSAGE);
    });
    await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
  });

  it('retires the original generation and health lease despite identical owner and epoch regrant', async () => {
    const identityBefore = captureAccountIdentityGeneration();
    const before = await runAccountGenerationOperation((lease) => lease);
    setActiveHealthProcessingEpoch(44, {
      ownerUserId: 'owner-a', accountGeneration: before.generation, serverVerifiedAt: null,
    });
    const oldHealth = captureHealthDataWriteLease('owner-a');
    const firstCleanup = beginCleanupBoundary();
    const secondCleanup = beginCleanupBoundary();
    expect(activeHealthProcessingEpoch()).toBeNull();
    firstCleanup();
    await expect(runAccountGenerationOperation(() => undefined)).rejects.toBeInstanceOf(AccountGenerationLeaseError);
    secondCleanup();
    const after = await runAccountGenerationOperation((lease) => lease);
    setActiveHealthProcessingEpoch(44, {
      ownerUserId: 'owner-a', accountGeneration: after.generation, serverVerifiedAt: null,
    });
    expect(after.generation).toBe(before.generation + 1);
    expect(captureAccountIdentityGeneration()).toBe(identityBefore);
    expect(() => before.assertCurrent()).toThrow(ACCOUNT_GENERATION_LEASE_INVALID_MESSAGE);
    expect(() => assertHealthDataWriteLease(oldHealth)).toThrow();
    clearActiveHealthProcessingEpoch();
  });

  it('does not weaken the existing FromLease owner handoff while cleanup is closed', async () => {
    const before = await runAccountGenerationOperation((lease) => lease);
    const releaseCleanup = beginCleanupBoundary();
    expect(() => beginAccountGenerationBoundaryFromLease(before)).toThrow(AccountGenerationLeaseError);
    releaseCleanup();
    const releaseHandoff = await runAccountGenerationOperation((lease) =>
      beginAccountGenerationBoundaryFromLease(lease),
    );
    cleanupBoundaryReleases.add(releaseHandoff);
    await expect(runAccountGenerationOperation(() => undefined)).rejects.toBeInstanceOf(AccountGenerationLeaseError);
    releaseHandoff();
    await expect(runAccountGenerationOperation(() => undefined)).resolves.toBeUndefined();
  });
});
