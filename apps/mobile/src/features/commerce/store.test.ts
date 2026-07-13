import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope } from '@/lib/query/queryKeys';

import {
  clearCommerceState,
  readCommerceConsentLocal,
  recordClick,
  runCommerceClickOperation,
  setCommerceConsentLocal,
} from './store';

const mocks = vi.hoisted(() => ({
  abortSignal: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
  storage: new Map<string, string>(),
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => '00000000-0000-4000-8000-000000000000'),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  },
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  readPrivateItem: vi.fn(async (key: string) => {
    const value = mocks.storage.get(key);
    return value === undefined ? { status: 'absent' } : { status: 'available', value };
  }),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
  }),
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      const next = updater(mocks.storage.get(key) ?? null);
      if (next === null) mocks.storage.delete(key);
      else mocks.storage.set(key, next);
    },
  ),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
}));

const CONSENT_KEY = 'onskin.commerceConsent.v1';
const CLICK = {
  clickToken: 'opaque-click-token',
  productType: 'cleanser',
  source: 'none' as const,
  consented: true,
};
let boundaryActive = false;

afterEach(() => {
  if (boundaryActive) {
    endAccountGenerationBoundary();
    boundaryActive = false;
  }
});

describe('commerce consent store', () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.from.mockReset();
    mocks.getUser.mockReset();
    mocks.insert.mockReset();
    mocks.abortSignal.mockReset();
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'owner-a' } },
      error: null,
    });
    mocks.abortSignal.mockResolvedValue({ error: null });
    mocks.insert.mockReturnValue({ abortSignal: mocks.abortSignal });
  });

  it('reads legacy commerce consent grants without repair and writes versioned flags', async () => {
    mocks.storage.set(CONSENT_KEY, ' true ');

    await expect(readCommerceConsentLocal()).resolves.toEqual({
      status: 'available',
      value: true,
      format: 'legacy',
    });
    expect(mocks.storage.get(CONSENT_KEY)).toBe(' true ');

    await setCommerceConsentLocal(false);
    expect(mocks.storage.get(CONSENT_KEY)).toBe('v1:0');
  });

  it('classifies and preserves malformed commerce consent values', async () => {
    mocks.storage.set(CONSENT_KEY, 'allowed');

    await expect(readCommerceConsentLocal()).resolves.toEqual({
      status: 'corrupt',
      reason: 'invalid_value',
    });

    expect(mocks.storage.get(CONSENT_KEY)).toBe('allowed');
  });

  it('clears the local commerce consent gate', async () => {
    mocks.storage.set(CONSENT_KEY, '1');

    await clearCommerceState();

    expect(mocks.storage.has(CONSENT_KEY)).toBe(false);
  });

  it('attributes a click to the owner captured by its mounted query scope', async () => {
    const ownerScope = createOwnerQueryScope();

    await recordClick(ownerScope, CLICK);

    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: 'owner-a',
      click_token: CLICK.clickToken,
      product_type: CLICK.productType,
      source: CLICK.source,
      consented: true,
    });
    expect(mocks.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('does not attribute a delayed owner-A click after an A-to-B boundary starts', async () => {
    let releaseOwner!: (value: { data: { user: { id: string } }; error: null }) => void;
    let markOwnerLookupStarted!: () => void;
    const ownerLookupStarted = new Promise<void>((resolve) => {
      markOwnerLookupStarted = resolve;
    });
    mocks.getUser.mockImplementationOnce(() => {
      markOwnerLookupStarted();
      return new Promise((resolve) => {
        releaseOwner = resolve;
      });
    });
    const ownerScope = createOwnerQueryScope();

    const recording = recordClick(ownerScope, CLICK);
    await ownerLookupStarted;
    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseOwner({ data: { user: { id: 'owner-a' } }, error: null });

    await expect(recording).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('keeps an external handoff in the owner lease until account isolation drains it', async () => {
    let markHandoffStarted!: () => void;
    let releaseHandoff!: () => void;
    const handoffStarted = new Promise<void>((resolve) => {
      markHandoffStarted = resolve;
    });
    const handoffGate = new Promise<void>((resolve) => {
      releaseHandoff = resolve;
    });
    const ownerScope = createOwnerQueryScope();

    const handoff = runCommerceClickOperation(ownerScope, CLICK, async () => {
      markHandoffStarted();
      await handoffGate;
      return true;
    });
    await handoffStarted;

    beginAccountGenerationBoundary();
    boundaryActive = true;
    let drained = false;
    const draining = waitForAccountGenerationOperationsToSettle().then(() => {
      drained = true;
    });
    await Promise.resolve();
    expect(drained).toBe(false);

    releaseHandoff();
    await expect(handoff).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    await draining;
    expect(drained).toBe(true);
  });
});
