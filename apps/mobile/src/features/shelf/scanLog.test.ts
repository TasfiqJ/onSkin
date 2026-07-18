import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import {
  OUTBOX_STORAGE_KEY,
  decodeOutboxEnvelope,
  shelfScanPayloadHashInput,
} from '@/lib/offline/outbox.pure';
import { createOwnerQueryScope, type OwnerQueryScope } from '@/lib/query/queryKeys';

import { recordShelfScan, shelfScanResultFromLookup } from './scanLog';

const OWNER_HASH = 'a'.repeat(64);
const PAYLOAD_HASH = 'b'.repeat(64);
const NOW = '2026-07-18T16:00:00.000Z';
const PRODUCT_ID = '00000000-0000-4000-8000-000000000043';

function uuid(sequence: number): string {
  return `00000000-0000-4000-8000-${sequence.toString(16).padStart(12, '0')}`;
}

const mocks = vi.hoisted(() => ({
  hashOwner: vi.fn(),
  nextUuid: 1,
  payloadDigest: vi.fn(),
  randomUUID: vi.fn(),
  scheduleFlush: vi.fn(),
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
  track: vi.fn(),
  updateAfterCommit: null as null | (() => void),
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: mocks.payloadDigest,
  randomUUID: mocks.randomUUID,
}));

vi.mock('@/lib/analytics/track', () => ({ track: mocks.track }));

vi.mock('@/lib/offline/outbox', () => ({
  hashOutboxOwner: mocks.hashOwner,
  scheduleOutboxFlush: mocks.scheduleFlush,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  readPrivateItem: vi.fn(async (key: string) => {
    const value = mocks.storage.get(key);
    return value === undefined ? { status: 'absent' } : { status: 'available', value };
  }),
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      const previous = mocks.tails.get(key) ?? Promise.resolve();
      let release!: () => void;
      const tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      mocks.tails.set(key, tail);
      await previous;
      try {
        const next = updater(mocks.storage.get(key) ?? null);
        if (next === null) mocks.storage.delete(key);
        else mocks.storage.set(key, next);
        mocks.updateAfterCommit?.();
      } finally {
        release();
        if (mocks.tails.get(key) === tail) mocks.tails.delete(key);
      }
    },
  ),
}));

let boundaryActive = false;

function record(
  input: Parameters<typeof recordShelfScan>[1],
  ownerScope: OwnerQueryScope = createOwnerQueryScope(),
  ownerId: string | null = 'user-1',
) {
  return recordShelfScan(ownerScope, input, ownerId);
}

function storedRows() {
  return decodeOutboxEnvelope(mocks.storage.get(OUTBOX_STORAGE_KEY) ?? null).rows;
}

afterEach(() => {
  vi.useRealTimers();
  if (boundaryActive) {
    endAccountGenerationBoundary();
    boundaryActive = false;
  }
});

