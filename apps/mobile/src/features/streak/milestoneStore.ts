import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

// Local record of milestones already celebrated (docs/07 §4.5), so the gentle
// marker fires its analytics event once per milestone rather than on every visit
// to the streak screen. Local-first (D-029); no server dependency.
const KEY = 'onskin.milestones.v1';

function uniqueKeys(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  ];
}

async function load(): Promise<string[]> {
  let raw: string | null = null;
  try {
    raw = await getPrivateItem(KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const normalized = uniqueKeys(parsed);
    if (!normalized) {
      await removePrivateItem(KEY).catch(() => undefined);
      return [];
    }
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      if (normalized.length > 0)
        await setPrivateItem(KEY, JSON.stringify(normalized)).catch(() => undefined);
      else await removePrivateItem(KEY).catch(() => undefined);
    }
    return normalized;
  } catch {
    await removePrivateItem(KEY).catch(() => undefined);
    return [];
  }
}

/** Mark a milestone seen. Returns true the first time (a fresh crossing), else false. */
export async function markMilestoneSeen(key: string): Promise<boolean> {
  const normalizedKey = key.trim();
  if (normalizedKey.length === 0) return false;
  const seen = await load();
  if (seen.includes(normalizedKey)) return false;
  try {
    await setPrivateItem(KEY, JSON.stringify([...seen, normalizedKey]));
    return true;
  } catch {
    return false;
  }
}

/** Test/seed reset. */
export async function clearMilestonesSeen(): Promise<void> {
  await removePrivateItem(KEY);
}
