import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  AccountGenerationLeaseError,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  runAccountGenerationOperation,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';

import { getLatestConsents, hasLatestExactConsentGrantWithLease, recordConsent } from './consent';

type ExactConsentTestRow = {
  consent_type: string;
  granted: boolean;
  version: string;
  consent_text_hash: string;
  granted_at: string;
};

const mocks = vi.hoisted(() => {
  const insertAbortSignal = vi.fn(async () => ({ error: null }));
  const latestAbortSignal = vi.fn(async (_signal: AbortSignal) => ({
    data: [{ consent_type: 'marketing', granted: true, granted_at: '2026-07-13' }],
    error: null,
  }));
  const latestBuilder: {
    abortSignal: typeof latestAbortSignal;
    order: ReturnType<typeof vi.fn>;
  } = {
    abortSignal: latestAbortSignal,
    order: vi.fn(),
  };
  latestBuilder.order.mockReturnValue(latestBuilder);
  const exactAbortSignal = vi.fn();
  const exactMaybeSingle = vi.fn(async () => ({
    data: null as ExactConsentTestRow | null,
    error: null,
  }));
  const exactBuilder: {
    abortSignal: typeof exactAbortSignal;
    eq: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    maybeSingle: typeof exactMaybeSingle;
    order: ReturnType<typeof vi.fn>;
  } = {
    abortSignal: exactAbortSignal,
    eq: vi.fn(),
    limit: vi.fn(),
    maybeSingle: exactMaybeSingle,
    order: vi.fn(),
  };
  exactBuilder.abortSignal.mockReturnValue(exactBuilder);
  exactBuilder.eq.mockReturnValue(exactBuilder);
  exactBuilder.limit.mockReturnValue(exactBuilder);
  exactBuilder.order.mockReturnValue(exactBuilder);
  const select = vi.fn((columns: string) =>
    columns.includes('consent_text_hash') ? exactBuilder : latestBuilder,
  );
  const insert = vi.fn(() => ({ abortSignal: insertAbortSignal }));
  return {
    digest: vi.fn(async () => 'hash'),
    exactAbortSignal,
    exactEq: exactBuilder.eq,
    exactLimit: exactBuilder.limit,
    exactMaybeSingle,
    exactOrder: exactBuilder.order,
    from: vi.fn(() => ({ insert, select })),
    getUser: vi.fn(async () => ({ data: { user: { id: 'owner-a' } }, error: null })),
    insert,
    insertAbortSignal,
    latestAbortSignal,
    order: latestBuilder.order,
    select,
  };
});

const state = vi.hoisted(() => ({ isSupabaseConfigured: false }));

vi.mock('@/lib/env', () => ({
  get isSupabaseConfigured() {
    return state.isSupabaseConfigured;
  },
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digest,
}));

vi.mock('../supabase/client', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  },
}));

