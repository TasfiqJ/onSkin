export const ACCOUNT_DELETION_PROVIDER_RESPONSE_MAX_BYTES = 16_384;

export const APPLE_MANUAL_REVOCATION_URL = 'https://support.apple.com/en-us/102571';
export const APPLE_MANUAL_REVOCATION_INSTRUCTION =
  'Remove this app from Sign in with Apple in your Apple Account settings.';

export type AppleManualRevocationReason = 'credential_unavailable' | 'automatic_revocation_failed';

export type AppleRevocationFailureCode =
  | 'APPLE_REVOCATION_NOT_CONFIGURED'
  | 'APPLE_REVOCATION_CLIENT_ID_MISMATCH'
  | 'APPLE_TOKEN_EXCHANGE_FAILED'
  | 'APPLE_TOKEN_EXCHANGE_RETURNED_NO_TOKEN'
  | 'APPLE_TOKEN_REVOKE_FAILED'
  | 'APPLE_REVOCATION_FAILED';

export type AppleDeletionOutcome =
  | { status: 'not_linked' }
  | { status: 'revoked' }
  | {
      status: 'manual_revocation_required';
      reason: AppleManualRevocationReason;
      instruction: typeof APPLE_MANUAL_REVOCATION_INSTRUCTION;
      instruction_url: typeof APPLE_MANUAL_REVOCATION_URL;
    };

export type AppleAutomaticRevocationResolution =
  | {
      outcome: Extract<AppleDeletionOutcome, { status: 'revoked' }>;
      warningCode: null;
    }
  | {
      outcome: Extract<AppleDeletionOutcome, { status: 'manual_revocation_required' }>;
      warningCode: AppleRevocationFailureCode;
    };

export type AppleDeletionPlan =
  | { action: 'skip'; outcome: Extract<AppleDeletionOutcome, { status: 'not_linked' }> }
  | {
      action: 'manual_revocation';
      outcome: Extract<AppleDeletionOutcome, { status: 'manual_revocation_required' }>;
    }
  | { action: 'attempt_revocation'; authorizationCode: string };

export type AppleRevocationConfiguration = {
  teamId: string;
  keyId: string;
  clientId: string;
  privateKey: string;
};

export type AppleRevocationToken = {
  token: string;
  tokenTypeHint: 'refresh_token' | 'access_token';
};

type AppleRevocationConfigurationInput = {
  teamId?: string;
  keyId?: string;
  clientId?: string;
  nativeBundleId?: string;
  privateKey?: string;
};

export type RevenueCatDeletionDisposition = 'deleted' | 'unattested';

export type PostHogDeletionDisposition = 'queued' | 'already_absent' | 'unattested';

export type PostHogPersonBulkDeleteResponse = {
  persons_found: number;
  persons_deleted: number;
  events_queued_for_deletion: boolean;
  recordings_queued_for_deletion: boolean;
  deletion_errors?: [];
};

type ProviderRequest = {
  url: string;
  init: RequestInit;
};

type PostHogBulkDeleteRequestOptions = {
  host: string;
  projectId: string;
  personalApiKey: string;
  userId: string;
};

type PostHogDeletionRequirementOptions = {
  appEnvironment?: string;
  publicAppEnvironment?: string;
  mobileKey?: string;
  projectId?: string;
  personalApiKey?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function exactNonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim();
}

export function appleManualRevocationOutcome(
  reason: AppleManualRevocationReason,
): Extract<AppleDeletionOutcome, { status: 'manual_revocation_required' }> {
  return {
    status: 'manual_revocation_required',
    reason,
    instruction: APPLE_MANUAL_REVOCATION_INSTRUCTION,
    instruction_url: APPLE_MANUAL_REVOCATION_URL,
  };
}

export function appleRevocationFailureCode(error: unknown): AppleRevocationFailureCode {
  const message = error instanceof Error ? error.message : String(error);
  const code = message.match(/^[A-Z0-9_]+/)?.[0] ?? '';
  const stableCodes = new Set<AppleRevocationFailureCode>([
    'APPLE_REVOCATION_NOT_CONFIGURED',
    'APPLE_REVOCATION_CLIENT_ID_MISMATCH',
    'APPLE_TOKEN_EXCHANGE_FAILED',
    'APPLE_TOKEN_EXCHANGE_RETURNED_NO_TOKEN',
    'APPLE_TOKEN_REVOKE_FAILED',
  ]);
  return stableCodes.has(code as AppleRevocationFailureCode)
    ? (code as AppleRevocationFailureCode)
    : 'APPLE_REVOCATION_FAILED';
}

export async function resolveAppleAutomaticRevocation(
  attempt: () => Promise<void>,
): Promise<AppleAutomaticRevocationResolution> {
  try {
    await attempt();
    return { outcome: { status: 'revoked' }, warningCode: null };
  } catch (error) {
    return {
      outcome: appleManualRevocationOutcome('automatic_revocation_failed'),
      warningCode: appleRevocationFailureCode(error),
    };
  }
}

export function planAppleDeletion(
  appleLinked: boolean,
  authorizationCode: unknown,
): AppleDeletionPlan {
  if (!appleLinked) return { action: 'skip', outcome: { status: 'not_linked' } };
  if (!exactNonBlank(authorizationCode)) {
    return {
      action: 'manual_revocation',
      outcome: appleManualRevocationOutcome('credential_unavailable'),
    };
  }
  return { action: 'attempt_revocation', authorizationCode };
}

