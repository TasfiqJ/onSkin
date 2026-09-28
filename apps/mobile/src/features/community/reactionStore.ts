import { getPrivateItem, removePrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';
import { decodePrivateStringSet, encodePrivateStringSet } from '@/lib/storage/privateStringSet';
import {
  runCurrentHealthDataOperation,
  type HealthDataWriteOperationLease,
} from '@/lib/consent/healthDataWriteAdmission';

// Local-first record of the structured "This helped" reactions (docs/11 §6/§10,
// the docs/09 flywheel signal). The server `community_reactions` table is the
// deferred sync target (B-COMMUNITY-MOD); this AsyncStorage set is the v1 source
// of truth (D-029) so the reaction survives navigation/remount instead of living
// only in component state. Stores note ids only, no content.
const KEY = 'layerwell.community.reactions.v1';

async function load(lease: HealthDataWriteOperationLease): Promise<string[]> {
  try {
    lease.assertCurrent();
    const raw = await getPrivateItem(KEY);
    lease.assertCurrent();
    const result = decodePrivateStringSet(raw);
    lease.assertCurrent();
    return result;
  } catch {
    // Reads never repair, delete, or replace unreadable/future private bytes.
    lease.assertCurrent();
    return [];
  }
}

export async function isNoteHelpful(id: string): Promise<boolean> {
  return runCurrentHealthDataOperation(async (lease) => {
    const result = (await load(lease)).includes(id.trim());
    lease.assertCurrent();
    return result;
  });
}

/** Toggle the "This helped" reaction for a note. Returns the new helpful state. */
export async function toggleNoteHelpful(id: string): Promise<boolean> {
  return runCurrentHealthDataOperation(async (lease) => {
    const normalizedId = id.trim();
    if (normalizedId.length === 0) return false;
    let nextState = false;
    try {
      lease.assertCurrent();
      await updatePrivateItem(KEY, (current) => {
        lease.assertCurrent();
        const list = decodePrivateStringSet(current);
        const has = list.includes(normalizedId);
        nextState = !has;
        lease.assertCurrent();
        return encodePrivateStringSet(
          has ? list.filter((item) => item !== normalizedId) : [...list, normalizedId],
        );
      });
      lease.assertCurrent();
      return nextState;
    } catch {
      // Report the last durable state under the same immutable lease instead
      // of borrowing a new authorization after an interrupted write.
      lease.assertCurrent();
      const durableState = (await load(lease)).includes(normalizedId);
      lease.assertCurrent();
      return durableState;
    }
  });
}

/** Test/seed reset. */
export async function clearNoteReactions(): Promise<void> {
  await removePrivateItem(KEY);
}
