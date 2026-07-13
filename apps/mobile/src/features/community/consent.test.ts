import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getLatestConsents: vi.fn(),
  recordConsent: vi.fn(),
  track: vi.fn(),
  withdrawConsent: vi.fn(),
  readCommunityConsentLocal: vi.fn(),
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
  readCommunityConsentLocal: mocks.readCommunityConsentLocal,
  setAgeConfirmedLocal: mocks.setAgeConfirmedLocal,
  setCommunityConsentLocal: mocks.setCommunityConsentLocal,
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

describe('community consent persistence', () => {
  beforeEach(() => {
    mocks.getLatestConsents.mockReset();
    mocks.recordConsent.mockReset();
    mocks.track.mockReset();
    mocks.withdrawConsent.mockReset();
    mocks.readCommunityConsentLocal.mockReset();
    mocks.setAgeConfirmedLocal.mockReset();
    mocks.setCommunityConsentLocal.mockReset();
    mocks.recordConsent.mockResolvedValue(undefined);
    mocks.withdrawConsent.mockResolvedValue(undefined);
    mocks.readCommunityConsentLocal.mockResolvedValue({ status: 'absent' });
    mocks.setAgeConfirmedLocal.mockResolvedValue(undefined);
    mocks.setCommunityConsentLocal.mockResolvedValue(undefined);
  });

  it('uses the explicit local community decision when the ledger is unavailable', async () => {
    const { isCommunityConsented } = await import('./consent');
    mocks.getLatestConsents.mockRejectedValueOnce(new Error('ledger unavailable'));
    mocks.readCommunityConsentLocal.mockResolvedValueOnce({
      status: 'available',
      value: false,
      format: 'current',
    });

    await expect(isCommunityConsented()).resolves.toBe(false);
  });

  it('does not disguise a future local community consent schema as a decline', async () => {
    const { isCommunityConsented } = await import('./consent');
    mocks.getLatestConsents.mockRejectedValueOnce(new Error('ledger unavailable'));
    mocks.readCommunityConsentLocal.mockResolvedValueOnce({ status: 'unsupported_version' });

    await expect(isCommunityConsented()).rejects.toThrow(
      'PRIVATE_BOOLEAN_UNSUPPORTED_VERSION',
    );
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
