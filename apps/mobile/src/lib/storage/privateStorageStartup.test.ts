import { describe, expect, it, vi } from 'vitest';

import type { AccountGenerationLease } from '@/lib/auth/accountGeneration';

import {
  preparePrivateStorageForSession,
  PRIVATE_STORAGE_STARTUP_OWNER_MISMATCH,
  type PrivateStorageStartupDependencies,
} from './privateStorageStartup';

const defaultMocks = vi.hoisted(() => ({
  readOwnership: vi.fn(),
  recoverPhotos: vi.fn(),
  runOwnerOperation: vi.fn(),
  scavengePlaintext: vi.fn(),
}));

vi.mock('@/features/photos/store', () => ({
  recoverPhotoStoreMutations: defaultMocks.recoverPhotos,
}));

vi.mock('@/lib/auth/accountGeneration', () => ({
  runAccountGenerationOperation: defaultMocks.runOwnerOperation,
}));

vi.mock('@/lib/auth/sessionOwner', () => ({
  readLocalDataOwnership: defaultMocks.readOwnership,
}));

vi.mock('./plaintextStaging', () => ({
  scavengePlaintextStaging: defaultMocks.scavengePlaintext,
}));

function createHarness(ownership: 'match' | 'mismatch' | 'unclaimed' = 'match') {
  const events: string[] = [];
  const assertCurrent = vi.fn((): void => {
    events.push('assert-current');
  });
  const readOwnership = vi.fn(async () => {
    events.push(`owner:${ownership}`);
    return ownership;
  });
  const recoverPhotos = vi.fn(async () => {
    events.push('recover-photos');
  });
  const scavengePlaintext = vi.fn(async () => {
    events.push('scavenge-plaintext');
    return 0;
  });
  const runOwnerOperation: PrivateStorageStartupDependencies['runOwnerOperation'] = async <T>(
    operation: (lease: AccountGenerationLease) => T | Promise<T>,
  ): Promise<T> => {
    events.push('owner-operation');
    return operation({ assertCurrent } as unknown as AccountGenerationLease);
  };

  return {
    dependencies: {
      readOwnership,
      recoverPhotos,
      runOwnerOperation,
      scavengePlaintext,
    } satisfies PrivateStorageStartupDependencies,
    events,
    assertCurrent,
    readOwnership,
    recoverPhotos,
    scavengePlaintext,
  };
}

describe('private storage startup coordinator', () => {
  it('performs no owner, recovery, or filesystem work merely by importing', () => {
    expect(defaultMocks.readOwnership).not.toHaveBeenCalled();
    expect(defaultMocks.recoverPhotos).not.toHaveBeenCalled();
    expect(defaultMocks.runOwnerOperation).not.toHaveBeenCalled();
    expect(defaultMocks.scavengePlaintext).not.toHaveBeenCalled();
  });

  it('verifies the isolated owner, recovers photos, then scavenges before resolving', async () => {
    const harness = createHarness();

    await expect(
      preparePrivateStorageForSession('user-a', harness.dependencies),
    ).resolves.toBeUndefined();

    expect(harness.events).toEqual([
      'owner-operation',
      'owner:match',
      'assert-current',
      'recover-photos',
      'assert-current',
      'scavenge-plaintext',
      'assert-current',
    ]);
  });

  it('never recovers or scavenges a namespace that is not owned by the session', async () => {
    const harness = createHarness('mismatch');

    await expect(preparePrivateStorageForSession('user-b', harness.dependencies)).rejects.toThrow(
      PRIVATE_STORAGE_STARTUP_OWNER_MISMATCH,
    );

    expect(harness.recoverPhotos).not.toHaveBeenCalled();
    expect(harness.scavengePlaintext).not.toHaveBeenCalled();
  });

  it('retains journal-owned plaintext when photo recovery fails', async () => {
    const harness = createHarness();
    harness.recoverPhotos.mockRejectedValueOnce(new Error('photo key unavailable'));

    await expect(preparePrivateStorageForSession('user-a', harness.dependencies)).rejects.toThrow(
      'photo key unavailable',
    );

    expect(harness.scavengePlaintext).not.toHaveBeenCalled();
  });

  it('does not start scavenging while photo recovery is still pending', async () => {
    const harness = createHarness();
    let releaseRecovery!: () => void;
    harness.recoverPhotos.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseRecovery = resolve;
        }),
    );

    const pending = preparePrivateStorageForSession('user-a', harness.dependencies);
    await vi.waitFor(() => expect(harness.recoverPhotos).toHaveBeenCalledOnce());
    expect(harness.scavengePlaintext).not.toHaveBeenCalled();

    releaseRecovery();
    await expect(pending).resolves.toBeUndefined();
    expect(harness.scavengePlaintext).toHaveBeenCalledOnce();
  });

  it('rechecks the owner lease before scavenging', async () => {
    const harness = createHarness();
    harness.assertCurrent
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw new Error('ACCOUNT_GENERATION_CHANGED');
      });

    await expect(preparePrivateStorageForSession('user-a', harness.dependencies)).rejects.toThrow(
      'ACCOUNT_GENERATION_CHANGED',
    );

    expect(harness.recoverPhotos).toHaveBeenCalledOnce();
    expect(harness.scavengePlaintext).not.toHaveBeenCalled();
  });

  it('recovers an unclaimed local guest namespace before scavenging', async () => {
    const harness = createHarness('unclaimed');

    await expect(
      preparePrivateStorageForSession(null, harness.dependencies),
    ).resolves.toBeUndefined();

    expect(harness.readOwnership).toHaveBeenCalledWith(null);
    expect(harness.recoverPhotos).toHaveBeenCalledOnce();
    expect(harness.scavengePlaintext).toHaveBeenCalledOnce();
  });

  it('keeps a signed-out mismatched namespace closed without recovery or scavenging', async () => {
    const harness = createHarness('mismatch');

    await expect(preparePrivateStorageForSession(null, harness.dependencies)).rejects.toThrow(
      PRIVATE_STORAGE_STARTUP_OWNER_MISMATCH,
    );

    expect(harness.recoverPhotos).not.toHaveBeenCalled();
    expect(harness.scavengePlaintext).not.toHaveBeenCalled();
  });
});
