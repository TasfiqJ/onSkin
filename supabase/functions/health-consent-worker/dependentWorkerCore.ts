import {
  GranularActionRequiredError,
  granularCleanupReadyForCompletion,
  type GranularWithdrawalOperation,
  type HealthDependentConsentType,
} from '../consent-withdrawal/granularWithdrawalCore.ts';
import { healthPhotoPathSafeForWithdrawal } from '../consent-withdrawal/healthLifecycleCore.ts';
import type { HealthConsentWorkerReport } from './workerCore.ts';

export const DEPENDENT_WORKER_STORAGE_BATCH_SIZE = 100;
export const DEPENDENT_WORKER_MAX_STORAGE_BATCHES = 10;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CLAIM_TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const DEPENDENT_TYPES = new Set<HealthDependentConsentType>([
  'photo_capture',
  'photo_cloud_backup',
  'photo_trend_insights',
  'ask_layerwell',
  'community_participation',
  'data_sharing',
]);

type RpcResult = { data: unknown; error: unknown };

export type HealthDependentWorkerClaim = GranularWithdrawalOperation;

export type HealthDependentWorkerDependencies = {
  claim: (claimToken: string, limit: number) => PromiseLike<RpcResult>;
  cleanup: (
    operation: GranularWithdrawalOperation,
  ) => PromiseLike<Record<string, number | boolean>>;
  listStorage: (
    operationId: string,
    limit: number,
    claimToken: string,
  ) => PromiseLike<RpcResult>;
  removeStorage: (paths: string[]) => PromiseLike<{ error: unknown }>;
  complete: (operationId: string) => PromiseLike<RpcResult>;
  markActionRequired: (
    operationId: string,
    claimToken: string,
    resultCode:
      | 'DEPENDENT_PROVIDER_BOUND_EXCEEDED'
      | 'DEPENDENT_STORAGE_OWNERSHIP_INVALID'
      | 'DEPENDENT_STORAGE_BOUND_EXCEEDED',
  ) => PromiseLike<RpcResult>;
  defer: (
    operationId: string,
    claimToken: string,
    resultCode: string,
    retryAfterSeconds: number,
  ) => PromiseLike<RpcResult>;
};

export type RunHealthDependentWorkerOptions = {
  claimToken: string;
  claimLimit: number;
  storageBatchSize?: number;
  maxStorageBatches?: number;
  retryAfterSeconds: number;
  deadlineAtMs: number;
  now?: () => number;
  dependencies: HealthDependentWorkerDependencies;
};

