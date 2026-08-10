import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CatalogLookupResponse, CatalogProductSummary } from '@/features/catalog/client';

import {
  acceptReadyCatalogLookup,
  acceptReadyCatalogLookupAfterShelfSave,
  bindCatalogLookupToShelfProduct,
  CATALOG_LOOKUP_QUEUE_BASE_BACKOFF_MS,
  CATALOG_LOOKUP_QUEUE_FULL,
  CATALOG_LOOKUP_QUEUE_INVALID,
  CATALOG_LOOKUP_QUEUE_INVALID_SHELF_PRODUCT,
  CATALOG_LOOKUP_QUEUE_KEY,
  CATALOG_LOOKUP_QUEUE_MAX_BACKOFF_MS,
  CATALOG_LOOKUP_QUEUE_MAX_ITEMS,
  CATALOG_LOOKUP_QUEUE_TTL_MS,
  CATALOG_LOOKUP_QUEUE_UNSUPPORTED_VERSION,
  drainCatalogLookupQueue,
  enqueueCatalogLookup,
  maintainCatalogLookupQueue,
  normalizeCatalogLookupBarcode,
  purgeExpiredCatalogLookupQueueForPurposeLimitedExport,
  readReadyCatalogLookups,
  rejectReadyCatalogLookup,
  subscribeCatalogLookupQueueChanges,
} from './catalogLookupQueue';

const QUEUE_SOURCE = fileURLToPath(new URL('./catalogLookupQueue.ts', import.meta.url));
const OWNER_MISMATCH = 'HEALTH_DATA_WRITE_OWNER_MISMATCH';
const ADMISSION_CLOSED = 'HEALTH_DATA_WRITE_ADMISSION_CLOSED';

const h = vi.hoisted(() => ({
  generation: 1,
  ownerUserId: 'owner-a' as string | null,
  storage: new Map<string, string>(),
  getPrivateItem: vi.fn(),
  updatePrivateItem: vi.fn(),
  updateCatalogLookupQueueForPurposeLimitedExport: vi.fn(),
  lookupBarcode: vi.fn(),
}));

function capturedLease(expectedOwnerUserId?: string) {
  const capturedOwner = h.ownerUserId;
  const capturedGeneration = h.generation;
  if (capturedOwner === null) throw new Error(ADMISSION_CLOSED);
  if (expectedOwnerUserId !== undefined && expectedOwnerUserId !== capturedOwner) {
    throw new Error(OWNER_MISMATCH);
  }
  const assertCurrent = () => {
    if (h.ownerUserId === null) throw new Error(ADMISSION_CLOSED);
    if (h.ownerUserId !== capturedOwner) throw new Error(OWNER_MISMATCH);
    if (h.generation !== capturedGeneration) throw new Error(ADMISSION_CLOSED);
  };
  return {
    generation: capturedGeneration,
    epoch: capturedGeneration,
    ownerUserId: capturedOwner,
    accountGeneration: capturedGeneration,
    expiresAt: null,
    signal: new AbortController().signal,
    assertCurrent,
  };
}

vi.mock('@/lib/consent/healthDataWriteAdmission', () => ({
  captureHealthDataWriteLease: (expectedOwnerUserId?: string) => capturedLease(expectedOwnerUserId),
  runHealthDataOperation: async (
    expectedOwnerUserId: string,
    operation: (lease: ReturnType<typeof capturedLease>) => unknown,
  ) => {
    const lease = capturedLease(expectedOwnerUserId);
    lease.assertCurrent();
    const result = await operation(lease);
    lease.assertCurrent();
    return result;
  },
  runCurrentHealthDataOperation: async (
    operation: (lease: ReturnType<typeof capturedLease>) => unknown,
  ) => {
    const lease = capturedLease();
    lease.assertCurrent();
    const result = await operation(lease);
    lease.assertCurrent();
    return result;
  },
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: h.getPrivateItem,
  updatePrivateItem: h.updatePrivateItem,
  updateCatalogLookupQueueForPurposeLimitedExport:
    h.updateCatalogLookupQueueForPurposeLimitedExport,
}));

vi.mock('@/features/catalog/client', () => ({
  lookupBarcode: h.lookupBarcode,
}));

const BASE = new Date('2026-07-18T12:00:00.000Z');
const PRODUCT_ID = '10000000-0000-4000-8000-000000000001';
const SOURCE_ID = '20000000-0000-4000-8000-000000000002';
const SECOND_BARCODE = '036000291452';
const CAPACITY_BARCODE = '999999999993';

