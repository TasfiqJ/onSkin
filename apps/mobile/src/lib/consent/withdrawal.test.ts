import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';

import { withdrawConsent } from './withdrawal';

const mocks = vi.hoisted(() => ({
  digest: vi.fn(async () => 'hash'),
  getSession: vi.fn(),
  getUser: vi.fn(),
  invoke: vi.fn(),
}));

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

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { getSession: mocks.getSession, getUser: mocks.getUser },
    functions: { invoke: mocks.invoke },
  },
}));

let boundaryActive = false;

afterEach(() => {
  if (boundaryActive) {
    endAccountGenerationBoundary();
    boundaryActive = false;
  }
});

describe('consent withdrawal backend guard', () => {
  beforeEach(() => {
    state.isSupabaseConfigured = false;
    mocks.digest.mockClear();
    mocks.getSession.mockReset();
    mocks.getUser.mockReset();
    mocks.invoke.mockClear();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'owner-a' } },
      error: null,
    });
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-a', user: { id: 'owner-a' } } },
      error: null,
    });
    mocks.invoke.mockResolvedValue({ data: { ok: true }, error: null });
  });

  it('fails before hashing or invoking placeholder Supabase when unconfigured', async () => {
    await expect(
      withdrawConsent({
        type: 'marketing',
        version: 'test',
        consentText: 'copy',
      }),
    ).rejects.toThrow('CONSENT_BACKEND_UNAVAILABLE');

    expect(mocks.digest).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('pins the initiating owner-A token on the withdrawal request', async () => {
    state.isSupabaseConfigured = true;

    await withdrawConsent({
      type: 'marketing',
      version: 'test',
      consentText: 'copy',
    });

    expect(mocks.invoke).toHaveBeenCalledWith(
      'consent-withdrawal',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token-a' },
        signal: expect.any(AbortSignal),
        body: {
          consentType: 'marketing',
          version: 'test',
          consentTextHash: 'hash',
        },
      }),
    );
  });

  it('rejects a delayed owner-A withdrawal response after owner B starts', async () => {
    state.isSupabaseConfigured = true;
    let releaseInvoke!: () => void;
    mocks.invoke.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseInvoke = () => resolve({ data: { ok: true }, error: null });
        }),
    );

    const withdrawal = withdrawConsent({
      type: 'marketing',
      version: 'test',
      consentText: 'copy',
    });
    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledOnce());
    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseInvoke();

    await expect(withdrawal).rejects.toMatchObject({ kind: 'owner_changed' });
  });
});
