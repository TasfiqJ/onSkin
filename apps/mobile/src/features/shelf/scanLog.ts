import type { ShelfScanResult } from '@onskin/types';
import * as Crypto from 'expo-crypto';

import type { CatalogLookupResponse } from '@/features/catalog/client';
import { track } from '@/lib/analytics/track';
import { awaitAccountGenerationLease } from '@/lib/auth/accountGeneration';
import { hashOutboxOwner, scheduleOutboxFlush } from '@/lib/offline/outbox';
import {
  OUTBOX_STORAGE_KEY,
  decodeOutboxEnvelope,
  encodeOutboxEnvelope,
  enqueueShelfScanOutboxOperation,
  shelfScanPayloadHashInput,
} from '@/lib/offline/outbox.pure';
import { runOwnerQueryOperation, type OwnerQueryScope } from '@/lib/query/queryKeys';
import { readPrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';

export type ShelfScanLookupResult = CatalogLookupResponse['result'] | 'lookup_error';

const NUMERIC_BARCODE = /^[0-9]{6,14}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  if (result === 'matched') {
    track('barcode_scanned', { source: 'scan', matched: true, result });
  } else {
    track('barcode_scanned', { source: 'scan', matched: false, result });
  }
  if (result === 'matched') {
    track('scan_matched', { source: 'scan', result });
  } else if (result === 'no_match') {
    track('scan_no_match', { source: 'scan', result });
  }
}

export async function recordShelfScan(
  ownerScope: OwnerQueryScope,
  input: {
    barcode: string;
    result: ShelfScanResult;
    matchedProductId?: string | null;
  },
  ownerId?: string | null,
): Promise<void> {
  const barcode = input.barcode.trim();
  if (!NUMERIC_BARCODE.test(barcode)) return;
  const result = input.result;
  const matchedProductId =
    result === 'matched' &&
    typeof input.matchedProductId === 'string' &&
    UUID.test(input.matchedProductId.trim())
      ? input.matchedProductId.trim().toLowerCase()
      : null;
  const normalizedOwnerId = ownerId?.trim();
  const operationId = Crypto.randomUUID();
  const entityId = Crypto.randomUUID();
  const scannedAt = new Date().toISOString();
  const payload = Object.freeze({
    barcode,
    result,
    matched_product_id: matchedProductId,
    scanned_at: scannedAt,
  });

  await runOwnerQueryOperation(ownerScope, async (lease) => {
    trackScanFunnel(result);
    if (!normalizedOwnerId || normalizedOwnerId.length > 512) return;

    let ownerHash: string | null = null;
    let payloadHash: string | null = null;
    try {
      const computedPayloadHash = await awaitAccountGenerationLease(lease, () =>
        Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          shelfScanPayloadHashInput(payload),
        ),
      );
      payloadHash = computedPayloadHash;
      lease.assertCurrent();
      const computedOwnerHash = await hashOutboxOwner(normalizedOwnerId);
      ownerHash = computedOwnerHash;
      lease.assertCurrent();
      await updatePrivateItem(OUTBOX_STORAGE_KEY, (current) =>
        encodeOutboxEnvelope(
          enqueueShelfScanOutboxOperation(decodeOutboxEnvelope(current), {
            operationId,
            ownerHash: computedOwnerHash,
            ownerGeneration: lease.generation,
            entityId,
            payload,
            payloadHash: computedPayloadHash,
            enqueuedAt: scannedAt,
          }).envelope,
        ),
      );
      lease.assertCurrent();
      scheduleOutboxFlush();
    } catch {
      lease.assertCurrent();
      if (!ownerHash || !payloadHash) return;
      try {
        const read = await awaitAccountGenerationLease(lease, () =>
          readPrivateItem(OUTBOX_STORAGE_KEY),
        );
        lease.assertCurrent();
        if (read.status !== 'available') return;
        const expectedIdempotencyKey = `shelf_scan:${operationId}:${payloadHash}`;
        const committed = decodeOutboxEnvelope(read.value).rows.some(
          (row) =>
            row.operationId === operationId &&
            row.entityType === 'shelf_scan' &&
            row.entityId === entityId &&
            row.ownerHash === ownerHash &&
            row.ownerGeneration === lease.generation &&
            row.idempotencyKey === expectedIdempotencyKey &&
            row.enqueuedAt === scannedAt &&
            row.payload?.barcode === barcode &&
            row.payload.result === result &&
            row.payload.matched_product_id === matchedProductId &&
            row.payload.scanned_at === scannedAt,
        );
        if (committed) scheduleOutboxFlush();
      } catch {
        lease.assertCurrent();
        /* best-effort intake telemetry; the visible scan fallback remains usable offline */
      }
    }
  });
}
