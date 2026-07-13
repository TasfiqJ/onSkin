import { getPrivateItem, removePrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';
import { decodePrivateStringSet, encodePrivateStringSet } from '@/lib/storage/privateStringSet';

// Local-first record of the structured "This helped" reactions (docs/11 §6/§10,
// the docs/09 flywheel signal). The server `community_reactions` table is the
// deferred sync target (B-COMMUNITY-MOD); this AsyncStorage set is the v1 source
// of truth (D-029) so the reaction survives navigation/remount instead of living
// only in component state. Stores note ids only, no content.
const KEY = 'onskin.community.reactions.v1';

async function load(): Promise<string[]> {
  try {
    return decodePrivateStringSet(await getPrivateItem(KEY));
  } catch {
    // Reads never repair, delete, or replace unreadable/future private bytes.
    return [];
  }
}

export async function isNoteHelpful(id: string): Promise<boolean> {
  return (await load()).includes(id.trim());
}

/** Toggle the "This helped" reaction for a note. Returns the new helpful state. */
export async function toggleNoteHelpful(id: string): Promise<boolean> {
  const normalizedId = id.trim();
  if (normalizedId.length === 0) return false;
  let nextState = false;
  try {
    await updatePrivateItem(KEY, (current) => {
      const list = decodePrivateStringSet(current);
      const has = list.includes(normalizedId);
      nextState = !has;
      return encodePrivateStringSet(
        has ? list.filter((item) => item !== normalizedId) : [...list, normalizedId],
      );
    });
    return nextState;
  } catch {
    // Report the last durable state instead of claiming an unpersisted toggle.
    return isNoteHelpful(normalizedId);
  }
}

/** Test/seed reset. */
export async function clearNoteReactions(): Promise<void> {
  await removePrivateItem(KEY);
}
