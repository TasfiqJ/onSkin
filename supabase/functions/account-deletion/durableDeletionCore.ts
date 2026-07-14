export const DELETION_CAPABILITY_BYTES = 32;
export const DELETION_CAPABILITY_HEX_LENGTH = DELETION_CAPABILITY_BYTES * 2;
export const MIN_DELETION_STATUS_POLL_SECONDS = 2;
export const MAX_DELETION_STATUS_POLL_SECONDS = 60;
export const DELETION_STATUS_CAPABILITY_DIGEST_CONTEXT =
  'onskin-account-deletion-status-capability:v1:';
export const DELETION_IDEMPOTENCY_DIGEST_CONTEXT = 'onskin-account-deletion-intake-idempotency:v1:';

const OPERATION_STATES = ['pending', 'running', 'ready_to_finalize', 'action_required'] as const;
const STEP_STATES = [
  'pending',
  'leased',
  'request_started',
  'ambiguous',
  'succeeded',
  'action_required',
] as const;
const STEP_KINDS = ['network', 'transactional'] as const;
const ATTEMPT_SIGNALS = [
  'succeeded',
  'retryable',
  'unattested',
  'transport_failure',
  'action_required',
] as const;
const ATTEMPT_PHASES = ['pre_dispatch', 'post_dispatch', 'reconciliation', 'transaction'] as const;
const RETRY_SAFETY_VALUES = ['safe', 'unsafe'] as const;
const PUBLIC_DELETION_PHASES = [
  'queued',
  'processing',
  'local_erasing',
  'provider_verifying',
  'delayed',
] as const;

export type DeletionOperationState = (typeof OPERATION_STATES)[number];
export type DeletionStepState = (typeof STEP_STATES)[number];

/**
 * Network steps may have an unknown remote side effect and therefore require
 * a committed request_started marker. Transactional steps are atomic and may
 * move directly from a lease to success.
 */
export type DeletionStepKind = (typeof STEP_KINDS)[number];
export type DeletionAttemptSignal = (typeof ATTEMPT_SIGNALS)[number];
export type DeletionAttemptPhase = (typeof ATTEMPT_PHASES)[number];
export type DeletionRetrySafety = (typeof RETRY_SAFETY_VALUES)[number];
export type PublicDeletionPhase = (typeof PUBLIC_DELETION_PHASES)[number];
export type DeletionReceiptState = 'completed' | 'action_required';

export type DeletionTransitionResult = 'advanced' | 'idempotent';

export type DeletionLeaseDisposition =
  | { kind: 'claimable' }
  | { kind: 'not_due'; retryAtMs: number }
  | { kind: 'lease_active'; leaseExpiresAtMs: number }
  | { kind: 'mark_ambiguous' }
  | { kind: 'reconciliation_required' }
  | { kind: 'terminal' }
  | { kind: 'attempts_exhausted' };

export type DeletionAttemptResolution =
  | { nextState: 'succeeded'; resultCode: 'STEP_SUCCEEDED' }
  | {
      nextState: 'pending';
      resultCode: 'STEP_RETRY_SCHEDULED';
      retryAtMs: number;
    }
  | {
      nextState: 'ambiguous';
      resultCode: 'STEP_RECONCILIATION_SCHEDULED';
      retryAtMs: number;
    }
  | { nextState: 'ambiguous'; resultCode: 'STEP_DISPATCH_AMBIGUOUS' }
  | { nextState: 'action_required'; resultCode: 'STEP_REQUIRES_OPERATOR' };

export type DeletionIntakeTokens = {
  idempotencyKey: string;
  statusCapability: string;
};

export type PublicDeletionStatusLookup =
  | { kind: 'not_found' }
  | { kind: 'expired' }
  | {
      kind: 'operation';
      operationState: DeletionOperationState;
      phase: PublicDeletionPhase;
      nextPollAfterSeconds: number;
    }
  | {
      kind: 'receipt';
      receiptState: 'completed';
      notice?: 'remove_apple_authorization';
    }
  | {
      kind: 'receipt';
      receiptState: 'action_required';
      nextPollAfterSeconds: number;
    };

export type PublicDeletionStatusResponse =
  | {
      httpStatus: 200;
      body: { status: 'completed'; notice?: 'remove_apple_authorization' };
    }
  | {
      httpStatus: 202;
      body: {
        status: 'pending';
        phase: PublicDeletionPhase;
        nextPollAfterSeconds: number;
      };
    }
  | {
      httpStatus: 202;
      body: {
        status: 'delayed';
        phase: PublicDeletionPhase;
        nextPollAfterSeconds: number;
      };
    }
  | { httpStatus: 404; body: { status: 'invalid' } }
  | { httpStatus: 410; body: { status: 'expired' } };

