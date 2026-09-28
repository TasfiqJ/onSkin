import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { localDataOwnerBinding } from '@/lib/auth/sessionOwner';

import { setAccountActivityBlockedForDeletion } from './accountDeletionBarrier';

export { isAccountActivityBlockedForDeletion } from './accountDeletionBarrier';

export const ACCOUNT_DELETION_CLIENT_STATE_KEY = 'layerwell.account_deletion.pending.v1';
export const ACCOUNT_DELETION_TOKEN_BYTES = 32;

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const LEGACY_BASE_RECORD_KEYS = [
  'createdAt',
  'idempotencyKey',
  'state',
  'statusCapability',
  'version',
] as const;
const V2_BASE_RECORD_KEYS = [...LEGACY_BASE_RECORD_KEYS, 'ownerBinding'].sort();
const LEGACY_COMPLETED_RECORD_KEYS = [...LEGACY_BASE_RECORD_KEYS, 'notice'].sort();
const V2_COMPLETED_RECORD_KEYS = [...V2_BASE_RECORD_KEYS, 'notice'].sort();

type AccountDeletionClientRecordBase = {
  createdAt: string;
  idempotencyKey: string;
  statusCapability: string;
};

export type AccountDeletionClientRecordV2 = AccountDeletionClientRecordBase &
  (
    | { version: 2; ownerBinding: string; state: 'prepared' | 'ambiguous' | 'accepted' }
    | { version: 2; ownerBinding: string; state: 'invalid_retryable' | 'invalid' | 'expired' }
    | {
        version: 2;
        ownerBinding: string;
        state: 'completed';
        notice: 'remove_apple_authorization' | null;
      }
  );

/**
 * V1 never bound its retry tokens to an owner. It remains capability-readable
 * for terminal recovery, but is normalized to support-only and can never
 * authorize another authenticated account's deletion or private-data erasure.
 */
export type LegacyAccountDeletionClientRecord = AccountDeletionClientRecordBase &
  (
    | { version: 1; ownerBinding: null; state: 'invalid' | 'expired' }
    | {
        version: 1;
        ownerBinding: null;
        state: 'completed';
        notice: 'remove_apple_authorization' | null;
      }
  );

export type AccountDeletionClientRecord =
  | AccountDeletionClientRecordV2
  | LegacyAccountDeletionClientRecord;

let stateQueue: Promise<void> = Promise.resolve();
const recoveryListeners = new Set<() => void>();

