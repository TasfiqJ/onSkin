import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  grantTrendInsightsConsent,
  isTrendInsightsConsented,
  revokeTrendInsightsConsent,
} from './consent';

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
vi.mock('./store', () => ({ clearTrendStore: mocks.clear }));
vi.mock('@/lib/analytics/track', () => ({ track: mocks.track }));

describe('trend dependent consent facade', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.active.mockResolvedValue(false);
    mocks.grant.mockResolvedValue(undefined);
    mocks.withdraw.mockResolvedValue(undefined);
  });

  it('permits only an exact local receipt when Supabase is unconfigured', async () => {
    await isTrendInsightsConsented();
    expect(mocks.active).toHaveBeenCalledWith('photo_trend_insights', {
      allowExactLocalReceiptWhenUnconfigured: true,
      deleteLocalOnAuthoritativeClose: mocks.clear,
    });
  });

  it('tracks only successful exact grants', async () => {
    await grantTrendInsightsConsent();
    expect(mocks.grant).toHaveBeenCalledWith('photo_trend_insights', {
      allowExactLocalReceiptWhenUnconfigured: true,
    });
    mocks.grant.mockRejectedValueOnce(new Error('stale generation'));
    await expect(grantTrendInsightsConsent()).rejects.toThrow('stale generation');
    expect(mocks.track).toHaveBeenCalledTimes(1);
  });

  it('keeps failed withdrawal visibly unsuccessful', async () => {
    await revokeTrendInsightsConsent();
    expect(mocks.withdraw).toHaveBeenCalledWith({
      type: 'photo_trend_insights',
      deleteLocal: mocks.clear,
    });
    mocks.withdraw.mockRejectedValueOnce(new Error('pending'));
    await expect(revokeTrendInsightsConsent()).rejects.toThrow('pending');
    expect(mocks.track).toHaveBeenCalledTimes(1);
  });
});
