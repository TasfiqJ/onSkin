import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  confirmCommunityAge,
  grantCommunityConsent,
  isCommunityConsented,
  withdrawCommunityConsent,
} from './consent';

const mocks = vi.hoisted(() => ({
  active: vi.fn(),
  grant: vi.fn(),
  withdraw: vi.fn(),
  clear: vi.fn(),
  age: vi.fn(),
  track: vi.fn(),
}));
vi.mock('@/lib/consent/dependentConsentLifecycle', () => ({
  isHealthDependentConsentActive: mocks.active,
  grantHealthDependentConsent: mocks.grant,
  withdrawHealthDependentConsent: mocks.withdraw,
}));
vi.mock('./store', () => ({
  clearCommunityState: mocks.clear,
  setAgeConfirmedLocal: mocks.age,
}));
vi.mock('@/lib/analytics/track', () => ({ track: mocks.track }));

describe('community dependent consent facade', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.active.mockResolvedValue(false);
    mocks.grant.mockResolvedValue(undefined);
    mocks.withdraw.mockResolvedValue(undefined);
    mocks.age.mockResolvedValue(undefined);
  });

  it('has no boolean/offline fallback for community disclosure', async () => {
    await isCommunityConsented();
    expect(mocks.active).toHaveBeenCalledWith('community_participation', {
      deleteLocalOnAuthoritativeClose: mocks.clear,
    });
  });

  it('keeps age affirmation separate', async () => {
    await confirmCommunityAge();
    expect(mocks.age).toHaveBeenCalledWith(true);
    expect(mocks.grant).not.toHaveBeenCalled();
  });

  it('tracks only successful grant and withdrawal operations', async () => {
    await grantCommunityConsent();
    await withdrawCommunityConsent();
    expect(mocks.withdraw).toHaveBeenCalledWith({
      type: 'community_participation',
      deleteLocal: mocks.clear,
    });
    mocks.withdraw.mockRejectedValueOnce(new Error('pending'));
    await expect(withdrawCommunityConsent()).rejects.toThrow('pending');
    expect(mocks.track).toHaveBeenCalledTimes(2);
  });
});
