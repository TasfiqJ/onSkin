import {
  attestRevenueCatV2AlreadyAbsent,
  attestRevenueCatV2Deletion,
  attestRevenueCatV2PreflightSnapshot,
  buildRevenueCatV2AliasPageRequest,
  buildRevenueCatV2CustomerLookupRequest,
  buildRevenueCatV2DeleteRequest,
  buildRevenueCatV2ProjectPageRequest,
  buildRevenueCatV2ReconciliationRequests,
  classifyRevenueCatV2AliasesReconciliationResponse,
  classifyRevenueCatV2AliasPageResponse,
  classifyRevenueCatV2CustomerLookupResponse,
  classifyRevenueCatV2CustomerReconciliationResponse,
  classifyRevenueCatV2DeleteResponse,
  classifyRevenueCatV2PreflightTransportFailure,
  classifyRevenueCatV2ProjectPageResponse,
  classifyRevenueCatV2ProjectTransportFailure,
  classifyRevenueCatV2ReconciliationTransportFailure,
  classifyRevenueCatV2TransportFailure,
  type ProviderResultCode,
  type RevenueCatV2AliasesReconciliationObservation,
  type RevenueCatV2AliasPageEvidence,
  type RevenueCatV2CustomerAbsenceEvidence,
  type RevenueCatV2CustomerLookupEvidence,
  type RevenueCatV2CustomerReconciliationObservation,
  type RevenueCatV2DispatchEvidence,
  type RevenueCatV2PreflightEvidence,
  type RevenueCatV2ProjectVisibilityEvidence,
} from './durableProviderDeletion.ts';
import {
  AccountDeletionWorkerCapacityError,
  type AccountDeletionClaim,
  type AccountDeletionStepExecutor,
} from './durableDeletionWorker.ts';

export const REVENUECAT_V2_EXECUTOR_STATE_VERSION = 2 as const;
export const REVENUECAT_V2_EXECUTOR_MAX_PLAINTEXT_BYTES = 24_518;
export const REVENUECAT_V2_MAX_NETWORK_TIMEOUT_MS = 10_000;
export const REVENUECAT_V2_MAX_RECONCILIATION_CONCURRENCY = 14;

const MAX_PROJECT_ID_CHARS = 255;
const MAX_CUSTOMER_ID_CHARS = 1_500;
const MAX_PROJECT_PAGES = 50;
const MAX_ALIAS_PAGES = 50;
const MAX_ALIASES = 64;
const MAX_PAGE_ALIASES = 20;
const MAX_EVIDENCE_ID_BYTES = 4_096;
const MAX_PROVIDER_RETRY_AFTER_MS = 7 * 86_400_000;
const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const CREDENTIAL_BINDING_PATTERN = /^[a-f0-9]{64}$/;
const CLAIM_TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const CLAIM_BINDING_PATTERN = /^[a-f0-9]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type RevenueCatV2CustomerSnapshot =
  | null
  | { kind: 'found'; evidence: RevenueCatV2CustomerLookupEvidence }
  | { kind: 'absent'; evidence: RevenueCatV2CustomerAbsenceEvidence };

export type RevenueCatV2PreflightExecutorState = {
  version: typeof REVENUECAT_V2_EXECUTOR_STATE_VERSION;
  phase: 'preflight';
  operationId: string;
  credentialBinding: string;
  priorAbsenceObservation: boolean;
  providerProbeInFlight: boolean;
  absenceClaimBinding: string | null;
  projectId: string;
  lookupCustomerId: string;
  projectPageNumber: number;
  projectStartingAfter: string | null;
  projectVisibility: RevenueCatV2ProjectVisibilityEvidence | null;
  customerSnapshot: RevenueCatV2CustomerSnapshot;
  aliasPages: RevenueCatV2AliasPageEvidence[];
};

export type RevenueCatV2AlreadyAbsentExecutorState = {
  version: typeof REVENUECAT_V2_EXECUTOR_STATE_VERSION;
  phase: 'already_absent';
  operationId: string;
  credentialBinding: string;
  absenceClaimBinding: string;
  projectVisibility: RevenueCatV2ProjectVisibilityEvidence;
  customerAbsence: RevenueCatV2CustomerAbsenceEvidence;
};

export type RevenueCatV2ReadyExecutorState = {
  version: typeof REVENUECAT_V2_EXECUTOR_STATE_VERSION;
  phase: 'ready';
  operationId: string;
  credentialBinding: string;
  projectVisibility: RevenueCatV2ProjectVisibilityEvidence;
  preflightEvidence: RevenueCatV2PreflightEvidence;
};

export type RevenueCatV2ReconciliationExecutorState = {
  version: typeof REVENUECAT_V2_EXECUTOR_STATE_VERSION;
  phase: 'reconciling';
  operationId: string;
  credentialBinding: string;
  roundClaimBinding: string;
  projectVisibility: RevenueCatV2ProjectVisibilityEvidence;
  preflightEvidence: RevenueCatV2PreflightEvidence;
  dispatchEvidence: RevenueCatV2DispatchEvidence;
  presenceResetRequired: boolean;
  providerProbeInFlight: boolean;
  customerObservations: Array<RevenueCatV2CustomerReconciliationObservation | null>;
  aliasesObservation: RevenueCatV2AliasesReconciliationObservation | null;
};

export type RevenueCatV2ExecutorState =
  | RevenueCatV2PreflightExecutorState
  | RevenueCatV2AlreadyAbsentExecutorState
  | RevenueCatV2ReadyExecutorState
  | RevenueCatV2ReconciliationExecutorState;

export type RevenueCatV2HttpRequest = {
  url: string;
  init: RequestInit;
};

export type RevenueCatV2NetworkResponse = {
  status: number;
  body: unknown;
  /** Parsed Retry-After header delay; null when absent or malformed. */
  retryAfterMs?: number | null;
};

export type RevenueCatV2ExecutorNetwork = {
  /** Acquires a distributed provider permit before request_started is durable. */
  reserveMutation: (context: { deadlineAtMs: number }) => Promise<void>;
  /** The adapter owns timeout, response-size limits, and bounded JSON parsing. */
  execute: (
    request: RevenueCatV2HttpRequest,
    context: { deadlineAtMs: number; requestBudgetReserved: boolean },
  ) => Promise<RevenueCatV2NetworkResponse>;
};

export type RevenueCatV2ExecutorStateStore = {
  /** Returns authenticated plaintext or null when the claim has no payload. */
  load: (claim: AccountDeletionClaim) => Promise<Uint8Array | null>;
  /** AES-GCM encryption and the claim-token payload CAS live in this adapter. */
  persist: (claim: AccountDeletionClaim, canonicalPlaintext: Uint8Array) => Promise<void>;
};

export type RevenueCatV2StepOutcome =
  | { kind: 'succeeded'; resultCode: ProviderResultCode }
  | { kind: 'retryable'; resultCode: ProviderResultCode; retryAt: string }
  | { kind: 'ambiguous'; resultCode: ProviderResultCode; retryAt?: string }
  | { kind: 'action_required'; resultCode: ProviderResultCode };

export type RevenueCatV2IdentityBarrierSnapshot = {
  version: 1;
  projectId: string;
  lookupCustomerId: string;
  canonicalCustomerId: string | null;
  aliases: string[];
};

export type RevenueCatV2ExecutorGateway = {
  /**
   * Idempotently persists domain-separated keyed-HMAC tombstones and scrubs
   * current webhook rows with the raw family transiently. The adapter must not
   * persist raw identities outside the encrypted step payload.
   */
  establishIdentityBarrier: (
    claim: AccountDeletionClaim,
    snapshot: RevenueCatV2IdentityBarrierSnapshot,
  ) => Promise<{
    established: true;
    tombstoneVersion: 1;
    identityCount: number;
  }>;
  /**
   * Records one complete provider-absence round using the database clock. The
   * database owns the minimum interval and terminal two-round requirement.
   */
  recordAbsenceObservation: (claim: AccountDeletionClaim) => Promise<{
    confirmed: boolean;
    observationCount: 1 | 2;
  }>;
  /** Clears an earlier absence round after the provider family reappears. */
  resetAbsenceObservations: (claim: AccountDeletionClaim) => Promise<{ reset: true }>;
  markRequestStarted: (claim: AccountDeletionClaim) => Promise<{ requestStartedAt: string }>;
  recordOutcome: (claim: AccountDeletionClaim, outcome: RevenueCatV2StepOutcome) => Promise<void>;
};

export type RevenueCatV2ExecutorClock = { nowMs: () => number };

export type RevenueCatV2DeletionExecutorOptions = {
  projectId: string;
  secretApiKey: string;
  gateway: RevenueCatV2ExecutorGateway;
  network: RevenueCatV2ExecutorNetwork;
  stateStore: RevenueCatV2ExecutorStateStore;
  clock: RevenueCatV2ExecutorClock;
  maxRequests: number;
  retryDelayMs: number;
  deadlineReserveMs: number;
};

type ResolvedRevenueCatV2DeletionExecutorOptions = RevenueCatV2DeletionExecutorOptions & {
  credentialBinding: string;
};

export class RevenueCatV2DeletionExecutorError extends Error {
  constructor(
    public readonly code:
      | 'REVENUECAT_V2_EXECUTOR_INPUT_INVALID'
      | 'REVENUECAT_V2_EXECUTOR_STATE_INVALID'
      | 'REVENUECAT_V2_EXECUTOR_RESPONSE_INVALID',
  ) {
    super(code);
    this.name = 'RevenueCatV2DeletionExecutorError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return (
    actualKeys.length === expected.length &&
    actualKeys.every((key, index) => key === expected[index])
  );
}

