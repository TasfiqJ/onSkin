import { readPrivateItem, removePrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';
import {
  decodePrivateStringSet,
  encodePrivateStringSet,
  PRIVATE_STRING_SET_UNSUPPORTED_VERSION,
} from '@/lib/storage/privateStringSet';

// Local-first record of the structured "This helped" reactions (docs/11 §6/§10,
// the docs/09 flywheel signal). The server `community_reactions` table is the
// deferred sync target (B-COMMUNITY-MOD); this AsyncStorage set is the v1 source
// of truth (D-029) so the reaction survives navigation/remount instead of living
// only in component state. Stores note ids only, no content.
const KEY = 'onskin.community.reactions.v1';
export const COMMUNITY_REACTIONS_INVALID = 'COMMUNITY_REACTIONS_INVALID';
export const COMMUNITY_REACTIONS_UNAVAILABLE = 'COMMUNITY_REACTIONS_UNAVAILABLE';
export const COMMUNITY_REACTIONS_UNSUPPORTED_VERSION = 'COMMUNITY_REACTIONS_UNSUPPORTED_VERSION';

export type CommunityReactionsRead =
  | { status: 'absent'; noteIds: string[] }
  | { status: 'available'; noteIds: string[] }
  | { status: 'unavailable'; noteIds: null }
  | { status: 'corrupt'; noteIds: null }
  | { status: 'unsupported_version'; noteIds: null };

let e2eReadFailureCount = 0;

function consumeE2EReadFailure(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  const fixture = process.env.EXPO_PUBLIC_E2E_REACTION_STORAGE_FAILURE?.trim().toLowerCase();
  if (fixture === 'always') return true;
  if (fixture !== 'once' || e2eReadFailureCount > 0) return false;
  e2eReadFailureCount += 1;
  return true;
}

export async function readCommunityReactions(): Promise<CommunityReactionsRead> {
  if (consumeE2EReadFailure()) return { status: 'unavailable', noteIds: null };
  const stored = await readPrivateItem(KEY);
  if (stored.status === 'absent') return { status: 'absent', noteIds: [] };
  if (stored.status === 'unavailable') return { status: 'unavailable', noteIds: null };
  if (stored.status === 'corrupt') return { status: 'corrupt', noteIds: null };
  if (stored.status === 'unsupported_version') {
    return { status: 'unsupported_version', noteIds: null };
  }

  try {
    return { status: 'available', noteIds: decodePrivateStringSet(stored.value) };
  } catch (error) {
    return error instanceof Error && error.message === PRIVATE_STRING_SET_UNSUPPORTED_VERSION
      ? { status: 'unsupported_version', noteIds: null }
      : { status: 'corrupt', noteIds: null };
  }
}

export async function isNoteHelpful(id: string): Promise<boolean> {
  const result = await readCommunityReactions();
  if (result.status === 'available' || result.status === 'absent') {
    return result.noteIds.includes(id.trim());
  }
  if (result.status === 'unsupported_version') {
    throw new Error(COMMUNITY_REACTIONS_UNSUPPORTED_VERSION);
  }
  if (result.status === 'corrupt') throw new Error(COMMUNITY_REACTIONS_INVALID);
  throw new Error(COMMUNITY_REACTIONS_UNAVAILABLE);
}

/** Idempotently persist the desired "This helped" state for a note. */
export async function setNoteHelpful(id: string, helpful: boolean): Promise<boolean> {
  const normalizedId = id.trim();
  if (normalizedId.length === 0) return false;
  await updatePrivateItem(KEY, (current) => {
    const list = decodePrivateStringSet(current);
    const has = list.includes(normalizedId);
    if (has === helpful) return current;
    return encodePrivateStringSet(
      helpful ? [...list, normalizedId] : list.filter((item) => item !== normalizedId),
    );
  });
  return helpful;
}

/** Test/seed reset. */
export async function clearNoteReactions(): Promise<void> {
  await removePrivateItem(KEY);
}
