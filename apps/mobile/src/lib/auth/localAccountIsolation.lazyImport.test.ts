import { beforeEach, describe, expect, it, vi } from 'vitest';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

const mocks = vi.hoisted(() => ({
  beginAccountGenerationBoundary: vi.fn(),
  beginEncryptedPhotoAccountBoundary: vi.fn(),
  beginPrivateKVAccountBoundary: vi.fn(),
  claimOwnership: vi.fn(async () => undefined),
  clearCleanupRequired: vi.fn(async () => undefined),
  clearLocalPrivateData: vi.fn<() => Promise<void>>(async () => undefined),
  endAccountGenerationBoundary: vi.fn(),
  endEncryptedPhotoAccountBoundary: vi.fn(),
  endPrivateKVAccountBoundary: vi.fn(),
  localPrivateDataModuleLoads: 0,
  markCleanupRequired: vi.fn(async () => undefined),
  purgeSensitiveImageMemory: vi.fn(async () => undefined),
  queryCacheCancel: vi.fn(async () => undefined),
  queryCacheClear: vi.fn(),
  readOwnership: vi.fn<() => Promise<'match' | 'mismatch' | 'unclaimed'>>(async () => 'match'),
  scavengePlaintextStaging: vi.fn(async () => undefined),
  waitForAccountGenerationOperationsToSettle: vi.fn(async () => undefined),
  waitForEncryptedPhotoWritesToSettle: vi.fn(async () => undefined),
  waitForPrivateKVWritesToSettle: vi.fn(async () => undefined),
}));

vi.mock('./accountGeneration', () => ({
  beginAccountGenerationBoundary: mocks.beginAccountGenerationBoundary,
  endAccountGenerationBoundary: mocks.endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle: mocks.waitForAccountGenerationOperationsToSettle,
}));

vi.mock('@/features/photos/encryptedStorage', () => ({
  beginEncryptedPhotoAccountBoundary: mocks.beginEncryptedPhotoAccountBoundary,
  endEncryptedPhotoAccountBoundary: mocks.endEncryptedPhotoAccountBoundary,
  waitForEncryptedPhotoWritesToSettle: mocks.waitForEncryptedPhotoWritesToSettle,
}));

vi.mock('@/features/settings/localPrivateData', () => {
  mocks.localPrivateDataModuleLoads += 1;
  return { clearLocalPrivateData: mocks.clearLocalPrivateData };
});

vi.mock('@/features/photos/sensitiveImageMemory', () => ({
  purgeSensitiveImageMemory: mocks.purgeSensitiveImageMemory,
}));

vi.mock('@/lib/query/queryClient', () => ({
  queryClient: {
    cancelQueries: mocks.queryCacheCancel,
    clear: mocks.queryCacheClear,
  },
}));

vi.mock('@/lib/storage/privateKV', () => ({
  beginPrivateKVAccountBoundary: mocks.beginPrivateKVAccountBoundary,
  endPrivateKVAccountBoundary: mocks.endPrivateKVAccountBoundary,
  waitForPrivateKVWritesToSettle: mocks.waitForPrivateKVWritesToSettle,
}));

vi.mock('@/lib/storage/plaintextStaging', () => ({
  scavengePlaintextStaging: mocks.scavengePlaintextStaging,
}));

vi.mock('./sessionOwner', () => ({
  claimLocalDataOwnership: mocks.claimOwnership,
  clearLocalDataCleanupRequired: mocks.clearCleanupRequired,
  markLocalDataCleanupRequired: mocks.markCleanupRequired,
  readLocalDataOwnership: mocks.readOwnership,
}));

describe.sequential('local account isolation lazy cleanup loading', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.localPrivateDataModuleLoads = 0;
    mocks.clearLocalPrivateData.mockResolvedValue(undefined);
    mocks.readOwnership.mockResolvedValue('match');
  });

  it('does not evaluate the destructive cleanup module for a matching same-owner session', async () => {
    const { prepareLocalDataForSession } = await import('./localAccountIsolation');

    await expect(prepareLocalDataForSession('owner-a', 'owner-a')).resolves.toEqual({
      cleared: false,
      resetRoute: false,
    });

    expect(mocks.localPrivateDataModuleLoads).toBe(0);
    expect(mocks.clearLocalPrivateData).not.toHaveBeenCalled();
    expect(mocks.markCleanupRequired).not.toHaveBeenCalled();
    expect(mocks.claimOwnership).toHaveBeenCalledExactlyOnceWith('owner-a');
  });

  it('does not load cleanup when a cold-start owner namespace is unclaimed', async () => {
    mocks.readOwnership.mockResolvedValue('unclaimed');
    const { prepareLocalDataForSession } = await import('./localAccountIsolation');

    await expect(prepareLocalDataForSession(null, 'owner-a')).resolves.toEqual({
      cleared: false,
      resetRoute: false,
    });

    expect(mocks.localPrivateDataModuleLoads).toBe(0);
    expect(mocks.clearLocalPrivateData).not.toHaveBeenCalled();
    expect(mocks.markCleanupRequired).not.toHaveBeenCalled();
    expect(mocks.claimOwnership).toHaveBeenCalledExactlyOnceWith('owner-a');
  });

  it('loads cleanup once for a mismatch and awaits it before claiming the new owner', async () => {
    const cleanup = deferred<void>();
    mocks.readOwnership.mockResolvedValue('mismatch');
    mocks.clearLocalPrivateData.mockReturnValueOnce(cleanup.promise);
    const { prepareLocalDataForSession } = await import('./localAccountIsolation');

    const pending = prepareLocalDataForSession('owner-a', 'owner-b');
    await vi.waitFor(() => expect(mocks.clearLocalPrivateData).toHaveBeenCalledOnce());

    expect(mocks.localPrivateDataModuleLoads).toBe(1);
    expect(mocks.claimOwnership).not.toHaveBeenCalled();

    cleanup.resolve();
    await expect(pending).resolves.toEqual({ cleared: true, resetRoute: true });

    expect(mocks.claimOwnership).toHaveBeenCalledExactlyOnceWith('owner-b');
    expect(mocks.clearLocalPrivateData.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.claimOwnership.mock.invocationCallOrder[0]!,
    );
  });

  it('propagates a cleanup-module load failure without claiming the new owner', async () => {
    mocks.readOwnership.mockResolvedValue('mismatch');
    vi.doMock('@/features/settings/localPrivateData', () => {
      mocks.localPrivateDataModuleLoads += 1;
      throw new Error('LOCAL_PRIVATE_DATA_MODULE_LOAD_FAILED');
    });
    const { prepareLocalDataForSession } = await import('./localAccountIsolation');

    await expect(prepareLocalDataForSession('owner-a', 'owner-b')).rejects.toThrow();

    expect(mocks.localPrivateDataModuleLoads).toBe(1);
    expect(mocks.clearLocalPrivateData).not.toHaveBeenCalled();
    expect(mocks.claimOwnership).not.toHaveBeenCalled();
    expect(mocks.clearCleanupRequired).not.toHaveBeenCalled();
    expect(mocks.endEncryptedPhotoAccountBoundary).toHaveBeenCalledOnce();
    expect(mocks.endPrivateKVAccountBoundary).toHaveBeenCalledOnce();
    expect(mocks.endAccountGenerationBoundary).toHaveBeenCalledOnce();
  });
});
