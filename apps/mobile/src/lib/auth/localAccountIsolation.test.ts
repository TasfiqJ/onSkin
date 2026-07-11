import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearAccountIsolatedState,
  prepareLocalDataForSession,
  type LocalAccountIsolationDependencies,
} from './localAccountIsolation';

const accountGenerationMocks = vi.hoisted(() => ({
  beginAccountGenerationBoundary: vi.fn(),
  endAccountGenerationBoundary: vi.fn(),
  waitForAccountGenerationOperationsToSettle: vi.fn(async () => {}),
}));

vi.mock('./accountGeneration', () => accountGenerationMocks);

vi.mock('@/features/photos/encryptedStorage', () => ({
  beginEncryptedPhotoAccountBoundary: vi.fn(),
  endEncryptedPhotoAccountBoundary: vi.fn(),
  waitForEncryptedPhotoWritesToSettle: vi.fn(async () => {}),
}));

vi.mock('@/features/settings/localPrivateData', () => ({
  clearLocalPrivateData: vi.fn(async () => {}),
}));

vi.mock('@/lib/query/queryClient', () => ({
  queryClient: { cancelQueries: vi.fn(async () => {}), clear: vi.fn() },
}));

vi.mock('@/lib/storage/privateKV', () => ({
  beginPrivateKVAccountBoundary: vi.fn(),
  endPrivateKVAccountBoundary: vi.fn(),
  waitForPrivateKVWritesToSettle: vi.fn(async () => {}),
}));

vi.mock('./sessionOwner', () => ({
  claimLocalDataOwnership: vi.fn(async () => {}),
  clearLocalDataCleanupRequired: vi.fn(async () => {}),
  markLocalDataCleanupRequired: vi.fn(async () => {}),
  readLocalDataOwnership: vi.fn(async () => 'unclaimed'),
}));

function dependencies(
  ownership: 'match' | 'mismatch' | 'unclaimed' = 'unclaimed',
): LocalAccountIsolationDependencies & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    claimOwnership: vi.fn(async (userId: string) => {
      calls.push(`claim:${userId}`);
    }),
    clearCleanupRequired: vi.fn(async () => {
      calls.push('clear:cleanup-required');
    }),
    clearPersistedPrivateData: vi.fn(async () => {
      calls.push('clear:persisted');
    }),
    markCleanupRequired: vi.fn(async () => {
      calls.push('mark:cleanup-required');
    }),
    queryCache: {
      cancelQueries: vi.fn(async () => {
        calls.push('cancel:queries');
      }),
      clear: vi.fn(() => {
        calls.push('clear:queries');
      }),
    } as LocalAccountIsolationDependencies['queryCache'],
    readOwnership: vi.fn(async (userId: string | null) => {
      calls.push(`read-owner:${userId ?? 'signed-out'}`);
      return ownership;
    }),
  };
}

