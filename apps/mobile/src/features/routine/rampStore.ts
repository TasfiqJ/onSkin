import { readPrivateItem, removePrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';
import { localDateString } from '@/features/today/useToday';

import { applyTolerance, type RampState } from './ramp';

// Local-first retinoid/active ramp state (docs/03 §4). The `active_ramp` table
// (migration 0015) is the deferred server target (B-ROUTINE-PERSIST); this store is
// the v1 source of truth (D-029 pattern, shared with the shelf/photos/cycle/
// completions stores). The plan generates the INITIAL ramp (initRamp); this store
// persists the user-driven changes that were previously dropped on the floor: the
// offer-only step-up and the tolerance de-escalation. Keyed by user_product id.
const KEY = 'onskin.ramp.v1';
const SCHEMA_VERSION = 1 as const;
export const MAX_RAMP_RECORD_CHARS = 524_288;
export const MAX_RAMP_RECORDS = 1_024;
export const MAX_RAMP_PRODUCT_ID_CHARS = 256;

export const RAMP_STATE_INVALID = 'RAMP_STATE_INVALID';
export const RAMP_STATE_STALE = 'RAMP_STATE_STALE';
export const RAMP_STATE_UNSUPPORTED_VERSION = 'RAMP_STATE_UNSUPPORTED_VERSION';
export const RAMP_STATE_UNAVAILABLE = 'RAMP_STATE_UNAVAILABLE';

export type StoredRamp = RampState & {
  startedAt: string; // ISO local date the ramp began
  lastStepUp: string | null; // ISO local date of the last accepted step-up
};

export type StoredRamps = Record<string, StoredRamp>; // productId -> ramp
type Log = StoredRamps;
type RampEnvelope = {
  version: typeof SCHEMA_VERSION;
  ramps: Log;
};

type RampStateFormat = 'current' | 'legacy';

export type RampStateRead =
  | { status: 'absent'; ramps: Log }
  | { status: 'available'; ramps: Log; format: RampStateFormat }
  | { status: 'unavailable' | 'corrupt' | 'unsupported_version'; ramps: null };

const TOLERANCE_STATES = new Set<StoredRamp['toleranceState']>([
  'building',
  'steady',
  'paused_irritation',
]);
const TOLERANCE_ANSWERS = new Set(['comfortable', 'a_bit_dry', 'irritated']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && !Array.isArray(value) && typeof value === 'object';
}

function isLocalDateISO(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isRampFrequency(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 7;
}

function normalizeProductId(productId: string): string {
  const normalizedProductId = productId.trim();
  if (normalizedProductId.length > MAX_RAMP_PRODUCT_ID_CHARS) {
    throw new Error(RAMP_STATE_INVALID);
  }
  return normalizedProductId;
}

function requireInitialRamp(value: unknown): RampState {
  if (!isRecord(value)) throw new Error(RAMP_STATE_INVALID);
  const keys = Object.keys(value).sort();
  const expected = ['freqPerWeek', 'targetPerWeek', 'toleranceState'];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new Error(RAMP_STATE_INVALID);
  }
  if (
    !isRampFrequency(value.freqPerWeek) ||
    !isRampFrequency(value.targetPerWeek) ||
    value.freqPerWeek > value.targetPerWeek ||
    typeof value.toleranceState !== 'string' ||
    !TOLERANCE_STATES.has(value.toleranceState as StoredRamp['toleranceState'])
  ) {
    throw new Error(RAMP_STATE_INVALID);
  }
  return {
    freqPerWeek: value.freqPerWeek,
    targetPerWeek: value.targetPerWeek,
    toleranceState: value.toleranceState as StoredRamp['toleranceState'],
  };
}

function normalizeStoredRamp(value: unknown): StoredRamp | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value).sort();
  const expected = ['freqPerWeek', 'lastStepUp', 'startedAt', 'targetPerWeek', 'toleranceState'];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return null;
  }
  const { freqPerWeek, targetPerWeek, toleranceState } = value;
  const { startedAt, lastStepUp } = value;

  if (!isRampFrequency(freqPerWeek) || !isRampFrequency(targetPerWeek)) return null;
  if (freqPerWeek > targetPerWeek) return null;
  if (
    typeof toleranceState !== 'string' ||
    !TOLERANCE_STATES.has(toleranceState as StoredRamp['toleranceState'])
  ) {
    return null;
  }
  if (!isLocalDateISO(startedAt)) return null;
  if (!(lastStepUp === null || isLocalDateISO(lastStepUp))) return null;
  if (lastStepUp !== null && lastStepUp < startedAt) return null;

  return {
    freqPerWeek,
    targetPerWeek,
    toleranceState: toleranceState as StoredRamp['toleranceState'],
    startedAt,
    lastStepUp,
  };
}

