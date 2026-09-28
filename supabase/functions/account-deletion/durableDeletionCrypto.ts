export const ACCOUNT_DELETION_PAYLOAD_KEY_ENV = 'ACCOUNT_DELETION_PAYLOAD_KEY_HEX';
export const DELETION_PAYLOAD_ENVELOPE_VERSION = 1 as const;
export const DELETION_PAYLOAD_NONCE_BYTES = 12;
export const DELETION_PAYLOAD_GCM_TAG_BYTES = 16;

const KEY_BYTES = 32;
const KEY_HEX_LENGTH = KEY_BYTES * 2;
const AAD_PURPOSE = 'onskin-account-deletion-encrypted-payload';
const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

const ENCRYPTED_STEP_NAMES = ['apple_revoke', 'revenuecat_delete', 'posthog_delete'] as const;
export type DeletionEncryptedStepName = (typeof ENCRYPTED_STEP_NAMES)[number];
type OwnedBytes = Uint8Array<ArrayBuffer>;

/** These are the exact bytea limits enforced by migration 48. */
const ENVELOPE_BYTE_LIMITS: Readonly<Record<DeletionEncryptedStepName, number>> = {
  apple_revoke: 8_192,
  revenuecat_delete: 32_768,
  posthog_delete: 32_768,
};

export type DeletionPayloadEnvelope = {
  version: typeof DELETION_PAYLOAD_ENVELOPE_VERSION;
  nonce: string;
  ciphertext: string;
};

export class DurableDeletionCryptoError extends Error {
  constructor(
    public readonly code:
      | 'DELETION_PAYLOAD_KEY_INVALID'
      | 'DELETION_PAYLOAD_CONTEXT_INVALID'
      | 'DELETION_PAYLOAD_PLAINTEXT_INVALID'
      | 'DELETION_PAYLOAD_ENVELOPE_INVALID'
      | 'DELETION_PAYLOAD_DECRYPT_FAILED'
      | 'DELETION_PAYLOAD_BYTEA_INVALID',
  ) {
    super(code);
    this.name = 'DurableDeletionCryptoError';
  }
}

type EnvironmentReader = (name: string) => string | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isStepName(value: unknown): value is DeletionEncryptedStepName {
  return (
    typeof value === 'string' && ENCRYPTED_STEP_NAMES.includes(value as DeletionEncryptedStepName)
  );
}

