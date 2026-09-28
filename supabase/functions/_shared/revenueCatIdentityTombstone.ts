const KEY_HEX_PATTERN = /^[a-f0-9]{64}$/;
const KEY_VERSION_PATTERN = /^[1-9][0-9]{0,4}$/;
const PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;
const DOMAIN = new TextEncoder().encode('onskin/revenuecat-identity-tombstone/v1');
const UTF8 = new TextEncoder();

export const REVENUECAT_IDENTITY_TOMBSTONE_MAX_KEYS = 4;
export const REVENUECAT_IDENTITY_TOMBSTONE_MAX_IDENTITY_BYTES = 1_500;
export const REVENUECAT_IDENTITY_TOMBSTONE_MAX_FAMILY_IDENTITIES = 66;
export const REVENUECAT_IDENTITY_TOMBSTONE_MAX_FAMILY_BYTES = 4_096;
export const REVENUECAT_IDENTITY_TOMBSTONE_MAX_LOOKUP_PAIRS = 2_048;

export type RevenueCatIdentityTombstoneKey = {
  version: number;
  keyBytes: Uint8Array<ArrayBuffer>;
};

export type RevenueCatIdentityTombstoneKeyring = {
  currentVersion: number;
  keys: readonly RevenueCatIdentityTombstoneKey[];
};

export type RevenueCatIdentityTombstoneCandidate = {
  /** Exact structured identity value that the SQL guard may strip. */
  identityValue: string;
  /** Exact identity value included in the HMAC preimage. */
  hashIdentity: string;
};

export type RevenueCatIdentityTombstoneLookup = {
  keyVersions: number[];
  identityHmacs: string[];
  identityValues: string[];
};

export type RevenueCatIdentityTombstoneFamily = {
  keyVersion: number;
  identityHmacs: string[];
  rawIdentities: string[];
};

export class RevenueCatIdentityTombstoneError extends Error {
  constructor(
    public readonly code:
      | 'REVENUECAT_IDENTITY_TOMBSTONE_CONFIG_INVALID'
      | 'REVENUECAT_IDENTITY_TOMBSTONE_INPUT_INVALID',
  ) {
    super(code);
    this.name = 'RevenueCatIdentityTombstoneError';
  }
}

function inputInvalid(): never {
  throw new RevenueCatIdentityTombstoneError('REVENUECAT_IDENTITY_TOMBSTONE_INPUT_INVALID');
}

function configInvalid(): never {
  throw new RevenueCatIdentityTombstoneError('REVENUECAT_IDENTITY_TOMBSTONE_CONFIG_INVALID');
}

function decodeHex(value: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

function hasOnlyUnicodeScalars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function canonicalProjectId(value: unknown): string {
  if (typeof value !== 'string' || !PROJECT_ID_PATTERN.test(value)) {
    inputInvalid();
  }
  return value;
}

export function canonicalRevenueCatIdentity(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value !== value.trim() ||
    value !== value.normalize('NFC') ||
    value.includes('\u0000') ||
    !hasOnlyUnicodeScalars(value)
  ) {
    inputInvalid();
  }
  const bytes = UTF8.encode(value);
  if (
    bytes.byteLength === 0 ||
    bytes.byteLength > REVENUECAT_IDENTITY_TOMBSTONE_MAX_IDENTITY_BYTES
  ) {
    inputInvalid();
  }
  return value;
}

function parseVersion(value: string): number {
  if (!KEY_VERSION_PATTERN.test(value)) configInvalid();
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1 || version > 32_767) {
    configInvalid();
  }
  return version;
}

/**
 * Parses the canonical secret format `1=<64 lowercase hex>;2=<64 lowercase
 * hex>`. Versions must be strictly increasing and key bytes must be unique.
 * Keeping old entries configured until their tombstones expire makes rotation
 * explicit instead of silently reviving a deleted RevenueCat identity.
 */
export function parseRevenueCatIdentityTombstoneKeyring(
  encodedKeys: unknown,
  encodedCurrentVersion: unknown,
): RevenueCatIdentityTombstoneKeyring {
  if (
    typeof encodedKeys !== 'string' ||
    encodedKeys.length === 0 ||
    typeof encodedCurrentVersion !== 'string'
  ) {
    configInvalid();
  }
  const entries = encodedKeys.split(';');
  if (entries.length < 1 || entries.length > REVENUECAT_IDENTITY_TOMBSTONE_MAX_KEYS) {
    configInvalid();
  }
  const keys: RevenueCatIdentityTombstoneKey[] = [];
  const seenMaterial = new Set<string>();
  let priorVersion = 0;
  for (const entry of entries) {
    const separator = entry.indexOf('=');
    if (separator <= 0 || separator !== entry.lastIndexOf('=')) configInvalid();
    const version = parseVersion(entry.slice(0, separator));
    const keyHex = entry.slice(separator + 1);
    if (version <= priorVersion || !KEY_HEX_PATTERN.test(keyHex) || seenMaterial.has(keyHex)) {
      configInvalid();
    }
    priorVersion = version;
    seenMaterial.add(keyHex);
    keys.push({ version, keyBytes: decodeHex(keyHex) });
  }
  const currentVersion = parseVersion(encodedCurrentVersion);
  if (!keys.some((key) => key.version === currentVersion)) configInvalid();
  return { currentVersion, keys };
}

