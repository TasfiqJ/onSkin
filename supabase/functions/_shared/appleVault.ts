export const APPLE_VAULT_KEYS_ENV = "APPLE_SIWA_VAULT_KEYS";
export const APPLE_VAULT_CURRENT_VERSION_ENV =
  "APPLE_SIWA_VAULT_CURRENT_VERSION";
export const APPLE_VAULT_ENVELOPE_VERSION = 1 as const;

const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const GCM_TAG_BYTES = 16;
const ENVELOPE_MAX_BYTES = 8_192;
const REFRESH_TOKEN_MAX_BYTES = 4_096;
const VERSION_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HMAC_PATTERN = /^[a-f0-9]{64}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const UTF8 = new TextEncoder();
const UTF8_FATAL = new TextDecoder("utf-8", { fatal: true });

export type AppleVaultKeyring = Readonly<{
  currentVersion: string;
  keys: ReadonlyMap<string, CryptoKey>;
}>;

type AppleVaultEnvelope = Readonly<{
  version: typeof APPLE_VAULT_ENVELOPE_VERSION;
  keyVersion: string;
  nonce: string;
  ciphertext: string;
}>;

export class AppleVaultError extends Error {
  constructor(
    readonly code:
      | "APPLE_VAULT_CONFIGURATION_INVALID"
      | "APPLE_VAULT_CONTEXT_INVALID"
      | "APPLE_VAULT_ENVELOPE_INVALID"
      | "APPLE_VAULT_DECRYPT_FAILED",
  ) {
    super(code);
    this.name = "AppleVaultError";
  }
}

type EnvReader = (name: string) => string | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function owned(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

function hexBytes(
  value: unknown,
  expectedBytes?: number,
): Uint8Array<ArrayBuffer> | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length % 2 !== 0 ||
    !/^[a-f0-9]+$/.test(value) ||
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

function bytesHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function binary(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 8_192) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8_192)));
  }
  return chunks.join("");
}

function base64Url(bytes: Uint8Array): string {
  return btoa(binary(bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(
    /=+$/u,
    "",
  );
}

function base64UrlBytes(value: unknown): Uint8Array<ArrayBuffer> | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length % 4 === 1 ||
    !BASE64URL_PATTERN.test(value)
  ) {
    return null;
  }
  try {
    const standard = value.replaceAll("-", "+").replaceAll("_", "/");
    const decoded = atob(
      standard + "=".repeat((4 - (standard.length % 4)) % 4),
    );
    const bytes = Uint8Array.from(
      decoded,
      (character) => character.charCodeAt(0),
    );
    return base64Url(bytes) === value ? owned(bytes) : null;
  } catch {
    return null;
  }
}

function assertContext(
  userId: string,
  subjectHmac: string,
  clientId: string,
): void {
  if (
    !UUID_PATTERN.test(userId) ||
    !HMAC_PATTERN.test(subjectHmac) ||
    clientId.length < 3 ||
    clientId.length > 255 ||
    clientId !== clientId.trim() ||
    /[\u0000-\u001f\u007f]/u.test(clientId)
  ) {
    throw new AppleVaultError("APPLE_VAULT_CONTEXT_INVALID");
  }
}

function aad(options: {
  userId: string;
  subjectHmac: string;
  clientId: string;
  keyVersion: string;
}): Uint8Array<ArrayBuffer> {
  return UTF8.encode(
    JSON.stringify({
      purpose: "routinekind-apple-refresh-token-vault",
      version: APPLE_VAULT_ENVELOPE_VERSION,
      userId: options.userId,
      subjectHmac: options.subjectHmac,
      clientId: options.clientId,
      keyVersion: options.keyVersion,
      tokenKind: "refresh_token",
    }),
  );
}

function canonicalEnvelope(envelope: AppleVaultEnvelope): string {
  return JSON.stringify({
    version: envelope.version,
    keyVersion: envelope.keyVersion,
    nonce: envelope.nonce,
    ciphertext: envelope.ciphertext,
  });
}

