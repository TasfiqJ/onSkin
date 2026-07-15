export type PublicationLeaseRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

export type PublicationLeaseErrorCode =
  | 'ACCOUNT_DELETION_IN_PROGRESS'
  | 'ACCOUNT_PUBLICATION_SESSION_REJECTED'
  | 'ACCOUNT_PUBLICATION_LEASE_UNAVAILABLE'
  | 'ACCOUNT_PUBLICATION_RELEASE_UNAVAILABLE';

export class PublicationLeaseError extends Error {
  constructor(readonly code: PublicationLeaseErrorCode) {
    super(code);
    this.name = 'PublicationLeaseError';
  }
}

type LeaseAction = 'reserve' | 'activate' | 'renew';
type LeaseStatus = 'reserved' | 'active' | 'blocked' | 'session_rejected' | 'lease_rejected';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function statusRow(data: unknown): string | null {
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) return null;
  const row = data[0];
  if (Object.keys(row).length !== 1 || typeof row.status !== 'string') return null;
  return row.status;
}

function actionRpcName(action: LeaseAction): string {
  return `${action}_account_publication_lease`;
}

function actionFailure(status: string | null): PublicationLeaseError {
  if (status === 'blocked') return new PublicationLeaseError('ACCOUNT_DELETION_IN_PROGRESS');
  if (status === 'session_rejected') {
    return new PublicationLeaseError('ACCOUNT_PUBLICATION_SESSION_REJECTED');
  }
  return new PublicationLeaseError('ACCOUNT_PUBLICATION_LEASE_UNAVAILABLE');
}

async function authenticatedLeaseAction(
  client: PublicationLeaseRpcClient,
  action: LeaseAction,
  userId: string,
  sessionId: string,
  capability: string,
): Promise<void> {
  let response: { data: unknown; error: { message?: string } | null };
  try {
    response = await client.rpc(actionRpcName(action), {
      p_user_id: userId,
      p_session_id: sessionId,
      p_capability: capability,
    });
  } catch {
    response = { data: null, error: { message: 'unavailable' } };
  }
  const status = response.error ? null : statusRow(response.data);
  const expected = action === 'reserve' ? 'reserved' : 'active';
  if (status !== expected) throw actionFailure(status);
}

async function releaseLease(client: PublicationLeaseRpcClient, capability: string): Promise<void> {
  let response: { data: unknown; error: { message?: string } | null };
  try {
    response = await client.rpc('release_account_publication_lease', {
      p_capability: capability,
    });
  } catch {
    response = { data: null, error: { message: 'unavailable' } };
  }
  if (response.error || statusRow(response.data) !== 'released') {
    throw new PublicationLeaseError('ACCOUNT_PUBLICATION_RELEASE_UNAVAILABLE');
  }
}

export function accountPublicationCapability(
  fillRandom: (bytes: Uint8Array) => Uint8Array = (bytes) => crypto.getRandomValues(bytes),
): string {
  const bytes = fillRandom(new Uint8Array(32));
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== 32) {
    throw new PublicationLeaseError('ACCOUNT_PUBLICATION_LEASE_UNAVAILABLE');
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export type PublicationLeaseScope = {
  capability: string;
  /**
   * Revalidates the live Auth session and deletion barrier. Call immediately
   * before every provider get-or-create request and again before committing
   * its projection. The migration-0052 active lease lasts 60 seconds while
   * the provider fetch is capped at 30 seconds including its body read.
   */
  renew: () => Promise<void>;
};

export async function withAccountPublicationLease<T>(input: {
  client: PublicationLeaseRpcClient;
  userId: string;
  sessionId: string;
  operation: (scope: PublicationLeaseScope) => Promise<T>;
  fillRandom?: (bytes: Uint8Array) => Uint8Array;
}): Promise<T> {
  const capability = accountPublicationCapability(input.fillRandom);
  // A reserve RPC may commit and lose its response. Once it is attempted, the
  // finally path must therefore release by capability even when acquisition is
  // ambiguous. If the process dies before finally, migration 0052's 30/60s TTL
  // and deletion drain are the authoritative crash recovery path.
  let releaseRequired = false;
  let result: T | undefined;
  let operationError: unknown;
  try {
    releaseRequired = true;
    await authenticatedLeaseAction(
      input.client,
      'reserve',
      input.userId,
      input.sessionId,
      capability,
    );
    await authenticatedLeaseAction(
      input.client,
      'activate',
      input.userId,
      input.sessionId,
      capability,
    );
    // Revalidate after activation so no event-loop delay can consume the
    // provider-request lease budget before the operation starts.
    await authenticatedLeaseAction(
      input.client,
      'renew',
      input.userId,
      input.sessionId,
      capability,
    );
    result = await input.operation({
      capability,
      renew: () =>
        authenticatedLeaseAction(input.client, 'renew', input.userId, input.sessionId, capability),
    });
  } catch (error) {
    operationError = error;
  }

  if (releaseRequired) {
    try {
      await releaseLease(input.client, capability);
    } catch (releaseError) {
      // Preserve the primary failure. On an otherwise successful operation,
      // surface release ambiguity so callers do not claim the lifecycle fully
      // completed; the database TTL remains fail-safe for deletion.
      if (operationError === undefined) operationError = releaseError;
    }
  }
  if (operationError !== undefined) throw operationError;
  return result as T;
}
