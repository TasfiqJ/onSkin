import { recoverPhotoStoreMutations } from '@/features/photos/store';
import {
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { readLocalDataOwnership } from '@/lib/auth/sessionOwner';

import { scavengePlaintextStaging } from './plaintextStaging';

export const PRIVATE_STORAGE_STARTUP_OWNER_MISMATCH = 'PRIVATE_STORAGE_STARTUP_OWNER_MISMATCH';

type PrivateStorageStartupDependencies = {
  readOwnership: typeof readLocalDataOwnership;
  recoverPhotos: typeof recoverPhotoStoreMutations;
  runOwnerOperation: <T>(
    operation: (lease: AccountGenerationLease) => T | Promise<T>,
  ) => Promise<T>;
  scavengePlaintext: typeof scavengePlaintextStaging;
};

const defaultDependencies: PrivateStorageStartupDependencies = {
  readOwnership: readLocalDataOwnership,
  recoverPhotos: recoverPhotoStoreMutations,
  runOwnerOperation: runAccountGenerationOperation,
  scavengePlaintext: scavengePlaintextStaging,
};

/**
 * Prepare private storage only after AuthProvider has completed local account
 * isolation. Photo recovery intentionally runs before the plaintext safety-net:
 * an interrupted add may still need its journal-owned capture source. If
 * recovery is uncertain, scavenging does not run and the root stays closed so
 * retry cannot turn a transient storage failure into permanent photo loss.
 */
export function preparePrivateStorageForSession(
  userId: string | null,
  dependencies: PrivateStorageStartupDependencies = defaultDependencies,
): Promise<void> {
  return dependencies.runOwnerOperation(async (lease) => {
    const ownership = await dependencies.readOwnership(userId);
    lease.assertCurrent();
    const authorized = userId ? ownership === 'match' : ownership === 'unclaimed';
    if (!authorized) {
      throw new Error(PRIVATE_STORAGE_STARTUP_OWNER_MISMATCH);
    }

    await dependencies.recoverPhotos();
    lease.assertCurrent();
    await dependencies.scavengePlaintext();
    lease.assertCurrent();
  });
}

export type { PrivateStorageStartupDependencies };
