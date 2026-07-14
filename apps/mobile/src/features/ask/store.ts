import {
  multiRemovePrivateItems,
  readPrivateItem,
  updatePrivateItem,
  type PrivateKVReadFailureReason,
  type PrivateKVReadResult,
} from '@/lib/storage/privateKV';
import {
  readPrivateBoolean,
  setPrivateBoolean,
  type PrivateBooleanReadResult,
} from '@/lib/storage/privateBoolean';

import { ASK_TRIAL_GROUNDED_CAP } from './gate';

// Local-first Ask state (docs/13 §7/§15, the D-029 pattern). Two pieces of state, both
// offline-safe: (1) the ask_onskin consent flag. DEFAULT-OFF, the v1 source of truth
// with a guarded ledger mirror in consent.ts; (2) a per-period counter of GROUNDED
// (cloud) turns used, to enforce the hard trial cap (gate.ts). The deterministic,
// on-device advisor needs neither. It is always free and stores nothing. No question
// or answer text is ever written here (no transcript, docs/13 §10).

const CONSENT_KEY = 'onskin.ask.consent.v1'; // default-OFF
const TURNS_KEY = 'onskin.ask.groundedTurns.v1';
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const TURN_OPERATION_ID = /^[a-f0-9]{32}$/;
const TURNS_SCHEMA_VERSION = 2 as const;

export const ASK_TURN_RECORD_INVALID = 'ASK_TURN_RECORD_INVALID';
export const ASK_TURN_CAP_REACHED = 'ASK_TURN_CAP_REACHED';
export const ASK_TURN_RECORD_UNAVAILABLE = 'ASK_TURN_RECORD_UNAVAILABLE';
export const ASK_TURN_RECORD_UNSUPPORTED_VERSION = 'ASK_TURN_RECORD_UNSUPPORTED_VERSION';
export const ASK_TURN_PERIOD_STALE = 'ASK_TURN_PERIOD_STALE';

declare const groundedTurnOperationIdBrand: unique symbol;
export type GroundedTurnOperationId = string & {
  readonly [groundedTurnOperationIdBrand]: true;
};

export async function readAskConsentLocal(): Promise<PrivateBooleanReadResult> {
  return readPrivateBoolean(CONSENT_KEY);
}

export async function setAskConsentLocal(enabled: boolean): Promise<void> {
  await setPrivateBoolean(CONSENT_KEY, enabled);
}

type TurnRecord = { period: string; count: number; operationIds: readonly string[] };
type TurnRecordEnvelope = TurnRecord & { version: typeof TURNS_SCHEMA_VERSION };
type TurnRecordFormat = 'current' | 'legacy_v1' | 'legacy';
type DecodedTurnRecord = { record: TurnRecord; format: TurnRecordFormat };
type GroundedTurnsCorruptReason =
  | Extract<PrivateKVReadResult, { status: 'corrupt' }>['reason']
  | 'invalid_payload';

export type GroundedTurnsRead =
  | { status: 'absent'; count: 0 }
  | { status: 'available'; count: number; format: TurnRecordFormat }
  | { status: 'unavailable'; count: null; reason: PrivateKVReadFailureReason }
  | { status: 'corrupt'; count: null; reason: GroundedTurnsCorruptReason }
  | { status: 'unsupported_version'; count: null }
  | { status: 'stale_period'; count: null; storedPeriod: string };

let e2eTurnsReadFailureCount = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    keys.length === sortedExpected.length &&
    keys.every((key, index) => key === sortedExpected[index])
  );
}

function normalizePeriod(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return PERIOD.test(text) ? text : null;
}

function normalizeLegacyTurnRecord(source: Record<string, unknown>): TurnRecord | null {
  if (!hasExactKeys(source, ['count', 'period'])) return null;
  const period = normalizePeriod(source.period);
  if (!period) return null;
  const count = source.count;
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) return null;
  return { period, count: Math.min(count, ASK_TRIAL_GROUNDED_CAP), operationIds: [] };
}

