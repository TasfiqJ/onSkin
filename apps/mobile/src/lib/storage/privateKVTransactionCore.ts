export const PRIVATE_KV_TRANSACTION_JOURNAL_KEY = 'routinekind.private-kv.transaction.v1';
export const PRIVATE_KV_TRANSACTION_SCHEMA_VERSION = 1 as const;
export const MAX_PRIVATE_KV_TRANSACTION_TARGETS = 8;
export const MAX_PRIVATE_KV_TRANSACTION_VALUE_CHARS = 4 * 1024 * 1024;
export const MAX_PRIVATE_KV_TRANSACTION_TOTAL_CHARS = 12 * 1024 * 1024;

const SHA256_HEX = /^[0-9a-f]{64}$/;

export type PrivateKVTransactionTarget = Readonly<{
  key: string;
  beforeRaw: string | null;
  nextValue: string | null;
}>;

export type PrivateKVTransactionJournal = Readonly<{
  version: typeof PRIVATE_KV_TRANSACTION_SCHEMA_VERSION;
  transactionId: string;
  targets: readonly PrivateKVTransactionTarget[];
}>;

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

function boundedNullableString(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > MAX_PRIVATE_KV_TRANSACTION_VALUE_CHARS) {
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
    parsed.version !== PRIVATE_KV_TRANSACTION_SCHEMA_VERSION ||
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
  const targets = parsed.targets.map((value): PrivateKVTransactionTarget => {
    if (!isRecord(value) || !hasExactKeys(value, ['key', 'beforeRaw', 'nextValue'])) {
      invalid();
    }
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
    const beforeRaw = boundedNullableString(value.beforeRaw);
    const nextValue = boundedNullableString(value.nextValue);
    totalChars += key.length + (beforeRaw?.length ?? 0) + (nextValue?.length ?? 0);
    if (totalChars > MAX_PRIVATE_KV_TRANSACTION_TOTAL_CHARS) invalid();
    return Object.freeze({ key, beforeRaw, nextValue });
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
