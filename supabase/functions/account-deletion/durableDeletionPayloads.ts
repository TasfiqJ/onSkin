import { maxDeletionPayloadPlaintextBytes } from './durableDeletionCrypto.ts';

export const DURABLE_DELETION_PAYLOAD_VERSION = 1 as const;
export const APPLE_AUTHORIZATION_CODE_MAX_CHARS = 4_096;
export const APPLE_REVOCATION_TOKEN_MAX_CHARS = 4_096;
export const APPLE_SUBJECT_MAX_CHARS = 512;

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const TOKEN_TYPES = ['refresh_token', 'access_token'] as const;

export type DurableAppleDeletionPayload =
  | {
      version: typeof DURABLE_DELETION_PAYLOAD_VERSION;
      appleLinked: false;
      phase: 'not_linked';
    }
  | {
      version: typeof DURABLE_DELETION_PAYLOAD_VERSION;
      appleLinked: true;
      phase: 'manual';
    }
  | {
      version: typeof DURABLE_DELETION_PAYLOAD_VERSION;
      appleLinked: true;
      phase: 'authorization_code';
      authorizationCode: string;
      expectedAppleSubject: string;
    }
  | {
      version: typeof DURABLE_DELETION_PAYLOAD_VERSION;
      appleLinked: true;
      phase: 'revocation_token';
      revocationToken: string;
      tokenTypeHint: (typeof TOKEN_TYPES)[number];
    };

export class DurableDeletionPayloadError extends Error {
  constructor(
    public readonly code:
      | 'APPLE_DELETION_PAYLOAD_INVALID'
      | 'APPLE_DELETION_PAYLOAD_TRANSITION_INVALID',
  ) {
    super(code);
    this.name = 'DurableDeletionPayloadError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validBoundedSecret(value: unknown, maximum: number): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maximum ||
    value !== value.trim()
  ) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 31 || codeUnit === 127) return false;
  }
  return true;
}

function isTokenType(value: unknown): value is (typeof TOKEN_TYPES)[number] {
  return typeof value === 'string' && TOKEN_TYPES.includes(value as (typeof TOKEN_TYPES)[number]);
}

function assertApplePayload(value: unknown): asserts value is DurableAppleDeletionPayload {
  if (
    !isRecord(value) ||
    value.version !== DURABLE_DELETION_PAYLOAD_VERSION ||
    typeof value.appleLinked !== 'boolean' ||
    typeof value.phase !== 'string'
  ) {
    throw new DurableDeletionPayloadError('APPLE_DELETION_PAYLOAD_INVALID');
  }
  if (
    value.appleLinked === false &&
    value.phase === 'not_linked' &&
    hasExactKeys(value, ['version', 'appleLinked', 'phase'])
  ) {
    return;
  }
  if (
    value.appleLinked === true &&
    value.phase === 'manual' &&
    hasExactKeys(value, ['version', 'appleLinked', 'phase'])
  ) {
    return;
  }
  if (
    value.appleLinked === true &&
    value.phase === 'authorization_code' &&
    hasExactKeys(value, [
      'version',
      'appleLinked',
      'phase',
      'authorizationCode',
      'expectedAppleSubject',
    ]) &&
    validBoundedSecret(value.authorizationCode, APPLE_AUTHORIZATION_CODE_MAX_CHARS) &&
    validBoundedSecret(value.expectedAppleSubject, APPLE_SUBJECT_MAX_CHARS)
  ) {
    return;
  }
  if (
    value.appleLinked === true &&
    value.phase === 'revocation_token' &&
    hasExactKeys(value, ['version', 'appleLinked', 'phase', 'revocationToken', 'tokenTypeHint']) &&
    validBoundedSecret(value.revocationToken, APPLE_REVOCATION_TOKEN_MAX_CHARS) &&
    isTokenType(value.tokenTypeHint)
  ) {
    return;
  }
  throw new DurableDeletionPayloadError('APPLE_DELETION_PAYLOAD_INVALID');
}

function canonicalApplePayloadText(payload: DurableAppleDeletionPayload): string {
  switch (payload.phase) {
    case 'not_linked':
      return JSON.stringify({
        version: payload.version,
        appleLinked: payload.appleLinked,
        phase: payload.phase,
      });
    case 'manual':
      return JSON.stringify({
        version: payload.version,
        appleLinked: payload.appleLinked,
        phase: payload.phase,
      });
    case 'authorization_code':
      return JSON.stringify({
        version: payload.version,
        appleLinked: payload.appleLinked,
        phase: payload.phase,
        authorizationCode: payload.authorizationCode,
        expectedAppleSubject: payload.expectedAppleSubject,
      });
    case 'revocation_token':
      return JSON.stringify({
        version: payload.version,
        appleLinked: payload.appleLinked,
        phase: payload.phase,
        revocationToken: payload.revocationToken,
        tokenTypeHint: payload.tokenTypeHint,
      });
  }
}

