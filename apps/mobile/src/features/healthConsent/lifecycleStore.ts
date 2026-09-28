import { getPrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';

export const HEALTH_DATA_LIFECYCLE_KEY = 'layerwell.healthDataLifecycle.v1';
const SCHEMA_VERSION = 3 as const;

export const HEALTH_DATA_LIFECYCLE_INVALID = 'HEALTH_DATA_LIFECYCLE_INVALID';
export const HEALTH_DATA_LIFECYCLE_OWNER_MISMATCH = 'HEALTH_DATA_LIFECYCLE_OWNER_MISMATCH';
export const HEALTH_DATA_LIFECYCLE_TRANSITION_STALE = 'HEALTH_DATA_LIFECYCLE_TRANSITION_STALE';

export type HealthDataLifecycleState =
  | 'unconsented'
  | 'active'
  | 'withdrawing'
  | 'withdrawn'
  | 'verification_required';

export type HealthDataVerificationReason =
  | 'status_unavailable'
  | 'consent_contract_mismatch'
  | 'processing_epoch_changed'
  | 'authoritative_unconsented'
  | 'local_consent_unavailable'
  | 'withdrawal_status_unavailable'
  | 'owner_unavailable';

export type HealthDataVerificationResumeState = Exclude<
  HealthDataLifecycleState,
  'verification_required'
>;

export type HealthDataLifecycleRecord = Readonly<{
  schemaVersion: typeof SCHEMA_VERSION;
  ownerUserId: string;
  state: HealthDataLifecycleState;
  processingEpoch: number;
  operationId: string | null;
  idempotencyKey: string | null;
  localCleanupComplete: boolean;
  activationRoutePending: boolean;
  verificationReason: HealthDataVerificationReason | null;
  verificationResumeState: HealthDataVerificationResumeState | null;
  serverVerifiedAt: string | null;
  updatedAt: string;
}>;

type Listener = (record: HealthDataLifecycleRecord | null) => void;
const listeners = new Set<Listener>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validIso(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function validOwner(value: unknown): value is string {
  return (
    typeof value === 'string' && value === value.trim() && value.length >= 1 && value.length <= 128
  );
}

function validNullableString(value: unknown, max: number): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' &&
      value === value.trim() &&
      value.length >= 1 &&
      value.length <= max)
  );
}

export function parseHealthDataLifecycleRecord(raw: string): HealthDataLifecycleRecord {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(HEALTH_DATA_LIFECYCLE_INVALID);
  }
  if (!isRecord(value)) throw new Error(HEALTH_DATA_LIFECYCLE_INVALID);

  const expectedKeys = [
    'schemaVersion',
    'ownerUserId',
    'state',
    'processingEpoch',
    'operationId',
    'idempotencyKey',
    'localCleanupComplete',
    'activationRoutePending',
    'verificationReason',
    'verificationResumeState',
    'serverVerifiedAt',
    'updatedAt',
  ];
  const actualKeys = Object.keys(value).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== [...expectedKeys].sort()[index])
  ) {
    throw new Error(HEALTH_DATA_LIFECYCLE_INVALID);
  }

  const states = new Set<HealthDataLifecycleState>([
    'unconsented',
    'active',
    'withdrawing',
    'withdrawn',
    'verification_required',
  ]);
  const verificationReasons = new Set<HealthDataVerificationReason>([
    'status_unavailable',
    'consent_contract_mismatch',
    'processing_epoch_changed',
    'authoritative_unconsented',
    'local_consent_unavailable',
    'withdrawal_status_unavailable',
    'owner_unavailable',
  ]);
  const resumeStates = new Set<HealthDataVerificationResumeState>([
    'unconsented',
    'active',
    'withdrawing',
    'withdrawn',
  ]);
  if (
    value.schemaVersion !== SCHEMA_VERSION ||
    !validOwner(value.ownerUserId) ||
    typeof value.state !== 'string' ||
    !states.has(value.state as HealthDataLifecycleState) ||
    !Number.isSafeInteger(value.processingEpoch) ||
    (value.processingEpoch as number) < 0 ||
    !validNullableString(value.operationId, 128) ||
    !validNullableString(value.idempotencyKey, 128) ||
    typeof value.localCleanupComplete !== 'boolean' ||
    typeof value.activationRoutePending !== 'boolean' ||
    !(
      value.verificationReason === null ||
      (typeof value.verificationReason === 'string' &&
        verificationReasons.has(value.verificationReason as HealthDataVerificationReason))
    ) ||
    !(
      value.verificationResumeState === null ||
      (typeof value.verificationResumeState === 'string' &&
        resumeStates.has(value.verificationResumeState as HealthDataVerificationResumeState))
    ) ||
    !(value.serverVerifiedAt === null || validIso(value.serverVerifiedAt)) ||
    !validIso(value.updatedAt)
  ) {
    throw new Error(HEALTH_DATA_LIFECYCLE_INVALID);
  }

  const state = value.state as HealthDataLifecycleState;
  const processingEpoch = value.processingEpoch as number;
  if (
    ((state === 'active' || state === 'withdrawing' || state === 'withdrawn') &&
      processingEpoch < 1) ||
    (state === 'unconsented' && processingEpoch !== 0) ||
    (state !== 'withdrawing' && value.idempotencyKey !== null) ||
    (value.activationRoutePending === true &&
      !(
        state === 'active' ||
        (state === 'verification_required' &&
          value.verificationReason === 'status_unavailable' &&
          value.verificationResumeState === 'active')
      )) ||
    (state === 'verification_required' && value.verificationReason === null) ||
    (state !== 'verification_required' && value.verificationReason !== null) ||
    (state !== 'verification_required' && value.verificationResumeState !== null)
  ) {
    throw new Error(HEALTH_DATA_LIFECYCLE_INVALID);
  }

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    ownerUserId: value.ownerUserId,
    state,
    processingEpoch,
    operationId: value.operationId as string | null,
    idempotencyKey: value.idempotencyKey as string | null,
    localCleanupComplete: value.localCleanupComplete,
    activationRoutePending: value.activationRoutePending,
    verificationReason: value.verificationReason as HealthDataVerificationReason | null,
    verificationResumeState:
      value.verificationResumeState as HealthDataVerificationResumeState | null,
    serverVerifiedAt: value.serverVerifiedAt as string | null,
    updatedAt: value.updatedAt,
  });
}

