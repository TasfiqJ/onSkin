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
  type AccountDeletionClaim,
  type AccountDeletionStepExecutor,
} from './durableDeletionWorker.ts';

export const REVENUECAT_V2_EXECUTOR_STATE_VERSION = 1 as const;
export const REVENUECAT_V2_EXECUTOR_MAX_PLAINTEXT_BYTES = 24_518;

const MAX_PROJECT_ID_CHARS = 255;
const MAX_CUSTOMER_ID_CHARS = 1_500;
const MAX_PROJECT_PAGES = 50;
const MAX_ALIAS_PAGES = 50;
const MAX_ALIASES = 64;
const MAX_PAGE_ALIASES = 20;
const MAX_EVIDENCE_ID_BYTES = 4_096;
const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const CREDENTIAL_BINDING_PATTERN = /^[a-f0-9]{64}$/;
const CLAIM_TOKEN_PATTERN = /^[a-f0-9]{64}$/;
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
  projectVisibility: RevenueCatV2ProjectVisibilityEvidence;
  preflightEvidence: RevenueCatV2PreflightEvidence;
  dispatchEvidence: RevenueCatV2DispatchEvidence;
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
};

export type RevenueCatV2ExecutorNetwork = {
  /** The adapter owns timeout, response-size limits, and bounded JSON parsing. */
  execute: (
    request: RevenueCatV2HttpRequest,
    context: { deadlineAtMs: number },
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
  | { kind: 'ambiguous'; resultCode: ProviderResultCode }
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
      'projectId',
      'lookupCustomerId',
      'projectPageNumber',
      'projectStartingAfter',
      'projectVisibility',
      'customerSnapshot',
      'aliasPages',
    ]) ||
    state.version !== 1 ||
    state.phase !== 'preflight' ||
    !canonicalUuid(state.operationId) ||
    !validCredentialBinding(state.credentialBinding) ||
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
    (state.customerSnapshot !== null || state.aliasPages.length !== 0)
  ) {
    return false;
  }
  if (state.customerSnapshot === null) return state.aliasPages.length === 0;
  if (
    timestampMs(state.customerSnapshot.evidence.observedAt) <
    timestampMs(state.projectVisibility!.observedAt)
  ) {
    return false;
  }
  if (state.customerSnapshot.kind === 'absent') {
    return state.aliasPages.length === 0;
  }
  return validAliasPages(state.aliasPages, state.customerSnapshot.evidence);
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
      'projectVisibility',
      'customerAbsence',
    ]) ||
    state.version !== 1 ||
    state.phase !== 'already_absent' ||
    !canonicalUuid(state.operationId) ||
    !validCredentialBinding(state.credentialBinding) ||
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
    state.version === 1 &&
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
      'projectVisibility',
      'preflightEvidence',
      'dispatchEvidence',
      'customerObservations',
      'aliasesObservation',
    ]) ||
    state.version !== 1 ||
    state.phase !== 'reconciling' ||
    !canonicalUuid(state.operationId) ||
    !validCredentialBinding(state.credentialBinding) ||
    !validatePreflightEvidence(state.preflightEvidence) ||
    !validProjectVisibility(state.projectVisibility, state.preflightEvidence.projectId) ||
    timestampMs(state.projectVisibility.observedAt) >
      timestampMs(state.preflightEvidence.aliasSnapshotCompletedAt) ||
    !validDispatchEvidence(state.dispatchEvidence, state.preflightEvidence) ||
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
  return true;
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
        projectVisibility: canonicalProjectVisibility(value.projectVisibility),
        preflightEvidence: canonicalPreflightEvidence(value.preflightEvidence),
        dispatchEvidence: canonicalDispatch(value.dispatchEvidence),
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
      'recordOutcome',
    ]) &&
    typeof options.gateway.establishIdentityBarrier === 'function' &&
    typeof options.gateway.markRequestStarted === 'function' &&
    typeof options.gateway.recordOutcome === 'function' &&
    isRecord(options.network) &&
    hasExactKeys(options.network, ['execute']) &&
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
    hasExactKeys(value, ['status', 'body']) &&
    typeof value.status === 'number' &&
    Number.isInteger(value.status) &&
    value.status >= 100 &&
    value.status <= 599
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
): RevenueCatV2PreflightExecutorState {
  return {
    version: 1,
    phase: 'preflight',
    operationId: claim.operationId,
    credentialBinding: options.credentialBinding,
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

function retryAt(options: ResolvedRevenueCatV2DeletionExecutorOptions): string {
  const now = checkedNow(options.clock);
  const next = now + options.retryDelayMs;
  if (!Number.isSafeInteger(next)) {
    throw new RevenueCatV2DeletionExecutorError('REVENUECAT_V2_EXECUTOR_INPUT_INVALID');
  }
  return iso(next);
}

async function recordRetry(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  claim: AccountDeletionClaim,
  resultCode: ProviderResultCode,
): Promise<void> {
  await record(options, claim, {
    kind: 'retryable',
    resultCode,
    retryAt: retryAt(options),
  });
}

type RequestBudget = { used: number };

function canRequest(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  context: { deadlineAtMs: number },
  budget: RequestBudget,
): boolean {
  const now = checkedNow(options.clock);
  return (
    budget.used < options.maxRequests && now + options.deadlineReserveMs < context.deadlineAtMs
  );
}

async function executeNetwork(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  request: RevenueCatV2HttpRequest,
  context: { deadlineAtMs: number },
  budget: RequestBudget,
): Promise<RevenueCatV2NetworkResponse> {
  budget.used += 1;
  return responseOrThrow(
    await options.network.execute(request, {
      deadlineAtMs: context.deadlineAtMs,
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
): Promise<void> {
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
    try {
      const response = await executeNetwork(options, request, context, budget);
      disposition = classifyRevenueCatV2ProjectPageResponse(
        response.status,
        response.body,
        options.projectId,
        request.requestedStartingAfter,
        request.pageNumber,
        iso(checkedNow(options.clock)),
      );
    } catch (error) {
      if (error instanceof RevenueCatV2DeletionExecutorError) {
        await recordActionRequired(options, claim, 'REVENUECAT_V2_PROJECT_ATTESTATION_UNRESOLVED');
        return;
      }
      disposition = classifyRevenueCatV2ProjectTransportFailure('before_request_started');
    }
    if (disposition.kind === 'retryable') {
      await recordRetry(options, claim, disposition.resultCode);
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
      return await advancePreflight(options, claim, context, budget, state);
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
    let disposition;
    try {
      const response = await executeNetwork(options, request, context, budget);
      disposition = classifyRevenueCatV2CustomerLookupResponse(
        response.status,
        response.body,
        request.expectedProjectId,
        request.lookupCustomerId,
        iso(checkedNow(options.clock)),
      );
    } catch (error) {
      if (error instanceof RevenueCatV2DeletionExecutorError) {
        await recordActionRequired(options, claim, 'REVENUECAT_V2_PREFLIGHT_UNATTESTED');
        return;
      }
      disposition = classifyRevenueCatV2PreflightTransportFailure('before_request_started');
    }
    if (disposition.kind === 'retryable') {
      await recordRetry(options, claim, disposition.resultCode);
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
    state = {
      ...state,
      customerSnapshot:
        disposition.kind === 'found'
          ? { kind: 'found', evidence: disposition.transientEvidence }
          : { kind: 'absent', evidence: disposition.transientEvidence },
    };
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
      version: 1,
      phase: 'already_absent',
      operationId: state.operationId,
      credentialBinding: state.credentialBinding,
      projectVisibility,
      customerAbsence: customerSnapshot.evidence,
    };
    await persistState(options, claim, absent);
    await finishAlreadyAbsent(options, claim, absent);
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
    try {
      const response = await executeNetwork(options, request, context, budget);
      disposition = classifyRevenueCatV2AliasPageResponse(
        response.status,
        response.body,
        request.expectedProjectId,
        request.expectedCustomerId,
        request.requestedStartingAfter,
        iso(checkedNow(options.clock)),
      );
    } catch (error) {
      if (error instanceof RevenueCatV2DeletionExecutorError) {
        await recordActionRequired(options, claim, 'REVENUECAT_V2_ALIAS_SNAPSHOT_UNATTESTED');
        return;
      }
      disposition = classifyRevenueCatV2PreflightTransportFailure('before_request_started');
    }
    if (disposition.kind === 'retryable') {
      await recordRetry(options, claim, disposition.resultCode);
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
      return await advancePreflight(options, claim, context, budget, state);
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
    version: 1,
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
  await dispatchDelete(options, claim, context, budget, ready);
}

function blankReconciliation(
  ready: RevenueCatV2ReadyExecutorState,
  dispatchEvidence: RevenueCatV2DispatchEvidence,
): RevenueCatV2ReconciliationExecutorState {
  const requests = identityRequests(ready.preflightEvidence);
  return {
    version: 1,
    phase: 'reconciling',
    operationId: ready.operationId,
    credentialBinding: ready.credentialBinding,
    projectVisibility: ready.projectVisibility,
    preflightEvidence: ready.preflightEvidence,
    dispatchEvidence,
    customerObservations: requests.customers.map(() => null),
    aliasesObservation: null,
  };
}

async function persistAndTransitionToReconciliation(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  claim: AccountDeletionClaim,
  state: RevenueCatV2ReconciliationExecutorState,
): Promise<void> {
  await persistState(options, claim, state);
  await record(options, claim, {
    kind: 'ambiguous',
    resultCode: state.dispatchEvidence.resultCode,
  });
}

async function dispatchDelete(
  options: ResolvedRevenueCatV2DeletionExecutorOptions,
  claim: AccountDeletionClaim,
  context: { deadlineAtMs: number },
  budget: RequestBudget,
  ready: RevenueCatV2ReadyExecutorState,
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
  try {
    const response = await executeNetwork(options, request, context, budget);
    disposition = classifyRevenueCatV2DeleteResponse(
      response.status,
      response.body,
      ready.preflightEvidence,
    );
  } catch {
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
    blankReconciliation(ready, dispatchEvidence),
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
  for (let index = 0; index < requests.customers.length; index += 1) {
    if (state.customerObservations[index] !== null) continue;
    if (!canRequest(options, context, budget)) {
      await budgetRetry(options, claim, state);
      return;
    }
    let disposition;
    try {
      const response = await executeNetwork(options, requests.customers[index], context, budget);
      disposition = classifyRevenueCatV2CustomerReconciliationResponse(
        response.status,
        response.body,
        state.preflightEvidence,
        index,
        iso(checkedNow(options.clock)),
      );
    } catch (error) {
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
      await recordRetry(options, claim, disposition.resultCode);
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
    const observations = [...state.customerObservations];
    observations[index] = disposition;
    state = { ...state, customerObservations: observations };
    await persistState(options, claim, state);
  }

  if (state.aliasesObservation === null) {
    if (!canRequest(options, context, budget)) {
      await budgetRetry(options, claim, state);
      return;
    }
    let disposition;
    try {
      const response = await executeNetwork(options, requests.aliases, context, budget);
      disposition = classifyRevenueCatV2AliasesReconciliationResponse(
        response.status,
        response.body,
        state.preflightEvidence,
        iso(checkedNow(options.clock)),
      );
    } catch (error) {
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
      await recordRetry(options, claim, disposition.resultCode);
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
    state = { ...state, aliasesObservation: disposition };
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
  if (terminal.kind === 'succeeded') {
    await record(options, claim, {
      kind: 'succeeded',
      resultCode: terminal.resultCode,
    });
    return;
  }
  const reset: RevenueCatV2ReconciliationExecutorState = {
    ...state,
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
      state = blankReconciliation(state, dispatchEvidence);
      await persistState(options, claim, state);
    }
    if (state.phase !== 'reconciling') {
      await recordActionRequired(options, claim, 'REVENUECAT_V2_TERMINAL_VERIFICATION_UNRESOLVED');
      return;
    }
    await reconcile(options, claim, context, budget, state);
    return;
  }

  if (state.phase === 'already_absent') {
    await finishAlreadyAbsent(options, claim, state);
    return;
  }
  if (state.phase === 'preflight') {
    await advancePreflight(options, claim, context, budget, state);
    return;
  }
  if (state.phase === 'ready') {
    if (!canRequest(options, context, budget)) {
      await budgetRetry(options, claim, state);
      return;
    }
    await dispatchDelete(options, claim, context, budget, state);
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
  const credentialBinding = deriveRevenueCatV2CredentialBinding(options.secretApiKey);
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
    const resolved: ResolvedRevenueCatV2DeletionExecutorOptions = {
      ...stableOptions,
      credentialBinding: await credentialBinding,
    };
    await executeRevenueCatV2Deletion(resolved, claim, context);
  };
}