function parseEnvelope(value: Uint8Array): {
  envelope: AppleVaultEnvelope;
  nonce: Uint8Array<ArrayBuffer>;
  ciphertext: Uint8Array<ArrayBuffer>;
} {
  if (value.byteLength === 0 || value.byteLength > ENVELOPE_MAX_BYTES) {
    throw new AppleVaultError("APPLE_VAULT_ENVELOPE_INVALID");
  }
  let text: string;
  let parsed: unknown;
  try {
    text = UTF8_FATAL.decode(value);
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new AppleVaultError("APPLE_VAULT_ENVELOPE_INVALID");
  }
  if (
    !isRecord(parsed) ||
    !exactKeys(parsed, ["version", "keyVersion", "nonce", "ciphertext"]) ||
    parsed.version !== APPLE_VAULT_ENVELOPE_VERSION ||
    typeof parsed.keyVersion !== "string" ||
    !VERSION_PATTERN.test(parsed.keyVersion) ||
    typeof parsed.nonce !== "string" ||
    typeof parsed.ciphertext !== "string"
  ) {
    throw new AppleVaultError("APPLE_VAULT_ENVELOPE_INVALID");
  }
  const envelope: AppleVaultEnvelope = {
    version: APPLE_VAULT_ENVELOPE_VERSION,
    keyVersion: parsed.keyVersion,
    nonce: parsed.nonce,
    ciphertext: parsed.ciphertext,
  };
  if (canonicalEnvelope(envelope) !== text) {
    throw new AppleVaultError("APPLE_VAULT_ENVELOPE_INVALID");
  }
  const nonce = base64UrlBytes(envelope.nonce);
  const ciphertext = base64UrlBytes(envelope.ciphertext);
  if (
    nonce === null ||
    nonce.byteLength !== NONCE_BYTES ||
    ciphertext === null ||
    ciphertext.byteLength <= GCM_TAG_BYTES ||
    ciphertext.byteLength > REFRESH_TOKEN_MAX_BYTES + GCM_TAG_BYTES
  ) {
    throw new AppleVaultError("APPLE_VAULT_ENVELOPE_INVALID");
  }
  return { envelope, nonce, ciphertext };
}

export async function loadAppleVaultKeyring(
  readEnv: EnvReader = (name) => Deno.env.get(name),
): Promise<AppleVaultKeyring> {
  let currentVersion: string | undefined;
  let encodedKeys: string | undefined;
  try {
    currentVersion = readEnv(APPLE_VAULT_CURRENT_VERSION_ENV);
    encodedKeys = readEnv(APPLE_VAULT_KEYS_ENV);
  } catch {
    throw new AppleVaultError("APPLE_VAULT_CONFIGURATION_INVALID");
  }
  if (
    !currentVersion || !VERSION_PATTERN.test(currentVersion) || !encodedKeys
  ) {
    throw new AppleVaultError("APPLE_VAULT_CONFIGURATION_INVALID");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(encodedKeys) as unknown;
  } catch {
    throw new AppleVaultError("APPLE_VAULT_CONFIGURATION_INVALID");
  }
  if (!isRecord(parsed)) {
    throw new AppleVaultError("APPLE_VAULT_CONFIGURATION_INVALID");
  }
  const versions = Object.keys(parsed);
  if (
    versions.length < 1 ||
    versions.length > 3 ||
    !versions.includes(currentVersion) ||
    versions.some((version) => !VERSION_PATTERN.test(version))
  ) {
    throw new AppleVaultError("APPLE_VAULT_CONFIGURATION_INVALID");
  }
  const keys = new Map<string, CryptoKey>();
  for (const version of versions) {
    const raw = hexBytes(parsed[version], KEY_BYTES);
    if (raw === null) {
      throw new AppleVaultError("APPLE_VAULT_CONFIGURATION_INVALID");
    }
    try {
      const key = await crypto.subtle.importKey(
        "raw",
        raw,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
      keys.set(version, key);
    } catch {
      throw new AppleVaultError("APPLE_VAULT_CONFIGURATION_INVALID");
    } finally {
      raw.fill(0);
    }
  }
  return Object.freeze({ currentVersion, keys });
}

export async function sealAppleRefreshToken(options: {
  keyring: AppleVaultKeyring;
  userId: string;
  subjectHmac: string;
  clientId: string;
  refreshToken: string;
}): Promise<Uint8Array<ArrayBuffer>> {
  assertContext(options.userId, options.subjectHmac, options.clientId);
  const key = options.keyring.keys.get(options.keyring.currentVersion);
  const plaintext = UTF8.encode(options.refreshToken);
  if (
    key === undefined ||
    options.refreshToken.length === 0 ||
    options.refreshToken !== options.refreshToken.trim() ||
    plaintext.byteLength > REFRESH_TOKEN_MAX_BYTES
  ) {
    plaintext.fill(0);
    throw new AppleVaultError("APPLE_VAULT_CONTEXT_INVALID");
  }
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  let encrypted: ArrayBuffer;
  try {
    encrypted = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: nonce,
        additionalData: aad({
          userId: options.userId,
          subjectHmac: options.subjectHmac,
          clientId: options.clientId,
          keyVersion: options.keyring.currentVersion,
        }),
        tagLength: 128,
      },
      key,
      plaintext,
    );
  } catch {
    throw new AppleVaultError("APPLE_VAULT_ENVELOPE_INVALID");
  } finally {
    plaintext.fill(0);
  }
  const envelope = UTF8.encode(
    canonicalEnvelope({
      version: APPLE_VAULT_ENVELOPE_VERSION,
      keyVersion: options.keyring.currentVersion,
      nonce: base64Url(nonce),
      ciphertext: base64Url(new Uint8Array(encrypted)),
    }),
  );
  if (envelope.byteLength > ENVELOPE_MAX_BYTES) {
    throw new AppleVaultError("APPLE_VAULT_ENVELOPE_INVALID");
  }
  parseEnvelope(envelope);
  return envelope;
}

