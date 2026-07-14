import { reverseTrialGrantErrorCode, reverseTrialGrantErrorStatus } from './grantErrors.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('reverse-trial grant exposes a stable deletion-in-progress conflict', () => {
  const code = reverseTrialGrantErrorCode({
    message: 'P0001: ACCOUNT_DELETION_IN_PROGRESS',
  });
  assert(code === 'account_deletion_in_progress', 'deletion barrier error was not classified.');
  assert(reverseTrialGrantErrorStatus(code) === 409, 'deletion barrier must be a conflict.');
});

Deno.test('reverse-trial grant keeps existing conflict classifications', () => {
  assert(
    reverseTrialGrantErrorCode({ message: 'ACTIVE_SUBSCRIPTION_EXISTS' }) ===
      'active_subscription_exists',
    'active subscription classification changed.',
  );
  assert(
    reverseTrialGrantErrorCode({ message: 'REVERSE_TRIAL_ALREADY_USED' }) ===
      'reverse_trial_already_used',
    'one-time grant classification changed.',
  );
  assert(
    reverseTrialGrantErrorStatus('active_subscription_exists') === 409 &&
      reverseTrialGrantErrorStatus('reverse_trial_already_used') === 409,
    'existing grant conflicts must remain HTTP 409.',
  );
});

Deno.test('reverse-trial grant contains unknown database failures', () => {
  const code = reverseTrialGrantErrorCode({ message: 'provider detail must not escape' });
  assert(code === 'reverse_trial_grant_failed', 'unknown failures must be contained.');
  assert(reverseTrialGrantErrorStatus(code) === 500, 'unknown failures must remain server errors.');
});
