import { beforeEach, describe, expect, it, vi } from 'vitest';

import { recordShelfScan, shelfScanResultFromLookup } from './scanLog';

const mocks = vi.hoisted(() => {
  const insert = vi.fn(async () => ({ error: null }));
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
    from: vi.fn(() => ({ insert })),
    runHealthDataWriteOperation: vi.fn(),
    track: vi.fn(),
  };
});

const state = vi.hoisted(() => ({
  isSupabaseConfigured: true,
  leaseOpen: true,
}));

vi.mock('@/lib/env', () => ({
  get isSupabaseConfigured() {
    return mocks.isSupabaseConfigured;
  },
}));

vi.mock('@/lib/analytics/track', () => ({
  track: mocks.track,
}));

vi.mock('@/lib/consent/healthProcessingEpoch', () => ({
  activeHealthProcessingOwnerUserId: () => 'user-1',
}));

vi.mock('@/lib/consent/healthDataWriteAdmission', () => ({
  runHealthDataWriteOperation: mocks.runHealthDataWriteOperation,
}));

vi.mock('@/lib/supabase/client', () => ({
  getPersistedSupabaseUser: mocks.getUser,
  supabase: {
    auth: {
      getUser: mocks.getUser,
    },
    from: mocks.from,
  },
}));

describe('shelf scan intake log', () => {
  beforeEach(() => {
    state.isSupabaseConfigured = true;
    state.leaseOpen = true;
    mocks.getUser.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.insert.mockReset();
    mocks.insert.mockResolvedValue({ error: null });
    mocks.from.mockClear();
    mocks.runHealthDataWriteOperation.mockReset();
    mocks.runHealthDataWriteOperation.mockImplementation(
      async (
        ownerUserId: string,
        operation: (lease: { ownerUserId: string; assertCurrent: () => void }) => unknown,
      ) =>
        operation({
          ownerUserId,
          assertCurrent: () => {
            if (!state.leaseOpen) throw new Error('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
          },
        }),
    );
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
    await recordShelfScan({
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
  });

  it('tracks no-match scans and skips the database when Supabase is unavailable', async () => {
    state.isSupabaseConfigured = false;

    await recordShelfScan({
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

    await recordShelfScan({
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
    await recordShelfScan({
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

  it('does not swallow lease invalidation after a stale insert response', async () => {
    mocks.insert.mockImplementationOnce(async () => {
      state.leaseOpen = false;
      return { error: null };
    });

    await expect(
      recordShelfScan({ barcode: '1234567890123', result: 'matched' }),
    ).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
  });
});