export async function openAppleRefreshToken(options: {
  keyring: AppleVaultKeyring;
  userId: string;
  subjectHmac: string;
  clientId: string;
  envelope: Uint8Array;
}): Promise<string> {
  assertContext(options.userId, options.subjectHmac, options.clientId);
  const parsed = parseEnvelope(options.envelope);
  const key = options.keyring.keys.get(parsed.envelope.keyVersion);
  if (key === undefined) {
    throw new AppleVaultError("APPLE_VAULT_DECRYPT_FAILED");
  }
  let decrypted: ArrayBuffer;
  try {
    decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: parsed.nonce,
        additionalData: aad({
          userId: options.userId,
          subjectHmac: options.subjectHmac,
          clientId: options.clientId,
          keyVersion: parsed.envelope.keyVersion,
        }),
        tagLength: 128,
      },
      key,
      parsed.ciphertext,
    );
  } catch {
    throw new AppleVaultError("APPLE_VAULT_DECRYPT_FAILED");
  }
  const plaintext = new Uint8Array(decrypted);
  try {
    const token = UTF8_FATAL.decode(plaintext);
    if (token.length === 0 || token !== token.trim()) {
      throw new AppleVaultError("APPLE_VAULT_DECRYPT_FAILED");
    }
    return token;
  } catch (error) {
    if (error instanceof AppleVaultError) throw error;
    throw new AppleVaultError("APPLE_VAULT_DECRYPT_FAILED");
  } finally {
    plaintext.fill(0);
  }
}

export function appleVaultEnvelopeToBytea(envelope: Uint8Array): string {
  parseEnvelope(envelope);
  return `\\x${bytesHex(envelope)}`;
}

export function appleVaultEnvelopeFromBytea(
  value: unknown,
): Uint8Array<ArrayBuffer> {
  if (
    typeof value !== "string" ||
    !value.startsWith("\\x") ||
    value.length <= 2 ||
    value.length > ENVELOPE_MAX_BYTES * 2 + 2
  ) {
    throw new AppleVaultError("APPLE_VAULT_ENVELOPE_INVALID");
  }
  const bytes = hexBytes(value.slice(2));
  if (bytes === null) throw new AppleVaultError("APPLE_VAULT_ENVELOPE_INVALID");
  parseEnvelope(bytes);
  return bytes;
}