describe('local account isolation', () => {
  beforeEach(() => {
    accountGenerationMocks.beginAccountGenerationBoundary.mockClear();
    accountGenerationMocks.endAccountGenerationBoundary.mockClear();
    accountGenerationMocks.waitForAccountGenerationOperationsToSettle.mockClear();
  });

  it('keeps same-user refreshes and claims an unclaimed legacy owner', async () => {
    const deps = dependencies('unclaimed');

    await expect(prepareLocalDataForSession('user-a', 'user-a', deps)).resolves.toEqual({
      cleared: false,
      resetRoute: false,
    });
    expect(deps.calls).toEqual(['read-owner:user-a', 'claim:user-a']);
  });

  it('clears cache and persisted state before publishing a different user', async () => {
    const deps = dependencies('mismatch');
    const beforeClear = vi.fn(() => {
      deps.calls.push('before-clear');
    });

    await expect(
      prepareLocalDataForSession('user-a', 'user-b', deps, beforeClear),
    ).resolves.toEqual({ cleared: true, resetRoute: true });
    expect(deps.calls).toEqual([
      'read-owner:user-b',
      'before-clear',
      'mark:cleanup-required',
      'cancel:queries',
      'clear:queries',
      'clear:persisted',
      'cancel:queries',
      'clear:queries',
      'clear:cleanup-required',
      'claim:user-b',
    ]);
    expect(beforeClear).toHaveBeenCalledOnce();
  });

  it('detects a cold-start owner mismatch even without an in-memory previous user', async () => {
    const deps = dependencies('mismatch');

    await expect(prepareLocalDataForSession(null, 'user-b', deps)).resolves.toMatchObject({
      cleared: true,
    });
  });

  it('clears on sign-out without claiming a new owner', async () => {
    const deps = dependencies();

    await expect(prepareLocalDataForSession('user-a', null, deps)).resolves.toEqual({
      cleared: true,
      resetRoute: true,
    });
    expect(deps.calls[0]).toBe('read-owner:signed-out');
    expect(deps.claimOwnership).not.toHaveBeenCalled();
  });

  it('clears a persisted owner on a cold start that restores no session', async () => {
    const deps = dependencies('mismatch');

    await expect(prepareLocalDataForSession(null, null, deps)).resolves.toEqual({
      cleared: true,
      resetRoute: true,
    });
    expect(deps.calls).toEqual([
      'read-owner:signed-out',
      'mark:cleanup-required',
      'cancel:queries',
      'clear:queries',
      'clear:persisted',
      'cancel:queries',
      'clear:queries',
      'clear:cleanup-required',
    ]);
  });

  it('clears query memory again when persisted cleanup fails and does not claim', async () => {
    const deps = dependencies('mismatch');
    vi.mocked(deps.clearPersistedPrivateData).mockRejectedValueOnce(new Error('clear failed'));

    await expect(prepareLocalDataForSession('user-a', 'user-b', deps)).rejects.toThrow(
      'clear failed',
    );
    expect(deps.calls).toEqual([
      'read-owner:user-b',
      'mark:cleanup-required',
      'cancel:queries',
      'clear:queries',
      'cancel:queries',
      'clear:queries',
    ]);
    expect(deps.claimOwnership).not.toHaveBeenCalled();
  });

  it('still attempts every isolation stage when query cancellation fails', async () => {
    const deps = dependencies();
    vi.mocked(deps.queryCache.cancelQueries).mockRejectedValueOnce(new Error('cancel failed'));

    await expect(clearAccountIsolatedState(deps)).rejects.toThrow('cancel failed');
    expect(deps.calls).toEqual([
      'mark:cleanup-required',
      'clear:queries',
      'clear:persisted',
      'cancel:queries',
      'clear:queries',
    ]);
    expect(accountGenerationMocks.beginAccountGenerationBoundary).toHaveBeenCalledOnce();
    expect(
      accountGenerationMocks.waitForAccountGenerationOperationsToSettle,
    ).toHaveBeenCalledOnce();
    expect(accountGenerationMocks.endAccountGenerationBoundary).toHaveBeenCalledOnce();
  });

  it('still clears persisted state and releases the boundary when an account operation fails', async () => {
    const deps = dependencies();
    accountGenerationMocks.waitForAccountGenerationOperationsToSettle.mockRejectedValueOnce(
      new Error('account operation failed'),
    );

    await expect(clearAccountIsolatedState(deps)).rejects.toThrow('account operation failed');

    expect(deps.clearPersistedPrivateData).toHaveBeenCalledOnce();
    expect(accountGenerationMocks.endAccountGenerationBoundary).toHaveBeenCalledOnce();
  });

  it('keeps cleanup required after a partial failure so retry clears again before claim', async () => {
    const deps = dependencies('mismatch');
    vi.mocked(deps.clearPersistedPrivateData).mockRejectedValueOnce(new Error('partial clear'));

    await expect(prepareLocalDataForSession(null, 'user-b', deps)).rejects.toThrow('partial clear');
    expect(deps.clearCleanupRequired).not.toHaveBeenCalled();
    expect(deps.claimOwnership).not.toHaveBeenCalled();

    await expect(prepareLocalDataForSession(null, 'user-b', deps)).resolves.toEqual({
      cleared: true,
      resetRoute: true,
    });
    expect(deps.markCleanupRequired).toHaveBeenCalledTimes(2);
    expect(deps.clearPersistedPrivateData).toHaveBeenCalledTimes(2);
    expect(deps.clearCleanupRequired).toHaveBeenCalledTimes(1);
    expect(deps.claimOwnership).toHaveBeenCalledWith('user-b');
  });
});