function accountDeletionStateError(
  code:
    | 'ACCOUNT_DELETION_SECURE_STORE_UNAVAILABLE'
    | 'ACCOUNT_DELETION_CLIENT_STATE_INVALID'
    | 'ACCOUNT_DELETION_OWNER_MISMATCH'
    | 'ACCOUNT_DELETION_RANDOMNESS_INVALID',
): Error {
  return new Error(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactRecordKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function validIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 20 || value.length > 30) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

export function parseAccountDeletionClientRecord(value: unknown): AccountDeletionClientRecord {
  const state = isRecord(value) ? value.state : null;
  const completed = state === 'completed';
  const version = isRecord(value) ? value.version : null;
  const expectedKeys =
    version === 2
      ? completed
        ? V2_COMPLETED_RECORD_KEYS
        : V2_BASE_RECORD_KEYS
      : completed
        ? LEGACY_COMPLETED_RECORD_KEYS
        : LEGACY_BASE_RECORD_KEYS;
  if (
    !isRecord(value) ||
    !exactRecordKeys(value, expectedKeys) ||
    (version !== 1 && version !== 2) ||
    (state !== 'prepared' &&
      state !== 'ambiguous' &&
      state !== 'accepted' &&
      state !== 'accepted_or_ambiguous' &&
      state !== 'invalid_retryable' &&
      state !== 'invalid' &&
      state !== 'expired' &&
      state !== 'completed') ||
    !validIsoTimestamp(value.createdAt) ||
    typeof value.idempotencyKey !== 'string' ||
    !TOKEN_PATTERN.test(value.idempotencyKey) ||
    typeof value.statusCapability !== 'string' ||
    !TOKEN_PATTERN.test(value.statusCapability) ||
    value.idempotencyKey === value.statusCapability
  ) {
    throw accountDeletionStateError('ACCOUNT_DELETION_CLIENT_STATE_INVALID');
  }
  if (
    version === 2 &&
    (typeof value.ownerBinding !== 'string' || !TOKEN_PATTERN.test(value.ownerBinding))
  ) {
    throw accountDeletionStateError('ACCOUNT_DELETION_CLIENT_STATE_INVALID');
  }
  if (completed && value.notice !== null && value.notice !== 'remove_apple_authorization') {
    throw accountDeletionStateError('ACCOUNT_DELETION_CLIENT_STATE_INVALID');
  }

  const base: AccountDeletionClientRecordBase = {
    createdAt: value.createdAt,
    idempotencyKey: value.idempotencyKey,
    statusCapability: value.statusCapability,
  };
  if (version === 1) {
    if (completed) {
      return {
        ...base,
        version: 1,
        ownerBinding: null,
        state: 'completed',
        notice: value.notice as 'remove_apple_authorization' | null,
      };
    }
    return { ...base, version: 1, ownerBinding: null, state: 'invalid' };
  }
  if (completed) {
    return {
      ...base,
      version: 2,
      ownerBinding: value.ownerBinding as string,
      state: 'completed',
      notice: value.notice as 'remove_apple_authorization' | null,
    };
  }
  // V2 never writes the legacy state. Rejecting it prevents a syntactically
  // upgraded legacy record from inventing owner-bound retry authority.
  if (state === 'accepted_or_ambiguous') {
    throw accountDeletionStateError('ACCOUNT_DELETION_CLIENT_STATE_INVALID');
  }
  return {
    ...base,
    version: 2,
    ownerBinding: value.ownerBinding as string,
    state: state as
      | 'prepared'
      | 'ambiguous'
      | 'accepted'
      | 'invalid_retryable'
      | 'invalid'
      | 'expired',
  };
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function randomToken(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(ACCOUNT_DELETION_TOKEN_BYTES);
  if (!(bytes instanceof Uint8Array) || bytes.length !== ACCOUNT_DELETION_TOKEN_BYTES) {
    throw accountDeletionStateError('ACCOUNT_DELETION_RANDOMNESS_INVALID');
  }
  return bytesToHex(bytes);
}

async function assertSecureStoreAvailable(): Promise<void> {
  if (
    typeof SecureStore.isAvailableAsync !== 'function' ||
    !(await SecureStore.isAvailableAsync())
  ) {
    throw accountDeletionStateError('ACCOUNT_DELETION_SECURE_STORE_UNAVAILABLE');
  }
}

function serializeState<T>(operation: () => Promise<T>): Promise<T> {
  const run = stateQueue.then(operation, operation);
  stateQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readStoredRecord(): Promise<AccountDeletionClientRecord | null> {
  await assertSecureStoreAvailable();
  const serialized = await SecureStore.getItemAsync(ACCOUNT_DELETION_CLIENT_STATE_KEY);
  if (serialized === null) return null;

  try {
    return parseAccountDeletionClientRecord(JSON.parse(serialized) as unknown);
  } catch {
    setAccountActivityBlockedForDeletion(true);
    throw accountDeletionStateError('ACCOUNT_DELETION_CLIENT_STATE_INVALID');
  }
}

async function persistRecord(record: AccountDeletionClientRecord): Promise<void> {
  const persisted =
    record.version === 1
      ? Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'ownerBinding'))
      : record;
  await SecureStore.setItemAsync(ACCOUNT_DELETION_CLIENT_STATE_KEY, JSON.stringify(persisted), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export function createAccountDeletionOwnerBinding(userId: string): Promise<string> {
  return localDataOwnerBinding(userId);
}

export function accountDeletionRecordMatchesOwner(
  record: AccountDeletionClientRecord,
  ownerBinding: string,
): record is AccountDeletionClientRecordV2 {
  return record.version === 2 && record.ownerBinding === ownerBinding;
}

/**
 * Load the durable status capability before Auth, analytics, RevenueCat, or the
 * product tree mounts. Malformed state fails closed and is preserved verbatim.
 */
export function loadPendingAccountDeletion(): Promise<AccountDeletionClientRecord | null> {
  return serializeState(async () => {
    const record = await readStoredRecord();
    setAccountActivityBlockedForDeletion(record !== null);
    return record;
  });
}

/** Persist both 256-bit tokens before the first deletion request leaves the device. */
export function preparePendingAccountDeletion(
  ownerBinding: string,
  now: Date = new Date(),
): Promise<AccountDeletionClientRecord> {
  return serializeState(async () => {
    if (!TOKEN_PATTERN.test(ownerBinding)) {
      throw accountDeletionStateError('ACCOUNT_DELETION_CLIENT_STATE_INVALID');
    }
    const existing = await readStoredRecord();
    if (existing) {
      setAccountActivityBlockedForDeletion(true);
      if (!accountDeletionRecordMatchesOwner(existing, ownerBinding)) {
        throw accountDeletionStateError('ACCOUNT_DELETION_OWNER_MISMATCH');
      }
      if (
        existing.state === 'prepared' ||
        existing.state === 'ambiguous' ||
        existing.state === 'invalid_retryable'
      ) {
        return existing;
      }
      throw accountDeletionStateError('ACCOUNT_DELETION_CLIENT_STATE_INVALID');
    }

    const idempotencyKey = await randomToken();
    const statusCapability = await randomToken();
    if (idempotencyKey === statusCapability) {
      throw accountDeletionStateError('ACCOUNT_DELETION_RANDOMNESS_INVALID');
    }
    const record: AccountDeletionClientRecord = {
      version: 2,
      ownerBinding,
      state: 'prepared',
      createdAt: now.toISOString(),
      idempotencyKey,
      statusCapability,
    };

    // Block capture/writes before persisting and before the network request. A
    // failed write may be partial or ambiguous, so only a later definitive null
    // read may reopen account activity.
    setAccountActivityBlockedForDeletion(true);
    await persistRecord(record);
    return record;
  });
}

/**
 * A lost response may follow a committed intake transaction. Preserve the
 * capability and treat both an explicit 202 and a transport-ambiguous request
 * as pending until the capability-only status endpoint resolves it.
 */
export function markAccountDeletionIntakeState(
  state: 'ambiguous' | 'accepted',
  ownerBinding: string,
): Promise<AccountDeletionClientRecord> {
  return serializeState(async () => {
    const record = await readStoredRecord();
    if (
      !record ||
      !accountDeletionRecordMatchesOwner(record, ownerBinding) ||
      record.state === 'completed' ||
      record.state === 'expired' ||
      (record.state === 'invalid' && state === 'ambiguous') ||
      (record.state === 'accepted' && state === 'ambiguous')
    ) {
      throw accountDeletionStateError('ACCOUNT_DELETION_CLIENT_STATE_INVALID');
    }
    if (record.state === state) {
      setAccountActivityBlockedForDeletion(true);
      return record;
    }
    const next = { ...record, state };
    setAccountActivityBlockedForDeletion(true);
    await persistRecord(next);
    return next;
  });
}

/**
 * Persist the terminal receipt before local cleanup or capability removal. A
 * crash after this write can resume without depending on the server receipt's
 * remaining retention window.
 */
export function commitCompletedAccountDeletion(
  notice: 'remove_apple_authorization' | null,
): Promise<AccountDeletionClientRecord> {
  return serializeState(async () => {
    const record = await readStoredRecord();
    if (!record) throw accountDeletionStateError('ACCOUNT_DELETION_CLIENT_STATE_INVALID');
    if (record.state === 'completed') {
      if (record.notice !== notice) {
        throw accountDeletionStateError('ACCOUNT_DELETION_CLIENT_STATE_INVALID');
      }
      setAccountActivityBlockedForDeletion(true);
      return record;
    }
    const completed: AccountDeletionClientRecord =
      record.version === 2
        ? {
            version: 2,
            ownerBinding: record.ownerBinding,
            state: 'completed',
            createdAt: record.createdAt,
            idempotencyKey: record.idempotencyKey,
            statusCapability: record.statusCapability,
            notice,
          }
        : {
            version: 1,
            ownerBinding: null,
            state: 'completed',
            createdAt: record.createdAt,
            idempotencyKey: record.idempotencyKey,
            statusCapability: record.statusCapability,
            notice,
          };
    setAccountActivityBlockedForDeletion(true);
    await persistRecord(completed);
    return completed;
  });
}

/** Keep the capability and tokens when the public receipt cannot prove completion. */
export function commitUnresolvedAccountDeletion(
  state: 'invalid' | 'expired',
): Promise<AccountDeletionClientRecord> {
  return serializeState(async () => {
    const record = await readStoredRecord();
    if (!record || record.state === 'completed') {
      throw accountDeletionStateError('ACCOUNT_DELETION_CLIENT_STATE_INVALID');
    }
    if (record.state === state || (state === 'invalid' && record.state === 'invalid_retryable')) {
      setAccountActivityBlockedForDeletion(true);
      return record;
    }
    if (record.state === 'expired') {
      throw accountDeletionStateError('ACCOUNT_DELETION_CLIENT_STATE_INVALID');
    }
    const nextState =
      state === 'invalid' &&
      (record.state === 'prepared' ||
        record.state === 'ambiguous' ||
        record.state === 'invalid_retryable')
        ? 'invalid_retryable'
        : state;
    const unresolved: AccountDeletionClientRecord =
      record.version === 2
        ? {
            version: 2,
            ownerBinding: record.ownerBinding,
            state: nextState,
            createdAt: record.createdAt,
            idempotencyKey: record.idempotencyKey,
            statusCapability: record.statusCapability,
          }
        : {
            version: 1,
            ownerBinding: null,
            state: state === 'expired' ? 'expired' : 'invalid',
            createdAt: record.createdAt,
            idempotencyKey: record.idempotencyKey,
            statusCapability: record.statusCapability,
          };
    setAccountActivityBlockedForDeletion(true);
    await persistRecord(unresolved);
    return unresolved;
  });
}

/**
 * Remove an intake retry only after the retained Supabase session is proven
 * unavailable. The tokens remain for status checks and operator support.
 */
export function markAccountDeletionRetryUnavailable(): Promise<AccountDeletionClientRecord> {
  return serializeState(async () => {
    const record = await readStoredRecord();
    if (
      !record ||
      (record.state !== 'prepared' &&
        record.state !== 'ambiguous' &&
        record.state !== 'invalid_retryable')
    ) {
      throw accountDeletionStateError('ACCOUNT_DELETION_CLIENT_STATE_INVALID');
    }
    const next: AccountDeletionClientRecord = { ...record, state: 'invalid' };
    setAccountActivityBlockedForDeletion(true);
    await persistRecord(next);
    return next;
  });
}

export function canRetryAccountDeletionIntake(record: AccountDeletionClientRecord): boolean {
  return (
    record.version === 2 &&
    (record.state === 'prepared' ||
      record.state === 'ambiguous' ||
      record.state === 'invalid_retryable')
  );
}

/** Remove the capability only after an attested terminal result is durable locally. */
export function clearCompletedAccountDeletionState(): Promise<void> {
  return serializeState(async () => {
    const record = await readStoredRecord();
    if (!record || record.state !== 'completed') {
      throw accountDeletionStateError('ACCOUNT_DELETION_CLIENT_STATE_INVALID');
    }
    await SecureStore.deleteItemAsync(ACCOUNT_DELETION_CLIENT_STATE_KEY);
    setAccountActivityBlockedForDeletion(false);
  });
}

/** Wake the pre-Auth recovery gate only after local sign-out has been attempted. */
export function requestAccountDeletionRecovery(): void {
  for (const listener of recoveryListeners) listener();
}

export function subscribeToAccountDeletionRecovery(listener: () => void): () => void {
  recoveryListeners.add(listener);
  return () => recoveryListeners.delete(listener);
}

/** Expo web has no native SecureStore and cannot own an iOS deletion request. */
export function resolveAccountDeletionStartupWithoutNativeStore(): void {
  setAccountActivityBlockedForDeletion(false);
}

export function resetAccountDeletionClientStateForTests(blocked = true): void {
  setAccountActivityBlockedForDeletion(blocked);
  stateQueue = Promise.resolve();
}
