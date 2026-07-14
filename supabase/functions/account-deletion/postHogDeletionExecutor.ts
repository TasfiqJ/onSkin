import { maxDeletionPayloadPlaintextBytes } from './durableDeletionCrypto.ts';
import {
  accountDeletionRetryDelaySeconds,
  validDeletionResultCode,
} from './durableDeletionRuntimeCore.ts';
import type { AccountDeletionClaim, AccountDeletionStepExecutor } from './durableDeletionWorker.ts';
import {
  attestPostHogTerminalDeletion,
  buildPostHogBulkDeleteRequest,
  buildPostHogDeletionStatusRequest,
  buildPostHogPersonLookupRequest,
  classifyPostHogBulkDeleteResponse,
  classifyPostHogBulkDeleteTransportFailure,
  classifyPostHogDeletionStatusResponse,
  classifyPostHogPersonLookupResponse,
  type PostHogAbsenceObservation,
  type PostHogCompletedEventEvidence,
  type PostHogEventStatusDisposition,
  type PostHogLookupDisposition,
  type PostHogNoRecordingsEvidence,
} from './durableProviderDeletion.ts';
import { ACCOUNT_DELETION_PROVIDER_RESPONSE_MAX_BYTES } from './providerDeletion.ts';

const STEP_NAME = 'posthog_delete' as const;
const STATE_VERSION = 1 as const;
const MAX_TARGET_PERSON_UUIDS = 2;
const MAX_NETWORK_REQUESTS = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CLAIM_TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const NOT_REQUIRED_ATTESTATION_CONTRACT = 'exact_provider_free_development_v1' as const;
const NOT_REQUIRED_DIGEST_ALGORITHM = 'SHA-256' as const;
const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

/** Honest terminal result for an environment where the existing contract proves PostHog was unused. */
export const POSTHOG_DELETION_NOT_REQUIRED_RESULT_CODE = 'POSTHOG_DELETION_NOT_REQUIRED' as const;

export type PostHogDeletionRecordOutcome =
  | 'succeeded'
  | 'retryable'
  | 'ambiguous'
  | 'action_required';

export type PostHogDeletionRpc = {
  /** Must reject on a lost/expired claim CAS. */
  markRequestStarted(input: {
    operationId: string;
    userId: string;
    stepName: typeof STEP_NAME;
    claimMode: AccountDeletionClaim['claimMode'];
    claimToken: string;
  }): Promise<{ requestStartedAt: string }>;
  /** Must reject on a lost/expired claim CAS. */
  recordStep(input: {
    operationId: string;
    userId: string;
    stepName: typeof STEP_NAME;
    claimMode: AccountDeletionClaim['claimMode'];
    claimToken: string;
    outcome: PostHogDeletionRecordOutcome;
    resultCode: string;
    retryAt: string | null;
  }): Promise<void>;
};

export type PostHogDeletionNetworkResponse = {
  status: number;
  body: unknown;
  /** Raw response bytes, measured before JSON parsing and bounded by the adapter. */
  responseBytes: number;
};

export type PostHogDeletionNetwork = {
  sendJson(
    request: { url: string; init: RequestInit },
    context: { deadlineAtMs: number; requestNumber: number },
  ): Promise<PostHogDeletionNetworkResponse>;
};

/**
 * The adapter decrypts `claim.encryptedPayload` on load and encrypts plus CAS
 * persists the supplied canonical plaintext before save resolves.
 */
export type PostHogDeletionEncryptedStateStore = {
  load(input: {
    operationId: string;
    userId: string;
    stepName: typeof STEP_NAME;
    claimMode: AccountDeletionClaim['claimMode'];
    claimToken: string;
    encryptedPayload: string | null;
  }): Promise<Uint8Array | null>;
  save(input: {
    operationId: string;
    userId: string;
    stepName: typeof STEP_NAME;
    claimMode: AccountDeletionClaim['claimMode'];
    claimToken: string;
    plaintext: Uint8Array;
  }): Promise<void>;
};

export type PostHogDeletionClock = { nowMs(): number };

export type PostHogDeletionExecutorConfiguration = {
  appEnvironment: string | undefined;
  publicAppEnvironment: string | undefined;
  mobileKey: string | undefined;
  host: string | undefined;
  projectId: string | undefined;
  personalApiKey: string | undefined;
  captureShutdownAt: string | undefined;
  minimumAbsenceIntervalSeconds: number;
  maxNetworkRequestsPerInvocation: number;
  noRecordingsEvidence: PostHogNoRecordingsEvidence | undefined;
};

export class PostHogDeletionExecutorError extends Error {
  constructor(
    public readonly code:
      | 'POSTHOG_EXECUTOR_INPUT_INVALID'
      | 'POSTHOG_EXECUTOR_STATE_INVALID'
      | 'POSTHOG_EXECUTOR_DEPENDENCY_FAILED',
  ) {
    super(code);
    this.name = 'PostHogDeletionExecutorError';
  }
}

type NotRequiredState = {
  version: typeof STATE_VERSION;
  mode: 'not_required';
  attestedAt: string;
  configurationAttestation: NotRequiredConfigurationAttestation;
};

type NotRequiredConfigurationAttestation = {
  contract: typeof NOT_REQUIRED_ATTESTATION_CONTRACT;
  digestAlgorithm: typeof NOT_REQUIRED_DIGEST_ALGORITHM;
  digestHex: string;
};

type DispatchEvidence =
  | {
      kind: 'queued';
      resultCode: 'POSTHOG_DELETE_QUEUED';
      requestStartedAt: string;
      observedAt: string;
    }
  | {
      kind: 'ambiguous';
      resultCode: 'POSTHOG_DELETE_DISPATCH_AMBIGUOUS';
      requestStartedAt: string;
      observedAt: string;
    };

type EventStatusObservation =
  | {
      targetIndex: number;
      kind: 'pending';
      resultCode: 'POSTHOG_STATUS_PENDING';
      observedAt: string;
    }
  | {
      targetIndex: number;
      kind: 'missing';
      resultCode: 'POSTHOG_STATUS_MISSING';
      observedAt: string;
    }
  | {
      targetIndex: number;
      kind: 'completed';
      resultCode: 'POSTHOG_STATUS_COMPLETED';
      observedAt: string;
      transientEvidence: PostHogCompletedEventEvidence;
    };

type RequiredState = {
  version: typeof STATE_VERSION;
  mode: 'required';
  targetSetEvidence: {
    personUuids: string[];
    persisted: true;
    capturedAt: string;
  };
  captureShutdownAt: string;
  dispatchCutoffAt: string;
  minimumAbsenceIntervalSeconds: number;
  noRecordingsEvidence: PostHogNoRecordingsEvidence;
  dispatchEvidence: DispatchEvidence | null;
  eventStatusObservations: EventStatusObservation[];
  absenceObservations: PostHogAbsenceObservation[];
  nextStatusIndex: number;
};

type DurablePostHogState = NotRequiredState | RequiredState;

type ProviderConfiguration = {
  host: string;
  projectId: string;
  personalApiKey: string;
};

