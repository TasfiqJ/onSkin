import * as Crypto from 'expo-crypto';

import { HEALTH_DATA_CONSENT, HEALTH_DATA_WITHDRAWAL } from '@/features/onboarding/consentCopy';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { isSupabaseConfigured } from '@/lib/env';
import { readPersistedSupabaseSessionCandidate, supabase } from '@/lib/supabase/client';

export const HEALTH_DATA_LIFECYCLE_BACKEND_UNAVAILABLE =
  'HEALTH_DATA_LIFECYCLE_BACKEND_UNAVAILABLE';
export const HEALTH_DATA_LIFECYCLE_AUTH_UNAVAILABLE =
  'HEALTH_DATA_LIFECYCLE_AUTH_UNAVAILABLE';
export const HEALTH_DATA_LIFECYCLE_RESPONSE_INVALID =
  'HEALTH_DATA_LIFECYCLE_RESPONSE_INVALID';
export const HEALTH_DATA_LIFECYCLE_REQUEST_TIMEOUT_MS = 15_000;
export const CURRENT_HEALTH_DATA_CONSENT_TEXT_HASH =
  '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd';
export const CURRENT_HEALTH_DATA_DECLINE_TEXT_HASH =
  '6a34a4d3b8086a0ee86951261f612c502bd4376bc8378cf22533b49817cdedea';
export const CURRENT_HEALTH_DATA_WITHDRAWAL_TEXT_HASH =
  '5200ef21982670cf73539d8a7d3e0f9c2219b40ee8d63be0a83d3e10043ba37f';

export type RemoteHealthDataState = 'unconsented' | 'active' | 'withdrawing' | 'withdrawn';

export type RemoteHealthDataLifecycle = Readonly<{
  ownerUserId: string;
  state: RemoteHealthDataState;
  processingEpoch: number;
  operationId: string | null;
  operationState: string | null;
  resultCode: string | null;
  serverVerifiedAt: string;
  withdrawn: boolean | null;
  retryRequired: boolean | null;
  consentVersion: string | null;
  consentTextHash: string | null;
}>;

type InvokeBody =
  | { action: 'status' | 'retry'; consentType: 'health_data_collection' }
  | {
      action: 'withdraw';
      consentType: 'health_data_collection';
      expectedProcessingEpoch: number;
      idempotencyKey: string;
      version: string;
      consentTextHash: string;
    }
  | {
      action: 'reconsent' | 'decline';
      consentType: 'health_data_collection';
      expectedProcessingEpoch: number;
      version: string;
      consentTextHash: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedNullableString(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' && value.length >= 1 && value.length <= 256)
  );
}

function validConsentVersion(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' &&
      value === value.trim() &&
      value.length >= 1 &&
      value.length <= 128)
  );
}

function validConsentTextHash(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && /^[a-f0-9]{64}$/.test(value));
}

