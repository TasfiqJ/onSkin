import {
  isReassuring,
  type DetectedConflict,
} from '@/features/intelligence/engine';
import { conflictKey } from '@/features/intelligence/conflictIdentity';

export function pairedProductIdsForResolvedConflicts(
  conflicts: DetectedConflict[],
  resolvedConflictKeys: ReadonlySet<string>,
  overriddenKeys: ReadonlySet<string> = new Set<string>(),
): Set<string> {
  const pairedIds = new Set<string>();

  for (const c of conflicts) {
    if (c.rule.interactionType === 'safety' || isReassuring(c)) continue;
    const key = conflictKey(c);
    if (overriddenKeys.has(key)) continue;
    if (!resolvedConflictKeys.has(key)) continue;
    if (c.productAId) pairedIds.add(c.productAId);
    if (c.productBId) pairedIds.add(c.productBId);
  }

  return pairedIds;
}
