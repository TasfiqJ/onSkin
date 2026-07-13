import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isSupabaseConfigured: false,
  getLatestConsents: vi.fn(),
  recordConsent: vi.fn(),
  track: vi.fn(),
  withdrawConsent: vi.fn(),
  deleteTrendState: vi.fn(),
  readTrendInsightsLocal: vi.fn(),
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

vi.mock('@/lib/env', () => ({
  get isSupabaseConfigured() {
    return mocks.isSupabaseConfigured;
  },
}));

vi.mock('./store', () => ({
  deleteTrendState: mocks.deleteTrendState,
  readTrendInsightsLocal: mocks.readTrendInsightsLocal,
  setTrendInsightsLocal: mocks.setTrendInsightsLocal,
}));

vi.mock('@/lib/storage/privateBoolean', () => ({
  requirePrivateBoolean: (result: { status: string; value?: boolean }) => {
    if (result.status === 'available') return result.value === true;
    if (result.status === 'absent') return false;
    if (result.status === 'corrupt') throw new Error('PRIVATE_BOOLEAN_INVALID');
    if (result.status === 'unsupported_version') {
      throw new Error('PRIVATE_BOOLEAN_UNSUPPORTED_VERSION');
    }
    throw new Error('PRIVATE_BOOLEAN_UNAVAILABLE');
  },
}));

describe('trend insight consent persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.isSupabaseConfigured = false;
    mocks.getLatestConsents.mockReset();
    mocks.recordConsent.mockReset();
    mocks.track.mockReset();
    mocks.withdrawConsent.mockReset();
    mocks.deleteTrendState.mockReset();
    mocks.readTrendInsightsLocal.mockReset();
    mocks.setTrendInsightsLocal.mockReset();
    mocks.recordConsent.mockResolvedValue(undefined);
    mocks.withdrawConsent.mockResolvedValue(undefined);
    mocks.deleteTrendState.mockResolvedValue(undefined);
    mocks.readTrendInsightsLocal.mockResolvedValue({ status: 'absent' });
    mocks.setTrendInsightsLocal.mockResolvedValue(undefined);
  });

  it('does not silently enroll installed-base photo users without trend consent', async () => {
    mocks.isSupabaseConfigured = true;
    const { isTrendInsightsConsented } = await import('./consent');
    mocks.getLatestConsents.mockResolvedValueOnce({ photo_capture: true });
    mocks.readTrendInsightsLocal.mockResolvedValueOnce({
      status: 'available',
      value: true,
      format: 'current',
    });

    await expect(isTrendInsightsConsented()).resolves.toBe(false);

    expect(mocks.readTrendInsightsLocal).not.toHaveBeenCalled();
  });

  it('requires the explicit trend consent row when the ledger is reachable', async () => {
    mocks.isSupabaseConfigured = true;
    const { isTrendInsightsConsented } = await import('./consent');
    mocks.getLatestConsents.mockResolvedValueOnce({
      photo_capture: true,
      photo_trend_insights: true,
    });

    await expect(isTrendInsightsConsented()).resolves.toBe(true);

    expect(mocks.readTrendInsightsLocal).not.toHaveBeenCalled();
  });

  it('keeps local-first trend consent available when the backend is not configured', async () => {
    const { isTrendInsightsConsented } = await import('./consent');
    mocks.getLatestConsents.mockResolvedValueOnce({});
    mocks.readTrendInsightsLocal.mockResolvedValueOnce({
      status: 'available',
      value: true,
      format: 'legacy',
    });

    await expect(isTrendInsightsConsented()).resolves.toBe(true);
  });

  it('does not disguise corrupt local trend consent as an ordinary decline', async () => {
    const { isTrendInsightsConsented } = await import('./consent');
    mocks.getLatestConsents.mockRejectedValueOnce(new Error('ledger unavailable'));
    mocks.readTrendInsightsLocal.mockResolvedValueOnce({
      status: 'corrupt',
      reason: 'invalid_value',
    });

    await expect(isTrendInsightsConsented()).rejects.toThrow('PRIVATE_BOOLEAN_INVALID');
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

  it('fails closed and relocks trend consent when the consent ledger fails', async () => {
    const { grantTrendInsightsConsent } = await import('./consent');
    mocks.recordConsent.mockRejectedValueOnce(new Error('ledger unavailable'));

    await expect(grantTrendInsightsConsent()).rejects.toThrow('ledger unavailable');

    expect(mocks.setTrendInsightsLocal).toHaveBeenNthCalledWith(1, true);
    expect(mocks.setTrendInsightsLocal).toHaveBeenNthCalledWith(2, false);
    expect(mocks.deleteTrendState).toHaveBeenCalledTimes(1);
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
