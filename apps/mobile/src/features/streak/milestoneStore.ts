import { MILESTONE_KEYS, type MilestoneKey } from '@/features/streak/milestones';
import {
  readPrivateItem,
  removePrivateItem,
  updatePrivateItem,
  type PrivateKVReadFailureReason,
} from '@/lib/storage/privateKV';
import {
  decodePrivateStringSet,
  encodePrivateStringSet,
  PRIVATE_STRING_SET_UNSUPPORTED_VERSION,
} from '@/lib/storage/privateStringSet';

// Local record of milestones already celebrated (docs/07 §4.5), so the gentle
// marker fires its analytics event once per milestone rather than on every visit
// to the streak screen. Local-first (D-029); no server dependency.
const KEY = 'onskin.milestones.v1';
const MAX_MILESTONE_RECORD_CHARS = 4_096;
const MILESTONE_KEY_SET = new Set<string>(MILESTONE_KEYS);

export const MILESTONES_INVALID = 'MILESTONES_INVALID';
export const MILESTONES_UNAVAILABLE = 'MILESTONES_UNAVAILABLE';
export const MILESTONES_UNSUPPORTED_VERSION = 'MILESTONES_UNSUPPORTED_VERSION';
export const MILESTONES_WRITE_UNCERTAIN = 'MILESTONES_WRITE_UNCERTAIN';

type MilestoneStorageFormat = 'current' | 'legacy';
type MilestoneCorruptReason =
  | 'content_key_invalid'
  | 'envelope_invalid'
  | 'decryption_failed'
  | 'invalid_payload';

export type MilestonesSeenRead =
  | { status: 'absent'; keys: MilestoneKey[] }
  | { status: 'available'; keys: MilestoneKey[]; format: MilestoneStorageFormat }
  | {
      status: 'unavailable';
      keys: null;
      reason: PrivateKVReadFailureReason;
    }
  | { status: 'corrupt'; keys: null; reason: MilestoneCorruptReason }
  | { status: 'unsupported_version'; keys: null };

export type MarkMilestoneSeenResult =
  | { status: 'recorded'; key: MilestoneKey }
  | { status: 'already_seen'; key: MilestoneKey };

type DecodedMilestones = {
  keys: MilestoneKey[];
  format: MilestoneStorageFormat | 'absent';
};

function invalid(code: string): Error {
  return new Error(code);
}

function isMilestoneKey(value: unknown): value is MilestoneKey {
  return typeof value === 'string' && MILESTONE_KEY_SET.has(value);
}

function requireMilestoneKey(value: unknown): MilestoneKey {
  if (!isMilestoneKey(value)) throw invalid(MILESTONES_INVALID);
  return value;
}

/** Strict, bounded domain decoder for the shared v1 string-set envelope and its
 * pre-envelope array. Unknown or oversized payloads remain untouched. */
function decodeMilestones(raw: string | null): DecodedMilestones {
  if (raw === null) return { keys: [], format: 'absent' };
  if (raw.length > MAX_MILESTONE_RECORD_CHARS) throw invalid(MILESTONES_INVALID);

  let values: string[];
  try {
    values = decodePrivateStringSet(raw);
  } catch (error) {
    throw invalid(
      error instanceof Error && error.message === PRIVATE_STRING_SET_UNSUPPORTED_VERSION
        ? MILESTONES_UNSUPPORTED_VERSION
        : MILESTONES_INVALID,
    );
  }

  if (values.length > MILESTONE_KEYS.length || values.some((value) => !isMilestoneKey(value))) {
    throw invalid(MILESTONES_INVALID);
  }

  // The shared decoder already proved this is valid JSON and either a strict
  // legacy array or strict current envelope. Parse only to report its format.
  const parsed = JSON.parse(raw) as unknown;
  return {
    keys: values as MilestoneKey[],
    format: Array.isArray(parsed) ? 'legacy' : 'current',
  };
}

/** Classify the milestone set without repairing, migrating, deleting, or
 * rewriting bytes. Absence is the only state that means a valid empty set. */
export async function readMilestonesSeen(): Promise<MilestonesSeenRead> {
  let stored: Awaited<ReturnType<typeof readPrivateItem>>;
  try {
    stored = await readPrivateItem(KEY);
  } catch {
    return {
      status: 'unavailable',
      keys: null,
      reason: 'storage_unavailable',
    };
  }

  if (stored.status === 'absent') return { status: 'absent', keys: [] };
  if (stored.status === 'unavailable') {
    return { status: 'unavailable', keys: null, reason: stored.reason };
  }
  if (stored.status === 'corrupt') {
    return { status: 'corrupt', keys: null, reason: stored.reason };
  }
  if (stored.status === 'unsupported_version') {
    return { status: 'unsupported_version', keys: null };
  }

  try {
    const decoded = decodeMilestones(stored.value);
    return {
      status: 'available',
      keys: decoded.keys,
      format: decoded.format as MilestoneStorageFormat,
    };
  } catch (error) {
    return error instanceof Error && error.message === MILESTONES_UNSUPPORTED_VERSION
      ? { status: 'unsupported_version', keys: null }
      : { status: 'corrupt', keys: null, reason: 'invalid_payload' };
  }
}

/** Atomically record a first crossing. The result distinguishes a newly durable
 * marker from an existing one; invalid/unreadable state rejects instead of being
 * collapsed into "already seen". */
export async function markMilestoneSeen(key: MilestoneKey): Promise<MarkMilestoneSeenResult> {
  const validatedKey = requireMilestoneKey(key);
  let result: MarkMilestoneSeenResult | null = null;
  let expectedRaw: string | null = null;

  try {
    await updatePrivateItem(KEY, (current) => {
      const seen = decodeMilestones(current).keys;
      if (seen.includes(validatedKey)) {
        result = { status: 'already_seen', key: validatedKey };
        expectedRaw = current;
        return current;
      }

      const encoded = encodePrivateStringSet([...seen, validatedKey]);
      if (encoded.length > MAX_MILESTONE_RECORD_CHARS) throw invalid(MILESTONES_INVALID);
      result = { status: 'recorded', key: validatedKey };
      expectedRaw = encoded;
      return encoded;
    });
  } catch (error) {
    if (expectedRaw === null) throw error;
    let confirmation: Awaited<ReturnType<typeof readPrivateItem>>;
    try {
      confirmation = await readPrivateItem(KEY);
    } catch {
      throw invalid(MILESTONES_WRITE_UNCERTAIN);
    }
    if (confirmation.status !== 'available' || confirmation.value !== expectedRaw) {
      throw invalid(MILESTONES_WRITE_UNCERTAIN);
    }
  }

  if (result === null) throw invalid(MILESTONES_UNAVAILABLE);
  return result;
}

/** Test/seed reset. */
export async function clearMilestonesSeen(): Promise<void> {
  await removePrivateItem(KEY);
}
