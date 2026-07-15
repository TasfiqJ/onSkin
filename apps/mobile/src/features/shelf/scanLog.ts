import type { ShelfScanResult } from '@onskin/types';

import type { CatalogLookupResponse } from '@/features/catalog/client';
import { track } from '@/lib/analytics/track';
import { runHealthDataWriteOperation } from '@/lib/consent/healthDataWriteAdmission';
import { activeHealthProcessingOwnerUserId } from '@/lib/consent/healthProcessingEpoch';
import { isSupabaseConfigured } from '@/lib/env';
import { getPersistedSupabaseUser, supabase } from '@/lib/supabase/client';

export type ShelfScanLookupResult = CatalogLookupResponse['result'] | 'lookup_error';

export function shelfScanResultFromLookup(result: ShelfScanLookupResult): ShelfScanResult {
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
      return 'offline_queued';
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

export async function recordShelfScan(input: {
  barcode: string;
  result: ShelfScanResult;
  matchedProductId?: string | null;
  contributedBack?: boolean;
}): Promise<void> {
  const barcode = input.barcode.trim();
  if (!barcode) return;

  const expectedOwnerUserId = activeHealthProcessingOwnerUserId();
  if (!expectedOwnerUserId) return;
  await runHealthDataWriteOperation(expectedOwnerUserId, async (lease) => {
    lease.assertCurrent();
    trackScanFunnel(input.result);
    lease.assertCurrent();
    if (!isSupabaseConfigured) return;
    try {
      lease.assertCurrent();
      const { data } = await getPersistedSupabaseUser();
      lease.assertCurrent();
      if (data.user?.id !== lease.ownerUserId) return;
      lease.assertCurrent();
      await supabase.from('shelf_scans').insert({
        user_id: lease.ownerUserId,
        barcode,
        matched_product_id: input.matchedProductId ?? null,
        result: input.result,
        contributed_back: input.contributedBack ?? false,
      });
      lease.assertCurrent();
    } catch {
      // Keep ordinary intake failures best-effort, but never swallow a stale
      // lease after consent withdrawal, account change, or regrant.
      lease.assertCurrent();
    }
  });
}