function decodeLog(value: unknown): Log {
  if (!isRecord(value)) throw new Error(RAMP_STATE_INVALID);
  const entries = Object.entries(value);
  if (entries.length > MAX_RAMP_RECORDS) throw new Error(RAMP_STATE_INVALID);
  const log = Object.create(null) as Log;

  for (const [productId, ramp] of entries) {
    if (
      productId.trim().length === 0 ||
      productId.trim() !== productId ||
      productId.length > MAX_RAMP_PRODUCT_ID_CHARS
    ) {
      throw new Error(RAMP_STATE_INVALID);
    }
    const normalized = normalizeStoredRamp(ramp);
    if (!normalized) throw new Error(RAMP_STATE_INVALID);
    log[productId] = normalized;
  }
  return log;
}

function decodeRampState(raw: string | null): {
  ramps: Log;
  format: RampStateFormat | 'absent';
} {
  if (raw === null) return { ramps: {}, format: 'absent' };
  if (raw.length > MAX_RAMP_RECORD_CHARS) throw new Error(RAMP_STATE_INVALID);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(RAMP_STATE_INVALID);
  }
  if (!isRecord(parsed)) throw new Error(RAMP_STATE_INVALID);

  if (Object.prototype.hasOwnProperty.call(parsed, 'version')) {
    if (parsed.version !== SCHEMA_VERSION) {
      if (
        typeof parsed.version === 'number' &&
        Number.isSafeInteger(parsed.version) &&
        parsed.version > SCHEMA_VERSION
      ) {
        throw new Error(RAMP_STATE_UNSUPPORTED_VERSION);
      }
      throw new Error(RAMP_STATE_INVALID);
    }
    const keys = Object.keys(parsed).sort();
    if (keys.length !== 2 || keys[0] !== 'ramps' || keys[1] !== 'version') {
      throw new Error(RAMP_STATE_INVALID);
    }
    return { ramps: decodeLog(parsed.ramps), format: 'current' };
  }

  // The exact pre-envelope v1 log remains readable and migrates only during a
  // semantic mutation. It used the same complete StoredRamp row shape.
  return { ramps: decodeLog(parsed), format: 'legacy' };
}

function encodeRampState(log: Log): string {
  if (Object.keys(log).length > MAX_RAMP_RECORDS) throw new Error(RAMP_STATE_INVALID);
  const encoded = JSON.stringify({ version: SCHEMA_VERSION, ramps: log } satisfies RampEnvelope);
  if (encoded.length > MAX_RAMP_RECORD_CHARS) throw new Error(RAMP_STATE_INVALID);
  return encoded;
}

let e2eRampReadFailureCount = 0;

function consumeE2ERampReadFailure(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  const fixture = process.env.EXPO_PUBLIC_E2E_RAMP_STORAGE_FAILURE?.trim().toLowerCase();
  if (fixture === 'always') return true;
  if (fixture !== 'once' || e2eRampReadFailureCount > 0) return false;
  e2eRampReadFailureCount += 1;
  return true;
}

/** Read and classify the persisted ramp without repairing, deleting, or migrating it. */
export async function readStoredRamps(): Promise<RampStateRead> {
  if (consumeE2ERampReadFailure()) return { status: 'unavailable', ramps: null };

  let stored: Awaited<ReturnType<typeof readPrivateItem>>;
  try {
    stored = await readPrivateItem(KEY);
  } catch {
    return { status: 'unavailable', ramps: null };
  }
  if (stored.status === 'absent') return { status: 'absent', ramps: {} };
  if (stored.status === 'unavailable') return { status: 'unavailable', ramps: null };
  if (stored.status === 'corrupt') return { status: 'corrupt', ramps: null };
  if (stored.status === 'unsupported_version') {
    return { status: 'unsupported_version', ramps: null };
  }

  try {
    const decoded = decodeRampState(stored.value);
    return {
      status: 'available',
      ramps: decoded.ramps,
      format: decoded.format === 'legacy' ? 'legacy' : 'current',
    };
  } catch (error) {
    return error instanceof Error && error.message === RAMP_STATE_UNSUPPORTED_VERSION
      ? { status: 'unsupported_version', ramps: null }
      : { status: 'corrupt', ramps: null };
  }
}

