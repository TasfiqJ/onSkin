import type { ConsentType } from '@onskin/types';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { isSupabaseConfigured } from '@/lib/env';
import { parseSupabaseAccessTokenClaims } from '@/lib/supabase/authRefreshProtection';
import {
  readPersistedSupabaseSessionCandidate,
  supabase,
} from '@/lib/supabase/client';

import {
  assertConsentCopyIntegrity,
  isHealthDependentConsentType,
  type HealthDependentConsentType,
} from './dependentConsentContract';

export const CONSENT_WITHDRAWAL_AUTH_UNAVAILABLE = 'CONSENT_WITHDRAWAL_AUTH_UNAVAILABLE';
export const CONSENT_WITHDRAWAL_OWNER_CHANGED = 'CONSENT_WITHDRAWAL_OWNER_CHANGED';
export const HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_PENDING =
  'HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_PENDING';
export const HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_ATTESTATION_INVALID =
  'HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_ATTESTATION_INVALID';

export type HealthDependentWithdrawalAttestation = Readonly<{
  operationId: string;
  consentType: WithdrawableConsentType;
  processingEpoch: number;
  consentGeneration: number;
  replayed: boolean;
}>;

export type WithdrawableConsentType =
  | 'photo_capture'
  | 'photo_cloud_backup'
  | 'photo_trend_insights'
  | 'ask_onskin'
  | 'community_participation'
  | 'data_sharing';

