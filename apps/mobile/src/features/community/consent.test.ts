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
  readCommunityConsentLocal: vi.fn(),
  setAgeConfirmedLocal: vi.fn(),
  setCommunityConsentLocal: vi.fn(),
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

let boundaryActive = false;

afterEach(() => {
  if (!boundaryActive) return;
  endAccountGenerationBoundary();
  boundaryActive = false;
});

describe('community consent persistence', () => {
  beforeEach(() => {
    mocks.getLatestConsentsWithLease.mockReset();
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
    mocks.getLatestConsentsWithLease.mockRejectedValueOnce(new Error('ledger unavailable'));
    mocks.readCommunityConsentLocal.mockResolvedValueOnce({
      status: 'available',
      value: false,
      format: 'current',
    });

    await expect(isCommunityConsented()).resolves.toBe(false);
  });

  it('does not disguise a future local community consent schema as a decline', async () => {
    const { isCommunityConsented } = await import('./consent');
    mocks.getLatestConsentsWithLease.mockRejectedValueOnce(new Error('ledger unavailable'));
    mocks.readCommunityConsentLocal.mockResolvedValueOnce({ status: 'unsupported_version' });

    await expect(isCommunityConsented()).rejects.toThrow(
      'PRIVATE_BOOLEAN_UNSUPPORTED_VERSION',
    );
  });

  it('detaches a hung local fallback on A to B without publishing its late grant', async () => {
    const { isCommunityConsented } = await import('./consent');
    mocks.getLatestConsentsWithLease.mockRejectedValueOnce(new Error('ledger unavailable'));
    let resolveLocal!: (value: {
      status: 'available';
      value: boolean;
      format: 'current';
    }) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    mocks.readCommunityConsentLocal.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLocal = resolve;
          markStarted();
        }),
    );

    let published = false;
    const outcome = isCommunityConsented().then(
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
