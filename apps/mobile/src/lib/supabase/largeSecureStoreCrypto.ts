import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToHex, bytesToUtf8, hexToBytes, randomBytes, utf8ToBytes } from '@noble/ciphers/utils.js';
import * as aesjs from 'aes-js';

const ENCRYPTION_VERSION = 'xchacha20poly1305:v1';
const KEY_ID = 'supabase-session-key-v1';
const NONCE_BYTES = 24;

type SessionEnvelope = {
  version: typeof ENCRYPTION_VERSION;
  keyId: typeof KEY_ID;
  nonceHex: string;
  ciphertextHex: string;
};

export type LargeSecureStoreDecryptResult = {
  plaintext: string | null;
  needsMigration: boolean;
};

function parseEnvelope(value: string): SessionEnvelope | null {
  try {
    const parsed = JSON.parse(value) as Partial<SessionEnvelope>;
    if (
      parsed.version === ENCRYPTION_VERSION &&
      parsed.keyId === KEY_ID &&
      typeof parsed.nonceHex === 'string' &&
      typeof parsed.ciphertextHex === 'string'
    ) {
      return parsed as SessionEnvelope;
    }
  } catch {
    return null;
  }
  return null;
}

function isLegacyHexCiphertext(value: string): boolean {
  return value.length > 0 && value.length % 2 === 0 && /^[0-9a-f]+$/i.test(value);
}

function decryptLegacyAesCtr(value: string, key: Uint8Array): string | null {
  if (!isLegacyHexCiphertext(value)) return null;
  try {
    const cipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(1));
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  } catch {
    return null;
  }
}

export function encryptLargeSecureStoreValue(value: string, key: Uint8Array): string {
  const nonce = randomBytes(NONCE_BYTES);
  const ciphertext = xchacha20poly1305(key, nonce).encrypt(utf8ToBytes(value));
  const envelope: SessionEnvelope = {
    version: ENCRYPTION_VERSION,
    keyId: KEY_ID,
    nonceHex: bytesToHex(nonce),
    ciphertextHex: bytesToHex(ciphertext),
  };
  return JSON.stringify(envelope);
}

export function decryptLargeSecureStoreValue(value: string, key: Uint8Array): LargeSecureStoreDecryptResult {
  const envelope = parseEnvelope(value);
  if (envelope) {
    try {
      const plaintext = xchacha20poly1305(key, hexToBytes(envelope.nonceHex)).decrypt(
        hexToBytes(envelope.ciphertextHex),
      );
      return { plaintext: bytesToUtf8(plaintext), needsMigration: false };
    } catch {
      return { plaintext: null, needsMigration: false };
    }
  }

  const legacyPlaintext = decryptLegacyAesCtr(value, key);
  return {
    plaintext: legacyPlaintext,
    needsMigration: legacyPlaintext !== null,
  };
}

export const largeSecureStoreEncryptionInfo = {
  version: ENCRYPTION_VERSION,
  legacyVersion: 'aes-ctr:v0',
  keyId: KEY_ID,
} as const;
