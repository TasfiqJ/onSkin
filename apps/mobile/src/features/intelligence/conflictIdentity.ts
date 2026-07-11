import type { DetectedConflict } from './engine';

/** Stable identity for a conflict: the rule + the unordered product pair. */
export function conflictKey(
  c: Pick<DetectedConflict, 'productAId' | 'productBId'> & { rule: { id: string } },
): string {
  const pair = [c.productAId ?? '', c.productBId ?? ''].sort().join('+');
  return `${c.rule.id}:${pair}`;
}

export function conflictDetailRoute(c: DetectedConflict) {
  if (!c.productAId || !c.productBId) {
    const subjectProductId = c.productAId ?? c.productBId;
    return {
      pathname: '/conflict/[ruleId]' as const,
      params: {
        ruleId: c.rule.id,
        ...(subjectProductId ? { subjectProductId } : {}),
      },
    };
  }
  return {
    pathname: '/conflict/[ruleId]' as const,
    params: {
      ruleId: c.rule.id,
      productAId: c.productAId,
      productBId: c.productBId,
    },
  };
}

export function conflictShareRoute(c: DetectedConflict) {
  if (!c.productAId || !c.productBId) {
    const subjectProductId = c.productAId ?? c.productBId;
    return {
      pathname: '/share/conflict/[ruleId]' as const,
      params: {
        ruleId: c.rule.id,
        ...(subjectProductId ? { subjectProductId } : {}),
      },
    };
  }
  return {
    pathname: '/share/conflict/[ruleId]' as const,
    params: {
      ruleId: c.rule.id,
      productAId: c.productAId,
      productBId: c.productBId,
    },
  };
}
