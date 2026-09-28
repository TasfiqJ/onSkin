import * as Crypto from 'expo-crypto';

import { env } from '@/lib/env';
import {
  runWithSupabaseAccountDeletionRequestPermit,
  type SupabaseRemoteRequestTransport,
} from '@/lib/supabase/remoteRequestGate';

export type AccountPublicationAuthenticatedAction =
  | 'publication_reserve'
  | 'publication_activate'
  | 'publication_renew';

export type AccountPublicationAction =
  | AccountPublicationAuthenticatedAction
  | 'publication_release';

export type AccountPublicationSuccess = 'reserved' | 'active' | 'released';

export type AccountPublicationTransport = SupabaseRemoteRequestTransport;

export type AccountPublicationSessionBinding = Readonly<{
  subject: string;
  sessionId: string;
  accessToken: string;
}>;

export type AccountPublicationFenceErrorCode =
  | 'ACCOUNT_PUBLICATION_SESSION_REJECTED'
  | 'ACCOUNT_DELETION_ACTIVE'
  | 'ACCOUNT_PUBLICATION_LEASE_REJECTED'
  | 'ACCOUNT_PUBLICATION_UNAVAILABLE';

export class AccountPublicationFenceError extends Error {
  constructor(readonly code: AccountPublicationFenceErrorCode) {
    super(code);
    this.name = 'AccountPublicationFenceError';
  }
}

const CAPABILITY_BYTES = 32;
const CAPABILITY_PATTERN = /^[a-f0-9]{64}$/;
const AUTH_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const JWT_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;
const JWT_MAX_CHARS = 16_384;
const JWT_PAYLOAD_MAX_CHARS = 8_192;
const RESPONSE_MAX_CHARS = 1_024;
const REQUEST_TIMEOUT_MS = 15_000;

function publicationError(code: AccountPublicationFenceErrorCode): AccountPublicationFenceError {
  return new AccountPublicationFenceError(code);
}