function parseLifecycleResponse(data: unknown, ownerUserId: string): RemoteHealthDataLifecycle {
  if (!isRecord(data)) throw new Error(HEALTH_DATA_LIFECYCLE_RESPONSE_INVALID);
  const required = [
    'state',
    'processing_epoch',
    'operation_id',
    'operation_state',
    'result_code',
    'server_verified_at',
    'consent_version',
    'consent_text_hash',
  ];
  const optional = new Set(['withdrawn', 'retry_required', 'reconsented', 'declined', 'error']);
  const keys = Object.keys(data);
  if (
    required.some((key) => !Object.prototype.hasOwnProperty.call(data, key)) ||
    keys.some((key) => !required.includes(key) && !optional.has(key))
  ) {
    throw new Error(HEALTH_DATA_LIFECYCLE_RESPONSE_INVALID);
  }

  const validStates = new Set<RemoteHealthDataState>([
    'unconsented',
    'active',
    'withdrawing',
    'withdrawn',
  ]);
  if (
    typeof data.state !== 'string' ||
    !validStates.has(data.state as RemoteHealthDataState) ||
    !Number.isSafeInteger(data.processing_epoch) ||
    (data.processing_epoch as number) < 0 ||
    !boundedNullableString(data.operation_id) ||
    !boundedNullableString(data.operation_state) ||
    !boundedNullableString(data.result_code) ||
    !validConsentVersion(data.consent_version) ||
    !validConsentTextHash(data.consent_text_hash) ||
    typeof data.server_verified_at !== 'string' ||
    Number.isNaN(Date.parse(data.server_verified_at)) ||
    !(
      data.withdrawn === undefined ||
      data.withdrawn === null ||
      typeof data.withdrawn === 'boolean'
    ) ||
    !(
      data.retry_required === undefined ||
      data.retry_required === null ||
      typeof data.retry_required === 'boolean'
    )
  ) {
    throw new Error(HEALTH_DATA_LIFECYCLE_RESPONSE_INVALID);
  }

  const active = data.state === 'active';
  if (
    (data.state === 'unconsented' && data.processing_epoch !== 0) ||
    (data.state !== 'unconsented' && (data.processing_epoch as number) < 1) ||
    (active && (data.consent_version === null || data.consent_text_hash === null)) ||
    (!active && (data.consent_version !== null || data.consent_text_hash !== null))
  ) {
    throw new Error(HEALTH_DATA_LIFECYCLE_RESPONSE_INVALID);
  }

  return Object.freeze({
    ownerUserId,
    state: data.state as RemoteHealthDataState,
    processingEpoch: data.processing_epoch as number,
    operationId: data.operation_id,
    operationState: data.operation_state,
    resultCode: data.result_code,
    serverVerifiedAt: data.server_verified_at,
    withdrawn: typeof data.withdrawn === 'boolean' ? data.withdrawn : null,
    retryRequired: typeof data.retry_required === 'boolean' ? data.retry_required : null,
    consentVersion: data.consent_version,
    consentTextHash: data.consent_text_hash,
  });
}

function assertExpectedOwner(ownerUserId: string): void {
  if (!ownerUserId || ownerUserId !== ownerUserId.trim() || ownerUserId.length > 128) {
    throw new Error(HEALTH_DATA_LIFECYCLE_AUTH_UNAVAILABLE);
  }
}

async function invoke(
  body: InvokeBody,
  expectedOwnerUserId: string,
): Promise<RemoteHealthDataLifecycle> {
  if (!isSupabaseConfigured) {
    throw new Error(HEALTH_DATA_LIFECYCLE_BACKEND_UNAVAILABLE);
  }
  assertExpectedOwner(expectedOwnerUserId);
  return runAccountGenerationOperation(async (lease) => {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let rejectInterrupted!: (reason?: unknown) => void;
    const interrupted = new Promise<never>((_resolve, reject) => {
      rejectInterrupted = reject;
    });
    const abortForGenerationChange = () => {
      controller.abort();
      try {
        lease.assertCurrent();
        rejectInterrupted(new Error(HEALTH_DATA_LIFECYCLE_BACKEND_UNAVAILABLE));
      } catch (error) {
        rejectInterrupted(error);
      }
    };
    lease.signal.addEventListener('abort', abortForGenerationChange, { once: true });
    timeout = setTimeout(() => {
      controller.abort();
      rejectInterrupted(new Error(HEALTH_DATA_LIFECYCLE_BACKEND_UNAVAILABLE));
    }, HEALTH_DATA_LIFECYCLE_REQUEST_TIMEOUT_MS);

    const request = (async () => {
      const candidate = await readPersistedSupabaseSessionCandidate();
      lease.assertCurrent();
      if (controller.signal.aborted) {
        throw new Error(HEALTH_DATA_LIFECYCLE_BACKEND_UNAVAILABLE);
      }
      if (
        !candidate?.access_token ||
        !candidate.user?.id ||
        candidate.user.id !== expectedOwnerUserId
      ) {
        throw new Error(HEALTH_DATA_LIFECYCLE_AUTH_UNAVAILABLE);
      }
      const verified = await supabase.auth.getUser(candidate.access_token);
      lease.assertCurrent();
      if (controller.signal.aborted) {
        throw new Error(HEALTH_DATA_LIFECYCLE_BACKEND_UNAVAILABLE);
      }
      if (
        verified.error ||
        verified.data.user?.id !== candidate.user.id ||
        verified.data.user.id !== expectedOwnerUserId
      ) {
        throw new Error(HEALTH_DATA_LIFECYCLE_AUTH_UNAVAILABLE);
      }

      // The exact expected subject is proven immediately before the mutating
      // request. A stale A continuation can therefore never borrow B's newly
      // persisted session and mutate B's lifecycle.
      lease.assertCurrent();
      if (controller.signal.aborted) {
        throw new Error(HEALTH_DATA_LIFECYCLE_BACKEND_UNAVAILABLE);
      }
      const response = await supabase.functions.invoke('consent-withdrawal', {
        method: 'POST',
        body,
        headers: { Authorization: `Bearer ${candidate.access_token}` },
        signal: controller.signal,
      });
      lease.assertCurrent();
      if (controller.signal.aborted || response.error) {
        throw new Error(HEALTH_DATA_LIFECYCLE_BACKEND_UNAVAILABLE);
      }
      return parseLifecycleResponse(response.data, expectedOwnerUserId);
    })();

    try {
      return await Promise.race([request, interrupted]);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      lease.signal.removeEventListener('abort', abortForGenerationChange);
    }
  });
}