function gtin(body: string): string {
  const sum = [...body]
    .reverse()
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  return `${body}${(10 - (sum % 10)) % 10}`;
}

function at(millisecondsAfterBase: number): Date {
  return new Date(BASE.getTime() + millisecondsAfterBase);
}

function product(
  barcode = '012345678905',
  overrides: Partial<CatalogProductSummary> = {},
): CatalogProductSummary {
  return {
    id: PRODUCT_ID,
    barcode,
    name: 'Reviewed Barrier Serum',
    brand: 'Layerwell Lab',
    category: 'serum',
    source: 'reviewed_catalog',
    catalog_source_id: SOURCE_ID,
    catalog_sources: {
      id: SOURCE_ID,
      display_name: 'Reviewed catalog',
      source_key: 'reviewed_catalog',
      attribution_text: null,
      attribution_url: null,
    },
    quality_grade: 'verified',
    review_status: 'reviewed',
    rawIngredientsText: 'sensitive raw ingredient text that must not be queued',
    ...overrides,
  };
}

function matched(
  barcode = '012345678905',
  overrides: Partial<CatalogProductSummary> = {},
): CatalogLookupResponse {
  return { result: 'matched', product: product(barcode, overrides) };
}

function storedEnvelope(): {
  version: number;
  items: Record<string, unknown>[];
} {
  const raw = h.storage.get(CATALOG_LOOKUP_QUEUE_KEY);
  if (!raw) return { version: 1, items: [] };
  return JSON.parse(raw) as { version: number; items: Record<string, unknown>[] };
}

beforeEach(() => {
  h.generation = 1;
  h.ownerUserId = 'owner-a';
  h.storage.clear();
  h.lookupBarcode.mockReset().mockResolvedValue({
    result: 'offline',
    manualFallback: true,
  });
  h.getPrivateItem
    .mockReset()
    .mockImplementation(async (key: string) => h.storage.get(key) ?? null);
  h.updatePrivateItem
    .mockReset()
    .mockImplementation(async (key: string, updater: (current: string | null) => string | null) => {
      // Synchronous updater execution models privateKV's serialized per-key
      // critical section and makes concurrent enqueue behavior observable.
      const next = updater(h.storage.get(key) ?? null);
      if (next === null) h.storage.delete(key);
      else h.storage.set(key, next);
    });
  h.updateCatalogLookupQueueForPurposeLimitedExport
    .mockReset()
    .mockImplementation(
      async (_accountLease: unknown, updater: (current: string | null) => string | null) => {
        const next = updater(h.storage.get(CATALOG_LOOKUP_QUEUE_KEY) ?? null);
        if (next === null) h.storage.delete(CATALOG_LOOKUP_QUEUE_KEY);
        else h.storage.set(CATALOG_LOOKUP_QUEUE_KEY, next);
      },
    );
});

