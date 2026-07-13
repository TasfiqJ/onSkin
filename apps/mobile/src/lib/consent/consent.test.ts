import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getLatestConsents, recordConsent } from './consent';

const mocks = vi.hoisted(() => {
  const insertAbortSignal = vi.fn(async () => ({ error: null }));
  const latestAbortSignal = vi.fn(async () => ({
    data: [{ consent_type: 'marketing', granted: true, granted_at: '2026-07-13' }],
    error: null,
  }));
  const order = vi.fn(() => ({ abortSignal: latestAbortSignal }));
  const select = vi.fn(() => ({ order }));
  const insert = vi.fn(() => ({ abortSignal: insertAbortSignal }));
  return {
    digest: vi.fn(async () => 'hash'),
    from: vi.fn(() => ({ insert, select })),
    getUser: vi.fn(async () => ({ data: { user: { id: 'owner-a' } }, error: null })),
    insert,
    insertAbortSignal,
    latestAbortSignal,
    order,
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
  beforeEach(() => {
    state.isSupabaseConfigured = false;
    mocks.digest.mockClear();
    mocks.from.mockClear();
    mocks.getUser.mockClear();
    mocks.insert.mockClear();
    mocks.insertAbortSignal.mockClear();
    mocks.latestAbortSignal.mockClear();
    mocks.order.mockClear();
    mocks.select.mockClear();
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
  });
});
