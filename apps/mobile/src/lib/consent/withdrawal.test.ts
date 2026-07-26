import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';

import { CONSENT_WITHDRAWAL_RESPONSE_INVALID, withdrawConsent } from './withdrawal';

const validCleanupByConsentType = {
  photo_cloud_backup: {
    photo_rows_relocalized: 2,
    storage_objects_removed: 1,
    skipped_storage_paths: 1,
  },
  photo_trend_insights: { photo_trend_deleted: 3 },
  ask_onskin: { ask_safety_audit_deleted: 4 },
  community_participation: {
    community_reports_deleted: 1,
    community_reactions_deleted: 2,
    community_questions_deleted: 3,
    community_blocks_deleted: 4,
  },
  data_sharing: {
    order_attributions_detached: 5,
    commerce_click_events_deleted: 6,
  },
  marketing: { marketing_withdrawal_recorded: true },
} as const;

type WithdrawableConsentType = keyof typeof validCleanupByConsentType;

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
    mocks.invoke.mockResolvedValue({
      data: {
        withdrawn: true,
        consent_type: 'marketing',
        cleanup: { marketing_withdrawal_recorded: true },
      },
      error: null,
    });
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

  it.each([
    ['null response', null],
    [
      'false withdrawn flag',
      {
        withdrawn: false,
        consent_type: 'marketing',
        cleanup: { marketing_withdrawal_recorded: true },
      },
    ],
    [
      'wrong consent type',
      {
        withdrawn: true,
        consent_type: 'data_sharing',
        cleanup: { marketing_withdrawal_recorded: true },
      },
    ],
    ['missing cleanup', { withdrawn: true, consent_type: 'marketing' }],
    [
      'array cleanup',
      { withdrawn: true, consent_type: 'marketing', cleanup: ['not', 'an', 'object'] },
    ],
    [
      'extra top-level field',
      {
        withdrawn: true,
        consent_type: 'marketing',
        cleanup: { marketing_withdrawal_recorded: true },
        ok: true,
      },
    ],
  ])('rejects a %s with one stable acknowledgement error', async (_label, data) => {
    state.isSupabaseConfigured = true;
    mocks.invoke.mockResolvedValueOnce({ data, error: null });

    await expect(
      withdrawConsent({
        type: 'marketing',
        version: 'test',
        consentText: 'copy',
      }),
    ).rejects.toThrow(CONSENT_WITHDRAWAL_RESPONSE_INVALID);
  });

  it.each(Object.entries(validCleanupByConsentType))(
    'accepts the exact %s cleanup acknowledgement',
    async (type, cleanup) => {
      state.isSupabaseConfigured = true;
      mocks.invoke.mockResolvedValueOnce({
        data: { withdrawn: true, consent_type: type, cleanup },
        error: null,
      });

      await expect(
        withdrawConsent({
          type: type as WithdrawableConsentType,
          version: 'test',
          consentText: 'copy',
        }),
      ).resolves.toBeUndefined();
    },
  );

  it.each(Object.keys(validCleanupByConsentType))(
    'rejects an empty %s cleanup acknowledgement',
    async (type) => {
      state.isSupabaseConfigured = true;
      mocks.invoke.mockResolvedValueOnce({
        data: { withdrawn: true, consent_type: type, cleanup: {} },
        error: null,
      });

      await expect(
        withdrawConsent({
          type: type as WithdrawableConsentType,
          version: 'test',
          consentText: 'copy',
        }),
      ).rejects.toThrow(CONSENT_WITHDRAWAL_RESPONSE_INVALID);
    },
  );

  it.each(Object.entries(validCleanupByConsentType))(
    'rejects an extra %s cleanup acknowledgement field',
    async (type, cleanup) => {
      state.isSupabaseConfigured = true;
      mocks.invoke.mockResolvedValueOnce({
        data: {
          withdrawn: true,
          consent_type: type,
          cleanup: { ...cleanup, unexpected: 0 },
        },
        error: null,
      });

      await expect(
        withdrawConsent({
          type: type as WithdrawableConsentType,
          version: 'test',
          consentText: 'copy',
        }),
      ).rejects.toThrow(CONSENT_WITHDRAWAL_RESPONSE_INVALID);
    },
  );

  it.each(
    Object.entries(validCleanupByConsentType)
      .filter(([type]) => type !== 'marketing')
      .flatMap(([type, cleanup]) => {
        const [countKey] = Object.keys(cleanup);
        return [
          [`${type} string`, type, { ...cleanup, [countKey]: '1' }],
          [`${type} negative`, type, { ...cleanup, [countKey]: -1 }],
          [`${type} noninteger`, type, { ...cleanup, [countKey]: 1.5 }],
        ] as const;
      }),
  )('rejects a %s count field', async (_label, type, cleanup) => {
    state.isSupabaseConfigured = true;
    mocks.invoke.mockResolvedValueOnce({
      data: { withdrawn: true, consent_type: type, cleanup },
      error: null,
    });

    await expect(
      withdrawConsent({
        type: type as WithdrawableConsentType,
        version: 'test',
        consentText: 'copy',
      }),
    ).rejects.toThrow(CONSENT_WITHDRAWAL_RESPONSE_INVALID);
  });

  it('rejects a false marketing acknowledgement invariant', async () => {
    state.isSupabaseConfigured = true;
    mocks.invoke.mockResolvedValueOnce({
      data: {
        withdrawn: true,
        consent_type: 'marketing',
        cleanup: { marketing_withdrawal_recorded: false },
      },
      error: null,
    });

    await expect(
      withdrawConsent({
        type: 'marketing',
        version: 'test',
        consentText: 'copy',
      }),
    ).rejects.toThrow(CONSENT_WITHDRAWAL_RESPONSE_INVALID);
  });

  it('rejects a delayed owner-A withdrawal response after owner B starts', async () => {
    state.isSupabaseConfigured = true;
    let releaseInvoke!: () => void;
    mocks.invoke.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseInvoke = () =>
            resolve({
              data: {
                withdrawn: true,
                consent_type: 'marketing',
                cleanup: { marketing_withdrawal_recorded: true },
              },
              error: null,
            });
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
