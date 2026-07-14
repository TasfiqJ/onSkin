import type { NotificationKind, NotificationTier } from '@onskin/types';

import {
  readPrivateItem,
  removePrivateItem,
  updatePrivateItem,
  type PrivateKVReadFailureReason,
} from '@/lib/storage/privateKV';

import { TIER_OF, tierOf } from './policy';

// Local-first record of behavioural/promotional notifications actually sent
// (docs/07 §9 frequency caps). The server `notification_log` table is the
// deferred sync target (B-SUPABASE), but offline it returns 0, which would make
// the per-tier weekly cap a no-op and let a foreground trigger fire on every app
// open. This private ledger remains the local source of truth for the cap.
const KEY = 'onskin.notiflog.v1';
const SCHEMA_VERSION = 1 as const;
const RETENTION_MS = 30 * 86_400_000;

/** A defensive ceiling well above any legitimate 30-day notification cadence. */
export const MAX_SENT_LEDGER_RECORDS = 512;
export const MAX_SENT_LEDGER_CHARS = 131_072;

export const SENT_LEDGER_INVALID = 'SENT_LEDGER_INVALID';
export const SENT_LEDGER_UNSUPPORTED_VERSION = 'SENT_LEDGER_UNSUPPORTED_VERSION';
export const SENT_LEDGER_WRITE_UNCERTAIN = 'SENT_LEDGER_WRITE_UNCERTAIN';

export type SentRecord = {
  kind: NotificationKind;
  tier: NotificationTier;
  at: number;
};

type SentLedgerEnvelope = {
  version: typeof SCHEMA_VERSION;
  records: SentRecord[];
};

type SentLedgerFormat = 'v0' | 'v1';
type SentLedgerCorruptReason =
  | 'content_key_invalid'
  | 'envelope_invalid'
  | 'decryption_failed'
  | 'invalid_payload';

export type SentLedgerRead =
  | { status: 'absent'; records: SentRecord[] }
  | { status: 'available'; records: SentRecord[]; format: SentLedgerFormat }
  | {
      status: 'unavailable';
      records: null;
      reason: PrivateKVReadFailureReason;
    }
  | { status: 'corrupt'; records: null; reason: SentLedgerCorruptReason }
  | { status: 'unsupported_version'; records: null };

export type SentTierCountRead =
  | { status: 'absent'; count: 0 }
  | { status: 'available'; count: number }
  | {
      status: 'unavailable';
      count: null;
      reason: PrivateKVReadFailureReason;
    }
  | { status: 'corrupt'; count: null; reason: SentLedgerCorruptReason }
  | { status: 'unsupported_version'; count: null };

type DecodedSentLedger = {
  format: SentLedgerFormat | 'absent';
  records: SentRecord[];
};

function sentLedgerError(code: string): Error {
  return new Error(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expected.length &&
    expected.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function isNotificationKind(value: unknown): value is NotificationKind {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TIER_OF, value);
}

function isNotificationTier(value: unknown): value is NotificationTier {
  return value === 'utility' || value === 'behavioural' || value === 'promotional';
}

function isEpochMilliseconds(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function assertNotificationKind(kind: NotificationKind): void {
  if (!isNotificationKind(kind)) throw sentLedgerError(SENT_LEDGER_INVALID);
}

function assertNotificationTier(tier: NotificationTier): void {
  if (!isNotificationTier(tier)) throw sentLedgerError(SENT_LEDGER_INVALID);
}

function assertEpochMilliseconds(value: number): void {
  if (!isEpochMilliseconds(value)) throw sentLedgerError(SENT_LEDGER_INVALID);
}

function normalizeSentRecord(value: unknown, format: SentLedgerFormat): SentRecord | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['kind', 'tier', 'at']) ||
    !isNotificationKind(value.kind) ||
    !isNotificationTier(value.tier) ||
    !isEpochMilliseconds(value.at)
  ) {
    return null;
  }

  const canonicalTier = tierOf(value.kind);
  // v0 persisted the tier redundantly and some released records carried the
  // wrong-but-valid tier. Preserve that compatibility while canonicalizing it
  // in memory. The versioned v1 envelope is strict.
  if (format === 'v1' && value.tier !== canonicalTier) return null;
  return { kind: value.kind, tier: canonicalTier, at: value.at };
}

function decodeRecords(value: unknown, format: SentLedgerFormat): SentRecord[] {
  if (!Array.isArray(value) || value.length > MAX_SENT_LEDGER_RECORDS) {
    throw sentLedgerError(SENT_LEDGER_INVALID);
  }

  return value.map((row) => {
    const normalized = normalizeSentRecord(row, format);
    if (!normalized) throw sentLedgerError(SENT_LEDGER_INVALID);
    return normalized;
  });
}

