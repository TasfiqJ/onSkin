import type { NotificationKind, NotificationTier } from '@onskin/types';
import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

import { TIER_OF, tierOf } from './policy';

// Local-first record of behavioural/promotional notifications actually sent
// (docs/07 §9 frequency caps). The server `notification_log` table is the
// deferred sync target (B-SUPABASE), but offline it returns 0, which would make
// the per-tier weekly cap a no-op and let a foreground trigger fire on every app
// open. This AsyncStorage log is the v1 SOURCE OF TRUTH for the cap (D-029),
// unioned with the server count so the cap holds with or without a backend.
const KEY = 'onskin.notiflog.v1';

type SentRecord = { kind: NotificationKind; tier: NotificationTier; at: number }; // at = epoch ms

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNotificationKind(value: unknown): value is NotificationKind {
  return typeof value === 'string' && value in TIER_OF;
}

function normalizeSentRecord(value: unknown): SentRecord | null {
  if (!isRecord(value) || !isNotificationKind(value.kind)) return null;
  return typeof value.at === 'number' && Number.isFinite(value.at)
    ? { kind: value.kind, tier: tierOf(value.kind), at: value.at }
    : null;
}

function normalizeSentRecords(value: unknown): { items: SentRecord[]; changed: boolean } | null {
  if (!Array.isArray(value)) return null;
  const items: SentRecord[] = [];
  let changed = false;
  for (const row of value) {
    const normalized = normalizeSentRecord(row);
    if (!normalized) {
      changed = true;
      continue;
    }
    items.push(normalized);
    changed ||= JSON.stringify(normalized) !== JSON.stringify(row);
  }
  return { items, changed };
}

async function load(): Promise<SentRecord[]> {
  let raw: string | null = null;
  try {
    raw = await getPrivateItem(KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const normalized = normalizeSentRecords(JSON.parse(raw) as unknown);
    if (!normalized) {
      await removePrivateItem(KEY).catch(() => undefined);
      return [];
    }
    if (normalized.changed) {
      if (normalized.items.length > 0) await save(normalized.items).catch(() => undefined);
      else await removePrivateItem(KEY).catch(() => undefined);
    }
    return normalized.items;
  } catch {
    await removePrivateItem(KEY).catch(() => undefined);
    return [];
  }
}

async function save(list: SentRecord[]): Promise<void> {
  await setPrivateItem(KEY, JSON.stringify(list));
}

async function pruneFutureRecords(list: SentRecord[], now: number): Promise<SentRecord[]> {
  const usable = list.filter((r) => r.at <= now);
  if (usable.length !== list.length) {
    if (usable.length > 0) await save(usable).catch(() => undefined);
    else await removePrivateItem(KEY).catch(() => undefined);
  }
  return usable;
}

/** Record a sent notification locally, pruning entries older than ~30 days. */
export async function recordSentLocal(kind: NotificationKind, now: number): Promise<void> {
  const cutoff = now - 30 * 86_400_000;
  const list = (await load()).filter((r) => r.at >= cutoff && r.at <= now);
  list.push({ kind, tier: tierOf(kind), at: now });
  await save(list);
}

/** How many notifications of a tier were sent locally in the last 7 days. */
export async function sentThisWeekForTierLocal(
  tier: NotificationTier,
  now: number,
): Promise<number> {
  const weekAgo = now - 7 * 86_400_000;
  const usable = await pruneFutureRecords(await load(), now);
  return usable.filter((r) => r.tier === tier && r.at >= weekAgo).length;
}

/** Test/seed reset. */
export async function clearSentLocal(): Promise<void> {
  await removePrivateItem(KEY);
}
