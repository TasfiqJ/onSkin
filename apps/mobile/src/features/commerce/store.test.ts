import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildClickToken, recordClick } from './store';

const mocks = vi.hoisted(() => ({
  leaseOpen: true,
  getUser: vi.fn(),
  insert: vi.fn(),
  abortSignal: vi.fn(),
  from: vi.fn(),
}));
vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => '00000000-0000-4000-8000-000000000000'),
}));
vi.mock('@/lib/consent/dependentConsentLease', () => ({
  runHealthDependentConsentOperation: async (
    type: string,
    operation: (lease: {
      ownerUserId: string;
      signal: AbortSignal;
      assertCurrent: () => void;
    }) => Promise<unknown>,
  ) => {
    if (type !== 'data_sharing' || !mocks.leaseOpen) {
      throw new Error('HEALTH_DEPENDENT_CONSENT_CLOSED');
    }
    const controller = new AbortController();
    const assertCurrent = () => {
      if (!mocks.leaseOpen) throw new Error('HEALTH_DEPENDENT_CONSENT_STALE');
    };
    const result = await operation({
      ownerUserId: 'user-a',
      signal: controller.signal,
      assertCurrent,
    });
    assertCurrent();
    return result;
  },
}));
vi.mock('@/lib/supabase/client', () => ({
  getPersistedSupabaseUser: mocks.getUser,
  supabase: { from: mocks.from },
}));
vi.mock('@/lib/storage/privateBoolean', () => ({
  getPrivateBoolean: vi.fn(),
  setPrivateBoolean: vi.fn(),
}));
vi.mock('@/lib/storage/privateKV', () => ({ removePrivateItem: vi.fn() }));

describe('commerce click disclosure fence', () => {
  beforeEach(() => {
    mocks.leaseOpen = true;
    mocks.getUser.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-a' } } });
    mocks.abortSignal.mockReset();
    mocks.abortSignal.mockResolvedValue({ error: null });
    mocks.insert.mockReset();
    mocks.insert.mockReturnValue({ abortSignal: mocks.abortSignal });
    mocks.from.mockReset();
    mocks.from.mockReturnValue({ insert: mocks.insert });
  });

  it('builds a content-free opaque token', () => {
    expect(buildClickToken()).toBe('00000000000040008000000000000000');
  });

  it('checks insert result under one exact data-sharing lease', async () => {
    await recordClick({
      clickToken: 'opaque_123',
      productType: 'mineral_spf',
      source: 'none',
      consented: true,
    });
    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: 'user-a',
      click_token: 'opaque_123',
      product_type: 'mineral_spf',
      source: 'none',
      consented: true,
    });
    expect(mocks.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('refuses a server insert error and never reports success', async () => {
    mocks.abortSignal.mockResolvedValueOnce({ error: new Error('RLS refused generation') });
    await expect(
      recordClick({
        clickToken: 'opaque_123',
        productType: null,
        source: 'direct',
        consented: true,
      }),
    ).rejects.toThrow('RLS refused generation');
  });

  it('rejects a delayed response after revocation', async () => {
    mocks.abortSignal.mockImplementationOnce(async () => {
      mocks.leaseOpen = false;
      return { error: null };
    });
    await expect(
      recordClick({
        clickToken: 'opaque_123',
        productType: null,
        source: 'direct',
        consented: true,
      }),
    ).rejects.toThrow('HEALTH_DEPENDENT_CONSENT_STALE');
  });

  it('fails closed on malformed health-adjacent payload', async () => {
    await expect(
      recordClick({
        clickToken: 'opaque_123',
        productType: 'skinConcern=acne',
        source: 'direct',
        consented: true,
      }),
    ).rejects.toThrow('COMMERCE_CLICK_PAYLOAD_INVALID');
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
