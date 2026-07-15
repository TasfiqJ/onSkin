import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import type { LocalDataOwnership } from './sessionBoundary';
import {
  LOCAL_DATA_CLEANUP_REQUIRED_KEY,
  LOCAL_DATA_OWNER_CLAIM_INTENT_KEY,
  LOCAL_DATA_OWNER_CLAIM_NONCE_KEY,
  LOCAL_DATA_OWNER_HASH_KEY,
} from './sessionOwnerKey';

export {
  LOCAL_DATA_CLEANUP_REQUIRED_KEY,
  LOCAL_DATA_OWNER_CLAIM_INTENT_KEY,
  LOCAL_DATA_OWNER_CLAIM_NONCE_KEY,
  LOCAL_DATA_OWNER_HASH_KEY,
} from './sessionOwnerKey';
const OWNER_HASH_DOMAIN = 'routinekind:local-data-owner:v1:';
const OWNER_CLAIM_INTENT_DOMAIN = 'routinekind:local-data-owner-claim-intent:v1:';
const CLEANUP_REQUIRED_VALUE = 'v1:required';
const CLEANUP_REQUIRED_LEGACY_VALUE = '1';
const CLEANUP_MARKER_MAX_LENGTH = 64;
const OWNER_MARKER_PREFIX = 'v1:';
const OWNER_MARKER_MAX_LENGTH = 128;
const SHA256_HEX = /^[0-9a-f]{64}$/;
let cleanupRequiredInMemory = false;

export type LocalDataOwnerMarkerErrorCode =
  | 'LOCAL_DATA_OWNER_CLAIM_INCOMPLETE'
  | 'LOCAL_DATA_OWNER_INVALID'
  | 'LOCAL_DATA_OWNER_UNSUPPORTED_VERSION'
  | 'LOCAL_DATA_OWNER_WRITE_UNCONFIRMED';

export class LocalDataOwnerMarkerError extends Error {
  readonly code: LocalDataOwnerMarkerErrorCode;

  constructor(code: LocalDataOwnerMarkerErrorCode) {
    super(code);
    this.name = 'LocalDataOwnerMarkerError';
    this.code = code;
  }
}

export type LocalDataCleanupMarkerErrorCode =
  | 'LOCAL_DATA_CLEANUP_MARKER_INVALID'
  | 'LOCAL_DATA_CLEANUP_MARKER_UNSUPPORTED_VERSION'
  | 'LOCAL_DATA_CLEANUP_MARKER_WRITE_UNCONFIRMED'
  | 'LOCAL_DATA_CLEANUP_MARKER_CLEAR_UNCONFIRMED';

export class LocalDataCleanupMarkerError extends Error {
  readonly code: LocalDataCleanupMarkerErrorCode;

  constructor(code: LocalDataCleanupMarkerErrorCode) {
    super(code);
    this.name = 'LocalDataCleanupMarkerError';
    this.code = code;
  }
}

type DecodedOwnerMarker = Readonly<{
  hash: string;
  version: 'current' | 'legacy';
}>;

function decodeCleanupMarker(raw: string): 'current' | 'legacy' {
  if (raw.length > CLEANUP_MARKER_MAX_LENGTH) {
    throw new LocalDataCleanupMarkerError('LOCAL_DATA_CLEANUP_MARKER_INVALID');
  }
  if (raw === CLEANUP_REQUIRED_VALUE) return 'current';
  if (raw === CLEANUP_REQUIRED_LEGACY_VALUE) return 'legacy';

  const version = /^v([1-9][0-9]*):/.exec(raw)?.[1];
  if (version && Number(version) > 1) {
    throw new LocalDataCleanupMarkerError(
      'LOCAL_DATA_CLEANUP_MARKER_UNSUPPORTED_VERSION',
    );
  }
  throw new LocalDataCleanupMarkerError('LOCAL_DATA_CLEANUP_MARKER_INVALID');
}

