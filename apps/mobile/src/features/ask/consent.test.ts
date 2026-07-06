import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getLatestConsents: vi.fn(),
  recordConsent: vi.fn(),
  track: vi.fn(),
  withdrawConsent: vi.fn(),
  clearAskStore: vi.fn(),
  getAskConsentLocal: vi.fn(),
  setAskConsentLocal: vi.fn(),
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
  clearAskStore: mocks.clearAskStore,
  getAskConsentLocal: mocks.getAskConsentLocal,
  setAskConsentLocal: mocks.setAskConsentLocal,
}));

describe('Ask consent persistence', () => {
  beforeEach(() => {
    mocks.getLatestConsents.mockReset();
    mocks.recordConsent.mockReset();
    mocks.track.mockReset();
    mocks.withdrawConsent.mockReset();
    mocks.clearAskStore.mockReset();
    mocks.getAskConsentLocal.mockReset();
    mocks.setAskConsentLocal.mockReset();
    mocks.recordConsent.mockResolvedValue(undefined);
    mocks.withdrawConsent.mockResolvedValue(undefined);
    mocks.clearAskStore.mockResolvedValue(undefined);
    mocks.getAskConsentLocal.mockResolvedValue(false);
    mocks.setAskConsentLocal.mockResolvedValue(undefined);
  });

  it('records Ask grant analytics only after the consent ledger saves', async () => {
    const { grantAskConsent } = await import('./consent');

    await expect(grantAskConsent()).resolves.toBeUndefined();

    expect(mocks.setAskConsentLocal).toHaveBeenCalledWith(true);
    expect(mocks.recordConsent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ask_onskin', granted: true }),
    );
    expect(mocks.track).toHaveBeenCalledWith('ask_consent_granted');
    expect(mocks.recordConsent.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.track.mock.invocationCallOrder[0],
    );
  });

  it('does not emit Ask grant analytics when the consent ledger fails', async () => {
    const { grantAskConsent } = await import('./consent');
    mocks.recordConsent.mockRejectedValueOnce(new Error('ledger unavailable'));

    await expect(grantAskConsent()).resolves.toBeUndefined();

    expect(mocks.setAskConsentLocal).toHaveBeenCalledWith(true);
    expect(mocks.track).not.toHaveBeenCalledWith('ask_consent_granted');
  });

  it('records Ask revocation analytics only after withdrawal succeeds', async () => {
    const { revokeAskConsent } = await import('./consent');

    await expect(revokeAskConsent()).resolves.toBeUndefined();

    expect(mocks.clearAskStore).toHaveBeenCalledTimes(1);
    expect(mocks.withdrawConsent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ask_onskin' }),
    );
    expect(mocks.track).toHaveBeenCalledWith('ask_consent_revoked');
    expect(mocks.withdrawConsent.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.track.mock.invocationCallOrder[0],
    );
  });

  it('does not emit Ask revocation analytics when withdrawal fails', async () => {
    const { revokeAskConsent } = await import('./consent');
    mocks.withdrawConsent.mockRejectedValueOnce(new Error('withdrawal unavailable'));

    await expect(revokeAskConsent()).rejects.toThrow('withdrawal unavailable');

    expect(mocks.clearAskStore).toHaveBeenCalledTimes(1);
    expect(mocks.track).not.toHaveBeenCalledWith('ask_consent_revoked');
  });
});
