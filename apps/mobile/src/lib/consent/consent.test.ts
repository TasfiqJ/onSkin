import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getLatestConsents, recordConsent } from './consent';

const mocks = vi.hoisted(() => ({
  configured: false,
  digest: vi.fn(async () => 'hash'),
  from: vi.fn(),
  getPersistedUser: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(async () => ({ error: null })),
}));

vi.mock('@/lib/env', () => ({
  get isSupabaseConfigured() {
    return mocks.configured;
  },
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digest,
}));

vi.mock('../supabase/client', () => ({
  getPersistedSupabaseUser: mocks.getPersistedUser,
  supabase: {
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  },
}));

describe('consent backend guards', () => {
  beforeEach(() => {
    mocks.configured = false;
    mocks.digest.mockClear();
    mocks.from.mockClear();
    mocks.getPersistedUser.mockReset();
    mocks.getUser.mockClear();
    mocks.insert.mockClear();
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.getPersistedUser.mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null });
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

  it('rejects a destructive-workflow consent write after its initiating owner changes', async () => {
    mocks.configured = true;
    mocks.getPersistedUser.mockResolvedValueOnce({
      data: { user: { id: 'user-b' } },
      error: null,
    });

    await expect(
      recordConsent({
        type: 'health_data_collection',
        granted: false,
        version: 'withdraw-v1',
        consentText: 'withdraw',
        expectedUserId: 'user-a',
      }),
    ).rejects.toThrow('CONSENT_OWNER_CHANGED');

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
