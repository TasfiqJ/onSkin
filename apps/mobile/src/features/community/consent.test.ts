import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getLatestConsents: vi.fn(),
  recordConsent: vi.fn(),
  track: vi.fn(),
  withdrawConsent: vi.fn(),
  getCommunityConsentLocal: vi.fn(),
  setAgeConfirmedLocal: vi.fn(),
  setCommunityConsentLocal: vi.fn(),
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
  getCommunityConsentLocal: mocks.getCommunityConsentLocal,
  setAgeConfirmedLocal: mocks.setAgeConfirmedLocal,
  setCommunityConsentLocal: mocks.setCommunityConsentLocal,
}));

describe('community consent persistence', () => {
  beforeEach(() => {
    mocks.getLatestConsents.mockReset();
    mocks.recordConsent.mockReset();
    mocks.track.mockReset();
    mocks.withdrawConsent.mockReset();
    mocks.getCommunityConsentLocal.mockReset();
    mocks.setAgeConfirmedLocal.mockReset();
    mocks.setCommunityConsentLocal.mockReset();
    mocks.recordConsent.mockResolvedValue(undefined);
    mocks.withdrawConsent.mockResolvedValue(undefined);
    mocks.getCommunityConsentLocal.mockResolvedValue(false);
    mocks.setAgeConfirmedLocal.mockResolvedValue(undefined);
    mocks.setCommunityConsentLocal.mockResolvedValue(undefined);
  });

  it('records community grant analytics only after the consent ledger saves', async () => {
    const { grantCommunityConsent } = await import('./consent');

    await expect(grantCommunityConsent()).resolves.toBeUndefined();

    expect(mocks.setCommunityConsentLocal).toHaveBeenCalledWith(true);
    expect(mocks.recordConsent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'community_participation', granted: true }),
    );
    expect(mocks.track).toHaveBeenCalledWith('community_consent_granted');
    expect(mocks.recordConsent.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.track.mock.invocationCallOrder[0],
    );
  });

  it('keeps local-first community consent when the consent ledger mirror fails', async () => {
    const { grantCommunityConsent } = await import('./consent');
    mocks.recordConsent.mockRejectedValueOnce(new Error('ledger unavailable'));

    await expect(grantCommunityConsent()).resolves.toBeUndefined();

    expect(mocks.setCommunityConsentLocal).toHaveBeenCalledTimes(1);
    expect(mocks.setCommunityConsentLocal).toHaveBeenCalledWith(true);
    expect(mocks.track).not.toHaveBeenCalledWith('community_consent_granted');
  });

  it('records the age gate separately from community consent', async () => {
    const { confirmCommunityAge } = await import('./consent');

    await expect(confirmCommunityAge()).resolves.toBeUndefined();

    expect(mocks.setAgeConfirmedLocal).toHaveBeenCalledWith(true);
    expect(mocks.recordConsent).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
  });
});