export async function createHealthWithdrawalIdempotencyKey(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function currentHealthDataConsentTextHash(): Promise<string> {
  return Promise.resolve(CURRENT_HEALTH_DATA_CONSENT_TEXT_HASH);
}

export async function remoteHealthDataConsentMatchesCurrentContract(
  remote: RemoteHealthDataLifecycle,
): Promise<boolean> {
  return (
    remote.state === 'active' &&
    remote.consentVersion === HEALTH_DATA_CONSENT.version &&
    remote.consentTextHash === CURRENT_HEALTH_DATA_CONSENT_TEXT_HASH
  );
}

export function fetchRemoteHealthDataLifecycle(
  ownerUserId: string,
): Promise<RemoteHealthDataLifecycle> {
  return invoke({ action: 'status', consentType: 'health_data_collection' }, ownerUserId);
}

export async function beginRemoteHealthDataWithdrawal(params: {
  ownerUserId: string;
  expectedProcessingEpoch: number;
  idempotencyKey: string;
}): Promise<RemoteHealthDataLifecycle> {
  return invoke(
    {
      action: 'withdraw',
      consentType: 'health_data_collection',
      expectedProcessingEpoch: params.expectedProcessingEpoch,
      idempotencyKey: params.idempotencyKey,
      version: HEALTH_DATA_WITHDRAWAL.version,
      consentTextHash: CURRENT_HEALTH_DATA_WITHDRAWAL_TEXT_HASH,
    },
    params.ownerUserId,
  );
}

export function retryRemoteHealthDataWithdrawal(
  ownerUserId: string,
): Promise<RemoteHealthDataLifecycle> {
  return invoke({ action: 'retry', consentType: 'health_data_collection' }, ownerUserId);
}

export async function grantRemoteHealthDataConsent(
  ownerUserId: string,
  expectedProcessingEpoch: number,
): Promise<RemoteHealthDataLifecycle> {
  return invoke(
    {
      action: 'reconsent',
      consentType: 'health_data_collection',
      expectedProcessingEpoch,
      version: HEALTH_DATA_CONSENT.version,
      consentTextHash: CURRENT_HEALTH_DATA_CONSENT_TEXT_HASH,
    },
    ownerUserId,
  );
}

export async function declineRemoteInitialHealthDataConsent(
  ownerUserId: string,
): Promise<RemoteHealthDataLifecycle> {
  return invoke(
    {
      action: 'decline',
      consentType: 'health_data_collection',
      expectedProcessingEpoch: 0,
      version: HEALTH_DATA_CONSENT.version,
      consentTextHash: CURRENT_HEALTH_DATA_DECLINE_TEXT_HASH,
    },
    ownerUserId,
  );
}

export const healthLifecycleResponseParserForTests = parseLifecycleResponse;
