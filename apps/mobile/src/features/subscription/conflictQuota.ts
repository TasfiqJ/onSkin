import { getPrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

const KEY = 'onskin.subscription.freeConflictCheckRuleIds.v1';

export const FREE_CONFLICT_CHECK_LIMIT = 1;

export type ConflictCheckAccess = {
  allowed: boolean;
  reason: 'pro' | 'already_viewed' | 'free_available' | 'quota_exhausted';
  shouldRecord: boolean;
};

function normalizeRuleIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))];
}

export function conflictCheckAccess(input: {
  isPro: boolean;
  ruleId: string;
  seenRuleIds: readonly string[];
  limit?: number;
}): ConflictCheckAccess {
  const limit = input.limit ?? FREE_CONFLICT_CHECK_LIMIT;
  if (input.isPro) return { allowed: true, reason: 'pro', shouldRecord: false };
  if (input.seenRuleIds.includes(input.ruleId)) {
    return { allowed: true, reason: 'already_viewed', shouldRecord: false };
  }
  if (input.seenRuleIds.length < limit) {
    return { allowed: true, reason: 'free_available', shouldRecord: true };
  }
  return { allowed: false, reason: 'quota_exhausted', shouldRecord: false };
}

export async function loadFreeConflictCheckRuleIds(): Promise<string[]> {
  try {
    const raw = await getPrivateItem(KEY);
    return normalizeRuleIds(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

export async function recordFreeConflictCheckRuleId(ruleId: string): Promise<string[]> {
  const seen = await loadFreeConflictCheckRuleIds();
  const next = seen.includes(ruleId) ? seen : [...seen, ruleId];
  await setPrivateItem(KEY, JSON.stringify(next));
  return next;
}
