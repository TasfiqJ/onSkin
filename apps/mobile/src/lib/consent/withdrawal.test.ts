import { beforeEach, describe, expect, it, vi } from 'vitest';

import { withdrawConsent } from './withdrawal';

const mocks = vi.hoisted(() => ({
  digest: vi.fn(async () => 'hash'),
  invoke: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  isSupabaseConfigured: false,
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.digest,
}));

vi.mock('../supabase/client', () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
  },
}));

describe('consent withdrawal backend guard', () => {
  beforeEach(() => {
    mocks.digest.mockClear();
    mocks.invoke.mockClear();
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
});