function decodeV1TurnRecord(source: Record<string, unknown>): TurnRecord | null {
  if (!hasExactKeys(source, ['count', 'period', 'version'])) return null;
  if (typeof source.period !== 'string' || !PERIOD.test(source.period)) return null;
  const count = source.count;
  if (
    typeof count !== 'number' ||
    !Number.isSafeInteger(count) ||
    count < 0 ||
    count > ASK_TRIAL_GROUNDED_CAP
  ) {
    return null;
  }
  return { period: source.period, count, operationIds: [] };
}

function decodeCurrentTurnRecord(source: Record<string, unknown>): TurnRecord | null {
  if (!hasExactKeys(source, ['count', 'operationIds', 'period', 'version'])) return null;
  if (typeof source.period !== 'string' || !PERIOD.test(source.period)) return null;
  const count = source.count;
  const operationIds = source.operationIds;
  if (
    typeof count !== 'number' ||
    !Number.isSafeInteger(count) ||
    count < 0 ||
    count > ASK_TRIAL_GROUNDED_CAP ||
    !Array.isArray(operationIds) ||
    operationIds.length > count ||
    operationIds.some((operationId) =>
      typeof operationId !== 'string' ? true : !TURN_OPERATION_ID.test(operationId),
    ) ||
    new Set(operationIds).size !== operationIds.length
  ) {
    return null;
  }
  return { period: source.period, count, operationIds };
}

function decodeTurns(raw: string | null): DecodedTurnRecord | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(ASK_TURN_RECORD_INVALID);
  }
  if (!isRecord(parsed)) throw new Error(ASK_TURN_RECORD_INVALID);
  if (hasOwn(parsed, 'version')) {
    if (parsed.version === 1) {
      const legacyV1 = decodeV1TurnRecord(parsed);
      if (!legacyV1) throw new Error(ASK_TURN_RECORD_INVALID);
      return { record: legacyV1, format: 'legacy_v1' };
    }
    if (parsed.version !== TURNS_SCHEMA_VERSION) {
      if (
        typeof parsed.version === 'number' &&
        Number.isSafeInteger(parsed.version) &&
        parsed.version > TURNS_SCHEMA_VERSION
      ) {
        throw new Error(ASK_TURN_RECORD_UNSUPPORTED_VERSION);
      }
      throw new Error(ASK_TURN_RECORD_INVALID);
    }
    const current = decodeCurrentTurnRecord(parsed);
    if (!current) throw new Error(ASK_TURN_RECORD_INVALID);
    return { record: current, format: 'current' };
  }
  const legacy = normalizeLegacyTurnRecord(parsed);
  if (!legacy) throw new Error(ASK_TURN_RECORD_INVALID);
  return { record: legacy, format: 'legacy' };
}

function encodeTurns(record: TurnRecord): string {
  return JSON.stringify({ version: TURNS_SCHEMA_VERSION, ...record } satisfies TurnRecordEnvelope);
}

async function readCommittedOperation(
  period: string,
  operationId: string,
): Promise<number | null> {
  const stored = await readPrivateItem(TURNS_KEY);
  if (stored.status !== 'available') return null;
  const decoded = decodeTurns(stored.value);
  if (
    !decoded ||
    decoded.record.period !== period ||
    !decoded.record.operationIds.includes(operationId)
  ) {
    return null;
  }
  return decoded.record.count;
}

function devGroundedTurnsReadFixture(): GroundedTurnsRead | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  const fixture = process.env.EXPO_PUBLIC_E2E_ASK_TURNS_STORAGE_FAILURE?.trim().toLowerCase();
  if (fixture === 'future') return { status: 'unsupported_version', count: null };
  if (fixture === 'always') {
    return { status: 'unavailable', count: null, reason: 'storage_unavailable' };
  }
  if (fixture !== 'once' || e2eTurnsReadFailureCount > 0) return null;
  e2eTurnsReadFailureCount += 1;
  return { status: 'unavailable', count: null, reason: 'storage_unavailable' };
}

