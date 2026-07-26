export const PRIVATE_KV_TRANSACTION_JOURNAL_KEY = 'routinekind.private-kv.transaction.v1';
export const PRIVATE_KV_TRANSACTION_SCHEMA_VERSION = 2 as const;
export const PRIVATE_KV_TRANSACTION_LEGACY_SCHEMA_VERSION = 1 as const;
export const MAX_PRIVATE_KV_TRANSACTION_TARGETS = 8;
export const MAX_PRIVATE_KV_TRANSACTION_VALUE_CHARS = 8 * 1024 * 1024 + 1024;
export const MAX_PRIVATE_KV_TRANSACTION_LEGACY_VALUE_CHARS = 4 * 1024 * 1024;
export const MAX_PRIVATE_KV_TRANSACTION_LEGACY_TOTAL_CHARS = 12 * 1024 * 1024;
/**
 * The largest currently registered atomic pair is a maximum pending photo
 * envelope plus a maximum outbox envelope. V2 stores only the previous-value
 * fingerprints, so this bound does not duplicate the encrypted prior values.
 */
export const MAX_PRIVATE_KV_TRANSACTION_TOTAL_CHARS = 16 * 1024 * 1024;

const SHA256_HEX = /^[0-9a-f]{64}$/;

export type PrivateKVTransactionTarget = Readonly<{
  key: string;
  beforeRawHash: string;
  nextValue: string | null;
}>;

export type PrivateKVTransactionJournalV2 = Readonly<{
  version: typeof PRIVATE_KV_TRANSACTION_SCHEMA_VERSION;
  transactionId: string;
  targets: readonly PrivateKVTransactionTarget[];
}>;

export type PrivateKVTransactionLegacyTarget = Readonly<{
  key: string;
  beforeRaw: string | null;
  nextValue: string | null;
}>;

export type PrivateKVTransactionJournalV1 = Readonly<{
  version: typeof PRIVATE_KV_TRANSACTION_LEGACY_SCHEMA_VERSION;
  transactionId: string;
  targets: readonly PrivateKVTransactionLegacyTarget[];
}>;

export type PrivateKVTransactionJournal =
  | PrivateKVTransactionJournalV1
  | PrivateKVTransactionJournalV2;

export class PrivateKVTransactionJournalError extends Error {
  readonly kind: 'invalid' | 'unsupported_version';

  constructor(kind: 'invalid' | 'unsupported_version') {
    super(
      kind === 'unsupported_version'
        ? 'PRIVATE_KV_TRANSACTION_JOURNAL_UNSUPPORTED'
        : 'PRIVATE_KV_TRANSACTION_JOURNAL_INVALID',
    );
    this.name = 'PrivateKVTransactionJournalError';
    this.kind = kind;
  }
}

function invalid(): never {
  throw new PrivateKVTransactionJournalError('invalid');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expected.length &&
    expected.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function boundedNullableString(value: unknown, maxChars: number): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > maxChars) {
    invalid();
  }
  return value;
}

export function decodePrivateKVTransactionJournal(raw: string): PrivateKVTransactionJournal {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    invalid();
  }
  if (!isRecord(parsed)) invalid();
  if (
    typeof parsed.version === 'number' &&
    Number.isSafeInteger(parsed.version) &&
    parsed.version > PRIVATE_KV_TRANSACTION_SCHEMA_VERSION
  ) {
    throw new PrivateKVTransactionJournalError('unsupported_version');
  }
  if (
    (parsed.version !== PRIVATE_KV_TRANSACTION_SCHEMA_VERSION &&
      parsed.version !== PRIVATE_KV_TRANSACTION_LEGACY_SCHEMA_VERSION) ||
    !hasExactKeys(parsed, ['version', 'transactionId', 'targets']) ||
    typeof parsed.transactionId !== 'string' ||
    !SHA256_HEX.test(parsed.transactionId) ||
    !Array.isArray(parsed.targets) ||
    parsed.targets.length < 1 ||
    parsed.targets.length > MAX_PRIVATE_KV_TRANSACTION_TARGETS
  ) {
    invalid();
  }

  const seen = new Set<string>();
  let totalChars = 0;
  const parseKey = (value: Record<string, unknown>): string => {
    const key = value.key;
    if (
      typeof key !== 'string' ||
      key.length < 1 ||
      key.length > 240 ||
      key.trim() !== key ||
      seen.has(key)
    ) {
      invalid();
    }
    seen.add(key);
    return key;
  };

  if (parsed.version === PRIVATE_KV_TRANSACTION_LEGACY_SCHEMA_VERSION) {
    const targets = parsed.targets.map((value): PrivateKVTransactionLegacyTarget => {
      if (!isRecord(value) || !hasExactKeys(value, ['key', 'beforeRaw', 'nextValue'])) {
        invalid();
      }
      const key = parseKey(value);
      const beforeRaw = boundedNullableString(
        value.beforeRaw,
        MAX_PRIVATE_KV_TRANSACTION_LEGACY_VALUE_CHARS,
      );
      const nextValue = boundedNullableString(
        value.nextValue,
        MAX_PRIVATE_KV_TRANSACTION_LEGACY_VALUE_CHARS,
      );
      totalChars += key.length + (beforeRaw?.length ?? 0) + (nextValue?.length ?? 0);
      if (totalChars > MAX_PRIVATE_KV_TRANSACTION_LEGACY_TOTAL_CHARS) invalid();
      return Object.freeze({ key, beforeRaw, nextValue });
    });
    return Object.freeze({
      version: PRIVATE_KV_TRANSACTION_LEGACY_SCHEMA_VERSION,
      transactionId: parsed.transactionId,
      targets: Object.freeze(targets),
    });
  }

  const targets = parsed.targets.map((value): PrivateKVTransactionTarget => {
    if (!isRecord(value) || !hasExactKeys(value, ['key', 'beforeRawHash', 'nextValue'])) {
      invalid();
    }
    const key = parseKey(value);
    if (typeof value.beforeRawHash !== 'string' || !SHA256_HEX.test(value.beforeRawHash)) {
      invalid();
    }
    const nextValue = boundedNullableString(
      value.nextValue,
      MAX_PRIVATE_KV_TRANSACTION_VALUE_CHARS,
    );
    totalChars += key.length + value.beforeRawHash.length + (nextValue?.length ?? 0);
    if (totalChars > MAX_PRIVATE_KV_TRANSACTION_TOTAL_CHARS) invalid();
    return Object.freeze({ key, beforeRawHash: value.beforeRawHash, nextValue });
  });

  return Object.freeze({
    version: PRIVATE_KV_TRANSACTION_SCHEMA_VERSION,
    transactionId: parsed.transactionId,
    targets: Object.freeze(targets),
  });
}

export function encodePrivateKVTransactionJournal(journal: PrivateKVTransactionJournal): string {
  return JSON.stringify(journal);
}
