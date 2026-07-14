import {
  type DeletionIntakeTokens,
  type PublicDeletionStatusLookup,
  validateDeletionIntakeTokens,
} from './durableDeletionCore.ts';

export const ACCOUNT_DELETION_RECEIPT_HMAC_KEY_ENV = 'ACCOUNT_DELETION_RECEIPT_HMAC_KEY_HEX';
export const ACCOUNT_DELETION_RECEIPT_HMAC_KEY_VERSION_ENV =
  'ACCOUNT_DELETION_RECEIPT_HMAC_KEY_VERSION';
export const ACCOUNT_DELETION_SUBJECT_HMAC_CONTEXT = 'onskin-account-deletion-subject:v1:';
export const ACCOUNT_DELETION_INTAKE_OWNER_HMAC_CONTEXT =
  'onskin-account-deletion-intake-owner:v1:';
export const ACCOUNT_DELETION_APPLE_CODE_MAX_CHARS = 4_096;

const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const RESULT_CODE_PATTERN = /^[A-Z0-9_]{1,64}$/;
const KEY_HEX_PATTERN = /^[a-f0-9]{64}$/;
const SUBJECT_HMAC_CONTEXT_BYTES = new TextEncoder().encode(ACCOUNT_DELETION_SUBJECT_HMAC_CONTEXT);
const INTAKE_OWNER_HMAC_CONTEXT_BYTES = new TextEncoder().encode(
  ACCOUNT_DELETION_INTAKE_OWNER_HMAC_CONTEXT,
);

export type AccountDeletionBeginRequest = DeletionIntakeTokens & {
  action: 'begin';
  appleAuthorizationCode?: string;
};

export type AccountDeletionStatusRequest = {
  action: 'status';
  capability: string;
};

export type AccountDeletionBarrierPreflightRequest = {
  action: 'preflight';
};

export type AccountDeletionWorkerRequest = { action: 'work' };

export type AccountDeletionRequest =
  | AccountDeletionBeginRequest
  | AccountDeletionBarrierPreflightRequest
  | AccountDeletionStatusRequest
  | AccountDeletionWorkerRequest;

export type AuthDeleteDisposition = 'verify_absence' | 'ambiguous' | 'action_required';

export type AuthLookupDisposition = 'absent' | 'present' | 'retryable' | 'action_required';

export type AccountDeletionStatusRow = {
  operation_id: string | null;
  operation_state: string;
  operation_expires_at: string | null;
  next_step_name: string | null;
  next_step_status: string | null;
  attempt_count: number | null;
  next_attempt_at: string | null;
  lease_expires_at: string | null;
  receipt_expires_at: string | null;
  apple_manual_revocation_required: boolean | null;
};

export class DurableDeletionRuntimeCoreError extends Error {
  constructor(
    public readonly code:
      | 'DELETION_REQUEST_INVALID'
      | 'DELETION_AUTH_RESULT_INVALID'
      | 'DELETION_STATUS_ROW_INVALID'
      | 'DELETION_RECEIPT_KEY_INVALID'
      | 'DELETION_RECEIPT_CONTEXT_INVALID',
  ) {
    super(code);
    this.name = 'DurableDeletionRuntimeCoreError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validAppleAuthorizationCode(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > ACCOUNT_DELETION_APPLE_CODE_MAX_CHARS ||
    value !== value.trim()
  ) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 31 || codeUnit === 127) return false;
  }
  return true;
}

