import {
  AccountGenerationLeaseError,
  awaitAccountGenerationLease,
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { runOwnerQueryOperation, type OwnerQueryScope } from '@/lib/query/queryKeys';
import {
  readPrivateItem,
  updatePrivateItem,
  type PrivateKVReadFailureReason,
} from '@/lib/storage/privateKV';

import {
  shouldTrackCycleNightCompleted,
  type CycleNightCompletionCandidate,
} from './cycleCompletion';

const KEY = 'onskin.cycleNightAnalytics.v1';
const SCHEMA_VERSION = 1 as const;

export const CYCLE_NIGHT_ANALYTICS_INVALID = 'CYCLE_NIGHT_ANALYTICS_INVALID';
export const CYCLE_NIGHT_ANALYTICS_UNSUPPORTED_VERSION =
  'CYCLE_NIGHT_ANALYTICS_UNSUPPORTED_VERSION';
export const CYCLE_NIGHT_ANALYTICS_CAPACITY_REACHED = 'CYCLE_NIGHT_ANALYTICS_CAPACITY_REACHED';
export const MAX_CYCLE_NIGHT_ANALYTICS_DATES = 4_096;
export const MAX_CYCLE_NIGHT_ANALYTICS_RECORD_CHARS = 65_536;

type CycleNightAnalyticsEnvelope = {
  version: typeof SCHEMA_VERSION;
  completedLocalDates: string[];
};

type CycleNightAnalyticsCorruptReason =
  | 'content_key_invalid'
  | 'envelope_invalid'
  | 'decryption_failed'
  | 'invalid_payload';

export type CycleNightAnalyticsReceiptRead =
  | { status: 'absent'; completedLocalDates: readonly string[] }
  | { status: 'available'; completedLocalDates: readonly string[] }
  | { status: 'unavailable'; completedLocalDates: null; reason: PrivateKVReadFailureReason }
  | { status: 'corrupt'; completedLocalDates: null; reason: CycleNightAnalyticsCorruptReason }
  | { status: 'unsupported_version'; completedLocalDates: null };

export type CycleNightAnalyticsReservationResult =
  | { status: 'reserved' }
  | { status: 'already_reserved' }
  | { status: 'not_candidate' }
  | { status: 'unavailable' }
  | { status: 'cancelled' };

export type CycleNightAnalyticsReservationInput = CycleNightCompletionCandidate & {
  localDate: string;
  scope: OwnerQueryScope;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function normalizeLocalDateISO(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() !== value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString().slice(0, 10) === value ? value : null;
}

function decodeCompletedLocalDates(raw: string | null): string[] {
  if (raw === null) return [];
  if (raw.length > MAX_CYCLE_NIGHT_ANALYTICS_RECORD_CHARS) {
    throw new Error(CYCLE_NIGHT_ANALYTICS_INVALID);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(CYCLE_NIGHT_ANALYTICS_INVALID);
  }
  if (!isRecord(parsed)) throw new Error(CYCLE_NIGHT_ANALYTICS_INVALID);
  if (
    typeof parsed.version === 'number' &&
    Number.isSafeInteger(parsed.version) &&
    parsed.version > SCHEMA_VERSION
  ) {
    throw new Error(CYCLE_NIGHT_ANALYTICS_UNSUPPORTED_VERSION);
  }
  if (
    parsed.version !== SCHEMA_VERSION ||
    !hasExactKeys(parsed, ['version', 'completedLocalDates']) ||
    !Array.isArray(parsed.completedLocalDates) ||
    parsed.completedLocalDates.length > MAX_CYCLE_NIGHT_ANALYTICS_DATES
  ) {
    throw new Error(CYCLE_NIGHT_ANALYTICS_INVALID);
  }

  const completedLocalDates: string[] = [];
  for (const value of parsed.completedLocalDates) {
    const normalized = normalizeLocalDateISO(value);
    const previous = completedLocalDates.at(-1);
    if (!normalized || (previous !== undefined && normalized <= previous)) {
      throw new Error(CYCLE_NIGHT_ANALYTICS_INVALID);
    }
    completedLocalDates.push(normalized);
  }
  return completedLocalDates;
}

function encodeCompletedLocalDates(completedLocalDates: string[]): string {
  const encoded = JSON.stringify({
    version: SCHEMA_VERSION,
    completedLocalDates,
  } satisfies CycleNightAnalyticsEnvelope);
  if (encoded.length > MAX_CYCLE_NIGHT_ANALYTICS_RECORD_CHARS) {
    throw new Error(CYCLE_NIGHT_ANALYTICS_INVALID);
  }
  return encoded;
}

async function readCycleNightAnalyticsReceiptsWithLease(
  lease: AccountGenerationLease,
): Promise<CycleNightAnalyticsReceiptRead> {
  let stored: Awaited<ReturnType<typeof readPrivateItem>>;
  try {
    stored = await awaitAccountGenerationLease(lease, () => readPrivateItem(KEY));
  } catch {
    lease.assertCurrent();
    return { status: 'unavailable', completedLocalDates: null, reason: 'storage_unavailable' };
  }
  lease.assertCurrent();

  if (stored.status === 'absent') return { status: 'absent', completedLocalDates: [] };
  if (stored.status === 'unavailable') {
    return { status: 'unavailable', completedLocalDates: null, reason: stored.reason };
  }
  if (stored.status === 'corrupt') {
    return { status: 'corrupt', completedLocalDates: null, reason: stored.reason };
  }
  if (stored.status === 'unsupported_version') {
    return { status: 'unsupported_version', completedLocalDates: null };
  }

  try {
    return {
      status: 'available',
      completedLocalDates: decodeCompletedLocalDates(stored.value),
    };
  } catch (error) {
    return error instanceof Error && error.message === CYCLE_NIGHT_ANALYTICS_UNSUPPORTED_VERSION
      ? { status: 'unsupported_version', completedLocalDates: null }
      : { status: 'corrupt', completedLocalDates: null, reason: 'invalid_payload' };
  }
}

/** Read the owner-bound receipt ledger without repairing or replacing uncertain bytes. */
export async function readCycleNightAnalyticsReceipts(): Promise<CycleNightAnalyticsReceiptRead> {
  try {
    return await runAccountGenerationOperation(readCycleNightAnalyticsReceiptsWithLease);
  } catch (error) {
    return {
      status: 'unavailable',
      completedLocalDates: null,
      reason:
        error instanceof AccountGenerationLeaseError ? 'account_boundary' : 'storage_unavailable',
    };
  }
}

/**
 * Atomically reserve the privacy-safe cycle-night analytics event for one owner
 * and local date. Uncertain storage fails closed: an event may be omitted, but a
 * duplicate can never be emitted from malformed, future, or unconfirmed bytes.
 */
export async function reserveCycleNightCompletionAnalyticsForOwner({
  localDate,
  scope,
  ...candidate
}: CycleNightAnalyticsReservationInput): Promise<CycleNightAnalyticsReservationResult> {
  if (!shouldTrackCycleNightCompleted(candidate)) return { status: 'not_candidate' };
  const normalizedDate = normalizeLocalDateISO(localDate);
  if (!normalizedDate) return { status: 'unavailable' };

  try {
    return await runOwnerQueryOperation(scope, async (lease) => {
      let reserved = false;
      await awaitAccountGenerationLease(lease, () =>
        updatePrivateItem(KEY, (raw) => {
          const completedLocalDates = decodeCompletedLocalDates(raw);
          if (completedLocalDates.includes(normalizedDate)) return raw;
          if (completedLocalDates.length >= MAX_CYCLE_NIGHT_ANALYTICS_DATES) {
            throw new Error(CYCLE_NIGHT_ANALYTICS_CAPACITY_REACHED);
          }

          reserved = true;
          return encodeCompletedLocalDates([...completedLocalDates, normalizedDate].sort());
        }),
      );
      lease.assertCurrent();
      return reserved ? { status: 'reserved' } : { status: 'already_reserved' };
    });
  } catch (error) {
    return error instanceof AccountGenerationLeaseError
      ? { status: 'cancelled' }
      : { status: 'unavailable' };
  }
}
