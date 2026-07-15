import { AccountGenerationLeaseError } from '@/lib/auth/accountGeneration';
import type { LocalDateBoundaryIdentity } from '@/lib/query/localDateBoundaryStore';
import { isOwnerQueryScopeCurrent, queryKeys, type OwnerQueryScope } from '@/lib/query/queryKeys';
import { readLocalDateBoundarySnapshot } from '@/lib/query/queryDateBoundaryCore';

import type { CompletionCommitResult } from './completionsStore';

type CompletionCacheUpdater = (current: ReadonlySet<string> | undefined) => Set<string>;

type CompletionMutationCoordinatorDependencies = {
  boundary: LocalDateBoundaryIdentity;
  cancel: (queryKey: readonly unknown[]) => void | Promise<void>;
  isOwnerCurrent?: (scope: OwnerQueryScope) => boolean;
  operation: () => Promise<CompletionCommitResult>;
  publish: (queryKey: readonly unknown[], update: CompletionCacheUpdater) => void;
  readBoundary?: () => LocalDateBoundaryIdentity;
  reconcileProgress?: () => void | Promise<void>;
  scope: OwnerQueryScope;
};

export type CompletionPublicationResult = {
  result: CompletionCommitResult;
  published: boolean;
};

function sameBoundary(left: LocalDateBoundaryIdentity, right: LocalDateBoundaryIdentity): boolean {
  return left.localDate === right.localDate && left.timeZone === right.timeZone;
}

/**
 * Merge an append-only durable day snapshot into cache without mutating either
 * Set. The union makes publication safe even when distinct rapid commits finish
 * their UI work out of order.
 */
export function mergeCompletionSnapshot(
  current: ReadonlySet<string> | undefined,
  committed: ReadonlySet<string>,
): Set<string> {
  return new Set([...(current ?? []), ...committed]);
}

/**
 * Publish a durable completion to exact owner/day caches. No uncommitted value
 * reaches React Query, and optional Progress reconciliation never blocks the tap.
 */
export async function commitTodayCompletionForOwner({
  boundary,
  cancel,
  isOwnerCurrent = isOwnerQueryScopeCurrent,
  operation,
  publish,
  readBoundary = readLocalDateBoundarySnapshot,
  reconcileProgress,
  scope,
}: CompletionMutationCoordinatorDependencies): Promise<CompletionPublicationResult> {
  // A stale event handler must be rejected before it can ask the store to discover
  // and mutate whichever account happens to be current now.
  if (!isOwnerCurrent(scope)) throw new AccountGenerationLeaseError();

  const result = await operation();
  if (result.status !== 'committed' || result.date !== boundary.localDate) {
    return { result, published: false };
  }
  if (!isOwnerCurrent(scope)) return { result, published: false };

  const freshBoundary = readBoundary();
  const boundaries = [boundary];
  if (freshBoundary.localDate === result.date && !sameBoundary(freshBoundary, boundary)) {
    boundaries.push(freshBoundary);
  }

  // Stop an older encrypted read from resolving after the durable snapshot and
  // replacing it. Cancellation is exact: no other owner or local day is touched.
  for (const target of boundaries) {
    await cancel(queryKeys.completions(scope, target));
  }
  if (!isOwnerCurrent(scope)) return { result, published: false };

  for (const target of boundaries) {
    publish(queryKeys.completions(scope, target), (current) =>
      mergeCompletionSnapshot(current, result.completedSteps),
    );
  }

  if (result.changed && reconcileProgress) {
    try {
      const pending = reconcileProgress();
      if (pending) void pending.catch(() => undefined);
    } catch {
      // Progress reconciliation is optional and must never reclassify a durable
      // local completion as failed.
    }
  }

  return { result, published: true };
}
