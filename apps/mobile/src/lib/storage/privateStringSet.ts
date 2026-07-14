export const PRIVATE_STRING_SET_INVALID = 'PRIVATE_STRING_SET_INVALID';
export const PRIVATE_STRING_SET_UNSUPPORTED_VERSION = 'PRIVATE_STRING_SET_UNSUPPORTED_VERSION';

const SCHEMA_VERSION = 1 as const;

type PrivateStringSetEnvelope = {
  version: typeof SCHEMA_VERSION;
  values: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(code: string): Error {
  return new Error(code);
}

function decodeLegacyValues(value: unknown): string[] {
  if (!Array.isArray(value)) throw invalid(PRIVATE_STRING_SET_INVALID);
  const values: string[] = [];
  for (const item of value) {
    if (
      typeof item !== 'string' ||
      item.length === 0 ||
      item.trim() !== item ||
      values.includes(item)
    ) {
      throw invalid(PRIVATE_STRING_SET_INVALID);
    }
    values.push(item);
  }
  return values;
}

function decodeCurrentEnvelope(value: Record<string, unknown>): string[] {
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== 'values' || keys[1] !== 'version') {
    throw invalid(PRIVATE_STRING_SET_INVALID);
  }
  if (value.version !== SCHEMA_VERSION) {
    if (
      typeof value.version === 'number' &&
      Number.isSafeInteger(value.version) &&
      value.version > SCHEMA_VERSION
    ) {
      throw invalid(PRIVATE_STRING_SET_UNSUPPORTED_VERSION);
    }
    throw invalid(PRIVATE_STRING_SET_INVALID);
  }
  if (!Array.isArray(value.values)) throw invalid(PRIVATE_STRING_SET_INVALID);

  const values: string[] = [];
  for (const item of value.values) {
    if (typeof item !== 'string' || item.length === 0 || item.trim() !== item) {
      throw invalid(PRIVATE_STRING_SET_INVALID);
    }
    if (values.includes(item)) throw invalid(PRIVATE_STRING_SET_INVALID);
    values.push(item);
  }
  return values;
}

/** Decode the current envelope and the pre-envelope string-array format. */
export function decodePrivateStringSet(raw: string | null): string[] {
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw invalid(PRIVATE_STRING_SET_INVALID);
  }
  if (Array.isArray(parsed)) return decodeLegacyValues(parsed);
  if (!isRecord(parsed)) throw invalid(PRIVATE_STRING_SET_INVALID);
  return decodeCurrentEnvelope(parsed);
}

export function encodePrivateStringSet(values: readonly string[]): string {
  return JSON.stringify({
    version: SCHEMA_VERSION,
    values: [...values],
  } satisfies PrivateStringSetEnvelope);
}
