import { beforeEach, describe, expect, it, vi } from 'vitest';

import { grantAskConsent, isAskConsented, revokeAskConsent } from './consent';

const mocks = vi.hoisted(() => ({
  active: vi.fn(),
  grant: vi.fn(),
  withdraw: vi.fn(),
  clear: vi.fn(),
  track: vi.fn(),
}));

vi.mock('@/lib/consent/dependentConsentLifecycle', () => ({
  isHealthDependentConsentActive: mocks.active,
  grantHealthDependentConsent: mocks.grant,
  withdrawHealthDependentConsent: mocks.withdraw,
}));
vi.mock('./store', () => ({ clearAskStore: mocks.clear }));
vi.mock('@/lib/analytics/track', () => ({ track: mocks.track }));

describe('Ask consent facade', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.active.mockResolvedValue(false);
    mocks.grant.mockResolvedValue(undefined);
    mocks.withdraw.mockResolvedValue(undefined);
  });

  it('uses only the authoritative dependent status gate', async () => {
    mocks.active.mockResolvedValueOnce(true);
    await expect(isAskConsented()).resolves.toBe(true);
    expect(mocks.active).toHaveBeenCalledWith('ask_onskin', {
      deleteLocalOnAuthoritativeClose: mocks.clear,
    });
  });

  it('publishes grant analytics only after the exact CAS succeeds', async () => {
    await grantAskConsent();
    expect(mocks.grant).toHaveBeenCalledWith('ask_onskin');
    expect(mocks.grant.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.track.mock.invocationCallOrder[0],
    );
  });

  it('does not publish a failed grant', async () => {
    mocks.grant.mockRejectedValueOnce(new Error('configured outage'));
    await expect(grantAskConsent()).rejects.toThrow('configured outage');
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it('passes local deletion into the durable withdrawal and reports no false success', async () => {
    await revokeAskConsent();
    expect(mocks.withdraw).toHaveBeenCalledWith({
      type: 'ask_onskin',
      deleteLocal: mocks.clear,
    });
    mocks.withdraw.mockRejectedValueOnce(new Error('withdrawal pending'));
    await expect(revokeAskConsent()).rejects.toThrow('withdrawal pending');
    expect(mocks.track).toHaveBeenCalledTimes(1);
  });
});
