import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LOCAL_RESET_RETRY_DELAY_MS,
  isRetryablePreMigrationContainerExit125,
  runWithSinglePreMigrationContainerRetry,
} from './local-supabase-reset-retry.mjs';

function containedFailure(diagnostic) {
  return Object.assign(new Error('contained command failed'), {
    originReason: 'exit-nonzero',
    diagnostic,
  });
}

const retryableFailure = containedFailure(`Resetting local database...
WARN: config section [inbucket] is deprecated. Please use [local_smtp] instead.
Recreating database...
Initialising schema...
error running container: exit 125
Try rerunning the command with --debug to troubleshoot the error.`);

test('retries the precise pre-migration container exit 125 once after the bounded delay', async () => {
  let attempts = 0;
  const waits = [];
  let retries = 0;

  const result = await runWithSinglePreMigrationContainerRetry({
    operation: async () => {
      attempts += 1;
      if (attempts === 1) throw retryableFailure;
      return 'passed';
    },
    onRetry: () => {
      retries += 1;
    },
    wait: async (milliseconds) => {
      waits.push(milliseconds);
    },
  });

  assert.equal(result, 'passed');
  assert.equal(attempts, 2);
  assert.equal(retries, 1);
  assert.deepEqual(waits, [LOCAL_RESET_RETRY_DELAY_MS]);
});

test('propagates a second matching failure without a third attempt', async () => {
  let attempts = 0;
  let waits = 0;

  await assert.rejects(
    runWithSinglePreMigrationContainerRetry({
      operation: async () => {
        attempts += 1;
        throw retryableFailure;
      },
      onRetry: () => {},
      wait: async () => {
        waits += 1;
      },
    }),
    retryableFailure,
  );

  assert.equal(attempts, 2);
  assert.equal(waits, 1);
});

test('does not retry SQL, migration, seed, test, or other container failures', async () => {
  const failures = [
    containedFailure(`Resetting local database...
Recreating database...
Initialising schema...
error running container: exit 1`),
    containedFailure(`Resetting local database...
Recreating database...
Initialising schema...
Applying migration 20260926000078_public_acl.sql...
ERROR: permission denied (SQLSTATE 42501)`),
    containedFailure(`Resetting local database...
Recreating database...
Initialising schema...
Seeding data from supabase/seed.sql...
ERROR: relation missing (SQLSTATE 42P01)`),
    containedFailure(`Testing database...
not ok 1 - structural contract`),
    Object.assign(new Error('timed out'), {
      originReason: 'timeout',
      diagnostic: retryableFailure.diagnostic,
    }),
  ];

  for (const failure of failures) {
    assert.equal(isRetryablePreMigrationContainerExit125(failure), false);
    let attempts = 0;
    await assert.rejects(
      runWithSinglePreMigrationContainerRetry({
        operation: async () => {
          attempts += 1;
          throw failure;
        },
        onRetry: () => assert.fail('unexpected retry'),
        wait: async () => assert.fail('unexpected delay'),
      }),
      failure,
    );
    assert.equal(attempts, 1);
  }
});
