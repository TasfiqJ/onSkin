import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

// Local-first record of the structured "This helped" reactions (docs/11 §6/§10,
// the docs/09 flywheel signal). The server `community_reactions` table is the
// deferred sync target (B-COMMUNITY-MOD); this AsyncStorage set is the v1 source
// of truth (D-029) so the reaction survives navigation/remount instead of living
// only in component state. Stores note ids only, no content.
const KEY = 'onskin.community.reactions.v1';

function uniqueIds(value: unknown): string[] | null {
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
    const normalized = uniqueIds(parsed);
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

export async function isNoteHelpful(id: string): Promise<boolean> {
  return (await load()).includes(id.trim());
}

/** Toggle the "This helped" reaction for a note. Returns the new helpful state. */
export async function toggleNoteHelpful(id: string): Promise<boolean> {
  const normalizedId = id.trim();
  if (normalizedId.length === 0) return false;
  const list = await load();
  const has = list.includes(normalizedId);
  const next = has ? list.filter((x) => x !== normalizedId) : [...list, normalizedId];
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
