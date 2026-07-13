import { getPrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';

const KEY = 'onskin.subscription.freeConflictCheckRuleIds.v1';
const SCHEMA_VERSION = 1 as const;

export const CONFLICT_QUOTA_INVALID = 'CONFLICT_QUOTA_INVALID';
export const CONFLICT_QUOTA_UNSUPPORTED_VERSION = 'CONFLICT_QUOTA_UNSUPPORTED_VERSION';
export const FREE_CONFLICT_CHECK_LIMIT = 1;

type ConflictQuotaEnvelope = {
  schemaVersion: typeof SCHEMA_VERSION;
  ruleIds: string[];
};

export type ConflictQuotaRead =
  | { status: 'missing'; ruleIds: [] }
  | { status: 'available'; ruleIds: string[]; format: 'current' | 'legacy' }
  | { status: 'unavailable' | 'corrupt' | 'unsupported_version'; ruleIds: null };

export type ConflictCheckAccess = {
  allowed: boolean;
  reason: 'pro' | 'already_viewed' | 'free_available' | 'quota_exhausted' | 'quota_unavailable';
  shouldRecord: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function normalizeRuleIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ruleIds: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const ruleId = item.trim();
    if (!ruleId) return null;
    if (!ruleIds.includes(ruleId)) ruleIds.push(ruleId);
  }
  return ruleIds;
}

function sameRuleIds(left: readonly unknown[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((ruleId, index) => ruleId === right[index]);
}

function quotaError(code: string): Error {
  return new Error(code);
}

function decodeConflictQuota(raw: string): {
  format: 'current' | 'legacy';
  ruleIds: string[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw quotaError(CONFLICT_QUOTA_INVALID);
  }

  // The original v1 payload was a bare array. It remains readable in memory,
  // but only an explicit quota mutation may upgrade it to the current envelope.
  if (Array.isArray(parsed)) {
    const ruleIds = normalizeRuleIds(parsed);
    if (!ruleIds) throw quotaError(CONFLICT_QUOTA_INVALID);
    return { format: 'legacy', ruleIds };
  }

  if (!isRecord(parsed)) throw quotaError(CONFLICT_QUOTA_INVALID);
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    if (
      typeof parsed.schemaVersion === 'number' &&
      Number.isSafeInteger(parsed.schemaVersion) &&
      parsed.schemaVersion > SCHEMA_VERSION
    ) {
      throw quotaError(CONFLICT_QUOTA_UNSUPPORTED_VERSION);
    }
    throw quotaError(CONFLICT_QUOTA_INVALID);
  }
  if (!hasExactKeys(parsed, ['schemaVersion', 'ruleIds'])) {
    throw quotaError(CONFLICT_QUOTA_INVALID);
  }
  const ruleIds = normalizeRuleIds(parsed.ruleIds);
  if (!ruleIds || !sameRuleIds(parsed.ruleIds as unknown[], ruleIds)) {
    throw quotaError(CONFLICT_QUOTA_INVALID);
  }
  return { format: 'current', ruleIds };
}

function encodeConflictQuota(ruleIds: string[]): string {
  return JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    ruleIds,
  } satisfies ConflictQuotaEnvelope);
}

function classifyQuotaError(error: unknown): ConflictQuotaRead {
  const message = error instanceof Error ? error.message : '';
  if (message === CONFLICT_QUOTA_UNSUPPORTED_VERSION || message.includes('UNSUPPORTED')) {
    return { status: 'unsupported_version', ruleIds: null };
  }
  if (
    message === CONFLICT_QUOTA_INVALID ||
    message === 'PRIVATE_KV_ENVELOPE_INVALID' ||
    message === 'PRIVATE_KV_DECRYPTION_FAILED'
  ) {
    return { status: 'corrupt', ruleIds: null };
  }
  return { status: 'unavailable', ruleIds: null };
}

export function conflictCheckAccess(input: {
  isPro: boolean;
  ruleId: string;
  seenRuleIds: readonly string[];
  limit?: number;
  quotaAvailable?: boolean;
}): ConflictCheckAccess {
  if (input.isPro) return { allowed: true, reason: 'pro', shouldRecord: false };
  if (input.quotaAvailable === false) {
    return { allowed: false, reason: 'quota_unavailable', shouldRecord: false };
  }

  const limit = input.limit ?? FREE_CONFLICT_CHECK_LIMIT;
  const ruleId = input.ruleId.trim();
  const seenRuleIds = normalizeRuleIds(input.seenRuleIds);
  if (!ruleId || !seenRuleIds) {
    return { allowed: false, reason: 'quota_unavailable', shouldRecord: false };
  }
  if (seenRuleIds.includes(ruleId)) {
    return { allowed: true, reason: 'already_viewed', shouldRecord: false };
  }
  if (seenRuleIds.length < limit) {
    return { allowed: true, reason: 'free_available', shouldRecord: true };
  }
  return { allowed: false, reason: 'quota_exhausted', shouldRecord: false };
}

/** Read-only quota inspection. Corrupt, future, and unreadable bytes are never
 * repaired, deleted, or translated into an unused quota. */
export async function loadFreeConflictCheckRuleIds(): Promise<ConflictQuotaRead> {
  let raw: string | null;
  try {
    raw = await getPrivateItem(KEY);
  } catch (error) {
    return classifyQuotaError(error);
  }
  if (raw === null) return { status: 'missing', ruleIds: [] };
  try {
    const decoded = decodeConflictQuota(raw);
    return { status: 'available', ...decoded };
  } catch (error) {
    return classifyQuotaError(error);
  }
}

/** Atomically claim the one free conflict check. The quota limit is enforced
 * inside the same-key transform, so concurrent distinct claims cannot both win. */
export async function recordFreeConflictCheckRuleId(ruleId: string): Promise<ConflictQuotaRead> {
  const normalizedRuleId = ruleId.trim();
  if (!normalizedRuleId) return loadFreeConflictCheckRuleIds();

  let nextRuleIds: string[] | null = null;
  try {
    await updatePrivateItem(KEY, (current) => {
      const decoded = current === null ? null : decodeConflictQuota(current);
      const ruleIds = decoded?.ruleIds ?? [];
      nextRuleIds =
        ruleIds.includes(normalizedRuleId) || ruleIds.length >= FREE_CONFLICT_CHECK_LIMIT
          ? ruleIds
          : [...ruleIds, normalizedRuleId];

      if (current !== null && decoded?.format === 'current' && sameRuleIds(ruleIds, nextRuleIds)) {
        return current;
      }
      return encodeConflictQuota(nextRuleIds);
    });
  } catch (error) {
    return classifyQuotaError(error);
  }

  return nextRuleIds
    ? { status: 'available', format: 'current', ruleIds: nextRuleIds }
    : { status: 'unavailable', ruleIds: null };
}