describe('encrypted offline catalog lookup queue', () => {
  it('notifies the mounted lifecycle after an explicit enqueue', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCatalogLookupQueueChanges(listener);

    await enqueueCatalogLookup({
      ownerUserId: 'owner-a',
      barcode: '012345678905',
      now: BASE,
    });
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
    await enqueueCatalogLookup({
      ownerUserId: 'owner-a',
      barcode: SECOND_BARCODE,
      now: BASE,
    });
    expect(listener).toHaveBeenCalledOnce();
  });

  it('normalizes formatting and atomically deduplicates concurrent enqueues', async () => {
    expect(normalizeCatalogLookupBarcode(' 0123-4567 8905 ')).toBe('012345678905');
    expect(normalizeCatalogLookupBarcode('abc-012345678905')).toBeNull();
    expect(normalizeCatalogLookupBarcode('012345678904')).toBeNull();
    expect(normalizeCatalogLookupBarcode('123456789')).toBeNull();
    expect(normalizeCatalogLookupBarcode(gtin('1234567'))).toBe(gtin('1234567'));
    expect(normalizeCatalogLookupBarcode(gtin('123456789012'))).toBe(gtin('123456789012'));
    expect(normalizeCatalogLookupBarcode(gtin('1234567890123'))).toBe(gtin('1234567890123'));

    const results = await Promise.all(
      Array.from({ length: 24 }, (_, index) =>
        enqueueCatalogLookup({
          ownerUserId: 'owner-a',
          barcode: index % 2 === 0 ? '0123-4567 8905' : '012345678905',
          shelfProductId: 'shelf-1',
          now: BASE,
        }),
      ),
    );

    expect(results.filter((result) => result.enqueued)).toHaveLength(1);
    expect(storedEnvelope()).toMatchObject({
      version: 1,
      items: [
        {
          ownerUserId: 'owner-a',
          barcode: '012345678905',
          shelfProductId: 'shelf-1',
          state: 'pending',
          attemptCount: 0,
        },
      ],
    });
  });

  it('rejects malformed and future bytes without repairing or overwriting them', async () => {
    const malformed = '{not-json';
    h.storage.set(CATALOG_LOOKUP_QUEUE_KEY, malformed);
    await expect(readReadyCatalogLookups(BASE)).rejects.toThrow(CATALOG_LOOKUP_QUEUE_INVALID);
    await expect(
      enqueueCatalogLookup({ ownerUserId: 'owner-a', barcode: '012345678905', now: BASE }),
    ).rejects.toThrow(CATALOG_LOOKUP_QUEUE_INVALID);
    expect(h.storage.get(CATALOG_LOOKUP_QUEUE_KEY)).toBe(malformed);

    const future = JSON.stringify({ version: 2, items: [] });
    h.storage.set(CATALOG_LOOKUP_QUEUE_KEY, future);
    await expect(readReadyCatalogLookups(BASE)).rejects.toThrow(
      CATALOG_LOOKUP_QUEUE_UNSUPPORTED_VERSION,
    );
    expect(h.storage.get(CATALOG_LOOKUP_QUEUE_KEY)).toBe(future);
  });

  it('strictly rejects duplicate rows and unknown fields in otherwise valid v1 bytes', async () => {
    await enqueueCatalogLookup({
      ownerUserId: 'owner-a',
      barcode: '012345678905',
      now: BASE,
    });
    const valid = storedEnvelope();
    h.storage.set(
      CATALOG_LOOKUP_QUEUE_KEY,
      JSON.stringify({ version: 1, items: [valid.items[0], valid.items[0]] }),
    );
    await expect(readReadyCatalogLookups(BASE)).rejects.toThrow(CATALOG_LOOKUP_QUEUE_INVALID);

    h.storage.set(
      CATALOG_LOOKUP_QUEUE_KEY,
      JSON.stringify({ version: 1, items: [{ ...valid.items[0], futureField: true }] }),
    );
    await expect(readReadyCatalogLookups(BASE)).rejects.toThrow(CATALOG_LOOKUP_QUEUE_INVALID);

    h.storage.set(
      CATALOG_LOOKUP_QUEUE_KEY,
      JSON.stringify({ version: 1, items: [{ ...valid.items[0], barcode: '012345678904' }] }),
    );
    await expect(readReadyCatalogLookups(BASE)).rejects.toThrow(CATALOG_LOOKUP_QUEUE_INVALID);
  });

  it('is process-persistent and does not rely on module memory for queue contents', async () => {
    await enqueueCatalogLookup({
      ownerUserId: 'owner-a',
      barcode: '012345678905',
      now: BASE,
    });
    h.lookupBarcode.mockResolvedValueOnce(matched());
    await drainCatalogLookupQueue({ now: BASE, lookup: h.lookupBarcode });

    vi.resetModules();
    const freshModule = await import('./catalogLookupQueue');
    await expect(freshModule.readReadyCatalogLookups(BASE)).resolves.toMatchObject([
      { barcode: '012345678905', candidate: { productId: PRODUCT_ID } },
    ]);
  });

  it('never exposes or sends a prior owner queue and purges it on the next admitted drain', async () => {
    await enqueueCatalogLookup({
      ownerUserId: 'owner-a',
      barcode: '012345678905',
      now: BASE,
    });

    h.ownerUserId = 'owner-b';
    h.generation += 1;
    await expect(readReadyCatalogLookups(BASE)).resolves.toEqual([]);
    await expect(
      drainCatalogLookupQueue({ now: BASE, lookup: h.lookupBarcode }),
    ).resolves.toMatchObject({ attempted: 0, remaining: 0 });
    expect(h.lookupBarcode).not.toHaveBeenCalled();
    expect(h.storage.has(CATALOG_LOOKUP_QUEUE_KEY)).toBe(false);
  });

  it('closes reads and writes after withdrawal and preserves a pending row across stale lookup completion', async () => {
    await enqueueCatalogLookup({
      ownerUserId: 'owner-a',
      barcode: '012345678905',
      now: BASE,
    });
    const before = h.storage.get(CATALOG_LOOKUP_QUEUE_KEY);
    let resolveLookup!: (response: CatalogLookupResponse) => void;
    h.lookupBarcode.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLookup = resolve;
      }),
    );
    const drain = drainCatalogLookupQueue({ now: BASE, lookup: h.lookupBarcode });
    await vi.waitFor(() => expect(h.lookupBarcode).toHaveBeenCalledOnce());

    h.ownerUserId = null;
    h.generation += 1;
    resolveLookup(matched());
    await expect(drain).rejects.toThrow(ADMISSION_CLOSED);
    expect(h.storage.get(CATALOG_LOOKUP_QUEUE_KEY)).toBe(before);
    await expect(readReadyCatalogLookups(BASE)).rejects.toThrow(ADMISSION_CLOSED);
    await expect(
      enqueueCatalogLookup({ ownerUserId: 'owner-a', barcode: SECOND_BARCODE, now: BASE }),
    ).rejects.toThrow(ADMISSION_CLOSED);
  });

  it('uses bounded exponential backoff, skips early retries, and removes expired work', async () => {
    await enqueueCatalogLookup({
      ownerUserId: 'owner-a',
      barcode: '012345678905',
      now: BASE,
    });
    h.lookupBarcode
      .mockResolvedValueOnce({ result: 'offline', manualFallback: true })
      .mockResolvedValueOnce({ result: 'error', manualFallback: true });

    await expect(
      drainCatalogLookupQueue({ now: BASE, lookup: h.lookupBarcode }),
    ).resolves.toMatchObject({
      attempted: 1,
      deferred: 1,
      remaining: 1,
      nextRetryAt: at(CATALOG_LOOKUP_QUEUE_BASE_BACKOFF_MS).toISOString(),
      nextExpiryAt: at(CATALOG_LOOKUP_QUEUE_TTL_MS).toISOString(),
    });
    expect(storedEnvelope().items[0]).toMatchObject({
      attemptCount: 1,
      nextAttemptAt: at(CATALOG_LOOKUP_QUEUE_BASE_BACKOFF_MS).toISOString(),
    });

    await expect(
      drainCatalogLookupQueue({
        now: at(CATALOG_LOOKUP_QUEUE_BASE_BACKOFF_MS - 1),
        lookup: h.lookupBarcode,
      }),
    ).resolves.toMatchObject({ attempted: 0, remaining: 1 });
    expect(h.lookupBarcode).toHaveBeenCalledTimes(1);

    await drainCatalogLookupQueue({
      now: at(CATALOG_LOOKUP_QUEUE_BASE_BACKOFF_MS),
      lookup: h.lookupBarcode,
    });
    expect(storedEnvelope().items[0]).toMatchObject({
      attemptCount: 2,
      nextAttemptAt: at(CATALOG_LOOKUP_QUEUE_BASE_BACKOFF_MS * 3).toISOString(),
    });

    await expect(
      drainCatalogLookupQueue({ now: at(CATALOG_LOOKUP_QUEUE_TTL_MS), lookup: h.lookupBarcode }),
    ).resolves.toMatchObject({
      attempted: 0,
      expired: 1,
      remaining: 0,
      nextRetryAt: null,
      nextExpiryAt: null,
    });
    expect(h.lookupBarcode).toHaveBeenCalledTimes(2);
    expect(h.storage.has(CATALOG_LOOKUP_QUEUE_KEY)).toBe(false);
  });

  it('caps repeated retry delay at twenty-four hours', async () => {
    await enqueueCatalogLookup({
      ownerUserId: 'owner-a',
      barcode: '012345678905',
      now: BASE,
    });
    let attemptAt = BASE;
    const observedDelays: number[] = [];

    for (let attempt = 0; attempt < 15; attempt += 1) {
      await drainCatalogLookupQueue({ now: attemptAt, lookup: h.lookupBarcode });
      const nextAttemptAt = storedEnvelope().items[0]?.nextAttemptAt;
      expect(typeof nextAttemptAt).toBe('string');
      const nextAttemptMs = Date.parse(nextAttemptAt as string);
      observedDelays.push(nextAttemptMs - attemptAt.getTime());
      attemptAt = new Date(nextAttemptMs);
    }

    expect(Math.max(...observedDelays)).toBe(CATALOG_LOOKUP_QUEUE_MAX_BACKOFF_MS);
    expect(observedDelays.every((delay) => delay <= CATALOG_LOOKUP_QUEUE_MAX_BACKOFF_MS)).toBe(
      true,
    );
  });

  it('bounds queue cardinality and lets expiry reclaim capacity', async () => {
    for (let index = 0; index < CATALOG_LOOKUP_QUEUE_MAX_ITEMS; index += 1) {
      await enqueueCatalogLookup({
        ownerUserId: 'owner-a',
        barcode: gtin(String(10_000_000_000 + index)),
        now: BASE,
      });
    }
    await expect(
      enqueueCatalogLookup({
        ownerUserId: 'owner-a',
        barcode: CAPACITY_BARCODE,
        now: BASE,
      }),
    ).rejects.toThrow(CATALOG_LOOKUP_QUEUE_FULL);

    await expect(
      enqueueCatalogLookup({
        ownerUserId: 'owner-a',
        barcode: CAPACITY_BARCODE,
        now: at(CATALOG_LOOKUP_QUEUE_TTL_MS),
      }),
    ).resolves.toEqual({ barcode: CAPACITY_BARCODE, enqueued: true });
    expect(storedEnvelope().items).toHaveLength(1);
  });

  it('persists only a bounded reviewed matched candidate and preserves Shelf binding', async () => {
    await enqueueCatalogLookup({
      ownerUserId: 'owner-a',
      barcode: '012345678905',
      shelfProductId: 'shelf-1',
      now: BASE,
    });
    h.lookupBarcode.mockResolvedValueOnce(matched());

    await expect(
      drainCatalogLookupQueue({ now: BASE, lookup: h.lookupBarcode }),
    ).resolves.toMatchObject({ attempted: 1, ready: 1, resolved: 0, remaining: 1 });
    await expect(readReadyCatalogLookups(BASE)).resolves.toMatchObject([
      {
        barcode: '012345678905',
        shelfProductId: 'shelf-1',
        candidate: {
          productId: PRODUCT_ID,
          catalogSourceId: SOURCE_ID,
          qualityGrade: 'verified',
          reviewStatus: 'reviewed',
        },
      },
    ]);
    const persisted = h.storage.get(CATALOG_LOOKUP_QUEUE_KEY) ?? '';
    expect(persisted).not.toContain('sensitive raw ingredient text');
    expect(persisted).not.toContain('rawIngredientsText');

    await expect(
      bindCatalogLookupToShelfProduct({
        ownerUserId: 'owner-a',
        barcode: '012345678905',
        shelfProductId: 'shelf-2',
        now: BASE,
      }),
    ).resolves.toBe(false);
    await expect(readReadyCatalogLookups(BASE)).resolves.toMatchObject([
      { shelfProductId: 'shelf-1' },
    ]);
    await expect(
      bindCatalogLookupToShelfProduct({
        ownerUserId: 'owner-a',
        barcode: '012345678905',
        shelfProductId: 'shelf-1',
        now: BASE,
      }),
    ).resolves.toBe(true);
  });

  it('treats malformed or unreviewed matches as transient and never makes them ready', async () => {
    await Promise.all([
      enqueueCatalogLookup({
        ownerUserId: 'owner-a',
        barcode: '012345678905',
        now: BASE,
      }),
      enqueueCatalogLookup({
        ownerUserId: 'owner-a',
        barcode: SECOND_BARCODE,
        now: BASE,
      }),
    ]);
    h.lookupBarcode.mockImplementation(async (barcode: string) =>
      barcode === '012345678905'
        ? ({
            result: 'matched',
            product: product(barcode, { review_status: 'pending' }),
          } satisfies CatalogLookupResponse)
        : ({
            result: 'external_candidate',
            product: product(barcode),
          } satisfies CatalogLookupResponse),
    );

    await expect(
      drainCatalogLookupQueue({ now: BASE, lookup: h.lookupBarcode }),
    ).resolves.toMatchObject({ attempted: 2, ready: 0, deferred: 2, remaining: 2 });
    await expect(readReadyCatalogLookups(BASE)).resolves.toEqual([]);
    expect(storedEnvelope().items.every((item) => item.state === 'pending')).toBe(true);
  });

  it('resolves no-match and too-short outcomes instead of retrying forever', async () => {
    await Promise.all([
      enqueueCatalogLookup({
        ownerUserId: 'owner-a',
        barcode: '012345678905',
        now: BASE,
      }),
      enqueueCatalogLookup({
        ownerUserId: 'owner-a',
        barcode: SECOND_BARCODE,
        now: BASE,
      }),
    ]);
    h.lookupBarcode.mockImplementation(async (barcode: string) =>
      barcode === '012345678905'
        ? { result: 'no_match', manualFallback: true }
        : { result: 'too_short' },
    );

    await expect(
      drainCatalogLookupQueue({ now: BASE, lookup: h.lookupBarcode }),
    ).resolves.toMatchObject({ attempted: 2, resolved: 2, deferred: 0, remaining: 0 });
    expect(h.storage.has(CATALOG_LOOKUP_QUEUE_KEY)).toBe(false);
  });

  it('physically purges expired bytes during ready reads and schedule maintenance', async () => {
    await enqueueCatalogLookup({
      ownerUserId: 'owner-a',
      barcode: '012345678905',
      now: BASE,
    });
    h.lookupBarcode.mockResolvedValueOnce(matched());
    await drainCatalogLookupQueue({ now: BASE, lookup: h.lookupBarcode });
    expect(h.storage.get(CATALOG_LOOKUP_QUEUE_KEY)).toContain('012345678905');

    await expect(readReadyCatalogLookups(at(CATALOG_LOOKUP_QUEUE_TTL_MS))).resolves.toEqual([]);
    expect(h.storage.has(CATALOG_LOOKUP_QUEUE_KEY)).toBe(false);

    await enqueueCatalogLookup({
      ownerUserId: 'owner-a',
      barcode: SECOND_BARCODE,
      now: at(CATALOG_LOOKUP_QUEUE_TTL_MS + 1),
    });
    await expect(
      maintainCatalogLookupQueue(at(CATALOG_LOOKUP_QUEUE_TTL_MS + 1)),
    ).resolves.toMatchObject({
      expired: 0,
      remaining: 1,
      nextRetryAt: at(CATALOG_LOOKUP_QUEUE_TTL_MS + 1).toISOString(),
      nextExpiryAt: at(CATALOG_LOOKUP_QUEUE_TTL_MS * 2 + 1).toISOString(),
    });
  });

  it('purges expired export bytes under an account lease without health admission', async () => {
    await enqueueCatalogLookup({
      ownerUserId: 'owner-a',
      barcode: '012345678905',
      now: BASE,
    });
    h.ownerUserId = null;
    const accountLease = {
      generation: 1,
      signal: new AbortController().signal,
      assertCurrent: vi.fn(),
    };

    await expect(
      purgeExpiredCatalogLookupQueueForPurposeLimitedExport(
        accountLease,
        'owner-a',
        at(CATALOG_LOOKUP_QUEUE_TTL_MS),
      ),
    ).resolves.toMatchObject({ expired: 1, remaining: 0 });
    expect(accountLease.assertCurrent).toHaveBeenCalled();
    expect(h.storage.has(CATALOG_LOOKUP_QUEUE_KEY)).toBe(false);
  });

  it('removes foreign-owner queue residue before a purpose-limited export read', async () => {
    await enqueueCatalogLookup({
      ownerUserId: 'owner-a',
      barcode: '012345678905',
      now: BASE,
    });
    const ownerA = storedEnvelope().items[0]!;
    h.storage.set(
      CATALOG_LOOKUP_QUEUE_KEY,
      JSON.stringify({
        version: 1,
        items: [
          ownerA,
          {
            ...ownerA,
            ownerUserId: 'owner-b',
            barcode: SECOND_BARCODE,
          },
        ],
      }),
    );
    const accountLease = {
      generation: 1,
      signal: new AbortController().signal,
      assertCurrent: vi.fn(),
    };

    await expect(
      purgeExpiredCatalogLookupQueueForPurposeLimitedExport(accountLease, 'owner-a', BASE),
    ).resolves.toMatchObject({ expired: 0, remaining: 1 });

    expect(storedEnvelope().items).toEqual([expect.objectContaining({ ownerUserId: 'owner-a' })]);
    expect(h.storage.get(CATALOG_LOOKUP_QUEUE_KEY)).not.toContain('owner-b');
    expect(accountLease.assertCurrent).toHaveBeenCalled();
  });

  it('preserves validated live queue records for a verified unclaimed local export', async () => {
    await enqueueCatalogLookup({
      ownerUserId: 'owner-a',
      barcode: '012345678905',
      now: BASE,
    });
    const accountLease = {
      generation: 1,
      signal: new AbortController().signal,
      assertCurrent: vi.fn(),
    };

    await expect(
      purgeExpiredCatalogLookupQueueForPurposeLimitedExport(accountLease, null, BASE),
    ).resolves.toMatchObject({ expired: 0, remaining: 1 });

    expect(storedEnvelope().items).toEqual([expect.objectContaining({ ownerUserId: 'owner-a' })]);
    expect(h.storage.get(CATALOG_LOOKUP_QUEUE_KEY)).toContain('012345678905');
  });

  it('serializes concurrent drains so one barcode is not sent twice', async () => {
    await enqueueCatalogLookup({
      ownerUserId: 'owner-a',
      barcode: '012345678905',
      now: BASE,
    });
    let resolveLookup!: (response: CatalogLookupResponse) => void;
    h.lookupBarcode.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLookup = resolve;
      }),
    );

    const first = drainCatalogLookupQueue({ now: BASE, lookup: h.lookupBarcode });
    const second = drainCatalogLookupQueue({ now: BASE, lookup: h.lookupBarcode });
    expect(second).toBe(first);
    await vi.waitFor(() => expect(h.lookupBarcode).toHaveBeenCalledOnce());
    resolveLookup(matched());
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(h.lookupBarcode).toHaveBeenCalledOnce();
  });

  it('starts a fresh drain after a same-owner lease regrant', async () => {
    await enqueueCatalogLookup({
      ownerUserId: 'owner-a',
      barcode: '012345678905',
      now: BASE,
    });
    let resolveFirst!: (response: CatalogLookupResponse) => void;
    h.lookupBarcode
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce({ result: 'offline', manualFallback: true });

    const staleDrain = drainCatalogLookupQueue({ now: BASE, lookup: h.lookupBarcode });
    await vi.waitFor(() => expect(h.lookupBarcode).toHaveBeenCalledOnce());
    h.generation += 1;
    const currentDrain = drainCatalogLookupQueue({ now: BASE, lookup: h.lookupBarcode });

    expect(currentDrain).not.toBe(staleDrain);
    await expect(currentDrain).resolves.toMatchObject({ attempted: 1, deferred: 1 });
    expect(h.lookupBarcode).toHaveBeenCalledTimes(2);
    resolveFirst(matched());
    await expect(staleDrain).rejects.toThrow(ADMISSION_CLOSED);
  });

  it('accepts or rejects only the exact ready product and performs no Shelf mutation', async () => {
    await enqueueCatalogLookup({
      ownerUserId: 'owner-a',
      barcode: '012345678905',
      shelfProductId: 'shelf-1',
      now: BASE,
    });
    h.lookupBarcode.mockResolvedValueOnce(matched());
    await drainCatalogLookupQueue({ now: BASE, lookup: h.lookupBarcode });

    await expect(
      acceptReadyCatalogLookup({
        barcode: '012345678905',
        productId: '30000000-0000-4000-8000-000000000003',
        expectedShelfProductId: 'shelf-1',
        now: BASE,
      }),
    ).resolves.toBeNull();
    await expect(readReadyCatalogLookups(BASE)).resolves.toHaveLength(1);
    await expect(
      acceptReadyCatalogLookup({
        barcode: '012345678905',
        productId: PRODUCT_ID,
        expectedShelfProductId: 'shelf-1',
        now: BASE,
      }),
    ).resolves.toMatchObject({
      shelfProductId: 'shelf-1',
      candidate: { productId: PRODUCT_ID },
    });
    await expect(readReadyCatalogLookups(BASE)).resolves.toEqual([]);

    await enqueueCatalogLookup({
      ownerUserId: 'owner-a',
      barcode: SECOND_BARCODE,
      now: at(1),
    });
    h.lookupBarcode.mockResolvedValueOnce(matched(SECOND_BARCODE));
    await drainCatalogLookupQueue({ now: at(1), lookup: h.lookupBarcode });
    await expect(
      rejectReadyCatalogLookup({
        barcode: SECOND_BARCODE,
        productId: PRODUCT_ID,
        expectedShelfProductId: null,
        now: at(1),
      }),
    ).resolves.toBe(true);
    expect(h.storage.has(CATALOG_LOOKUP_QUEUE_KEY)).toBe(false);

    const source = readFileSync(QUEUE_SOURCE, 'utf8');
    expect(source).not.toMatch(/from ['"]@\/features\/shelf\//u);
    expect(source).not.toContain('updateShelf');
  });

  it('fails closed when a stale caller omits the expected Shelf binding', async () => {
    await enqueueCatalogLookup({
      ownerUserId: 'owner-a',
      barcode: '012345678905',
      shelfProductId: 'shelf-1',
      now: BASE,
    });
    h.lookupBarcode.mockResolvedValueOnce(matched());
    await drainCatalogLookupQueue({ now: BASE, lookup: h.lookupBarcode });

    await expect(
      acceptReadyCatalogLookup({
        barcode: '012345678905',
        productId: PRODUCT_ID,
        now: BASE,
      } as Parameters<typeof acceptReadyCatalogLookup>[0]),
    ).rejects.toThrow(CATALOG_LOOKUP_QUEUE_INVALID_SHELF_PRODUCT);
    await expect(
      rejectReadyCatalogLookup({
        barcode: '012345678905',
        productId: PRODUCT_ID,
        now: BASE,
      } as Parameters<typeof rejectReadyCatalogLookup>[0]),
    ).rejects.toThrow(CATALOG_LOOKUP_QUEUE_INVALID_SHELF_PRODUCT);
    await expect(readReadyCatalogLookups(BASE)).resolves.toMatchObject([
      { shelfProductId: 'shelf-1', candidate: { productId: PRODUCT_ID } },
    ]);
  });

  it('does not consume a candidate whose Shelf binding changed after review began', async () => {
    await enqueueCatalogLookup({
      ownerUserId: 'owner-a',
      barcode: '012345678905',
      now: BASE,
    });
    h.lookupBarcode.mockResolvedValueOnce(matched());
    await drainCatalogLookupQueue({ now: BASE, lookup: h.lookupBarcode });
    await expect(readReadyCatalogLookups(BASE)).resolves.toMatchObject([{ shelfProductId: null }]);

    await expect(
      bindCatalogLookupToShelfProduct({
        ownerUserId: 'owner-a',
        barcode: '012345678905',
        shelfProductId: 'shelf-concurrent',
        now: BASE,
      }),
    ).resolves.toBe(true);
    await expect(
      rejectReadyCatalogLookup({
        barcode: '012345678905',
        productId: PRODUCT_ID,
        expectedShelfProductId: null,
        now: BASE,
      }),
    ).resolves.toBe(false);
    await expect(
      acceptReadyCatalogLookup({
        barcode: '012345678905',
        productId: PRODUCT_ID,
        expectedShelfProductId: null,
        now: BASE,
      }),
    ).resolves.toBeNull();
    await expect(readReadyCatalogLookups(BASE)).resolves.toMatchObject([
      { shelfProductId: 'shelf-concurrent' },
    ]);
  });

  it('requires an unbound candidate before accepting after a new Shelf save', async () => {
    await enqueueCatalogLookup({
      ownerUserId: 'owner-a',
      barcode: '012345678905',
      shelfProductId: 'shelf-existing',
      now: BASE,
    });
    h.lookupBarcode.mockResolvedValueOnce(matched());
    await drainCatalogLookupQueue({ now: BASE, lookup: h.lookupBarcode });

    await expect(
      acceptReadyCatalogLookupAfterShelfSave({
        ownerUserId: 'owner-a',
        barcode: '012345678905',
        productId: PRODUCT_ID,
        shelfProductId: 'shelf-new',
        now: BASE,
      }),
    ).resolves.toBeNull();
    await expect(readReadyCatalogLookups(BASE)).resolves.toMatchObject([
      { shelfProductId: 'shelf-existing' },
    ]);
  });

  it('atomically binds and consumes only the exact candidate after a Shelf add', async () => {
    await enqueueCatalogLookup({
      ownerUserId: 'owner-a',
      barcode: '012345678905',
      now: BASE,
    });
    h.lookupBarcode.mockResolvedValueOnce(matched());
    await drainCatalogLookupQueue({ now: BASE, lookup: h.lookupBarcode });

    await expect(
      acceptReadyCatalogLookupAfterShelfSave({
        ownerUserId: 'owner-a',
        barcode: '012345678905',
        productId: '30000000-0000-4000-8000-000000000003',
        shelfProductId: 'shelf-after-add',
        now: BASE,
      }),
    ).resolves.toBeNull();
    await expect(readReadyCatalogLookups(BASE)).resolves.toMatchObject([
      { shelfProductId: null, candidate: { productId: PRODUCT_ID } },
    ]);

    await expect(
      acceptReadyCatalogLookupAfterShelfSave({
        ownerUserId: 'owner-a',
        barcode: '012345678905',
        productId: PRODUCT_ID,
        shelfProductId: 'shelf-after-add',
        now: BASE,
      }),
    ).resolves.toMatchObject({
      shelfProductId: 'shelf-after-add',
      candidate: { productId: PRODUCT_ID },
    });
    expect(h.storage.has(CATALOG_LOOKUP_QUEUE_KEY)).toBe(false);
  });
});