function exactBoundedString(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximum &&
    value === value.trim()
  );
}

/** Domain-separated fingerprint of the exact configured key; never the key. */
export async function deriveRevenueCatV2CredentialBinding(secretApiKey: string): Promise<string> {
  if (!exactBoundedString(secretApiKey, 1_000)) {
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_INPUT_INVALID');
  }
  try {
    const digest = new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        UTF8_ENCODER.encode(
          'onskin:account-deletion:revenuecat-v2-credential:v1\u0000' + secretApiKey,
        ),
      ),
    );
    return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    if (error instanceof RevenueCatV2DeletionExecutorError) throw error;
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_INPUT_INVALID');
  }
}

/** Domain-separated fingerprint of one worker claim; never persists the bearer token. */
export async function deriveRevenueCatV2ClaimBinding(claimToken: string): Promise<string> {
  if (!CLAIM_TOKEN_PATTERN.test(claimToken)) {
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_INPUT_INVALID');
  }
  try {
    const digest = new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        UTF8_ENCODER.encode(
          'onskin:account-deletion:revenuecat-v2-observation-claim:v1\u0000' + claimToken,
        ),
      ),
    );
    return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    if (error instanceof RevenueCatV2DeletionExecutorError) throw error;
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_INPUT_INVALID');
  }
}

function canonicalUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function wireTimestamp(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length < 20 ||
    value.length > 40 ||
    value !== value.trim() ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  ) {
    return false;
  }
  return Number.isFinite(Date.parse(value));
}

function canonicalizeWireTimestamp(value: string): string {
  if (!wireTimestamp(value)) {
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_RESPONSE_INVALID');
  }
  return new Date(Date.parse(value)).toISOString();
}

function timestampMs(value: string): number {
  return Date.parse(value);
}

function validCredentialBinding(value: unknown): value is string {
  return typeof value === 'string' && CREDENTIAL_BINDING_PATTERN.test(value);
}

function validProjectVisibility(
  value: unknown,
  expectedProjectId?: string,
): value is RevenueCatV2ProjectVisibilityEvidence {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['projectId', 'projectCreatedAt', 'observedAt']) &&
    exactBoundedString(value.projectId, MAX_PROJECT_ID_CHARS) &&
    (expectedProjectId === undefined || value.projectId === expectedProjectId) &&
    nonNegativeSafeInteger(value.projectCreatedAt) &&
    canonicalTimestamp(value.observedAt)
  );
}

function validCustomerFound(
  value: unknown,
  projectId: string,
  lookupCustomerId: string,
): value is RevenueCatV2CustomerLookupEvidence {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'projectId',
      'lookupCustomerId',
      'customerId',
      'firstSeenAt',
      'lastSeenAt',
      'observedAt',
    ]) &&
    value.projectId === projectId &&
    value.lookupCustomerId === lookupCustomerId &&
    exactBoundedString(value.customerId, MAX_CUSTOMER_ID_CHARS) &&
    nonNegativeSafeInteger(value.firstSeenAt) &&
    (value.lastSeenAt === null ||
      (nonNegativeSafeInteger(value.lastSeenAt) && value.lastSeenAt >= value.firstSeenAt)) &&
    canonicalTimestamp(value.observedAt)
  );
}

function validCustomerAbsence(
  value: unknown,
  projectId: string,
  lookupCustomerId: string,
): value is RevenueCatV2CustomerAbsenceEvidence {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['projectId', 'lookupCustomerId', 'observedAt']) &&
    value.projectId === projectId &&
    value.lookupCustomerId === lookupCustomerId &&
    canonicalTimestamp(value.observedAt)
  );
}

function validCustomerSnapshot(
  value: unknown,
  projectId: string,
  lookupCustomerId: string,
): value is RevenueCatV2CustomerSnapshot {
  if (value === null) return true;
  if (!isRecord(value) || !hasExactKeys(value, ['kind', 'evidence'])) {
    return false;
  }
  return value.kind === 'found'
    ? validCustomerFound(value.evidence, projectId, lookupCustomerId)
    : value.kind === 'absent' && validCustomerAbsence(value.evidence, projectId, lookupCustomerId);
}

function validAliasPages(
  value: unknown,
  customer: RevenueCatV2CustomerLookupEvidence,
): value is RevenueCatV2AliasPageEvidence[] {
  if (!Array.isArray(value) || value.length > MAX_ALIAS_PAGES) return false;
  let cursor: string | null = null;
  let previousObservedAt = timestampMs(customer.observedAt);
  let aliasCount = 0;
  const aliases = new Set<string>();
  for (let pageIndex = 0; pageIndex < value.length; pageIndex += 1) {
    const page = value[pageIndex];
    if (
      !isRecord(page) ||
      !hasExactKeys(page, [
        'projectId',
        'customerId',
        'requestedStartingAfter',
        'nextStartingAfter',
        'aliases',
        'observedAt',
      ]) ||
      page.projectId !== customer.projectId ||
      page.customerId !== customer.customerId ||
      page.requestedStartingAfter !== cursor ||
      (page.nextStartingAfter !== null &&
        !exactBoundedString(page.nextStartingAfter, MAX_CUSTOMER_ID_CHARS)) ||
      !Array.isArray(page.aliases) ||
      page.aliases.length > MAX_PAGE_ALIASES ||
      !canonicalTimestamp(page.observedAt) ||
      timestampMs(page.observedAt) < previousObservedAt ||
      (pageIndex > 0 && value[pageIndex - 1].nextStartingAfter === null)
    ) {
      return false;
    }
    previousObservedAt = timestampMs(page.observedAt);
    for (const alias of page.aliases) {
      if (
        !isRecord(alias) ||
        !hasExactKeys(alias, ['id', 'createdAt']) ||
        !exactBoundedString(alias.id, MAX_CUSTOMER_ID_CHARS) ||
        !nonNegativeSafeInteger(alias.createdAt) ||
        alias.createdAt < customer.firstSeenAt ||
        aliases.has(alias.id)
      ) {
        return false;
      }
      aliases.add(alias.id);
      aliasCount += 1;
    }
    if (
      page.nextStartingAfter !== null &&
      (page.aliases.length === 0 ||
        page.aliases[page.aliases.length - 1].id !== page.nextStartingAfter)
    ) {
      return false;
    }
    cursor = page.nextStartingAfter;
  }
  if (aliasCount > MAX_ALIASES) return false;
  const family = new Set([customer.lookupCustomerId, customer.customerId, ...aliases]);
  return (
    UTF8_ENCODER.encode(customer.projectId + [...family].join('')).byteLength <=
    MAX_EVIDENCE_ID_BYTES
  );
}

function validatePreflightState(
  state: Record<string, unknown>,
): state is RevenueCatV2PreflightExecutorState {
  if (
    !hasExactKeys(state, [
      'version',
      'phase',
      'operationId',
      'credentialBinding',
      'priorAbsenceObservation',
      'providerProbeInFlight',
      'absenceClaimBinding',
      'projectId',
      'lookupCustomerId',
      'projectPageNumber',
      'projectStartingAfter',
      'projectVisibility',
      'customerSnapshot',
      'aliasPages',
    ]) ||
    state.version !== REVENUECAT_V2_EXECUTOR_STATE_VERSION ||
    state.phase !== 'preflight' ||
    !canonicalUuid(state.operationId) ||
    !validCredentialBinding(state.credentialBinding) ||
    typeof state.priorAbsenceObservation !== 'boolean' ||
    typeof state.providerProbeInFlight !== 'boolean' ||
    (state.absenceClaimBinding !== null &&
      (typeof state.absenceClaimBinding !== 'string' ||
        !CLAIM_BINDING_PATTERN.test(state.absenceClaimBinding))) ||
    !exactBoundedString(state.projectId, MAX_PROJECT_ID_CHARS) ||
    !canonicalUuid(state.lookupCustomerId) ||
    typeof state.projectPageNumber !== 'number' ||
    !Number.isInteger(state.projectPageNumber) ||
    state.projectPageNumber < 0 ||
    state.projectPageNumber >= MAX_PROJECT_PAGES ||
    (state.projectStartingAfter !== null &&
      !exactBoundedString(state.projectStartingAfter, MAX_PROJECT_ID_CHARS)) ||
    (state.projectVisibility !== null &&
      !validProjectVisibility(state.projectVisibility, state.projectId)) ||
    !validCustomerSnapshot(state.customerSnapshot, state.projectId, state.lookupCustomerId) ||
    !Array.isArray(state.aliasPages)
  ) {
    return false;
  }
  if (
    state.projectVisibility === null &&
    (state.customerSnapshot !== null ||
      state.aliasPages.length !== 0 ||
      state.absenceClaimBinding !== null)
  ) {
    return false;
  }
  if (
    state.providerProbeInFlight &&
    (state.projectVisibility === null ||
      state.customerSnapshot !== null ||
      state.aliasPages.length !== 0 ||
      state.absenceClaimBinding !== null)
  ) {
    return false;
  }
  if (state.customerSnapshot === null) {
    return state.absenceClaimBinding === null && state.aliasPages.length === 0;
  }
  if (
    timestampMs(state.customerSnapshot.evidence.observedAt) <
    timestampMs(state.projectVisibility!.observedAt)
  ) {
    return false;
  }
  if (state.customerSnapshot.kind === 'absent') {
    return state.absenceClaimBinding !== null && state.aliasPages.length === 0;
  }
  return (
    state.absenceClaimBinding === null &&
    validAliasPages(state.aliasPages, state.customerSnapshot.evidence)
  );
}

