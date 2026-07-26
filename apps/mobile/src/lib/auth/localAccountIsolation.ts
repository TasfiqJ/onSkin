import type { QueryClient } from '@tanstack/react-query';

import {
  beginEncryptedPhotoAccountBoundary,
  endEncryptedPhotoAccountBoundary,
  waitForEncryptedPhotoWritesToSettle,
} from '@/features/photos/photoAccountBoundary';
import { queryClient } from '@/lib/query/queryClient';
import {
  beginPrivateKVAccountBoundary,
  endPrivateKVAccountBoundary,
  waitForPrivateKVWritesToSettle,
} from '@/lib/storage/privateKV';

import {
  shouldClearLocalPrivateDataForSessionChange,
  type LocalDataOwnership,
} from './sessionBoundary';
import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from './accountGeneration';
import {
  claimLocalDataOwnership,
  clearLocalDataCleanupRequired,
  markLocalDataCleanupRequired,
  readLocalDataOwnership,
} from './sessionOwner';

type QueryCacheController = Pick<QueryClient, 'cancelQueries' | 'clear'>;

export type LocalAccountIsolationDependencies = {
  claimOwnership: (userId: string) => Promise<void>;
  clearCleanupRequired: () => Promise<void>;
  clearPersistedPrivateData: () => Promise<void>;
  clearPlaintextStaging?: () => Promise<unknown>;
  clearSensitiveImageMemory?: () => Promise<unknown>;
  markCleanupRequired: () => Promise<void>;
  queryCache: QueryCacheController;
  readOwnership: (userId: string | null) => Promise<LocalDataOwnership>;
};

const defaultDependencies: LocalAccountIsolationDependencies = {
  claimOwnership: claimLocalDataOwnership,
  clearCleanupRequired: clearLocalDataCleanupRequired,
  clearPersistedPrivateData: async () => {
    const { clearLocalPrivateData } = await import('@/features/settings/localPrivateData');
    await clearLocalPrivateData();
  },
  clearPlaintextStaging: async () => {
    const { scavengePlaintextStaging } = await import('@/lib/storage/plaintextStaging');
    return scavengePlaintextStaging();
  },
  clearSensitiveImageMemory: async () => {
    const { purgeSensitiveImageMemory } = await import('@/features/photos/sensitiveImageMemory');
    return purgeSensitiveImageMemory();
  },
  markCleanupRequired: markLocalDataCleanupRequired,
  queryCache: queryClient,
  readOwnership: readLocalDataOwnership,
};

export async function clearAccountIsolatedState(
  dependencies: Pick<
    LocalAccountIsolationDependencies,
    | 'clearCleanupRequired'
    | 'clearPersistedPrivateData'
    | 'clearPlaintextStaging'
    | 'markCleanupRequired'
    | 'queryCache'
    | 'clearSensitiveImageMemory'
  > = defaultDependencies,
): Promise<void> {
  let firstFailure: unknown = null;
  const attempt = async (operation: () => void | Promise<unknown>) => {
    try {
      await operation();
    } catch (error) {
      firstFailure ??= error;
    }
  };

  await dependencies.markCleanupRequired();
  beginAccountGenerationBoundary();
  beginPrivateKVAccountBoundary();
  beginEncryptedPhotoAccountBoundary();
  try {
    // Plaintext scavenging deletes the dedicated staging/ingress directories.
    // Drain every owner-scoped producer first so it cannot race a late camera or
    // image-manipulator write into those directories.
    await attempt(() => waitForAccountGenerationOperationsToSettle());
    await attempt(() => waitForPrivateKVWritesToSettle());
    await attempt(() => waitForEncryptedPhotoWritesToSettle());
    if (dependencies.clearPlaintextStaging) {
      await attempt(() => dependencies.clearPlaintextStaging?.());
    }
    if (dependencies.clearSensitiveImageMemory) {
      await attempt(() => dependencies.clearSensitiveImageMemory?.());
    }
    await attempt(() => dependencies.queryCache.cancelQueries());
    await attempt(() => dependencies.queryCache.clear());
    await attempt(() => dependencies.clearPersistedPrivateData());

    // A query that ignored cancellation must not repopulate account A after its
    // persisted records were removed. Clear again after the destructive boundary.
    await attempt(() => dependencies.queryCache.cancelQueries());
    await attempt(() => dependencies.queryCache.clear());
    if (firstFailure === null) await attempt(() => dependencies.clearCleanupRequired());
  } finally {
    endEncryptedPhotoAccountBoundary();
    endPrivateKVAccountBoundary();
    endAccountGenerationBoundary();
  }

  if (firstFailure) throw firstFailure;
}

export async function prepareLocalDataForSession(
  previousUserId: string | null,
  nextUserId: string | null,
  dependencies: LocalAccountIsolationDependencies = defaultDependencies,
  beforeClear?: () => void | Promise<void>,
): Promise<{ cleared: boolean; resetRoute: boolean }> {
  const ownership = await dependencies.readOwnership(nextUserId);
  const mustClear = shouldClearLocalPrivateDataForSessionChange(
    previousUserId,
    nextUserId,
    ownership,
  );

  if (mustClear) {
    await beforeClear?.();
    await clearAccountIsolatedState(dependencies);
  }
  if (nextUserId) await dependencies.claimOwnership(nextUserId);

  return { cleared: mustClear, resetRoute: mustClear };
}
