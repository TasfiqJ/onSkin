import { track } from '@/lib/analytics/track';
import {
  AccountGenerationLeaseError,
  awaitAccountGenerationLease,
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import {
  readPrivateItem,
  removePrivateItem,
  updatePrivateItem,
  type PrivateKVReadFailureReason,
} from '@/lib/storage/privateKV';

const KEY = 'routinekind.routineActivation.v1';
const SCHEMA_VERSION = 1 as const;

export const ROUTINE_ACTIVATION_INVALID = 'ROUTINE_ACTIVATION_INVALID';
export const ROUTINE_ACTIVATION_UNSUPPORTED_VERSION = 'ROUTINE_ACTIVATION_UNSUPPORTED_VERSION';
export const MAX_ROUTINE_ACTIVATION_RECORD_CHARS = 1_024;

export type ActivationFlags = {
  firstRoutineCreated: boolean;
  firstUsefulInsight: boolean;
};

type ActivationStorageFormat = 'current' | 'legacy';
type ActivationCorruptReason =
  | 'content_key_invalid'
  | 'envelope_invalid'
  | 'decryption_failed'
  | 'invalid_payload';

export type RoutineActivationStateRead =
  | { status: 'absent'; flags: ActivationFlags }
  | { status: 'available'; flags: ActivationFlags; format: ActivationStorageFormat }
  | { status: 'unavailable'; flags: null; reason: PrivateKVReadFailureReason }
  | { status: 'corrupt'; flags: null; reason: ActivationCorruptReason }
  | { status: 'unsupported_version'; flags: null };

type StoredActivationFlags = {
  version: typeof SCHEMA_VERSION;
  flags: ActivationFlags;
};

type DecodedActivationFlags = {
  flags: ActivationFlags;
  format: ActivationStorageFormat | 'absent';
};

type FirstInsightSource = 'routine_plan' | 'reveal';

const EMPTY_FLAGS: ActivationFlags = {
  firstRoutineCreated: false,
  firstUsefulInsight: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function decodeFlagsObject(value: unknown): ActivationFlags {
  if (!isRecord(value) || !hasExactKeys(value, ['firstRoutineCreated', 'firstUsefulInsight'])) {
    throw new Error(ROUTINE_ACTIVATION_INVALID);
  }
  if (
    typeof value.firstRoutineCreated !== 'boolean' ||
    typeof value.firstUsefulInsight !== 'boolean'
  ) {
    throw new Error(ROUTINE_ACTIVATION_INVALID);
  }
  return {
    firstRoutineCreated: value.firstRoutineCreated,
    firstUsefulInsight: value.firstUsefulInsight,
  };
}

function decodeFlags(raw: string | null): DecodedActivationFlags {
  if (raw === null) return { flags: { ...EMPTY_FLAGS }, format: 'absent' };
  if (raw.length > MAX_ROUTINE_ACTIVATION_RECORD_CHARS) {
    throw new Error(ROUTINE_ACTIVATION_INVALID);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(ROUTINE_ACTIVATION_INVALID);
  }
  if (!isRecord(parsed)) throw new Error(ROUTINE_ACTIVATION_INVALID);

  if ('version' in parsed) {
    if (
      typeof parsed.version === 'number' &&
      Number.isSafeInteger(parsed.version) &&
      parsed.version > SCHEMA_VERSION
    ) {
      throw new Error(ROUTINE_ACTIVATION_UNSUPPORTED_VERSION);
    }
    if (parsed.version !== SCHEMA_VERSION || !hasExactKeys(parsed, ['version', 'flags'])) {
      throw new Error(ROUTINE_ACTIVATION_INVALID);
    }
    return { flags: decodeFlagsObject(parsed.flags), format: 'current' };
  }

  // Pre-envelope v1 payload. It is decoded without a read-time rewrite and is
  // upgraded only when an explicit event reservation changes the value.
  return { flags: decodeFlagsObject(parsed), format: 'legacy' };
}

function encodeFlags(flags: ActivationFlags): string {
  const encoded = JSON.stringify({
    version: SCHEMA_VERSION,
    flags,
  } satisfies StoredActivationFlags);
  if (encoded.length > MAX_ROUTINE_ACTIVATION_RECORD_CHARS) {
    throw new Error(ROUTINE_ACTIVATION_INVALID);
  }
  return encoded;
}

async function readRoutineActivationStateWithLease(
  lease: AccountGenerationLease,
): Promise<RoutineActivationStateRead> {
  let stored: Awaited<ReturnType<typeof readPrivateItem>>;
  try {
    stored = await awaitAccountGenerationLease(lease, () => readPrivateItem(KEY));
  } catch {
    lease.assertCurrent();
    return { status: 'unavailable', flags: null, reason: 'storage_unavailable' };
  }
  lease.assertCurrent();

  if (stored.status === 'absent') return { status: 'absent', flags: { ...EMPTY_FLAGS } };
  if (stored.status === 'unavailable') {
    return { status: 'unavailable', flags: null, reason: stored.reason };
  }
  if (stored.status === 'corrupt') {
    return { status: 'corrupt', flags: null, reason: stored.reason };
  }
  if (stored.status === 'unsupported_version') {
    return { status: 'unsupported_version', flags: null };
  }

  try {
    const decoded = decodeFlags(stored.value);
    if (decoded.format === 'absent') {
      return { status: 'absent', flags: decoded.flags };
    }
    return {
      status: 'available',
      flags: decoded.flags,
      format: decoded.format,
    };
  } catch (error) {
    return error instanceof Error && error.message === ROUTINE_ACTIVATION_UNSUPPORTED_VERSION
      ? { status: 'unsupported_version', flags: null }
      : { status: 'corrupt', flags: null, reason: 'invalid_payload' };
  }
}

/** Classify activation-marker bytes without repairing, migrating, deleting,
 * or publishing a stale account generation. */
export async function readRoutineActivationState(): Promise<RoutineActivationStateRead> {
  try {
    return await runAccountGenerationOperation(readRoutineActivationStateWithLease);
  } catch (error) {
    return {
      status: 'unavailable',
      flags: null,
      reason:
        error instanceof AccountGenerationLeaseError ? 'account_boundary' : 'storage_unavailable',
    };
  }
}

async function reserveFirstEvents(input: {
  routineCreated: boolean;
  usefulInsight: boolean;
}): Promise<ActivationFlags> {
  const reserved = { ...EMPTY_FLAGS };
  await updatePrivateItem(KEY, (raw) => {
    const current = decodeFlags(raw).flags;
    const next = { ...current };

    if (input.routineCreated && !current.firstRoutineCreated) {
      next.firstRoutineCreated = true;
      reserved.firstRoutineCreated = true;
    }
    if (input.usefulInsight && !current.firstUsefulInsight) {
      next.firstUsefulInsight = true;
      reserved.firstUsefulInsight = true;
    }

    return reserved.firstRoutineCreated || reserved.firstUsefulInsight ? encodeFlags(next) : raw;
  });
  return reserved;
}

export async function recordFirstUsefulInsightAnalytics({
  insightCount,
  isExample,
  source,
}: {
  insightCount: number;
  isExample: boolean;
  source: FirstInsightSource;
}): Promise<void> {
  if (isExample || insightCount <= 0) return;

  let reserved: ActivationFlags;
  try {
    reserved = await reserveFirstEvents({ routineCreated: false, usefulInsight: true });
  } catch {
    return;
  }
  if (reserved.firstUsefulInsight) {
    track('first_useful_insight', { count: insightCount, source });
  }
}

export async function recordRoutinePlanAnalytics({
  routineStepCount,
  insightCount,
  isExample,
  source,
}: {
  routineStepCount: number;
  insightCount: number;
  isExample: boolean;
  source: 'example' | 'routine_plan';
}): Promise<void> {
  track('routine_plan_viewed', { source });

  if (isExample) return;

  const hasRoutineSteps = routineStepCount > 0;
  if (hasRoutineSteps) {
    track('routine_created', { source });
  }

  let reserved: ActivationFlags;
  try {
    reserved = await reserveFirstEvents({
      routineCreated: hasRoutineSteps,
      usefulInsight: insightCount > 0,
    });
  } catch {
    return;
  }

  if (reserved.firstRoutineCreated) {
    track('first_routine_created', { source });
  }
  if (reserved.firstUsefulInsight) {
    track('first_useful_insight', { count: insightCount, source });
  }
}

export async function clearRoutineActivationAnalytics(): Promise<void> {
  await removePrivateItem(KEY);
}