type InitialRequiredConfiguration = ProviderConfiguration & {
  captureShutdownAt: string;
  minimumAbsenceIntervalSeconds: number;
  noRecordingsEvidence: PostHogNoRecordingsEvidence;
};

type Dependencies = {
  configuration: PostHogDeletionExecutorConfiguration;
  rpc: PostHogDeletionRpc;
  network: PostHogDeletionNetwork;
  encryptedStateStore: PostHogDeletionEncryptedStateStore;
  clock: PostHogDeletionClock;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function exactNonBlank(value: unknown, maximum: number): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maximum ||
    value !== value.trim()
  ) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 31 || codeUnit === 127) return false;
  }
  return true;
}

function canonicalIso(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    return null;
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  try {
    return new Date(milliseconds).toISOString();
  } catch {
    return null;
  }
}

function stateIso(value: unknown): value is string {
  const canonical = canonicalIso(value);
  return canonical !== null && canonical === value;
}

function safeEpoch(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 8_640_000_000_000_000
  );
}

function nowMs(dependencies: Dependencies): number {
  let value: unknown;
  try {
    value = dependencies.clock.nowMs();
  } catch {
    throw new PostHogDeletionExecutorError('POSTHOG_EXECUTOR_DEPENDENCY_FAILED');
  }
  if (!safeEpoch(value)) {
    throw new PostHogDeletionExecutorError('POSTHOG_EXECUTOR_DEPENDENCY_FAILED');
  }
  return value;
}

function nowIso(dependencies: Dependencies): string {
  return new Date(nowMs(dependencies)).toISOString();
}

function validClaim(value: unknown): value is AccountDeletionClaim {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
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
    ]) ||
    typeof value.operationId !== 'string' ||
    !UUID_PATTERN.test(value.operationId) ||
    typeof value.userId !== 'string' ||
    !UUID_PATTERN.test(value.userId) ||
    !['pending', 'running', 'action_required'].includes(String(value.operationState)) ||
    value.stepName !== STEP_NAME ||
    value.stepStatus !== 'leased' ||
    !['dispatch', 'reconcile'].includes(String(value.claimMode)) ||
    typeof value.claimToken !== 'string' ||
    !CLAIM_TOKEN_PATTERN.test(value.claimToken) ||
    !Number.isSafeInteger(value.attemptCount) ||
    (value.attemptCount as number) < 1 ||
    canonicalIso(value.leaseExpiresAt) === null ||
    !(value.encryptedPayload === null || typeof value.encryptedPayload === 'string')
  ) {
    return false;
  }
  if (value.claimMode === 'dispatch') return value.requestStartedAt === null;
  return canonicalIso(value.requestStartedAt) !== null;
}

function assertDependencies(value: unknown): asserts value is Dependencies {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['configuration', 'rpc', 'network', 'encryptedStateStore', 'clock']) ||
    !isRecord(value.configuration) ||
    !hasExactKeys(value.configuration, [
      'appEnvironment',
      'publicAppEnvironment',
      'mobileKey',
      'host',
      'projectId',
      'personalApiKey',
      'captureShutdownAt',
      'minimumAbsenceIntervalSeconds',
      'maxNetworkRequestsPerInvocation',
      'noRecordingsEvidence',
    ]) ||
    !isRecord(value.rpc) ||
    typeof value.rpc.markRequestStarted !== 'function' ||
    typeof value.rpc.recordStep !== 'function' ||
    !isRecord(value.network) ||
    typeof value.network.sendJson !== 'function' ||
    !isRecord(value.encryptedStateStore) ||
    typeof value.encryptedStateStore.load !== 'function' ||
    typeof value.encryptedStateStore.save !== 'function' ||
    !isRecord(value.clock) ||
    typeof value.clock.nowMs !== 'function'
  ) {
    throw new PostHogDeletionExecutorError('POSTHOG_EXECUTOR_INPUT_INVALID');
  }
}

function providerConfiguration(
  configuration: PostHogDeletionExecutorConfiguration,
): ProviderConfiguration | null {
  return exactNonBlank(configuration.host, 500) &&
    exactNonBlank(configuration.projectId, 200) &&
    exactNonBlank(configuration.personalApiKey, 1_000)
    ? {
        host: configuration.host,
        projectId: configuration.projectId,
        personalApiKey: configuration.personalApiKey,
      }
    : null;
}

function initialRequiredConfiguration(
  configuration: PostHogDeletionExecutorConfiguration,
  currentTimeMs: number,
): { value: InitialRequiredConfiguration | null; resultCode: string } {
  const provider = providerConfiguration(configuration);
  const captureShutdownAt = canonicalIso(configuration.captureShutdownAt);
  const evidence = configuration.noRecordingsEvidence;
  const verifiedAt = canonicalIso(evidence?.verifiedAt);
  if (
    provider === null ||
    captureShutdownAt === null ||
    Date.parse(captureShutdownAt) > currentTimeMs ||
    !Number.isSafeInteger(configuration.minimumAbsenceIntervalSeconds) ||
    configuration.minimumAbsenceIntervalSeconds < 1 ||
    configuration.minimumAbsenceIntervalSeconds > 86_400
  ) {
    return {
      value: null,
      resultCode: 'POSTHOG_DELETE_CONFIGURATION_REQUIRED',
    };
  }
  if (
    !isRecord(evidence) ||
    !hasExactKeys(evidence, ['recordingsCollected', 'durable', 'evidence', 'verifiedAt']) ||
    evidence.recordingsCollected !== false ||
    evidence.durable !== true ||
    evidence.evidence !== 'production_capture_disabled_and_storage_audited' ||
    verifiedAt === null ||
    Date.parse(verifiedAt) < Date.parse(captureShutdownAt) ||
    Date.parse(verifiedAt) > currentTimeMs
  ) {
    return {
      value: null,
      resultCode: 'POSTHOG_RECORDING_VERIFICATION_REQUIRED',
    };
  }
  return {
    value: {
      ...provider,
      captureShutdownAt,
      minimumAbsenceIntervalSeconds: configuration.minimumAbsenceIntervalSeconds,
      noRecordingsEvidence: {
        recordingsCollected: false,
        durable: true,
        evidence: 'production_capture_disabled_and_storage_audited',
        verifiedAt,
      },
    },
    resultCode: 'POSTHOG_DELETE_CONFIGURATION_REQUIRED',
  };
}

function validRequestCap(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    (value as number) >= 1 &&
    (value as number) <= MAX_NETWORK_REQUESTS
  );
}

