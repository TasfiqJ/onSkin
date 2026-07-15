import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';
import {
  runCurrentHealthDataOperation,
  type HealthDataWriteOperationLease,
} from '@/lib/consent/healthDataWriteAdmission';

const KEY = 'onskin.subscription.freeConflictCheckRuleIds.v1';

export const FREE_CONFLICT_CHECK_LIMIT = 1;

export type ConflictCheckAccess = {
  allowed: boolean;
  reason: 'pro' | 'already_viewed' | 'free_available' | 'quota_exhausted';
  shouldRecord: boolean;
};

function normalizeRuleIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  ];
}

function didNormalizeRuleIds(value: unknown, normalized: readonly string[]): boolean {
  return (
    !Array.isArray(value) ||
    value.length !== normalized.length ||
    normalized.some((id, index) => value[index] !== id)
  );
}

export function conflictCheckAccess(input: {
  isPro: boolean;
  ruleId: string;
  seenRuleIds: readonly string[];
  limit?: number;
}): ConflictCheckAccess {
  const limit = input.limit ?? FREE_CONFLICT_CHECK_LIMIT;
  const ruleId = input.ruleId.trim();
  const seenRuleIds = normalizeRuleIds(input.seenRuleIds);
  if (input.isPro) return { allowed: true, reason: 'pro', shouldRecord: false };
  if (seenRuleIds.includes(ruleId)) {
    return { allowed: true, reason: 'already_viewed', shouldRecord: false };
  }
  if (seenRuleIds.length < limit) {
    return { allowed: true, reason: 'free_available', shouldRecord: true };
  }
  return { allowed: false, reason: 'quota_exhausted', shouldRecord: false };
}

async function loadFreeConflictCheckRuleIdsWithLease(
  lease: HealthDataWriteOperationLease,
): Promise<string[]> {
  let raw: string | null = null;
  try {
    lease.assertCurrent();
    raw = await getPrivateItem(KEY);
    lease.assertCurrent();
  } catch {
    lease.assertCurrent();
    return [];
  }
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const normalized = normalizeRuleIds(parsed);
    lease.assertCurrent();
    if (didNormalizeRuleIds(parsed, normalized)) {
      if (normalized.length > 0) {
        lease.assertCurrent();
        await setPrivateItem(KEY, JSON.stringify(normalized)).catch(() => undefined);
      } else {
        lease.assertCurrent();
        await removePrivateItem(KEY).catch(() => undefined);
      }
      lease.assertCurrent();
    }
    lease.assertCurrent();
    return normalized;
  } catch {
    lease.assertCurrent();
    // This is the store's established explicit repair policy. It remains
    // purpose-authorized and cannot dispatch after its exact lease changes.
    await removePrivateItem(KEY).catch(() => undefined);
    lease.assertCurrent();
    return [];
  }
}

export async function loadFreeConflictCheckRuleIds(): Promise<string[]> {
  return runCurrentHealthDataOperation((lease) => loadFreeConflictCheckRuleIdsWithLease(lease));
}

export async function recordFreeConflictCheckRuleId(ruleId: string): Promise<string[]> {
  return runCurrentHealthDataOperation(async (lease) => {
    const normalizedRuleId = ruleId.trim();
    const seen = await loadFreeConflictCheckRuleIdsWithLease(lease);
    lease.assertCurrent();
    if (!normalizedRuleId) return seen;
    const next = seen.includes(normalizedRuleId) ? seen : [...seen, normalizedRuleId];
    lease.assertCurrent();
    await setPrivateItem(KEY, JSON.stringify(next));
    lease.assertCurrent();
    return next;
  });
}