function encode(record: HealthDataLifecycleRecord): string {
  return JSON.stringify(record);
}

function notify(record: HealthDataLifecycleRecord | null): void {
  for (const listener of listeners) listener(record);
}

/**
 * Close mounted health surfaces in the same call stack as a confirmed user
 * withdrawal. This record is deliberately not persistence authority: the
 * owner-bound pending-intent store is committed immediately afterwards and
 * cold-start reconciliation hydrates that durable marker. Keeping this
 * process interlock on the ordinary subscription path means an already
 * mounted route cannot expose stale health data while the first storage write
 * is still pending or has failed.
 */
export function publishImmediateHealthDataWithdrawalInterlock(params: {
  ownerUserId: string;
  processingEpoch: number;
}): HealthDataLifecycleRecord {
  const record = parseHealthDataLifecycleRecord(
    JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      ownerUserId: params.ownerUserId,
      state: 'withdrawing',
      processingEpoch: params.processingEpoch,
      operationId: null,
      idempotencyKey: null,
      localCleanupComplete: false,
      activationRoutePending: false,
      verificationReason: null,
      verificationResumeState: null,
      serverVerifiedAt: null,
      updatedAt: new Date().toISOString(),
    }),
  );
  notify(record);
  return record;
}

function transitionAllowed(
  previous: HealthDataLifecycleRecord,
  next: HealthDataLifecycleRecord,
): boolean {
  const allowed: Record<HealthDataLifecycleState, ReadonlySet<HealthDataLifecycleState>> = {
    // `unconsented -> withdrawing` restores a durable owner-bound withdrawal
    // journal after ordinary account cleanup removed this encrypted record.
    unconsented: new Set(['unconsented', 'active', 'withdrawing', 'verification_required']),
    // A second device may already have driven the authoritative operation to
    // terminal before this device next polls; local cleanup is still required.
    active: new Set(['active', 'withdrawing', 'withdrawn', 'verification_required']),
    withdrawing: new Set(['withdrawing', 'withdrawn', 'verification_required']),
    withdrawn: new Set(['withdrawn', 'active', 'verification_required']),
    verification_required: new Set([
      'unconsented',
      'active',
      'withdrawing',
      'withdrawn',
      'verification_required',
    ]),
  };
  if (!allowed[previous.state].has(next.state)) return false;
  if (next.processingEpoch < previous.processingEpoch) return false;
  if (
    ((previous.state === 'unconsented' && next.state === 'active') ||
      (previous.state === 'withdrawn' && next.state === 'active')) &&
    next.processingEpoch <= previous.processingEpoch
  ) {
    return false;
  }
  if (
    previous.state === 'active' &&
    next.state === 'withdrawing' &&
    next.processingEpoch !== previous.processingEpoch
  ) {
    return false;
  }
  if (
    (previous.state === 'withdrawing' || previous.state === 'withdrawn') &&
    (next.state === 'withdrawing' || next.state === 'withdrawn') &&
    next.processingEpoch !== previous.processingEpoch
  ) {
    return false;
  }
  if (
    (previous.state === 'withdrawing' || previous.state === 'withdrawn') &&
    previous.operationId !== null &&
    next.state !== 'active' &&
    next.operationId !== previous.operationId
  ) {
    return false;
  }
  return true;
}