export class DurableDeletionCoreError extends Error {
  constructor(
    public readonly code:
      | 'DELETION_CAPABILITY_INVALID'
      | 'DELETION_IDEMPOTENCY_KEY_INVALID'
      | 'DELETION_INTAKE_TOKENS_INVALID'
      | 'DELETION_RANDOMNESS_INVALID'
      | 'DELETION_TRANSITION_INVALID'
      | 'DELETION_LEASE_INPUT_INVALID'
      | 'DELETION_ATTEMPT_INPUT_INVALID'
      | 'DELETION_PUBLIC_STATUS_INVALID',
  ) {
    super(code);
    this.name = 'DurableDeletionCoreError';
  }
}

const operationTransitions: Readonly<
  Record<DeletionOperationState, readonly DeletionOperationState[]>
> = {
  pending: ['running', 'action_required'],
  running: ['ready_to_finalize', 'action_required'],
  ready_to_finalize: ['action_required'],
  // `action_required` is an internally delayed, recoverable state. A
  // service-only audited operator action may requeue the blocked step; the
  // database then recomputes the aggregate operation as running or ready.
  // Public clients still receive only the opaque `delayed` phase.
  action_required: ['running', 'ready_to_finalize'],
};

const networkStepTransitions: Readonly<Record<DeletionStepState, readonly DeletionStepState[]>> = {
  pending: ['leased', 'action_required'],
  leased: ['pending', 'request_started', 'action_required'],
  request_started: ['pending', 'ambiguous', 'succeeded', 'action_required'],
  // An ambiguous remote dispatch may only be reconciled. It can never be
  // returned to pending, because pending is a fresh-dispatch state.
  ambiguous: ['succeeded', 'action_required'],
  succeeded: [],
  action_required: [],
};

const transactionalStepTransitions: Readonly<
  Record<DeletionStepState, readonly DeletionStepState[]>
> = {
  pending: ['leased', 'action_required'],
  leased: ['pending', 'succeeded', 'action_required'],
  request_started: [],
  ambiguous: [],
  succeeded: [],
  action_required: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function isOperationState(value: unknown): value is DeletionOperationState {
  return isOneOf(value, OPERATION_STATES);
}

function isStepState(value: unknown): value is DeletionStepState {
  return isOneOf(value, STEP_STATES);
}

function isStepKind(value: unknown): value is DeletionStepKind {
  return isOneOf(value, STEP_KINDS);
}

function isAttemptSignal(value: unknown): value is DeletionAttemptSignal {
  return isOneOf(value, ATTEMPT_SIGNALS);
}

function isAttemptPhase(value: unknown): value is DeletionAttemptPhase {
  return isOneOf(value, ATTEMPT_PHASES);
}

function isRetrySafety(value: unknown): value is DeletionRetrySafety {
  return isOneOf(value, RETRY_SAFETY_VALUES);
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: unknown): Uint8Array | null {
  if (
    typeof hex !== 'string' ||
    !new RegExp(`^[0-9a-f]{${DELETION_CAPABILITY_HEX_LENGTH}}$`).test(hex)
  ) {
    return null;
  }
  const bytes = new Uint8Array(DELETION_CAPABILITY_BYTES);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function finiteNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function validPublicPollInterval(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= MIN_DELETION_STATUS_POLL_SECONDS &&
    value <= MAX_DELETION_STATUS_POLL_SECONDS
  );
}

function assertTransition(
  from: DeletionOperationState | DeletionStepState,
  to: DeletionOperationState | DeletionStepState,
  transitions: Readonly<Record<string, readonly string[]>>,
): DeletionTransitionResult {
  if (from === to) return 'idempotent';
  if (transitions[from]?.includes(to)) return 'advanced';
  throw new DurableDeletionCoreError('DELETION_TRANSITION_INVALID');
}

function randomDeletionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(DELETION_CAPABILITY_BYTES));
  if (!(bytes instanceof Uint8Array) || bytes.length !== DELETION_CAPABILITY_BYTES) {
    throw new DurableDeletionCoreError('DELETION_RANDOMNESS_INVALID');
  }
  return bytesToHex(bytes);
}

export function generateDeletionCapability(): string {
  return randomDeletionToken();
}

