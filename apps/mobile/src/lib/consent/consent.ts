import type { ConsentType } from '@onskin/types';
import * as Crypto from 'expo-crypto';

import { env, isSupabaseConfigured } from '@/lib/env';

import {
  assertConsentCopyIntegrity,
  assertHealthDependentConsentCopyReleaseAllowed,
  consentCopyFor,
  HEALTH_DEPENDENT_CONSENT_TYPES,
  isExactHealthDependentConsentCopy,
  isHealthDependentConsentType,
  type HealthDependentConsentLifecycleState,
  type HealthDependentConsentType,
} from './dependentConsentContract';
import { runCurrentHealthDataOperation } from './healthDataWriteAdmission';

import { getPersistedSupabaseUser, supabase } from '../supabase/client';

const HEALTH_DEPENDENT_TYPE_SET = new Set<ConsentType>(HEALTH_DEPENDENT_CONSENT_TYPES);

export type LatestConsentReceipt = Readonly<{
  id: string;
  consentType: string;
  granted: boolean;
  grantedAt: string;
  version: string;
  consentTextHash: string;
}>;

export type HealthDependentConsentStatus = Readonly<{
  consentType: HealthDependentConsentType;
  state: HealthDependentConsentLifecycleState;
  generation: number;
  healthEpoch: number;
  version: string | null;
  consentTextHash: string | null;
}>;

type UntypedRpcResult = Promise<{ data: unknown; error: unknown }>;
const invokeUntypedRpc = supabase.rpc as unknown as (
  name: string,
  args: Record<string, unknown>,
) => { abortSignal: (signal: AbortSignal) => UntypedRpcResult };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expected.length &&
    expected.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function oneRpcRow(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    return value.length === 1 && isRecord(value[0]) ? value[0] : null;
  }
  return isRecord(value) ? value : null;
}

function safeGeneration(value: unknown): number | null {
  const numeric = typeof value === 'string' && /^\d+$/u.test(value) ? Number(value) : value;
  return typeof numeric === 'number' && Number.isSafeInteger(numeric) && numeric >= 0
    ? numeric
    : null;
}

function parseDependentConsentStatus(
  value: unknown,
  expectedType: HealthDependentConsentType,
  expectedHealthEpoch?: number,
): HealthDependentConsentStatus {
  const row = oneRpcRow(value);
  if (
    !row ||
    !exactKeys(row, [
      'consent_type',
      'state',
      'generation',
      'health_epoch',
      'version',
      'consent_text_hash',
    ]) ||
    row.consent_type !== expectedType
  ) {
    throw new Error('HEALTH_DEPENDENT_CONSENT_STATUS_INVALID');
  }
  const state = row.state;
  if (
    state !== 'unconsented' &&
    state !== 'active' &&
    state !== 'withdrawing' &&
    state !== 'withdrawn'
  ) {
    throw new Error('HEALTH_DEPENDENT_CONSENT_STATUS_INVALID');
  }
  const generation = safeGeneration(row.generation);
  const healthEpoch = safeGeneration(row.health_epoch);
  if (
    generation === null ||
    healthEpoch === null ||
    (expectedHealthEpoch !== undefined && healthEpoch !== expectedHealthEpoch)
  ) {
    throw new Error('HEALTH_DEPENDENT_CONSENT_STATUS_INVALID');
  }

  const version = typeof row.version === 'string' ? row.version : null;
  const consentTextHash =
    typeof row.consent_text_hash === 'string' ? row.consent_text_hash : null;
  if (state === 'active') {
    if (
      generation < 1 ||
      healthEpoch < 1 ||
      !isExactHealthDependentConsentCopy({
        type: expectedType,
        state: 'grant',
        version,
        consentTextHash,
      })
    ) {
      throw new Error('HEALTH_DEPENDENT_CONSENT_STATUS_INVALID');
    }
  } else if (state === 'withdrawing' || state === 'withdrawn') {
    if (
      generation < 1 ||
      !isExactHealthDependentConsentCopy({
        type: expectedType,
        state: 'withdrawal',
        version,
        consentTextHash,
      })
    ) {
      throw new Error('HEALTH_DEPENDENT_CONSENT_STATUS_INVALID');
    }
  } else if (version !== null || consentTextHash !== null) {
    throw new Error('HEALTH_DEPENDENT_CONSENT_STATUS_INVALID');
  }

  return Object.freeze({
    consentType: expectedType,
    state,
    generation,
    healthEpoch,
    version,
    consentTextHash,
  });
}

/** Fetch the authenticated owner's exact dependent lifecycle receipt. */
export function getHealthDependentConsentStatus(
  type: HealthDependentConsentType,
): Promise<HealthDependentConsentStatus> {
  if (!isSupabaseConfigured) {
    return Promise.reject(new Error('CONSENT_BACKEND_UNAVAILABLE'));
  }
  return runCurrentHealthDataOperation(async (lease) => {
    lease.assertCurrent();
    const { data: userData } = await getPersistedSupabaseUser();
    lease.assertCurrent();
    if (userData.user?.id !== lease.ownerUserId) throw new Error('CONSENT_OWNER_CHANGED');
    lease.assertCurrent();
    const { data, error } = await invokeUntypedRpc('get_health_dependent_consent_status', {
      p_consent_type: type,
    })
      .abortSignal(lease.signal);
    lease.assertCurrent();
    if (error) throw error;
    return parseDependentConsentStatus(data, type, lease.epoch);
  });
}