function uint32(value: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const length = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function hmacPreimage(projectId: string, identity: string): Uint8Array<ArrayBuffer> {
  const projectBytes = UTF8.encode(projectId);
  const identityBytes = UTF8.encode(identity);
  return concatBytes([
    DOMAIN,
    uint32(projectBytes.byteLength),
    projectBytes,
    uint32(identityBytes.byteLength),
    identityBytes,
  ]);
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function identityHmac(
  projectId: string,
  identity: string,
  key: RevenueCatIdentityTombstoneKey,
): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key.keyBytes.buffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(
    await crypto.subtle.sign('HMAC', cryptoKey, hmacPreimage(projectId, identity).buffer),
  );
}

function uniqueCanonicalFamily(values: readonly string[]): string[] {
  if (values.length < 1 || values.length > REVENUECAT_IDENTITY_TOMBSTONE_MAX_FAMILY_IDENTITIES) {
    inputInvalid();
  }
  const family = [...new Set(values.map(canonicalRevenueCatIdentity))].sort();
  const bytes = family.reduce((total, identity) => total + UTF8.encode(identity).byteLength, 0);
  if (
    family.length < 1 ||
    family.length > REVENUECAT_IDENTITY_TOMBSTONE_MAX_FAMILY_IDENTITIES ||
    bytes > REVENUECAT_IDENTITY_TOMBSTONE_MAX_FAMILY_BYTES
  ) {
    inputInvalid();
  }
  return family;
}

/** Produces the current-version HMACs used by the deletion-side barrier RPC. */
export async function buildRevenueCatIdentityTombstoneFamily(
  projectIdValue: unknown,
  identities: readonly string[],
  keyring: RevenueCatIdentityTombstoneKeyring,
): Promise<RevenueCatIdentityTombstoneFamily> {
  const projectId = canonicalProjectId(projectIdValue);
  const family = uniqueCanonicalFamily(identities);
  const key = keyring.keys.find((candidate) => candidate.version === keyring.currentVersion);
  if (!key) configInvalid();
  const identityHmacs = await Promise.all(
    family.map((identity) => identityHmac(projectId, identity, key)),
  );
  return {
    keyVersion: key.version,
    identityHmacs,
    rawIdentities: family,
  };
}

/**
 * Produces aligned lookup arrays for every configured key version. A source
 * identity may map to both its own HMAC and an embedded UUID HMAC; SQL uses the
 * source value only to strip that exact structured field and never as an owner.
 */
export async function buildRevenueCatIdentityTombstoneLookup(
  projectIdValue: unknown,
  candidates: readonly RevenueCatIdentityTombstoneCandidate[],
  keyring: RevenueCatIdentityTombstoneKeyring,
): Promise<RevenueCatIdentityTombstoneLookup> {
  const projectId = canonicalProjectId(projectIdValue);
  if (candidates.length > REVENUECAT_IDENTITY_TOMBSTONE_MAX_LOOKUP_PAIRS) {
    inputInvalid();
  }
  const canonicalCandidates = candidates.map((candidate) => ({
    identityValue: canonicalRevenueCatIdentity(candidate.identityValue),
    hashIdentity: canonicalRevenueCatIdentity(candidate.hashIdentity),
  }));
  const unique = [
    ...new Map(
      canonicalCandidates.map((candidate) => [
        `${candidate.identityValue.length}:${candidate.identityValue}${candidate.hashIdentity.length}:${candidate.hashIdentity}`,
        candidate,
      ]),
    ).values(),
  ];
  if (unique.length * keyring.keys.length > REVENUECAT_IDENTITY_TOMBSTONE_MAX_LOOKUP_PAIRS) {
    inputInvalid();
  }

  const keyVersions: number[] = [];
  const identityHmacs: string[] = [];
  const identityValues: string[] = [];
  for (const key of keyring.keys) {
    for (const candidate of unique) {
      keyVersions.push(key.version);
      identityHmacs.push(await identityHmac(projectId, candidate.hashIdentity, key));
      identityValues.push(candidate.identityValue);
    }
  }
  return { keyVersions, identityHmacs, identityValues };
}