/** Generate and validate independent intake secrets before any request starts. */
export function generateDeletionIntakeTokens(): DeletionIntakeTokens {
  const idempotencyKey = randomDeletionToken();
  const statusCapability = randomDeletionToken();
  if (idempotencyKey === statusCapability) {
    throw new DurableDeletionCoreError('DELETION_RANDOMNESS_INVALID');
  }
  return validateDeletionIntakeTokens({ idempotencyKey, statusCapability });
}

export function validateDeletionIntakeTokens(value: unknown): DeletionIntakeTokens {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['idempotencyKey', 'statusCapability']) ||
    hexToBytes(value.idempotencyKey) === null ||
    hexToBytes(value.statusCapability) === null ||
    value.idempotencyKey === value.statusCapability
  ) {
    throw new DurableDeletionCoreError('DELETION_INTAKE_TOKENS_INVALID');
  }
  return {
    idempotencyKey: value.idempotencyKey as string,
    statusCapability: value.statusCapability as string,
  };
}

export async function hashDeletionCapability(capability: string): Promise<string> {
  if (hexToBytes(capability) === null) {
    throw new DurableDeletionCoreError('DELETION_CAPABILITY_INVALID');
  }
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${DELETION_STATUS_CAPABILITY_DIGEST_CONTEXT}${capability}`),
  );
  return bytesToHex(new Uint8Array(digest));
}

export async function hashDeletionIdempotencyKey(idempotencyKey: string): Promise<string> {
  if (hexToBytes(idempotencyKey) === null) {
    throw new DurableDeletionCoreError('DELETION_IDEMPOTENCY_KEY_INVALID');
  }
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${DELETION_IDEMPOTENCY_DIGEST_CONTEXT}${idempotencyKey}`),
  );
  return bytesToHex(new Uint8Array(digest));
}

export async function verifyDeletionCapability(
  capability: string,
  expectedDigest: string,
): Promise<boolean> {
  if (hexToBytes(capability) === null || hexToBytes(expectedDigest) === null) {
    return false;
  }
  const actualDigest = await hashDeletionCapability(capability);
  const actualBytes = hexToBytes(actualDigest)!;
  const expectedBytes = hexToBytes(expectedDigest)!;
  let mismatch = 0;
  for (let index = 0; index < actualBytes.length; index += 1) {
    mismatch |= actualBytes[index] ^ expectedBytes[index];
  }
  return mismatch === 0;
}

export function assertDeletionOperationTransition(
  from: DeletionOperationState,
  to: DeletionOperationState,
): DeletionTransitionResult {
  if (!isOperationState(from) || !isOperationState(to)) {
    throw new DurableDeletionCoreError('DELETION_TRANSITION_INVALID');
  }
  return assertTransition(from, to, operationTransitions);
}

export function assertDeletionStepTransition(
  kind: DeletionStepKind,
  from: DeletionStepState,
  to: DeletionStepState,
): DeletionTransitionResult {
  if (!isStepKind(kind) || !isStepState(from) || !isStepState(to)) {
    throw new DurableDeletionCoreError('DELETION_TRANSITION_INVALID');
  }
  if (
    kind === 'transactional' &&
    (from === 'request_started' ||
      from === 'ambiguous' ||
      to === 'request_started' ||
      to === 'ambiguous')
  ) {
    throw new DurableDeletionCoreError('DELETION_TRANSITION_INVALID');
  }
  return assertTransition(
    from,
    to,
    kind === 'network' ? networkStepTransitions : transactionalStepTransitions,
  );
}

