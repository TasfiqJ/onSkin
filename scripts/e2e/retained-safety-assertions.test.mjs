import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertCompletedAccountRecovery,
  assertNoUncaughtErrors,
  isDisallowedLog,
} from './retained-safety-assertions.mjs';

test('uncaught errors fail even when their text includes a normally allowed environment warning', () => {
  const event = {
    method: 'Runtime.exceptionThrown',
    params: { message: 'supabase.co 403 placeholder' },
  };
  assert.equal(isDisallowedLog(event), true);
  assert.throws(() => assertNoUncaughtErrors({ bodyText: 'Try again' }, [event]), /uncaught/);
});

test('a visible overlay fails independently of DOM recovery copy and missing exception events', () => {
  for (const overlay of [
    'Uncaught Error',
    'Uncaught (in promise)',
    'EXPLICIT_SIGN_OUT_LOCAL_BOUNDARY_INCOMPLETE',
  ]) {
    assert.throws(
      () => assertNoUncaughtErrors({ bodyText: `Account access paused Try again ${overlay}` }, []),
      /overlay/,
    );
  }
  assert.doesNotThrow(() =>
    assertNoUncaughtErrors({ bodyText: 'Account access paused Try again' }, []),
  );
});

test('a recovery summary cannot pass with obsolete or false completion flags', () => {
  const complete = Object.fromEntries(
    [
      'cleanupFailureStayedGated',
      'repeatedFailureStayedGated',
      'privateNamesHiddenAfterSignOut',
      'signedOutShelfAgeClosed',
      'signedOutTodayAgeClosed',
      'signedOutReloadAgeClosed',
      'terminalWelcome',
      'noUncaughtRuntimeExceptions',
    ].map((key) => [key, true]),
  );
  assert.doesNotThrow(() => assertCompletedAccountRecovery(complete));
  for (const key of Object.keys(complete)) {
    assert.throws(
      () => assertCompletedAccountRecovery({ ...complete, [key]: false }),
      /Incomplete/,
    );
  }
});