export async function getStoredRamps(): Promise<Log> {
  const result = await readStoredRamps();
  if (result.status === 'available' || result.status === 'absent') return result.ramps;
  if (result.status === 'unsupported_version') {
    throw new Error(RAMP_STATE_UNSUPPORTED_VERSION);
  }
  if (result.status === 'corrupt') throw new Error(RAMP_STATE_INVALID);
  throw new Error(RAMP_STATE_UNAVAILABLE);
}

/** Seed a product's ramp from the generated initial the first time it is seen. */
export async function ensureRamp(productId: string, initial: RampState): Promise<StoredRamp> {
  const normalizedProductId = normalizeProductId(productId);
  if (normalizedProductId.length === 0) throw new Error(RAMP_STATE_INVALID);
  const normalizedInitial = requireInitialRamp(initial);
  const today = localDateString();
  let result: StoredRamp | null = null;
  await updatePrivateItem(KEY, (current) => {
    const log = decodeRampState(current).ramps;
    const existing = log[normalizedProductId];
    if (existing) {
      result = existing;
      return current;
    }
    if (Object.keys(log).length >= MAX_RAMP_RECORDS) throw new Error(RAMP_STATE_INVALID);
    const seeded: StoredRamp = {
      ...normalizedInitial,
      startedAt: today,
      lastStepUp: null,
    };
    result = seeded;
    log[normalizedProductId] = seeded;
    return encodeRampState(log);
  });
  if (!result) throw new Error('RAMP_STATE_WRITE_FAILED');
  return result;
}

/** Accept a step-up offer. When a desired frequency is supplied, retries are
 * idempotent and a concurrently de-escalated ramp is never raised from stale UI. */
export async function stepUpRamp(productId: string, desiredFreqPerWeek?: number): Promise<void> {
  const normalizedProductId = normalizeProductId(productId);
  if (normalizedProductId.length === 0) return;
  if (desiredFreqPerWeek !== undefined && !isRampFrequency(desiredFreqPerWeek)) {
    throw new Error(RAMP_STATE_INVALID);
  }
  await updatePrivateItem(KEY, (current) => {
    const log = decodeRampState(current).ramps;
    const ramp = log[normalizedProductId];
    if (!ramp) return current;
    if (ramp.toleranceState === 'paused_irritation') throw new Error(RAMP_STATE_STALE);
    if (desiredFreqPerWeek !== undefined) {
      if (desiredFreqPerWeek > ramp.targetPerWeek) throw new Error(RAMP_STATE_INVALID);
      // An irritation report can race an offered step-up or an uncertain retry.
      // Never let stale UI clear that safety pause, even when the frequency still
      // looks like the expected predecessor (including the one-night floor).
      if (ramp.freqPerWeek >= desiredFreqPerWeek) return current;
      if (ramp.freqPerWeek !== desiredFreqPerWeek - 1) throw new Error(RAMP_STATE_STALE);
    } else if (ramp.freqPerWeek >= ramp.targetPerWeek) {
      return current;
    }
    log[normalizedProductId] = {
      ...ramp,
      freqPerWeek: desiredFreqPerWeek ?? Math.min(ramp.targetPerWeek, ramp.freqPerWeek + 1),
      toleranceState: 'steady',
      lastStepUp: localDateString(),
    };
    return encodeRampState(log);
  });
}

/** Apply the weekly tolerance answer to every stored ramp (de-escalate on irritation,
 *  steady on comfortable, hold on dry) via the pure applyTolerance (docs/03 §4). */
export async function applyToleranceToRamps(
  answer: 'comfortable' | 'a_bit_dry' | 'irritated',
): Promise<void> {
  if (!TOLERANCE_ANSWERS.has(answer)) throw new Error(RAMP_STATE_INVALID);
  await updatePrivateItem(KEY, (current) => {
    const log = decodeRampState(current).ramps;
    let changed = false;
    for (const [id, ramp] of Object.entries(log)) {
      const next = applyTolerance(ramp, answer);
      if (
        next.freqPerWeek !== ramp.freqPerWeek ||
        next.targetPerWeek !== ramp.targetPerWeek ||
        next.toleranceState !== ramp.toleranceState
      ) {
        log[id] = { ...ramp, ...next };
        changed = true;
      }
    }
    return changed ? encodeRampState(log) : current;
  });
}

/** Test/seed reset. */
export async function clearRamps(): Promise<void> {
  await removePrivateItem(KEY);
}
