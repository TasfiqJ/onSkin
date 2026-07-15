const MAX_POSTGRES_BIGINT = 9_223_372_036_854_775_807n;
const NON_NEGATIVE_DECIMAL = /^(?:0|[1-9][0-9]{0,18})$/;

type AccountAccessRpcClient = {
  rpc(functionName: 'get_account_access_state'): PromiseLike<{ data: unknown; error: unknown }>;
};

export type AccountAccessSnapshot = {
  userId: string;
  state: 'active' | 'not_applicable';
  generation: string;
};

export type AccountAccessPreflightResult =
  | { ok: true; snapshot: AccountAccessSnapshot }
  | {
      ok: false;
      error:
        | 'ACCOUNT_ACCESS_UNAUTHORIZED'
        | 'ACCOUNT_ACCESS_BLOCKED'
        | 'ACCOUNT_ACCESS_CHANGED'
        | 'ACCOUNT_ACCESS_UNAVAILABLE';
      status: 401 | 403 | 409 | 503;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalPostgresBigint(value: unknown): string | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? String(value) : null;
  }
  if (typeof value !== 'string' || !NON_NEGATIVE_DECIMAL.test(value)) return null;
  try {
    return BigInt(value) <= MAX_POSTGRES_BIGINT ? value : null;
  } catch {
    return null;
  }
}

function isSessionRejection(error: unknown): boolean {
  return (
    isRecord(error) &&
    error.code === '28000' &&
    error.message === 'ACCOUNT_ACCESS_SESSION_REJECTED'
  );
}

const unavailable = (): AccountAccessPreflightResult => ({
  ok: false,
  error: 'ACCOUNT_ACCESS_UNAVAILABLE',
  status: 503,
});

/**
 * Authorizes an authenticated Edge request against the database's exact live
 * session and Apple lifecycle authority. The returned generation must be
 * retained and supplied to later calls after non-atomic/service-role work.
 * A changed generation discards the old request even if the account became
 * active again under a newer credential lifecycle.
 */
export async function preflightAccountAccess(
  client: AccountAccessRpcClient,
  expectedUserId: string,
  expectedSnapshot?: AccountAccessSnapshot,
): Promise<AccountAccessPreflightResult> {
  let response: { data: unknown; error: unknown };
  try {
    response = await client.rpc('get_account_access_state');
  } catch {
    return unavailable();
  }

  if (response.error) {
    return isSessionRejection(response.error)
      ? { ok: false, error: 'ACCOUNT_ACCESS_UNAUTHORIZED', status: 401 }
      : unavailable();
  }
  if (!Array.isArray(response.data) || response.data.length !== 1) return unavailable();

  const row = response.data[0];
  if (
    !isRecord(row) ||
    Object.keys(row).sort().join(',') !== 'generation,state,user_id' ||
    row.user_id !== expectedUserId
  ) {
    return unavailable();
  }
  const generation = canonicalPostgresBigint(row.generation);
  if (!generation) return unavailable();
  if (row.state === 'blocked') {
    return { ok: false, error: 'ACCOUNT_ACCESS_BLOCKED', status: 403 };
  }
  if (row.state !== 'active' && row.state !== 'not_applicable') return unavailable();

  const snapshot: AccountAccessSnapshot = {
    userId: expectedUserId,
    state: row.state,
    generation,
  };
  if (
    expectedSnapshot &&
    (expectedSnapshot.userId !== snapshot.userId ||
      expectedSnapshot.state !== snapshot.state ||
      expectedSnapshot.generation !== snapshot.generation)
  ) {
    return { ok: false, error: 'ACCOUNT_ACCESS_CHANGED', status: 409 };
  }
  return { ok: true, snapshot };
}
