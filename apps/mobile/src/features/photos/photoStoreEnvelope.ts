export const PHOTO_STORE_VERSION = 2;
export const PHOTO_METADATA_INVALID = 'PHOTO_METADATA_INVALID';
export const PHOTO_METADATA_UNSUPPORTED = 'PHOTO_METADATA_UNSUPPORTED';
export const PHOTO_MUTATION_RECOVERY_REQUIRED = 'PHOTO_MUTATION_RECOVERY_REQUIRED';
export const PHOTO_MUTATION_JOURNAL_INCONSISTENT = 'PHOTO_MUTATION_JOURNAL_INCONSISTENT';

const MAX_PHOTO_RECORDS = 10_000;
const OPAQUE_OPERATION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PhotoMutationKind = 'add' | 'delete' | 'clear';
export type PhotoMutationPhase = 'prepared' | 'metadata_committed';

/**
 * This is deliberately content-free. It may identify only a random operation,
 * its kind, and its durability phase. Records and paths needed for recovery
 * stay in the encrypted envelope's `items` / `retainedItems` authorities.
 */
export type PhotoMutationJournal = {
  kind: PhotoMutationKind;
  operationId: string;
  phase: PhotoMutationPhase;
};

export type DecodedPhotoStore = {
  format: 'absent' | 'legacy' | 'v2';
  items: unknown[];
  mutation: PhotoMutationJournal | null;
  retainedItems: unknown[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(record: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function isMutationKind(value: unknown): value is PhotoMutationKind {
  return value === 'add' || value === 'delete' || value === 'clear';
}

function isMutationPhase(value: unknown): value is PhotoMutationPhase {
  return value === 'prepared' || value === 'metadata_committed';
}

function parseMutation(value: unknown): PhotoMutationJournal | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['kind', 'operationId', 'phase']) ||
    !isMutationKind(value.kind) ||
    typeof value.operationId !== 'string' ||
    !OPAQUE_OPERATION_ID.test(value.operationId) ||
    !isMutationPhase(value.phase)
  ) {
    throw new Error(PHOTO_METADATA_INVALID);
  }
  return {
    kind: value.kind,
    operationId: value.operationId.toLowerCase(),
    phase: value.phase,
  };
}

export function decodePhotoStore(raw: string | null): DecodedPhotoStore {
  if (raw === null) {
    return { format: 'absent', items: [], mutation: null, retainedItems: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(PHOTO_METADATA_INVALID);
  }

  // V1 was a bare array. It remains read compatible and is migrated only by an
  // explicit mutation that writes the atomic V2 envelope.
  if (Array.isArray(parsed)) {
    return { format: 'legacy', items: parsed, mutation: null, retainedItems: [] };
  }

  if (!isRecord(parsed)) {
    throw new Error(PHOTO_METADATA_INVALID);
  }
  if (typeof parsed.version === 'number' && parsed.version !== PHOTO_STORE_VERSION) {
    throw new Error(PHOTO_METADATA_UNSUPPORTED);
  }
  if (!hasExactKeys(parsed, ['version', 'items', 'mutation', 'retainedItems'])) {
    throw new Error(PHOTO_METADATA_INVALID);
  }
  if (
    parsed.version !== PHOTO_STORE_VERSION ||
    !Array.isArray(parsed.items) ||
    !Array.isArray(parsed.retainedItems) ||
    parsed.items.length > MAX_PHOTO_RECORDS ||
    parsed.retainedItems.length > MAX_PHOTO_RECORDS
  ) {
    throw new Error(PHOTO_METADATA_INVALID);
  }

  const mutation = parseMutation(parsed.mutation);
  if (mutation === null && parsed.retainedItems.length !== 0) {
    throw new Error(PHOTO_METADATA_INVALID);
  }

  return {
    format: 'v2',
    items: parsed.items,
    mutation,
    retainedItems: parsed.retainedItems,
  };
}

type SettledPhotoStoreInput = {
  items: readonly unknown[];
  mutation: null;
  retainedItems?: readonly [];
};

type PendingPhotoStoreInput = {
  items: readonly unknown[];
  mutation: PhotoMutationJournal;
  retainedItems: readonly unknown[];
};

export function encodePhotoStore(params: SettledPhotoStoreInput | PendingPhotoStoreInput): string {
  const retainedItems = params.retainedItems ?? [];
  if (
    params.items.length > MAX_PHOTO_RECORDS ||
    retainedItems.length > MAX_PHOTO_RECORDS ||
    (params.mutation === null && retainedItems.length !== 0)
  ) {
    throw new Error(PHOTO_METADATA_INVALID);
  }
  return JSON.stringify({
    version: PHOTO_STORE_VERSION,
    items: params.items,
    mutation: params.mutation,
    retainedItems,
  });
}

/** Pure compatibility decoder for local account export. */
export function decodePhotoStoreItemsForExport(raw: string): unknown[] {
  const decoded = decodePhotoStore(raw);
  if (decoded.mutation !== null) throw new Error(PHOTO_MUTATION_RECOVERY_REQUIRED);
  return decoded.items;
}