// Records an unbundled consent into the immutable ledger. Health-dependent
// grants use an exact-epoch + exact-generation CAS RPC; generic choices remain
// append-only ledger inserts. Revocation is always a NEW row.
export async function recordConsent(params: {
  type: ConsentType;
  granted: boolean;
  version: string;
  consentText: string;
  /** Required for a health-dependent grant CAS. */
  expectedGeneration?: number;
  /** Required for a health-dependent grant CAS; strong unique user-action key. */
  idempotencyKey?: string;
  /** Optional in-memory owner fence for a larger destructive workflow. */
  expectedUserId?: string;
}): Promise<HealthDependentConsentStatus | void> {
  if (!params.granted && HEALTH_DEPENDENT_TYPE_SET.has(params.type)) {
    throw new Error('HEALTH_DEPENDENT_WITHDRAWAL_RPC_REQUIRED');
  }
  if (!isSupabaseConfigured) throw new Error('CONSENT_BACKEND_UNAVAILABLE');

  if (params.granted && HEALTH_DEPENDENT_TYPE_SET.has(params.type)) {
    if (!isHealthDependentConsentType(params.type)) {
      throw new Error('HEALTH_DEPENDENT_CONSENT_TYPE_INVALID');
    }
    const dependentType = params.type;
    assertHealthDependentConsentCopyReleaseAllowed(
      dependentType,
      'grant',
      env.appEnvironment,
    );
    const canonical = await assertConsentCopyIntegrity(dependentType, 'grant');
    if (params.version !== canonical.version || params.consentText !== canonical.text) {
      throw new Error('HEALTH_DEPENDENT_CONSENT_COPY_INVALID');
    }
    if (
      !Number.isSafeInteger(params.expectedGeneration) ||
      (params.expectedGeneration ?? -1) < 0 ||
      !params.idempotencyKey ||
      !/^[a-f0-9]{64}$/u.test(params.idempotencyKey)
    ) {
      throw new Error('HEALTH_DEPENDENT_CONSENT_CAS_INVALID');
    }

    return runCurrentHealthDataOperation(async (lease) => {
      if (
        params.expectedUserId !== undefined &&
        params.expectedUserId !== lease.ownerUserId
      ) {
        throw new Error('CONSENT_OWNER_CHANGED');
      }
      lease.assertCurrent();
      const { data: userData } = await getPersistedSupabaseUser();
      lease.assertCurrent();
      if (userData.user?.id !== lease.ownerUserId) throw new Error('CONSENT_OWNER_CHANGED');

      lease.assertCurrent();
      const { data, error } = await invokeUntypedRpc('record_health_dependent_consent', {
          p_expected_epoch: lease.epoch,
          p_expected_generation: params.expectedGeneration!,
          p_idempotency_key: params.idempotencyKey,
          p_consent_type: dependentType,
          p_version: canonical.version,
          p_consent_text_hash: canonical.sha256,
        })
        .abortSignal(lease.signal);
      lease.assertCurrent();
      if (error) throw error;
      const status = parseDependentConsentStatus(data, dependentType, lease.epoch);
      if (
        status.state !== 'active' ||
        status.generation !== params.expectedGeneration! + 1
      ) {
        throw new Error('HEALTH_DEPENDENT_CONSENT_STATUS_INVALID');
      }
      return status;
    });
  }

  const consentTextHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    params.consentText,
  );
  const { data: userData } = await getPersistedSupabaseUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('recordConsent requires an authenticated session');
  if (params.expectedUserId !== undefined && userId !== params.expectedUserId) {
    throw new Error('CONSENT_OWNER_CHANGED');
  }

  const { error } = await supabase.from('consents').insert({
    user_id: userId,
    consent_type: params.type,
    granted: params.granted,
    version: params.version,
    consent_text_hash: consentTextHash,
  });
  if (error) throw error;
}

/** Latest deterministic receipt per type (a revocation wins timestamp ties). */
export async function getLatestConsents(): Promise<Record<string, LatestConsentReceipt>> {
  if (!isSupabaseConfigured) return {};

  const { data, error } = await supabase
    .from('consents')
    .select('id, consent_type, granted, granted_at, version, consent_text_hash')
    .order('granted_at', { ascending: false })
    .order('granted', { ascending: true })
    .order('id', { ascending: false });
  if (error) throw error;
  const latest: Record<string, LatestConsentReceipt> = {};
  for (const row of data ?? []) {
    if (
      typeof row.id !== 'string' ||
      typeof row.consent_type !== 'string' ||
      typeof row.granted !== 'boolean' ||
      typeof row.granted_at !== 'string' ||
      typeof row.version !== 'string' ||
      typeof row.consent_text_hash !== 'string'
    ) {
      throw new Error('CONSENT_RECEIPT_INVALID');
    }
    if (!(row.consent_type in latest)) {
      latest[row.consent_type] = Object.freeze({
        id: row.id,
        consentType: row.consent_type,
        granted: row.granted,
        grantedAt: row.granted_at,
        version: row.version,
        consentTextHash: row.consent_text_hash,
      });
    }
  }
  return latest;
}

export function exactDependentCopyForTests(type: HealthDependentConsentType) {
  return consentCopyFor(type, 'grant');
}
