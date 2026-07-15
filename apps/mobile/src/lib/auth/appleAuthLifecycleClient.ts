import { env } from '@/lib/env';
import {
  createSupabaseRemoteRequestGatedFetch,
  runWithSupabaseAppleCredentialInvalidationPermit,
  type SupabaseAppleCredentialInvalidReason,
  type SupabaseRemoteSessionBinding,
} from '@/lib/supabase/remoteRequestGate';

export type AppleAuthLifecycleCapture = Readonly<{
  appleUser: string;
  authorizationCode: string;
  identityToken: string;
  nonce: string;
}>;

export type AppleAuthLifecycleActiveResult = Readonly<{
  status: 'active';
  generation: number | string;
  nextValidationAt: string;
}>;

const APPLE_AUTH_LIFECYCLE_CAPTURE_FAILED = 'APPLE_AUTH_LIFECYCLE_CAPTURE_FAILED';
const APPLE_AUTH_LIFECYCLE_INVALIDATION_FAILED = 'APPLE_AUTH_LIFECYCLE_INVALIDATION_FAILED';
const POSTGRES_BIGINT_MAX_DECIMAL = '9223372036854775807';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPositiveGeneration(value: unknown): value is number | string {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0;
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,18}$/u.test(value)) return false;
  return value.length < POSTGRES_BIGINT_MAX_DECIMAL.length || value <= POSTGRES_BIGINT_MAX_DECIMAL;
}

function parseActiveResult(value: unknown): AppleAuthLifecycleActiveResult | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value).sort();
  if (
    keys.length !== 3 ||
    keys[0] !== 'generation' ||
    keys[1] !== 'nextValidationAt' ||
    keys[2] !== 'status' ||
    value.status !== 'active' ||
    !isPositiveGeneration(value.generation) ||
    typeof value.nextValidationAt !== 'string' ||
    value.nextValidationAt.length === 0 ||
    value.nextValidationAt.length > 64 ||
    !Number.isFinite(Date.parse(value.nextValidationAt))
  ) {
    return null;
  }
  return Object.freeze({
    status: 'active',
    generation: value.generation,
    nextValidationAt: value.nextValidationAt,
  });
}

/**
 * Dispatch the second half of the central Apple bootstrap permit. Calling this
 * outside that permit cannot authorize the signed-in bootstrap sequence.
 */
export async function captureAppleAuthLifecycle(
  accessToken: string,
  capture: AppleAuthLifecycleCapture,
): Promise<AppleAuthLifecycleActiveResult> {
  const gatedFetch = createSupabaseRemoteRequestGatedFetch();
  const response = await gatedFetch(
    `${env.supabaseUrl.replace(/\/+$/u, '')}/functions/v1/apple-auth-lifecycle`,
    {
      method: 'POST',
      headers: {
        apikey: env.supabasePublishableKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'capture', ...capture }),
    },
  );

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(APPLE_AUTH_LIFECYCLE_CAPTURE_FAILED);
  }
  if (!response.ok) throw new Error(APPLE_AUTH_LIFECYCLE_CAPTURE_FAILED);
  const active = parseActiveResult(payload);
  if (active === null) throw new Error(APPLE_AUTH_LIFECYCLE_CAPTURE_FAILED);
  return active;
}

/** Block the exact live Apple lifecycle before local auth is removed. */
export function invalidateAppleAuthLifecycle(
  binding: SupabaseRemoteSessionBinding,
  appleUser: string,
  reason: SupabaseAppleCredentialInvalidReason,
): Promise<{ status: 'blocked' }> {
  return runWithSupabaseAppleCredentialInvalidationPermit(binding, appleUser, reason, async () => {
    const gatedFetch = createSupabaseRemoteRequestGatedFetch();
    const response = await gatedFetch(
      `${env.supabaseUrl.replace(/\/+$/u, '')}/functions/v1/apple-auth-lifecycle`,
      {
        method: 'POST',
        headers: {
          apikey: env.supabasePublishableKey,
          Authorization: `Bearer ${binding.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'credential_invalid', appleUser, reason }),
      },
    );
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error(APPLE_AUTH_LIFECYCLE_INVALIDATION_FAILED);
    }
    if (
      !response.ok ||
      !isRecord(payload) ||
      !Object.hasOwn(payload, 'status') ||
      Object.keys(payload).length !== 1 ||
      payload.status !== 'blocked'
    ) {
      throw new Error(APPLE_AUTH_LIFECYCLE_INVALIDATION_FAILED);
    }
    return Object.freeze({ status: 'blocked' as const });
  });
}