export class HealthDependentWorkerError extends Error {
  constructor(
    public readonly code:
      | 'HEALTH_DEPENDENT_WORKER_CONFIGURATION_INVALID'
      | 'HEALTH_DEPENDENT_WORKER_CLAIM_FAILED'
      | 'HEALTH_DEPENDENT_WORKER_CLAIM_ATTESTATION_INVALID'
      | 'HEALTH_DEPENDENT_WORKER_ACTION_REQUIRED_FAILED'
      | 'HEALTH_DEPENDENT_WORKER_DEFER_FAILED',
  ) {
    super(code);
    this.name = 'HealthDependentWorkerError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function validPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 1;
}

function parseClaims(
  value: unknown,
  limit: number,
): HealthDependentWorkerClaim[] | null {
  if (!Array.isArray(value) || value.length > limit) return null;
  const operationIds = new Set<string>();
  const claims: HealthDependentWorkerClaim[] = [];
  for (const row of value) {
    if (
      !isRecord(row) ||
      !exactKeys(row, [
        'operation_id',
        'user_id',
        'consent_type',
        'processing_epoch',
        'consent_generation',
      ]) ||
      typeof row.operation_id !== 'string' ||
      !UUID_PATTERN.test(row.operation_id) ||
      operationIds.has(row.operation_id) ||
      typeof row.user_id !== 'string' ||
      !UUID_PATTERN.test(row.user_id) ||
      typeof row.consent_type !== 'string' ||
      !DEPENDENT_TYPES.has(row.consent_type as HealthDependentConsentType) ||
      !validPositiveInteger(row.processing_epoch) ||
      !validPositiveInteger(row.consent_generation)
    ) {
      return null;
    }
    operationIds.add(row.operation_id);
    claims.push({
      operationId: row.operation_id,
      userId: row.user_id,
      consentType: row.consent_type as HealthDependentConsentType,
      state: 'withdrawing',
      processingEpoch: row.processing_epoch,
      consentGeneration: row.consent_generation,
    });
  }
  return claims;
}

function completedAttestation(
  value: unknown,
  claim: HealthDependentWorkerClaim,
): boolean {
  const row = Array.isArray(value) && value.length === 1 ? value[0] : null;
  return Boolean(
    isRecord(row) &&
      exactKeys(row, [
        'operation_id',
        'user_id',
        'consent_type',
        'state',
        'processing_epoch',
        'consent_generation',
      ]) &&
      row.operation_id === claim.operationId &&
      row.user_id === claim.userId &&
      row.consent_type === claim.consentType &&
      row.state === 'withdrawn' &&
      row.processing_epoch === claim.processingEpoch &&
      row.consent_generation === claim.consentGeneration,
  );
}

function actionRequiredAttestation(
  value: unknown,
  claim: HealthDependentWorkerClaim,
  resultCode:
    | 'DEPENDENT_PROVIDER_BOUND_EXCEEDED'
    | 'DEPENDENT_STORAGE_OWNERSHIP_INVALID'
    | 'DEPENDENT_STORAGE_BOUND_EXCEEDED',
): boolean {
  const row = Array.isArray(value) && value.length === 1 ? value[0] : null;
  return Boolean(
    isRecord(row) &&
      exactKeys(row, ['operation_id', 'state', 'result_code']) &&
      row.operation_id === claim.operationId &&
      row.state === 'action_required' &&
      row.result_code === resultCode,
  );
}

type DeferOutcome = 'deferred' | 'action_required';

function deferredAttestation(
  value: unknown,
  claim: HealthDependentWorkerClaim,
  requestedResultCode: string,
): DeferOutcome | null {
  const row = Array.isArray(value) && value.length === 1 ? value[0] : null;
  if (
    !isRecord(row) ||
    !exactKeys(row, [
      'operation_id',
      'state',
      'result_code',
      'next_attempt_at',
    ]) ||
    row.operation_id !== claim.operationId ||
    typeof row.next_attempt_at !== 'string' ||
    Number.isNaN(Date.parse(row.next_attempt_at))
  ) {
    return null;
  }
  if (row.state === 'pending' && row.result_code === requestedResultCode) {
    return 'deferred';
  }
  if (
    row.state === 'action_required' &&
    row.result_code === 'WORKER_RETRY_EXHAUSTED'
  ) {
    return 'action_required';
  }
  return null;
}

async function deferClaim(
  options: RunHealthDependentWorkerOptions,
  claim: HealthDependentWorkerClaim,
  resultCode: string,
  retryAfterSeconds: number,
): Promise<DeferOutcome> {
  try {
    const result = await options.dependencies.defer(
      claim.operationId,
      options.claimToken,
      resultCode,
      retryAfterSeconds,
    );
    const outcome = result.error
      ? null
      : deferredAttestation(result.data, claim, resultCode);
    if (!outcome) {
      throw new HealthDependentWorkerError(
        'HEALTH_DEPENDENT_WORKER_DEFER_FAILED',
      );
    }
    return outcome;
  } catch (error) {
    if (error instanceof HealthDependentWorkerError) throw error;
    throw new HealthDependentWorkerError(
      'HEALTH_DEPENDENT_WORKER_DEFER_FAILED',
    );
  }
}

function recordDeferOutcome(
  report: HealthConsentWorkerReport,
  outcome: DeferOutcome,
): void {
  if (outcome === 'action_required') report.actionRequired += 1;
  else report.deferred += 1;
}

function storageOwnershipInvalid(error: unknown): boolean {
  return isRecord(error) &&
    error.message === 'HEALTH_DEPENDENT_STORAGE_WORK_PATH_INVALID';
}

function storageBoundExceeded(error: unknown): boolean {
  return isRecord(error) &&
    error.message === 'HEALTH_DEPENDENT_STORAGE_WORK_BOUND_EXCEEDED';
}

function parseStoragePaths(
  value: unknown,
  claim: HealthDependentWorkerClaim,
  limit: number,
): string[] | null {
  if (!Array.isArray(value) || value.length > limit) return null;
  const paths: string[] = [];
  for (const row of value) {
    if (
      !isRecord(row) ||
      !exactKeys(row, ['storage_path']) ||
      typeof row.storage_path !== 'string' ||
      !healthPhotoPathSafeForWithdrawal(
        claim.userId,
        claim.processingEpoch,
        row.storage_path,
      )
    ) {
      return null;
    }
    paths.push(row.storage_path);
  }
  return new Set(paths).size === paths.length ? paths : null;
}

async function prepareDependentPhotoStorage(
  options: RunHealthDependentWorkerOptions,
  claim: HealthDependentWorkerClaim,
  report: HealthConsentWorkerReport,
  storageBatchSize: number,
  maxStorageBatches: number,
  now: () => number,
): Promise<boolean> {
  if (
    claim.consentType !== 'photo_capture' &&
    claim.consentType !== 'photo_cloud_backup'
  ) {
    return true;
  }

  for (let batch = 0; batch <= maxStorageBatches; batch += 1) {
    if (now() >= options.deadlineAtMs) {
      recordDeferOutcome(
        report,
        await deferClaim(
          options,
          claim,
          'DEPENDENT_WORKER_BUDGET_EXHAUSTED',
          options.retryAfterSeconds,
        ),
      );
      report.deadlineReached = true;
      return false;
    }

    let listed: RpcResult;
    try {
      listed = await options.dependencies.listStorage(
        claim.operationId,
        storageBatchSize,
        options.claimToken,
      );
    } catch {
      recordDeferOutcome(
        report,
        await deferClaim(
          options,
          claim,
          'DEPENDENT_STORAGE_LIST_FAILED',
          options.retryAfterSeconds,
        ),
      );
      return false;
    }
    if (listed.error) {
      if (storageOwnershipInvalid(listed.error)) {
        await markClaimActionRequired(
          options,
          claim,
          'DEPENDENT_STORAGE_OWNERSHIP_INVALID',
        );
        report.actionRequired += 1;
      } else if (storageBoundExceeded(listed.error)) {
        await markClaimActionRequired(
          options,
          claim,
          'DEPENDENT_STORAGE_BOUND_EXCEEDED',
        );
        report.actionRequired += 1;
      } else {
        recordDeferOutcome(
          report,
          await deferClaim(
            options,
            claim,
            'DEPENDENT_STORAGE_LIST_FAILED',
            options.retryAfterSeconds,
          ),
        );
      }
      return false;
    }
    const paths = parseStoragePaths(listed.data, claim, storageBatchSize);
    if (!paths) {
      await markClaimActionRequired(
        options,
        claim,
        'DEPENDENT_STORAGE_OWNERSHIP_INVALID',
      );
      report.actionRequired += 1;
      return false;
    }
    if (paths.length === 0) return true;
    if (batch === maxStorageBatches) {
      await markClaimActionRequired(
        options,
        claim,
        'DEPENDENT_PROVIDER_BOUND_EXCEEDED',
      );
      report.actionRequired += 1;
      return false;
    }

    let removed: { error: unknown };
    try {
      removed = await options.dependencies.removeStorage(paths);
    } catch {
      recordDeferOutcome(
        report,
        await deferClaim(
          options,
          claim,
          'DEPENDENT_STORAGE_DELETE_FAILED',
          options.retryAfterSeconds,
        ),
      );
      return false;
    }
    if (removed.error) {
      recordDeferOutcome(
        report,
        await deferClaim(
          options,
          claim,
          'DEPENDENT_STORAGE_DELETE_FAILED',
          options.retryAfterSeconds,
        ),
      );
      return false;
    }
  }
  return false;
}

async function markClaimActionRequired(
  options: RunHealthDependentWorkerOptions,
  claim: HealthDependentWorkerClaim,
  resultCode:
    | 'DEPENDENT_PROVIDER_BOUND_EXCEEDED'
    | 'DEPENDENT_STORAGE_OWNERSHIP_INVALID'
    | 'DEPENDENT_STORAGE_BOUND_EXCEEDED',
): Promise<void> {
  try {
    const result = await options.dependencies.markActionRequired(
      claim.operationId,
      options.claimToken,
      resultCode,
    );
    if (
      result.error ||
      !actionRequiredAttestation(result.data, claim, resultCode)
    ) {
      throw new HealthDependentWorkerError(
        'HEALTH_DEPENDENT_WORKER_ACTION_REQUIRED_FAILED',
      );
    }
  } catch (error) {
    if (error instanceof HealthDependentWorkerError) throw error;
    throw new HealthDependentWorkerError(
      'HEALTH_DEPENDENT_WORKER_ACTION_REQUIRED_FAILED',
    );
  }
}

export async function runHealthDependentConsentWorker(
  options: RunHealthDependentWorkerOptions,
): Promise<HealthConsentWorkerReport> {
  const now = options.now ?? Date.now;
  const storageBatchSize = options.storageBatchSize ??
    DEPENDENT_WORKER_STORAGE_BATCH_SIZE;
  const maxStorageBatches = options.maxStorageBatches ??
    DEPENDENT_WORKER_MAX_STORAGE_BATCHES;
  if (
    !CLAIM_TOKEN_PATTERN.test(options.claimToken) ||
    !Number.isSafeInteger(options.claimLimit) ||
    options.claimLimit < 1 ||
    options.claimLimit > 25 ||
    !Number.isSafeInteger(storageBatchSize) ||
    storageBatchSize < 1 ||
    storageBatchSize > DEPENDENT_WORKER_STORAGE_BATCH_SIZE ||
    !Number.isSafeInteger(maxStorageBatches) ||
    maxStorageBatches < 1 ||
    maxStorageBatches > DEPENDENT_WORKER_MAX_STORAGE_BATCHES ||
    !Number.isSafeInteger(options.retryAfterSeconds) ||
    options.retryAfterSeconds < 5 ||
    options.retryAfterSeconds > 86_400 ||
    !Number.isSafeInteger(options.deadlineAtMs) ||
    options.deadlineAtMs <= 0
  ) {
    throw new HealthDependentWorkerError(
      'HEALTH_DEPENDENT_WORKER_CONFIGURATION_INVALID',
    );
  }

  let claimedResult: RpcResult;
  try {
    claimedResult = await options.dependencies.claim(
      options.claimToken,
      options.claimLimit,
    );
  } catch {
    throw new HealthDependentWorkerError(
      'HEALTH_DEPENDENT_WORKER_CLAIM_FAILED',
    );
  }
  if (claimedResult.error) {
    throw new HealthDependentWorkerError(
      'HEALTH_DEPENDENT_WORKER_CLAIM_FAILED',
    );
  }
  const claims = parseClaims(claimedResult.data, options.claimLimit);
  if (!claims) {
    throw new HealthDependentWorkerError(
      'HEALTH_DEPENDENT_WORKER_CLAIM_ATTESTATION_INVALID',
    );
  }

  const report: HealthConsentWorkerReport = {
    claimed: claims.length,
    completed: 0,
    deferred: 0,
    actionRequired: 0,
    deadlineReached: false,
  };

  for (const claim of claims) {
    if (now() >= options.deadlineAtMs) {
      recordDeferOutcome(
        report,
        await deferClaim(
          options,
          claim,
          'DEPENDENT_WORKER_BUDGET_EXHAUSTED',
          options.retryAfterSeconds,
        ),
      );
      report.deadlineReached = true;
      continue;
    }

    if (
      !await prepareDependentPhotoStorage(
        options,
        claim,
        report,
        storageBatchSize,
        maxStorageBatches,
        now,
      )
    ) {
      continue;
    }

    let cleanup: Record<string, number | boolean>;
    try {
      cleanup = await options.dependencies.cleanup(claim);
    } catch (error) {
      const actionRequired = error instanceof GranularActionRequiredError;
      if (actionRequired) {
        await markClaimActionRequired(
          options,
          claim,
          'DEPENDENT_PROVIDER_BOUND_EXCEEDED',
        );
        report.actionRequired += 1;
      } else {
        recordDeferOutcome(
          report,
          await deferClaim(
            options,
            claim,
            'DEPENDENT_CLEANUP_FAILED',
            options.retryAfterSeconds,
          ),
        );
      }
      continue;
    }
    if (!granularCleanupReadyForCompletion(claim.consentType, cleanup)) {
      recordDeferOutcome(
        report,
        await deferClaim(
          options,
          claim,
          'DEPENDENT_CLEANUP_ATTESTATION_INVALID',
          options.retryAfterSeconds,
        ),
      );
      continue;
    }
    if (now() >= options.deadlineAtMs) {
      recordDeferOutcome(
        report,
        await deferClaim(
          options,
          claim,
          'DEPENDENT_WORKER_BUDGET_EXHAUSTED',
          options.retryAfterSeconds,
        ),
      );
      report.deadlineReached = true;
      continue;
    }

    let completedResult: RpcResult;
    try {
      completedResult = await options.dependencies.complete(claim.operationId);
    } catch {
      recordDeferOutcome(
        report,
        await deferClaim(
          options,
          claim,
          'DEPENDENT_COMPLETION_FAILED',
          options.retryAfterSeconds,
        ),
      );
      continue;
    }
    if (
      completedResult.error ||
      !completedAttestation(completedResult.data, claim)
    ) {
      recordDeferOutcome(
        report,
        await deferClaim(
          options,
          claim,
          'DEPENDENT_COMPLETION_FAILED',
          options.retryAfterSeconds,
        ),
      );
      continue;
    }
    report.completed += 1;
  }

  return report;
}
