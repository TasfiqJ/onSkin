import type { LocalDateBoundaryIdentity } from '@/lib/query/localDateBoundaryStore';
import {
  isOwnerQueryScopeCurrent,
  ownerQueryPrefixes,
  queryKeys,
  type OwnerQueryScope,
} from '@/lib/query/queryKeys';
import { readLocalDateBoundarySnapshot } from '@/lib/query/queryDateBoundaryCore';

import type { CycleConfig } from './cycleStore';

type CycleMutationCoordinatorDependencies = {
  cancel: (queryKey: readonly unknown[]) => void | Promise<void>;
  isOwnerCurrent?: (scope: OwnerQueryScope) => boolean;
  operation: () => Promise<CycleConfig>;
  publish: (queryKey: readonly unknown[], next: CycleConfig) => void;
  readBoundary?: () => LocalDateBoundaryIdentity;
  scope: OwnerQueryScope;
};

/** Publish to the wall-clock boundary observed after persistence completes. */
export async function commitCycleConfigForOwner({
  cancel,
  isOwnerCurrent = isOwnerQueryScopeCurrent,
  operation,
  publish,
  readBoundary = readLocalDateBoundarySnapshot,
  scope,
}: CycleMutationCoordinatorDependencies): Promise<CycleConfig> {
  await cancel(ownerQueryPrefixes.cycleConfig(scope));
  const next = await operation();
  if (isOwnerCurrent(scope)) {
    publish(queryKeys.cycleConfig(scope, readBoundary()), next);
  }
  return next;
}
