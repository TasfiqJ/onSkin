import { isAuthApiError, isAuthSessionMissingError } from '@supabase/supabase-js';

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];
type FetchImplementation = (input: FetchInput, init?: FetchInit) => Promise<Response>;

const DEFINITIVE_REFRESH_ERROR_CODES = new Set([
  'refresh_token_not_found',
  'refresh_token_already_used',
  'session_expired',
  'session_not_found',
  'user_banned',
  'user_not_found',
]);
const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const JWT_MAX_CHARS = 16_384;
const JWT_PAYLOAD_MAX_CHARS = 8_192;

type RefreshProtectionFailure = 'ambiguous_error_response' | 'invalid_success_response';

export class SupabaseAuthRefreshProtectionError extends Error {
  readonly code: RefreshProtectionFailure;

  constructor(code: RefreshProtectionFailure) {
    super(`SUPABASE_AUTH_REFRESH_${code.toUpperCase()}`);
    this.name = 'SupabaseAuthRefreshProtectionError';
    this.code = code;
  }
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requestUrl(input: FetchInput): string | null {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (typeof input === 'object' && input !== null && 'url' in input) {
    const url = (input as { url?: unknown }).url;
    return typeof url === 'string' ? url : null;
  }
  return null;
}

function refreshEndpointFor(supabaseUrl: string): URL {
  const endpoint = new URL(supabaseUrl);
  endpoint.pathname = `${endpoint.pathname.replace(/\/+$/, '')}/auth/v1/token`;
  endpoint.search = '';
  endpoint.hash = '';
  return endpoint;
}

function isRefreshTokenRequest(input: FetchInput, endpoint: URL): boolean {
  const rawUrl = requestUrl(input);
  if (!rawUrl) return false;
  try {
    const url = new URL(rawUrl);
    const grantTypes = url.searchParams.getAll('grant_type');
    return (
      url.origin === endpoint.origin &&
      url.pathname === endpoint.pathname &&
      grantTypes.length === 1 &&
      grantTypes[0] === 'refresh_token'
    );
  } catch {
    return false;
  }
}

async function clonedJson(response: Response): Promise<unknown> {
  try {
    return await response.clone().json();
  } catch {
    throw new SupabaseAuthRefreshProtectionError(
      response.ok ? 'invalid_success_response' : 'ambiguous_error_response',
    );
  }
}

function responseErrorCode(value: unknown): string | null {
  const payload = record(value);
  if (!payload) return null;
  if (nonEmptyString(payload.code)) return payload.code;
  return nonEmptyString(payload.error_code) ? payload.error_code : null;
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (value.length === 0 || value.length > JWT_PAYLOAD_MAX_CHARS || value.length % 4 === 1) {
    return null;
  }
  const output = new Uint8Array(Math.floor((value.length * 6) / 8));
  let accumulator = 0;
  let availableBits = 0;
  let outputIndex = 0;
  for (const character of value) {
    const digit = BASE64URL_ALPHABET.indexOf(character);
    if (digit < 0) return null;
    accumulator = (accumulator << 6) | digit;
    availableBits += 6;
    if (availableBits >= 8) {
      availableBits -= 8;
      output[outputIndex] = (accumulator >> availableBits) & 0xff;
      outputIndex += 1;
      accumulator &= (1 << availableBits) - 1;
    }
  }
  // Reject non-canonical encodings whose unused tail bits are non-zero.
  if (availableBits > 0 && accumulator !== 0) return null;
  return outputIndex === output.length ? output : null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  if (token.length === 0 || token.length > JWT_MAX_CHARS) return null;
  const segments = token.split('.');
  if (segments.length !== 3) return null;
  const encodedPayload = segments[1];
  if (!encodedPayload) return null;
  try {
    const bytes = decodeBase64Url(encodedPayload);
    if (!bytes) return null;
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return record(JSON.parse(decoded));
  } catch {
    return null;
  }
}

export type SupabaseAccessTokenClaims = Readonly<{
  subject: string;
  sessionId: string;
  expiresAt: number;
}>;

/** Bounded claims needed to bind and persist a server-validated refresh. */
export function parseSupabaseAccessTokenClaims(token: unknown): SupabaseAccessTokenClaims | null {
  if (typeof token !== 'string') return null;
  const payload = decodeJwtPayload(token);
  if (
    !payload ||
    !nonEmptyString(payload.sub) ||
    !nonEmptyString(payload.session_id) ||
    typeof payload.exp !== 'number' ||
    !Number.isSafeInteger(payload.exp) ||
    payload.exp <= 0
  ) {
    return null;
  }
  return Object.freeze({
    subject: payload.sub,
    sessionId: payload.session_id,
    expiresAt: payload.exp,
  });
}

function isValidRefreshSuccess(value: unknown): boolean {
  const payload = record(value);
  const user = record(payload?.user);
  if (
    !payload ||
    !user ||
    !nonEmptyString(payload.access_token) ||
    !nonEmptyString(payload.refresh_token) ||
    typeof payload.expires_in !== 'number' ||
    !Number.isFinite(payload.expires_in) ||
    payload.expires_in <= 0 ||
    !nonEmptyString(user.id)
  ) {
    return false;
  }
  if (payload.token_type !== undefined && payload.token_type !== 'bearer') return false;

  const jwtClaims = parseSupabaseAccessTokenClaims(payload.access_token);
  return Boolean(jwtClaims && jwtClaims.subject === user.id);
}

/**
 * Protect auth-js from treating an ambiguous refresh response as proof that a
 * cached session is revoked. The wrapped fetch throws for every non-definitive
 * failure, which auth-js maps to AuthRetryableFetchError without deleting its
 * encrypted session. Only exact documented terminal error codes pass through.
 */
export function createSupabaseAuthRefreshProtectiveFetch(options: {
  fetchImplementation: FetchImplementation;
  supabaseUrl: string;
}): FetchImplementation {
  const endpoint = refreshEndpointFor(options.supabaseUrl);
  return async (input, init) => {
    const response = await options.fetchImplementation(input, init);
    if (!isRefreshTokenRequest(input, endpoint)) return response;

    const payload = await clonedJson(response);
    if (!response.ok) {
      const errorCode = responseErrorCode(payload);
      if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429 &&
        errorCode &&
        DEFINITIVE_REFRESH_ERROR_CODES.has(errorCode)
      ) {
        return response;
      }
      throw new SupabaseAuthRefreshProtectionError('ambiguous_error_response');
    }
    if (!isValidRefreshSuccess(payload)) {
      throw new SupabaseAuthRefreshProtectionError('invalid_success_response');
    }
    return response;
  };
}

/** Exact terminal refresh evidence accepted by AuthProvider after fetch hardening. */
export function isDefinitiveSupabaseRefreshRejection(error: unknown): boolean {
  if (isAuthSessionMissingError(error)) return true;
  return Boolean(
    isAuthApiError(error) &&
    typeof error.code === 'string' &&
    DEFINITIVE_REFRESH_ERROR_CODES.has(error.code),
  );
}