export function requireAppleRevocationConfiguration(
  input: AppleRevocationConfigurationInput,
): AppleRevocationConfiguration {
  if (
    !exactNonBlank(input.teamId) ||
    !exactNonBlank(input.keyId) ||
    !exactNonBlank(input.clientId) ||
    !exactNonBlank(input.nativeBundleId) ||
    typeof input.privateKey !== 'string' ||
    input.privateKey.trim().length === 0
  ) {
    throw new Error('APPLE_REVOCATION_NOT_CONFIGURED');
  }
  if (input.clientId !== input.nativeBundleId) {
    throw new Error('APPLE_REVOCATION_CLIENT_ID_MISMATCH');
  }
  return {
    teamId: input.teamId,
    keyId: input.keyId,
    clientId: input.clientId,
    privateKey: input.privateKey,
  };
}

export function attestAppleTokenExchange(status: number, body: unknown): AppleRevocationToken {
  if (status !== 200) throw new Error('APPLE_TOKEN_EXCHANGE_FAILED');
  if (!isRecord(body)) throw new Error('APPLE_TOKEN_EXCHANGE_RETURNED_NO_TOKEN');

  if (exactNonBlank(body.refresh_token)) {
    return { token: body.refresh_token, tokenTypeHint: 'refresh_token' };
  }
  if (exactNonBlank(body.access_token)) {
    return { token: body.access_token, tokenTypeHint: 'access_token' };
  }
  throw new Error('APPLE_TOKEN_EXCHANGE_RETURNED_NO_TOKEN');
}

export function attestAppleTokenRevocation(
  status: number,
  body: unknown,
  responseBytes: unknown,
): void {
  if (status !== 200 || body !== '' || responseBytes !== 0) {
    throw new Error('APPLE_TOKEN_REVOKE_FAILED');
  }
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function pseudonymousUserId(userId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`onskin:user:${userId}`),
  );
  return `u_${bytesToHex(digest).slice(0, 32)}`;
}

export function buildRevenueCatDeletionRequest(
  userId: string,
  secretApiKey: string,
): ProviderRequest {
  return {
    url: `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    init: {
      method: 'DELETE',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${secretApiKey}`,
      },
    },
  };
}

export function revenueCatDeletionDisposition(
  status: number,
  body: unknown,
  expectedUserId: string,
): RevenueCatDeletionDisposition {
  if (
    status !== 200 ||
    !isRecord(body) ||
    body.app_user_id !== expectedUserId ||
    body.deleted !== true
  ) {
    return 'unattested';
  }
  return 'deleted';
}

export function normalizePostHogApiHost(host: string): string {
  let parsed: URL;
  try {
    if (host !== host.trim()) throw new Error('invalid whitespace');
    parsed = new URL(host);
  } catch {
    throw new Error('POSTHOG_DELETION_NOT_CONFIGURED');
  }

  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== 'eu.posthog.com' ||
    parsed.port !== '' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.pathname !== '/' ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    throw new Error('POSTHOG_DELETION_NOT_CONFIGURED');
  }

  return parsed.origin;
}

export function postHogDeletionRequiredForEnvironment(
  options: PostHogDeletionRequirementOptions,
): boolean {
  if ([options.mobileKey, options.projectId, options.personalApiKey].some(exactNonBlank)) {
    return true;
  }

  const environments = [options.appEnvironment, options.publicAppEnvironment]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim().toLowerCase());
  // An explicit development environment may omit PostHog entirely. Staging,
  // production, and invalid non-development labels fail closed so a missing
  // Edge secret set cannot silently skip erasure for an analytics-enabled app.
  return environments.some((value) => value !== 'development');
}

export async function buildPostHogBulkDeleteRequest(
  options: PostHogBulkDeleteRequestOptions,
): Promise<ProviderRequest> {
  const host = normalizePostHogApiHost(options.host);
  const distinctIds = [await pseudonymousUserId(options.userId), options.userId];
  return {
    url: `${host}/api/projects/${encodeURIComponent(options.projectId)}/persons/bulk_delete/`,
    init: {
      method: 'POST',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${options.personalApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        distinct_ids: distinctIds,
        delete_events: true,
        delete_recordings: true,
      }),
    },
  };
}

export function postHogDeletionDisposition(
  status: number,
  body: unknown,
): PostHogDeletionDisposition {
  if (status !== 202 || !isRecord(body)) return 'unattested';
  if (
    !isNonNegativeSafeInteger(body.persons_found) ||
    !isNonNegativeSafeInteger(body.persons_deleted) ||
    typeof body.events_queued_for_deletion !== 'boolean' ||
    typeof body.recordings_queued_for_deletion !== 'boolean' ||
    ('deletion_errors' in body &&
      (!Array.isArray(body.deletion_errors) || body.deletion_errors.length !== 0))
  ) {
    return 'unattested';
  }

  if (body.persons_found === 0) {
    if (body.persons_deleted !== 0) return 'unattested';
    // A zero-person response is idempotent absence only when PostHog also
    // attests that no asynchronous event or recording deletion was queued.
    // The provider can report zero matched person rows while still queuing
    // deletion work, and account deletion must not finish ahead of that work.
    if (
      body.events_queued_for_deletion === false &&
      body.recordings_queued_for_deletion === false
    ) {
      return 'already_absent';
    }
    if (body.events_queued_for_deletion === true && body.recordings_queued_for_deletion === true) {
      return 'queued';
    }
    return 'unattested';
  }
  if (
    body.persons_deleted !== body.persons_found ||
    body.events_queued_for_deletion !== true ||
    body.recordings_queued_for_deletion !== true
  ) {
    return 'unattested';
  }
  return 'queued';
}