function assertContext(userId: unknown, stepName: unknown): asserts userId is string {
  if (typeof userId !== 'string' || !CANONICAL_UUID_PATTERN.test(userId) || !isStepName(stepName)) {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_CONTEXT_INVALID');
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function copyOwnedBytes(bytes: Uint8Array): OwnedBytes {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

function strictHexToBytes(value: unknown, expectedBytes?: number): OwnedBytes | null {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length % 2 !== 0 ||
    !/^[0-9a-f]+$/.test(value) ||
    (expectedBytes !== undefined && value.length !== expectedBytes * 2)
  ) {
    return null;
  }
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function binaryString(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const chunkSize = 8_192;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
  }
  return chunks.join('');
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return btoa(binaryString(bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function decodedBase64UrlLength(value: string): number | null {
  if (value.length === 0 || value.length % 4 === 1 || !BASE64URL_PATTERN.test(value)) {
    return null;
  }
  return Math.floor((value.length * 3) / 4);
}

function base64UrlToBytes(value: string): OwnedBytes | null {
  const expectedLength = decodedBase64UrlLength(value);
  if (expectedLength === null) return null;
  const standard = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4);
  try {
    const decoded = atob(padded);
    if (decoded.length !== expectedLength) return null;
    const bytes = new Uint8Array(decoded.length);
    for (let index = 0; index < decoded.length; index += 1) {
      bytes[index] = decoded.charCodeAt(index);
    }
    return bytesToBase64Url(bytes) === value ? bytes : null;
  } catch {
    return null;
  }
}

function base64UrlEncodedLength(byteLength: number): number {
  const completeTriples = Math.floor(byteLength / 3);
  const remainder = byteLength % 3;
  return completeTriples * 4 + (remainder === 0 ? 0 : remainder + 1);
}

function canonicalEnvelopeText(envelope: DeletionPayloadEnvelope): string {
  return JSON.stringify({
    version: envelope.version,
    nonce: envelope.nonce,
    ciphertext: envelope.ciphertext,
  });
}

const FIXED_ENVELOPE_BYTES = UTF8_ENCODER.encode(
  canonicalEnvelopeText({
    version: DELETION_PAYLOAD_ENVELOPE_VERSION,
    nonce: 'A'.repeat(base64UrlEncodedLength(DELETION_PAYLOAD_NONCE_BYTES)),
    ciphertext: '',
  }),
).byteLength;

function predictedEnvelopeBytes(plaintextBytes: number): number {
  return (
    FIXED_ENVELOPE_BYTES + base64UrlEncodedLength(plaintextBytes + DELETION_PAYLOAD_GCM_TAG_BYTES)
  );
}

export function maxDeletionPayloadPlaintextBytes(stepName: DeletionEncryptedStepName): number {
  if (!isStepName(stepName)) {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_CONTEXT_INVALID');
  }
  const envelopeLimit = ENVELOPE_BYTE_LIMITS[stepName];
  let low = 0;
  let high = envelopeLimit;
  while (low < high) {
    const candidate = Math.ceil((low + high) / 2);
    if (predictedEnvelopeBytes(candidate) <= envelopeLimit) {
      low = candidate;
    } else {
      high = candidate - 1;
    }
  }
  return low;
}

function assertPlaintext(
  value: unknown,
  stepName: DeletionEncryptedStepName,
): asserts value is Uint8Array {
  if (
    !(value instanceof Uint8Array) ||
    value.byteLength === 0 ||
    value.byteLength > maxDeletionPayloadPlaintextBytes(stepName) ||
    predictedEnvelopeBytes(value.byteLength) > ENVELOPE_BYTE_LIMITS[stepName]
  ) {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_PLAINTEXT_INVALID');
  }
}

function assertCryptoKey(key: unknown, usage: 'encrypt' | 'decrypt'): asserts key is CryptoKey {
  if (
    !(key instanceof CryptoKey) ||
    key.type !== 'secret' ||
    key.extractable ||
    key.algorithm.name !== 'AES-GCM' ||
    !('length' in key.algorithm) ||
    key.algorithm.length !== 256 ||
    !key.usages.includes(usage)
  ) {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_KEY_INVALID');
  }
}

function buildAad(
  version: typeof DELETION_PAYLOAD_ENVELOPE_VERSION,
  userId: string,
  stepName: DeletionEncryptedStepName,
): OwnedBytes {
  return UTF8_ENCODER.encode(JSON.stringify({ purpose: AAD_PURPOSE, version, userId, stepName }));
}

/**
 * Production callers omit `readEnvironment`. The sole accepted environment
 * representation is exactly 64 lowercase hexadecimal characters (32 bytes)
 * in ACCOUNT_DELETION_PAYLOAD_KEY_HEX. No base64, prefix, padding, uppercase,
 * or surrounding whitespace is accepted.
 */
export async function loadDeletionPayloadKeyFromEnv(
  readEnvironment: EnvironmentReader = (name) => Deno.env.get(name),
): Promise<CryptoKey> {
  let encoded: string | undefined;
  try {
    encoded = readEnvironment(ACCOUNT_DELETION_PAYLOAD_KEY_ENV);
  } catch {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_KEY_INVALID');
  }
  if (
    typeof encoded !== 'string' ||
    encoded.length !== KEY_HEX_LENGTH ||
    !/^[0-9a-f]{64}$/.test(encoded)
  ) {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_KEY_INVALID');
  }
  const rawKey = strictHexToBytes(encoded, KEY_BYTES);
  if (rawKey === null) {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_KEY_INVALID');
  }
  try {
    return await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
  } catch {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_KEY_INVALID');
  } finally {
    rawKey.fill(0);
  }
}

type ParsedEnvelope = {
  envelope: DeletionPayloadEnvelope;
  nonceBytes: OwnedBytes;
  ciphertextBytes: OwnedBytes;
  expectedPlaintextBytes: number;
};

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let mismatch = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    mismatch |= left[index] ^ right[index];
  }
  return mismatch === 0;
}

function parseEnvelopeBytes(
  serialized: unknown,
  stepName: DeletionEncryptedStepName,
): ParsedEnvelope {
  if (
    !(serialized instanceof Uint8Array) ||
    serialized.byteLength === 0 ||
    serialized.byteLength > ENVELOPE_BYTE_LIMITS[stepName]
  ) {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_ENVELOPE_INVALID');
  }

  let text: string;
  let parsed: unknown;
  try {
    text = UTF8_DECODER.decode(serialized);
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_ENVELOPE_INVALID');
  }
  if (
    !isRecord(parsed) ||
    !hasExactKeys(parsed, ['version', 'nonce', 'ciphertext']) ||
    parsed.version !== DELETION_PAYLOAD_ENVELOPE_VERSION ||
    typeof parsed.nonce !== 'string' ||
    parsed.nonce.length !== base64UrlEncodedLength(DELETION_PAYLOAD_NONCE_BYTES) ||
    typeof parsed.ciphertext !== 'string'
  ) {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_ENVELOPE_INVALID');
  }
  const envelope: DeletionPayloadEnvelope = {
    version: DELETION_PAYLOAD_ENVELOPE_VERSION,
    nonce: parsed.nonce,
    ciphertext: parsed.ciphertext,
  };
  const canonicalBytes = UTF8_ENCODER.encode(canonicalEnvelopeText(envelope));
  if (!equalBytes(canonicalBytes, serialized)) {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_ENVELOPE_INVALID');
  }

  const expectedCiphertextBytes = decodedBase64UrlLength(envelope.ciphertext);
  const expectedPlaintextBytes =
    expectedCiphertextBytes === null
      ? -1
      : expectedCiphertextBytes - DELETION_PAYLOAD_GCM_TAG_BYTES;
  if (
    expectedCiphertextBytes === null ||
    expectedPlaintextBytes <= 0 ||
    expectedPlaintextBytes > maxDeletionPayloadPlaintextBytes(stepName) ||
    predictedEnvelopeBytes(expectedPlaintextBytes) !== serialized.byteLength
  ) {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_ENVELOPE_INVALID');
  }

  const nonceBytes = base64UrlToBytes(envelope.nonce);
  const ciphertextBytes = base64UrlToBytes(envelope.ciphertext);
  if (
    nonceBytes === null ||
    nonceBytes.byteLength !== DELETION_PAYLOAD_NONCE_BYTES ||
    ciphertextBytes === null ||
    ciphertextBytes.byteLength !== expectedCiphertextBytes
  ) {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_ENVELOPE_INVALID');
  }
  return { envelope, nonceBytes, ciphertextBytes, expectedPlaintextBytes };
}

export function parseDeletionPayloadEnvelope(
  stepName: DeletionEncryptedStepName,
  serialized: Uint8Array,
): DeletionPayloadEnvelope {
  if (!isStepName(stepName)) {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_CONTEXT_INVALID');
  }
  return parseEnvelopeBytes(serialized, stepName).envelope;
}

export async function sealDeletionPayload(options: {
  key: CryptoKey;
  userId: string;
  stepName: DeletionEncryptedStepName;
  plaintext: Uint8Array;
}): Promise<Uint8Array> {
  if (!isRecord(options) || !hasExactKeys(options, ['key', 'userId', 'stepName', 'plaintext'])) {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_CONTEXT_INVALID');
  }
  assertContext(options.userId, options.stepName);
  assertCryptoKey(options.key, 'encrypt');
  assertPlaintext(options.plaintext, options.stepName);

  const nonce = crypto.getRandomValues(new Uint8Array(DELETION_PAYLOAD_NONCE_BYTES));
  if (!(nonce instanceof Uint8Array) || nonce.byteLength !== DELETION_PAYLOAD_NONCE_BYTES) {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_ENVELOPE_INVALID');
  }
  let encrypted: ArrayBuffer;
  const plaintextForCrypto = copyOwnedBytes(options.plaintext);
  try {
    encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: nonce,
        additionalData: buildAad(
          DELETION_PAYLOAD_ENVELOPE_VERSION,
          options.userId,
          options.stepName,
        ),
        tagLength: 128,
      },
      options.key,
      plaintextForCrypto,
    );
  } catch {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_ENVELOPE_INVALID');
  } finally {
    plaintextForCrypto.fill(0);
  }
  const ciphertext = new Uint8Array(encrypted);
  if (ciphertext.byteLength !== options.plaintext.byteLength + DELETION_PAYLOAD_GCM_TAG_BYTES) {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_ENVELOPE_INVALID');
  }
  const serialized = UTF8_ENCODER.encode(
    canonicalEnvelopeText({
      version: DELETION_PAYLOAD_ENVELOPE_VERSION,
      nonce: bytesToBase64Url(nonce),
      ciphertext: bytesToBase64Url(ciphertext),
    }),
  );
  if (
    serialized.byteLength !== predictedEnvelopeBytes(options.plaintext.byteLength) ||
    serialized.byteLength > ENVELOPE_BYTE_LIMITS[options.stepName]
  ) {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_ENVELOPE_INVALID');
  }
  return serialized;
}

