import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

// Local-first record of the structured "This helped" reactions (docs/11 §6/§10,
// the docs/09 flywheel signal). The server `community_reactions` table is the
// deferred sync target (B-COMMUNITY-MOD); this AsyncStorage set is the v1 source
// of truth (D-029) so the reaction survives navigation/remount instead of living
// only in component state. Stores note ids only, no content.
const KEY = 'onskin.community.reactions.v1';

async function load(): Promise<string[]> {
  try {
    const raw = await getPrivateItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function isNoteHelpful(id: string): Promise<boolean> {
  return (await load()).includes(id);
}

/** Toggle the "This helped" reaction for a note. Returns the new helpful state. */
export async function toggleNoteHelpful(id: string): Promise<boolean> {
  const list = await load();
  const has = list.includes(id);
  const next = has ? list.filter((x) => x !== id) : [...list, id];
  try {
    await setPrivateItem(KEY, JSON.stringify(next));
  } catch {
    /* best-effort */
  }
  return !has;
}

/** Test/seed reset. */
export async function clearNoteReactions(): Promise<void> {
  await removePrivateItem(KEY);
}
