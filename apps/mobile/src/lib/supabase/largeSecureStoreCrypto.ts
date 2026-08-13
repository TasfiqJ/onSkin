import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import {
  bytesToHex,
  bytesToUtf8,
  hexToBytes,
  randomBytes,
  utf8ToBytes,
} from '@noble/ciphers/utils.js';
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

export type LargeSecureStoreDecodeResult =
  | { kind: 'current'; plaintext: string }
  | { kind: 'legacy'; plaintext: string }
  | { kind: 'corrupt' }
  | { kind: 'unsupported_version' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function hasExactEnvelopeKeys(record: Record<string, unknown>): boolean {
  const expected = ['ciphertextHex', 'keyId', 'nonceHex', 'version'];
  const actual = Object.keys(record).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isCanonicalHex(value: unknown, expectedBytes?: number): value is string {
  if (typeof value !== 'string' || !/^[0-9a-f]+$/.test(value) || value.length % 2 !== 0) {
    return false;
  }
  return expectedBytes === undefined || value.length === expectedBytes * 2;
}

function currentEnvelopeFromRecord(record: Record<string, unknown>): SessionEnvelope | null {
  if (!hasExactEnvelopeKeys(record)) return null;
  if (record.version !== ENCRYPTION_VERSION || record.keyId !== KEY_ID) return null;
  if (!isCanonicalHex(record.nonceHex, NONCE_BYTES)) return null;
  if (!isCanonicalHex(record.ciphertextHex) || record.ciphertextHex.length < 32) return null;
  return {
    version: ENCRYPTION_VERSION,
    keyId: KEY_ID,
    nonceHex: record.nonceHex,
    ciphertextHex: record.ciphertextHex,
  };
}

function isLegacyHexCiphertext(value: string): boolean {
  return value.length > 0 && value.length % 2 === 0 && /^[0-9a-f]+$/i.test(value);
}

function decryptLegacyAesCtr(value: string, key: Uint8Array): string | null {
  if (!isLegacyHexCiphertext(value)) return null;
  try {
    const cipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(1));
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
    const plaintext = aesjs.utils.utf8.fromBytes(decryptedBytes);
    const roundTripped = aesjs.utils.utf8.toBytes(plaintext);
    if (
      roundTripped.length !== decryptedBytes.length ||
      roundTripped.some((byte, index) => byte !== decryptedBytes[index])
    ) {
      return null;
    }
    return plaintext;
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

export function decryptLargeSecureStoreValue(
  value: string,
  key: Uint8Array,
): LargeSecureStoreDecodeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    parsed = null;
  }

  if (isRecord(parsed)) {
    if (
      hasOwn(parsed, 'version') &&
      typeof parsed.version === 'string' &&
      parsed.version.startsWith('xchacha20poly1305:') &&
      parsed.version !== ENCRYPTION_VERSION
    ) {
      return { kind: 'unsupported_version' };
    }

    const envelope = currentEnvelopeFromRecord(parsed);
    if (!envelope || JSON.stringify(envelope) !== value) return { kind: 'corrupt' };
    try {
      const plaintext = xchacha20poly1305(key, hexToBytes(envelope.nonceHex)).decrypt(
        hexToBytes(envelope.ciphertextHex),
      );
      return { kind: 'current', plaintext: bytesToUtf8(plaintext) };
    } catch {
      return { kind: 'corrupt' };
    }
  }

  // AES-CTR carries no authentication tag. Strict UTF-8 round-tripping rejects
  // many wrong-key values, but it cannot prove authenticity; this path exists
  // only for compatibility until the next explicit set writes a v1 envelope.
  const legacyPlaintext = decryptLegacyAesCtr(value, key);
  return legacyPlaintext === null
    ? { kind: 'corrupt' }
    : { kind: 'legacy', plaintext: legacyPlaintext };
}

export const largeSecureStoreEncryptionInfo = {
  version: ENCRYPTION_VERSION,
  legacyVersion: 'aes-ctr:v0',
  keyId: KEY_ID,
} as const;
