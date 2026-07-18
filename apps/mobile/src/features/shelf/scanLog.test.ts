import { beforeEach, describe, expect, it, vi } from 'vitest';

import { recordShelfScan, shelfScanResultFromLookup } from './scanLog';

const state = vi.hoisted(() => ({
  ownerUserId: 'user-1' as string | null,
  leaseOpen: true,
}));

const mocks = vi.hoisted(() => ({
  runHealthDataWriteOperation: vi.fn(),
  track: vi.fn(),
}));

vi.mock('@/lib/analytics/track', () => ({ track: mocks.track }));
vi.mock('@/lib/consent/healthProcessingEpoch', () => ({
  activeHealthProcessingOwnerUserId: () => state.ownerUserId,
}));
vi.mock('@/lib/consent/healthDataWriteAdmission', () => ({
  runHealthDataWriteOperation: mocks.runHealthDataWriteOperation,
}));

describe('shelf scan result-only analytics', () => {
  beforeEach(() => {
    state.ownerUserId = 'user-1';
    state.leaseOpen = true;
    mocks.track.mockReset();
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
  });

  it('maps lookup outcomes onto the bounded scan-result enum', () => {
    expect(shelfScanResultFromLookup('matched')).toBe('matched');
    expect(shelfScanResultFromLookup('external_candidate')).toBe('ambiguous');
    expect(shelfScanResultFromLookup('no_match')).toBe('no_match');
    expect(shelfScanResultFromLookup('too_short')).toBe('no_match');
    expect(shelfScanResultFromLookup('offline')).toBeNull();
    expect(shelfScanResultFromLookup('error')).toBeNull();
    expect(shelfScanResultFromLookup('lookup_error')).toBeNull();
  });

  it('records only bounded matched funnel properties', async () => {
    await recordShelfScan({ result: 'matched' });

    expect(mocks.track).toHaveBeenCalledWith('barcode_scanned', {
      source: 'scan',
      matched: true,
      result: 'matched',
    });
    expect(mocks.track).toHaveBeenCalledWith('scan_matched', {
      source: 'scan',
      result: 'matched',
    });
    for (const [, properties] of mocks.track.mock.calls) {
      expect(Object.keys(properties as Record<string, unknown>)).not.toContain('barcode');
      expect(Object.keys(properties as Record<string, unknown>)).not.toContain('product_id');
    }
  });

  it('distinguishes no-match and does not over-count ambiguous or offline results', async () => {
    await recordShelfScan({ result: 'no_match' });
    expect(mocks.track).toHaveBeenCalledWith('scan_no_match', {
      source: 'scan',
      result: 'no_match',
    });

    mocks.track.mockClear();
    await recordShelfScan({ result: 'ambiguous' });
    await recordShelfScan({ result: 'offline_queued' });
    expect(mocks.track).not.toHaveBeenCalledWith('scan_matched', expect.anything());
    expect(mocks.track).not.toHaveBeenCalledWith('scan_no_match', expect.anything());
  });

  it('does nothing while health processing has no active owner', async () => {
    state.ownerUserId = null;
    await recordShelfScan({ result: 'matched' });
    expect(mocks.runHealthDataWriteOperation).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it('does not publish after lease invalidation', async () => {
    mocks.runHealthDataWriteOperation.mockImplementationOnce(
      async (
        ownerUserId: string,
        operation: (lease: { ownerUserId: string; assertCurrent: () => void }) => unknown,
      ) => {
        let assertions = 0;
        return operation({
          ownerUserId,
          assertCurrent: () => {
            assertions += 1;
            if (assertions > 1) throw new Error('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
          },
        });
      },
    );

    await expect(recordShelfScan({ result: 'matched' })).rejects.toThrow(
      'HEALTH_DATA_WRITE_ADMISSION_CLOSED',
    );
  });
});
