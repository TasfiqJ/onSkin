import { readLimitedResponseTextWithByteLength } from '../_shared/fetch.ts';
import type { AppleTokenExchangeResult } from './appleDeletionExecutor.ts';
import type { AppleRevokeResponse } from './durableProviderDeletion.ts';
import { type AppleRevocationConfiguration, attestAppleTokenExchange } from './providerDeletion.ts';

export type AppleDeletionFetch = (
  input: string | URL | Request,
  init: RequestInit,
  timeoutMs: number,
) => Promise<Response>;

export type AppleDeletionNetwork = {
  exchangeAuthorizationCode(
    code: string,
    expectedAppleSubject: string,
  ): Promise<AppleTokenExchangeResult>;
  revokeToken(
    token: string,
    tokenTypeHint: 'refresh_token' | 'access_token',
  ): Promise<AppleRevokeResponse>;
};

export class AppleDeletionNetworkError extends Error {
  constructor(public readonly code: 'APPLE_NETWORK_FAILED') {
    super(code);
    this.name = 'AppleDeletionNetworkError';
  }
}

const APPLE_PUBLIC_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const JWT_PART_MAX_BYTES = 16_384;
const JWT_SIGNATURE_MAX_BYTES = 1_024;

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactNonBlank(value: unknown, maximum = 512): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maximum ||
    value !== value.trim()
  )
    return false;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 31 || codeUnit === 127) return false;
  }
  return true;
}

function decodeBase64Url(value: string, maximum: number): Uint8Array<ArrayBuffer> {
  if (
    !Number.isSafeInteger(maximum) ||
    maximum < 1 ||
    !/^[A-Za-z0-9_-]+$/u.test(value) ||
    value.length > maximum * 2
  ) {
    throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
  }
  const encoded =
    value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  try {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    if (bytes.byteLength === 0 || bytes.byteLength > maximum) {
      throw new Error('invalid base64url length');
    }
    // Reject alternate encodings so the exact signed bytes have one canonical
    // representation at this boundary.
    if (base64Url(bytes) !== value) {
      throw new Error('non-canonical base64url');
    }
    return bytes;
  } catch {
    throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
  }
}

function decodeJwtPart(value: string): Record<string, unknown> {
  try {
    const bytes = decodeBase64Url(value, JWT_PART_MAX_BYTES);
    const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
    if (!isRecord(parsed)) {
      throw new Error('invalid JWT object');
    }
    return parsed;
  } catch {
    throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
  }
}

type ParsedAppleIdentityToken = {
  header: Record<string, unknown>;
  claims: Record<string, unknown>;
  signingInput: Uint8Array<ArrayBuffer>;
  signature: Uint8Array<ArrayBuffer>;
};

function parseAppleIdentityToken(value: string): ParsedAppleIdentityToken {
  const parts = value.split('.');
  if (parts.length !== 3) {
    throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
  }
  const header = decodeJwtPart(parts[0]);
  if (
    header.alg !== 'RS256' ||
    !exactNonBlank(header.kid, 255) ||
    (Object.hasOwn(header, 'typ') && header.typ !== 'JWT')
  ) {
    throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
  }
  return {
    header,
    claims: decodeJwtPart(parts[1]),
    signingInput: new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    signature: decodeBase64Url(parts[2], JWT_SIGNATURE_MAX_BYTES),
  };
}

function selectAppleVerificationJwk(value: unknown, expectedKeyId: string): JsonWebKey {
  if (
    !isRecord(value) ||
    !Array.isArray(value.keys) ||
    value.keys.length === 0 ||
    value.keys.length > 64
  ) {
    throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
  }
  const matching = value.keys.filter(
    (candidate) => isRecord(candidate) && candidate.kid === expectedKeyId,
  );
  if (matching.length !== 1) {
    throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
  }
  const candidate = matching[0];
  if (
    candidate.kty !== 'RSA' ||
    candidate.alg !== 'RS256' ||
    candidate.use !== 'sig' ||
    !exactNonBlank(candidate.n, 4_096) ||
    !exactNonBlank(candidate.e, 128) ||
    !/^[A-Za-z0-9_-]+$/u.test(candidate.n) ||
    !/^[A-Za-z0-9_-]+$/u.test(candidate.e)
  ) {
    throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
  }
  return {
    alg: 'RS256',
    e: candidate.e,
    ext: true,
    key_ops: ['verify'],
    kty: 'RSA',
    n: candidate.n,
    use: 'sig',
  };
}

