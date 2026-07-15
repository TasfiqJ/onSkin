import {
  healthPhotoPathBelongsToEpoch,
  healthPhotoPathSafeForWithdrawal,
  parsePreparedHealthWithdrawalRow,
} from '../consent-withdrawal/healthLifecycleCore.ts';

export const HEALTH_WORKER_STORAGE_BATCH_SIZE = 100;
export const HEALTH_WORKER_MAX_STORAGE_BATCHES = 5;
export const HEALTH_WORKER_MAX_CLAIM_LIMIT = 25;
export const HEALTH_WORKER_MIN_RETRY_AFTER_SECONDS = 5;
export const HEALTH_WORKER_MAX_RETRY_AFTER_SECONDS = 86_400;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CLAIM_TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const DEFERRED_OPERATION_STATES = new Set(['pending', 'running', 'storage_pending']);

type RpcResult = { data: unknown; error: unknown };

export type HealthConsentWorkerClaim = {
  operationId: string;
  userId: string;
  epoch: number;
};

export type HealthConsentWorkerDependencies = {
  claim: (claimToken: string, limit: number) => Promise<RpcResult>;
  prepare: (operationId: string, claimToken: string) => Promise<RpcResult>;
  listStorage: (operationId: string, limit: number, claimToken: string) => Promise<RpcResult>;
  removeStorage: (paths: string[]) => Promise<{ error: unknown }>;
  complete: (operationId: string, claimToken: string) => Promise<RpcResult>;
  defer: (
    operationId: string,
    claimToken: string,
    resultCode: string,
    retryAfterSeconds: number,
  ) => Promise<RpcResult>;
};

export type HealthConsentWorkerReport = {
  claimed: number;
  completed: number;
  deferred: number;
  actionRequired: number;
  deadlineReached: boolean;
  partialFailure?: true;
  failedLanes?: Array<'base' | 'dependent'>;
};

export type RunHealthConsentWorkerOptions = {
  claimToken: string;
  claimLimit: number;
  storageBatchSize?: number;
  maxStorageBatches?: number;
  retryAfterSeconds: number;
  actionRequiredRetryAfterSeconds: number;
  deadlineAtMs: number;
  now?: () => number;
  dependencies: HealthConsentWorkerDependencies;
};