describe('consent backend guards', () => {
  let boundaryActive = false;

  beforeEach(() => {
    state.isSupabaseConfigured = false;
    mocks.digest.mockClear();
    mocks.exactAbortSignal.mockClear();
    mocks.exactEq.mockClear();
    mocks.exactLimit.mockClear();
    mocks.exactMaybeSingle.mockClear();
    mocks.exactOrder.mockClear();
    mocks.exactMaybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.from.mockClear();
    mocks.getUser.mockClear();
    mocks.insert.mockClear();
    mocks.insertAbortSignal.mockClear();
    mocks.latestAbortSignal.mockClear();
    mocks.order.mockClear();
    mocks.select.mockClear();
  });

  afterEach(() => {
    if (!boundaryActive) return;
    endAccountGenerationBoundary();
    boundaryActive = false;
  });

  it('returns an empty consent ledger without touching placeholder Supabase', async () => {
    await expect(getLatestConsents()).resolves.toEqual({});

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it('fails consent recording before hashing or network when Supabase is unconfigured', async () => {
    await expect(
      recordConsent({
        type: 'marketing',
        granted: true,
        version: 'test',
        consentText: 'copy',
      }),
    ).rejects.toThrow('CONSENT_BACKEND_UNAVAILABLE');

    expect(mocks.digest).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it('passes the generation abort signal to consent writes and reads', async () => {
    state.isSupabaseConfigured = true;

    await recordConsent({
      type: 'marketing',
      granted: true,
      version: 'test',
      consentText: 'copy',
    });
    await expect(getLatestConsents()).resolves.toEqual({ marketing: true });

    expect(mocks.insertAbortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(mocks.latestAbortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(mocks.order).toHaveBeenNthCalledWith(1, 'granted_at', { ascending: false });
    expect(mocks.order).toHaveBeenNthCalledWith(2, 'granted', { ascending: true });
  });

  it('requires the latest ledger row to match the exact granted copy', async () => {
    state.isSupabaseConfigured = true;
    mocks.exactMaybeSingle.mockResolvedValueOnce({
      data: {
        consent_type: 'health_data_collection',
        granted: true,
        version: 'current-v1',
        consent_text_hash: 'hash',
        granted_at: '2026-07-26T12:00:00.000Z',
      },
      error: null,
    });

    await expect(
      runAccountGenerationOperation((lease) =>
        hasLatestExactConsentGrantWithLease(lease, {
          type: 'health_data_collection',
          version: 'current-v1',
          consentText: 'exact copy',
        }),
      ),
    ).resolves.toBe(true);
    expect(mocks.digest).toHaveBeenCalledWith('SHA-256', 'exact copy');
    expect(mocks.exactEq).toHaveBeenCalledWith('consent_type', 'health_data_collection');
    expect(mocks.exactOrder).toHaveBeenNthCalledWith(1, 'granted_at', {
      ascending: false,
    });
    expect(mocks.exactOrder).toHaveBeenNthCalledWith(2, 'granted', {
      ascending: true,
    });
    expect(mocks.exactLimit).toHaveBeenCalledWith(1);
    expect(mocks.exactAbortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it.each([
    {
      label: 'missing',
      row: null,
    },
    {
      label: 'revoked',
      row: {
        consent_type: 'health_data_collection',
        granted: false,
        version: 'current-v1',
        consent_text_hash: 'hash',
        granted_at: '2026-07-26T12:00:00.000Z',
      },
    },
    {
      label: 'stale version',
      row: {
        consent_type: 'health_data_collection',
        granted: true,
        version: 'stale-v0',
        consent_text_hash: 'hash',
        granted_at: '2026-07-26T12:00:00.000Z',
      },
    },
    {
      label: 'wrong hash',
      row: {
        consent_type: 'health_data_collection',
        granted: true,
        version: 'current-v1',
        consent_text_hash: 'other-hash',
        granted_at: '2026-07-26T12:00:00.000Z',
      },
    },
    {
      label: 'equal-time revocation',
      row: {
        consent_type: 'health_data_collection',
        granted: false,
        version: 'current-v1',
        consent_text_hash: 'hash',
        granted_at: '2026-07-26T12:00:00.000Z',
      },
    },
  ])('rejects a $label authoritative proof', async ({ row }) => {
    state.isSupabaseConfigured = true;
    mocks.exactMaybeSingle.mockResolvedValueOnce({ data: row, error: null });

    await expect(
      runAccountGenerationOperation((lease) =>
        hasLatestExactConsentGrantWithLease(lease, {
          type: 'health_data_collection',
          version: 'current-v1',
          consentText: 'exact copy',
        }),
      ),
    ).resolves.toBe(false);
  });

  it('fails exact publication proof closed without a configured backend', async () => {
    await expect(
      runAccountGenerationOperation((lease) =>
        hasLatestExactConsentGrantWithLease(lease, {
          type: 'health_data_collection',
          version: 'current-v1',
          consentText: 'exact copy',
        }),
      ),
    ).resolves.toBe(false);
    expect(mocks.digest).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('detaches a hung ledger transport so an account boundary drains and late rows stay unpublished', async () => {
    state.isSupabaseConfigured = true;
    let resolveLedger!: (value: {
      data: { consent_type: string; granted: boolean; granted_at: string }[];
      error: null;
    }) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    let serverSignal: AbortSignal | null = null;
    mocks.latestAbortSignal.mockImplementationOnce(
      (signal: AbortSignal) =>
        new Promise((resolve) => {
          serverSignal = signal;
          resolveLedger = resolve;
          markStarted();
        }),
    );

    let published = false;
    const outcome = getLatestConsents().then(
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
      expect((serverSignal as AbortSignal | null)?.aborted).toBe(true);
      expect(published).toBe(false);

      resolveLedger({
        data: [{ consent_type: 'marketing', granted: true, granted_at: '2026-07-14' }],
        error: null,
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(published).toBe(false);
    } finally {
      resolveLedger({ data: [], error: null });
      endAccountGenerationBoundary();
      boundaryActive = false;
    }
  });

  it('detaches a stalled consent hash when the owner generation changes', async () => {
    state.isSupabaseConfigured = true;
    let releaseDigest!: () => void;
    mocks.digest.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          releaseDigest = () => resolve('owner-a-hash');
        }),
    );

    const record = recordConsent({
      type: 'marketing',
      granted: true,
      version: 'test',
      consentText: 'copy',
    });
    await vi.waitFor(() => expect(mocks.digest).toHaveBeenCalledOnce());

    beginAccountGenerationBoundary();
    boundaryActive = true;

    await expect(record).rejects.toBeInstanceOf(AccountGenerationLeaseError);
    expect(mocks.insert).not.toHaveBeenCalled();

    releaseDigest();
    await Promise.resolve();
  });
});
