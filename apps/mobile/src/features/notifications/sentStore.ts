import type { NotificationKind, NotificationTier } from '@onskin/types';

import {
  readPrivateItem,
  removePrivateItem,
  updatePrivateItem,
  updatePrivateItemsTransactionally,
  type PrivateKVReadFailureReason,
} from '@/lib/storage/privateKV';
import {
  OUTBOX_STORAGE_KEY,
  decodeOutboxEnvelope,
  encodeOutboxEnvelope,
  enqueueNotificationDeliveryOutboxOperation,
  type OutboxPayload,
} from '@/lib/offline/outbox.pure';
import { hashOutboxOwner } from '@/lib/offline/outboxIdentity';

import { TIER_OF, tierOf } from './policy';

// Local-first record of behavioural/promotional immediate schedules accepted by the OS
// (docs/07 §9 frequency caps). The server `notification_log` table is the
// deferred sync target (B-SUPABASE), but offline it returns 0, which would make
// the per-tier weekly cap a no-op and let a foreground trigger fire on every app
// open. This private ledger remains the local source of truth for the cap.
export const SENT_LEDGER_KEY = 'onskin.notiflog.v1';
const SCHEMA_VERSION = 2 as const;
const RETENTION_MS = 30 * 86_400_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A defensive ceiling well above any legitimate 30-day notification cadence. */
export const MAX_SENT_LEDGER_RECORDS = 512;
export const MAX_SENT_LEDGER_CHARS = 131_072;

export const SENT_LEDGER_INVALID = 'SENT_LEDGER_INVALID';
export const SENT_LEDGER_UNSUPPORTED_VERSION = 'SENT_LEDGER_UNSUPPORTED_VERSION';
export const SENT_LEDGER_WRITE_UNCERTAIN = 'SENT_LEDGER_WRITE_UNCERTAIN';
let compatibilityEventCounter = 0;

export type SentRecord = {
  eventId: string;
  kind: NotificationKind;
  tier: NotificationTier;
  at: number;
  state: 'delivered' | 'reserved';
};

type SentLedgerEnvelope = {
  version: typeof SCHEMA_VERSION;
  records: SentRecord[];
};

type SentLedgerFormat = 'v0' | 'v1' | 'v2';
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

export type NotificationDeliveryOwner = Readonly<{
  ownerId: string;
  ownerGeneration: number;
  assertCurrent?: () => void;
}>;

export type ConfirmSentDeliveryResult = Readonly<{
  changed: boolean;
  outboxQueued: boolean;
}>;

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

function legacyEventId(record: Readonly<{ kind: NotificationKind; at: number }>, index: number) {
  const low = (record.at % 0x1_0000_0000).toString(16).padStart(8, '0');
  const high = Math.floor(record.at / 0x1_0000_0000)
    .toString(16)
    .padStart(4, '0')
    .slice(-4);
  const kind = Object.keys(TIER_OF).indexOf(record.kind).toString(16);
  const position = index.toString(16).padStart(3, '0').slice(-3);
  return `${low}-${high}-4000-8${kind}${position.slice(-2)}-${position}000000000`;
}

function normalizeSentRecord(
  value: unknown,
  format: SentLedgerFormat,
  index: number,
): SentRecord | null {
  const legacy = format === 'v0' || format === 'v1';
  if (!isRecord(value)) return null;
  if (
    (legacy
      ? !hasExactKeys(value, ['kind', 'tier', 'at'])
      : !hasExactKeys(value, ['eventId', 'kind', 'tier', 'at', 'state'])) ||
    !isNotificationKind(value.kind) ||
    !isNotificationTier(value.tier) ||
    !isEpochMilliseconds(value.at)
  ) {
    return null;
  }

  const canonicalTier = tierOf(value.kind);
  // v0 persisted the tier redundantly and some released records carried the
  // wrong-but-valid tier. Preserve that compatibility while canonicalizing it
  // in memory. Every versioned envelope is strict.
  if (format !== 'v0' && value.tier !== canonicalTier) return null;
  if (
    !legacy &&
    (typeof value.eventId !== 'string' ||
      !UUID.test(value.eventId) ||
      (value.state !== 'reserved' && value.state !== 'delivered'))
  ) {
    return null;
  }
  return {
    eventId: legacy
      ? legacyEventId({ kind: value.kind, at: value.at }, index)
      : (value.eventId as string),
    kind: value.kind,
    tier: canonicalTier,
    at: value.at,
    state: legacy ? 'delivered' : (value.state as 'delivered' | 'reserved'),
  };
}