function validatePreflightEvidence(value: unknown): value is RevenueCatV2PreflightEvidence {
  try {
    buildRevenueCatV2ReconciliationRequests({
      evidence: value as RevenueCatV2PreflightEvidence,
      secretApiKey: 'state-codec-validation',
    });
    return true;
  } catch {
    return false;
  }
}

function validateAlreadyAbsentState(
  state: Record<string, unknown>,
): state is RevenueCatV2AlreadyAbsentExecutorState {
  if (
    !hasExactKeys(state, [
      'version',
      'phase',
      'operationId',
      'credentialBinding',
      'absenceClaimBinding',
      'projectVisibility',
      'customerAbsence',
    ]) ||
    state.version !== REVENUECAT_V2_EXECUTOR_STATE_VERSION ||
    state.phase !== 'already_absent' ||
    !canonicalUuid(state.operationId) ||
    !validCredentialBinding(state.credentialBinding) ||
    typeof state.absenceClaimBinding !== 'string' ||
    !CLAIM_BINDING_PATTERN.test(state.absenceClaimBinding) ||
    !validProjectVisibility(state.projectVisibility) ||
    !isRecord(state.customerAbsence) ||
    !canonicalUuid(state.customerAbsence.lookupCustomerId) ||
    !validCustomerAbsence(
      state.customerAbsence,
      state.projectVisibility.projectId,
      state.customerAbsence.lookupCustomerId,
    )
  ) {
    return false;
  }
  try {
    return (
      attestRevenueCatV2AlreadyAbsent({
        projectVisibility: state.projectVisibility,
        customerAbsence: state.customerAbsence,
        persisted: true,
      }).resultCode === 'REVENUECAT_V2_ALREADY_ABSENT_VERIFIED'
    );
  } catch {
    return false;
  }
}

function validateReadyParts(
  projectVisibility: unknown,
  preflightEvidence: unknown,
): projectVisibility is RevenueCatV2ProjectVisibilityEvidence {
  return (
    validatePreflightEvidence(preflightEvidence) &&
    validProjectVisibility(projectVisibility, preflightEvidence.projectId) &&
    timestampMs(projectVisibility.observedAt) <=
      timestampMs(preflightEvidence.aliasSnapshotCompletedAt)
  );
}

function validateReadyState(
  state: Record<string, unknown>,
): state is RevenueCatV2ReadyExecutorState {
  return (
    hasExactKeys(state, [
      'version',
      'phase',
      'operationId',
      'credentialBinding',
      'projectVisibility',
      'preflightEvidence',
    ]) &&
    state.version === REVENUECAT_V2_EXECUTOR_STATE_VERSION &&
    state.phase === 'ready' &&
    canonicalUuid(state.operationId) &&
    validCredentialBinding(state.credentialBinding) &&
    validateReadyParts(state.projectVisibility, state.preflightEvidence)
  );
}

function identityRequests(evidence: RevenueCatV2PreflightEvidence) {
  return buildRevenueCatV2ReconciliationRequests({
    evidence,
    secretApiKey: 'state-codec-validation',
  });
}

function validDispatchEvidence(
  value: unknown,
  evidence: RevenueCatV2PreflightEvidence,
): value is RevenueCatV2DispatchEvidence {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['persisted', 'requestStartedAt', 'resultCode', 'deletedAt']) ||
    value.persisted !== true ||
    !canonicalTimestamp(value.requestStartedAt) ||
    timestampMs(value.requestStartedAt) < timestampMs(evidence.aliasSnapshotCompletedAt) ||
    ![
      'REVENUECAT_V2_DELETE_ACKNOWLEDGED',
      'REVENUECAT_V2_DELETE_QUEUED',
      'REVENUECAT_V2_DELETE_ABSENT_RECONCILE',
      'REVENUECAT_V2_DISPATCH_AMBIGUOUS',
    ].includes(value.resultCode as string)
  ) {
    return false;
  }
  const acknowledged =
    value.resultCode === 'REVENUECAT_V2_DELETE_ACKNOWLEDGED' ||
    value.resultCode === 'REVENUECAT_V2_DELETE_QUEUED';
  const hasDeletedAt = nonNegativeSafeInteger(value.deletedAt);
  if (acknowledged !== hasDeletedAt) return false;
  return (
    !hasDeletedAt ||
    (value.deletedAt as number) >=
      Math.max(evidence.firstSeenAt, ...evidence.aliases.map((alias) => alias.createdAt))
  );
}

function validateReconciliationState(
  state: Record<string, unknown>,
): state is RevenueCatV2ReconciliationExecutorState {
  if (
    !hasExactKeys(state, [
      'version',
      'phase',
      'operationId',
      'credentialBinding',
      'roundClaimBinding',
      'projectVisibility',
      'preflightEvidence',
      'dispatchEvidence',
      'presenceResetRequired',
      'providerProbeInFlight',
      'customerObservations',
      'aliasesObservation',
    ]) ||
    state.version !== REVENUECAT_V2_EXECUTOR_STATE_VERSION ||
    state.phase !== 'reconciling' ||
    !canonicalUuid(state.operationId) ||
    !validCredentialBinding(state.credentialBinding) ||
    typeof state.roundClaimBinding !== 'string' ||
    !CLAIM_BINDING_PATTERN.test(state.roundClaimBinding) ||
    !validatePreflightEvidence(state.preflightEvidence) ||
    !validProjectVisibility(state.projectVisibility, state.preflightEvidence.projectId) ||
    timestampMs(state.projectVisibility.observedAt) >
      timestampMs(state.preflightEvidence.aliasSnapshotCompletedAt) ||
    !validDispatchEvidence(state.dispatchEvidence, state.preflightEvidence) ||
    typeof state.presenceResetRequired !== 'boolean' ||
    typeof state.providerProbeInFlight !== 'boolean' ||
    !Array.isArray(state.customerObservations)
  ) {
    return false;
  }
  const requests = identityRequests(state.preflightEvidence);
  if (state.customerObservations.length !== requests.customers.length) {
    return false;
  }
  for (let index = 0; index < state.customerObservations.length; index += 1) {
    const observation = state.customerObservations[index];
    if (observation === null) continue;
    if (
      !isRecord(observation) ||
      !hasExactKeys(observation, ['kind', 'targetIndex', 'targetCustomerId', 'observedAt']) ||
      !['absent', 'present'].includes(observation.kind as string) ||
      observation.targetIndex !== index ||
      observation.targetCustomerId !== requests.customers[index].targetCustomerId ||
      !canonicalTimestamp(observation.observedAt) ||
      timestampMs(observation.observedAt) < timestampMs(state.dispatchEvidence.requestStartedAt)
    ) {
      return false;
    }
  }
  if (state.aliasesObservation !== null) {
    const observation = state.aliasesObservation;
    if (
      !isRecord(observation) ||
      !hasExactKeys(observation, ['kind', 'customerId', 'observedAt']) ||
      !['absent', 'present'].includes(observation.kind as string) ||
      observation.customerId !== state.preflightEvidence.customerId ||
      !canonicalTimestamp(observation.observedAt) ||
      timestampMs(observation.observedAt) < timestampMs(state.dispatchEvidence.requestStartedAt)
    ) {
      return false;
    }
  }
  const hasProviderPresence =
    state.customerObservations.some((observation) => observation?.kind === 'present') ||
    (isRecord(state.aliasesObservation) && state.aliasesObservation.kind === 'present');
  const hasPendingProbeTarget =
    state.customerObservations.some((observation) => observation === null) ||
    state.aliasesObservation === null;
  return (
    state.presenceResetRequired === hasProviderPresence &&
    (!state.providerProbeInFlight || hasPendingProbeTarget)
  );
}

function assertState(value: unknown): asserts value is RevenueCatV2ExecutorState {
  if (!isRecord(value)) {
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_STATE_INVALID');
  }
  const valid =
    value.phase === 'preflight'
      ? validatePreflightState(value)
      : value.phase === 'already_absent'
        ? validateAlreadyAbsentState(value)
        : value.phase === 'ready'
          ? validateReadyState(value)
          : value.phase === 'reconciling'
            ? validateReconciliationState(value)
            : false;
  if (!valid) {
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_STATE_INVALID');
  }
}

function canonicalProjectVisibility(value: RevenueCatV2ProjectVisibilityEvidence) {
  return {
    projectId: value.projectId,
    projectCreatedAt: value.projectCreatedAt,
    observedAt: value.observedAt,
  };
}

function canonicalCustomerFound(value: RevenueCatV2CustomerLookupEvidence) {
  return {
    projectId: value.projectId,
    lookupCustomerId: value.lookupCustomerId,
    customerId: value.customerId,
    firstSeenAt: value.firstSeenAt,
    lastSeenAt: value.lastSeenAt,
    observedAt: value.observedAt,
  };
}

function canonicalCustomerAbsence(value: RevenueCatV2CustomerAbsenceEvidence) {
  return {
    projectId: value.projectId,
    lookupCustomerId: value.lookupCustomerId,
    observedAt: value.observedAt,
  };
}