export class HealthConsentWorkerError extends Error {
  constructor(
    public readonly code:
      | 'HEALTH_WORKER_CONFIGURATION_INVALID'
      | 'HEALTH_WORKER_CLAIM_FAILED'
      | 'HEALTH_WORKER_CLAIM_ATTESTATION_INVALID'
      | 'HEALTH_WORKER_DEFER_FAILED',
  ) {
    super(code);
    this.name = 'HealthConsentWorkerError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function oneRow(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) return value;
  if (Array.isArray(value) && value.length === 1 && isRecord(value[0])) {
    return value[0];
  }
  return null;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validPositiveInteger(value: number, maximum: number): boolean {
  return Number.isSafeInteger(value) && value >= 1 && value <= maximum;
}

function validIntegerRange(value: number, minimum: number, maximum: number): boolean {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function parseClaims(value: unknown, limit: number): HealthConsentWorkerClaim[] | null {
  if (!Array.isArray(value) || value.length > limit) return null;
  const operationIds = new Set<string>();
  const claims: HealthConsentWorkerClaim[] = [];
  for (const row of value) {
    if (
      !isRecord(row) ||
      !exactKeys(row, ['operation_id', 'user_id', 'epoch']) ||
      typeof row.operation_id !== 'string' ||
      !UUID_PATTERN.test(row.operation_id) ||
      typeof row.user_id !== 'string' ||
      !UUID_PATTERN.test(row.user_id) ||
      !Number.isSafeInteger(row.epoch) ||
      (row.epoch as number) < 1 ||
      operationIds.has(row.operation_id)
    ) {
      return null;
    }
    operationIds.add(row.operation_id);
    claims.push({
      operationId: row.operation_id,
      userId: row.user_id,
      epoch: row.epoch as number,
    });
  }
  return claims;
}

function parsePrepared(value: unknown): { state: string; resultCode: string | null } | null {
  const row = parsePreparedHealthWithdrawalRow(value);
  return row ? { state: row.operation_state, resultCode: row.result_code } : null;
}

function parseStoragePaths(
  value: unknown,
  claim: HealthConsentWorkerClaim,
  limit: number,
): string[] | null {
  if (!Array.isArray(value) || value.length > limit) return null;
  const paths: string[] = [];
  for (const row of value) {
    if (
      !isRecord(row) ||
      !exactKeys(row, ['storage_path']) ||
      typeof row.storage_path !== 'string' ||
      !(
        healthPhotoPathBelongsToEpoch(claim.userId, claim.epoch, row.storage_path) ||
        healthPhotoPathSafeForWithdrawal(claim.userId, claim.epoch, row.storage_path)
      )
    ) {
      return null;
    }
    paths.push(row.storage_path);
  }
  return new Set(paths).size === paths.length ? paths : null;
}

type DeferOutcome = 'deferred' | 'action_required';

function deferredAttestation(
  value: unknown,
  claim: HealthConsentWorkerClaim,
  requestedResultCode: string,
): DeferOutcome | null {
  const row = oneRow(value);
  if (
    !row ||
    !exactKeys(row, ['operation_id', 'operation_state', 'result_code', 'next_attempt_at']) ||
    row.operation_id !== claim.operationId ||
    typeof row.next_attempt_at !== 'string' ||
    Number.isNaN(Date.parse(row.next_attempt_at))
  ) {
    return null;
  }
  if (
    typeof row.operation_state === 'string' &&
    DEFERRED_OPERATION_STATES.has(row.operation_state) &&
    row.result_code === requestedResultCode
  ) {
    return 'deferred';
  }
  if (row.operation_state === 'action_required' && row.result_code === 'WORKER_RETRY_EXHAUSTED') {
    return 'action_required';
  }
  return null;
}

function completedAttestation(value: unknown, claim: HealthConsentWorkerClaim): boolean {
  const row = oneRow(value);
  return Boolean(
    row &&
    exactKeys(row, [
      'user_id',
      'state',
      'epoch',
      'operation_id',
      'operation_state',
      'result_code',
      'server_verified_at',
      'consent_version',
      'consent_text_hash',
    ]) &&
    typeof row.user_id === 'string' &&
    row.user_id === claim.userId &&
    row.state === 'withdrawn' &&
    row.epoch === claim.epoch &&
    row.operation_id === claim.operationId &&
    row.operation_state === 'completed' &&
    row.result_code === 'HEALTH_WITHDRAWAL_COMPLETED' &&
    row.consent_version === null &&
    row.consent_text_hash === null &&
    typeof row.server_verified_at === 'string' &&
    !Number.isNaN(Date.parse(row.server_verified_at)),
  );
}

async function deferClaim(
  options: RunHealthConsentWorkerOptions,
  claim: HealthConsentWorkerClaim,
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
    const outcome = result.error ? null : deferredAttestation(result.data, claim, resultCode);
    if (!outcome) {
      throw new HealthConsentWorkerError('HEALTH_WORKER_DEFER_FAILED');
    }
    return outcome;
  } catch (error) {
    if (error instanceof HealthConsentWorkerError) throw error;
    throw new HealthConsentWorkerError('HEALTH_WORKER_DEFER_FAILED');
  }
}

function recordDeferOutcome(report: HealthConsentWorkerReport, outcome: DeferOutcome): void {
  if (outcome === 'action_required') report.actionRequired += 1;
  else report.deferred += 1;
}

export async function runHealthConsentWorker(
  options: RunHealthConsentWorkerOptions,
): Promise<HealthConsentWorkerReport> {
  const storageBatchSize = options.storageBatchSize ?? HEALTH_WORKER_STORAGE_BATCH_SIZE;
  const maxStorageBatches = options.maxStorageBatches ?? HEALTH_WORKER_MAX_STORAGE_BATCHES;
  const now = options.now ?? Date.now;
  if (
    !CLAIM_TOKEN_PATTERN.test(options.claimToken) ||
    !validPositiveInteger(options.claimLimit, HEALTH_WORKER_MAX_CLAIM_LIMIT) ||
    !validPositiveInteger(storageBatchSize, HEALTH_WORKER_STORAGE_BATCH_SIZE) ||
    !validPositiveInteger(maxStorageBatches, 100) ||
    !validIntegerRange(
      options.retryAfterSeconds,
      HEALTH_WORKER_MIN_RETRY_AFTER_SECONDS,
      HEALTH_WORKER_MAX_RETRY_AFTER_SECONDS,
    ) ||
    !validIntegerRange(
      options.actionRequiredRetryAfterSeconds,
      HEALTH_WORKER_MIN_RETRY_AFTER_SECONDS,
      HEALTH_WORKER_MAX_RETRY_AFTER_SECONDS,
    ) ||
    !Number.isSafeInteger(options.deadlineAtMs) ||
    options.deadlineAtMs <= 0
  ) {
    throw new HealthConsentWorkerError('HEALTH_WORKER_CONFIGURATION_INVALID');
  }

  let claimedResult: RpcResult;
  try {
    claimedResult = await options.dependencies.claim(options.claimToken, options.claimLimit);
  } catch {
    throw new HealthConsentWorkerError('HEALTH_WORKER_CLAIM_FAILED');
  }
  if (claimedResult.error) {
    throw new HealthConsentWorkerError('HEALTH_WORKER_CLAIM_FAILED');
  }
  const claims = parseClaims(claimedResult.data, options.claimLimit);
  if (!claims) {
    throw new HealthConsentWorkerError('HEALTH_WORKER_CLAIM_ATTESTATION_INVALID');
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
          'HEALTH_WORKER_BUDGET_EXHAUSTED',
          options.retryAfterSeconds,
        ),
      );
      report.deadlineReached = true;
      continue;
    }

