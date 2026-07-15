export type RestoreFeedbackResult = Readonly<{
  active: boolean;
  storePurchaseFound?: boolean;
  pending?: boolean;
  verificationPending?: boolean;
  purchaseMayHaveCompleted?: boolean;
}>;

export function restoreFeedbackMessage(result: RestoreFeedbackResult): string {
  if (result.pending) {
    return 'The store is still processing this purchase. Do not purchase again. Access will update after confirmation.';
  }
  if (result.verificationPending || result.purchaseMayHaveCompleted) {
    return 'Store status could not be verified yet. Do not purchase again. Check your connection and try Restore Purchases again.';
  }
  if (result.storePurchaseFound && result.active) {
    return 'Your active subscription is restored on this device.';
  }
  if (result.active) {
    return 'No store purchase was found. Your existing Pro access remains active.';
  }
  return 'No active subscription was found for this account.';
}
