import {
  getPrivateItem,
  readPrivateItem,
  type PrivateKVReadFailureReason,
  updatePrivateItem,
} from '@/lib/storage/privateKV';

const CURRENT_TRUE = 'v1:1';
const CURRENT_FALSE = 'v1:0';

export const PRIVATE_BOOLEAN_INVALID = 'PRIVATE_BOOLEAN_INVALID';
export const PRIVATE_BOOLEAN_UNAVAILABLE = 'PRIVATE_BOOLEAN_UNAVAILABLE';
export const PRIVATE_BOOLEAN_UNSUPPORTED_VERSION = 'PRIVATE_BOOLEAN_UNSUPPORTED_VERSION';

export type PrivateBooleanCorruptReason =
  | 'invalid_value'
  | 'content_key_invalid'
  | 'envelope_invalid'
  | 'decryption_failed';

export type PrivateBooleanReadResult =
  | { status: 'absent' }
  | { status: 'available'; value: boolean; format: 'current' | 'legacy' }
  | { status: 'unavailable'; reason: PrivateKVReadFailureReason }
  | { status: 'corrupt'; reason: PrivateBooleanCorruptReason }
  | { status: 'unsupported_version' };

type PrivateBooleanReadFailure = Exclude<
  PrivateBooleanReadResult,
  { status: 'absent' } | { status: 'available' }
>;

export class PrivateBooleanReadError extends Error {
  readonly result: PrivateBooleanReadFailure;

  constructor(result: PrivateBooleanReadFailure) {
    const code =
      result.status === 'unsupported_version'
        ? PRIVATE_BOOLEAN_UNSUPPORTED_VERSION
        : result.status === 'corrupt'
          ? PRIVATE_BOOLEAN_INVALID
          : PRIVATE_BOOLEAN_UNAVAILABLE;
    super(code);
    this.name = 'PrivateBooleanReadError';
    this.result = result;
  }
}

function decodeAvailablePrivateBoolean(value: string): PrivateBooleanReadResult {
  if (value === CURRENT_TRUE) return { status: 'available', value: true, format: 'current' };
  if (value === CURRENT_FALSE) return { status: 'available', value: false, format: 'current' };

  const versioned = /^v([1-9]\d*):/.exec(value);
  if (versioned) {
    return versioned[1] === '1'
      ? { status: 'corrupt', reason: 'invalid_value' }
      : { status: 'unsupported_version' };
  }

  // Pre-version values remain readable but ordinary reads never repair bytes.
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') {
    return { status: 'available', value: true, format: 'legacy' };
  }
  if (normalized === '0' || normalized === 'false') {
    return { status: 'available', value: false, format: 'legacy' };
  }
  return { status: 'corrupt', reason: 'invalid_value' };
}

/** Read and classify a private boolean without repairing, migrating, or deleting bytes. */
export async function readPrivateBoolean(key: string): Promise<PrivateBooleanReadResult> {
  const result = await readPrivateItem(key);
  if (result.status !== 'available') return result;
  return decodeAvailablePrivateBoolean(result.value);
}

/** Missing means the default-off state. Unreadable state remains an explicit error. */
export function requirePrivateBoolean(result: PrivateBooleanReadResult): boolean {
  if (result.status === 'available') return result.value;
  if (result.status === 'absent') return false;
  throw new PrivateBooleanReadError(result);
}

/**
 * Deliberately collapse every non-granted state to false for hard gates whose
 * recovery UI is owned by a higher-level private-data boundary.
 */
export async function getPrivateBooleanFailClosed(key: string): Promise<boolean> {
  const result = await readPrivateBoolean(key);
  return result.status === 'available' ? result.value : false;
}

/**
 * Legacy fail-closed compatibility for the photo-consent fallback. New callers
 * must use readPrivateBoolean and make the failure policy explicit.
 */
export async function getPrivateBoolean(key: string): Promise<boolean> {
  try {
    const value = await getPrivateItem(key);
    if (value == null) return false;
    const result = decodeAvailablePrivateBoolean(value);
    return result.status === 'available' ? result.value : false;
  } catch {
    return false;
  }
}

export async function setPrivateBoolean(key: string, enabled: boolean): Promise<void> {
  await updatePrivateBoolean(key, () => enabled);
}

/**
 * Atomically classify, transform, and persist a private boolean under the
 * private-KV per-key mutation lock.
 */
export async function updatePrivateBoolean(
  key: string,
  updater: (current: boolean | null) => boolean,
): Promise<void> {
  await updatePrivateItem(key, (current) => {
    // A deliberate write may canonically upgrade a valid legacy value. It must
    // not downgrade or replace application-level corrupt/future bytes.
    const currentValue =
      current === null ? null : requirePrivateBoolean(decodeAvailablePrivateBoolean(current));
    return updater(currentValue) ? CURRENT_TRUE : CURRENT_FALSE;
  });
}
