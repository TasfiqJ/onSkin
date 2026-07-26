import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isSupabaseConfigured: false,
  abortSignal: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  limit: vi.fn(),
  maybeSingle: vi.fn(),
  order: vi.fn(),
  recordConsent: vi.fn(),
  select: vi.fn(),
  serverSignal: null as AbortSignal | null,
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
  recordConsent: mocks.recordConsent,
}));

const serverQuery = {
  abortSignal: mocks.abortSignal,
  eq: mocks.eq,
  limit: mocks.limit,
  maybeSingle: mocks.maybeSingle,
  order: mocks.order,
  select: mocks.select,
};

vi.mock('@/lib/supabase/client', () => ({
  supabase: { from: mocks.from },
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
    mocks.abortSignal.mockReset();
    mocks.eq.mockReset();
    mocks.from.mockReset();
    mocks.limit.mockReset();
    mocks.maybeSingle.mockReset();
    mocks.order.mockReset();
    mocks.recordConsent.mockReset();
    mocks.select.mockReset();
    mocks.serverSignal = null;
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
    mocks.from.mockReturnValue(serverQuery);
    mocks.select.mockReturnValue(serverQuery);
    mocks.eq.mockReturnValue(serverQuery);
    mocks.order.mockReturnValue(serverQuery);
    mocks.limit.mockReturnValue(serverQuery);
    mocks.abortSignal.mockImplementation((signal: AbortSignal) => {
      mocks.serverSignal = signal;
      return serverQuery;
    });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it('does not silently enroll installed-base photo users without trend consent', async () => {
    mocks.isSupabaseConfigured = true;
    const { isTrendInsightsConsented } = await import('./consent');
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
    mocks.maybeSingle.mockResolvedValueOnce({
      data: { granted: true },
      error: null,
    });

    await expect(isTrendInsightsConsented()).resolves.toBe(true);

    expect(mocks.readTrendInsightsLocal).not.toHaveBeenCalled();
    expect(mocks.eq).toHaveBeenCalledWith('consent_type', 'photo_trend_insights');
    expect(mocks.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('keeps local-first trend consent available when the backend is not configured', async () => {
    const { isTrendInsightsConsented } = await import('./consent');
    mocks.readTrendInsightsLocal.mockResolvedValueOnce({
      status: 'available',
      value: true,
      format: 'legacy',
    });

    await expect(isTrendInsightsConsented()).resolves.toBe(true);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('keeps the encrypted local consent fallback for an ordinary offline ledger failure', async () => {
    mocks.isSupabaseConfigured = true;
    const { isTrendInsightsConsented } = await import('./consent');
    mocks.maybeSingle.mockRejectedValueOnce(new Error('network unavailable'));
    mocks.readTrendInsightsLocal.mockResolvedValueOnce({
      status: 'available',
      value: true,
      format: 'current',
    });

    await expect(isTrendInsightsConsented()).resolves.toBe(true);

    expect(mocks.readTrendInsightsLocal).toHaveBeenCalledTimes(1);
  });

  it('does not disguise corrupt local trend consent as an ordinary decline', async () => {
    mocks.isSupabaseConfigured = true;
    const { isTrendInsightsConsented } = await import('./consent');
    mocks.maybeSingle.mockRejectedValueOnce(new Error('ledger unavailable'));
    mocks.readTrendInsightsLocal.mockResolvedValueOnce({
      status: 'corrupt',
      reason: 'invalid_value',
    });

    await expect(isTrendInsightsConsented()).rejects.toThrow('PRIVATE_BOOLEAN_INVALID');
  });

  it('detaches a hung consent-ledger read on account change without publishing its late row', async () => {
    mocks.isSupabaseConfigured = true;
    const account = await import('@/lib/auth/accountGeneration');
    const { isTrendInsightsConsented } = await import('./consent');
    let resolveLedger!: (value: { data: { granted: boolean }; error: null }) => void;
    let markLedgerStarted!: () => void;
    const ledgerStarted = new Promise<void>((resolve) => {
      markLedgerStarted = resolve;
    });
    mocks.maybeSingle.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLedger = resolve;
          markLedgerStarted();
        }),
    );

    let published = false;
    const outcome = isTrendInsightsConsented().then(
      (value) => {
        published = true;
        return { status: 'resolved' as const, value };
      },
      (error: unknown) => ({ status: 'rejected' as const, error }),
    );
    await ledgerStarted;
    account.beginAccountGenerationBoundary();
    try {
      await expect(account.waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
      const rejected = await outcome;
      expect(rejected.status).toBe('rejected');
      expect((rejected as { error: Error }).error.message).toBe(account.ACCOUNT_GENERATION_CHANGED);
      expect(mocks.serverSignal?.aborted).toBe(true);
      expect(published).toBe(false);

      resolveLedger({ data: { granted: true }, error: null });
      await Promise.resolve();
      await Promise.resolve();
      expect(published).toBe(false);
      expect(mocks.readTrendInsightsLocal).not.toHaveBeenCalled();
    } finally {
      resolveLedger({ data: { granted: true }, error: null });
      account.endAccountGenerationBoundary();
    }
  });

  it('detaches a hung encrypted local fallback on account change', async () => {
    const account = await import('@/lib/auth/accountGeneration');
    const { isTrendInsightsConsented } = await import('./consent');
    let resolveLocal!: (value: { status: 'available'; value: boolean; format: 'current' }) => void;
    let markLocalStarted!: () => void;
    const localStarted = new Promise<void>((resolve) => {
      markLocalStarted = resolve;
    });
    mocks.readTrendInsightsLocal.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLocal = resolve;
          markLocalStarted();
        }),
    );

    const outcome = isTrendInsightsConsented().then(
      (value) => ({ status: 'resolved' as const, value }),
      (error: unknown) => ({ status: 'rejected' as const, error }),
    );
    await localStarted;
    account.beginAccountGenerationBoundary();
    try {
      await expect(account.waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
      const rejected = await outcome;
      expect(rejected.status).toBe('rejected');
      expect((rejected as { error: Error }).error.message).toBe(account.ACCOUNT_GENERATION_CHANGED);

      resolveLocal({ status: 'available', value: true, format: 'current' });
      await Promise.resolve();
      await Promise.resolve();
      expect(rejected.status).toBe('rejected');
    } finally {
      resolveLocal({ status: 'available', value: true, format: 'current' });
      account.endAccountGenerationBoundary();
    }
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

  it('detaches a delayed trend withdrawal when the account owner changes', async () => {
    const account = await import('@/lib/auth/accountGeneration');
    const { revokeTrendInsightsConsent } = await import('./consent');
    let releaseWithdrawal!: () => void;
    mocks.withdrawConsent.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseWithdrawal = resolve;
        }),
    );

    const revoke = revokeTrendInsightsConsent();
    await vi.waitFor(() => expect(mocks.withdrawConsent).toHaveBeenCalledOnce());
    account.beginAccountGenerationBoundary();
    try {
      await expect(account.waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
      await expect(revoke).rejects.toMatchObject({
        code: account.ACCOUNT_GENERATION_CHANGED,
      });
      expect(mocks.setTrendInsightsLocal).toHaveBeenCalledWith(false);
      expect(mocks.deleteTrendState).toHaveBeenCalledOnce();
      expect(mocks.track).not.toHaveBeenCalledWith('trend_consent_revoked');

      releaseWithdrawal();
      await Promise.resolve();
      await Promise.resolve();
      expect(mocks.track).not.toHaveBeenCalledWith('trend_consent_revoked');
    } finally {
      releaseWithdrawal();
      account.endAccountGenerationBoundary();
    }
  });
});