/** Classify the local cloud-turn quota without repairing or replacing private bytes. */
export async function readGroundedTurns(period: string): Promise<GroundedTurnsRead> {
  const currentPeriod = normalizePeriod(period);
  if (!currentPeriod) throw new Error(ASK_TURN_RECORD_INVALID);
  const fixture = devGroundedTurnsReadFixture();
  if (fixture) return fixture;

  let stored: PrivateKVReadResult;
  try {
    stored = await readPrivateItem(TURNS_KEY);
  } catch {
    return { status: 'unavailable', count: null, reason: 'storage_unavailable' };
  }

  if (stored.status === 'absent') return { status: 'absent', count: 0 };
  if (stored.status === 'unavailable') {
    return { status: 'unavailable', count: null, reason: stored.reason };
  }
  if (stored.status === 'corrupt') {
    return { status: 'corrupt', count: null, reason: stored.reason };
  }
  if (stored.status === 'unsupported_version') {
    return { status: 'unsupported_version', count: null };
  }

  try {
    const decoded = decodeTurns(stored.value);
    if (!decoded) return { status: 'absent', count: 0 };
    if (decoded.record.period > currentPeriod) {
      return {
        status: 'stale_period',
        count: null,
        storedPeriod: decoded.record.period,
      };
    }
    return {
      status: 'available',
      count: decoded.record.period === currentPeriod ? decoded.record.count : 0,
      format: decoded.format,
    };
  } catch (error) {
    return error instanceof Error && error.message === ASK_TURN_RECORD_UNSUPPORTED_VERSION
      ? { status: 'unsupported_version', count: null }
      : { status: 'corrupt', count: null, reason: 'invalid_payload' };
  }
}

/** Throwing adapter so unreadable quota state disables cloud delivery without becoming zero. */
export async function getGroundedTurns(period: string): Promise<number> {
  const result = await readGroundedTurns(period);
  if (result.status === 'available' || result.status === 'absent') return result.count;
  if (result.status === 'unsupported_version') {
    throw new Error(ASK_TURN_RECORD_UNSUPPORTED_VERSION);
  }
  if (result.status === 'stale_period') throw new Error(ASK_TURN_PERIOD_STALE);
  if (result.status === 'corrupt') throw new Error(ASK_TURN_RECORD_INVALID);
  throw new Error(ASK_TURN_RECORD_UNAVAILABLE);
}

/** Reserve one grounded turn atomically. The durable operation identity makes
 * response-loss retries idempotent without collapsing distinct concurrent turns. */
export async function reserveTrialGroundedTurn(
  period: string,
  operationId: GroundedTurnOperationId,
): Promise<number> {
  const currentPeriod = normalizePeriod(period);
  if (!currentPeriod || !TURN_OPERATION_ID.test(operationId)) {
    throw new Error(ASK_TURN_RECORD_INVALID);
  }

  let recordedCount: number | null = null;
  try {
    await updatePrivateItem(TURNS_KEY, (current) => {
      const decoded = decodeTurns(current);
      const record = decoded?.record;
      if (record && record.period > currentPeriod) throw new Error(ASK_TURN_PERIOD_STALE);
      if (record?.period === currentPeriod && record.operationIds.includes(operationId)) {
        recordedCount = record.count;
        return current;
      }
      const currentCount = record?.period === currentPeriod ? record.count : 0;
      if (currentCount >= ASK_TRIAL_GROUNDED_CAP) throw new Error(ASK_TURN_CAP_REACHED);
      recordedCount = currentCount + 1;
      const priorOperationIds = record?.period === currentPeriod ? record.operationIds : [];
      return encodeTurns({
        period: currentPeriod,
        count: recordedCount,
        operationIds: [...priorOperationIds, operationId],
      });
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === ASK_TURN_CAP_REACHED ||
        error.message === ASK_TURN_RECORD_INVALID ||
        error.message === ASK_TURN_PERIOD_STALE ||
        error.message === ASK_TURN_RECORD_UNSUPPORTED_VERSION)
    ) {
      throw error;
    }
    try {
      const reconciledCount = await readCommittedOperation(currentPeriod, operationId);
      if (reconciledCount !== null) return reconciledCount;
    } catch {
      // Preserve the original write error when confirmation is also unavailable.
    }
    throw error;
  }
  if (recordedCount === null) throw new Error(ASK_TURN_RECORD_UNAVAILABLE);
  return recordedCount;
}

/** Test/seed reset, and the deletion-on-revocation hook (no content is stored here). */
export async function clearAskStore(): Promise<void> {
  await multiRemovePrivateItems([CONSENT_KEY, TURNS_KEY]);
}
