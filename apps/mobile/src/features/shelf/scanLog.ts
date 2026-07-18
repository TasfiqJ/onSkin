import type { ShelfScanResult } from '@onskin/types';

import type { CatalogLookupResponse } from '@/features/catalog/client';
import { track } from '@/lib/analytics/track';
import { runHealthDataWriteOperation } from '@/lib/consent/healthDataWriteAdmission';
import { activeHealthProcessingOwnerUserId } from '@/lib/consent/healthProcessingEpoch';

export type ShelfScanLookupResult = CatalogLookupResponse['result'] | 'lookup_error';

export function shelfScanResultFromLookup(result: ShelfScanLookupResult): ShelfScanResult | null {
  switch (result) {
    case 'matched':
      return 'matched';
    case 'external_candidate':
      return 'ambiguous';
    case 'no_match':
    case 'too_short':
      return 'no_match';
    case 'offline':
    case 'error':
    case 'lookup_error':
      return null;
  }
}

function trackScanFunnel(result: ShelfScanResult): void {
  track('barcode_scanned', {
    source: 'scan',
    matched: result === 'matched',
    result,
  });
  if (result === 'matched') {
    track('scan_matched', { source: 'scan', result });
  } else if (result === 'no_match') {
    track('scan_no_match', { source: 'scan', result });
  }
}

export async function recordShelfScan(input: { result: ShelfScanResult }): Promise<void> {
  const expectedOwnerUserId = activeHealthProcessingOwnerUserId();
  if (!expectedOwnerUserId) return;
  await runHealthDataWriteOperation(expectedOwnerUserId, async (lease) => {
    lease.assertCurrent();
    trackScanFunnel(input.result);
    lease.assertCurrent();
  });
}