// A skip is valid only for an explicitly named development environment with
// every PostHog signal absent. The canonical snapshot also binds executor
// controls so a durable terminal state cannot float across configuration.
function canonicalProviderFreeDevelopmentConfiguration(
  configuration: PostHogDeletionExecutorConfiguration,
): string | null {
  if (
    configuration.appEnvironment !== 'development' ||
    !(
      configuration.publicAppEnvironment === undefined ||
      configuration.publicAppEnvironment === 'development'
    ) ||
    configuration.mobileKey !== undefined ||
    configuration.host !== undefined ||
    configuration.projectId !== undefined ||
    configuration.personalApiKey !== undefined ||
    configuration.captureShutdownAt !== undefined ||
    configuration.noRecordingsEvidence !== undefined ||
    !Number.isSafeInteger(configuration.minimumAbsenceIntervalSeconds) ||
    configuration.minimumAbsenceIntervalSeconds < 1 ||
    configuration.minimumAbsenceIntervalSeconds > 86_400 ||
    !validRequestCap(configuration.maxNetworkRequestsPerInvocation)
  ) {
    return null;
  }
  return JSON.stringify({
    contract: NOT_REQUIRED_ATTESTATION_CONTRACT,
    appEnvironment: configuration.appEnvironment,
    publicAppEnvironment: configuration.publicAppEnvironment ?? null,
    mobileKey: null,
    host: null,
    projectId: null,
    personalApiKey: null,
    captureShutdownAt: null,
    minimumAbsenceIntervalSeconds: configuration.minimumAbsenceIntervalSeconds,
    maxNetworkRequestsPerInvocation: configuration.maxNetworkRequestsPerInvocation,
    noRecordingsEvidence: null,
  });
}

async function notRequiredConfigurationAttestation(
  configuration: PostHogDeletionExecutorConfiguration,
): Promise<NotRequiredConfigurationAttestation | null> {
  const canonical = canonicalProviderFreeDevelopmentConfiguration(configuration);
  if (canonical === null) return null;
  const bytes = UTF8_ENCODER.encode(canonical);
  try {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const digestHex = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    if (!SHA256_HEX_PATTERN.test(digestHex)) {
      throw new PostHogDeletionExecutorError('POSTHOG_EXECUTOR_DEPENDENCY_FAILED');
    }
    return {
      contract: NOT_REQUIRED_ATTESTATION_CONTRACT,
      digestAlgorithm: NOT_REQUIRED_DIGEST_ALGORITHM,
      digestHex,
    };
  } catch (error) {
    if (error instanceof PostHogDeletionExecutorError) throw error;
    throw new PostHogDeletionExecutorError('POSTHOG_EXECUTOR_DEPENDENCY_FAILED');
  } finally {
    bytes.fill(0);
  }
}

function sameNotRequiredConfigurationAttestation(
  left: NotRequiredConfigurationAttestation,
  right: NotRequiredConfigurationAttestation,
): boolean {
  return (
    left.contract === right.contract &&
    left.digestAlgorithm === right.digestAlgorithm &&
    left.digestHex === right.digestHex
  );
}

function canonicalNotRequiredState(state: NotRequiredState): string {
  return JSON.stringify({
    version: state.version,
    mode: state.mode,
    attestedAt: state.attestedAt,
    configurationAttestation: {
      contract: state.configurationAttestation.contract,
      digestAlgorithm: state.configurationAttestation.digestAlgorithm,
      digestHex: state.configurationAttestation.digestHex,
    },
  });
}

function canonicalDispatchEvidence(evidence: DispatchEvidence | null): DispatchEvidence | null {
  if (evidence === null) return null;
  if (evidence.kind === 'queued') {
    return {
      kind: 'queued',
      resultCode: 'POSTHOG_DELETE_QUEUED',
      requestStartedAt: evidence.requestStartedAt,
      observedAt: evidence.observedAt,
    };
  }
  return {
    kind: 'ambiguous',
    resultCode: 'POSTHOG_DELETE_DISPATCH_AMBIGUOUS',
    requestStartedAt: evidence.requestStartedAt,
    observedAt: evidence.observedAt,
  };
}

function canonicalEventObservation(observation: EventStatusObservation): Record<string, unknown> {
  if (observation.kind !== 'completed') {
    return {
      targetIndex: observation.targetIndex,
      kind: observation.kind,
      resultCode: observation.resultCode,
      observedAt: observation.observedAt,
    };
  }
  return {
    targetIndex: observation.targetIndex,
    kind: observation.kind,
    resultCode: observation.resultCode,
    observedAt: observation.observedAt,
    transientEvidence: {
      personUuid: observation.transientEvidence.personUuid,
      dispatchCutoffAt: observation.transientEvidence.dispatchCutoffAt,
      createdAt: observation.transientEvidence.createdAt,
      verifiedAt: observation.transientEvidence.verifiedAt,
    },
  };
}

function canonicalRequiredState(state: RequiredState): string {
  return JSON.stringify({
    version: state.version,
    mode: state.mode,
    targetSetEvidence: {
      personUuids: state.targetSetEvidence.personUuids,
      persisted: state.targetSetEvidence.persisted,
      capturedAt: state.targetSetEvidence.capturedAt,
    },
    captureShutdownAt: state.captureShutdownAt,
    dispatchCutoffAt: state.dispatchCutoffAt,
    minimumAbsenceIntervalSeconds: state.minimumAbsenceIntervalSeconds,
    noRecordingsEvidence: {
      recordingsCollected: state.noRecordingsEvidence.recordingsCollected,
      durable: state.noRecordingsEvidence.durable,
      evidence: state.noRecordingsEvidence.evidence,
      verifiedAt: state.noRecordingsEvidence.verifiedAt,
    },
    dispatchEvidence: canonicalDispatchEvidence(state.dispatchEvidence),
    eventStatusObservations: state.eventStatusObservations.map(canonicalEventObservation),
    absenceObservations: state.absenceObservations.map((observation) => ({
      kind: observation.kind,
      observedAt: observation.observedAt,
      persisted: observation.persisted,
    })),
    nextStatusIndex: state.nextStatusIndex,
  });
}

function canonicalStateText(state: DurablePostHogState): string {
  return state.mode === 'not_required'
    ? canonicalNotRequiredState(state)
    : canonicalRequiredState(state);
}

function parseDispatchEvidence(value: unknown): DispatchEvidence | null | false {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['kind', 'resultCode', 'requestStartedAt', 'observedAt']) ||
    !stateIso(value.requestStartedAt) ||
    !stateIso(value.observedAt)
  ) {
    return false;
  }
  if (value.kind === 'queued' && value.resultCode === 'POSTHOG_DELETE_QUEUED') {
    return {
      kind: 'queued',
      resultCode: 'POSTHOG_DELETE_QUEUED',
      requestStartedAt: value.requestStartedAt,
      observedAt: value.observedAt,
    };
  }
  if (value.kind === 'ambiguous' && value.resultCode === 'POSTHOG_DELETE_DISPATCH_AMBIGUOUS') {
    return {
      kind: 'ambiguous',
      resultCode: 'POSTHOG_DELETE_DISPATCH_AMBIGUOUS',
      requestStartedAt: value.requestStartedAt,
      observedAt: value.observedAt,
    };
  }
  return false;
}

