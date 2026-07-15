import { describe, expect, it } from 'vitest';

import { restoreFeedbackMessage } from './restoreFeedback';

describe('restore feedback', () => {
  it('does not misreport pending or unverified store completion as no purchase', () => {
    expect(restoreFeedbackMessage({ active: false, pending: true })).toContain(
      'still processing',
    );
    for (const result of [
      { active: false, verificationPending: true },
      { active: false, purchaseMayHaveCompleted: true },
    ]) {
      const message = restoreFeedbackMessage(result);
      expect(message).toContain('could not be verified yet');
      expect(message).toContain('Do not purchase again');
      expect(message).toContain('try Restore Purchases again');
      expect(message).not.toContain('purchase was found');
      expect(message).not.toContain('No active subscription');
    }
  });

  it('keeps verified restore, existing access, and verified-empty messages distinct', () => {
    expect(restoreFeedbackMessage({ active: true, storePurchaseFound: true })).toContain(
      'restored',
    );
    expect(restoreFeedbackMessage({ active: true })).toContain('existing Pro access');
    expect(restoreFeedbackMessage({ active: false })).toBe(
      'No active subscription was found for this account.',
    );
  });
});
