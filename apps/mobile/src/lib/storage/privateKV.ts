import 'react-native-get-random-values';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import {
  bytesToHex,
  bytesToUtf8,
  hexToBytes,
  randomBytes,
  utf8ToBytes,
} from '@noble/ciphers/utils.js';

import {
  PRIVATE_KV_CONTENT_KEY_NAME,
  clearStoredPrivateKVContentKey,
  getStoredPrivateKVContentKey,
  setStoredPrivateKVContentKey,
} from './privateKVContentKey';

const ENCRYPTION_VERSION = 'xchacha20poly1305:v1';
const NONCE_BYTES = 24;
export const PRIVATE_KV_CONTENT_KEY_MISSING = 'PRIVATE_KV_CONTENT_KEY_MISSING';
export const PRIVATE_KV_CONTENT_KEY_INVALID = 'PRIVATE_KV_CONTENT_KEY_INVALID';
export const PRIVATE_KV_DECRYPTION_FAILED = 'PRIVATE_KV_DECRYPTION_FAILED';
export const PRIVATE_KV_WRITE_BLOCKED_AFTER_READ_FAILURE =
  'PRIVATE_KV_WRITE_BLOCKED_AFTER_READ_FAILURE';

type PrivateEnvelope = {
  version: typeof ENCRYPTION_VERSION;
  nonceHex: string;
  ciphertextHex: string;
};

let contentKeyCreation: Promise<Uint8Array> | null = null;
const failedReadSnapshots = new Map<string, string>();

async function getExistingContentKey(): Promise<Uint8Array | null> {
  const stored = await getStoredPrivateKVContentKey();
  if (!stored) return null;
  if (!/^[0-9a-f]{64}$/i.test(stored)) {
    throw new Error(PRIVATE_KV_CONTENT_KEY_INVALID);
  }
  try {
    const key = hexToBytes(stored);
    if (key.byteLength !== 32) throw new Error(PRIVATE_KV_CONTENT_KEY_INVALID);
    return key;
  } catch {
    throw new Error(PRIVATE_KV_CONTENT_KEY_INVALID);
  }
}

async function hasOrphanedPrivateCiphertext(): Promise<boolean> {
  const candidateKeys = (await AsyncStorage.getAllKeys()).filter(
    (key) => key !== PRIVATE_KV_CONTENT_KEY_NAME,
  );
  if (candidateKeys.length === 0) return false;
  const entries = await AsyncStorage.multiGet(candidateKeys);
  return entries.some(([, raw]) => raw !== null && parseEnvelope(raw) !== null);
}

async function getOrCreateContentKey(): Promise<Uint8Array> {
  const existing = await getExistingContentKey();
  if (existing) return existing;

  if (!contentKeyCreation) {
    contentKeyCreation = (async () => {
      const rechecked = await getExistingContentKey();
      if (rechecked) return rechecked;
      if (await hasOrphanedPrivateCiphertext()) {
        throw new Error(PRIVATE_KV_CONTENT_KEY_MISSING);
      }

      const key = randomBytes(32);
      await setStoredPrivateKVContentKey(bytesToHex(key));
      return key;
    })();
  }

  const pending = contentKeyCreation;
  try {
    return await pending;
  } finally {
    if (contentKeyCreation === pending) contentKeyCreation = null;
  }
}

function parseEnvelope(raw: string): PrivateEnvelope | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PrivateEnvelope> & { keyId?: unknown };
    if (
      parsed.version === ENCRYPTION_VERSION &&
      parsed.keyId === undefined &&
      typeof parsed.nonceHex === 'string' &&
      typeof parsed.ciphertextHex === 'string'
    ) {
      return parsed as PrivateEnvelope;
    }
  } catch {
    /* Legacy plaintext JSON/string. */
  }
  return null;
}

function decryptEnvelope(envelope: PrivateEnvelope, contentKey: Uint8Array): string {
  const plaintext = xchacha20poly1305(contentKey, hexToBytes(envelope.nonceHex)).decrypt(
    hexToBytes(envelope.ciphertextHex),
  );
  return bytesToUtf8(plaintext);
}

function rememberFailedRead(key: string, raw: string): void {
  failedReadSnapshots.set(key, raw);
}

async function assertNoFailedReadRewrite(key: string): Promise<string | null> {
  const failedSnapshot = failedReadSnapshots.get(key);
  const current = await AsyncStorage.getItem(key);
  if (failedSnapshot !== undefined && current === failedSnapshot) {
    throw new Error(PRIVATE_KV_WRITE_BLOCKED_AFTER_READ_FAILURE);
  }
  if (failedSnapshot !== undefined) failedReadSnapshots.delete(key);
  return current;
}