function parseEventObservation(
  value: unknown,
  targets: readonly string[],
  dispatchCutoffAt: string,
): EventStatusObservation | null {
  if (!isRecord(value) || !Number.isSafeInteger(value.targetIndex)) return null;
  const targetIndex = value.targetIndex as number;
  if (targetIndex < 0 || targetIndex >= targets.length || !stateIso(value.observedAt)) {
    return null;
  }
  if (
    value.kind === 'pending' &&
    value.resultCode === 'POSTHOG_STATUS_PENDING' &&
    hasExactKeys(value, ['targetIndex', 'kind', 'resultCode', 'observedAt'])
  ) {
    return {
      targetIndex,
      kind: 'pending',
      resultCode: 'POSTHOG_STATUS_PENDING',
      observedAt: value.observedAt,
    };
  }
  if (
    value.kind === 'missing' &&
    value.resultCode === 'POSTHOG_STATUS_MISSING' &&
    hasExactKeys(value, ['targetIndex', 'kind', 'resultCode', 'observedAt'])
  ) {
    return {
      targetIndex,
      kind: 'missing',
      resultCode: 'POSTHOG_STATUS_MISSING',
      observedAt: value.observedAt,
    };
  }
  if (
    value.kind !== 'completed' ||
    value.resultCode !== 'POSTHOG_STATUS_COMPLETED' ||
    !hasExactKeys(value, [
      'targetIndex',
      'kind',
      'resultCode',
      'observedAt',
      'transientEvidence',
    ]) ||
    !isRecord(value.transientEvidence) ||
    !hasExactKeys(value.transientEvidence, [
      'personUuid',
      'dispatchCutoffAt',
      'createdAt',
      'verifiedAt',
    ])
  ) {
    return null;
  }
  const evidence = value.transientEvidence;
  if (
    evidence.personUuid !== targets[targetIndex] ||
    evidence.dispatchCutoffAt !== dispatchCutoffAt ||
    !stateIso(evidence.createdAt) ||
    !stateIso(evidence.verifiedAt) ||
    Date.parse(evidence.createdAt) < Date.parse(dispatchCutoffAt) ||
    Date.parse(evidence.verifiedAt) < Date.parse(evidence.createdAt)
  ) {
    return null;
  }
  return {
    targetIndex,
    kind: 'completed',
    resultCode: 'POSTHOG_STATUS_COMPLETED',
    observedAt: value.observedAt,
    transientEvidence: {
      personUuid: evidence.personUuid,
      dispatchCutoffAt: evidence.dispatchCutoffAt,
      createdAt: evidence.createdAt,
      verifiedAt: evidence.verifiedAt,
    },
  };
}

function parseRequiredState(value: Record<string, unknown>): RequiredState | null {
  if (
    !hasExactKeys(value, [
      'version',
      'mode',
      'targetSetEvidence',
      'captureShutdownAt',
      'dispatchCutoffAt',
      'minimumAbsenceIntervalSeconds',
      'noRecordingsEvidence',
      'dispatchEvidence',
      'eventStatusObservations',
      'absenceObservations',
      'nextStatusIndex',
    ]) ||
    value.version !== STATE_VERSION ||
    value.mode !== 'required' ||
    !isRecord(value.targetSetEvidence) ||
    !hasExactKeys(value.targetSetEvidence, ['personUuids', 'persisted', 'capturedAt']) ||
    value.targetSetEvidence.persisted !== true ||
    !Array.isArray(value.targetSetEvidence.personUuids) ||
    value.targetSetEvidence.personUuids.length > MAX_TARGET_PERSON_UUIDS ||
    !stateIso(value.targetSetEvidence.capturedAt) ||
    !stateIso(value.captureShutdownAt) ||
    !stateIso(value.dispatchCutoffAt) ||
    !Number.isSafeInteger(value.minimumAbsenceIntervalSeconds) ||
    (value.minimumAbsenceIntervalSeconds as number) < 1 ||
    (value.minimumAbsenceIntervalSeconds as number) > 86_400 ||
    !isRecord(value.noRecordingsEvidence) ||
    !hasExactKeys(value.noRecordingsEvidence, [
      'recordingsCollected',
      'durable',
      'evidence',
      'verifiedAt',
    ]) ||
    value.noRecordingsEvidence.recordingsCollected !== false ||
    value.noRecordingsEvidence.durable !== true ||
    value.noRecordingsEvidence.evidence !== 'production_capture_disabled_and_storage_audited' ||
    !stateIso(value.noRecordingsEvidence.verifiedAt) ||
    !Array.isArray(value.eventStatusObservations) ||
    !Array.isArray(value.absenceObservations) ||
    value.absenceObservations.length > 2 ||
    !Number.isSafeInteger(value.nextStatusIndex)
  ) {
    return null;
  }
  const targets = value.targetSetEvidence.personUuids as unknown[];
  if (
    targets.some((target) => typeof target !== 'string' || !UUID_PATTERN.test(target)) ||
    new Set(targets).size !== targets.length ||
    [...targets].sort().some((target, index) => target !== targets[index]) ||
    Date.parse(value.targetSetEvidence.capturedAt) > Date.parse(value.dispatchCutoffAt) ||
    Date.parse(value.captureShutdownAt) > Date.parse(value.dispatchCutoffAt) ||
    Date.parse(value.noRecordingsEvidence.verifiedAt) < Date.parse(value.captureShutdownAt)
  ) {
    return null;
  }
  const nextStatusIndex = value.nextStatusIndex as number;
  if (
    (targets.length === 0 && nextStatusIndex !== 0) ||
    (targets.length > 0 && (nextStatusIndex < 0 || nextStatusIndex >= targets.length))
  ) {
    return null;
  }
  const dispatchEvidence = parseDispatchEvidence(value.dispatchEvidence);
  if (dispatchEvidence === false) return null;
  const eventStatusObservations: EventStatusObservation[] = [];
  let priorTargetIndex = -1;
  for (const candidate of value.eventStatusObservations) {
    const parsed = parseEventObservation(candidate, targets as string[], value.dispatchCutoffAt);
    if (parsed === null || parsed.targetIndex <= priorTargetIndex) return null;
    priorTargetIndex = parsed.targetIndex;
    eventStatusObservations.push(parsed);
  }
  const absenceObservations: PostHogAbsenceObservation[] = [];
  let priorAbsenceMs: number | null = null;
  const mustFollowMs = Math.max(
    Date.parse(value.captureShutdownAt),
    Date.parse(value.dispatchCutoffAt),
  );
  for (const candidate of value.absenceObservations) {
    if (
      !isRecord(candidate) ||
      !hasExactKeys(candidate, ['kind', 'observedAt', 'persisted']) ||
      candidate.kind !== 'absent' ||
      candidate.persisted !== true ||
      !stateIso(candidate.observedAt)
    ) {
      return null;
    }
    const observedAtMs = Date.parse(candidate.observedAt);
    if (
      observedAtMs <= mustFollowMs ||
      (priorAbsenceMs !== null &&
        observedAtMs - priorAbsenceMs < (value.minimumAbsenceIntervalSeconds as number) * 1_000)
    ) {
      return null;
    }
    priorAbsenceMs = observedAtMs;
    absenceObservations.push({
      kind: 'absent',
      observedAt: candidate.observedAt,
      persisted: true,
    });
  }
  if (
    dispatchEvidence === null &&
    (eventStatusObservations.length > 0 || absenceObservations.length > 0)
  ) {
    return null;
  }
  return {
    version: STATE_VERSION,
    mode: 'required',
    targetSetEvidence: {
      personUuids: targets as string[],
      persisted: true,
      capturedAt: value.targetSetEvidence.capturedAt,
    },
    captureShutdownAt: value.captureShutdownAt,
    dispatchCutoffAt: value.dispatchCutoffAt,
    minimumAbsenceIntervalSeconds: value.minimumAbsenceIntervalSeconds as number,
    noRecordingsEvidence: {
      recordingsCollected: false,
      durable: true,
      evidence: 'production_capture_disabled_and_storage_audited',
      verifiedAt: value.noRecordingsEvidence.verifiedAt,
    },
    dispatchEvidence,
    eventStatusObservations,
    absenceObservations,
    nextStatusIndex,
  };
}