describe('shelf scan intake log', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.updateAfterCommit = null;
    mocks.nextUuid = 1;
    mocks.hashOwner.mockReset();
    mocks.hashOwner.mockResolvedValue(OWNER_HASH);
    mocks.payloadDigest.mockReset();
    mocks.payloadDigest.mockResolvedValue(PAYLOAD_HASH);
    mocks.randomUUID.mockReset();
    mocks.randomUUID.mockImplementation(() => uuid(mocks.nextUuid++));
    mocks.scheduleFlush.mockReset();
    mocks.track.mockReset();
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

  it('queues a matched scan with owner hashing and no barcode analytics leak', async () => {
    await record({
      barcode: ' 1234567890123 ',
      result: 'matched',
      matchedProductId: PRODUCT_ID.toUpperCase(),
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
    expect(JSON.stringify(mocks.track.mock.calls)).not.toContain('1234567890123');
    expect(mocks.hashOwner).toHaveBeenCalledWith('user-1');
    const row = storedRows()[0];
    expect(row).toMatchObject({
      operationId: uuid(1),
      entityType: 'shelf_scan',
      entityId: uuid(2),
      ownerHash: OWNER_HASH,
      ownerGeneration: expect.any(Number),
      clientRevision: 1,
      idempotencyKey: `shelf_scan:${uuid(1)}:${PAYLOAD_HASH}`,
      payload: {
        barcode: '1234567890123',
        result: 'matched',
        matched_product_id: PRODUCT_ID,
        scanned_at: NOW,
      },
    });
    expect(mocks.payloadDigest).toHaveBeenCalledWith(
      'SHA-256',
      shelfScanPayloadHashInput(row!.payload!),
    );
    expect(mocks.scheduleFlush).toHaveBeenCalledOnce();
  });

  it('queues offline outcomes without a configured backend or a remote owner lookup', async () => {
    await record({ barcode: '9876543210987', result: 'offline_queued' });

    expect(storedRows()[0]).toMatchObject({
      entityType: 'shelf_scan',
      payload: {
        barcode: '9876543210987',
        result: 'offline_queued',
        matched_product_id: null,
        scanned_at: NOW,
      },
    });
    expect(mocks.scheduleFlush).toHaveBeenCalledOnce();
  });

  it('never binds an external candidate to an internal catalog product', async () => {
    await record({
      barcode: '1234567890123',
      result: 'ambiguous',
      matchedProductId: PRODUCT_ID,
    });

    expect(storedRows()[0]?.payload).toMatchObject({
      result: 'ambiguous',
      matched_product_id: null,
    });
    expect(mocks.track).not.toHaveBeenCalledWith('scan_matched', expect.anything());
    expect(mocks.track).not.toHaveBeenCalledWith('scan_no_match', expect.anything());
  });

  it('tracks but does not queue when no authenticated local owner is published', async () => {
    await record({ barcode: '1234567890123', result: 'no_match' }, undefined, null);

    expect(mocks.track).toHaveBeenCalledWith('scan_no_match', {
      source: 'scan',
      result: 'no_match',
    });
    expect(mocks.hashOwner).not.toHaveBeenCalled();
    expect(storedRows()).toEqual([]);
    expect(mocks.scheduleFlush).not.toHaveBeenCalled();
  });

  it('rejects invalid barcode material before analytics, hashing, or storage', async () => {
    for (const barcode of ['123-456', '12345', '123456789012345']) {
      await record({ barcode, result: 'no_match' });
    }

    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.hashOwner).not.toHaveBeenCalled();
    expect(mocks.payloadDigest).not.toHaveBeenCalled();
    expect(storedRows()).toEqual([]);
  });

  it('serializes 100 simultaneous distinct scan events without coalescing', async () => {
    await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        record({
          barcode: (1_000_000_000_000 + index).toString(),
          result: index % 2 === 0 ? 'matched' : 'no_match',
          matchedProductId: index % 2 === 0 ? PRODUCT_ID : null,
        }),
      ),
    );

    const rows = storedRows();
    expect(rows).toHaveLength(100);
    expect(new Set(rows.map((row) => row.operationId)).size).toBe(100);
    expect(new Set(rows.map((row) => row.entityId)).size).toBe(100);
    expect(rows.every((row) => row.entityType === 'shelf_scan' && row.clientRevision === 1)).toBe(
      true,
    );
    expect(mocks.scheduleFlush).toHaveBeenCalledTimes(100);
  });

  it('preserves a corrupt or future outbox and keeps the visible scan path best effort', async () => {
    for (const raw of ['{bad-json', JSON.stringify({ version: 6, rows: [], revisions: [] })]) {
      mocks.storage.set(OUTBOX_STORAGE_KEY, raw);
      await expect(
        record({ barcode: '1234567890123', result: 'no_match' }),
      ).resolves.toBeUndefined();
      expect(mocks.storage.get(OUTBOX_STORAGE_KEY)).toBe(raw);
    }
    expect(mocks.scheduleFlush).not.toHaveBeenCalled();
  });

  it('detaches a delayed payload hash and writes nothing after an owner boundary', async () => {
    let releaseHash!: () => void;
    mocks.payloadDigest.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          releaseHash = () => resolve(PAYLOAD_HASH);
        }),
    );

    const recording = record({ barcode: '1234567890123', result: 'matched' });
    await vi.waitFor(() => expect(mocks.payloadDigest).toHaveBeenCalledOnce());
    beginAccountGenerationBoundary();
    boundaryActive = true;

    await expect(recording).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(storedRows()).toEqual([]);
    expect(mocks.scheduleFlush).not.toHaveBeenCalled();
    releaseHash();
    await Promise.resolve();
  });

  it('confirms and schedules a committed row when storage confirmation is lost', async () => {
    mocks.updateAfterCommit = () => {
      mocks.updateAfterCommit = null;
      throw new Error('confirmation lost');
    };

    await expect(record({ barcode: '1234567890123', result: 'no_match' })).resolves.toBeUndefined();

    expect(storedRows()).toHaveLength(1);
    expect(mocks.scheduleFlush).toHaveBeenCalledOnce();
  });

  it('rejects a payload that enters only after its owner scope became stale', async () => {
    const ownerAScope = createOwnerQueryScope();
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();

    await expect(
      record({ barcode: '1234567890123', result: 'matched' }, ownerAScope),
    ).rejects.toMatchObject({ code: 'ACCOUNT_GENERATION_CHANGED' });
    expect(mocks.track).not.toHaveBeenCalled();
    expect(storedRows()).toEqual([]);
  });
});
