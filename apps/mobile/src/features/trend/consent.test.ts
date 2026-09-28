import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  clearTrendStore: vi.fn(),
  track: vi.fn(),
  withdrawHealthDependentConsent: vi.fn(),
}));

vi.mock('@/lib/analytics/track', () => ({
  track: mocks.track,
}));

vi.mock('@/lib/consent/dependentConsentLifecycle', () => ({
  withdrawHealthDependentConsent: mocks.withdrawHealthDependentConsent,
}));

vi.mock('./store', () => ({
  clearTrendStore: mocks.clearTrendStore,
}));

describe('PHOTO-05A Trend consent zero admission', () => {
  beforeEach(() => {
    mocks.clearTrendStore.mockReset().mockResolvedValue(undefined);
    mocks.track.mockReset();
    mocks.withdrawHealthDependentConsent.mockReset().mockResolvedValue(undefined);
  });

  it('ignores legacy consent without reading or mutating private state', async () => {
    const { isTrendInsightsConsented } = await import('./consent');

    await expect(isTrendInsightsConsented()).resolves.toBe(false);

    expect(mocks.clearTrendStore).not.toHaveBeenCalled();
    expect(mocks.withdrawHealthDependentConsent).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it('rejects a direct grant caller before storage, ledger, network, or analytics work', async () => {
    const { grantTrendInsightsConsent, TREND_ENGINE_UNAVAILABLE } = await import('./consent');

    await expect(grantTrendInsightsConsent()).rejects.toThrow(TREND_ENGINE_UNAVAILABLE);

    expect(mocks.clearTrendStore).not.toHaveBeenCalled();
    expect(mocks.withdrawHealthDependentConsent).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it('preserves explicit legacy revocation through the shared cleanup lifecycle', async () => {
    const { revokeTrendInsightsConsent } = await import('./consent');

    await expect(revokeTrendInsightsConsent()).resolves.toBeUndefined();

    expect(mocks.withdrawHealthDependentConsent).toHaveBeenCalledWith({
      type: 'photo_trend_insights',
      deleteLocal: mocks.clearTrendStore,
    });
    expect(mocks.track).toHaveBeenCalledWith('trend_consent_revoked');
  });

  it('withholds analytics when the revocation lifecycle fails', async () => {
    mocks.withdrawHealthDependentConsent.mockRejectedValueOnce(
      new Error('withdrawal unavailable'),
    );
    const { revokeTrendInsightsConsent } = await import('./consent');

    await expect(revokeTrendInsightsConsent()).rejects.toThrow('withdrawal unavailable');

    expect(mocks.track).not.toHaveBeenCalled();
  });
});
