const VERSION_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const HEX_32_BYTES = /^[a-f0-9]{64}$/;

export const APPLE_SUBJECT_HMAC_KEYS_ENV = 'APPLE_SIWA_SUBJECT_HMAC_KEYS';
export const APPLE_SUBJECT_HMAC_CURRENT_VERSION_ENV = 'APPLE_SIWA_SUBJECT_HMAC_CURRENT_VERSION';
export const APPLE_CODE_HMAC_KEY_ENV = 'APPLE_SIWA_CODE_HMAC_KEY_HEX';
export const APPLE_EVENT_HMAC_KEY_ENV = 'APPLE_SIWA_EVENT_HMAC_KEY_HEX';

export class AppleLifecycleSecretError extends Error {
  constructor() {
    super('APPLE_LIFECYCLE_SECRET_INVALID');
    this.name = 'AppleLifecycleSecretError';
  }
}

type EnvReader = (name: string) => string | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function bytes(value: string): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(value.length / 2);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return output;
}

async function hmacKey(encoded: unknown): Promise<CryptoKey> {
  if (typeof encoded !== 'string' || !HEX_32_BYTES.test(encoded)) {
    throw new AppleLifecycleSecretError();
  }
  const raw = bytes(encoded);
  try {
    return await crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'HMAC', hash: 'SHA-256', length: 256 },
      false,
      ['sign'],
    );
  } catch {
    throw new AppleLifecycleSecretError();
  } finally {
    raw.fill(0);
  }
}

export type AppleLifecycleSecrets = Readonly<{
  subjectKeyVersion: string;
  subjectKey: CryptoKey;
  subjectKeys: ReadonlyMap<string, CryptoKey>;
  codeKey: CryptoKey;
  eventKey: CryptoKey;
}>;

export async function loadAppleLifecycleSecrets(
  readEnv: EnvReader = (name) => Deno.env.get(name),
): Promise<AppleLifecycleSecrets> {
  let version: string | undefined;
  let subjectKeysJson: string | undefined;
  let codeKeyHex: string | undefined;
  let eventKeyHex: string | undefined;
  try {
    version = readEnv(APPLE_SUBJECT_HMAC_CURRENT_VERSION_ENV);
    subjectKeysJson = readEnv(APPLE_SUBJECT_HMAC_KEYS_ENV);
    codeKeyHex = readEnv(APPLE_CODE_HMAC_KEY_ENV);
    eventKeyHex = readEnv(APPLE_EVENT_HMAC_KEY_ENV);
  } catch {
    throw new AppleLifecycleSecretError();
  }
  if (!version || !VERSION_PATTERN.test(version) || !subjectKeysJson) {
    throw new AppleLifecycleSecretError();
  }
  let subjectKeys: unknown;
  try {
    subjectKeys = JSON.parse(subjectKeysJson) as unknown;
  } catch {
    throw new AppleLifecycleSecretError();
  }
  if (
    !isRecord(subjectKeys) ||
    Object.keys(subjectKeys).length < 1 ||
    Object.keys(subjectKeys).length > 3 ||
    !Object.keys(subjectKeys).every((candidate) => VERSION_PATTERN.test(candidate))
  ) {
    throw new AppleLifecycleSecretError();
  }
  if (!Object.hasOwn(subjectKeys, version)) {
    throw new AppleLifecycleSecretError();
  }
  const importedSubjectKeys = new Map<string, CryptoKey>();
  for (const [candidateVersion, encodedKey] of Object.entries(subjectKeys)) {
    importedSubjectKeys.set(candidateVersion, await hmacKey(encodedKey));
  }
  const currentSubjectKey = importedSubjectKeys.get(version);
  if (!currentSubjectKey) throw new AppleLifecycleSecretError();
  return Object.freeze({
    subjectKeyVersion: version,
    subjectKey: currentSubjectKey,
    subjectKeys: importedSubjectKeys,
    codeKey: await hmacKey(codeKeyHex),
    eventKey: await hmacKey(eventKeyHex),
  });
}

function hex(value: ArrayBuffer): string {
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function keyedDigest(key: CryptoKey, purpose: string, value: string): Promise<string> {
  if (
    !(key instanceof CryptoKey) ||
    key.type !== 'secret' ||
    !key.usages.includes('sign') ||
    purpose.length === 0 ||
    purpose.length > 128 ||
    !/^[a-z0-9:-]+$/u.test(purpose) ||
    value.length === 0 ||
    value.length > 16_384 ||
    value !== value.trim()
  ) {
    throw new AppleLifecycleSecretError();
  }
  try {
    return hex(
      await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${purpose}\u0000${value}`)),
    );
  } catch {
    throw new AppleLifecycleSecretError();
  }
}

export const appleSubjectDigest = (secrets: AppleLifecycleSecrets, subject: string) =>
  keyedDigest(secrets.subjectKey, 'onskin:apple-subject:v1', subject);
export function appleSubjectDigestForVersion(
  secrets: AppleLifecycleSecrets,
  version: string,
  subject: string,
): Promise<string> {
  const key = secrets.subjectKeys.get(version);
  if (!key) throw new AppleLifecycleSecretError();
  return keyedDigest(key, 'onskin:apple-subject:v1', subject);
}
export const appleCodeDigest = (secrets: AppleLifecycleSecrets, code: string) =>
  keyedDigest(secrets.codeKey, 'onskin:apple-code:v1', code);
export const appleEventJtiDigest = (secrets: AppleLifecycleSecrets, jti: string) =>
  keyedDigest(secrets.eventKey, 'onskin:apple-event-jti:v1', jti);
export const appleEventPayloadDigest = (secrets: AppleLifecycleSecrets, payload: string) =>
  keyedDigest(secrets.eventKey, 'onskin:apple-event-payload:v1', payload);
export const appleRelayEmailDigest = (secrets: AppleLifecycleSecrets, email: string) =>
  keyedDigest(secrets.eventKey, 'onskin:apple-relay-email:v1', email.toLowerCase());