export function classifyDeletionStepLease(options: {
  kind: DeletionStepKind;
  state: DeletionStepState;
  nowMs: number;
  leaseExpiresAtMs?: number | null;
  nextAttemptAtMs?: number | null;
  attemptCount: number;
  maxAttempts: number;
}): DeletionLeaseDisposition {
  if (
    !isRecord(options) ||
    !Object.keys(options).every((key) =>
      [
        'kind',
        'state',
        'nowMs',
        'leaseExpiresAtMs',
        'nextAttemptAtMs',
        'attemptCount',
        'maxAttempts',
      ].includes(key),
    )
  ) {
    throw new DurableDeletionCoreError('DELETION_LEASE_INPUT_INVALID');
  }
  const { kind, state, nowMs, leaseExpiresAtMs, nextAttemptAtMs, attemptCount, maxAttempts } =
    options;
  if (
    !isStepKind(kind) ||
    !isStepState(state) ||
    !finiteNonNegativeInteger(nowMs) ||
    !finiteNonNegativeInteger(attemptCount) ||
    !Number.isSafeInteger(maxAttempts) ||
    maxAttempts <= 0 ||
    attemptCount > maxAttempts ||
    (leaseExpiresAtMs != null && !finiteNonNegativeInteger(leaseExpiresAtMs)) ||
    (nextAttemptAtMs != null && !finiteNonNegativeInteger(nextAttemptAtMs)) ||
    (kind === 'transactional' && (state === 'request_started' || state === 'ambiguous'))
  ) {
    throw new DurableDeletionCoreError('DELETION_LEASE_INPUT_INVALID');
  }

  if (state === 'succeeded' || state === 'action_required') {
    return { kind: 'terminal' };
  }
  if (attemptCount >= maxAttempts) return { kind: 'attempts_exhausted' };
  if (state === 'ambiguous') return { kind: 'reconciliation_required' };

  if (state === 'leased' || state === 'request_started') {
    if (leaseExpiresAtMs == null) {
      throw new DurableDeletionCoreError('DELETION_LEASE_INPUT_INVALID');
    }
    if (leaseExpiresAtMs > nowMs) {
      return { kind: 'lease_active', leaseExpiresAtMs };
    }
    return state === 'request_started' ? { kind: 'mark_ambiguous' } : { kind: 'claimable' };
  }

  if (nextAttemptAtMs != null && nextAttemptAtMs > nowMs) {
    return { kind: 'not_due', retryAtMs: nextAttemptAtMs };
  }
  return { kind: 'claimable' };
}

export function resolveDeletionAttempt(options: {
  kind: DeletionStepKind;
  phase: DeletionAttemptPhase;
  signal: DeletionAttemptSignal;
  retrySafety: DeletionRetrySafety;
  attemptCount: number;
  maxAttempts: number;
  retryAtMs?: number | null;
}): DeletionAttemptResolution {
  if (
    !isRecord(options) ||
    !Object.keys(options).every((key) =>
      [
        'kind',
        'phase',
        'signal',
        'retrySafety',
        'attemptCount',
        'maxAttempts',
        'retryAtMs',
      ].includes(key),
    )
  ) {
    throw new DurableDeletionCoreError('DELETION_ATTEMPT_INPUT_INVALID');
  }
  const { kind, phase, signal, retrySafety, attemptCount, maxAttempts, retryAtMs } = options;
  if (
    !isStepKind(kind) ||
    !isAttemptPhase(phase) ||
    !isAttemptSignal(signal) ||
    !isRetrySafety(retrySafety) ||
    !Number.isSafeInteger(attemptCount) ||
    attemptCount <= 0 ||
    !Number.isSafeInteger(maxAttempts) ||
    maxAttempts <= 0 ||
    attemptCount > maxAttempts ||
    (retryAtMs != null && !finiteNonNegativeInteger(retryAtMs))
  ) {
    throw new DurableDeletionCoreError('DELETION_ATTEMPT_INPUT_INVALID');
  }

  const transactionalCombinationIsValid =
    kind === 'transactional' &&
    phase === 'transaction' &&
    retrySafety === 'safe' &&
    signal !== 'unattested';
  const preDispatchCombinationIsValid =
    kind === 'network' &&
    phase === 'pre_dispatch' &&
    retrySafety === 'safe' &&
    signal !== 'succeeded' &&
    signal !== 'unattested';
  const postDispatchCombinationIsValid = kind === 'network' && phase === 'post_dispatch';
  const reconciliationCombinationIsValid =
    kind === 'network' && phase === 'reconciliation' && retrySafety === 'safe';
  if (
    !transactionalCombinationIsValid &&
    !preDispatchCombinationIsValid &&
    !postDispatchCombinationIsValid &&
    !reconciliationCombinationIsValid
  ) {
    throw new DurableDeletionCoreError('DELETION_ATTEMPT_INPUT_INVALID');
  }

  if (signal === 'succeeded') {
    return { nextState: 'succeeded', resultCode: 'STEP_SUCCEEDED' };
  }
  if (signal === 'action_required') {
    return {
      nextState: 'action_required',
      resultCode: 'STEP_REQUIRES_OPERATOR',
    };
  }

  if (
    phase === 'post_dispatch' &&
    retrySafety === 'unsafe' &&
    (signal === 'transport_failure' || signal === 'unattested' || signal === 'retryable')
  ) {
    return { nextState: 'ambiguous', resultCode: 'STEP_DISPATCH_AMBIGUOUS' };
  }

  if (attemptCount >= maxAttempts || retryAtMs == null) {
    return {
      nextState: 'action_required',
      resultCode: 'STEP_REQUIRES_OPERATOR',
    };
  }
  if (phase === 'reconciliation') {
    return {
      nextState: 'ambiguous',
      resultCode: 'STEP_RECONCILIATION_SCHEDULED',
      retryAtMs,
    };
  }
  return {
    nextState: 'pending',
    resultCode: 'STEP_RETRY_SCHEDULED',
    retryAtMs,
  };
}

