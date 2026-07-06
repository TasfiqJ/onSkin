import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCOUNT_CONSENT } from './consentCopy';
import { recordAccountConsent } from './accountConsent';

const mocks = vi.hoisted(() => ({
  recordConsent: vi.fn(async () => {}),
}));

vi.mock('@/lib/consent/consent', () => ({
  recordConsent: mocks.recordConsent,
}));

describe('account consent persistence', () => {
  beforeEach(() => {
    mocks.recordConsent.mockClear();
    mocks.recordConsent.mockResolvedValue(undefined);
  });

  it('records account acceptance before account-created side effects', async () => {
    await recordAccountConsent();

    expect(mocks.recordConsent).toHaveBeenCalledWith({
      type: 'account',
      granted: true,
      version: ACCOUNT_CONSENT.version,
      consentText: ACCOUNT_CONSENT.fullText,
    });
  });

  it('propagates persistence failure so onboarding stays retryable', async () => {
    mocks.recordConsent.mockRejectedValueOnce(new Error('ledger unavailable'));

    await expect(recordAccountConsent()).rejects.toThrow('ledger unavailable');
  });
});
