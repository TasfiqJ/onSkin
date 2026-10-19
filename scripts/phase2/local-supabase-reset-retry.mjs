import { setTimeout as delay } from 'node:timers/promises';

export const LOCAL_RESET_RETRY_DELAY_MS = 3_000;

export const CANONICAL_POSTGRES_PULL_RETRY_DELAYS_MS = Object.freeze([3_000, 10_000, 30_000]);

export async function runWithCanonicalPostgresPullRetry({ operation, onRetry, wait = delay, signal }) {
  for (let attempt = 0; ; attempt += 1) {
    signal?.throwIfAborted();
    try {
      return await operation();
    } catch (error) {
      const failure = error?.cause;
      if (
        attempt >= CANONICAL_POSTGRES_PULL_RETRY_DELAYS_MS.length ||
        failure?.reason !== 'exit-nonzero' ||
        failure?.originReason !== 'exit-nonzero' ||
        !['posix-process-group-empty', 'windows-job-object-empty'].includes(failure?.containment) ||
        typeof failure.diagnostic !== 'string' ||
        !/toomanyrequests: Rate exceeded|429 Too Many Requests/u.test(failure.diagnostic)
      ) {
        throw error;
      }
      onRetry(attempt + 1);
      await wait(CANONICAL_POSTGRES_PULL_RETRY_DELAYS_MS[attempt], undefined, { signal });
    }
  }
}

const PRE_MIGRATION_CONTAINER_EXIT_125 =
  /(?:^|\n)Resetting local database\.\.\.\n(?:WARN: [^\n]*\n)*Recreating database\.\.\.\nInitialising schema\.\.\.\nerror running container: exit 125(?:\n|$)/u;

export function isRetryablePreMigrationContainerExit125(error) {
  return (
    error?.originReason === 'exit-nonzero' &&
    typeof error.diagnostic === 'string' &&
    PRE_MIGRATION_CONTAINER_EXIT_125.test(error.diagnostic)
  );
}

export async function runWithSinglePreMigrationContainerRetry({
  operation,
  onRetry,
  wait = delay,
}) {
  try {
    return await operation();
  } catch (error) {
    if (!isRetryablePreMigrationContainerExit125(error)) throw error;
    onRetry();
    await wait(LOCAL_RESET_RETRY_DELAY_MS);
    return await operation();
  }
}
