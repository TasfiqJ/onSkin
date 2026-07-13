import type { NotificationKind, NotificationTier } from '@onskin/types';
import { getPrivateItem, removePrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';

import { TIER_OF, tierOf } from './policy';

// Local-first record of behavioural/promotional notifications actually sent
// (docs/07 §9 frequency caps). The server `notification_log` table is the
// deferred sync target (B-SUPABASE), but offline it returns 0, which would make
// the per-tier weekly cap a no-op and let a foreground trigger fire on every app
// open. This AsyncStorage log is the v1 SOURCE OF TRUTH for the cap (D-029),
// unioned with the server count so the cap holds with or without a backend.
const KEY = 'onskin.notiflog.v1';
const SCHEMA_VERSION = 1 as const;

export const SENT_LEDGER_INVALID = 'SENT_LEDGER_INVALID';
export const SENT_LEDGER_UNSUPPORTED_VERSION = 'SENT_LEDGER_UNSUPPORTED_VERSION';
export const SENT_LEDGER_FAIL_CLOSED_COUNT = Number.MAX_SAFE_INTEGER;

type SentRecord = { kind: NotificationKind; tier: NotificationTier; at: number }; // at = epoch ms
type SentLedgerEnvelope = {
  version: typeof SCHEMA_VERSION;
  records: SentRecord[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNotificationKind(value: unknown): value is NotificationKind {
  return typeof value === 'string' && value in TIER_OF;
}

function normalizeSentRecord(value: unknown, strict: boolean): SentRecord | null {
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

function decodeRecords(value: unknown, strict: boolean): SentRecord[] {
  if (!Array.isArray(value)) throw new Error(SENT_LEDGER_INVALID);
  const items: SentRecord[] = [];
  for (const row of value) {
    const normalized = normalizeSentRecord(row, strict);
    if (!normalized) throw new Error(SENT_LEDGER_INVALID);
    items.push(normalized);
  }
  return items;
}

function decodeSentLedger(raw: string | null): SentRecord[] {
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(SENT_LEDGER_INVALID);
  }
  if (Array.isArray(parsed)) return decodeRecords(parsed, false);
  if (!isRecord(parsed)) throw new Error(SENT_LEDGER_INVALID);
  if (parsed.version !== SCHEMA_VERSION) {
    if (
      typeof parsed.version === 'number' &&
      Number.isSafeInteger(parsed.version) &&
      parsed.version > SCHEMA_VERSION
    ) {
      throw new Error(SENT_LEDGER_UNSUPPORTED_VERSION);
    }
    throw new Error(SENT_LEDGER_INVALID);
  }
  const keys = Object.keys(parsed).sort();
  if (keys.length !== 2 || keys[0] !== 'records' || keys[1] !== 'version') {
    throw new Error(SENT_LEDGER_INVALID);
  }
  return decodeRecords(parsed.records, true);
}

function encodeSentLedger(records: SentRecord[]): string {
  return JSON.stringify({ version: SCHEMA_VERSION, records } satisfies SentLedgerEnvelope);
}

async function load(): Promise<SentRecord[] | null> {
  try {
    return decodeSentLedger(await getPrivateItem(KEY));
  } catch {
    // A missing cap ledger is empty. An unreadable/unavailable one must block
    // optional sends instead of failing open and allowing notification spam.
    return null;
  }
}

/** Record a sent notification locally, pruning entries older than ~30 days. */
export async function recordSentLocal(kind: NotificationKind, now: number): Promise<void> {
  const cutoff = now - 30 * 86_400_000;
  await updatePrivateItem(KEY, (current) => {
    const records = decodeSentLedger(current).filter((record) => {
      return record.at >= cutoff && record.at <= now;
    });
    records.push({ kind, tier: tierOf(kind), at: now });
    return encodeSentLedger(records);
  });
}

/** How many notifications of a tier were sent locally in the last 7 days. */
export async function sentThisWeekForTierLocal(
  tier: NotificationTier,
  now: number,
): Promise<number> {
  const weekAgo = now - 7 * 86_400_000;
  const records = await load();
  if (records === null) return SENT_LEDGER_FAIL_CLOSED_COUNT;
  return records.filter((record) => {
    return record.tier === tier && record.at >= weekAgo && record.at <= now;
  }).length;
}

/** Test/seed reset. */
export async function clearSentLocal(): Promise<void> {
  await removePrivateItem(KEY);
}