function canonicalAliasPage(value: RevenueCatV2AliasPageEvidence) {
  return {
    projectId: value.projectId,
    customerId: value.customerId,
    requestedStartingAfter: value.requestedStartingAfter,
    nextStartingAfter: value.nextStartingAfter,
    aliases: value.aliases.map((alias) => ({
      id: alias.id,
      createdAt: alias.createdAt,
    })),
    observedAt: value.observedAt,
  };
}

function canonicalPreflightEvidence(value: RevenueCatV2PreflightEvidence) {
  return {
    version: value.version,
    persisted: value.persisted,
    projectId: value.projectId,
    lookupCustomerId: value.lookupCustomerId,
    customerId: value.customerId,
    firstSeenAt: value.firstSeenAt,
    lastSeenAt: value.lastSeenAt,
    aliasSnapshotCompletedAt: value.aliasSnapshotCompletedAt,
    aliasPageCount: value.aliasPageCount,
    aliases: value.aliases.map((alias) => ({
      id: alias.id,
      createdAt: alias.createdAt,
    })),
  };
}

function canonicalDispatch(value: RevenueCatV2DispatchEvidence) {
  return {
    persisted: value.persisted,
    requestStartedAt: value.requestStartedAt,
    resultCode: value.resultCode,
    deletedAt: value.deletedAt,
  };
}

function canonicalCustomerObservation(value: RevenueCatV2CustomerReconciliationObservation | null) {
  return value === null
    ? null
    : {
        kind: value.kind,
        targetIndex: value.targetIndex,
        targetCustomerId: value.targetCustomerId,
        observedAt: value.observedAt,
      };
}

function canonicalAliasesObservation(value: RevenueCatV2AliasesReconciliationObservation | null) {
  return value === null
    ? null
    : {
        kind: value.kind,
        customerId: value.customerId,
        observedAt: value.observedAt,
      };
}

function canonicalState(value: RevenueCatV2ExecutorState): Record<string, unknown> {
  switch (value.phase) {
    case 'preflight':
      return {
        version: value.version,
        phase: value.phase,
        operationId: value.operationId,
        credentialBinding: value.credentialBinding,
        priorAbsenceObservation: value.priorAbsenceObservation,
        providerProbeInFlight: value.providerProbeInFlight,
        absenceClaimBinding: value.absenceClaimBinding,
        projectId: value.projectId,
        lookupCustomerId: value.lookupCustomerId,
        projectPageNumber: value.projectPageNumber,
        projectStartingAfter: value.projectStartingAfter,
        projectVisibility:
          value.projectVisibility === null
            ? null
            : canonicalProjectVisibility(value.projectVisibility),
        customerSnapshot:
          value.customerSnapshot === null
            ? null
            : value.customerSnapshot.kind === 'found'
              ? {
                  kind: 'found',
                  evidence: canonicalCustomerFound(value.customerSnapshot.evidence),
                }
              : {
                  kind: 'absent',
                  evidence: canonicalCustomerAbsence(value.customerSnapshot.evidence),
                },
        aliasPages: value.aliasPages.map(canonicalAliasPage),
      };
    case 'already_absent':
      return {
        version: value.version,
        phase: value.phase,
        operationId: value.operationId,
        credentialBinding: value.credentialBinding,
        absenceClaimBinding: value.absenceClaimBinding,
        projectVisibility: canonicalProjectVisibility(value.projectVisibility),
        customerAbsence: canonicalCustomerAbsence(value.customerAbsence),
      };
    case 'ready':
      return {
        version: value.version,
        phase: value.phase,
        operationId: value.operationId,
        credentialBinding: value.credentialBinding,
        projectVisibility: canonicalProjectVisibility(value.projectVisibility),
        preflightEvidence: canonicalPreflightEvidence(value.preflightEvidence),
      };
    case 'reconciling':
      return {
        version: value.version,
        phase: value.phase,
        operationId: value.operationId,
        credentialBinding: value.credentialBinding,
        roundClaimBinding: value.roundClaimBinding,
        projectVisibility: canonicalProjectVisibility(value.projectVisibility),
        preflightEvidence: canonicalPreflightEvidence(value.preflightEvidence),
        dispatchEvidence: canonicalDispatch(value.dispatchEvidence),
        presenceResetRequired: value.presenceResetRequired,
        providerProbeInFlight: value.providerProbeInFlight,
        customerObservations: value.customerObservations.map(canonicalCustomerObservation),
        aliasesObservation: canonicalAliasesObservation(value.aliasesObservation),
      };
  }
}

export function encodeRevenueCatV2ExecutorState(value: RevenueCatV2ExecutorState): Uint8Array {
  assertState(value);
  const encoded = UTF8_ENCODER.encode(JSON.stringify(canonicalState(value)));
  if (encoded.byteLength === 0 || encoded.byteLength > REVENUECAT_V2_EXECUTOR_MAX_PLAINTEXT_BYTES) {
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_STATE_INVALID');
  }
  return encoded;
}

export function decodeRevenueCatV2ExecutorState(encoded: Uint8Array): RevenueCatV2ExecutorState {
  if (
    !(encoded instanceof Uint8Array) ||
    encoded.byteLength === 0 ||
    encoded.byteLength > REVENUECAT_V2_EXECUTOR_MAX_PLAINTEXT_BYTES
  ) {
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_STATE_INVALID');
  }
  let text: string;
  let parsed: unknown;
  try {
    text = UTF8_DECODER.decode(encoded);
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_STATE_INVALID');
  }
  assertState(parsed);
  if (JSON.stringify(canonicalState(parsed)) !== text) {
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_STATE_INVALID');
  }
  return parsed;
}

function validOptions(options: unknown): options is RevenueCatV2DeletionExecutorOptions {
  return (
    isRecord(options) &&
    hasExactKeys(options, [
      'projectId',
      'secretApiKey',
      'gateway',
      'network',
      'stateStore',
      'clock',
      'maxRequests',
      'retryDelayMs',
      'deadlineReserveMs',
    ]) &&
    exactBoundedString(options.projectId, MAX_PROJECT_ID_CHARS) &&
    exactBoundedString(options.secretApiKey, 1_000) &&
    isRecord(options.gateway) &&
    hasExactKeys(options.gateway, [
      'establishIdentityBarrier',
      'markRequestStarted',
      'recordAbsenceObservation',
      'recordOutcome',
      'resetAbsenceObservations',
    ]) &&
    typeof options.gateway.establishIdentityBarrier === 'function' &&
    typeof options.gateway.markRequestStarted === 'function' &&
    typeof options.gateway.recordAbsenceObservation === 'function' &&
    typeof options.gateway.recordOutcome === 'function' &&
    typeof options.gateway.resetAbsenceObservations === 'function' &&
    isRecord(options.network) &&
    hasExactKeys(options.network, ['execute', 'reserveMutation']) &&
    typeof options.network.reserveMutation === 'function' &&
    typeof options.network.execute === 'function' &&
    isRecord(options.stateStore) &&
    hasExactKeys(options.stateStore, ['load', 'persist']) &&
    typeof options.stateStore.load === 'function' &&
    typeof options.stateStore.persist === 'function' &&
    isRecord(options.clock) &&
    hasExactKeys(options.clock, ['nowMs']) &&
    typeof options.clock.nowMs === 'function' &&
    typeof options.maxRequests === 'number' &&
    Number.isSafeInteger(options.maxRequests) &&
    options.maxRequests >= 1 &&
    options.maxRequests <= 100 &&
    typeof options.retryDelayMs === 'number' &&
    Number.isSafeInteger(options.retryDelayMs) &&
    options.retryDelayMs >= 1_000 &&
    options.retryDelayMs <= 7 * 86_400_000 &&
    typeof options.deadlineReserveMs === 'number' &&
    Number.isSafeInteger(options.deadlineReserveMs) &&
    options.deadlineReserveMs >= 0 &&
    options.deadlineReserveMs <= 60_000
  );
}

function validClaim(claim: unknown): claim is AccountDeletionClaim {
  if (
    !isRecord(claim) ||
    !hasExactKeys(claim, [
      'operationId',
      'userId',
      'operationState',
      'stepName',
      'stepStatus',
      'claimMode',
      'claimToken',
      'attemptCount',
      'requestStartedAt',
      'leaseExpiresAt',
      'encryptedPayload',
    ])
  )
    return false;
  return (
    canonicalUuid(claim.operationId) &&
    canonicalUuid(claim.userId) &&
    ['pending', 'running', 'action_required'].includes(claim.operationState as string) &&
    claim.stepName === 'revenuecat_delete' &&
    claim.stepStatus === 'leased' &&
    ['dispatch', 'reconcile'].includes(claim.claimMode as string) &&
    typeof claim.claimToken === 'string' &&
    CLAIM_TOKEN_PATTERN.test(claim.claimToken) &&
    typeof claim.attemptCount === 'number' &&
    Number.isSafeInteger(claim.attemptCount) &&
    claim.attemptCount >= 1 &&
    ((claim.claimMode === 'dispatch' && claim.requestStartedAt === null) ||
      (claim.claimMode === 'reconcile' && wireTimestamp(claim.requestStartedAt))) &&
    wireTimestamp(claim.leaseExpiresAt) &&
    (claim.encryptedPayload === null || typeof claim.encryptedPayload === 'string')
  );
}

function validExecutorContext(context: unknown): context is { deadlineAtMs: number } {
  return (
    isRecord(context) &&
    hasExactKeys(context, ['deadlineAtMs']) &&
    typeof context.deadlineAtMs === 'number' &&
    Number.isSafeInteger(context.deadlineAtMs) &&
    context.deadlineAtMs >= 0
  );
}

