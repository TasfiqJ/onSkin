import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope, type OwnerQueryScope } from '@/lib/query/queryKeys';

import { recordShelfScan, shelfScanResultFromLookup } from './scanLog';

const mocks = vi.hoisted(() => {
  const abortSignal = vi.fn(async () => ({ error: null }));
  const insert = vi.fn(() => ({ abortSignal }));
  return {
    get isSupabaseConfigured() {
      return state.isSupabaseConfigured;
    },
    getUser: vi.fn(
      async (): Promise<{ data: { user: { id: string } | null } }> => ({
        data: { user: { id: 'user-1' } },
      }),
    ),
    insert,
    abortSignal,
    from: vi.fn(() => ({ insert })),
    track: vi.fn(),
  };
});

const state = vi.hoisted(() => ({
  isSupabaseConfigured: true,
}));

vi.mock('@/lib/env', () => ({
  get isSupabaseConfigured() {
    return mocks.isSupabaseConfigured;
  },
}));

vi.mock('@/lib/analytics/track', () => ({
  track: mocks.track,
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
    },
    from: mocks.from,
  },
}));

let boundaryActive = false;

function record(
  input: Parameters<typeof recordShelfScan>[1],
  ownerScope: OwnerQueryScope = createOwnerQueryScope(),
) {
  return recordShelfScan(ownerScope, input);
}

afterEach(() => {
  if (boundaryActive) {
    endAccountGenerationBoundary();
    boundaryActive = false;
  }
});

describe('shelf scan intake log', () => {
  beforeEach(() => {
    state.isSupabaseConfigured = true;
    mocks.getUser.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.insert.mockClear();
    mocks.abortSignal.mockClear();
    mocks.from.mockClear();
    mocks.track.mockClear();
  });

  it('maps lookup outcomes onto the shelf_scans enum', () => {
    expect(shelfScanResultFromLookup('matched')).toBe('matched');
    expect(shelfScanResultFromLookup('external_candidate')).toBe('ambiguous');
    expect(shelfScanResultFromLookup('no_match')).toBe('no_match');
    expect(shelfScanResultFromLookup('too_short')).toBe('no_match');
    expect(shelfScanResultFromLookup('offline')).toBe('offline_queued');
    expect(shelfScanResultFromLookup('error')).toBe('offline_queued');
    expect(shelfScanResultFromLookup('lookup_error')).toBe('offline_queued');
  });

  it('records a matched scan with master-plan funnel events and no barcode analytics leak', async () => {
    await record({
      barcode: ' 1234567890123 ',
      result: 'matched',
      matchedProductId: 'product-1',
    });

    expect(mocks.track).toHaveBeenCalledWith('barcode_scanned', {
      source: 'scan',
      matched: true,
      result: 'matched',
    });
    expect(mocks.track).toHaveBeenCalledWith('scan_matched', {
      source: 'scan',
      result: 'matched',
    });
    expect(mocks.track).not.toHaveBeenCalledWith('product_scanned', expect.anything());
    expect(mocks.from).toHaveBeenCalledWith('shelf_scans');
    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      barcode: '1234567890123',
      matched_product_id: 'product-1',
      result: 'matched',
      contributed_back: false,
    });
    expect(mocks.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('tracks no-match scans and skips the database when Supabase is unavailable', async () => {
    state.isSupabaseConfigured = false;

    await record({
      barcode: '9876543210987',
      result: 'no_match',
    });

    expect(mocks.track).toHaveBeenCalledWith('barcode_scanned', {
      source: 'scan',
      matched: false,
      result: 'no_match',
    });
    expect(mocks.track).toHaveBeenCalledWith('scan_no_match', {
      source: 'scan',
      result: 'no_match',
    });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('does not insert owner-scoped rows without an authenticated user', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });

    await record({
      barcode: '1234567890123',
      result: 'offline_queued',
    });

    expect(mocks.track).toHaveBeenCalledWith('barcode_scanned', {
      source: 'scan',
      matched: false,
      result: 'offline_queued',
    });
    expect(mocks.track).not.toHaveBeenCalledWith('scan_matched', expect.anything());
    expect(mocks.track).not.toHaveBeenCalledWith('scan_no_match', expect.anything());
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('does not over-count ambiguous external candidates as matches or no-matches', async () => {
    await record({
      barcode: '1234567890123',
      result: 'ambiguous',
      matchedProductId: 'external-product',
    });

    expect(mocks.track).toHaveBeenCalledWith('barcode_scanned', {
      source: 'scan',
      matched: false,
      result: 'ambiguous',
    });
    expect(mocks.track).not.toHaveBeenCalledWith('scan_matched', expect.anything());
    expect(mocks.track).not.toHaveBeenCalledWith('scan_no_match', expect.anything());
  });

  it('does not publish a delayed owner-A scan after an A-to-B boundary starts', async () => {
    let releaseOwner!: (value: { data: { user: { id: string } } }) => void;
    let markLookupStarted!: () => void;
    const lookupStarted = new Promise<void>((resolve) => {
      markLookupStarted = resolve;
    });
    mocks.getUser.mockImplementationOnce(() => {
      markLookupStarted();
      return new Promise((resolve) => {
        releaseOwner = resolve;
      });
    });

    const recording = record({
      barcode: '1234567890123',
      result: 'matched',
      matchedProductId: 'product-a',
    });
    await lookupStarted;
    beginAccountGenerationBoundary();
    boundaryActive = true;
    releaseOwner({ data: { user: { id: 'owner-a' } } });

    await expect(recording).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('allows delayed work to finish when the authenticated owner remains unchanged', async () => {
    let releaseOwner!: (value: { data: { user: { id: string } } }) => void;
    mocks.getUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseOwner = resolve;
        }),
    );

    const recording = record({
      barcode: '1234567890123',
      result: 'matched',
      matchedProductId: 'product-a',
    });
    releaseOwner({ data: { user: { id: 'user-1' } } });

    await expect(recording).resolves.toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', matched_product_id: 'product-a' }),
    );
  });

  it('rejects an A payload that enters only after the A-to-B boundary completed', async () => {
    const ownerAScope = createOwnerQueryScope();
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();

    await expect(
      record(
        {
          barcode: '1234567890123',
          result: 'matched',
          matchedProductId: 'product-a',
        },
        ownerAScope,
      ),
    ).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
  });
});