function decodeState(encoded: Uint8Array): DurablePostHogState {
  if (
    !(encoded instanceof Uint8Array) ||
    encoded.byteLength === 0 ||
    encoded.byteLength > maxDeletionPayloadPlaintextBytes(STEP_NAME)
  ) {
    throw new PostHogDeletionExecutorError('POSTHOG_EXECUTOR_STATE_INVALID');
  }
  let text: string;
  let parsed: unknown;
  try {
    text = UTF8_DECODER.decode(encoded);
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new PostHogDeletionExecutorError('POSTHOG_EXECUTOR_STATE_INVALID');
  }
  let state: DurablePostHogState | null = null;
  if (
    isRecord(parsed) &&
    parsed.version === STATE_VERSION &&
    parsed.mode === 'not_required' &&
    hasExactKeys(parsed, ['version', 'mode', 'attestedAt', 'configurationAttestation']) &&
    stateIso(parsed.attestedAt) &&
    isRecord(parsed.configurationAttestation) &&
    hasExactKeys(parsed.configurationAttestation, ['contract', 'digestAlgorithm', 'digestHex']) &&
    parsed.configurationAttestation.contract === NOT_REQUIRED_ATTESTATION_CONTRACT &&
    parsed.configurationAttestation.digestAlgorithm === NOT_REQUIRED_DIGEST_ALGORITHM &&
    typeof parsed.configurationAttestation.digestHex === 'string' &&
    SHA256_HEX_PATTERN.test(parsed.configurationAttestation.digestHex)
  ) {
    state = {
      version: STATE_VERSION,
      mode: 'not_required',
      attestedAt: parsed.attestedAt,
      configurationAttestation: {
        contract: NOT_REQUIRED_ATTESTATION_CONTRACT,
        digestAlgorithm: NOT_REQUIRED_DIGEST_ALGORITHM,
        digestHex: parsed.configurationAttestation.digestHex,
      },
    };
  } else if (isRecord(parsed) && parsed.mode === 'required') {
    state = parseRequiredState(parsed);
  }
  if (state === null || canonicalStateText(state) !== text) {
    throw new PostHogDeletionExecutorError('POSTHOG_EXECUTOR_STATE_INVALID');
  }
  return state;
}

function encodeState(state: DurablePostHogState): Uint8Array {
  const encoded = UTF8_ENCODER.encode(canonicalStateText(state));
  if (
    encoded.byteLength === 0 ||
    encoded.byteLength > maxDeletionPayloadPlaintextBytes(STEP_NAME)
  ) {
    encoded.fill(0);
    throw new PostHogDeletionExecutorError('POSTHOG_EXECUTOR_STATE_INVALID');
  }
  // Round-trip enforces the same exact-key and chronology rules on writes.
  decodeState(encoded);
  return encoded;
}

function stateContext(claim: AccountDeletionClaim) {
  return {
    operationId: claim.operationId,
    userId: claim.userId,
    stepName: STEP_NAME,
    claimMode: claim.claimMode,
    claimToken: claim.claimToken,
  };
}

async function loadState(
  dependencies: Dependencies,
  claim: AccountDeletionClaim,
): Promise<DurablePostHogState | null> {
  let plaintext: Uint8Array | null;
  try {
    plaintext = await dependencies.encryptedStateStore.load({
      ...stateContext(claim),
      encryptedPayload: claim.encryptedPayload,
    });
  } catch {
    throw new PostHogDeletionExecutorError('POSTHOG_EXECUTOR_STATE_INVALID');
  }
  if (plaintext === null) return null;
  try {
    return decodeState(plaintext);
  } finally {
    plaintext.fill(0);
  }
}

async function saveState(
  dependencies: Dependencies,
  claim: AccountDeletionClaim,
  state: DurablePostHogState,
): Promise<void> {
  const plaintext = encodeState(state);
  try {
    await dependencies.encryptedStateStore.save({
      ...stateContext(claim),
      plaintext,
    });
  } catch {
    throw new PostHogDeletionExecutorError('POSTHOG_EXECUTOR_DEPENDENCY_FAILED');
  } finally {
    plaintext.fill(0);
  }
}

async function markRequestStarted(
  dependencies: Dependencies,
  claim: AccountDeletionClaim,
): Promise<string> {
  let acknowledgement: unknown;
  try {
    acknowledgement = await dependencies.rpc.markRequestStarted({
      ...stateContext(claim),
    });
  } catch {
    throw new PostHogDeletionExecutorError('POSTHOG_EXECUTOR_DEPENDENCY_FAILED');
  }
  if (
    !isRecord(acknowledgement) ||
    !hasExactKeys(acknowledgement, ['requestStartedAt']) ||
    canonicalIso(acknowledgement.requestStartedAt) === null
  ) {
    throw new PostHogDeletionExecutorError('POSTHOG_EXECUTOR_DEPENDENCY_FAILED');
  }
  return canonicalIso(acknowledgement.requestStartedAt) as string;
}

async function recordStep(
  dependencies: Dependencies,
  claim: AccountDeletionClaim,
  outcome: PostHogDeletionRecordOutcome,
  resultCode: string,
): Promise<void> {
  if (!validDeletionResultCode(resultCode)) {
    throw new PostHogDeletionExecutorError('POSTHOG_EXECUTOR_INPUT_INVALID');
  }
  const retryAt =
    outcome === 'retryable'
      ? new Date(
          nowMs(dependencies) + accountDeletionRetryDelaySeconds(claim.attemptCount) * 1_000,
        ).toISOString()
      : null;
  try {
    await dependencies.rpc.recordStep({
      ...stateContext(claim),
      outcome,
      resultCode,
      retryAt,
    });
  } catch {
    throw new PostHogDeletionExecutorError('POSTHOG_EXECUTOR_DEPENDENCY_FAILED');
  }
}

function validNetworkResponse(response: unknown): response is PostHogDeletionNetworkResponse {
  if (
    !isRecord(response) ||
    !hasExactKeys(response, ['status', 'body', 'responseBytes']) ||
    !Number.isInteger(response.status) ||
    (response.status as number) < 100 ||
    (response.status as number) > 599 ||
    !Number.isSafeInteger(response.responseBytes) ||
    (response.responseBytes as number) < 0 ||
    (response.responseBytes as number) > ACCOUNT_DELETION_PROVIDER_RESPONSE_MAX_BYTES
  ) {
    return false;
  }
  try {
    const serialized = JSON.stringify(response.body);
    return (
      typeof serialized === 'string' &&
      UTF8_ENCODER.encode(serialized).byteLength <= ACCOUNT_DELETION_PROVIDER_RESPONSE_MAX_BYTES
    );
  } catch {
    return false;
  }
}

