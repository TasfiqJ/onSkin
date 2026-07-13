import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { ACCOUNT_DELETION_VENDOR_FREEZE_KEY } from './accountDeletionVendorFreezeKey';
import {
  accountDeletionVendorWritesBlocked,
  setAccountDeletionVendorWritesBlockedForDurableControl,
} from './accountDeletionVendorFreezeRuntime';

export { ACCOUNT_DELETION_VENDOR_FREEZE_KEY } from './accountDeletionVendorFreezeKey';
export { accountDeletionVendorWritesBlocked } from './accountDeletionVendorFreezeRuntime';

const ACCOUNT_DELETION_VENDOR_FREEZE_VERSION = 2;
const OWNER_HASH_DOMAIN = 'routinekind:account-deletion-vendor-freeze:v1:';
const SHA256_HEX = /^[0-9a-f]{64}$/;
const COMPLETION_TOKEN = /^[0-9a-f]{64}$/i;

type PersistedVendorFreeze = {
  version: 2;
  state: 'pending' | 'backend_deleted';
  owner_hash: string;
  completion_token: string;
};

// Vendor writes are denied until AuthProvider has read the durable receipt for
// the session it is about to publish. A force-quit can therefore never thaw an
// in-progress deletion merely by reinitializing this module.
let operationRevision = 0;
let storageQueue: Promise<void> = Promise.resolve();

