import { removePrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';
import { decodePrivateStringSet, encodePrivateStringSet } from '@/lib/storage/privateStringSet';

// Local record of milestones already celebrated (docs/07 §4.5), so the gentle
// marker fires its analytics event once per milestone rather than on every visit
// to the streak screen. Local-first (D-029); no server dependency.
const KEY = 'onskin.milestones.v1';

/** Mark a milestone seen. Returns true the first time (a fresh crossing), else false. */
export async function markMilestoneSeen(key: string): Promise<boolean> {
  const normalizedKey = key.trim();
  if (normalizedKey.length === 0) return false;
  let alreadySeen = false;
  try {
    await updatePrivateItem(KEY, (current) => {
      const seen = decodePrivateStringSet(current);
      alreadySeen = seen.includes(normalizedKey);
      return encodePrivateStringSet(alreadySeen ? seen : [...seen, normalizedKey]);
    });
    return !alreadySeen;
  } catch {
    return false;
  }
}

/** Test/seed reset. */
export async function clearMilestonesSeen(): Promise<void> {
  await removePrivateItem(KEY);
}