function decodeRecords(value: unknown, format: SentLedgerFormat): SentRecord[] {
  if (!Array.isArray(value) || value.length > MAX_SENT_LEDGER_RECORDS) {
    throw sentLedgerError(SENT_LEDGER_INVALID);
  }

  const records = value.map((row, index) => {
    const normalized = normalizeSentRecord(row, format, index);
    if (!normalized) throw sentLedgerError(SENT_LEDGER_INVALID);
    return normalized;
  });
  if (new Set(records.map((record) => record.eventId)).size !== records.length) {
    throw sentLedgerError(SENT_LEDGER_INVALID);
  }
  return records;
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

  if (parsed.version !== 1 && parsed.version !== SCHEMA_VERSION) {
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
  const format = parsed.version === 1 ? 'v1' : 'v2';
  return { records: decodeRecords(parsed.records, format), format };
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
    stored = await readPrivateItem(SENT_LEDGER_KEY);
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

function confirmExactWrite(expectedRaw: string): Promise<void> {
  return readPrivateItem(SENT_LEDGER_KEY).then((confirmation) => {
    if (confirmation.status !== 'available' || confirmation.value !== expectedRaw) {
      throw sentLedgerError(SENT_LEDGER_WRITE_UNCERTAIN);
    }
  });
}

function retainedRecords(current: string | null, now: number, reserve: number): SentRecord[] {
  const cutoff = Math.max(0, now - RETENTION_MS);
  return decodeSentLedger(current)
    .records.filter((record) => record.at >= cutoff && record.at <= now)
    .sort((left, right) => left.at - right.at || left.eventId.localeCompare(right.eventId))
    .slice(-(MAX_SENT_LEDGER_RECORDS - reserve));
}

/** Reserve a cap slot before native delivery. Both reserved and delivered rows count. */
export async function reserveSentLocal(
  eventId: string,
  kind: NotificationKind,
  now: number,
): Promise<void> {
  if (!UUID.test(eventId)) throw sentLedgerError(SENT_LEDGER_INVALID);
  assertNotificationKind(kind);
  assertEpochMilliseconds(now);

  let expectedRaw: string | null = null;
  try {
    await updatePrivateItem(SENT_LEDGER_KEY, (current) => {
      const retained = retainedRecords(current, now, 1);
      const existing = retained.find((record) => record.eventId === eventId);
      if (existing) {
        if (existing.kind === kind && existing.at === now) {
          expectedRaw = current;
          return current;
        }
        throw sentLedgerError(SENT_LEDGER_INVALID);
      }
      retained.push({ eventId, kind, tier: tierOf(kind), at: now, state: 'reserved' });
      expectedRaw = encodeSentLedger(retained);
      return expectedRaw;
    });
  } catch (error) {
    if (expectedRaw === null) throw error;
    try {
      await confirmExactWrite(expectedRaw);
    } catch {
      throw sentLedgerError(SENT_LEDGER_WRITE_UNCERTAIN);
    }
  }
}

/** After the OS accepts a notification, confirm the local row and append its
 * authenticated outbox event in one crash-recoverable encrypted transaction. */
export async function confirmSentLocalDelivery(
  input: Readonly<{
    eventId: string;
    operationId: string;
    kind: NotificationKind;
    at: number;
    owner?: NotificationDeliveryOwner;
  }>,
): Promise<ConfirmSentDeliveryResult> {
  if (!UUID.test(input.eventId) || !UUID.test(input.operationId)) {
    throw sentLedgerError(SENT_LEDGER_INVALID);
  }
  assertNotificationKind(input.kind);
  assertEpochMilliseconds(input.at);
  const normalizedOwnerId = input.owner?.ownerId.trim();
  if (
    input.owner &&
    (!normalizedOwnerId ||
      input.owner.ownerId !== normalizedOwnerId ||
      normalizedOwnerId.length > 512)
  ) {
    throw sentLedgerError(SENT_LEDGER_INVALID);
  }
  input.owner?.assertCurrent?.();
  const ownerHash = normalizedOwnerId ? await hashOutboxOwner(normalizedOwnerId) : null;
  input.owner?.assertCurrent?.();

  let changed = false;
  let outboxQueued = false;
  let expectedLedgerRaw: string | null | undefined;
  let expectedOutboxRaw: string | null | undefined;
  const updateLedger = (current: string | null): string | null => {
    const decoded = decodeSentLedger(current);
    const index = decoded.records.findIndex((record) => record.eventId === input.eventId);
    if (index < 0) throw sentLedgerError(SENT_LEDGER_WRITE_UNCERTAIN);
    const record = decoded.records[index]!;
    if (record.kind !== input.kind || record.at !== input.at) {
      throw sentLedgerError(SENT_LEDGER_INVALID);
    }
    if (record.state === 'delivered' && decoded.format === 'v2') {
      expectedLedgerRaw = current;
      return current;
    }
    const records = [...decoded.records];
    records[index] = { ...record, state: 'delivered' };
    expectedLedgerRaw = encodeSentLedger(records);
    changed = true;
    return expectedLedgerRaw;
  };

  try {
    if (input.owner && ownerHash) {
      await updatePrivateItemsTransactionally([SENT_LEDGER_KEY, OUTBOX_STORAGE_KEY], (current) => {
        input.owner?.assertCurrent?.();
        const nextLedgerRaw = updateLedger(current.get(SENT_LEDGER_KEY) ?? null);
        const currentOutboxRaw = current.get(OUTBOX_STORAGE_KEY) ?? null;
        let nextOutboxRaw = currentOutboxRaw;
        if (changed) {
          const payload: OutboxPayload = Object.freeze({
            kind: input.kind,
            tier: tierOf(input.kind),
            sent_at: new Date(input.at).toISOString(),
          });
          nextOutboxRaw = encodeOutboxEnvelope(
            enqueueNotificationDeliveryOutboxOperation(decodeOutboxEnvelope(currentOutboxRaw), {
              operationId: input.operationId,
              ownerHash,
              ownerGeneration: input.owner!.ownerGeneration,
              entityId: input.eventId,
              payload,
              enqueuedAt: new Date(input.at).toISOString(),
            }).envelope,
          );
          outboxQueued = true;
        }
        expectedOutboxRaw = nextOutboxRaw;
        return new Map<string, string | null>([
          [SENT_LEDGER_KEY, nextLedgerRaw],
          [OUTBOX_STORAGE_KEY, nextOutboxRaw],
        ]);
      });
    } else {
      await updatePrivateItem(SENT_LEDGER_KEY, updateLedger);
    }
  } catch (error) {
    if (typeof expectedLedgerRaw !== 'string') throw error;
    try {
      await confirmExactWrite(expectedLedgerRaw);
      if (input.owner && expectedOutboxRaw !== undefined) {
        const confirmation = await readPrivateItem(OUTBOX_STORAGE_KEY);
        const matches =
          expectedOutboxRaw === null
            ? confirmation.status === 'absent'
            : confirmation.status === 'available' && confirmation.value === expectedOutboxRaw;
        if (!matches) throw sentLedgerError(SENT_LEDGER_WRITE_UNCERTAIN);
      }
    } catch {
      throw sentLedgerError(SENT_LEDGER_WRITE_UNCERTAIN);
    }
  }
  input.owner?.assertCurrent?.();
  return Object.freeze({ changed, outboxQueued });
}

/** Compatibility helper for local-only callers/tests. */
export async function recordSentLocal(kind: NotificationKind, now: number): Promise<void> {
  const eventId = legacyEventId({ kind, at: now }, compatibilityEventCounter % 4096);
  compatibilityEventCounter += 1;
  await reserveSentLocal(eventId, kind, now);
  await confirmSentLocalDelivery({ eventId, operationId: eventId, kind, at: now });
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
  await removePrivateItem(SENT_LEDGER_KEY);
}