export async function getPrivateItem(key: string): Promise<string | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) {
    failedReadSnapshots.delete(key);
    return null;
  }

  const envelope = parseEnvelope(raw);
  if (!envelope) {
    failedReadSnapshots.delete(key);
    return raw;
  }

  let contentKey: Uint8Array | null;
  try {
    contentKey = await getExistingContentKey();
  } catch (error) {
    rememberFailedRead(key, raw);
    throw error;
  }
  if (!contentKey) {
    rememberFailedRead(key, raw);
    throw new Error(PRIVATE_KV_CONTENT_KEY_MISSING);
  }
  try {
    const value = decryptEnvelope(envelope, contentKey);
    failedReadSnapshots.delete(key);
    return value;
  } catch {
    rememberFailedRead(key, raw);
    throw new Error(PRIVATE_KV_DECRYPTION_FAILED);
  }
}

export async function getPrivateItems(
  keys: readonly string[],
): Promise<Map<string, string | null>> {
  const entries = await AsyncStorage.multiGet([...keys]);
  const result = new Map<string, string | null>();
  const encryptedEntries: [string, PrivateEnvelope, string][] = [];

  for (const [key, raw] of entries) {
    if (!raw) {
      failedReadSnapshots.delete(key);
      result.set(key, null);
      continue;
    }
    const envelope = parseEnvelope(raw);
    if (envelope) encryptedEntries.push([key, envelope, raw]);
    else {
      failedReadSnapshots.delete(key);
      result.set(key, raw);
    }
  }

  if (encryptedEntries.length === 0) return result;
  let contentKey: Uint8Array | null;
  try {
    contentKey = await getExistingContentKey();
  } catch (error) {
    for (const [key, , raw] of encryptedEntries) rememberFailedRead(key, raw);
    throw error;
  }
  if (!contentKey) {
    for (const [key, , raw] of encryptedEntries) rememberFailedRead(key, raw);
    throw new Error(PRIVATE_KV_CONTENT_KEY_MISSING);
  }
  for (const [key, envelope, raw] of encryptedEntries) {
    try {
      result.set(key, decryptEnvelope(envelope, contentKey));
      failedReadSnapshots.delete(key);
    } catch {
      rememberFailedRead(key, raw);
      throw new Error(PRIVATE_KV_DECRYPTION_FAILED);
    }
  }
  return result;
}

/** Verify every private-KV envelope without creating key material or retaining plaintext. */
export async function assertPrivateKVReadable(): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter(
    (key) => key !== PRIVATE_KV_CONTENT_KEY_NAME,
  );
  if (keys.length === 0) return;
  await getPrivateItems(keys);
}

export async function setPrivateItem(key: string, value: string): Promise<void> {
  const existingRaw = await assertNoFailedReadRewrite(key);
  const contentKey = await getOrCreateContentKey();
  const existingEnvelope = existingRaw ? parseEnvelope(existingRaw) : null;
  if (existingEnvelope && existingRaw) {
    try {
      decryptEnvelope(existingEnvelope, contentKey);
    } catch {
      rememberFailedRead(key, existingRaw);
      throw new Error(PRIVATE_KV_DECRYPTION_FAILED);
    }
  }
  const nonce = randomBytes(NONCE_BYTES);
  const ciphertext = xchacha20poly1305(contentKey, nonce).encrypt(utf8ToBytes(value));
  const envelope: PrivateEnvelope = {
    version: ENCRYPTION_VERSION,
    nonceHex: bytesToHex(nonce),
    ciphertextHex: bytesToHex(ciphertext),
  };
  await AsyncStorage.setItem(key, JSON.stringify(envelope));
}

export async function removePrivateItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
  failedReadSnapshots.delete(key);
}

export async function multiRemovePrivateItems(keys: readonly string[]): Promise<void> {
  await AsyncStorage.multiRemove([...keys]);
  for (const key of keys) failedReadSnapshots.delete(key);
}

export async function clearPrivateKVContentKey(): Promise<void> {
  await clearStoredPrivateKVContentKey();
  failedReadSnapshots.clear();
}

export const privateKVEncryptionInfo = {
  version: ENCRYPTION_VERSION,
  secureStoreKey: PRIVATE_KV_CONTENT_KEY_NAME,
} as const;
