import type { NotificationKind, NotificationTier } from '@onskin/types';
import {
  runCurrentHealthDataOperation,
  type HealthDataWriteOperationLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { getPrivateItem, removePrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';

import { TIER_OF, tierOf, WEEKLY_CAP } from './policy';

// Device-local record of behavioural/promotional scheduling attempts (docs/07
// §9 frequency caps). Remote sync remains closed pending CAT-09 privacy and
// consent approval. The encrypted device ledger is the source of truth for the
// current-device cap and prevents a foreground trigger from firing on every app
// open.
const KEY = 'onskin.notiflog.v1';
const SCHEMA_VERSION = 1 as const;

export const ATTEMPT_LEDGER_INVALID = 'ATTEMPT_LEDGER_INVALID';
export const ATTEMPT_LEDGER_UNSUPPORTED_VERSION = 'ATTEMPT_LEDGER_UNSUPPORTED_VERSION';
export const ATTEMPT_LEDGER_FAIL_CLOSED_COUNT = Number.MAX_SAFE_INTEGER;

type SchedulingAttemptRecord = {
  kind: NotificationKind;
  tier: NotificationTier;
  at: number;
}; // at = epoch ms
type SchedulingAttemptLedgerEnvelope = {
  version: typeof SCHEMA_VERSION;
  records: SchedulingAttemptRecord[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNotificationKind(value: unknown): value is NotificationKind {
  return typeof value === 'string' && value in TIER_OF;
}

function normalizeSchedulingAttempt(
  value: unknown,
  strict: boolean,
): SchedulingAttemptRecord | null {
  if (!isRecord(value) || !isNotificationKind(value.kind)) return null;
  if (strict) {
    const keys = Object.keys(value).sort();
    if (keys.length !== 3 || keys[0] !== 'at' || keys[1] !== 'kind' || keys[2] !== 'tier') {
      return null;
    }
    if (value.tier !== tierOf(value.kind)) return null;
  }
  return typeof value.at === 'number' && Number.isFinite(value.at) && value.at >= 0
    ? { kind: value.kind, tier: tierOf(value.kind), at: value.at }
    : null;
}

function decodeRecords(value: unknown, strict: boolean): SchedulingAttemptRecord[] {
  if (!Array.isArray(value)) throw new Error(ATTEMPT_LEDGER_INVALID);
  const items: SchedulingAttemptRecord[] = [];
  for (const row of value) {
    const normalized = normalizeSchedulingAttempt(row, strict);
    if (!normalized) throw new Error(ATTEMPT_LEDGER_INVALID);
    items.push(normalized);
  }
  return items;
}

function decodeAttemptLedger(raw: string | null): SchedulingAttemptRecord[] {
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(ATTEMPT_LEDGER_INVALID);
  }
  if (Array.isArray(parsed)) return decodeRecords(parsed, false);
  if (!isRecord(parsed)) throw new Error(ATTEMPT_LEDGER_INVALID);
  if (parsed.version !== SCHEMA_VERSION) {
    if (
      typeof parsed.version === 'number' &&
      Number.isSafeInteger(parsed.version) &&
      parsed.version > SCHEMA_VERSION
    ) {
      throw new Error(ATTEMPT_LEDGER_UNSUPPORTED_VERSION);
    }
    throw new Error(ATTEMPT_LEDGER_INVALID);
  }
  const keys = Object.keys(parsed).sort();
  if (keys.length !== 2 || keys[0] !== 'records' || keys[1] !== 'version') {
    throw new Error(ATTEMPT_LEDGER_INVALID);
  }
  return decodeRecords(parsed.records, true);
}

function encodeAttemptLedger(records: SchedulingAttemptRecord[]): string {
  return JSON.stringify({
    version: SCHEMA_VERSION,
    records,
  } satisfies SchedulingAttemptLedgerEnvelope);
}

async function load(
  lease: HealthDataWriteOperationLease,
): Promise<SchedulingAttemptRecord[] | null> {
  try {
    lease.assertCurrent();
    const raw = await getPrivateItem(KEY);
    lease.assertCurrent();
    const records = decodeAttemptLedger(raw);
    lease.assertCurrent();
    return records;
  } catch {
    // A missing cap ledger is empty. An unreadable/unavailable one must block
    // optional sends instead of failing open and allowing notification spam.
    lease.assertCurrent();
    return null;
  }
}

/**
 * Atomically reserve one device-local scheduling attempt under the rolling
 * seven-day tier cap. The reservation lands before the native schedule call so
 * concurrent callers, process death, or an ambiguous native failure cannot
 * create an uncounted optional notification. A failed native call may therefore
 * conservatively consume capacity; this ledger is not delivery/open proof.
 */
export async function reserveNotificationSlotLocal(
  kind: NotificationKind,
  now: number,
): Promise<boolean> {
  const cutoff = now - 30 * 86_400_000;
  const weekAgo = now - 7 * 86_400_000;
  const tier = tierOf(kind);
  let reserved = false;
  await runCurrentHealthDataOperation(async (lease) => {
    lease.assertCurrent();
    await updatePrivateItem(KEY, (current) => {
      lease.assertCurrent();
      const records = decodeAttemptLedger(current).filter((record) => {
        return record.at >= cutoff && record.at <= now;
      });
      const used = records.filter((record) => {
        return record.tier === tier && record.at >= weekAgo;
      }).length;
      if (used >= WEEKLY_CAP[tier]) return current;
      records.push({ kind, tier, at: now });
      reserved = true;
      lease.assertCurrent();
      return encodeAttemptLedger(records);
    });
    lease.assertCurrent();
  });
  return reserved;
}

/** How many scheduling attempts a tier reserved locally in the last 7 days. */
export async function schedulingAttemptsThisWeekForTierLocal(
  tier: NotificationTier,
  now: number,
): Promise<number> {
  return runCurrentHealthDataOperation(async (lease) => {
    const weekAgo = now - 7 * 86_400_000;
    const records = await load(lease);
    lease.assertCurrent();
    if (records === null) {
      lease.assertCurrent();
      return ATTEMPT_LEDGER_FAIL_CLOSED_COUNT;
    }
    const count = records.filter((record) => {
      return record.tier === tier && record.at >= weekAgo && record.at <= now;
    }).length;
    lease.assertCurrent();
    return count;
  });
}

/** Test/seed reset. */
export async function clearSentLocal(): Promise<void> {
  // Closed-consent cleanup: deletion is account-scoped and never reads plaintext.
  await removePrivateItem(KEY);
}