function checkedNow(clock: RevenueCatV2ExecutorClock): number {
  const value = clock.nowMs();
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_INPUT_INVALID');
  }
  return value;
}

function iso(ms: number): string {
  try {
    return new Date(ms).toISOString();
  } catch {
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_INPUT_INVALID');
  }
}

function validNetworkResponse(value: unknown): value is RevenueCatV2NetworkResponse {
  return (
    isRecord(value) &&
    (hasExactKeys(value, ['status', 'body']) ||
      hasExactKeys(value, ['status', 'body', 'retryAfterMs'])) &&
    typeof value.status === 'number' &&
    Number.isInteger(value.status) &&
    value.status >= 100 &&
    value.status <= 599 &&
    (value.retryAfterMs === undefined ||
      value.retryAfterMs === null ||
      (typeof value.retryAfterMs === 'number' &&
        Number.isSafeInteger(value.retryAfterMs) &&
        value.retryAfterMs >= 0 &&
        value.retryAfterMs <= 7 * 86_400_000))
  );
}

function responseOrThrow(value: unknown): RevenueCatV2NetworkResponse {
  if (!validNetworkResponse(value)) {
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_RESPONSE_INVALID');
  }
  return value;
}

function initialState(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  claim: AccountDeletionClaim,
  priorAbsenceObservation = false,
): RevenueCatV2PreflightExecutorState {
  return {
    version: REVENUECAT_V2_EXECUTOR_STATE_VERSION,
    phase: 'preflight',
    operationId: claim.operationId,
    credentialBinding: options.credentialBinding,
    priorAbsenceObservation,
    providerProbeInFlight: false,
    absenceClaimBinding: null,
    projectId: options.projectId,
    lookupCustomerId: claim.userId,
    projectPageNumber: 0,
    projectStartingAfter: null,
    projectVisibility: null,
    customerSnapshot: null,
    aliasPages: [],
  };
}

function stateMatchesExecution(
  state: RevenueCatV2ExecutorState,
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  claim: AccountDeletionClaim,
): boolean {
  const projectId =
    state.phase === 'preflight'
      ? state.projectId
      : state.phase === 'already_absent'
        ? state.projectVisibility.projectId
        : state.preflightEvidence.projectId;
  const customerId =
    state.phase === 'preflight'
      ? state.lookupCustomerId
      : state.phase === 'already_absent'
        ? state.customerAbsence.lookupCustomerId
        : state.preflightEvidence.lookupCustomerId;
  return (
    state.credentialBinding === options.credentialBinding &&
    state.operationId === claim.operationId &&
    projectId === options.projectId &&
    customerId === claim.userId
  );
}

async function persistState(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  claim: AccountDeletionClaim,
  state: RevenueCatV2ExecutorState,
): Promise<void> {
  await options.stateStore.persist(claim, encodeRevenueCatV2ExecutorState(state));
}

async function record(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  claim: AccountDeletionClaim,
  outcome: RevenueCatV2StepOutcome,
): Promise<void> {
  await options.gateway.recordOutcome(claim, outcome);
}

async function recordActionRequired(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  claim: AccountDeletionClaim,
  resultCode: ProviderResultCode,
): Promise<void> {
  await record(options, claim, { kind: 'action_required', resultCode });
}

function providerRetryAfterMs(response: RevenueCatV2NetworkResponse): number {
  let delay =
    typeof response.retryAfterMs === 'number' && Number.isSafeInteger(response.retryAfterMs)
      ? response.retryAfterMs
      : 0;
  if (
    isRecord(response.body) &&
    typeof response.body.backoff_ms === 'number' &&
    Number.isSafeInteger(response.body.backoff_ms) &&
    response.body.backoff_ms >= 0
  ) {
    delay = Math.max(delay, response.body.backoff_ms);
  }
  return Math.min(delay, MAX_PROVIDER_RETRY_AFTER_MS);
}

function retryAt(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  providerMinimumDelayMs = 0,
): string {
  const now = checkedNow(options.clock);
  const next =
    now +
    Math.max(options.retryDelayMs, Math.min(providerMinimumDelayMs, MAX_PROVIDER_RETRY_AFTER_MS));
  if (!Number.isSafeInteger(next)) {
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_INPUT_INVALID');
  }
  return iso(next);
}

async function recordRetry(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  claim: AccountDeletionClaim,
  resultCode: ProviderResultCode,
  providerMinimumDelayMs = 0,
): Promise<void> {
  await record(options, claim, {
    kind: 'retryable',
    resultCode,
    retryAt: retryAt(options, providerMinimumDelayMs),
  });
}

async function recordAbsenceObservation(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  claim: AccountDeletionClaim,
): Promise<boolean> {
  const result = await options.gateway.recordAbsenceObservation(claim);
  if (
    !isRecord(result) ||
    !hasExactKeys(result, ['confirmed', 'observationCount']) ||
    typeof result.confirmed !== 'boolean' ||
    (result.observationCount !== 1 && result.observationCount !== 2) ||
    result.confirmed !== (result.observationCount === 2)
  ) {
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_RESPONSE_INVALID');
  }
  return result.confirmed;
}

async function resetAbsenceObservations(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  claim: AccountDeletionClaim,
): Promise<void> {
  const result = await options.gateway.resetAbsenceObservations(claim);
  if (!isRecord(result) || !hasExactKeys(result, ['reset']) || result.reset !== true) {
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_RESPONSE_INVALID');
  }
}

type RequestBudget = { used: number };

function hasDeadlineReserve(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  context: { deadlineAtMs: number },
): boolean {
  return checkedNow(options.clock) + options.deadlineReserveMs < context.deadlineAtMs;
}

function canRequest(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  context: { deadlineAtMs: number },
  budget: RequestBudget,
): boolean {
  return budget.used < options.maxRequests && hasDeadlineReserve(options, context);
}

async function executeNetwork(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  request: RevenueCatV2HttpRequest,
  context: { deadlineAtMs: number },
  budget: RequestBudget,
  requestBudgetReserved = false,
): Promise<RevenueCatV2NetworkResponse> {
  budget.used += 1;
  return responseOrThrow(
    await options.network.execute(request, {
      deadlineAtMs: context.deadlineAtMs,
      requestBudgetReserved,
    }),
  );
}

async function budgetRetry(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  claim: AccountDeletionClaim,
  state: RevenueCatV2ExecutorState,
): Promise<void> {
  const resultCode: ProviderResultCode =
    claim.claimMode === 'reconcile' || state.phase === 'reconciling'
      ? 'REVENUECAT_V2_RECONCILIATION_RETRY'
      : state.phase === 'ready'
        ? 'REVENUECAT_V2_RETRY'
        : state.phase === 'preflight' && state.projectVisibility === null
          ? 'REVENUECAT_V2_PROJECT_ATTESTATION_RETRY'
          : 'REVENUECAT_V2_PREFLIGHT_RETRY';
  await recordRetry(options, claim, resultCode);
}

async function loadState(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  claim: AccountDeletionClaim,
): Promise<RevenueCatV2ExecutorState | null> {
  const plaintext = await options.stateStore.load(claim);
  if (plaintext === null) {
    if (claim.encryptedPayload !== null) {
      throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_STATE_INVALID');
    }
    return null;
  }
  if (claim.encryptedPayload === null) {
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_STATE_INVALID');
  }
  return decodeRevenueCatV2ExecutorState(plaintext);
}

async function finishAlreadyAbsent(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  claim: AccountDeletionClaim,
  state: RevenueCatV2AlreadyAbsentExecutorState,
  context: { deadlineAtMs: number },
): Promise<void> {
  if (!hasDeadlineReserve(options, context)) return;
  const terminal = attestRevenueCatV2AlreadyAbsent({
    projectVisibility: state.projectVisibility,
    customerAbsence: state.customerAbsence,
    persisted: true,
  });
  if (terminal.kind !== 'succeeded') {
    await recordActionRequired(options, claim, 'REVENUECAT_V2_PREFLIGHT_UNATTESTED');
    return;
  }
  await establishIdentityBarrier(options, claim, {
    version: 1,
    projectId: state.projectVisibility.projectId,
    lookupCustomerId: state.customerAbsence.lookupCustomerId,
    canonicalCustomerId: null,
    aliases: [],
  });
  // Persist the next-round state before recording this observation. A crash
  // after the DB write must never replay the same persisted provider evidence
  // as a later observation.
  // Conservatively remember that the following database call may have
  // recorded a complete absence round. A later provider reappearance must
  // reset that counter before any DELETE, even if this claim crashes after the
  // database write but before its outcome is recorded.
  await persistState(options, claim, initialState(options, claim, true));
  if (!(await recordAbsenceObservation(options, claim))) {
    await recordRetry(options, claim, 'REVENUECAT_V2_QUIESCENCE_PENDING');
    return;
  }
  // This non-mutating proof intentionally does not mark request_started.
  await record(options, claim, {
    kind: 'succeeded',
    resultCode: terminal.resultCode,
  });
}

