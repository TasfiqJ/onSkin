import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

// Local record of milestones already celebrated (docs/07 §4.5), so the gentle
// marker fires its analytics event once per milestone rather than on every visit
// to the streak screen. Local-first (D-029); no server dependency.
const KEY = 'onskin.milestones.v1';

async function load(): Promise<string[]> {
  try {
    const raw = await getPrivateItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Mark a milestone seen. Returns true the first time (a fresh crossing), else false. */
export async function markMilestoneSeen(key: string): Promise<boolean> {
  const seen = await load();
  if (seen.includes(key)) return false;
  try {
    await setPrivateItem(KEY, JSON.stringify([...seen, key]));
    return true;
  } catch {
    return false;
  }
}

/** Test/seed reset. */
export async function clearMilestonesSeen(): Promise<void> {
  await removePrivateItem(KEY);
}