async function importAppleVerificationKey(jwk: JsonWebKey): Promise<CryptoKey> {
  try {
    return await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
  } catch {
    throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
  }
}

/**
 * The token response arrives from Apple's fixed HTTPS origin with redirects
 * disabled. Bind its returned identity token to the deleting Supabase Apple
 * subject before accepting a revocation token, so a valid code for a different
 * Apple account can never be revoked by this operation.
 */
async function attestExchangeSubject(
  body: unknown,
  expectedAppleSubject: string,
  clientId: string,
  nowMs: number,
  verificationKey: (keyId: string) => Promise<CryptoKey>,
): Promise<void> {
  if (
    !isRecord(body) ||
    !exactNonBlank(body.id_token, 16_384) ||
    !exactNonBlank(expectedAppleSubject) ||
    !exactNonBlank(clientId) ||
    !Number.isSafeInteger(nowMs) ||
    nowMs < 0 ||
    typeof verificationKey !== 'function'
  ) {
    throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
  }
  const parsed = parseAppleIdentityToken(body.id_token);
  const key = await verificationKey(parsed.header.kid as string);
  let signatureValid = false;
  try {
    signatureValid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      key,
      parsed.signature,
      parsed.signingInput,
    );
  } catch {
    throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
  }
  if (!signatureValid) {
    throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
  }
  const claims = parsed.claims;
  const nowSeconds = Math.floor(nowMs / 1_000);
  if (
    claims.iss !== 'https://appleid.apple.com' ||
    claims.aud !== clientId ||
    claims.sub !== expectedAppleSubject ||
    typeof claims.exp !== 'number' ||
    !Number.isSafeInteger(claims.exp) ||
    claims.exp <= nowSeconds ||
    typeof claims.iat !== 'number' ||
    !Number.isSafeInteger(claims.iat) ||
    claims.iat > nowSeconds + 300 ||
    claims.iat < nowSeconds - 86_400
  ) {
    throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
  }
}

function utf8Base64Url(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function pkcs8Bytes(privateKey: string): Uint8Array<ArrayBuffer> {
  const normalized = privateKey.replace(/\\n/g, '\n').trim();
  const match = normalized.match(
    /^-----BEGIN PRIVATE KEY-----\n([A-Za-z0-9+/=\r\n]+)\n-----END PRIVATE KEY-----$/,
  );
  if (match === null) {
    throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
  }
  let binary: string;
  try {
    binary = atob(match[1].replace(/\s/g, ''));
  } catch {
    throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  if (bytes.byteLength === 0) {
    throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
  }
  return bytes;
}

async function importSigningKey(privateKey: string): Promise<CryptoKey> {
  const bytes = pkcs8Bytes(privateKey);
  try {
    return await crypto.subtle.importKey(
      'pkcs8',
      bytes,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );
  } catch {
    throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
  } finally {
    bytes.fill(0);
  }
}

async function clientSecret(
  config: AppleRevocationConfiguration,
  key: CryptoKey,
  nowMs: number,
): Promise<string> {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
  }
  const nowSeconds = Math.floor(nowMs / 1_000);
  const signingInput = `${utf8Base64Url({ alg: 'ES256', kid: config.keyId })}.${utf8Base64Url({
    iss: config.teamId,
    iat: nowSeconds,
    exp: nowSeconds + 600,
    aud: 'https://appleid.apple.com',
    sub: config.clientId,
  })}`;
  let signature: ArrayBuffer;
  try {
    signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      new TextEncoder().encode(signingInput),
    );
  } catch {
    throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
  }
  const signatureBytes = new Uint8Array(signature);
  if (signatureBytes.byteLength !== 64) {
    throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
  }
  return `${signingInput}.${base64Url(signatureBytes)}`;
}

