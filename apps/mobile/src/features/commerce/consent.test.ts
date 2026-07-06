import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getLatestConsents: vi.fn(),
  recordConsent: vi.fn(),
  track: vi.fn(),
  withdrawConsent: vi.fn(),
  getCommerceConsentLocal: vi.fn(),
  setCommerceConsentLocal: vi.fn(),
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
  getCommerceConsentLocal: mocks.getCommerceConsentLocal,
  setCommerceConsentLocal: mocks.setCommerceConsentLocal,
}));

describe('commerce consent persistence', () => {
  beforeEach(() => {
    mocks.getLatestConsents.mockReset();
    mocks.recordConsent.mockReset();
    mocks.track.mockReset();
    mocks.withdrawConsent.mockReset();
    mocks.getCommerceConsentLocal.mockReset();
    mocks.setCommerceConsentLocal.mockReset();
    mocks.recordConsent.mockResolvedValue(undefined);
    mocks.withdrawConsent.mockResolvedValue(undefined);
    mocks.getCommerceConsentLocal.mockResolvedValue(false);
    mocks.setCommerceConsentLocal.mockResolvedValue(undefined);
  });

  it('records commerce grant analytics only after the consent ledger saves', async () => {
    const { grantCommerceConsent } = await import('./consent');

    await expect(grantCommerceConsent()).resolves.toBeUndefined();

    expect(mocks.setCommerceConsentLocal).toHaveBeenCalledWith(true);
    expect(mocks.recordConsent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'data_sharing', granted: true }),
    );
    expect(mocks.track).toHaveBeenCalledWith('commerce_consent_granted');
    expect(mocks.recordConsent.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.track.mock.invocationCallOrder[0],
    );
  });

  it('does not emit commerce grant analytics when the consent ledger fails', async () => {
    const { grantCommerceConsent } = await import('./consent');
    mocks.recordConsent.mockRejectedValueOnce(new Error('ledger unavailable'));

    await expect(grantCommerceConsent()).resolves.toBeUndefined();

    expect(mocks.setCommerceConsentLocal).toHaveBeenCalledWith(true);
    expect(mocks.track).not.toHaveBeenCalledWith('commerce_consent_granted');
  });

  it('records commerce decline analytics only after withdrawal succeeds', async () => {
    const { declineCommerceConsent } = await import('./consent');

    await expect(declineCommerceConsent()).resolves.toBeUndefined();

    expect(mocks.setCommerceConsentLocal).toHaveBeenCalledWith(false);
    expect(mocks.withdrawConsent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'data_sharing' }),
    );
    expect(mocks.track).toHaveBeenCalledWith('commerce_consent_declined');
    expect(mocks.withdrawConsent.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.track.mock.invocationCallOrder[0],
    );
  });

  it('does not emit declined analytics when withdrawal fails', async () => {
    const { declineCommerceConsent } = await import('./consent');
    mocks.withdrawConsent.mockRejectedValueOnce(new Error('withdrawal unavailable'));

    await expect(declineCommerceConsent()).rejects.toThrow('withdrawal unavailable');

    expect(mocks.setCommerceConsentLocal).toHaveBeenCalledWith(false);
    expect(mocks.track).not.toHaveBeenCalledWith('commerce_consent_declined');
  });
});