export function mapPublicDeletionStatus(
  lookup: PublicDeletionStatusLookup,
): PublicDeletionStatusResponse {
  if (
    !isRecord(lookup) ||
    !isOneOf(lookup.kind, ['not_found', 'expired', 'operation', 'receipt'])
  ) {
    throw new DurableDeletionCoreError('DELETION_PUBLIC_STATUS_INVALID');
  }
  if (lookup.kind === 'not_found') {
    if (!hasExactKeys(lookup, ['kind'])) {
      throw new DurableDeletionCoreError('DELETION_PUBLIC_STATUS_INVALID');
    }
    return { httpStatus: 404, body: { status: 'invalid' } };
  }
  if (lookup.kind === 'expired') {
    if (!hasExactKeys(lookup, ['kind'])) {
      throw new DurableDeletionCoreError('DELETION_PUBLIC_STATUS_INVALID');
    }
    return { httpStatus: 410, body: { status: 'expired' } };
  }

  if (lookup.kind === 'receipt' && lookup.receiptState === 'completed') {
    if (
      !hasExactKeys(
        lookup,
        lookup.notice === undefined ? ['kind', 'receiptState'] : ['kind', 'receiptState', 'notice'],
      ) ||
      (lookup.notice !== undefined && lookup.notice !== 'remove_apple_authorization')
    ) {
      throw new DurableDeletionCoreError('DELETION_PUBLIC_STATUS_INVALID');
    }
    return {
      httpStatus: 200,
      body: {
        status: 'completed',
        ...(lookup.notice === 'remove_apple_authorization' ? { notice: lookup.notice } : {}),
      },
    };
  }
  if (lookup.kind === 'receipt' && lookup.receiptState === 'action_required') {
    if (
      !hasExactKeys(lookup, ['kind', 'receiptState', 'nextPollAfterSeconds']) ||
      !validPublicPollInterval(lookup.nextPollAfterSeconds)
    ) {
      throw new DurableDeletionCoreError('DELETION_PUBLIC_STATUS_INVALID');
    }
    return {
      httpStatus: 202,
      body: {
        status: 'delayed',
        phase: 'delayed',
        nextPollAfterSeconds: lookup.nextPollAfterSeconds,
      },
    };
  }

  if (
    lookup.kind !== 'operation' ||
    !hasExactKeys(lookup, ['kind', 'operationState', 'phase', 'nextPollAfterSeconds']) ||
    !isOperationState(lookup.operationState) ||
    !isOneOf(lookup.phase, PUBLIC_DELETION_PHASES) ||
    !validPublicPollInterval(lookup.nextPollAfterSeconds)
  ) {
    throw new DurableDeletionCoreError('DELETION_PUBLIC_STATUS_INVALID');
  }
  const phaseIsValidForState =
    (lookup.operationState === 'pending' && lookup.phase === 'queued') ||
    (lookup.operationState === 'running' &&
      (lookup.phase === 'processing' ||
        lookup.phase === 'local_erasing' ||
        lookup.phase === 'provider_verifying')) ||
    (lookup.operationState === 'ready_to_finalize' && lookup.phase === 'processing') ||
    (lookup.operationState === 'action_required' && lookup.phase === 'delayed');
  if (!phaseIsValidForState) {
    throw new DurableDeletionCoreError('DELETION_PUBLIC_STATUS_INVALID');
  }
  if (lookup.operationState === 'action_required') {
    return {
      httpStatus: 202,
      body: {
        status: 'delayed',
        phase: lookup.phase,
        nextPollAfterSeconds: lookup.nextPollAfterSeconds,
      },
    };
  }
  return {
    httpStatus: 202,
    body: {
      status: 'pending',
      phase: lookup.phase,
      nextPollAfterSeconds: lookup.nextPollAfterSeconds,
    },
  };
}
