import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getLatestConsents: vi.fn(),
  recordConsent: vi.fn(),
  track: vi.fn(),
  withdrawConsent: vi.fn(),
  readCommerceConsentLocal: vi.fn(),
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
  readCommerceConsentLocal: mocks.readCommerceConsentLocal,
  setCommerceConsentLocal: mocks.setCommerceConsentLocal,
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

describe('commerce consent persistence', () => {
  beforeEach(() => {
    mocks.getLatestConsents.mockReset();
    mocks.recordConsent.mockReset();
    mocks.track.mockReset();
    mocks.withdrawConsent.mockReset();
    mocks.readCommerceConsentLocal.mockReset();
    mocks.setCommerceConsentLocal.mockReset();
    mocks.recordConsent.mockResolvedValue(undefined);
    mocks.withdrawConsent.mockResolvedValue(undefined);
    mocks.readCommerceConsentLocal.mockResolvedValue({ status: 'absent' });
    mocks.setCommerceConsentLocal.mockResolvedValue(undefined);
  });

  it('does not consult local storage when the consent ledger is authoritative', async () => {
    const { isCommerceConsented } = await import('./consent');
    mocks.getLatestConsents.mockResolvedValueOnce({ data_sharing: false });

    await expect(isCommerceConsented()).resolves.toBe(false);

    expect(mocks.readCommerceConsentLocal).not.toHaveBeenCalled();
  });

  it('uses a valid local decision only when the ledger has no decision', async () => {
    const { isCommerceConsented } = await import('./consent');
    mocks.getLatestConsents.mockResolvedValueOnce({});
    mocks.readCommerceConsentLocal.mockResolvedValueOnce({
      status: 'available',
      value: true,
      format: 'legacy',
    });

    await expect(isCommerceConsented()).resolves.toBe(true);
  });

  it('does not disguise unavailable local commerce consent as a decline', async () => {
    const { isCommerceConsented } = await import('./consent');
    mocks.getLatestConsents.mockRejectedValueOnce(new Error('ledger unavailable'));
    mocks.readCommerceConsentLocal.mockResolvedValueOnce({
      status: 'unavailable',
      reason: 'content_key_storage_unavailable',
    });

    await expect(isCommerceConsented()).rejects.toThrow('PRIVATE_BOOLEAN_UNAVAILABLE');
  });

  it('records commerce grant analytics after the local-first consent flag saves', async () => {
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

  it('keeps commerce grant local-first when the consent ledger is unavailable', async () => {
    const { grantCommerceConsent } = await import('./consent');
    mocks.recordConsent.mockRejectedValueOnce(new Error('ledger unavailable'));

    await expect(grantCommerceConsent()).resolves.toBeUndefined();

    expect(mocks.setCommerceConsentLocal).toHaveBeenCalledTimes(1);
    expect(mocks.setCommerceConsentLocal).toHaveBeenCalledWith(true);
    expect(mocks.track).toHaveBeenCalledWith('commerce_consent_granted');
  });

  it('records commerce decline analytics after the local-first revocation saves', async () => {
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

  it('keeps commerce revocation local-first when the consent ledger is unavailable', async () => {
    const { declineCommerceConsent } = await import('./consent');
    mocks.withdrawConsent.mockRejectedValueOnce(new Error('withdrawal unavailable'));

    await expect(declineCommerceConsent()).resolves.toBeUndefined();

    expect(mocks.setCommerceConsentLocal).toHaveBeenCalledWith(false);
    expect(mocks.track).toHaveBeenCalledWith('commerce_consent_declined');
  });
});