async function establishIdentityBarrier(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  claim: AccountDeletionClaim,
  snapshot: RevenueCatV2IdentityBarrierSnapshot,
): Promise<void> {
  const result = await options.gateway.establishIdentityBarrier(claim, snapshot);
  const expectedIdentityCount = new Set([
    snapshot.lookupCustomerId,
    ...(snapshot.canonicalCustomerId === null ? [] : [snapshot.canonicalCustomerId]),
    ...snapshot.aliases,
  ]).size;
  if (
    !isRecord(result) ||
    !hasExactKeys(result, ['established', 'tombstoneVersion', 'identityCount']) ||
    result.established !== true ||
    result.tombstoneVersion !== 1 ||
    result.identityCount !== expectedIdentityCount
  ) {
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_RESPONSE_INVALID');
  }
}

async function advancePreflight(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  claim: AccountDeletionClaim,
  context: { deadlineAtMs: number },
  budget: RequestBudget,
  initial: RevenueCatV2PreflightExecutorState,
  claimBinding: string,
): Promise<void> {
  let state = initial;
  if (state.projectVisibility === null) {
    if (!canRequest(options, context, budget)) {
      await budgetRetry(options, claim, state);
      return;
    }
    const request = buildRevenueCatV2ProjectPageRequest({
      secretApiKey: options.secretApiKey,
      startingAfter: state.projectStartingAfter,
      pageNumber: state.projectPageNumber,
    });
    let disposition;
    let providerMinimumDelayMs = 0;
    try {
      const response = await executeNetwork(options, request, context, budget);
      providerMinimumDelayMs = providerRetryAfterMs(response);
      disposition = classifyRevenueCatV2ProjectPageResponse(
        response.status,
        response.body,
        options.projectId,
        request.requestedStartingAfter,
        request.pageNumber,
        iso(checkedNow(options.clock)),
      );
    } catch (error) {
      if (error instanceof AccountDeletionWorkerCapacityError) throw error;
      if (error instanceof RevenueCatV2DeletionExecutorError) {
        await recordActionRequired(options, claim, 'REVENUECAT_V2_PROJECT_ATTESTATION_UNRESOLVED');
        return;
      }
      disposition = classifyRevenueCatV2ProjectTransportFailure('before_request_started');
    }
    if (disposition.kind === 'retryable') {
      await recordRetry(options, claim, disposition.resultCode, providerMinimumDelayMs);
      return;
    }
    if (disposition.kind === 'action_required') {
      await recordActionRequired(options, claim, disposition.resultCode);
      return;
    }
    if (disposition.kind === 'ambiguous') {
      await recordActionRequired(options, claim, 'REVENUECAT_V2_PROJECT_ATTESTATION_UNRESOLVED');
      return;
    }
    if (disposition.kind === 'continue') {
      state = {
        ...state,
        projectPageNumber: state.projectPageNumber + 1,
        projectStartingAfter: disposition.nextStartingAfter,
      };
      await persistState(options, claim, state);
      if (!canRequest(options, context, budget)) {
        await budgetRetry(options, claim, state);
        return;
      }
      return await advancePreflight(options, claim, context, budget, state, claimBinding);
    }
    state = { ...state, projectVisibility: disposition.transientEvidence };
    await persistState(options, claim, state);
  }

  if (state.customerSnapshot === null) {
    if (!canRequest(options, context, budget)) {
      await budgetRetry(options, claim, state);
      return;
    }
    const request = buildRevenueCatV2CustomerLookupRequest({
      projectId: options.projectId,
      secretApiKey: options.secretApiKey,
      lookupCustomerId: claim.userId,
    });
    state = { ...state, providerProbeInFlight: true };
    // Write ahead before the GET. If the process dies after observing a
    // reappearance but before persisting its disposition, the next claim will
    // conservatively reset any earlier DB absence round before probing again.
    await persistState(options, claim, state);
    let disposition;
    let providerMinimumDelayMs = 0;
    try {
      const response = await executeNetwork(options, request, context, budget);
      providerMinimumDelayMs = providerRetryAfterMs(response);
      disposition = classifyRevenueCatV2CustomerLookupResponse(
        response.status,
        response.body,
        request.expectedProjectId,
        request.lookupCustomerId,
        iso(checkedNow(options.clock)),
      );
    } catch (error) {
      if (error instanceof AccountDeletionWorkerCapacityError) throw error;
      if (error instanceof RevenueCatV2DeletionExecutorError) {
        await recordActionRequired(options, claim, 'REVENUECAT_V2_PREFLIGHT_UNATTESTED');
        return;
      }
      disposition = classifyRevenueCatV2PreflightTransportFailure('before_request_started');
    }
    if (disposition.kind === 'retryable') {
      await recordRetry(options, claim, disposition.resultCode, providerMinimumDelayMs);
      return;
    }
    if (disposition.kind === 'action_required') {
      await recordActionRequired(options, claim, disposition.resultCode);
      return;
    }
    if (disposition.kind === 'ambiguous') {
      await recordActionRequired(options, claim, 'REVENUECAT_V2_PREFLIGHT_UNATTESTED');
      return;
    }
    if (!hasDeadlineReserve(options, context)) return;
    state = {
      ...state,
      providerProbeInFlight: false,
      absenceClaimBinding: disposition.kind === 'absent' ? claimBinding : null,
      customerSnapshot:
        disposition.kind === 'found'
          ? { kind: 'found', evidence: disposition.transientEvidence }
          : { kind: 'absent', evidence: disposition.transientEvidence },
    };
    await persistState(options, claim, state);
  }

  if (state.customerSnapshot?.kind === 'found' && state.priorAbsenceObservation) {
    // The provider family has reappeared after a prior full-family absence may
    // have reached the database. Persisted found evidence plus this flag keeps
    // the reset crash-safe: DELETE remains impossible until the idempotent DB
    // reset succeeds and the cleared flag is durably stored.
    await resetAbsenceObservations(options, claim);
    state = { ...state, priorAbsenceObservation: false };
    await persistState(options, claim, state);
  }

  if (state.projectVisibility === null || state.customerSnapshot === null) {
    await recordActionRequired(options, claim, 'REVENUECAT_V2_PREFLIGHT_UNATTESTED');
    return;
  }
  const projectVisibility = state.projectVisibility;
  const customerSnapshot = state.customerSnapshot;
  if (customerSnapshot.kind === 'absent') {
    const absent: RevenueCatV2AlreadyAbsentExecutorState = {
      version: REVENUECAT_V2_EXECUTOR_STATE_VERSION,
      phase: 'already_absent',
      operationId: state.operationId,
      credentialBinding: state.credentialBinding,
      absenceClaimBinding: state.absenceClaimBinding!,
      projectVisibility,
      customerAbsence: customerSnapshot.evidence,
    };
    await persistState(options, claim, absent);
    await finishAlreadyAbsent(options, claim, absent, context);
    return;
  }

  const customer = customerSnapshot.evidence;
  const aliasSnapshotFinished =
    state.aliasPages.length > 0 &&
    state.aliasPages[state.aliasPages.length - 1].nextStartingAfter === null;
  if (!aliasSnapshotFinished) {
    if (!canRequest(options, context, budget)) {
      await budgetRetry(options, claim, state);
      return;
    }
    const startingAfter =
      state.aliasPages.length === 0
        ? null
        : state.aliasPages[state.aliasPages.length - 1].nextStartingAfter;
    const request = buildRevenueCatV2AliasPageRequest({
      projectId: options.projectId,
      secretApiKey: options.secretApiKey,
      customerId: customer.customerId,
      startingAfter,
    });
    let disposition;
    let providerMinimumDelayMs = 0;
    try {
      const response = await executeNetwork(options, request, context, budget);
      providerMinimumDelayMs = providerRetryAfterMs(response);
      disposition = classifyRevenueCatV2AliasPageResponse(
        response.status,
        response.body,
        request.expectedProjectId,
        request.expectedCustomerId,
        request.requestedStartingAfter,
        iso(checkedNow(options.clock)),
      );
    } catch (error) {
      if (error instanceof AccountDeletionWorkerCapacityError) throw error;
      if (error instanceof RevenueCatV2DeletionExecutorError) {
        await recordActionRequired(options, claim, 'REVENUECAT_V2_ALIAS_SNAPSHOT_UNATTESTED');
        return;
      }
      disposition = classifyRevenueCatV2PreflightTransportFailure('before_request_started');
    }
    if (disposition.kind === 'retryable') {
      await recordRetry(options, claim, disposition.resultCode, providerMinimumDelayMs);
      return;
    }
    if (disposition.kind === 'action_required') {
      await recordActionRequired(options, claim, disposition.resultCode);
      return;
    }
    if (disposition.kind === 'ambiguous') {
      await recordActionRequired(options, claim, 'REVENUECAT_V2_ALIAS_SNAPSHOT_UNATTESTED');
      return;
    }
    state = {
      ...state,
      aliasPages: [...state.aliasPages, disposition.transientEvidence],
    };
    await persistState(options, claim, state);
    if (disposition.transientEvidence.nextStartingAfter !== null) {
      if (!canRequest(options, context, budget)) {
        await budgetRetry(options, claim, state);
        return;
      }
      return await advancePreflight(options, claim, context, budget, state, claimBinding);
    }
  }

  const snapshot = attestRevenueCatV2PreflightSnapshot({
    customer,
    aliasPages: state.aliasPages,
    aliasSnapshotCompletedAt: iso(checkedNow(options.clock)),
    persisted: true,
  });
  if (snapshot.kind !== 'ready') {
    await recordActionRequired(options, claim, snapshot.resultCode);
    return;
  }
  const ready: RevenueCatV2ReadyExecutorState = {
    version: REVENUECAT_V2_EXECUTOR_STATE_VERSION,
    phase: 'ready',
    operationId: state.operationId,
    credentialBinding: state.credentialBinding,
    projectVisibility,
    preflightEvidence: snapshot.evidence,
  };
  // This is the required durable boundary before request_started and DELETE.
  await persistState(options, claim, ready);
  if (!canRequest(options, context, budget)) {
    await budgetRetry(options, claim, ready);
    return;
  }
  await dispatchDelete(options, claim, context, budget, ready, claimBinding);
}

