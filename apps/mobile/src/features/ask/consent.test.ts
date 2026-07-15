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
  clearAskStore: vi.fn(),
  readAskConsentLocal: vi.fn(),
  setAskConsentLocal: vi.fn(),
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
  clearAskStore: mocks.clearAskStore,
  readAskConsentLocal: mocks.readAskConsentLocal,
  setAskConsentLocal: mocks.setAskConsentLocal,
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
  if (boundaryActive) {
    endAccountGenerationBoundary();
    boundaryActive = false;
  }
});

describe('Ask consent persistence', () => {
  beforeEach(() => {
    mocks.getLatestConsentsWithLease.mockReset();
    mocks.recordConsent.mockReset();
    mocks.track.mockReset();
    mocks.withdrawConsent.mockReset();
    mocks.clearAskStore.mockReset();
    mocks.readAskConsentLocal.mockReset();
    mocks.setAskConsentLocal.mockReset();
    mocks.recordConsent.mockResolvedValue(undefined);
    mocks.withdrawConsent.mockResolvedValue(undefined);
    mocks.clearAskStore.mockResolvedValue(undefined);
    mocks.readAskConsentLocal.mockResolvedValue({ status: 'absent' });
    mocks.setAskConsentLocal.mockResolvedValue(undefined);
  });

  it('uses a definitive consent ledger decision without consulting local storage', async () => {
    const { isAskConsented } = await import('./consent');
    mocks.getLatestConsentsWithLease.mockResolvedValueOnce({ ask_onskin: true });

    await expect(isAskConsented()).resolves.toBe(true);

    expect(mocks.readAskConsentLocal).not.toHaveBeenCalled();
  });

  it('uses a valid local consent value when the ledger is unavailable', async () => {
    const { isAskConsented } = await import('./consent');
    mocks.getLatestConsentsWithLease.mockRejectedValueOnce(new Error('ledger unavailable'));
    mocks.readAskConsentLocal.mockResolvedValueOnce({
      status: 'available',
      value: true,
      format: 'legacy',
    });

    await expect(isAskConsented()).resolves.toBe(true);
  });

  it('does not disguise unavailable local consent storage as a decline', async () => {
    const { isAskConsented } = await import('./consent');
    mocks.getLatestConsentsWithLease.mockRejectedValueOnce(new Error('ledger unavailable'));
    mocks.readAskConsentLocal.mockResolvedValueOnce({
      status: 'unavailable',
      reason: 'storage_unavailable',
    });

    await expect(isAskConsented()).rejects.toThrow('PRIVATE_BOOLEAN_UNAVAILABLE');
  });

  it('detaches a hung local fallback on account change without converting cancellation to false', async () => {
    const { isAskConsented } = await import('./consent');
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
    mocks.readAskConsentLocal.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLocal = resolve;
          markStarted();
        }),
    );

    const outcome = isAskConsented();
    await started;
    beginAccountGenerationBoundary();
    boundaryActive = true;
    try {
      await expect(outcome).rejects.toMatchObject({ code: ACCOUNT_GENERATION_CHANGED });
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
      resolveLocal({ status: 'available', value: true, format: 'current' });
      await Promise.resolve();
      await Promise.resolve();
      await expect(outcome).rejects.toMatchObject({ code: ACCOUNT_GENERATION_CHANGED });
    } finally {
      resolveLocal({ status: 'available', value: true, format: 'current' });
      endAccountGenerationBoundary();
      boundaryActive = false;
    }
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

  it('fails closed and relocks Ask consent when the consent ledger fails', async () => {
    const { grantAskConsent } = await import('./consent');
    mocks.recordConsent.mockRejectedValueOnce(new Error('ledger unavailable'));

    await expect(grantAskConsent()).rejects.toThrow('ledger unavailable');

    expect(mocks.setAskConsentLocal).toHaveBeenNthCalledWith(1, true);
    expect(mocks.setAskConsentLocal).toHaveBeenNthCalledWith(2, false);
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

  it('does not let a delayed owner-A grant roll back or publish after owner B starts', async () => {
    const { grantAskConsent } = await import('./consent');
    let releaseLedger!: () => void;
    mocks.recordConsent.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseLedger = resolve;
        }),
    );

    const grant = grantAskConsent();
    await vi.waitFor(() => expect(mocks.recordConsent).toHaveBeenCalledOnce());
    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseLedger();

    await expect(grant).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(mocks.setAskConsentLocal).toHaveBeenCalledTimes(1);
    expect(mocks.setAskConsentLocal).toHaveBeenCalledWith(true);
    expect(mocks.track).not.toHaveBeenCalledWith('ask_consent_granted');
  });

  it('does not publish delayed owner-A revocation analytics after owner B starts', async () => {
    const { revokeAskConsent } = await import('./consent');
    let releaseWithdrawal!: () => void;
    mocks.withdrawConsent.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseWithdrawal = resolve;
        }),
    );

    const revoke = revokeAskConsent();
    await vi.waitFor(() => expect(mocks.withdrawConsent).toHaveBeenCalledOnce());
    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseWithdrawal();

    await expect(revoke).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(mocks.clearAskStore).toHaveBeenCalledOnce();
    expect(mocks.track).not.toHaveBeenCalledWith('ask_consent_revoked');
  });
});