export async function withdrawConsent(params: {
  type: WithdrawableConsentType & ConsentType;
  version: string;
  consentText: string;
  /** Owner who initiated the user-visible revocation before any local deletion. */
  expectedUserId: string;
  /** Required CAS fields for a health-dependent withdrawal. */
  expectedProcessingEpoch?: number;
  expectedConsentGeneration?: number;
  idempotencyKey?: string;
}): Promise<HealthDependentWithdrawalAttestation> {
  if (!isSupabaseConfigured) throw new Error('CONSENT_BACKEND_UNAVAILABLE');
  if (
    !params.expectedUserId ||
    params.expectedUserId !== params.expectedUserId.trim() ||
    params.expectedUserId.length > 128
  ) {
    throw new Error(CONSENT_WITHDRAWAL_AUTH_UNAVAILABLE);
  }

  if (!isHealthDependentConsentType(params.type)) {
    throw new Error('HEALTH_DEPENDENT_WITHDRAWAL_CONTRACT_INVALID');
  }
  const dependentType = params.type;
  const canonical = await assertConsentCopyIntegrity(dependentType, 'withdrawal');
  if (
    params.version !== canonical.version ||
    params.consentText !== canonical.text ||
    !Number.isSafeInteger(params.expectedProcessingEpoch) ||
    (params.expectedProcessingEpoch ?? 0) < 1 ||
    !Number.isSafeInteger(params.expectedConsentGeneration) ||
    (params.expectedConsentGeneration ?? -1) < 0 ||
    !params.idempotencyKey ||
    !/^[a-f0-9]{64}$/u.test(params.idempotencyKey)
  ) {
    throw new Error('HEALTH_DEPENDENT_WITHDRAWAL_CONTRACT_INVALID');
  }

  return runAccountGenerationOperation(async (lease) => {
    const controller = new AbortController();
    let rejectInterrupted!: (reason?: unknown) => void;
    const interrupted = new Promise<never>((_resolve, reject) => {
      rejectInterrupted = reject;
    });
    const abortForAccountChange = () => {
      controller.abort();
      try {
        lease.assertCurrent();
        rejectInterrupted(new Error(CONSENT_WITHDRAWAL_AUTH_UNAVAILABLE));
      } catch (error) {
        rejectInterrupted(error);
      }
    };
    lease.signal.addEventListener('abort', abortForAccountChange, { once: true });

    const request = (async () => {
      let candidate: Awaited<ReturnType<typeof readPersistedSupabaseSessionCandidate>>;
      try {
        candidate = await readPersistedSupabaseSessionCandidate();
      } catch {
        throw new Error(CONSENT_WITHDRAWAL_AUTH_UNAVAILABLE);
      }
      lease.assertCurrent();
      const claims = parseSupabaseAccessTokenClaims(candidate?.access_token);
      if (
        !candidate ||
        !claims ||
        candidate.user.id !== claims.subject ||
        claims.subject !== params.expectedUserId
      ) {
        throw new Error(CONSENT_WITHDRAWAL_OWNER_CHANGED);
      }

      let verified: Awaited<ReturnType<typeof supabase.auth.getUser>>;
      try {
        verified = await supabase.auth.getUser(candidate.access_token);
      } catch {
        throw new Error(CONSENT_WITHDRAWAL_AUTH_UNAVAILABLE);
      }
      lease.assertCurrent();
      if (
        verified.error ||
        verified.data.user?.id !== claims.subject ||
        verified.data.user.id !== params.expectedUserId
      ) {
        throw new Error(CONSENT_WITHDRAWAL_OWNER_CHANGED);
      }

      lease.assertCurrent();
      const { data, error } = await supabase.functions.invoke('consent-withdrawal', {
        method: 'POST',
        body: {
          consentType: params.type,
          version: params.version,
          consentTextHash: canonical.sha256,
          idempotencyKey: params.idempotencyKey,
          expectedProcessingEpoch: params.expectedProcessingEpoch,
          expectedConsentGeneration: params.expectedConsentGeneration,
        },
        headers: { Authorization: `Bearer ${candidate.access_token}` },
        signal: controller.signal,
      });
      lease.assertCurrent();
      if (error) throw error;
      if (
        isExactPendingWithdrawalResponse(
          data,
          dependentType,
          params.expectedProcessingEpoch!,
          params.expectedConsentGeneration!,
        )
      ) {
        throw new Error(HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_PENDING);
      }
      if (
        !isExactTerminalWithdrawalResponse(
          data,
          dependentType,
          params.expectedProcessingEpoch!,
          params.expectedConsentGeneration!,
        )
      ) {
        throw new Error(HEALTH_DEPENDENT_CONSENT_WITHDRAWAL_ATTESTATION_INVALID);
      }
      return Object.freeze({
        operationId: data.operation_id,
        consentType: dependentType,
        processingEpoch: data.processing_epoch,
        consentGeneration: data.consent_generation,
        replayed: data.replayed,
      });
    })();

    try {
      return await Promise.race([request, interrupted]);
    } finally {
      lease.signal.removeEventListener('abort', abortForAccountChange);
    }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expected.length &&
    expected.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

const PUBLIC_OPERATION_KEYS = [
  'operation_id',
  'consent_type',
  'state',
  'processing_epoch',
  'consent_generation',
] as const;

function isExactPendingWithdrawalResponse(
  value: unknown,
  type: HealthDependentConsentType,
  expectedProcessingEpoch: number,
  expectedConsentGeneration: number,
): boolean {
  if (!isRecord(value)) return false;
  const operationPendingKeys = [
    'withdrawn',
    'pending',
    'retry_required',
    ...PUBLIC_OPERATION_KEYS,
    'stage',
    'error',
  ] as const;
  if (exactKeys(value, operationPendingKeys)) {
    return (
      value.withdrawn === false &&
      value.pending === true &&
      value.retry_required === true &&
      typeof value.operation_id === 'string' &&
      UUID_PATTERN.test(value.operation_id) &&
      value.consent_type === type &&
      value.state === 'withdrawing' &&
      value.processing_epoch === expectedProcessingEpoch &&
      value.consent_generation === expectedConsentGeneration + 1 &&
      (value.stage === 'cleanup' || value.stage === 'completion') &&
      value.error === 'CONSENT_WITHDRAWAL_RETRY_REQUIRED'
    );
  }
  return (
    exactKeys(value, [
      'withdrawn',
      'pending',
      'retry_required',
      'state_unknown',
      'consent_type',
      'stage',
      'error',
    ]) &&
    value.withdrawn === false &&
    value.pending === true &&
    value.retry_required === true &&
    value.state_unknown === true &&
    value.consent_type === type &&
    value.stage === 'begin' &&
    value.error === 'CONSENT_WITHDRAWAL_BEGIN_OUTCOME_UNKNOWN'
  );
}

const CLEANUP_KEYS: Readonly<Record<HealthDependentConsentType, readonly string[]>> = {
  photo_capture: [
    'remote_photo_rows_deleted',
    'storage_objects_removed',
    'skipped_storage_paths',
    'local_device_cleanup_claimed',
    'photo_trend_deleted',
  ],
  photo_cloud_backup: [
    'photo_rows_relocalized',
    'storage_objects_removed',
    'skipped_storage_paths',
  ],
  photo_trend_insights: ['photo_trend_deleted'],
  ask_onskin: [
    'ask_safety_audit_deleted',
    'ask_turn_audit_deleted',
    'ask_sessions_deleted',
    'more_pending',
  ],
  community_participation: [
    'community_reports_deleted',
    'community_reactions_deleted',
    'community_questions_deleted',
    'community_blocks_deleted',
  ],
  data_sharing: [
    'order_attributions_detached',
    'commerce_click_events_deleted',
    'more_pending',
  ],
};

function isExactCleanup(value: unknown, type: HealthDependentConsentType): boolean {
  if (!isRecord(value) || !exactKeys(value, CLEANUP_KEYS[type])) return false;
  for (const [key, item] of Object.entries(value)) {
    if (key === 'local_device_cleanup_claimed') {
      if (item !== false) return false;
    } else if (key === 'skipped_storage_paths') {
      if (item !== 0) return false;
    } else if (key === 'more_pending') {
      if (typeof item !== 'boolean') return false;
    } else if (!Number.isSafeInteger(item) || (item as number) < 0) {
      return false;
    }
  }
  return true;
}

function isExactTerminalWithdrawalResponse(
  value: unknown,
  type: HealthDependentConsentType,
  expectedProcessingEpoch: number,
  expectedConsentGeneration: number,
): value is Record<string, unknown> & {
  operation_id: string;
  processing_epoch: number;
  consent_generation: number;
  replayed: boolean;
} {
  if (!isRecord(value) || typeof value.replayed !== 'boolean') return false;
  const required = [
    'withdrawn',
    'pending',
    'retry_required',
    ...PUBLIC_OPERATION_KEYS,
    ...(value.replayed ? [] : ['cleanup']),
    'replayed',
  ] as const;
  return (
    exactKeys(value, required) &&
    value.withdrawn === true &&
    value.pending === false &&
    value.retry_required === false &&
    typeof value.operation_id === 'string' &&
    UUID_PATTERN.test(value.operation_id) &&
    value.consent_type === type &&
    value.state === 'withdrawn' &&
    value.processing_epoch === expectedProcessingEpoch &&
    value.consent_generation === expectedConsentGeneration + 1 &&
    (value.replayed || isExactCleanup(value.cleanup, type))
  );
}