export function parseAccountDeletionRequest(value: unknown): AccountDeletionRequest {
  if (!isRecord(value) || typeof value.action !== 'string') {
    throw new DurableDeletionRuntimeCoreError('DELETION_REQUEST_INVALID');
  }
  if (value.action === 'work' && hasExactKeys(value, ['action'])) {
    return { action: 'work' };
  }
  if (value.action === 'preflight' && hasExactKeys(value, ['action'])) {
    return { action: 'preflight' };
  }
  if (
    value.action === 'status' &&
    hasExactKeys(value, ['action', 'capability']) &&
    typeof value.capability === 'string' &&
    TOKEN_PATTERN.test(value.capability)
  ) {
    return { action: 'status', capability: value.capability };
  }
  if (value.action === 'begin') {
    const hasAppleCode = Object.hasOwn(value, 'appleAuthorizationCode');
    const expectedKeys = hasAppleCode
      ? ['action', 'idempotencyKey', 'statusCapability', 'appleAuthorizationCode']
      : ['action', 'idempotencyKey', 'statusCapability'];
    if (
      !hasExactKeys(value, expectedKeys) ||
      (hasAppleCode && !validAppleAuthorizationCode(value.appleAuthorizationCode))
    ) {
      throw new DurableDeletionRuntimeCoreError('DELETION_REQUEST_INVALID');
    }
    let tokens: DeletionIntakeTokens;
    try {
      tokens = validateDeletionIntakeTokens({
        idempotencyKey: value.idempotencyKey,
        statusCapability: value.statusCapability,
      });
    } catch {
      throw new DurableDeletionRuntimeCoreError('DELETION_REQUEST_INVALID');
    }
    return {
      action: 'begin',
      ...tokens,
      ...(hasAppleCode ? { appleAuthorizationCode: value.appleAuthorizationCode as string } : {}),
    };
  }
  throw new DurableDeletionRuntimeCoreError('DELETION_REQUEST_INVALID');
}

export function constantTimeEqual(left: string, right: string): boolean {
  let difference = left.length ^ right.length;
  const maximumLength = Math.max(left.length, right.length);
  for (let index = 0; index < maximumLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function authErrorFields(error: unknown): {
  code: string | null;
  status: number | null;
} {
  if (!isRecord(error)) return { code: null, status: null };
  return {
    code: typeof error.code === 'string' ? error.code : null,
    status:
      typeof error.status === 'number' && Number.isInteger(error.status) ? error.status : null,
  };
}

/**
 * Supabase hard DELETE is not retry-idempotent. Only a returned success or the
 * exact structured `user_not_found` error enters read-only absence
 * verification. Every transport/5xx/unknown result becomes ambiguous.
 */
export function classifyAuthHardDeleteResult(result: unknown): AuthDeleteDisposition {
  if (!isRecord(result) || !hasExactKeys(result, ['data', 'error'])) {
    return 'ambiguous';
  }
  if (result.error === null) return 'verify_absence';
  const error = authErrorFields(result.error);
  if (error.code === 'user_not_found' && error.status === 404) {
    return 'verify_absence';
  }
  if (error.status !== null && error.status >= 400 && error.status < 500) {
    return 'action_required';
  }
  return 'ambiguous';
}

/** Exact, non-creating GET reconciliation for an ambiguous Auth hard delete. */
export function classifyAuthUserLookupResult(
  result: unknown,
  expectedUserId: string,
): AuthLookupDisposition {
  if (!CANONICAL_UUID_PATTERN.test(expectedUserId)) {
    throw new DurableDeletionRuntimeCoreError('DELETION_AUTH_RESULT_INVALID');
  }
  if (!isRecord(result) || !hasExactKeys(result, ['data', 'error'])) {
    return 'retryable';
  }
  const error = authErrorFields(result.error);
  if (error.code === 'user_not_found' && error.status === 404) return 'absent';
  if (result.error !== null) {
    if (
      error.status !== null &&
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== 404
    ) {
      return 'action_required';
    }
    return 'retryable';
  }
  if (
    isRecord(result.data) &&
    hasExactKeys(result.data, ['user']) &&
    isRecord(result.data.user) &&
    result.data.user.id === expectedUserId
  ) {
    return 'present';
  }
  return 'retryable';
}

export function accountDeletionRetryDelaySeconds(attemptCount: number): number {
  if (!Number.isSafeInteger(attemptCount) || attemptCount < 1) {
    throw new DurableDeletionRuntimeCoreError('DELETION_AUTH_RESULT_INVALID');
  }
  return Math.min(3_600, 5 * 2 ** Math.min(attemptCount - 1, 10));
}

function validTimestampOrNull(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value)));
}

