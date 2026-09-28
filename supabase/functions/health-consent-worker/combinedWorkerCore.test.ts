// deno-lint-ignore-file require-await
import {
  CombinedHealthConsentWorkerError,
  runHealthConsentWorkerLanes,
} from './combinedWorkerCore.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function report(completed: number) {
  return {
    claimed: 1,
    completed,
    deferred: completed ? 0 : 1,
    actionRequired: 0,
    deadlineReached: false,
  };
}

Deno.test('base-lane failure cannot starve dependent withdrawals', async () => {
  let dependentRan = false;
  const result = await runHealthConsentWorkerLanes({
    runBase: () => {
      throw new Error('base claim unavailable');
    },
    runDependent: async () => {
      dependentRan = true;
      return report(1);
    },
  });
  assert(dependentRan, 'dependent lane must progress independently');
  assert(
    result.completed === 1 &&
      result.partialFailure === true &&
      result.failedLanes?.[0] === 'base',
    'partial base failure must be truthful and redacted',
  );
});

Deno.test('dependent-lane failure cannot starve base withdrawals', async () => {
  let baseRan = false;
  const result = await runHealthConsentWorkerLanes({
    runBase: async () => {
      baseRan = true;
      return report(1);
    },
    runDependent: async () => {
      throw new Error('dependent claim unavailable');
    },
  });
  assert(baseRan, 'base lane must progress independently');
  assert(
    result.completed === 1 &&
      result.partialFailure === true &&
      result.failedLanes?.[0] === 'dependent',
    'partial dependent failure must be truthful and redacted',
  );
});

Deno.test('total lane failure remains a scheduler-level unavailable result', async () => {
  try {
    await runHealthConsentWorkerLanes({
      runBase: async () => {
        throw new Error('base secret detail');
      },
      runDependent: async () => {
        throw new Error('dependent secret detail');
      },
    });
  } catch (error) {
    assert(
      error instanceof CombinedHealthConsentWorkerError,
      'all-lane failure must collapse to a stable redacted code',
    );
    return;
  }
  throw new Error('expected all-lane failure');
});
