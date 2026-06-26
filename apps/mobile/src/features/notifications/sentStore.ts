import AsyncStorage from '@react-native-async-storage/async-storage';

import type { NotificationKind, NotificationTier } from '@onskin/types';

import { tierOf } from './policy';

// Local-first record of behavioural/promotional notifications actually sent
// (docs/07 §9 frequency caps). The server `notification_log` table is the
// deferred sync target (B-SUPABASE), but offline it returns 0, which would make
// the per-tier weekly cap a no-op and let a foreground trigger fire on every app
// open. This AsyncStorage log is the v1 SOURCE OF TRUTH for the cap (D-029),
// unioned with the server count so the cap holds with or without a backend.
const KEY = 'onskin.notiflog.v1';

type SentRecord = { kind: NotificationKind; tier: NotificationTier; at: number }; // at = epoch ms

async function load(): Promise<SentRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as SentRecord[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function save(list: SentRecord[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

/** Record a sent notification locally, pruning entries older than ~30 days. */
export async function recordSentLocal(kind: NotificationKind, now: number): Promise<void> {
  const cutoff = now - 30 * 86_400_000;
  const list = (await load()).filter((r) => r.at >= cutoff);
  list.push({ kind, tier: tierOf(kind), at: now });
  await save(list);
}

/** How many notifications of a tier were sent locally in the last 7 days. */
export async function sentThisWeekForTierLocal(
  tier: NotificationTier,
  now: number,
): Promise<number> {
  const weekAgo = now - 7 * 86_400_000;
  return (await load()).filter((r) => r.tier === tier && r.at >= weekAgo).length;
}

/** Test/seed reset. */
export async function clearSentLocal(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