function unavailableError(): AccountPublicationFenceError {
  return publicationError('ACCOUNT_PUBLICATION_UNAVAILABLE');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return (
    actual.length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function expectedSuccess(action: AccountPublicationAction): AccountPublicationSuccess {
  if (action === 'publication_reserve') return 'reserved';
  if (action === 'publication_release') return 'released';
  return 'active';
}

export function parseAccountPublicationResponse(
  action: AccountPublicationAction,
  status: number,
  body: unknown,
): AccountPublicationSuccess {
  if (!isRecord(body) || !hasExactKeys(body, status === 200 ? ['status'] : ['error'])) {
    throw unavailableError();
  }
  const success = expectedSuccess(action);
  if (status === 200 && body.status === success) return success;
  if (status === 401 && body.error === 'ACCOUNT_PUBLICATION_SESSION_REJECTED') {
    throw publicationError('ACCOUNT_PUBLICATION_SESSION_REJECTED');
  }
  if (status === 409 && body.error === 'ACCOUNT_DELETION_ACTIVE') {
    throw publicationError('ACCOUNT_DELETION_ACTIVE');
  }
  if (status === 409 && body.error === 'ACCOUNT_PUBLICATION_LEASE_REJECTED') {
    throw publicationError('ACCOUNT_PUBLICATION_LEASE_REJECTED');
  }
  if (status === 503 && body.error === 'ACCOUNT_PUBLICATION_UNAVAILABLE') {
    throw unavailableError();
  }
  throw unavailableError();
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > RESPONSE_MAX_CHARS) {
    throw unavailableError();
  }
  const serialized = await response.text();
  if (serialized.length === 0 || serialized.length > RESPONSE_MAX_CHARS) {
    throw unavailableError();
  }
  try {
    return JSON.parse(serialized) as unknown;
  } catch {
    throw unavailableError();
  }
}

export async function createAccountPublicationCapability(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(CAPABILITY_BYTES);
  if (!(bytes instanceof Uint8Array) || bytes.length !== CAPABILITY_BYTES) {
    throw unavailableError();
  }
  const capability = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (!CAPABILITY_PATTERN.test(capability)) throw unavailableError();
  return capability;
}

/**
 * Decode only the claims required to bind an already-issued Supabase session.
 * The server independently verifies the bearer on every authenticated lease
 * action; malformed, non-canonical, or mismatched cached claims fail closed.
 */
export function accountPublicationSessionBinding(
  accessToken: unknown,
  expectedUserId: unknown,
): AccountPublicationSessionBinding | null {
  if (
    typeof accessToken !== 'string' ||
    accessToken.length === 0 ||
    accessToken.length > JWT_MAX_CHARS ||
    typeof expectedUserId !== 'string' ||
    !AUTH_UUID_PATTERN.test(expectedUserId)
  ) {
    return null;
  }
  const segments = accessToken.split('.');
  const payloadSegment = segments.length === 3 ? segments[1] : undefined;
  if (
    typeof payloadSegment !== 'string' ||
    payloadSegment.length === 0 ||
    payloadSegment.length > JWT_PAYLOAD_MAX_CHARS ||
    payloadSegment.length % 4 === 1 ||
    !JWT_SEGMENT_PATTERN.test(payloadSegment)
  ) {
    return null;
  }

  try {
    const base64 = payloadSegment.replaceAll('-', '+').replaceAll('_', '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const payload = JSON.parse(decoded) as unknown;
    if (
      !isRecord(payload) ||
      typeof payload.sub !== 'string' ||
      payload.sub !== expectedUserId ||
      !AUTH_UUID_PATTERN.test(payload.sub) ||
      typeof payload.session_id !== 'string' ||
      !AUTH_UUID_PATTERN.test(payload.session_id)
    ) {
      return null;
    }
    return Object.freeze({
      subject: payload.sub,
      sessionId: payload.session_id,
      accessToken,
    });
  } catch {
    return null;
  }
}

export async function exchangeAccountPublicationFence(
  action: AccountPublicationAction,
  capability: string,
  binding?: AccountPublicationSessionBinding,
  transport: AccountPublicationTransport = (input, init) => fetch(input, init),
): Promise<AccountPublicationSuccess> {
  const authenticated = action !== 'publication_release';
  if (
    !CAPABILITY_PATTERN.test(capability) ||
    (authenticated &&
      (binding === undefined ||
        binding.accessToken.length === 0 ||
        binding.accessToken.length > JWT_MAX_CHARS ||
        binding.accessToken !== binding.accessToken.trim())) ||
    (!authenticated && binding !== undefined)
  ) {
    throw unavailableError();
  }

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const exchange = (async () => {
      const permit = authenticated
        ? {
            action: action as AccountPublicationAuthenticatedAction,
            binding: binding!,
            timeoutMs: REQUEST_TIMEOUT_MS,
          }
        : ({ action: 'publication_release', timeoutMs: REQUEST_TIMEOUT_MS } as const);
      return runWithSupabaseAccountDeletionRequestPermit(
        permit,
        transport,
        async (gatedTransport) => {
          const response = await gatedTransport(
            new URL('/functions/v1/account-deletion', env.supabaseUrl).toString(),
            {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                apikey: env.supabasePublishableKey,
                ...(authenticated ? { Authorization: `Bearer ${binding!.accessToken}` } : {}),
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ action, capability }),
              cache: 'no-store',
              credentials: 'omit',
              redirect: 'error',
              signal: controller.signal,
            },
          );
          return parseAccountPublicationResponse(
            action,
            response.status,
            await readBoundedJson(response),
          );
        },
      );
    })();
    const deadline = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(unavailableError());
      }, REQUEST_TIMEOUT_MS);
    });
    return await Promise.race([exchange, deadline]);
  } catch (error) {
    if (error instanceof AccountPublicationFenceError) throw error;
    throw unavailableError();
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export function isAccountPublicationFenceError(
  error: unknown,
  code?: AccountPublicationFenceErrorCode,
): error is AccountPublicationFenceError {
  return (
    error instanceof AccountPublicationFenceError && (code === undefined || error.code === code)
  );
}
