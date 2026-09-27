import { setTimeout as delay } from 'node:timers/promises';

export const LOCAL_RESET_RETRY_DELAY_MS = 3_000;

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