async function boundedBody(
  response: Response,
  maximum: number,
): Promise<{ body: string; responseBytes: number }> {
  const result = await readLimitedResponseTextWithByteLength(response, maximum);
  if (result === null) {
    throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
  }
  return { body: result.text, responseBytes: result.byteLength };
}

export async function createAppleDeletionNetwork(options: {
  config: AppleRevocationConfiguration;
  fetcher: AppleDeletionFetch;
  now: () => number;
  timeoutMs: number;
  maxResponseBytes: number;
}): Promise<AppleDeletionNetwork> {
  if (
    options === null ||
    typeof options !== 'object' ||
    options.config === null ||
    typeof options.config !== 'object' ||
    typeof options.fetcher !== 'function' ||
    typeof options.now !== 'function' ||
    !Number.isSafeInteger(options.timeoutMs) ||
    options.timeoutMs < 100 ||
    options.timeoutMs > 30_000 ||
    !Number.isSafeInteger(options.maxResponseBytes) ||
    options.maxResponseBytes < 1_024 ||
    options.maxResponseBytes > 32_768
  ) {
    throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
  }
  const key = await importSigningKey(options.config.privateKey);
  const verificationKeys = new Map<string, Promise<CryptoKey>>();

  function verificationKey(keyId: string): Promise<CryptoKey> {
    if (!exactNonBlank(keyId, 255)) {
      return Promise.reject(new AppleDeletionNetworkError('APPLE_NETWORK_FAILED'));
    }
    const cached = verificationKeys.get(keyId);
    if (cached !== undefined) return cached;
    const pending = (async () => {
      let response: Response;
      try {
        response = await options.fetcher(
          APPLE_PUBLIC_KEYS_URL,
          {
            method: 'GET',
            redirect: 'error',
            headers: {
              Accept: 'application/json',
              'Cache-Control': 'no-store',
            },
          },
          options.timeoutMs,
        );
      } catch {
        throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
      }
      const { body: text } = await boundedBody(response, options.maxResponseBytes);
      if (response.status !== 200) {
        throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
      }
      let body: unknown;
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
      }
      return await importAppleVerificationKey(selectAppleVerificationJwk(body, keyId));
    })();
    verificationKeys.set(keyId, pending);
    return pending;
  }

  async function sendForm(params: URLSearchParams): Promise<Response> {
    try {
      return await options.fetcher(
        params.has('code')
          ? 'https://appleid.apple.com/auth/token'
          : 'https://appleid.apple.com/auth/revoke',
        {
          method: 'POST',
          redirect: 'error',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cache-Control': 'no-store',
          },
          body: params,
        },
        options.timeoutMs,
      );
    } catch {
      throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
    }
  }

  return {
    async exchangeAuthorizationCode(code, expectedAppleSubject) {
      if (!exactNonBlank(code, 4_096) || !exactNonBlank(expectedAppleSubject)) {
        throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
      }
      const secret = await clientSecret(options.config, key, options.now());
      const response = await sendForm(
        new URLSearchParams({
          client_id: options.config.clientId,
          client_secret: secret,
          code,
          grant_type: 'authorization_code',
        }),
      );
      const { body: text } = await boundedBody(response, options.maxResponseBytes);
      let body: unknown = null;
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
      }
      try {
        const attested = attestAppleTokenExchange(response.status, body);
        await attestExchangeSubject(
          body,
          expectedAppleSubject,
          options.config.clientId,
          options.now(),
          verificationKey,
        );
        return attested;
      } catch {
        throw new AppleDeletionNetworkError('APPLE_NETWORK_FAILED');
      }
    },
    async revokeToken(token, tokenTypeHint) {
      const secret = await clientSecret(options.config, key, options.now());
      const response = await sendForm(
        new URLSearchParams({
          client_id: options.config.clientId,
          client_secret: secret,
          token,
          token_type_hint: tokenTypeHint,
        }),
      );
      const { body, responseBytes } = await boundedBody(response, options.maxResponseBytes);
      return { status: response.status, body, responseBytes };
    },
  };
}