function validStatusRow(value: unknown): value is AccountDeletionStatusRow {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'operation_id',
      'operation_state',
      'operation_expires_at',
      'next_step_name',
      'next_step_status',
      'attempt_count',
      'next_attempt_at',
      'lease_expires_at',
      'receipt_expires_at',
      'apple_manual_revocation_required',
    ]) ||
    !(
      value.operation_id === null ||
      (typeof value.operation_id === 'string' && CANONICAL_UUID_PATTERN.test(value.operation_id))
    ) ||
    typeof value.operation_state !== 'string' ||
    !(value.next_step_name === null || typeof value.next_step_name === 'string') ||
    !(value.next_step_status === null || typeof value.next_step_status === 'string') ||
    !(
      value.attempt_count === null ||
      (typeof value.attempt_count === 'number' &&
        Number.isSafeInteger(value.attempt_count) &&
        value.attempt_count >= 0)
    ) ||
    !validTimestampOrNull(value.operation_expires_at) ||
    !validTimestampOrNull(value.next_attempt_at) ||
    !validTimestampOrNull(value.lease_expires_at) ||
    !validTimestampOrNull(value.receipt_expires_at) ||
    !(
      value.apple_manual_revocation_required === null ||
      typeof value.apple_manual_revocation_required === 'boolean'
    )
  ) {
    return false;
  }
  return true;
}

function activePhase(
  row: AccountDeletionStatusRow,
): 'queued' | 'processing' | 'local_erasing' | 'provider_verifying' | 'delayed' {
  if (row.operation_state === 'pending') return 'queued';
  if (row.operation_state === 'action_required') return 'delayed';
  if (row.operation_state === 'ready_to_finalize') return 'processing';
  if (
    row.next_step_name === 'photo_storage_delete' ||
    row.next_step_name === 'service_rows_scrub' ||
    row.next_step_name === 'auth_user_delete'
  ) {
    return 'local_erasing';
  }
  if (row.next_step_status === 'ambiguous' || row.next_step_status === 'request_started') {
    return 'provider_verifying';
  }
  return 'processing';
}

/** Converts the single service-only SQL row into the deliberately opaque API contract. */
export function deletionStatusLookupFromDatabaseRow(value: unknown): PublicDeletionStatusLookup {
  if (value === null || value === undefined) return { kind: 'not_found' };
  if (!validStatusRow(value)) {
    throw new DurableDeletionRuntimeCoreError('DELETION_STATUS_ROW_INVALID');
  }
  if (value.operation_id === null) {
    if (value.operation_state === 'expired') return { kind: 'expired' };
    if (value.operation_state === 'completed') {
      return {
        kind: 'receipt',
        receiptState: 'completed',
        ...(value.apple_manual_revocation_required === true
          ? { notice: 'remove_apple_authorization' as const }
          : {}),
      };
    }
    if (value.operation_state === 'action_required') {
      return {
        kind: 'receipt',
        receiptState: 'action_required',
        nextPollAfterSeconds: 60,
      };
    }
    throw new DurableDeletionRuntimeCoreError('DELETION_STATUS_ROW_INVALID');
  }
  if (
    !['pending', 'running', 'ready_to_finalize', 'action_required'].includes(
      value.operation_state,
    ) ||
    value.operation_expires_at === null
  ) {
    throw new DurableDeletionRuntimeCoreError('DELETION_STATUS_ROW_INVALID');
  }
  const phase = activePhase(value);
  const nextPollAfterSeconds =
    phase === 'queued'
      ? 2
      : phase === 'local_erasing'
        ? 3
        : phase === 'delayed'
          ? 60
          : phase === 'provider_verifying'
            ? 30
            : 5;
  return {
    kind: 'operation',
    operationState: value.operation_state as
      | 'pending'
      | 'running'
      | 'ready_to_finalize'
      | 'action_required',
    phase,
    nextPollAfterSeconds,
  };
}

