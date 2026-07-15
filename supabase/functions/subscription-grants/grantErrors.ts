export type ReverseTrialGrantErrorCode =
  | 'account_deletion_in_progress'
  | 'active_subscription_exists'
  | 'store_entitlement_reconciliation_required'
  | 'reverse_trial_already_used'
  | 'reverse_trial_grant_failed';

export function reverseTrialGrantErrorCode(error: unknown): ReverseTrialGrantErrorCode {
  const message =
    typeof (error as { message?: unknown })?.message === 'string'
      ? (error as { message: string }).message
      : '';
  if (message.includes('ACCOUNT_DELETION_IN_PROGRESS')) {
    return 'account_deletion_in_progress';
  }
  if (message.includes('ACTIVE_SUBSCRIPTION_EXISTS')) return 'active_subscription_exists';
  if (message.includes('STORE_ENTITLEMENT_RECONCILIATION_REQUIRED')) {
    return 'store_entitlement_reconciliation_required';
  }
  if (message.includes('REVERSE_TRIAL_ALREADY_USED')) return 'reverse_trial_already_used';
  return 'reverse_trial_grant_failed';
}

export function reverseTrialGrantErrorStatus(code: ReverseTrialGrantErrorCode): number {
  return code === 'account_deletion_in_progress' ||
    code === 'active_subscription_exists' ||
    code === 'store_entitlement_reconciliation_required' ||
    code === 'reverse_trial_already_used'
    ? 409
    : 500;
}