function blankReconciliation(
  ready: RevenueCatV2ReadyExecutorState,
  dispatchEvidence: RevenueCatV2DispatchEvidence,
  roundClaimBinding: string,
): RevenueCatV2ReconciliationExecutorState {
  const requests = identityRequests(ready.preflightEvidence);
  return {
    version: REVENUECAT_V2_EXECUTOR_STATE_VERSION,
    phase: 'reconciling',
    operationId: ready.operationId,
    credentialBinding: ready.credentialBinding,
    roundClaimBinding,
    projectVisibility: ready.projectVisibility,
    preflightEvidence: ready.preflightEvidence,
    dispatchEvidence,
    presenceResetRequired: false,
    providerProbeInFlight: false,
    customerObservations: requests.customers.map(() => null),
    aliasesObservation: null,
  };
}

async function persistAndTransitionToReconciliation(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  claim: AccountDeletionClaim,
  state: RevenueCatV2ReconciliationExecutorState,
  retryAtValue: string | null = null,
): Promise<void> {
  await persistState(options, claim, state);
  await record(options, claim, {
    kind: 'ambiguous',
    resultCode: state.dispatchEvidence.resultCode,
    ...(retryAtValue === null ? {} : { retryAt: retryAtValue }),
  });
}

async function dispatchDelete(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  claim: AccountDeletionClaim,
  context: { deadlineAtMs: number },
  budget: RequestBudget,
  ready: RevenueCatV2ReadyExecutorState,
  claimBinding: string,
): Promise<void> {
  if (claim.claimMode !== 'dispatch' || claim.requestStartedAt !== null) {
    await recordActionRequired(options, claim, 'REVENUECAT_V2_TERMINAL_VERIFICATION_UNRESOLVED');
    return;
  }
  await establishIdentityBarrier(options, claim, {
    version: 1,
    projectId: ready.preflightEvidence.projectId,
    lookupCustomerId: ready.preflightEvidence.lookupCustomerId,
    canonicalCustomerId: ready.preflightEvidence.customerId,
    aliases: ready.preflightEvidence.aliases.map((alias) => alias.id),
  });
  if (!canRequest(options, context, budget)) {
    await budgetRetry(options, claim, ready);
    return;
  }
  const request = buildRevenueCatV2DeleteRequest({
    evidence: ready.preflightEvidence,
    secretApiKey: options.secretApiKey,
  });
  // Distributed provider capacity must be acquired while the step is still
  // safely dispatchable. Once request_started is recorded, no quota failure is
  // allowed to turn an unsent DELETE into durable ambiguity.
  await options.network.reserveMutation({ deadlineAtMs: context.deadlineAtMs });
  if (!canRequest(options, context, budget)) {
    await budgetRetry(options, claim, ready);
    return;
  }
  const started = await options.gateway.markRequestStarted(claim);
  if (
    !isRecord(started) ||
    !hasExactKeys(started, ['requestStartedAt']) ||
    !wireTimestamp(started.requestStartedAt) ||
    timestampMs(started.requestStartedAt) <
      timestampMs(ready.preflightEvidence.aliasSnapshotCompletedAt)
  ) {
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_RESPONSE_INVALID');
  }

  let disposition;
  let providerMinimumDelayMs = 0;
  try {
    const response = await executeNetwork(options, request, context, budget, true);
    providerMinimumDelayMs = providerRetryAfterMs(response);
    disposition = classifyRevenueCatV2DeleteResponse(
      response.status,
      response.body,
      ready.preflightEvidence,
    );
  } catch (error) {
    if (error instanceof AccountDeletionWorkerCapacityError) throw error;
    disposition = classifyRevenueCatV2TransportFailure('after_request_started');
  }

  if (disposition.kind === 'action_required') {
    await recordActionRequired(options, claim, disposition.resultCode);
    return;
  }
  const resultCode: RevenueCatV2DispatchEvidence['resultCode'] =
    disposition.kind === 'verification_required'
      ? disposition.resultCode
      : 'REVENUECAT_V2_DISPATCH_AMBIGUOUS';
  const deletedAt =
    disposition.kind === 'verification_required' ? disposition.acknowledgement.deletedAt : null;
  const dispatchEvidence: RevenueCatV2DispatchEvidence = {
    persisted: true,
    requestStartedAt: canonicalizeWireTimestamp(started.requestStartedAt),
    resultCode,
    deletedAt,
  };
  await persistAndTransitionToReconciliation(
    options,
    claim,
    blankReconciliation(ready, dispatchEvidence, claimBinding),
    providerMinimumDelayMs > 0 ? retryAt(options, providerMinimumDelayMs) : null,
  );
}

async function reconcile(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  claim: AccountDeletionClaim,
  context: { deadlineAtMs: number },
  budget: RequestBudget,
  initial: RevenueCatV2ReconciliationExecutorState,
): Promise<void> {
  let state = initial;
  const requests = buildRevenueCatV2ReconciliationRequests({
    evidence: state.preflightEvidence,
    secretApiKey: options.secretApiKey,
  });
  while (state.customerObservations.some((observation) => observation === null)) {
    if (!canRequest(options, context, budget)) {
      await budgetRetry(options, claim, state);
      return;
    }
    const availableRequests = options.maxRequests - budget.used;
    const batchIndexes = state.customerObservations
      .map((observation, index) => (observation === null ? index : -1))
      .filter((index) => index >= 0)
      .slice(0, Math.min(REVENUECAT_V2_MAX_RECONCILIATION_CONCURRENCY, availableRequests));
    if (batchIndexes.length === 0) {
      await budgetRetry(options, claim, state);
      return;
    }
    state = { ...state, providerProbeInFlight: true };
    await persistState(options, claim, state);
    const batchResults = await Promise.all(
      batchIndexes.map(async (index) => {
        try {
          const response = await executeNetwork(
            options,
            requests.customers[index],
            context,
            budget,
          );
          return {
            index,
            error: null,
            providerMinimumDelayMs: providerRetryAfterMs(response),
            disposition: classifyRevenueCatV2CustomerReconciliationResponse(
              response.status,
              response.body,
              state.preflightEvidence,
              index,
              iso(checkedNow(options.clock)),
            ),
          };
        } catch (error) {
          return { index, error, providerMinimumDelayMs: 0, disposition: null };
        }
      }),
    );
    const capacityFailure = batchResults.find(
      (result) => result.error instanceof AccountDeletionWorkerCapacityError,
    );
    if (capacityFailure?.error instanceof AccountDeletionWorkerCapacityError) {
      throw capacityFailure.error;
    }
    const observations = [...state.customerObservations];
    let providerPresence = state.presenceResetRequired;
    let retryableResultCode: ProviderResultCode | null = null;
    let retryableMinimumDelayMs = 0;
    let actionRequiredResultCode: ProviderResultCode | null = null;
    let unresolved = false;
    for (const result of batchResults) {
      let disposition = result.disposition;
      if (result.error instanceof RevenueCatV2DeletionExecutorError) {
        unresolved = true;
        continue;
      }
      if (result.error !== null) {
        disposition = classifyRevenueCatV2ReconciliationTransportFailure('before_request_started');
      }
      if (disposition === null) {
        unresolved = true;
        continue;
      }
      if (disposition.kind === 'retryable') {
        retryableResultCode ??= disposition.resultCode;
        retryableMinimumDelayMs = Math.max(retryableMinimumDelayMs, result.providerMinimumDelayMs);
        continue;
      }
      if (disposition.kind === 'action_required') {
        actionRequiredResultCode ??= disposition.resultCode;
        continue;
      }
      if (disposition.kind === 'ambiguous') {
        unresolved = true;
        continue;
      }
      observations[result.index] = disposition;
      providerPresence = providerPresence || disposition.kind === 'present';
    }
    if (actionRequiredResultCode !== null) {
      await recordActionRequired(options, claim, actionRequiredResultCode);
      return;
    }
    if (unresolved) {
      await recordActionRequired(options, claim, 'REVENUECAT_V2_TERMINAL_VERIFICATION_UNRESOLVED');
      return;
    }
    if (retryableResultCode !== null) {
      await recordRetry(options, claim, retryableResultCode, retryableMinimumDelayMs);
      return;
    }
    if (!hasDeadlineReserve(options, context)) return;
    state = {
      ...state,
      presenceResetRequired: providerPresence,
      providerProbeInFlight: false,
      customerObservations: observations,
    };
    await persistState(options, claim, state);
  }

  if (state.aliasesObservation === null) {
    if (!canRequest(options, context, budget)) {
      await budgetRetry(options, claim, state);
      return;
    }
    state = { ...state, providerProbeInFlight: true };
    await persistState(options, claim, state);
    let disposition;
    let providerMinimumDelayMs = 0;
    try {
      const response = await executeNetwork(options, requests.aliases, context, budget);
      providerMinimumDelayMs = providerRetryAfterMs(response);
      disposition = classifyRevenueCatV2AliasesReconciliationResponse(
        response.status,
        response.body,
        state.preflightEvidence,
        iso(checkedNow(options.clock)),
      );
    } catch (error) {
      if (error instanceof AccountDeletionWorkerCapacityError) throw error;
      if (error instanceof RevenueCatV2DeletionExecutorError) {
        await recordActionRequired(
          options,
          claim,
          'REVENUECAT_V2_TERMINAL_VERIFICATION_UNRESOLVED',
        );
        return;
      }
      disposition = classifyRevenueCatV2ReconciliationTransportFailure('before_request_started');
    }
    if (disposition.kind === 'retryable') {
      await recordRetry(options, claim, disposition.resultCode, providerMinimumDelayMs);
      return;
    }
    if (disposition.kind === 'action_required') {
      await recordActionRequired(options, claim, disposition.resultCode);
      return;
    }
    if (disposition.kind === 'ambiguous') {
      await recordActionRequired(options, claim, 'REVENUECAT_V2_TERMINAL_VERIFICATION_UNRESOLVED');
      return;
    }
    if (!hasDeadlineReserve(options, context)) return;
    state = {
      ...state,
      presenceResetRequired: state.presenceResetRequired || disposition.kind === 'present',
      providerProbeInFlight: false,
      aliasesObservation: disposition,
    };
    await persistState(options, claim, state);
  }

  if (state.aliasesObservation === null) {
    await recordActionRequired(options, claim, 'REVENUECAT_V2_TERMINAL_VERIFICATION_UNRESOLVED');
    return;
  }

  const terminal = attestRevenueCatV2Deletion({
    preflightEvidence: state.preflightEvidence,
    dispatchEvidence: state.dispatchEvidence,
    reconciliationEvidence: {
      persisted: true,
      customerObservations:
        state.customerObservations as RevenueCatV2CustomerReconciliationObservation[],
      aliasesObservation: state.aliasesObservation,
    },
  });
  if (!hasDeadlineReserve(options, context)) return;
  if (terminal.kind === 'succeeded') {
    const reset: RevenueCatV2ReconciliationExecutorState = {
      ...state,
      presenceResetRequired: false,
      providerProbeInFlight: false,
      customerObservations: state.customerObservations.map(() => null),
      aliasesObservation: null,
    };
    // Consume the provider evidence before its DB observation is recorded. If
    // any later durable transition fails, recovery performs an extra full
    // round instead of counting the same round twice.
    await persistState(options, claim, reset);
    if (!(await recordAbsenceObservation(options, claim))) {
      await recordRetry(options, claim, 'REVENUECAT_V2_QUIESCENCE_PENDING');
      return;
    }
    await record(options, claim, {
      kind: 'succeeded',
      resultCode: terminal.resultCode,
    });
    return;
  }
  await resetAbsenceObservations(options, claim);
  const reset: RevenueCatV2ReconciliationExecutorState = {
    ...state,
    presenceResetRequired: false,
    providerProbeInFlight: false,
    customerObservations: state.customerObservations.map(() => null),
    aliasesObservation: null,
  };
  // Persist the new observation round before releasing the reconciliation lease.
  await persistState(options, claim, reset);
  await recordRetry(options, claim, terminal.resultCode);
}