export async function openDeletionPayload(options: {
  key: CryptoKey;
  userId: string;
  stepName: DeletionEncryptedStepName;
  serializedEnvelope: Uint8Array;
}): Promise<Uint8Array> {
  if (
    !isRecord(options) ||
    !hasExactKeys(options, ['key', 'userId', 'stepName', 'serializedEnvelope'])
  ) {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_CONTEXT_INVALID');
  }
  assertContext(options.userId, options.stepName);
  assertCryptoKey(options.key, 'decrypt');
  const parsed = parseEnvelopeBytes(options.serializedEnvelope, options.stepName);
  let decrypted: ArrayBuffer;
  try {
    decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: parsed.nonceBytes,
        additionalData: buildAad(parsed.envelope.version, options.userId, options.stepName),
        tagLength: 128,
      },
      options.key,
      parsed.ciphertextBytes,
    );
  } catch {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_DECRYPT_FAILED');
  }
  const plaintext = new Uint8Array(decrypted);
  if (
    plaintext.byteLength !== parsed.expectedPlaintextBytes ||
    plaintext.byteLength === 0 ||
    plaintext.byteLength > maxDeletionPayloadPlaintextBytes(options.stepName)
  ) {
    plaintext.fill(0);
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_DECRYPT_FAILED');
  }
  return plaintext;
}

