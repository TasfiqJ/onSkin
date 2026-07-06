import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getLatestConsents: vi.fn(),
  recordConsent: vi.fn(),
  track: vi.fn(),
  withdrawConsent: vi.fn(),
  deleteTrendState: vi.fn(),
  getTrendInsightsLocal: vi.fn(),
  setTrendInsightsLocal: vi.fn(),
}));

vi.mock('@/lib/analytics/track', () => ({
  track: mocks.track,
}));

vi.mock('@/lib/consent/consent', () => ({
  getLatestConsents: mocks.getLatestConsents,
  recordConsent: mocks.recordConsent,
}));

vi.mock('@/lib/consent/withdrawal', () => ({
  withdrawConsent: mocks.withdrawConsent,
}));

vi.mock('./store', () => ({
  deleteTrendState: mocks.deleteTrendState,
  getTrendInsightsLocal: mocks.getTrendInsightsLocal,
  setTrendInsightsLocal: mocks.setTrendInsightsLocal,
}));

describe('trend insight consent persistence', () => {
  beforeEach(() => {
    mocks.getLatestConsents.mockReset();
    mocks.recordConsent.mockReset();
    mocks.track.mockReset();
    mocks.withdrawConsent.mockReset();
    mocks.deleteTrendState.mockReset();
    mocks.getTrendInsightsLocal.mockReset();
    mocks.setTrendInsightsLocal.mockReset();
    mocks.recordConsent.mockResolvedValue(undefined);
    mocks.withdrawConsent.mockResolvedValue(undefined);
    mocks.deleteTrendState.mockResolvedValue(undefined);
    mocks.getTrendInsightsLocal.mockResolvedValue(false);
    mocks.setTrendInsightsLocal.mockResolvedValue(undefined);
  });

  it('records trend opt-in analytics only after the consent ledger saves', async () => {
    const { grantTrendInsightsConsent } = await import('./consent');

    await expect(grantTrendInsightsConsent()).resolves.toBeUndefined();

    expect(mocks.setTrendInsightsLocal).toHaveBeenCalledWith(true);
    expect(mocks.recordConsent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'photo_trend_insights', granted: true }),
    );
    expect(mocks.track).toHaveBeenCalledWith('trend_insights_opted_in');
    expect(mocks.recordConsent.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.track.mock.invocationCallOrder[0],
    );
  });

  it('does not emit trend opt-in analytics when the consent ledger fails', async () => {
    const { grantTrendInsightsConsent } = await import('./consent');
    mocks.recordConsent.mockRejectedValueOnce(new Error('ledger unavailable'));

    await expect(grantTrendInsightsConsent()).resolves.toBeUndefined();

    expect(mocks.setTrendInsightsLocal).toHaveBeenCalledWith(true);
    expect(mocks.track).not.toHaveBeenCalledWith('trend_insights_opted_in');
  });

  it('records trend revocation analytics only after withdrawal succeeds', async () => {
    const { revokeTrendInsightsConsent } = await import('./consent');

    await expect(revokeTrendInsightsConsent()).resolves.toBeUndefined();

    expect(mocks.setTrendInsightsLocal).toHaveBeenCalledWith(false);
    expect(mocks.deleteTrendState).toHaveBeenCalledTimes(1);
    expect(mocks.withdrawConsent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'photo_trend_insights' }),
    );
    expect(mocks.track).toHaveBeenCalledWith('trend_consent_revoked');
    expect(mocks.withdrawConsent.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.track.mock.invocationCallOrder[0],
    );
  });

  it('does not emit revoked analytics when withdrawal fails', async () => {
    const { revokeTrendInsightsConsent } = await import('./consent');
    mocks.withdrawConsent.mockRejectedValueOnce(new Error('withdrawal unavailable'));

    await expect(revokeTrendInsightsConsent()).rejects.toThrow('withdrawal unavailable');

    expect(mocks.setTrendInsightsLocal).toHaveBeenCalledWith(false);
    expect(mocks.deleteTrendState).toHaveBeenCalledTimes(1);
    expect(mocks.track).not.toHaveBeenCalledWith('trend_consent_revoked');
  });
});
