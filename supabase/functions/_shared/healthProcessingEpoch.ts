import { CURRENT_HEALTH_CONSENT_DISCLOSURE_CONTRACT } from '../consent-withdrawal/healthConsentContract.ts';

export const HEALTH_PROCESSING_EPOCH_HEADER = 'x-health-processing-epoch' as const;

const MAX_POSTGRES_BIGINT = 9_223_372_036_854_775_807n;
const POSITIVE_DECIMAL = /^[1-9][0-9]{0,18}$/;

type HealthProcessingStatusRpcClient = {
  rpc(
    functionName: 'get_health_data_consent_status',
  ): PromiseLike<{ data: unknown; error: unknown }>;
};

export type HealthProcessingPreflightResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'HEALTH_PROCESSING_NOT_ACTIVE'
        | 'HEALTH_PROCESSING_EPOCH_STALE'
        | 'HEALTH_PROCESSING_CONSENT_STALE'
        | 'HEALTH_PROCESSING_STATUS_UNAVAILABLE';
      status: 409 | 503;
    };

/**
 * Returns the exact validated decimal header for forwarding to PostgREST.
 * Strings are preserved so no JavaScript number rounding can change an epoch.
 */
export function readHealthProcessingEpochHeader(headers: Headers): string | null {
  const value = headers.get(HEALTH_PROCESSING_EPOCH_HEADER);
  if (value === null || !POSITIVE_DECIMAL.test(value)) return null;
  try {
    return BigInt(value) <= MAX_POSTGRES_BIGINT ? value : null;
  } catch {
    return null;
  }
}

export function healthProcessingCallerHeaders(
  authorization: string,
  epoch: string,
): Record<string, string> {
  return {
    Authorization: authorization,
    [HEALTH_PROCESSING_EPOCH_HEADER]: epoch,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalPositivePostgresBigint(value: unknown): string | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  }
  if (typeof value !== 'string' || !POSITIVE_DECIMAL.test(value)) return null;
  try {
    return BigInt(value) <= MAX_POSTGRES_BIGINT ? value : null;
  } catch {
    return null;
  }
}

const statusUnavailable = (): HealthProcessingPreflightResult => ({
  ok: false,
  error: 'HEALTH_PROCESSING_STATUS_UNAVAILABLE',
  status: 503,
});

/**
 * Fail-closed authorization check for health-derived catalog processing.
 *
 * This must run with the authenticated caller client, before rate limiting,
 * request-body processing, service-role catalog work, or external requests.
 * Callers should repeat it after non-atomic work so a withdrawal that begins
 * during the request discards the result instead of returning or persisting it.
 */
export async function preflightActiveHealthProcessing(
  client: HealthProcessingStatusRpcClient,
  expectedUserId: string,
  expectedEpoch: string,
): Promise<HealthProcessingPreflightResult> {
  let response: { data: unknown; error: unknown };
  try {
    response = await client.rpc('get_health_data_consent_status');
  } catch {
    return statusUnavailable();
  }

  if (response.error || !Array.isArray(response.data) || response.data.length !== 1) {
    return statusUnavailable();
  }
  const row = response.data[0];
  if (!isRecord(row) || row.user_id !== expectedUserId || typeof row.state !== 'string') {
    return statusUnavailable();
  }
  if (row.state !== 'active') {
    return { ok: false, error: 'HEALTH_PROCESSING_NOT_ACTIVE', status: 409 };
  }

  const currentEpoch = canonicalPositivePostgresBigint(row.epoch);
  if (!currentEpoch) return statusUnavailable();
  if (currentEpoch !== expectedEpoch) {
    return { ok: false, error: 'HEALTH_PROCESSING_EPOCH_STALE', status: 409 };
  }

  if (
    row.consent_version !== CURRENT_HEALTH_CONSENT_DISCLOSURE_CONTRACT.version ||
    row.consent_text_hash !== CURRENT_HEALTH_CONSENT_DISCLOSURE_CONTRACT.grantTextHash
  ) {
    return { ok: false, error: 'HEALTH_PROCESSING_CONSENT_STALE', status: 409 };
  }

  return { ok: true };
}
