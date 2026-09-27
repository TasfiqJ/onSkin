import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountGenerationLease } from '@/lib/auth/accountGeneration';

const mocks = vi.hoisted(() => ({
  deleteTrendState: vi.fn(),
  setTrendInsightsLocal: vi.fn(),
  track: vi.fn(),
  withdrawConsent: vi.fn(),
}));

const lease = {
  assertCurrent: vi.fn(),
} as unknown as AccountGenerationLease;

vi.mock('@/lib/analytics/track', () => ({
  track: mocks.track,
}));

vi.mock('@/lib/auth/accountGeneration', () => ({
  awaitAccountGenerationLease: async (
    _lease: AccountGenerationLease,
    operation: () => Promise<unknown>,
  ) => operation(),
  runAccountGenerationOperation: async (
    operation: (ownerLease: AccountGenerationLease) => Promise<unknown>,
  ) => operation(lease),
}));

vi.mock('@/lib/consent/workflow', () => ({
  runSerializedConsentWorkflow: async (
    _lease: AccountGenerationLease,
    operation: () => Promise<unknown>,
  ) => operation(),
}));

vi.mock('@/lib/consent/withdrawal', () => ({
  withdrawConsent: mocks.withdrawConsent,
}));

vi.mock('./store', () => ({
  deleteTrendState: mocks.deleteTrendState,
  setTrendInsightsLocal: mocks.setTrendInsightsLocal,
}));

describe('PHOTO-05A Trend consent zero admission', () => {
  beforeEach(() => {
    mocks.deleteTrendState.mockReset().mockResolvedValue(undefined);
    mocks.setTrendInsightsLocal.mockReset().mockResolvedValue(undefined);
    mocks.track.mockReset();
    mocks.withdrawConsent.mockReset().mockResolvedValue(undefined);
    vi.mocked(lease.assertCurrent).mockReset();
  });

  it('ignores legacy consent without reading or mutating private state', async () => {
    const { isTrendInsightsConsented, isTrendInsightsConsentedWithLease } =
      await import('./consent');

    await expect(isTrendInsightsConsented()).resolves.toBe(false);
    await expect(isTrendInsightsConsentedWithLease(lease)).resolves.toBe(false);

    expect(lease.assertCurrent).toHaveBeenCalledOnce();
    expect(mocks.setTrendInsightsLocal).not.toHaveBeenCalled();
    expect(mocks.deleteTrendState).not.toHaveBeenCalled();
    expect(mocks.withdrawConsent).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it('rejects a direct grant caller before storage, ledger, network, or analytics work', async () => {
    const { grantTrendInsightsConsent, TREND_ENGINE_UNAVAILABLE } = await import('./consent');

    await expect(grantTrendInsightsConsent()).rejects.toThrow(TREND_ENGINE_UNAVAILABLE);

    expect(mocks.setTrendInsightsLocal).not.toHaveBeenCalled();
    expect(mocks.deleteTrendState).not.toHaveBeenCalled();
    expect(mocks.withdrawConsent).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it('preserves explicit legacy revocation cleanup and records analytics only after success', async () => {
    const { revokeTrendInsightsConsent } = await import('./consent');

    await expect(revokeTrendInsightsConsent()).resolves.toBeUndefined();

    expect(mocks.setTrendInsightsLocal).toHaveBeenCalledWith(false);
    expect(mocks.deleteTrendState).toHaveBeenCalledOnce();
    expect(mocks.withdrawConsent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'photo_trend_insights' }),
    );
    expect(mocks.track).toHaveBeenCalledWith('trend_consent_revoked');
  });

  it('keeps legacy state disabled and withholds analytics when withdrawal recording fails', async () => {
    mocks.withdrawConsent.mockRejectedValueOnce(new Error('withdrawal unavailable'));
    const { revokeTrendInsightsConsent } = await import('./consent');

    await expect(revokeTrendInsightsConsent()).rejects.toThrow('withdrawal unavailable');

    expect(mocks.setTrendInsightsLocal).toHaveBeenCalledWith(false);
    expect(mocks.deleteTrendState).toHaveBeenCalledOnce();
    expect(mocks.track).not.toHaveBeenCalled();
  });
});