/**
 * Supabase RPC bytea parameters use PostgreSQL's canonical hex text form:
 * exactly `\\x` followed by lowercase hexadecimal for the canonical UTF-8
 * envelope bytes. PostgreSQL decodes this text before enforcing octet_length.
 */
export function deletionPayloadEnvelopeToByteaRpc(
  stepName: DeletionEncryptedStepName,
  serializedEnvelope: Uint8Array,
): string {
  if (!isStepName(stepName)) {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_CONTEXT_INVALID');
  }
  parseEnvelopeBytes(serializedEnvelope, stepName);
  return `\\x${bytesToHex(serializedEnvelope)}`;
}

export function deletionPayloadEnvelopeFromByteaRpc(
  stepName: DeletionEncryptedStepName,
  byteaValue: unknown,
): Uint8Array {
  if (!isStepName(stepName)) {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_CONTEXT_INVALID');
  }
  const maximumHexLength = ENVELOPE_BYTE_LIMITS[stepName] * 2;
  if (
    typeof byteaValue !== 'string' ||
    !byteaValue.startsWith('\\x') ||
    byteaValue.length <= 2 ||
    byteaValue.length > maximumHexLength + 2
  ) {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_BYTEA_INVALID');
  }
  const bytes = strictHexToBytes(byteaValue.slice(2));
  if (bytes === null || bytes.byteLength > ENVELOPE_BYTE_LIMITS[stepName]) {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_BYTEA_INVALID');
  }
  try {
    parseEnvelopeBytes(bytes, stepName);
  } catch {
    throw new DurableDeletionCryptoError('DELETION_PAYLOAD_BYTEA_INVALID');
  }
  return bytes;
}