function decodeSentLedger(raw: string | null): DecodedSentLedger {
  if (raw === null) return { records: [], format: 'absent' };
  if (raw.length > MAX_SENT_LEDGER_CHARS) throw sentLedgerError(SENT_LEDGER_INVALID);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw sentLedgerError(SENT_LEDGER_INVALID);
  }

  // v0 was the unversioned record array. It remains readable and migrates only
  // during an explicit append.
  if (Array.isArray(parsed)) {
    return { records: decodeRecords(parsed, 'v0'), format: 'v0' };
  }
  if (!isRecord(parsed)) throw sentLedgerError(SENT_LEDGER_INVALID);

  if (parsed.version !== SCHEMA_VERSION) {
    if (
      typeof parsed.version === 'number' &&
      Number.isSafeInteger(parsed.version) &&
      parsed.version > SCHEMA_VERSION
    ) {
      throw sentLedgerError(SENT_LEDGER_UNSUPPORTED_VERSION);
    }
    throw sentLedgerError(SENT_LEDGER_INVALID);
  }
  if (!hasExactKeys(parsed, ['version', 'records'])) {
    throw sentLedgerError(SENT_LEDGER_INVALID);
  }
  return { records: decodeRecords(parsed.records, 'v1'), format: 'v1' };
}

function encodeSentLedger(records: SentRecord[]): string {
  if (records.length > MAX_SENT_LEDGER_RECORDS) {
    throw sentLedgerError(SENT_LEDGER_INVALID);
  }
  const encoded = JSON.stringify({ version: SCHEMA_VERSION, records } satisfies SentLedgerEnvelope);
  if (encoded.length > MAX_SENT_LEDGER_CHARS) throw sentLedgerError(SENT_LEDGER_INVALID);
  return encoded;
}

/** Read and classify the ledger without repairing, pruning, or migrating it. */
export async function readSentLedger(): Promise<SentLedgerRead> {
  let stored: Awaited<ReturnType<typeof readPrivateItem>>;
  try {
    stored = await readPrivateItem(KEY);
  } catch {
    return {
      status: 'unavailable',
      records: null,
      reason: 'storage_unavailable',
    };
  }

  if (stored.status === 'absent') return { status: 'absent', records: [] };
  if (stored.status === 'unavailable') {
    return { status: 'unavailable', records: null, reason: stored.reason };
  }
  if (stored.status === 'corrupt') {
    return { status: 'corrupt', records: null, reason: stored.reason };
  }
  if (stored.status === 'unsupported_version') {
    return { status: 'unsupported_version', records: null };
  }

  try {
    const decoded = decodeSentLedger(stored.value);
    if (decoded.format === 'absent') return { status: 'absent', records: [] };
    return { status: 'available', records: decoded.records, format: decoded.format };
  } catch (error) {
    return error instanceof Error && error.message === SENT_LEDGER_UNSUPPORTED_VERSION
      ? { status: 'unsupported_version', records: null }
      : { status: 'corrupt', records: null, reason: 'invalid_payload' };
  }
}

/** Record a sent notification locally, pruning and bounding history atomically. */
export async function recordSentLocal(kind: NotificationKind, now: number): Promise<void> {
  assertNotificationKind(kind);
  assertEpochMilliseconds(now);
  const cutoff = Math.max(0, now - RETENTION_MS);

  let expectedRaw: string | null = null;
  try {
    await updatePrivateItem(KEY, (current) => {
      const retained = decodeSentLedger(current)
        .records.filter((record) => record.at >= cutoff && record.at <= now)
        .sort((left, right) => left.at - right.at)
        .slice(-(MAX_SENT_LEDGER_RECORDS - 1));
      retained.push({ kind, tier: tierOf(kind), at: now });
      expectedRaw = encodeSentLedger(retained);
      return expectedRaw;
    });
  } catch (error) {
    if (expectedRaw === null) throw error;
    let confirmation: Awaited<ReturnType<typeof readPrivateItem>>;
    try {
      confirmation = await readPrivateItem(KEY);
    } catch {
      throw sentLedgerError(SENT_LEDGER_WRITE_UNCERTAIN);
    }
    if (confirmation.status !== 'available' || confirmation.value !== expectedRaw) {
      throw sentLedgerError(SENT_LEDGER_WRITE_UNCERTAIN);
    }
  }
}

/** Typed weekly count. Unreadable state is never converted into an empty count. */
export async function sentThisWeekForTierLocal(
  tier: NotificationTier,
  now: number,
): Promise<SentTierCountRead> {
  assertNotificationTier(tier);
  assertEpochMilliseconds(now);
  const weekAgo = Math.max(0, now - 7 * 86_400_000);
  const ledger = await readSentLedger();

  if (ledger.status === 'absent') return { status: 'absent', count: 0 };
  if (ledger.status === 'unavailable') {
    return { status: 'unavailable', count: null, reason: ledger.reason };
  }
  if (ledger.status === 'corrupt') {
    return { status: 'corrupt', count: null, reason: ledger.reason };
  }
  if (ledger.status === 'unsupported_version') {
    return { status: 'unsupported_version', count: null };
  }

  return {
    status: 'available',
    count: ledger.records.filter((record) => {
      return record.tier === tier && record.at >= weekAgo && record.at <= now;
    }).length,
  };
}

/** Test/seed reset. */
export async function clearSentLocal(): Promise<void> {
  await removePrivateItem(KEY);
}