function decodeOwnerMarker(raw: string): DecodedOwnerMarker {
  if (raw.length > OWNER_MARKER_MAX_LENGTH) {
    throw new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_INVALID');
  }
  if (SHA256_HEX.test(raw)) return { hash: raw, version: 'legacy' };
  if (raw.startsWith(OWNER_MARKER_PREFIX)) {
    const hash = raw.slice(OWNER_MARKER_PREFIX.length);
    if (SHA256_HEX.test(hash)) return { hash, version: 'current' };
    throw new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_INVALID');
  }

  const version = /^v([1-9][0-9]*):/.exec(raw)?.[1];
  if (version && Number(version) > 1) {
    throw new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_UNSUPPORTED_VERSION');
  }
  throw new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_INVALID');
}

function decodeOwnerClaimNonce(raw: string): string {
  const decoded = decodeOwnerMarker(raw);
  if (decoded.version !== 'current') {
    throw new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_INVALID');
  }
  return decoded.hash;
}

function decodeOwnerClaimIntent(raw: string): string {
  return decodeOwnerClaimNonce(raw);
}

async function ownerHash(userId: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${OWNER_HASH_DOMAIN}${userId}`,
  );
  if (!SHA256_HEX.test(hash)) {
    throw new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_INVALID');
  }
  return hash;
}

async function createOwnerClaimNonce(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  if (bytes.byteLength !== 32) {
    throw new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_INVALID');
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function ownerClaimIntent(nonce: string, intendedOwnerHash: string): Promise<string> {
  const intent = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${OWNER_CLAIM_INTENT_DOMAIN}${nonce}:${intendedOwnerHash}`,
  );
  if (!SHA256_HEX.test(intent)) {
    throw new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_INVALID');
  }
  return intent;
}

async function writeControlMarkerExactly(
  key: string,
  value: string,
  unconfirmedError: () => Error,
): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (error: unknown) {
    // A native store may commit and lose only the acknowledgement. Exact
    // readback makes that outcome idempotent without treating a different
    // marker as success.
    if ((await AsyncStorage.getItem(key)) === value) return;
    throw error;
  }

  if ((await AsyncStorage.getItem(key)) !== value) throw unconfirmedError();
}

async function removeCleanupMarkerExactly(): Promise<void> {
  const existing = await AsyncStorage.getItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY);
  if (existing === null) return;
  decodeCleanupMarker(existing);

  try {
    await AsyncStorage.removeItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY);
  } catch (error: unknown) {
    if ((await AsyncStorage.getItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY)) === null) return;
    throw error;
  }

  if ((await AsyncStorage.getItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY)) !== null) {
    throw new LocalDataCleanupMarkerError('LOCAL_DATA_CLEANUP_MARKER_CLEAR_UNCONFIRMED');
  }
}

export async function readLocalDataOwnership(userId: string | null): Promise<LocalDataOwnership> {
  const cleanupMarker = await AsyncStorage.getItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY);
  // Only an exact current or explicitly supported legacy value authorizes the
  // cleanup state machine. Unknown/future control bytes block startup without
  // granting destructive authority or being rewritten.
  if (cleanupMarker !== null) {
    decodeCleanupMarker(cleanupMarker);
    cleanupRequiredInMemory = true;
    return 'mismatch';
  }
  if (cleanupRequiredInMemory) return 'mismatch';
  const storedMarker = await AsyncStorage.getItem(LOCAL_DATA_OWNER_HASH_KEY);
  const intentMarker = await AsyncStorage.getItem(LOCAL_DATA_OWNER_CLAIM_INTENT_KEY);
  const nonceMarker = await AsyncStorage.getItem(LOCAL_DATA_OWNER_CLAIM_NONCE_KEY);
  const storedHash = storedMarker === null ? null : decodeOwnerMarker(storedMarker).hash;
  const claimNonce = nonceMarker === null ? null : decodeOwnerClaimNonce(nonceMarker);
  const intent = intentMarker === null ? null : decodeOwnerClaimIntent(intentMarker);

  if (intent !== null) {
    if (claimNonce === null) {
      throw new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_CLAIM_INCOMPLETE');
    }
    // A completed same-owner receipt is redundant with the owner marker, so a
    // retained receipt cannot pin sign-out or an A-to-B cleanup.
    if (storedHash && intent === (await ownerClaimIntent(claimNonce, storedHash))) {
      if (!userId) return 'mismatch';
      return storedHash === (await ownerHash(userId)) ? 'match' : 'mismatch';
    }
    // The owner hash is never stored as a swappable intent field. The marker is
    // a one-way commitment over the random nonce and intended owner, so a
    // valid-but-wrong write cannot become another owner's claim by preserving
    // part of the requested record.
    if (userId) {
      const expectedOwnerHash = await ownerHash(userId);
      if (intent === (await ownerClaimIntent(claimNonce, expectedOwnerHash))) return 'match';
    }
    throw new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_CLAIM_INCOMPLETE');
  }
  // A nonce alone is an owner-neutral preflight interrupted before any owner
  // intent was committed. Preserve normal owner/unclaimed semantics so retry
  // can safely finish the claim without stranding sign-out or account switch.
  if (storedHash === null) return 'unclaimed';
  if (!userId) return 'mismatch';
  return storedHash === (await ownerHash(userId)) ? 'match' : 'mismatch';
}

