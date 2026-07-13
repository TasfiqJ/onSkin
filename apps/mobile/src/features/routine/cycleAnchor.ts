import { useQuery } from '@tanstack/react-query';

import { localDateString } from '@/features/today/useToday';
import { useLocalDateBoundary } from '@/lib/query/localDateBoundaryStore';
import {
  queryKeys,
  runOwnerQueryOperation,
  shouldRefetchCurrentLocalDayQuery,
} from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { getPrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';

// The skin-cycle anchor (the date the cycle "started"), used to compute which
// night tonight is (docs/02 section 5 / docs/03 section 5). New writes use a strict
// versioned envelope; the historical bare ISO date stays readable until an
// explicit Start Today mutation upgrades it.
const KEY = 'onskin.cycleAnchor';
const SCHEMA_VERSION = 1 as const;

export const CYCLE_ANCHOR_INVALID = 'CYCLE_ANCHOR_INVALID';
export const CYCLE_ANCHOR_UNSUPPORTED_VERSION = 'CYCLE_ANCHOR_UNSUPPORTED_VERSION';
export const CYCLE_ANCHOR_UNAVAILABLE = 'CYCLE_ANCHOR_UNAVAILABLE';

type CycleAnchorEnvelope = {
  schemaVersion: typeof SCHEMA_VERSION;
  anchorISO: string;
};

export type CycleAnchorRead =
  | { status: 'missing'; anchorISO: null }
  | { status: 'available'; anchorISO: string; format: 'current' | 'legacy' }
  | { status: 'unavailable' | 'corrupt' | 'unsupported_version'; anchorISO: null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function normalizeLocalDateISO(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? text
    : null;
}

function anchorError(code: string): Error {
  return new Error(code);
}

function decodeCycleAnchor(raw: string): {
  format: 'current' | 'legacy';
  anchorISO: string;
} {
  const legacyAnchor = normalizeLocalDateISO(raw);
  if (legacyAnchor) return { format: 'legacy', anchorISO: legacyAnchor };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw anchorError(CYCLE_ANCHOR_INVALID);
  }
  if (!isRecord(parsed)) throw anchorError(CYCLE_ANCHOR_INVALID);
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    if (
      typeof parsed.schemaVersion === 'number' &&
      Number.isSafeInteger(parsed.schemaVersion) &&
      parsed.schemaVersion > SCHEMA_VERSION
    ) {
      throw anchorError(CYCLE_ANCHOR_UNSUPPORTED_VERSION);
    }
    throw anchorError(CYCLE_ANCHOR_INVALID);
  }
  if (!hasExactKeys(parsed, ['schemaVersion', 'anchorISO'])) {
    throw anchorError(CYCLE_ANCHOR_INVALID);
  }
  const anchorISO = normalizeLocalDateISO(parsed.anchorISO);
  if (!anchorISO || anchorISO !== parsed.anchorISO) throw anchorError(CYCLE_ANCHOR_INVALID);
  return { format: 'current', anchorISO };
}

function encodeCycleAnchor(anchorISO: string): string {
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION, anchorISO } satisfies CycleAnchorEnvelope);
}

function classifyCycleAnchorError(error: unknown): CycleAnchorRead {
  const message = error instanceof Error ? error.message : '';
  if (message === CYCLE_ANCHOR_UNSUPPORTED_VERSION || message.includes('UNSUPPORTED')) {
    return { status: 'unsupported_version', anchorISO: null };
  }
  if (
    message === CYCLE_ANCHOR_INVALID ||
    message === 'PRIVATE_KV_ENVELOPE_INVALID' ||
    message === 'PRIVATE_KV_DECRYPTION_FAILED'
  ) {
    return { status: 'corrupt', anchorISO: null };
  }
  return { status: 'unavailable', anchorISO: null };
}

/** Read without repairing, deleting, or upgrading stored bytes. */
export async function readCycleAnchor(): Promise<CycleAnchorRead> {
  let raw: string | null;
  try {
    raw = await getPrivateItem(KEY);
  } catch (error) {
    return classifyCycleAnchorError(error);
  }
  if (raw === null) return { status: 'missing', anchorISO: null };
  try {
    const decoded = decodeCycleAnchor(raw);
    return { status: 'available', ...decoded };
  } catch (error) {
    return classifyCycleAnchorError(error);
  }
}

/** Missing is a valid first-run state. Every unreadable state fails closed. */
export async function getCycleAnchor(): Promise<string> {
  const result = await readCycleAnchor();
  if (result.status === 'available') return result.anchorISO;
  if (result.status === 'missing') return localDateString();
  if (result.status === 'unsupported_version') {
    throw anchorError(CYCLE_ANCHOR_UNSUPPORTED_VERSION);
  }
  if (result.status === 'corrupt') throw anchorError(CYCLE_ANCHOR_INVALID);
  throw anchorError(CYCLE_ANCHOR_UNAVAILABLE);
}

/** Explicit mutation: validate the request, reject unreadable existing bytes,
 * and atomically upgrade a valid legacy anchor. */
export async function setCycleAnchor(iso = localDateString()): Promise<void> {
  const anchorISO = normalizeLocalDateISO(iso);
  if (!anchorISO) throw anchorError(CYCLE_ANCHOR_INVALID);

  await updatePrivateItem(KEY, (current) => {
    if (current === null) return encodeCycleAnchor(anchorISO);
    const decoded = decodeCycleAnchor(current);
    if (decoded.format === 'current' && decoded.anchorISO === anchorISO) return current;
    return encodeCycleAnchor(anchorISO);
  });
}

export function useCycleAnchor() {
  const ownerScope = useOwnerQueryScope();
  const boundary = useLocalDateBoundary();
  return useQuery({
    queryKey: queryKeys.cycleAnchor(ownerScope, boundary),
    queryFn: () => runOwnerQueryOperation(ownerScope, () => getCycleAnchor()),
    refetchOnReconnect: shouldRefetchCurrentLocalDayQuery,
    refetchOnWindowFocus: shouldRefetchCurrentLocalDayQuery,
  });
}