    let preparedResult: RpcResult;
    try {
      preparedResult = await options.dependencies.prepare(claim.operationId, options.claimToken);
    } catch {
      recordDeferOutcome(
        report,
        await deferClaim(
          options,
          claim,
          'HEALTH_DATABASE_PREPARE_FAILED',
          options.retryAfterSeconds,
        ),
      );
      continue;
    }
    if (preparedResult.error) {
      recordDeferOutcome(
        report,
        await deferClaim(
          options,
          claim,
          'HEALTH_DATABASE_PREPARE_FAILED',
          options.retryAfterSeconds,
        ),
      );
      continue;
    }
    const prepared = parsePrepared(preparedResult.data);
    if (!prepared) {
      recordDeferOutcome(
        report,
        await deferClaim(
          options,
          claim,
          'HEALTH_PREPARE_ATTESTATION_INVALID',
          options.retryAfterSeconds,
        ),
      );
      continue;
    }
    if (prepared.state === 'action_required') {
      // prepare() has already made this durable, cleared the claim, and moved
      // the operation out of the automatic worker queue. A defer RPC would be
      // rejected because there is intentionally no active lease to release.
      report.actionRequired += 1;
      continue;
    }

    let resolved = false;
    for (let batch = 0; batch < maxStorageBatches; batch += 1) {
      if (now() >= options.deadlineAtMs) {
        recordDeferOutcome(
          report,
          await deferClaim(
            options,
            claim,
            'HEALTH_WORKER_BUDGET_EXHAUSTED',
            options.retryAfterSeconds,
          ),
        );
        report.deadlineReached = true;
        resolved = true;
        break;
      }

      let listedResult: RpcResult;
      try {
        listedResult = await options.dependencies.listStorage(
          claim.operationId,
          storageBatchSize,
          options.claimToken,
        );
      } catch {
        recordDeferOutcome(
          report,
          await deferClaim(options, claim, 'HEALTH_STORAGE_LIST_FAILED', options.retryAfterSeconds),
        );
        resolved = true;
        break;
      }
      if (listedResult.error) {
        recordDeferOutcome(
          report,
          await deferClaim(options, claim, 'HEALTH_STORAGE_LIST_FAILED', options.retryAfterSeconds),
        );
        resolved = true;
        break;
      }
      const paths = parseStoragePaths(listedResult.data, claim, storageBatchSize);
      if (!paths) {
        const outcome = await deferClaim(
          options,
          claim,
          'HEALTH_STORAGE_ATTESTATION_INVALID',
          options.actionRequiredRetryAfterSeconds,
        );
        recordDeferOutcome(report, outcome);
        if (outcome === 'deferred') report.actionRequired += 1;
        resolved = true;
        break;
      }
      if (paths.length === 0) {
        let completedResult: RpcResult;
        try {
          completedResult = await options.dependencies.complete(
            claim.operationId,
            options.claimToken,
          );
        } catch {
          recordDeferOutcome(
            report,
            await deferClaim(
              options,
              claim,
              'HEALTH_COMPLETION_ATTESTATION_FAILED',
              options.retryAfterSeconds,
            ),
          );
          resolved = true;
          break;
        }
        if (completedResult.error || !completedAttestation(completedResult.data, claim)) {
          recordDeferOutcome(
            report,
            await deferClaim(
              options,
              claim,
              'HEALTH_COMPLETION_ATTESTATION_FAILED',
              options.retryAfterSeconds,
            ),
          );
        } else {
          report.completed += 1;
        }
        resolved = true;
        break;
      }

      let removedResult: { error: unknown };
      try {
        removedResult = await options.dependencies.removeStorage(paths);
      } catch {
        recordDeferOutcome(
          report,
          await deferClaim(
            options,
            claim,
            'HEALTH_STORAGE_DELETE_FAILED',
            options.retryAfterSeconds,
          ),
        );
        resolved = true;
        break;
      }
      if (removedResult.error) {
        recordDeferOutcome(
          report,
          await deferClaim(
            options,
            claim,
            'HEALTH_STORAGE_DELETE_FAILED',
            options.retryAfterSeconds,
          ),
        );
        resolved = true;
        break;
      }
    }

    if (!resolved) {
      recordDeferOutcome(
        report,
        await deferClaim(options, claim, 'HEALTH_STORAGE_WORK_REMAINS', options.retryAfterSeconds),
      );
    }
  }

  return report;
}
