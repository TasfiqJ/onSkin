import { env } from '@/lib/env';

export type AccountDeletionBarrierState =
  | { status: 'clear'; ownerSubject: string }
  | { status: 'active'; ownerSubject: string };
export type AccountDeletionBarrierTransport = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const PREFLIGHT_TIMEOUT_MS = 15_000;
const PREFLIGHT_RESPONSE_MAX_CHARS = 1_024;
const OWNER_SUBJECT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type ActiveAccountDeletionOwnerProofDependencies = {
  readLocalDataOwnership: (
    userId: string,
  ) => Promise<'cleanup_required' | 'match' | 'mismatch' | 'retained' | 'unclaimed'>;
};

export type ActiveAccountDeletionLocalDataDecision = 'clear' | 'preserve' | 'unclaimed';

export type AccountDeletionBarrierErrorCode =
  | 'ACCOUNT_DELETION_BARRIER_PREFLIGHT_FAILED'
  | 'ACCOUNT_DELETION_BARRIER_SESSION_REJECTED';

export class AccountDeletionBarrierError extends Error {
  constructor(readonly code: AccountDeletionBarrierErrorCode) {
    super(code);
    this.name = 'AccountDeletionBarrierError';
  }
}

function preflightError(): Error {
  return new AccountDeletionBarrierError('ACCOUNT_DELETION_BARRIER_PREFLIGHT_FAILED');
}

function rejectedSessionError(): Error {
  return new AccountDeletionBarrierError('ACCOUNT_DELETION_BARRIER_SESSION_REJECTED');
}

export function isAccountDeletionBarrierSessionRejected(
  error: unknown,
): error is AccountDeletionBarrierError {
  return (
    error instanceof AccountDeletionBarrierError &&
    error.code === 'ACCOUNT_DELETION_BARRIER_SESSION_REJECTED'
  );
}

/**
 * Authorize destructive local cleanup only when the subject attested by the
 * authenticated preflight response maps to the existing local owner proof.
 * The proof travels in the same response as `active`, so Auth deletion after
 * preflight authentication cannot erase cleanup authority. A matching proof
 * clears, a valid foreign proof is durably retained, and missing proof is
 * durably quarantined before candidate Auth/vendor invalidation. Malformed or
 * temporarily unavailable proof keeps the candidate unpublished behind retry.
 */
export async function activeAccountDeletionOwnsLocalData(
  ownerSubject: string,
  dependencies: ActiveAccountDeletionOwnerProofDependencies,
): Promise<ActiveAccountDeletionLocalDataDecision> {
  try {
    if (!OWNER_SUBJECT_PATTERN.test(ownerSubject)) throw preflightError();
    const ownership = await dependencies.readLocalDataOwnership(ownerSubject);
    if (ownership === 'cleanup_required' || ownership === 'match') return 'clear';
    if (ownership === 'unclaimed') return 'unclaimed';
    return 'preserve';
  } catch (error) {
    if (error instanceof AccountDeletionBarrierError) throw error;
    throw preflightError();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseAccountDeletionBarrierResponse(
  status: number,
  body: unknown,
): AccountDeletionBarrierState {
  if (!isRecord(body)) {
    throw preflightError();
  }
  if (
    status === 401 &&
    Object.keys(body).length === 1 &&
    body.error === 'ACCOUNT_DELETION_SESSION_REJECTED'
  ) {
    throw rejectedSessionError();
  }
  if (
    status === 200 &&
    Object.keys(body).length === 2 &&
    (body.status === 'clear' || body.status === 'active') &&
    typeof body.ownerSubject === 'string' &&
    OWNER_SUBJECT_PATTERN.test(body.ownerSubject)
  ) {
    return { status: body.status, ownerSubject: body.ownerSubject };
  }
  throw preflightError();
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > PREFLIGHT_RESPONSE_MAX_CHARS) {
    throw preflightError();
  }
  const serialized = await response.text();
  if (serialized.length === 0 || serialized.length > PREFLIGHT_RESPONSE_MAX_CHARS) {
    throw preflightError();
  }
  try {
    return JSON.parse(serialized) as unknown;
  } catch {
    throw preflightError();
  }
}

/**
 * Resolve a candidate Supabase session against the server-side deletion
 * barrier before AuthProvider publishes the session or mounts vendor code.
 * Every non-exact response is an unknown state and therefore fails closed.
 */
export async function fetchAccountDeletionBarrierState(
  accessToken: string,
  transport: AccountDeletionBarrierTransport = (input, init) => fetch(input, init),
): Promise<AccountDeletionBarrierState> {
  if (
    typeof accessToken !== 'string' ||
    accessToken.length === 0 ||
    accessToken.length > 16_384 ||
    accessToken !== accessToken.trim()
  ) {
    throw preflightError();
  }

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const exchange = (async () => {
      const response = await transport(
        new URL('/functions/v1/account-deletion', env.supabaseUrl).toString(),
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            apikey: env.supabasePublishableKey,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'preflight' }),
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'error',
          signal: controller.signal,
        },
      );
      return parseAccountDeletionBarrierResponse(response.status, await readBoundedJson(response));
    })();
    const deadline = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(preflightError());
      }, PREFLIGHT_TIMEOUT_MS);
    });
    // React Native transports are expected to honor AbortSignal, but the
    // deadline must still settle if a platform adapter or body reader ignores
    // it entirely.
    return await Promise.race([exchange, deadline]);
  } catch (error) {
    if (error instanceof AccountDeletionBarrierError) throw error;
    throw preflightError();
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}
