import { getPrivateItem, removePrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';
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

export const RAMP_STATE_INVALID = 'RAMP_STATE_INVALID';
export const RAMP_STATE_UNSUPPORTED_VERSION = 'RAMP_STATE_UNSUPPORTED_VERSION';

export type StoredRamp = RampState & {
  startedAt: string; // ISO local date the ramp began
  lastStepUp: string | null; // ISO local date of the last accepted step-up
};

type Log = Record<string, StoredRamp>; // productId -> ramp
type RampEnvelope = {
  version: typeof SCHEMA_VERSION;
  ramps: Log;
};

const TOLERANCE_STATES = new Set<StoredRamp['toleranceState']>([
  'building',
  'steady',
  'paused_irritation',
]);

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

function normalizeStoredRamp(
  value: unknown,
  fallbackStartedAt: string,
  allowLegacyDefaults = true,
): StoredRamp | null {
  if (!isRecord(value)) return null;
  if (!allowLegacyDefaults) {
    const keys = Object.keys(value).sort();
    const expected = ['freqPerWeek', 'lastStepUp', 'startedAt', 'targetPerWeek', 'toleranceState'];
    if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
      return null;
    }
  }
  const { freqPerWeek, targetPerWeek, toleranceState } = value;
  const startedAt = allowLegacyDefaults ? (value.startedAt ?? fallbackStartedAt) : value.startedAt;
  const lastStepUp = allowLegacyDefaults ? (value.lastStepUp ?? null) : value.lastStepUp;

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

  return {
    freqPerWeek,
    targetPerWeek,
    toleranceState: toleranceState as StoredRamp['toleranceState'],
    startedAt,
    lastStepUp,
  };
}

function decodeLog(value: unknown, fallbackStartedAt: string, allowLegacyDefaults: boolean): Log {
  if (!isRecord(value)) throw new Error(RAMP_STATE_INVALID);
  const log: Log = {};

  for (const [productId, ramp] of Object.entries(value)) {
    if (productId.trim().length === 0 || productId.trim() !== productId) {
      throw new Error(RAMP_STATE_INVALID);
    }
    const normalized = normalizeStoredRamp(ramp, fallbackStartedAt, allowLegacyDefaults);
    if (!normalized) throw new Error(RAMP_STATE_INVALID);
    log[productId] = normalized;
  }
  return log;
}

function decodeRampState(raw: string | null, fallbackStartedAt = localDateString()): Log {
  if (raw === null) return {};
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
    return decodeLog(parsed.ramps, fallbackStartedAt, false);
  }

  // Pre-envelope v1 data remains readable and migrates only during mutation.
  return decodeLog(parsed, fallbackStartedAt, true);
}

function encodeRampState(log: Log): string {
  return JSON.stringify({ version: SCHEMA_VERSION, ramps: log } satisfies RampEnvelope);
}

async function load(): Promise<Log> {
  try {
    return decodeRampState(await getPrivateItem(KEY));
  } catch {
    // Never repair/delete unreadable, unavailable, or future private bytes on read.
    return {};
  }
}

export async function getStoredRamps(): Promise<Log> {
  return load();
}

/** Seed a product's ramp from the generated initial the first time it is seen. */
export async function ensureRamp(productId: string, initial: RampState): Promise<StoredRamp> {
  const normalizedProductId = productId.trim();
  if (normalizedProductId.length === 0) throw new Error(RAMP_STATE_INVALID);
  let result: StoredRamp | null = null;
  await updatePrivateItem(KEY, (current) => {
    const log = decodeRampState(current);
    result = log[normalizedProductId] ?? {
      ...initial,
      startedAt: localDateString(),
      lastStepUp: null,
    };
    const normalized = normalizeStoredRamp(result, localDateString());
    if (!normalized) throw new Error(RAMP_STATE_INVALID);
    result = normalized;
    log[normalizedProductId] = normalized;
    return encodeRampState(log);
  });
  if (!result) throw new Error('RAMP_STATE_WRITE_FAILED');
  return result;
}

/** Accept a step-up offer: +1 night toward target, mark steady, stamp lastStepUp. */
export async function stepUpRamp(productId: string): Promise<void> {
  const normalizedProductId = productId.trim();
  if (normalizedProductId.length === 0) return;
  await updatePrivateItem(KEY, (current) => {
    const log = decodeRampState(current);
    const ramp = log[normalizedProductId];
    if (!ramp) return current;
    log[normalizedProductId] = {
      ...ramp,
      freqPerWeek: Math.min(ramp.targetPerWeek, ramp.freqPerWeek + 1),
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
  await updatePrivateItem(KEY, (current) => {
    const log = decodeRampState(current);
    for (const [id, ramp] of Object.entries(log)) {
      const next = applyTolerance(ramp, answer);
      log[id] = { ...ramp, ...next };
    }
    return Object.keys(log).length > 0 ? encodeRampState(log) : current;
  });
}

/** Test/seed reset. */
export async function clearRamps(): Promise<void> {
  await removePrivateItem(KEY);
}