async function executeRevenueCatV2Deletion(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  claim: AccountDeletionClaim,
  context: { deadlineAtMs: number },
): Promise<void> {
  if (!validClaim(claim) || !validExecutorContext(context)) {
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_INPUT_INVALID');
  }
  const claimBinding = await deriveRevenueCatV2ClaimBinding(claim.claimToken);
  const budget: RequestBudget = { used: 0 };
  let state: RevenueCatV2ExecutorState | null;
  try {
    state = await loadState(options, claim);
  } catch {
    await recordActionRequired(
      options,
      claim,
      claim.claimMode === 'reconcile'
        ? 'REVENUECAT_V2_TERMINAL_VERIFICATION_UNRESOLVED'
        : 'REVENUECAT_V2_PREFLIGHT_UNATTESTED',
    );
    return;
  }

  if (state === null) {
    if (claim.claimMode !== 'dispatch') {
      await recordActionRequired(options, claim, 'REVENUECAT_V2_TERMINAL_VERIFICATION_UNRESOLVED');
      return;
    }
    state = initialState(options, claim);
    await persistState(options, claim, state);
  }
  if (!stateMatchesExecution(state, options, claim)) {
    await recordActionRequired(options, claim, 'REVENUECAT_V2_CONFIGURATION_REQUIRED');
    return;
  }

  if (claim.claimMode === 'reconcile') {
    if (state.phase === 'ready') {
      const dispatchEvidence: RevenueCatV2DispatchEvidence = {
        persisted: true,
        requestStartedAt: canonicalizeWireTimestamp(claim.requestStartedAt!),
        resultCode: 'REVENUECAT_V2_DISPATCH_AMBIGUOUS',
        deletedAt: null,
      };
      state = blankReconciliation(state, dispatchEvidence, claimBinding);
      await persistState(options, claim, state);
    }
    if (state.phase !== 'reconciling') {
      await recordActionRequired(options, claim, 'REVENUECAT_V2_TERMINAL_VERIFICATION_UNRESOLVED');
      return;
    }
    if (state.presenceResetRequired || state.providerProbeInFlight) {
      // Persisted presence, or a write-ahead probe whose result was not durably
      // stored, invalidates every earlier database absence observation. Keep
      // the flag durable until the idempotent reset and blank round persist.
      await resetAbsenceObservations(options, claim);
      state = {
        ...state,
        roundClaimBinding: claimBinding,
        presenceResetRequired: false,
        providerProbeInFlight: false,
        customerObservations: state.customerObservations.map(() => null),
        aliasesObservation: null,
      };
      await persistState(options, claim, state);
    } else if (state.roundClaimBinding !== claimBinding) {
      state = {
        ...state,
        roundClaimBinding: claimBinding,
        presenceResetRequired: false,
        providerProbeInFlight: false,
        customerObservations: state.customerObservations.map(() => null),
        aliasesObservation: null,
      };
      // No provider evidence may span worker claims. Persist the blank round
      // before the first GET so a lost/expired claim can never lend an old 404
      // to a later full-family absence attestation.
      await persistState(options, claim, state);
    }
    await reconcile(options, claim, context, budget, state);
    return;
  }

  if (state.phase === 'preflight' && state.providerProbeInFlight) {
    // The prior process may have observed a reappearance without persisting
    // the response. Reset conservatively before another GET or any DELETE.
    await resetAbsenceObservations(options, claim);
    state = {
      ...state,
      priorAbsenceObservation: false,
      providerProbeInFlight: false,
    };
    await persistState(options, claim, state);
  }

  if (
    state.phase === 'preflight' &&
    state.customerSnapshot?.kind === 'absent' &&
    state.absenceClaimBinding !== claimBinding
  ) {
    state = {
      ...state,
      absenceClaimBinding: null,
      customerSnapshot: null,
      aliasPages: [],
    };
    // Keep completed project pagination, but never lend a customer 404 to a
    // later claim. Persist the cleared snapshot before re-reading the customer.
    await persistState(options, claim, state);
  } else if (state.phase === 'already_absent' && state.absenceClaimBinding !== claimBinding) {
    state = {
      version: REVENUECAT_V2_EXECUTOR_STATE_VERSION,
      phase: 'preflight',
      operationId: state.operationId,
      credentialBinding: state.credentialBinding,
      priorAbsenceObservation: true,
      providerProbeInFlight: false,
      absenceClaimBinding: null,
      projectId: state.projectVisibility.projectId,
      lookupCustomerId: state.customerAbsence.lookupCustomerId,
      projectPageNumber: 0,
      projectStartingAfter: null,
      projectVisibility: state.projectVisibility,
      customerSnapshot: null,
      aliasPages: [],
    };
    await persistState(options, claim, state);
  }

  if (state.phase === 'already_absent') {
    await finishAlreadyAbsent(options, claim, state, context);
    return;
  }
  if (state.phase === 'preflight') {
    await advancePreflight(options, claim, context, budget, state, claimBinding);
    return;
  }
  if (state.phase === 'ready') {
    if (!canRequest(options, context, budget)) {
      await budgetRetry(options, claim, state);
      return;
    }
    await dispatchDelete(options, claim, context, budget, state, claimBinding);
    return;
  }
  await recordActionRequired(options, claim, 'REVENUECAT_V2_TERMINAL_VERIFICATION_UNRESOLVED');
}

export function createRevenueCatV2DeletionExecutor(
  options: RevenueCatV2DeletionExecutorOptions,
): AccountDeletionStepExecutor {
  if (!validOptions(options)) {
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_INPUT_INVALID');
  }
  let credentialBinding: Promise<string> | null = null;
  const stableOptions: RevenueCatV2DeletionExecutorOptions = {
    projectId: options.projectId,
    secretApiKey: options.secretApiKey,
    gateway: options.gateway,
    network: options.network,
    stateStore: options.stateStore,
    clock: options.clock,
    maxRequests: options.maxRequests,
    retryDelayMs: options.retryDelayMs,
    deadlineReserveMs: options.deadlineReserveMs,
  };
  return async (claim, context) => {
    credentialBinding ??= deriveRevenueCatV2CredentialBinding(stableOptions.secretApiKey);
    const resolved: ResolvedRevenueCatV2DeletionExecutorOptions = {
      ...stableOptions,
      credentialBinding: await credentialBinding,
    };
    await executeRevenueCatV2Deletion(resolved, claim, context);
  };
}