type RequestBudget = {
  used: number;
  maximum: number;
  deadlineAtMs: number;
};

function canStartNetworkRequest(dependencies: Dependencies, budget: RequestBudget): boolean {
  return budget.used < budget.maximum && nowMs(dependencies) < budget.deadlineAtMs;
}

async function sendJson(
  dependencies: Dependencies,
  budget: RequestBudget,
  request: { url: string; init: RequestInit },
): Promise<PostHogDeletionNetworkResponse | null> {
  if (!canStartNetworkRequest(dependencies, budget)) return null;
  budget.used += 1;
  let response: unknown;
  try {
    response = await dependencies.network.sendJson(
      { url: request.url, init: request.init },
      {
        deadlineAtMs: budget.deadlineAtMs,
        requestNumber: budget.used,
      },
    );
  } catch {
    return null;
  }
  return validNetworkResponse(response) ? response : null;
}

function replaceStatusObservation(state: RequiredState, observation: EventStatusObservation): void {
  state.eventStatusObservations = state.eventStatusObservations
    .filter((candidate) => candidate.targetIndex !== observation.targetIndex)
    .concat(observation)
    .sort((left, right) => left.targetIndex - right.targetIndex);
}

function nextIncompleteTarget(state: RequiredState): number | null {
  const completed = new Set(
    state.eventStatusObservations
      .filter((observation) => observation.kind === 'completed')
      .map((observation) => observation.targetIndex),
  );
  for (let offset = 0; offset < state.targetSetEvidence.personUuids.length; offset += 1) {
    const index = (state.nextStatusIndex + offset) % state.targetSetEvidence.personUuids.length;
    if (!completed.has(index)) return index;
  }
  return null;
}

function eventDispositions(state: RequiredState): PostHogEventStatusDisposition[] | null {
  if (state.eventStatusObservations.length !== state.targetSetEvidence.personUuids.length) {
    return null;
  }
  return state.eventStatusObservations.map((observation) => {
    if (observation.kind === 'completed') {
      return {
        kind: 'completed',
        resultCode: 'POSTHOG_STATUS_COMPLETED',
        transientEvidence: observation.transientEvidence,
      };
    }
    return {
      kind: observation.kind,
      resultCode: observation.resultCode,
    } as PostHogEventStatusDisposition;
  });
}

function appendAbsenceObservation(state: RequiredState, observedAt: string): void {
  if (state.absenceObservations.length >= 2) return;
  const observedAtMs = Date.parse(observedAt);
  const mustFollowMs = Math.max(
    Date.parse(state.captureShutdownAt),
    Date.parse(state.dispatchCutoffAt),
  );
  const previous = state.absenceObservations.at(-1);
  if (
    observedAtMs <= mustFollowMs ||
    (previous !== undefined &&
      observedAtMs - Date.parse(previous.observedAt) < state.minimumAbsenceIntervalSeconds * 1_000)
  ) {
    return;
  }
  state.absenceObservations.push({
    kind: 'absent',
    observedAt,
    persisted: true,
  });
}

async function completeNotRequired(
  dependencies: Dependencies,
  claim: AccountDeletionClaim,
  context: { deadlineAtMs: number },
  state: NotRequiredState | null,
  currentAttestation: NotRequiredConfigurationAttestation,
): Promise<void> {
  if (state === null) {
    state = {
      version: STATE_VERSION,
      mode: 'not_required',
      attestedAt: nowIso(dependencies),
      configurationAttestation: currentAttestation,
    };
    await saveState(dependencies, claim, state);
  }
  const revalidatedAttestation = await notRequiredConfigurationAttestation(
    dependencies.configuration,
  );
  if (
    revalidatedAttestation === null ||
    !sameNotRequiredConfigurationAttestation(state.configurationAttestation, revalidatedAttestation)
  ) {
    await recordStep(dependencies, claim, 'action_required', 'POSTHOG_STATUS_UNATTESTED');
    return;
  }
  if (nowMs(dependencies) >= context.deadlineAtMs) return;
  await markRequestStarted(dependencies, claim);
  await recordStep(dependencies, claim, 'succeeded', POSTHOG_DELETION_NOT_REQUIRED_RESULT_CODE);
}

async function prepareRequiredState(
  dependencies: Dependencies,
  claim: AccountDeletionClaim,
  budget: RequestBudget,
  configuration: InitialRequiredConfiguration,
): Promise<RequiredState | null> {
  if (!canStartNetworkRequest(dependencies, budget)) {
    await recordStep(dependencies, claim, 'retryable', 'POSTHOG_LOOKUP_RETRY');
    return null;
  }
  let request;
  try {
    request = await buildPostHogPersonLookupRequest({
      host: configuration.host,
      projectId: configuration.projectId,
      personalApiKey: configuration.personalApiKey,
      appUserId: claim.userId,
    });
  } catch {
    await recordStep(
      dependencies,
      claim,
      'action_required',
      'POSTHOG_DELETE_CONFIGURATION_REQUIRED',
    );
    return null;
  }
  const response = await sendJson(dependencies, budget, request);
  if (response === null) {
    await recordStep(dependencies, claim, 'retryable', 'POSTHOG_LOOKUP_RETRY');
    return null;
  }
  let lookup: PostHogLookupDisposition;
  try {
    lookup = classifyPostHogPersonLookupResponse(
      response.status,
      response.body,
      request.expectedDistinctIds,
    );
  } catch {
    await recordStep(dependencies, claim, 'action_required', 'POSTHOG_LOOKUP_UNATTESTED');
    return null;
  }
  if (lookup.kind === 'retryable') {
    await recordStep(dependencies, claim, 'retryable', lookup.resultCode);
    return null;
  }
  if (lookup.kind === 'action_required' || lookup.kind === 'ambiguous') {
    await recordStep(dependencies, claim, 'action_required', lookup.resultCode);
    return null;
  }
  const capturedAt = nowIso(dependencies);
  const targets = lookup.kind === 'found' ? [...lookup.personUuids].sort() : [];
  const state: RequiredState = {
    version: STATE_VERSION,
    mode: 'required',
    targetSetEvidence: {
      personUuids: targets,
      persisted: true,
      capturedAt,
    },
    captureShutdownAt: configuration.captureShutdownAt,
    dispatchCutoffAt: capturedAt,
    minimumAbsenceIntervalSeconds: configuration.minimumAbsenceIntervalSeconds,
    noRecordingsEvidence: configuration.noRecordingsEvidence,
    dispatchEvidence: null,
    eventStatusObservations: [],
    absenceObservations: [],
    nextStatusIndex: 0,
  };
  try {
    await saveState(dependencies, claim, state);
  } catch (error) {
    if (
      error instanceof PostHogDeletionExecutorError &&
      error.code === 'POSTHOG_EXECUTOR_STATE_INVALID'
    ) {
      await recordStep(dependencies, claim, 'action_required', 'POSTHOG_LOOKUP_UNATTESTED');
      return null;
    }
    throw error;
  }
  if (targets.length === 0) {
    // Person absence does not prove historical event absence; never overclaim.
    await recordStep(dependencies, claim, 'action_required', 'POSTHOG_LOOKUP_UNATTESTED');
    return null;
  }
  return state;
}