export function createAppleDeletionPayload(options: {
  appleLinked: boolean;
  authorizationCode?: string;
  expectedAppleSubject?: string;
}): DurableAppleDeletionPayload {
  if (
    !isRecord(options) ||
    !hasExactKeys(
      options,
      Object.hasOwn(options, 'authorizationCode') || Object.hasOwn(options, 'expectedAppleSubject')
        ? ['appleLinked', 'authorizationCode', 'expectedAppleSubject']
        : ['appleLinked'],
    ) ||
    typeof options.appleLinked !== 'boolean'
  ) {
    throw new DurableDeletionPayloadError('APPLE_DELETION_PAYLOAD_INVALID');
  }
  if (!options.appleLinked) {
    if (
      Object.hasOwn(options, 'authorizationCode') ||
      Object.hasOwn(options, 'expectedAppleSubject')
    ) {
      throw new DurableDeletionPayloadError('APPLE_DELETION_PAYLOAD_INVALID');
    }
    return { version: 1, appleLinked: false, phase: 'not_linked' };
  }
  if (!Object.hasOwn(options, 'authorizationCode')) {
    return { version: 1, appleLinked: true, phase: 'manual' };
  }
  if (
    !validBoundedSecret(options.authorizationCode, APPLE_AUTHORIZATION_CODE_MAX_CHARS) ||
    !validBoundedSecret(options.expectedAppleSubject, APPLE_SUBJECT_MAX_CHARS)
  ) {
    throw new DurableDeletionPayloadError('APPLE_DELETION_PAYLOAD_INVALID');
  }
  return {
    version: 1,
    appleLinked: true,
    phase: 'authorization_code',
    authorizationCode: options.authorizationCode,
    expectedAppleSubject: options.expectedAppleSubject,
  };
}

/**
 * Builds the durable Apple step directly from a server-retained refresh token.
 * The token is opened from the Apple vault only long enough to be re-sealed
 * under the deletion operation's independent AEAD key.
 */
export function createAppleDeletionPayloadWithRevocationToken(
  revocationToken: string,
): DurableAppleDeletionPayload {
  if (!validBoundedSecret(revocationToken, APPLE_REVOCATION_TOKEN_MAX_CHARS)) {
    throw new DurableDeletionPayloadError('APPLE_DELETION_PAYLOAD_INVALID');
  }
  return {
    version: 1,
    appleLinked: true,
    phase: 'revocation_token',
    revocationToken,
    tokenTypeHint: 'refresh_token',
  };
}

export function applePayloadWithRevocationToken(
  current: DurableAppleDeletionPayload,
  revocationToken: string,
  tokenTypeHint: 'refresh_token' | 'access_token',
): DurableAppleDeletionPayload {
  assertApplePayload(current);
  if (
    current.phase !== 'authorization_code' ||
    !validBoundedSecret(revocationToken, APPLE_REVOCATION_TOKEN_MAX_CHARS) ||
    !isTokenType(tokenTypeHint)
  ) {
    throw new DurableDeletionPayloadError('APPLE_DELETION_PAYLOAD_TRANSITION_INVALID');
  }
  return {
    version: 1,
    appleLinked: true,
    phase: 'revocation_token',
    revocationToken,
    tokenTypeHint,
  };
}

export function encodeAppleDeletionPayload(payload: DurableAppleDeletionPayload): Uint8Array {
  assertApplePayload(payload);
  const encoded = UTF8_ENCODER.encode(canonicalApplePayloadText(payload));
  if (
    encoded.byteLength === 0 ||
    encoded.byteLength > maxDeletionPayloadPlaintextBytes('apple_revoke')
  ) {
    throw new DurableDeletionPayloadError('APPLE_DELETION_PAYLOAD_INVALID');
  }
  return encoded;
}

export function decodeAppleDeletionPayload(encoded: Uint8Array): DurableAppleDeletionPayload {
  if (!(encoded instanceof Uint8Array) || encoded.byteLength === 0) {
    throw new DurableDeletionPayloadError('APPLE_DELETION_PAYLOAD_INVALID');
  }
  let text: string;
  let parsed: unknown;
  try {
    text = UTF8_DECODER.decode(encoded);
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new DurableDeletionPayloadError('APPLE_DELETION_PAYLOAD_INVALID');
  }
  assertApplePayload(parsed);
  if (canonicalApplePayloadText(parsed) !== text) {
    throw new DurableDeletionPayloadError('APPLE_DELETION_PAYLOAD_INVALID');
  }
  return parsed;
}