export function subscribeToHealthDataLifecycle(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function readHealthDataLifecycle(
  ownerUserId: string,
): Promise<HealthDataLifecycleRecord | null> {
  const raw = await getPrivateItem(HEALTH_DATA_LIFECYCLE_KEY);
  if (raw === null) return null;
  const record = parseHealthDataLifecycleRecord(raw);
  if (record.ownerUserId !== ownerUserId) {
    throw new Error(HEALTH_DATA_LIFECYCLE_OWNER_MISMATCH);
  }
  return record;
}

export async function writeHealthDataLifecycle(
  input: Omit<HealthDataLifecycleRecord, 'schemaVersion' | 'updatedAt'> & {
    updatedAt?: string;
  },
): Promise<HealthDataLifecycleRecord> {
  const next = Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    ...input,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  }) satisfies HealthDataLifecycleRecord;
  // Validate the exact serialized contract before it can become authority.
  const validated = parseHealthDataLifecycleRecord(encode(next));
  await updatePrivateItem(HEALTH_DATA_LIFECYCLE_KEY, (current) => {
    if (current !== null) {
      const previous = parseHealthDataLifecycleRecord(current);
      if (previous.ownerUserId !== validated.ownerUserId) {
        throw new Error(HEALTH_DATA_LIFECYCLE_OWNER_MISMATCH);
      }
      if (!transitionAllowed(previous, validated)) {
        throw new Error(HEALTH_DATA_LIFECYCLE_TRANSITION_STALE);
      }
    }
    return encode(validated);
  });
  notify(validated);
  return validated;
}

export function verificationRequiredRecord(params: {
  ownerUserId: string;
  previous?: HealthDataLifecycleRecord | null;
  reason?: HealthDataVerificationReason;
  resumeState?: HealthDataVerificationResumeState | null;
  localCleanupComplete?: boolean;
  activationRoutePending?: boolean;
}): HealthDataLifecycleRecord {
  const previous = params.previous ?? null;
  const reason =
    params.reason ??
    (previous?.state === 'verification_required'
      ? previous.verificationReason
      : previous?.state === 'withdrawing' || previous?.state === 'withdrawn'
        ? 'withdrawal_status_unavailable'
        : 'status_unavailable');
  const resumeState =
    params.resumeState !== undefined
      ? params.resumeState
      : previous?.state === 'verification_required'
        ? previous.verificationResumeState
        : (previous?.state ?? null);
  const inheritedCleanupComplete =
    previous?.state === 'active'
      ? false
      : previous?.state === 'verification_required'
        ? previous.localCleanupComplete
        : (previous?.localCleanupComplete ?? false);
  const inheritedActivationRoutePending =
    reason === 'status_unavailable' &&
    resumeState === 'active' &&
    previous?.activationRoutePending === true;
  const activationRoutePending =
    reason === 'status_unavailable' && resumeState === 'active'
      ? (params.activationRoutePending ?? inheritedActivationRoutePending)
      : false;
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    ownerUserId: params.ownerUserId,
    state: 'verification_required',
    processingEpoch: previous?.processingEpoch ?? 0,
    operationId: previous?.operationId ?? null,
    idempotencyKey: null,
    // Active data is deliberately preserved during an ordinary status outage.
    // The reason/resume tuple, not this flag, determines whether recovery may
    // reopen the same epoch without erasure.
    localCleanupComplete: params.localCleanupComplete ?? inheritedCleanupComplete,
    activationRoutePending,
    verificationReason: reason,
    verificationResumeState: resumeState,
    serverVerifiedAt: previous?.serverVerifiedAt ?? null,
    updatedAt: new Date().toISOString(),
  });
}

export function verificationRequiresLocalCleanup(record: HealthDataLifecycleRecord): boolean {
  return (
    record.state === 'verification_required' && record.verificationReason !== 'status_unavailable'
  );
}

export function verificationCanResumeActiveEpoch(
  record: HealthDataLifecycleRecord,
  processingEpoch: number,
): boolean {
  return (
    record.state === 'verification_required' &&
    record.verificationReason === 'status_unavailable' &&
    record.verificationResumeState === 'active' &&
    record.processingEpoch === processingEpoch
  );
}