async function dispatchDeletion(
  dependencies: Dependencies,
  claim: AccountDeletionClaim,
  budget: RequestBudget,
  state: RequiredState,
  provider: ProviderConfiguration,
): Promise<void> {
  if (state.targetSetEvidence.personUuids.length === 0) {
    await recordStep(dependencies, claim, 'action_required', 'POSTHOG_LOOKUP_UNATTESTED');
    return;
  }
  if (state.dispatchEvidence !== null) {
    await recordStep(dependencies, claim, 'action_required', 'POSTHOG_STATUS_UNATTESTED');
    return;
  }
  if (!canStartNetworkRequest(dependencies, budget)) {
    await recordStep(dependencies, claim, 'retryable', 'POSTHOG_DELETE_RETRY');
    return;
  }

  // Refresh the cutoff on every safe pre-request resume. This state commit is
  // the final durable action before request_started and the provider mutation.
  state.dispatchCutoffAt = nowIso(dependencies);
  state.eventStatusObservations = [];
  state.absenceObservations = [];
  state.nextStatusIndex = 0;
  await saveState(dependencies, claim, state);

  let request;
  try {
    request = buildPostHogBulkDeleteRequest({
      ...provider,
      personUuids: state.targetSetEvidence.personUuids,
      deleteRecordings: false,
      dispatchCutoffAt: state.dispatchCutoffAt,
    });
  } catch {
    await recordStep(
      dependencies,
      claim,
      'action_required',
      'POSTHOG_DELETE_CONFIGURATION_REQUIRED',
    );
    return;
  }
  if (!canStartNetworkRequest(dependencies, budget)) {
    await recordStep(dependencies, claim, 'retryable', 'POSTHOG_DELETE_RETRY');
    return;
  }

  const requestStartedAt = await markRequestStarted(dependencies, claim);
  const response = await sendJson(dependencies, budget, request);
  const observedAt = nowIso(dependencies);
  let disposition =
    response === null
      ? classifyPostHogBulkDeleteTransportFailure('after_request_started')
      : classifyPostHogBulkDeleteResponse(response.status, response.body, {
          personUuids: request.expectedPersonUuids,
          deleteRecordings: request.deleteRecordings,
          dispatchCutoffAt: request.dispatchCutoffAt,
        });

  if (disposition.kind === 'queued') {
    state.dispatchEvidence = {
      kind: 'queued',
      resultCode: 'POSTHOG_DELETE_QUEUED',
      requestStartedAt,
      observedAt,
    };
    await saveState(dependencies, claim, state);
    await recordStep(dependencies, claim, 'ambiguous', disposition.resultCode);
    return;
  }
  if (disposition.kind === 'action_required') {
    await recordStep(dependencies, claim, 'action_required', disposition.resultCode);
    return;
  }
  // Once request_started committed, even a nominally retryable 429 is never
  // blindly re-dispatched. Reconciliation is the only safe lane.
  if (disposition.kind === 'retryable') {
    disposition = classifyPostHogBulkDeleteTransportFailure('after_request_started');
  }
  state.dispatchEvidence = {
    kind: 'ambiguous',
    resultCode: 'POSTHOG_DELETE_DISPATCH_AMBIGUOUS',
    requestStartedAt,
    observedAt,
  };
  await saveState(dependencies, claim, state);
  await recordStep(dependencies, claim, 'ambiguous', 'POSTHOG_DELETE_DISPATCH_AMBIGUOUS');
}

function statusObservation(
  targetIndex: number,
  observedAt: string,
  disposition: Extract<
    PostHogEventStatusDisposition,
    { kind: 'pending' | 'missing' | 'completed' }
  >,
): EventStatusObservation {
  if (disposition.kind === 'completed') {
    const createdAt = canonicalIso(disposition.transientEvidence.createdAt);
    const verifiedAt = canonicalIso(disposition.transientEvidence.verifiedAt);
    if (createdAt === null || verifiedAt === null) {
      throw new PostHogDeletionExecutorError('POSTHOG_EXECUTOR_STATE_INVALID');
    }
    return {
      targetIndex,
      kind: 'completed',
      resultCode: 'POSTHOG_STATUS_COMPLETED',
      observedAt,
      transientEvidence: {
        personUuid: disposition.transientEvidence.personUuid,
        dispatchCutoffAt: disposition.transientEvidence.dispatchCutoffAt,
        createdAt,
        verifiedAt,
      },
    };
  }
  if (disposition.kind === 'pending') {
    return {
      targetIndex,
      kind: 'pending',
      resultCode: 'POSTHOG_STATUS_PENDING',
      observedAt,
    };
  }
  return {
    targetIndex,
    kind: 'missing',
    resultCode: 'POSTHOG_STATUS_MISSING',
    observedAt,
  };
}

