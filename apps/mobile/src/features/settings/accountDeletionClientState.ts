import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { setAccountActivityBlockedForDeletion } from './accountDeletionBarrier';

export { isAccountActivityBlockedForDeletion } from './accountDeletionBarrier';

export const ACCOUNT_DELETION_CLIENT_STATE_KEY = 'routinekind.account_deletion.pending.v1';
export const ACCOUNT_DELETION_TOKEN_BYTES = 32;

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const RECORD_KEYS = [
  'createdAt',
  'idempotencyKey',
  'state',
  'statusCapability',
  'version',
] as const;

export type AccountDeletionClientRecord = {
  version: 1;
  state: 'prepared' | 'accepted_or_ambiguous';
  createdAt: string;
  idempotencyKey: string;
  statusCapability: string;
};

let stateQueue: Promise<void> = Promise.resolve();

function accountDeletionStateError(
  code:
    | 'ACCOUNT_DELETION_SECURE_STORE_UNAVAILABLE'
    | 'ACCOUNT_DELETION_CLIENT_STATE_INVALID'
    | 'ACCOUNT_DELETION_RANDOMNESS_INVALID',
): Error {
  return new Error(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactRecordKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value).sort();
  return (
    keys.length === RECORD_KEYS.length && keys.every((key, index) => key === RECORD_KEYS[index])
  );
}

function validIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 20 || value.length > 30) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

export function parseAccountDeletionClientRecord(value: unknown): AccountDeletionClientRecord {
  if (
    !isRecord(value) ||
    !exactRecordKeys(value) ||
    value.version !== 1 ||
    (value.state !== 'prepared' && value.state !== 'accepted_or_ambiguous') ||
    !validIsoTimestamp(value.createdAt) ||
    typeof value.idempotencyKey !== 'string' ||
    !TOKEN_PATTERN.test(value.idempotencyKey) ||
    typeof value.statusCapability !== 'string' ||
    !TOKEN_PATTERN.test(value.statusCapability) ||
    value.idempotencyKey === value.statusCapability
  ) {
    throw accountDeletionStateError('ACCOUNT_DELETION_CLIENT_STATE_INVALID');
  }

  return {
    version: 1,
    state: value.state,
    createdAt: value.createdAt,
    idempotencyKey: value.idempotencyKey,
    statusCapability: value.statusCapability,
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
  await SecureStore.setItemAsync(ACCOUNT_DELETION_CLIENT_STATE_KEY, JSON.stringify(record), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
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
  now: Date = new Date(),
): Promise<AccountDeletionClientRecord> {
  return serializeState(async () => {
    const existing = await readStoredRecord();
    if (existing) {
      setAccountActivityBlockedForDeletion(true);
      return existing;
    }

    const idempotencyKey = await randomToken();
    const statusCapability = await randomToken();
    if (idempotencyKey === statusCapability) {
      throw accountDeletionStateError('ACCOUNT_DELETION_RANDOMNESS_INVALID');
    }
    const record: AccountDeletionClientRecord = {
      version: 1,
      state: 'prepared',
      createdAt: now.toISOString(),
      idempotencyKey,
      statusCapability,
    };

    // Block capture/writes before persisting and before the network request. If
    // persistence fails, roll back only this newly installed in-memory barrier.
    setAccountActivityBlockedForDeletion(true);
    try {
      await persistRecord(record);
    } catch (error) {
      setAccountActivityBlockedForDeletion(false);
      throw error;
    }
    return record;
  });
}

/**
 * A lost response may follow a committed intake transaction. Preserve the
 * capability and treat both an explicit 202 and a transport-ambiguous request
 * as pending until the capability-only status endpoint resolves it.
 */
export function markAccountDeletionAcceptedOrAmbiguous(): Promise<AccountDeletionClientRecord> {
  return serializeState(async () => {
    const record = await readStoredRecord();
    if (!record) throw accountDeletionStateError('ACCOUNT_DELETION_CLIENT_STATE_INVALID');
    if (record.state === 'accepted_or_ambiguous') {
      setAccountActivityBlockedForDeletion(true);
      return record;
    }
    const next = { ...record, state: 'accepted_or_ambiguous' as const };
    setAccountActivityBlockedForDeletion(true);
    await persistRecord(next);
    return next;
  });
}

/** Remove the capability only after an attested terminal result is committed to UI. */
export function clearCompletedAccountDeletionState(): Promise<void> {
  return serializeState(async () => {
    await assertSecureStoreAvailable();
    await SecureStore.deleteItemAsync(ACCOUNT_DELETION_CLIENT_STATE_KEY);
    setAccountActivityBlockedForDeletion(false);
  });
}

export function resetAccountDeletionClientStateForTests(): void {
  setAccountActivityBlockedForDeletion(false);
  stateQueue = Promise.resolve();
}