function runInStorageOrder<T>(operation: () => Promise<T>): Promise<T> {
  const result = storageQueue.then(operation, operation);
  storageQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function fail(code: string): never {
  throw new Error(code);
}

function createCompletionToken(): string {
  let bytes: Uint8Array;
  try {
    bytes = Crypto.getRandomBytes(32);
  } catch {
    fail('ACCOUNT_DELETION_VENDOR_FREEZE_TOKEN_GENERATION_FAILED');
  }
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (bytes.length !== 32 || !COMPLETION_TOKEN.test(token)) {
    fail('ACCOUNT_DELETION_VENDOR_FREEZE_TOKEN_INVALID');
  }
  return token;
}

async function hashOwner(userId: string): Promise<string> {
  if (userId.trim().length === 0) fail('ACCOUNT_DELETION_VENDOR_FREEZE_OWNER_INVALID');
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${OWNER_HASH_DOMAIN}${userId}`,
  );
  if (!SHA256_HEX.test(digest)) fail('ACCOUNT_DELETION_VENDOR_FREEZE_HASH_INVALID');
  return digest.toLowerCase();
}

function parsePersistedVendorFreeze(raw: string): PersistedVendorFreeze {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    fail('ACCOUNT_DELETION_VENDOR_FREEZE_CORRUPT');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    fail('ACCOUNT_DELETION_VENDOR_FREEZE_CORRUPT');
  }

  const record = parsed as Record<string, unknown>;
  if (
    typeof record.version === 'number' &&
    Number.isInteger(record.version) &&
    record.version > ACCOUNT_DELETION_VENDOR_FREEZE_VERSION
  ) {
    fail('ACCOUNT_DELETION_VENDOR_FREEZE_VERSION_UNSUPPORTED');
  }

  const keys = Object.keys(record).sort();
  if (
    keys.length !== 4 ||
    keys[0] !== 'completion_token' ||
    keys[1] !== 'owner_hash' ||
    keys[2] !== 'state' ||
    keys[3] !== 'version' ||
    record.version !== ACCOUNT_DELETION_VENDOR_FREEZE_VERSION ||
    (record.state !== 'pending' && record.state !== 'backend_deleted') ||
    typeof record.owner_hash !== 'string' ||
    !SHA256_HEX.test(record.owner_hash) ||
    typeof record.completion_token !== 'string' ||
    !COMPLETION_TOKEN.test(record.completion_token)
  ) {
    fail('ACCOUNT_DELETION_VENDOR_FREEZE_CORRUPT');
  }

  return {
    version: ACCOUNT_DELETION_VENDOR_FREEZE_VERSION,
    state: record.state,
    owner_hash: record.owner_hash.toLowerCase(),
    completion_token: record.completion_token.toLowerCase(),
  };
}

async function readReceipt(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACCOUNT_DELETION_VENDOR_FREEZE_KEY);
  } catch {
    fail('ACCOUNT_DELETION_VENDOR_FREEZE_READ_FAILED');
  }
}

function currentBlockedResult(): 'frozen' | 'open' {
  return accountDeletionVendorWritesBlocked() ? 'frozen' : 'open';
}

export type AccountDeletionRecoveryCapability = Readonly<{
  state: PersistedVendorFreeze['state'];
  ownerHash: string;
  completionToken: string;
}>;

/** Read-only capability access for the narrow completion-status coordinator. */
export async function readAccountDeletionRecoveryCapability(): Promise<AccountDeletionRecoveryCapability | null> {
  return runInStorageOrder(async () => {
    const raw = await readReceipt();
    if (raw === null) return null;
    const receipt = parsePersistedVendorFreeze(raw);
    return {
      state: receipt.state,
      ownerHash: receipt.owner_hash,
      completionToken: receipt.completion_token,
    };
  });
}

/** Invalidates an older hydration as soon as an auth boundary becomes visible. */
export function blockAccountDeletionVendorWritesUntilHydrated(): void {
  setAccountDeletionVendorWritesBlockedForDurableControl(true);
  operationRevision += 1;
}

/**
 * Reads the receipt for the session AuthProvider is about to publish. Invalid,
 * future-version, unreadable, and wrong-owner bytes are deliberately preserved
 * so an uncertain deletion state cannot be converted into an ordinary launch.
 */
export async function hydrateAccountDeletionVendorFreeze(
  userId: string | null,
): Promise<'frozen' | 'open'> {
  blockAccountDeletionVendorWritesUntilHydrated();
  const revision = operationRevision;
  const expectedOwnerHash = userId ? await hashOwner(userId) : null;

  return runInStorageOrder(async () => {
    const raw = await readReceipt();
    if (raw === null) {
      if (revision === operationRevision) {
        setAccountDeletionVendorWritesBlockedForDurableControl(false);
      }
      return currentBlockedResult();
    }

    const receipt = parsePersistedVendorFreeze(raw);
    // A signed-out boundary still needs to publish its public route after local
    // cleanup. Preserve the owner-bound receipt and keep all vendor writes
    // blocked; only a later authenticated owner may match it.
    if (!expectedOwnerHash) {
      if (revision === operationRevision) {
        setAccountDeletionVendorWritesBlockedForDurableControl(true);
      }
      return currentBlockedResult();
    }
    if (receipt.owner_hash !== expectedOwnerHash) {
      fail('ACCOUNT_DELETION_VENDOR_FREEZE_OWNER_MISMATCH');
    }

    if (revision === operationRevision) {
      setAccountDeletionVendorWritesBlockedForDurableControl(true);
    }
    return currentBlockedResult();
  });
}

/** Persist the owner-bound receipt before any best-effort SDK reset or Edge call. */
export async function armAccountDeletionVendorFreeze(userId: string): Promise<string> {
  setAccountDeletionVendorWritesBlockedForDurableControl(true);
  const revision = ++operationRevision;
  const expectedOwnerHash = await hashOwner(userId);

  return runInStorageOrder(async () => {
    const existingRaw = await readReceipt();
    if (existingRaw !== null) {
      const existing = parsePersistedVendorFreeze(existingRaw);
      if (existing.owner_hash !== expectedOwnerHash) {
        fail('ACCOUNT_DELETION_VENDOR_FREEZE_OWNER_MISMATCH');
      }
      if (revision === operationRevision) {
        setAccountDeletionVendorWritesBlockedForDurableControl(true);
      }
      return existing.completion_token;
    }

    // The raw 256-bit capability never leaves this device except in the
    // authenticated deletion request. PostgreSQL stores only its domain-bound
    // SHA-256 digest, so an anonymous terminal lookup remains unguessable.
    const completionToken = createCompletionToken();
    const receipt = JSON.stringify({
      version: ACCOUNT_DELETION_VENDOR_FREEZE_VERSION,
      state: 'pending',
      owner_hash: expectedOwnerHash,
      completion_token: completionToken,
    } satisfies PersistedVendorFreeze);

    let writeRejected = false;
    try {
      await AsyncStorage.setItem(ACCOUNT_DELETION_VENDOR_FREEZE_KEY, receipt);
    } catch {
      // AsyncStorage can commit and then reject. Exact readback below decides.
      writeRejected = true;
    }
    const persisted = await readReceipt();
    if (persisted !== receipt) {
      fail(
        writeRejected
          ? 'ACCOUNT_DELETION_VENDOR_FREEZE_WRITE_FAILED'
          : 'ACCOUNT_DELETION_VENDOR_FREEZE_WRITE_UNVERIFIED',
      );
    }
    if (revision === operationRevision) {
      setAccountDeletionVendorWritesBlockedForDurableControl(true);
    }
    return completionToken;
  });
}

/**
 * Convert the pending receipt into a durable cleanup capability only after a
 * strict successful Edge response. A relaunch may then clear it, but only after
 * the full local account-boundary cleanup has succeeded again.
 */
export async function markAccountDeletionBackendDeleted(userId: string): Promise<void> {
  setAccountDeletionVendorWritesBlockedForDurableControl(true);
  const revision = ++operationRevision;
  const expectedOwnerHash = await hashOwner(userId);

  await runInStorageOrder(async () => {
    const raw = await readReceipt();
    if (raw === null) fail('ACCOUNT_DELETION_VENDOR_FREEZE_RECEIPT_MISSING');
    const receipt = parsePersistedVendorFreeze(raw);
    if (receipt.owner_hash !== expectedOwnerHash) {
      fail('ACCOUNT_DELETION_VENDOR_FREEZE_OWNER_MISMATCH');
    }

    const completed = JSON.stringify({
      version: ACCOUNT_DELETION_VENDOR_FREEZE_VERSION,
      state: 'backend_deleted',
      owner_hash: expectedOwnerHash,
      completion_token: receipt.completion_token,
    } satisfies PersistedVendorFreeze);
    if (raw !== completed) {
      try {
        await AsyncStorage.setItem(ACCOUNT_DELETION_VENDOR_FREEZE_KEY, completed);
      } catch {
        // A post-commit rejection is accepted only after exact readback.
      }
      if ((await readReceipt()) !== completed) {
        fail('ACCOUNT_DELETION_VENDOR_FREEZE_COMPLETION_UNVERIFIED');
      }
    }

    if (revision === operationRevision) {
      setAccountDeletionVendorWritesBlockedForDurableControl(true);
    }
  });
}

/** Completion-token authority is sufficient only to mark an existing receipt. */
export async function markAccountDeletionBackendDeletedFromCompletion(
  completionToken: string,
): Promise<void> {
  const normalizedToken = completionToken.trim().toLowerCase();
  if (!COMPLETION_TOKEN.test(normalizedToken)) {
    fail('ACCOUNT_DELETION_VENDOR_FREEZE_TOKEN_INVALID');
  }
  setAccountDeletionVendorWritesBlockedForDurableControl(true);
  const revision = ++operationRevision;

  await runInStorageOrder(async () => {
    const raw = await readReceipt();
    if (raw === null) fail('ACCOUNT_DELETION_VENDOR_FREEZE_RECEIPT_MISSING');
    const receipt = parsePersistedVendorFreeze(raw);
    if (receipt.completion_token !== normalizedToken) {
      fail('ACCOUNT_DELETION_VENDOR_FREEZE_COMPLETION_TOKEN_MISMATCH');
    }
    const completed = JSON.stringify({
      ...receipt,
      state: 'backend_deleted',
    } satisfies PersistedVendorFreeze);
    if (raw !== completed) {
      try {
        await AsyncStorage.setItem(ACCOUNT_DELETION_VENDOR_FREEZE_KEY, completed);
      } catch {
        // Exact readback decides post-commit native failures.
      }
      if ((await readReceipt()) !== completed) {
        fail('ACCOUNT_DELETION_VENDOR_FREEZE_COMPLETION_UNVERIFIED');
      }
    }
    if (revision === operationRevision) {
      setAccountDeletionVendorWritesBlockedForDurableControl(true);
    }
  });
}

/**
 * Called only after the account-boundary private cleanup has succeeded. Missing
 * bytes are an authoritative no-receipt result; uncertain bytes remain intact.
 */
export async function clearAccountDeletionVendorFreezeAfterCleanup(): Promise<void> {
  setAccountDeletionVendorWritesBlockedForDurableControl(true);
  const revision = ++operationRevision;

  await runInStorageOrder(async () => {
    const raw = await readReceipt();
    if (raw === null) {
      if (revision === operationRevision) {
        setAccountDeletionVendorWritesBlockedForDurableControl(false);
      }
      return;
    }

    const receipt = parsePersistedVendorFreeze(raw);
    if (receipt.state !== 'backend_deleted') {
      // Ordinary sign-out, owner repair, and A-to-B cleanup may erase local
      // stores, but they are not proof that backend account deletion completed.
      if (revision === operationRevision) {
        setAccountDeletionVendorWritesBlockedForDurableControl(true);
      }
      return;
    }

    try {
      await AsyncStorage.removeItem(ACCOUNT_DELETION_VENDOR_FREEZE_KEY);
    } catch {
      fail('ACCOUNT_DELETION_VENDOR_FREEZE_CLEAR_FAILED');
    }
    if ((await readReceipt()) !== null) {
      fail('ACCOUNT_DELETION_VENDOR_FREEZE_CLEAR_UNVERIFIED');
    }

    if (revision === operationRevision) {
      setAccountDeletionVendorWritesBlockedForDurableControl(false);
    }
  });
}
