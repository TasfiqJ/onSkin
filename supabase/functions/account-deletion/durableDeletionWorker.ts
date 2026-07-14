export const ACCOUNT_DELETION_STEP_NAMES = [
  'apple_revoke',
  'revenuecat_delete',
  'posthog_delete',
  'photo_storage_delete',
  'service_rows_scrub',
  'auth_user_delete',
] as const;
export const ACCOUNT_DELETION_CLAIM_MODES = ['dispatch', 'reconcile'] as const;

export type AccountDeletionStepName = (typeof ACCOUNT_DELETION_STEP_NAMES)[number];
export type AccountDeletionClaimMode = (typeof ACCOUNT_DELETION_CLAIM_MODES)[number];

export type AccountDeletionClaim = {
  operationId: string;
  userId: string;
  operationState: 'pending' | 'running' | 'action_required';
  stepName: AccountDeletionStepName;
  stepStatus: 'leased';
  claimMode: AccountDeletionClaimMode;
  claimToken: string;
  attemptCount: number;
  requestStartedAt: string | null;
  leaseExpiresAt: string;
  encryptedPayload: string | null;
};

export type ReadyAccountDeletion = {
  operationId: string;
  userId: string;
};

export type AccountDeletionStepExecutor = (
  claim: AccountDeletionClaim,
  context: { deadlineAtMs: number },
) => Promise<void>;

export type AccountDeletionWorkerGateway = {
  claimNext: (claimMode: AccountDeletionClaimMode) => Promise<AccountDeletionClaim | null>;
  listReadyToFinalize: (limit: number) => Promise<ReadyAccountDeletion[]>;
  finalize: (candidate: ReadyAccountDeletion) => Promise<void>;
  purgeExpiredArtifacts: (limit: number) => Promise<void>;
};

export type AccountDeletionWorkerReport = {
  claimsProcessed: number;
  executorFailures: number;
  finalized: number;
  finalizationFailures: number;
  maintenanceFailed: boolean;
  deadlineReached: boolean;
};

export class DurableDeletionWorkerError extends Error {
  constructor(
    public readonly code: 'DELETION_WORKER_INPUT_INVALID' | 'DELETION_WORKER_EXECUTOR_MISSING',
  ) {
    super(code);
    this.name = 'DurableDeletionWorkerError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validOptions(options: unknown): options is {
  gateway: AccountDeletionWorkerGateway;
  executors: Readonly<Record<AccountDeletionStepName, AccountDeletionStepExecutor>>;
  deadlineAtMs: number;
  maxClaims: number;
  finalizationBatchSize: number;
  maintenanceBatchSize: number;
  now: () => number;
} {
  if (
    !isRecord(options) ||
    !hasExactKeys(options, [
      'gateway',
      'executors',
      'deadlineAtMs',
      'maxClaims',
      'finalizationBatchSize',
      'maintenanceBatchSize',
      'now',
    ]) ||
    !isRecord(options.gateway) ||
    !isRecord(options.executors) ||
    typeof options.gateway.claimNext !== 'function' ||
    typeof options.gateway.listReadyToFinalize !== 'function' ||
    typeof options.gateway.finalize !== 'function' ||
    typeof options.gateway.purgeExpiredArtifacts !== 'function' ||
    typeof options.now !== 'function' ||
    typeof options.deadlineAtMs !== 'number' ||
    !Number.isSafeInteger(options.deadlineAtMs) ||
    options.deadlineAtMs < 0 ||
    typeof options.maxClaims !== 'number' ||
    !Number.isSafeInteger(options.maxClaims) ||
    options.maxClaims < 1 ||
    options.maxClaims > 100 ||
    typeof options.finalizationBatchSize !== 'number' ||
    !Number.isSafeInteger(options.finalizationBatchSize) ||
    options.finalizationBatchSize < 1 ||
    options.finalizationBatchSize > 100 ||
    typeof options.maintenanceBatchSize !== 'number' ||
    !Number.isSafeInteger(options.maintenanceBatchSize) ||
    options.maintenanceBatchSize < 1 ||
    options.maintenanceBatchSize > 1_000
  ) {
    return false;
  }
  const executors = options.executors as Record<string, unknown>;
  return ACCOUNT_DELETION_STEP_NAMES.every((stepName) => typeof executors[stepName] === 'function');
}

/**
 * Runs a bounded worker slice. Reconcile and dispatch lanes alternate so a
 * continuously busy provider lane cannot monopolize the Edge invocation.
 * Executor errors are deliberately not echoed or auto-recorded: the durable
 * lease expires into the database's safe pending/ambiguous state.
 */
export async function runAccountDeletionWorker(options: {
  gateway: AccountDeletionWorkerGateway;
  executors: Readonly<Record<AccountDeletionStepName, AccountDeletionStepExecutor>>;
  deadlineAtMs: number;
  maxClaims: number;
  finalizationBatchSize: number;
  maintenanceBatchSize: number;
  now: () => number;
}): Promise<AccountDeletionWorkerReport> {
  if (!validOptions(options)) {
    throw new DurableDeletionWorkerError('DELETION_WORKER_INPUT_INVALID');
  }

  const report: AccountDeletionWorkerReport = {
    claimsProcessed: 0,
    executorFailures: 0,
    finalized: 0,
    finalizationFailures: 0,
    maintenanceFailed: false,
    deadlineReached: false,
  };
  let nextMode: AccountDeletionClaimMode = 'reconcile';
  let consecutiveEmptyLanes = 0;

  while (report.claimsProcessed < options.maxClaims) {
    if (options.now() >= options.deadlineAtMs) {
      report.deadlineReached = true;
      break;
    }
    let claim: AccountDeletionClaim | null;
    try {
      claim = await options.gateway.claimNext(nextMode);
    } catch {
      report.executorFailures += 1;
      break;
    }
    nextMode = nextMode === 'reconcile' ? 'dispatch' : 'reconcile';
    if (claim === null) {
      consecutiveEmptyLanes += 1;
      if (consecutiveEmptyLanes >= 2) break;
      continue;
    }
    consecutiveEmptyLanes = 0;
    const executor = options.executors[claim.stepName];
    if (typeof executor !== 'function') {
      throw new DurableDeletionWorkerError('DELETION_WORKER_EXECUTOR_MISSING');
    }
    report.claimsProcessed += 1;
    try {
      await executor(claim, { deadlineAtMs: options.deadlineAtMs });
    } catch {
      report.executorFailures += 1;
    }
  }

  if (options.now() < options.deadlineAtMs) {
    let ready: ReadyAccountDeletion[] = [];
    try {
      ready = await options.gateway.listReadyToFinalize(options.finalizationBatchSize);
    } catch {
      report.finalizationFailures += 1;
    }
    for (const candidate of ready) {
      if (options.now() >= options.deadlineAtMs) {
        report.deadlineReached = true;
        break;
      }
      try {
        await options.gateway.finalize(candidate);
        report.finalized += 1;
      } catch {
        report.finalizationFailures += 1;
      }
    }
  } else {
    report.deadlineReached = true;
  }

  if (options.now() < options.deadlineAtMs) {
    try {
      await options.gateway.purgeExpiredArtifacts(options.maintenanceBatchSize);
    } catch {
      report.maintenanceFailed = true;
    }
  } else {
    report.deadlineReached = true;
  }

  return report;
}