async function reconcileDeletion(
  dependencies: Dependencies,
  claim: AccountDeletionClaim,
  budget: RequestBudget,
  state: RequiredState,
  provider: ProviderConfiguration,
): Promise<void> {
  if (state.targetSetEvidence.personUuids.length === 0 || claim.requestStartedAt === null) {
    await recordStep(dependencies, claim, 'action_required', 'POSTHOG_STATUS_UNATTESTED');
    return;
  }
  if (state.dispatchEvidence === null) {
    state.dispatchEvidence = {
      kind: 'ambiguous',
      resultCode: 'POSTHOG_DELETE_DISPATCH_AMBIGUOUS',
      requestStartedAt: canonicalIso(claim.requestStartedAt) as string,
      observedAt: nowIso(dependencies),
    };
    await saveState(dependencies, claim, state);
  }
  if (!canStartNetworkRequest(dependencies, budget)) {
    await recordStep(dependencies, claim, 'retryable', 'POSTHOG_STATUS_RETRY');
    return;
  }

  let lookupRequest;
  try {
    lookupRequest = await buildPostHogPersonLookupRequest({
      ...provider,
      appUserId: claim.userId,
    });
  } catch {
    await recordStep(
      dependencies,
      claim,
      'action_required',
      'POSTHOG_DELETE_CONFIGURATION_REQUIRED',
    );
    return;
  }
  await markRequestStarted(dependencies, claim);
  const lookupResponse = await sendJson(dependencies, budget, lookupRequest);
  if (lookupResponse === null) {
    await recordStep(dependencies, claim, 'retryable', 'POSTHOG_LOOKUP_RETRY');
    return;
  }
  let latestLookup: PostHogLookupDisposition;
  try {
    latestLookup = classifyPostHogPersonLookupResponse(
      lookupResponse.status,
      lookupResponse.body,
      lookupRequest.expectedDistinctIds,
    );
  } catch {
    await recordStep(dependencies, claim, 'action_required', 'POSTHOG_LOOKUP_UNATTESTED');
    return;
  }
  if (latestLookup.kind === 'retryable') {
    await recordStep(dependencies, claim, 'retryable', latestLookup.resultCode);
    return;
  }
  if (latestLookup.kind === 'action_required' || latestLookup.kind === 'ambiguous') {
    await recordStep(dependencies, claim, 'action_required', latestLookup.resultCode);
    return;
  }
  if (latestLookup.kind === 'found') {
    state.absenceObservations = [];
    await saveState(dependencies, claim, state);
    await recordStep(dependencies, claim, 'retryable', 'POSTHOG_PERSON_REAPPEARED');
    return;
  }

  appendAbsenceObservation(state, nowIso(dependencies));
  await saveState(dependencies, claim, state);

  const queriedThisInvocation = new Set<number>();
  while (canStartNetworkRequest(dependencies, budget)) {
    const targetIndex = nextIncompleteTarget(state);
    if (targetIndex === null || queriedThisInvocation.has(targetIndex)) break;
    queriedThisInvocation.add(targetIndex);
    let statusRequest;
    try {
      statusRequest = buildPostHogDeletionStatusRequest({
        ...provider,
        personUuid: state.targetSetEvidence.personUuids[targetIndex],
        dispatchCutoffAt: state.dispatchCutoffAt,
      });
    } catch {
      await recordStep(dependencies, claim, 'action_required', 'POSTHOG_STATUS_UNATTESTED');
      return;
    }
    const statusResponse = await sendJson(dependencies, budget, statusRequest);
    if (statusResponse === null) {
      await recordStep(dependencies, claim, 'retryable', 'POSTHOG_STATUS_RETRY');
      return;
    }
    let disposition: PostHogEventStatusDisposition;
    try {
      disposition = classifyPostHogDeletionStatusResponse(
        statusResponse.status,
        statusResponse.body,
        statusRequest.expectedPersonUuid,
        statusRequest.dispatchCutoffAt,
      );
    } catch {
      await recordStep(dependencies, claim, 'action_required', 'POSTHOG_STATUS_UNATTESTED');
      return;
    }
    if (disposition.kind === 'retryable') {
      await recordStep(dependencies, claim, 'retryable', disposition.resultCode);
      return;
    }
    if (disposition.kind === 'action_required' || disposition.kind === 'ambiguous') {
      await recordStep(
        dependencies,
        claim,
        disposition.kind === 'ambiguous' ? 'ambiguous' : 'action_required',
        disposition.resultCode,
      );
      return;
    }
    replaceStatusObservation(
      state,
      statusObservation(targetIndex, nowIso(dependencies), disposition),
    );
    state.nextStatusIndex = (targetIndex + 1) % state.targetSetEvidence.personUuids.length;
    await saveState(dependencies, claim, state);
  }

  const statuses = eventDispositions(state);
  if (statuses === null) {
    await recordStep(dependencies, claim, 'retryable', 'POSTHOG_STATUS_PENDING');
    return;
  }
  let terminal;
  try {
    terminal = attestPostHogTerminalDeletion({
      latestLookup,
      targetSetEvidence: state.targetSetEvidence,
      eventStatuses: statuses,
      dispatchCutoffAt: state.dispatchCutoffAt,
      captureShutdownAt: state.captureShutdownAt,
      absenceObservations: state.absenceObservations,
      minimumAbsenceIntervalSeconds: state.minimumAbsenceIntervalSeconds,
      noRecordingsEvidence: state.noRecordingsEvidence,
    });
  } catch {
    await recordStep(dependencies, claim, 'action_required', 'POSTHOG_STATUS_UNATTESTED');
    return;
  }
  switch (terminal.kind) {
    case 'succeeded':
      await recordStep(dependencies, claim, 'succeeded', terminal.resultCode);
      return;
    case 'pending':
    case 'retryable':
      await recordStep(dependencies, claim, 'retryable', terminal.resultCode);
      return;
    case 'ambiguous':
      await recordStep(dependencies, claim, 'ambiguous', terminal.resultCode);
      return;
    case 'action_required':
      await recordStep(dependencies, claim, 'action_required', terminal.resultCode);
  }
}

/** Creates the bounded executor wired into the generic deletion worker. */
export function createPostHogDeletionExecutor(options: Dependencies): AccountDeletionStepExecutor {
  assertDependencies(options);
  const dependencies = options;
  return async (claim, context): Promise<void> => {
    if (
      !validClaim(claim) ||
      !isRecord(context) ||
      !hasExactKeys(context, ['deadlineAtMs']) ||
      !safeEpoch(context.deadlineAtMs)
    ) {
      throw new PostHogDeletionExecutorError('POSTHOG_EXECUTOR_INPUT_INVALID');
    }

    let state: DurablePostHogState | null;
    try {
      state = await loadState(dependencies, claim);
    } catch {
      await recordStep(dependencies, claim, 'action_required', 'POSTHOG_STATUS_UNATTESTED');
      return;
    }

    if (state?.mode === 'not_required') {
      const currentAttestation = await notRequiredConfigurationAttestation(
        dependencies.configuration,
      );
      if (
        currentAttestation === null ||
        !sameNotRequiredConfigurationAttestation(
          state.configurationAttestation,
          currentAttestation,
        ) ||
        Date.parse(state.attestedAt) > nowMs(dependencies)
      ) {
        await recordStep(dependencies, claim, 'action_required', 'POSTHOG_STATUS_UNATTESTED');
        return;
      }
      await completeNotRequired(dependencies, claim, context, state, currentAttestation);
      return;
    }
    if (state === null && claim.claimMode === 'reconcile') {
      await recordStep(dependencies, claim, 'action_required', 'POSTHOG_STATUS_UNATTESTED');
      return;
    }
    if (state === null) {
      const currentAttestation = await notRequiredConfigurationAttestation(
        dependencies.configuration,
      );
      if (currentAttestation !== null) {
        await completeNotRequired(dependencies, claim, context, null, currentAttestation);
        return;
      }
    }

    if (!validRequestCap(dependencies.configuration.maxNetworkRequestsPerInvocation)) {
      await recordStep(
        dependencies,
        claim,
        'action_required',
        'POSTHOG_DELETE_CONFIGURATION_REQUIRED',
      );
      return;
    }
    const provider = providerConfiguration(dependencies.configuration);
    if (provider === null) {
      await recordStep(
        dependencies,
        claim,
        'action_required',
        'POSTHOG_DELETE_CONFIGURATION_REQUIRED',
      );
      return;
    }
    const budget: RequestBudget = {
      used: 0,
      maximum: dependencies.configuration.maxNetworkRequestsPerInvocation,
      deadlineAtMs: context.deadlineAtMs,
    };

    if (state === null) {
      const initial = initialRequiredConfiguration(dependencies.configuration, nowMs(dependencies));
      if (initial.value === null) {
        await recordStep(dependencies, claim, 'action_required', initial.resultCode);
        return;
      }
      state = await prepareRequiredState(dependencies, claim, budget, initial.value);
      if (state === null) return;
    }

    if (claim.claimMode === 'dispatch') {
      await dispatchDeletion(dependencies, claim, budget, state, provider);
      return;
    }
    await reconcileDeletion(dependencies, claim, budget, state, provider);
  };
}