export async function claimLocalDataOwnership(userId: string): Promise<void> {
  const hash = await ownerHash(userId);
  const marker = `${OWNER_MARKER_PREFIX}${hash}`;
  const storedOwner = await AsyncStorage.getItem(LOCAL_DATA_OWNER_HASH_KEY);
  const storedOwnerHash = storedOwner === null ? null : decodeOwnerMarker(storedOwner).hash;
  const intentClaim = await AsyncStorage.getItem(LOCAL_DATA_OWNER_CLAIM_INTENT_KEY);
  const nonceClaim = await AsyncStorage.getItem(LOCAL_DATA_OWNER_CLAIM_NONCE_KEY);
  const intent = intentClaim === null ? null : decodeOwnerClaimIntent(intentClaim);
  let claimNonce = nonceClaim === null ? null : decodeOwnerClaimNonce(nonceClaim);
  if (intent !== null && claimNonce === null) {
    throw new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_CLAIM_INCOMPLETE');
  }
  if (storedOwnerHash !== null && storedOwnerHash !== hash && intent === null) {
    throw new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_CLAIM_INCOMPLETE');
  }
  if (claimNonce === null) {
    claimNonce = await createOwnerClaimNonce();
    await writeControlMarkerExactly(
      LOCAL_DATA_OWNER_CLAIM_NONCE_KEY,
      `${OWNER_MARKER_PREFIX}${claimNonce}`,
      () => new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_WRITE_UNCONFIRMED'),
    );
  }
  const expectedIntent = await ownerClaimIntent(claimNonce, hash);
  if (
    (intent !== null && intent !== expectedIntent) ||
    (storedOwnerHash !== null && storedOwnerHash !== hash && intent !== expectedIntent)
  ) {
    throw new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_CLAIM_INCOMPLETE');
  }
  if (intent === null) {
    await writeControlMarkerExactly(
      LOCAL_DATA_OWNER_CLAIM_INTENT_KEY,
      `${OWNER_MARKER_PREFIX}${expectedIntent}`,
      () => new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_WRITE_UNCONFIRMED'),
    );
  }
  await writeControlMarkerExactly(
    LOCAL_DATA_OWNER_HASH_KEY,
    marker,
    () => new LocalDataOwnerMarkerError('LOCAL_DATA_OWNER_WRITE_UNCONFIRMED'),
  );
}

export async function markLocalDataCleanupRequired(): Promise<void> {
  const existing = await AsyncStorage.getItem(LOCAL_DATA_CLEANUP_REQUIRED_KEY);
  if (existing !== null) decodeCleanupMarker(existing);
  cleanupRequiredInMemory = true;
  await writeControlMarkerExactly(
    LOCAL_DATA_CLEANUP_REQUIRED_KEY,
    CLEANUP_REQUIRED_VALUE,
    () =>
      new LocalDataCleanupMarkerError('LOCAL_DATA_CLEANUP_MARKER_WRITE_UNCONFIRMED'),
  );
}

export async function clearLocalDataCleanupRequired(): Promise<void> {
  await removeCleanupMarkerExactly();
  cleanupRequiredInMemory = false;
}
