import type { HealthConsentWorkerReport } from './workerCore.ts';

export type HealthConsentWorkerLane = 'base' | 'dependent';

export type CombinedHealthConsentWorkerReport = HealthConsentWorkerReport & {
  partialFailure?: true;
  failedLanes?: HealthConsentWorkerLane[];
};

export class CombinedHealthConsentWorkerError extends Error {
  constructor() {
    super('HEALTH_CONSENT_WORKER_ALL_LANES_FAILED');
    this.name = 'CombinedHealthConsentWorkerError';
  }
}

/**
 * Lanes run concurrently with separate capabilities and limits supplied by
 * their callers. A failed lane cannot starve the other privacy-rights queue.
 */
export async function runHealthConsentWorkerLanes(options: {
  runBase: () => PromiseLike<HealthConsentWorkerReport>;
  runDependent: () => PromiseLike<HealthConsentWorkerReport>;
}): Promise<CombinedHealthConsentWorkerReport> {
  const [base, dependent] = await Promise.allSettled([
    Promise.resolve().then(() => options.runBase()),
    Promise.resolve().then(() => options.runDependent()),
  ]);
  if (base.status === 'rejected' && dependent.status === 'rejected') {
    throw new CombinedHealthConsentWorkerError();
  }

  const reports = [base, dependent]
    .filter(
      (result): result is PromiseFulfilledResult<HealthConsentWorkerReport> =>
        result.status === 'fulfilled',
    )
    .map((result) => result.value);
  const report: CombinedHealthConsentWorkerReport = {
    claimed: reports.reduce((sum, value) => sum + value.claimed, 0),
    completed: reports.reduce((sum, value) => sum + value.completed, 0),
    deferred: reports.reduce((sum, value) => sum + value.deferred, 0),
    actionRequired: reports.reduce(
      (sum, value) => sum + value.actionRequired,
      0,
    ),
    deadlineReached: reports.some((value) => value.deadlineReached),
  };
  const failedLanes: HealthConsentWorkerLane[] = [];
  if (base.status === 'rejected') failedLanes.push('base');
  if (dependent.status === 'rejected') failedLanes.push('dependent');
  if (failedLanes.length > 0) {
    report.partialFailure = true;
    report.failedLanes = failedLanes;
  }
  return report;
}
