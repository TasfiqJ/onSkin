import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  declineCommerceConsent,
  grantCommerceConsent,
  isCommerceConsented,
  refuseCommerceConsent,
} from './consent';

const mocks = vi.hoisted(() => ({
  active: vi.fn(),
  grant: vi.fn(),
  refuse: vi.fn(),
  withdraw: vi.fn(),
  clear: vi.fn(),
  track: vi.fn(),
}));
vi.mock('@/lib/consent/dependentConsentLifecycle', () => ({
  isHealthDependentConsentActive: mocks.active,
  grantHealthDependentConsent: mocks.grant,
  refuseHealthDependentConsent: mocks.refuse,
  withdrawHealthDependentConsent: mocks.withdraw,
}));
vi.mock('./store', () => ({ clearCommerceState: mocks.clear }));
vi.mock('@/lib/analytics/track', () => ({ track: mocks.track }));

describe('commerce dependent consent facade', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.active.mockResolvedValue(false);
    mocks.grant.mockResolvedValue(undefined);
    mocks.refuse.mockResolvedValue(undefined);
    mocks.withdraw.mockResolvedValue(undefined);
  });

  it('requires an authoritative exact status for partner disclosure', async () => {
    await isCommerceConsented();
    expect(mocks.active).toHaveBeenCalledWith('data_sharing', {
      deleteLocalOnAuthoritativeClose: mocks.clear,
    });
  });

  it('rolls visible success back when the configured grant fails', async () => {
    mocks.grant.mockRejectedValueOnce(new Error('receipt refused'));
    await expect(grantCommerceConsent()).rejects.toThrow('receipt refused');
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it('cannot report a failed configured revocation as successful', async () => {
    mocks.withdraw.mockRejectedValueOnce(new Error('withdrawal pending'));
    await expect(declineCommerceConsent()).rejects.toThrow('withdrawal pending');
    expect(mocks.withdraw).toHaveBeenCalledWith({
      type: 'data_sharing',
      deleteLocal: mocks.clear,
    });
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it('uses the non-revocation refusal lane for a never-consented sheet decline', async () => {
    await expect(refuseCommerceConsent()).resolves.toBeUndefined();
    expect(mocks.refuse).toHaveBeenCalledWith({
      type: 'data_sharing',
      deleteLocal: mocks.clear,
    });
    expect(mocks.withdraw).not.toHaveBeenCalled();
    expect(mocks.track).toHaveBeenCalledWith('commerce_consent_declined');
  });
});