function hexToBytes(value: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

type EnvironmentReader = (name: string) => string | undefined;

export async function loadDeletionReceiptHmacKey(
  readEnvironment: EnvironmentReader = (name) => Deno.env.get(name),
): Promise<{ key: CryptoKey; keyVersion: number }> {
  let encodedKey: string | undefined;
  let encodedVersion: string | undefined;
  try {
    encodedKey = readEnvironment(ACCOUNT_DELETION_RECEIPT_HMAC_KEY_ENV);
    encodedVersion = readEnvironment(ACCOUNT_DELETION_RECEIPT_HMAC_KEY_VERSION_ENV);
  } catch {
    throw new DurableDeletionRuntimeCoreError('DELETION_RECEIPT_KEY_INVALID');
  }
  const keyVersion = Number(encodedVersion);
  if (
    typeof encodedKey !== 'string' ||
    !KEY_HEX_PATTERN.test(encodedKey) ||
    typeof encodedVersion !== 'string' ||
    !/^[1-9][0-9]{0,4}$/u.test(encodedVersion) ||
    !Number.isSafeInteger(keyVersion) ||
    keyVersion < 1 ||
    keyVersion > 32_767
  ) {
    throw new DurableDeletionRuntimeCoreError('DELETION_RECEIPT_KEY_INVALID');
  }
  const rawKey = hexToBytes(encodedKey);
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    return { key, keyVersion };
  } catch {
    throw new DurableDeletionRuntimeCoreError('DELETION_RECEIPT_KEY_INVALID');
  } finally {
    rawKey.fill(0);
  }
}

async function deletionOwnerContextHmac(
  key: CryptoKey,
  userId: string,
  contextBytes: Uint8Array,
): Promise<string> {
  if (
    !(key instanceof CryptoKey) ||
    key.type !== 'secret' ||
    key.extractable ||
    key.algorithm.name !== 'HMAC' ||
    !('hash' in key.algorithm) ||
    !isRecord(key.algorithm.hash) ||
    key.algorithm.hash.name !== 'SHA-256' ||
    !key.usages.includes('sign') ||
    !CANONICAL_UUID_PATTERN.test(userId)
  ) {
    throw new DurableDeletionRuntimeCoreError('DELETION_RECEIPT_CONTEXT_INVALID');
  }
  const userBytes = new TextEncoder().encode(userId);
  const input = new Uint8Array(contextBytes.byteLength + userBytes.byteLength);
  input.set(contextBytes);
  input.set(userBytes, contextBytes.byteLength);
  const signature = await crypto.subtle.sign('HMAC', key, input);
  const encoded = bytesToHex(new Uint8Array(signature));
  if (!TOKEN_PATTERN.test(encoded)) {
    throw new DurableDeletionRuntimeCoreError('DELETION_RECEIPT_CONTEXT_INVALID');
  }
  return encoded;
}

export function deletionSubjectHmac(key: CryptoKey, userId: string): Promise<string> {
  return deletionOwnerContextHmac(key, userId, SUBJECT_HMAC_CONTEXT_BYTES);
}

/**
 * Stable, non-enumerable intake quota identity derived only from the verified
 * Auth owner. Caller-minted idempotency tokens must never select the bucket.
 */
export function deletionIntakeOwnerHmac(key: CryptoKey, userId: string): Promise<string> {
  return deletionOwnerContextHmac(key, userId, INTAKE_OWNER_HMAC_CONTEXT_BYTES);
}

export function validDeletionResultCode(value: unknown): value is string {
  return typeof value === 'string' && RESULT_CODE_PATTERN.test(value);
}
