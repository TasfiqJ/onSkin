import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';

const mocks = vi.hoisted(() => ({
  getLatestConsentsWithLease: vi.fn(),
  recordConsent: vi.fn(),
  track: vi.fn(),
  withdrawConsent: vi.fn(),
  clearCommerceConsentLocal: vi.fn(),
  readCommerceConsentLocal: vi.fn(),
  setCommerceConsentLocal: vi.fn(),
}));

vi.mock('@/lib/analytics/track', () => ({
  track: mocks.track,
}));

vi.mock('@/lib/consent/consent', () => ({
  getLatestConsentsWithLease: mocks.getLatestConsentsWithLease,
  recordConsent: mocks.recordConsent,
}));

vi.mock('@/lib/consent/withdrawal', () => ({
  withdrawConsent: mocks.withdrawConsent,
}));

vi.mock('./store', () => ({
  clearCommerceConsentLocal: mocks.clearCommerceConsentLocal,
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

let boundaryActive = false;

afterEach(() => {
  if (!boundaryActive) return;
  endAccountGenerationBoundary();
  boundaryActive = false;
});

describe('commerce consent persistence', () => {
  beforeEach(() => {
    mocks.getLatestConsentsWithLease.mockReset();
    mocks.recordConsent.mockReset();
    mocks.track.mockReset();
    mocks.withdrawConsent.mockReset();
    mocks.clearCommerceConsentLocal.mockReset();
    mocks.readCommerceConsentLocal.mockReset();
    mocks.setCommerceConsentLocal.mockReset();
    mocks.recordConsent.mockResolvedValue(undefined);
    mocks.withdrawConsent.mockResolvedValue(undefined);
    mocks.clearCommerceConsentLocal.mockResolvedValue(undefined);
    mocks.readCommerceConsentLocal.mockResolvedValue({ status: 'absent' });
    mocks.setCommerceConsentLocal.mockResolvedValue(undefined);
  });

  it('does not consult local storage when the consent ledger is authoritative', async () => {
    const { isCommerceConsented } = await import('./consent');
    mocks.getLatestConsentsWithLease.mockResolvedValueOnce({ data_sharing: false });

    await expect(isCommerceConsented()).resolves.toBe(false);

    expect(mocks.readCommerceConsentLocal).not.toHaveBeenCalled();
  });

  it('uses a valid local decision only when the ledger has no decision', async () => {
    const { isCommerceConsented } = await import('./consent');
    mocks.getLatestConsentsWithLease.mockResolvedValueOnce({});
    mocks.readCommerceConsentLocal.mockResolvedValueOnce({
      status: 'available',
      value: true,
      format: 'legacy',
    });

    await expect(isCommerceConsented()).resolves.toBe(true);
  });

  it('lets explicit local false veto a stale granted ledger row', async () => {
    const { isCommerceConsented } = await import('./consent');
    mocks.getLatestConsentsWithLease.mockResolvedValueOnce({ data_sharing: true });
    mocks.readCommerceConsentLocal.mockResolvedValueOnce({
      status: 'available',
      value: false,
      format: 'current',
    });

    await expect(isCommerceConsented()).resolves.toBe(false);
  });

  it('accepts a server grant on a new device when the local key is absent', async () => {
    const { isCommerceConsented } = await import('./consent');
    mocks.getLatestConsentsWithLease.mockResolvedValueOnce({ data_sharing: true });
    mocks.readCommerceConsentLocal.mockResolvedValueOnce({ status: 'absent' });

    await expect(isCommerceConsented()).resolves.toBe(true);
  });

  it('fails closed when local state is unreadable even if the ledger is granted', async () => {
    const { isCommerceConsented } = await import('./consent');
    mocks.getLatestConsentsWithLease.mockResolvedValueOnce({ data_sharing: true });
    mocks.readCommerceConsentLocal.mockResolvedValueOnce({
      status: 'unavailable',
      reason: 'content_key_storage_unavailable',
    });

    await expect(isCommerceConsented()).rejects.toThrow('PRIVATE_BOOLEAN_UNAVAILABLE');
  });

  it('does not disguise unavailable local commerce consent as a decline', async () => {
    const { isCommerceConsented } = await import('./consent');
    mocks.getLatestConsentsWithLease.mockRejectedValueOnce(new Error('ledger unavailable'));
    mocks.readCommerceConsentLocal.mockResolvedValueOnce({
      status: 'unavailable',
      reason: 'content_key_storage_unavailable',
    });

    await expect(isCommerceConsented()).rejects.toThrow('PRIVATE_BOOLEAN_UNAVAILABLE');
  });

  it('detaches a hung local fallback on A to B and never publishes its late grant', async () => {
    const { isCommerceConsented } = await import('./consent');
    mocks.getLatestConsentsWithLease.mockRejectedValueOnce(new Error('ledger unavailable'));
    let resolveLocal!: (value: { status: 'available'; value: boolean; format: 'current' }) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    mocks.readCommerceConsentLocal.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLocal = resolve;
          markStarted();
        }),
    );

    let published = false;
    const outcome = isCommerceConsented().then(
      (value) => {
        published = true;
        return { status: 'resolved' as const, value };
      },
      (error: unknown) => ({ status: 'rejected' as const, error }),
    );
    await started;
    beginAccountGenerationBoundary();
    boundaryActive = true;
    try {
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
      const rejected = await outcome;
      expect(rejected.status).toBe('rejected');
      expect((rejected as { error: Error }).error.message).toBe(ACCOUNT_GENERATION_CHANGED);
      expect(published).toBe(false);

      resolveLocal({ status: 'available', value: true, format: 'current' });
      await Promise.resolve();
      await Promise.resolve();
      expect(published).toBe(false);
    } finally {
      resolveLocal({ status: 'available', value: true, format: 'current' });
      endAccountGenerationBoundary();
      boundaryActive = false;
    }
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
    expect(mocks.clearCommerceConsentLocal).toHaveBeenCalledOnce();
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
    expect(mocks.clearCommerceConsentLocal).not.toHaveBeenCalled();
    expect(mocks.track).toHaveBeenCalledWith('commerce_consent_declined');
  });
});
