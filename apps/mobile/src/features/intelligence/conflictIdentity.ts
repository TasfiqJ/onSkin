import type { DetectedConflict } from './engine';

/** Stable identity for a conflict: the rule + the unordered product pair. */
export function conflictKey(
  c: Pick<DetectedConflict, 'productAId' | 'productBId'> & { rule: { id: string } },
): string {
  const pair = [c.productAId ?? '', c.productBId ?? ''].sort().join('+');
  return `${c.rule.id}:${pair}`;
}
