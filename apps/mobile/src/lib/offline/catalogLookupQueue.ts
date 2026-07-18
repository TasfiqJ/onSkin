import {
  lookupBarcode,
  type CatalogLookupResponse,
  type CatalogProductSummary,
} from '@/features/catalog/client';
import { normalizeScannedBarcode } from '@/features/native/camera/barcode';
import type { AccountGenerationLease } from '@/lib/auth/accountGeneration';
import {
  captureHealthDataWriteLease,
  runCurrentHealthDataOperation,
  runHealthDataOperation,
} from '@/lib/consent/healthDataWriteAdmission';
import {
  getPrivateItem,
  updateCatalogLookupQueueForPurposeLimitedExport,
  updatePrivateItem,
} from '@/lib/storage/privateKV';

/**
 * An encrypted, account-bound recovery queue for barcode lookups that could not
 * finish while the device was offline. A successful lookup is deliberately
 * retained only as a small reviewed candidate. This module never imports or
 * mutates the Shelf store: a later user-confirmation surface must explicitly
 * accept a candidate before deciding which Shelf fields to change.
 */
export const CATALOG_LOOKUP_QUEUE_KEY = 'routinekind.catalog.lookupQueue.v1';
const SCHEMA_VERSION = 1 as const;

export const CATALOG_LOOKUP_QUEUE_INVALID = 'CATALOG_LOOKUP_QUEUE_INVALID';
export const CATALOG_LOOKUP_QUEUE_UNSUPPORTED_VERSION = 'CATALOG_LOOKUP_QUEUE_UNSUPPORTED_VERSION';
export const CATALOG_LOOKUP_QUEUE_INVALID_BARCODE = 'CATALOG_LOOKUP_QUEUE_INVALID_BARCODE';
export const CATALOG_LOOKUP_QUEUE_INVALID_OWNER = 'CATALOG_LOOKUP_QUEUE_INVALID_OWNER';
export const CATALOG_LOOKUP_QUEUE_INVALID_SHELF_PRODUCT =
  'CATALOG_LOOKUP_QUEUE_INVALID_SHELF_PRODUCT';
export const CATALOG_LOOKUP_QUEUE_FULL = 'CATALOG_LOOKUP_QUEUE_FULL';

export const CATALOG_LOOKUP_QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
export const CATALOG_LOOKUP_QUEUE_BASE_BACKOFF_MS = 30_000;
export const CATALOG_LOOKUP_QUEUE_MAX_BACKOFF_MS = 24 * 60 * 60 * 1_000;
export const CATALOG_LOOKUP_QUEUE_MAX_ITEMS = 64;
export const CATALOG_LOOKUP_QUEUE_MAX_ATTEMPTS_PER_DRAIN = 8;

const MAX_RECORDED_ATTEMPTS = 31;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;
const FORMATTED_BARCODE_PATTERN = /^[0-9 -]+$/;

const ENVELOPE_KEYS = new Set(['version', 'items']);
const ITEM_KEYS = new Set([
  'ownerUserId',
  'barcode',
  'shelfProductId',
  'state',
  'enqueuedAt',
  'expiresAt',
  'attemptCount',
  'nextAttemptAt',
  'lastAttemptAt',
  'candidate',
]);
const CANDIDATE_KEYS = new Set([
  'productId',
  'barcode',
  'name',
  'brand',
  'category',
  'catalogSourceId',
  'sourceKey',
  'sourceDisplayName',
  'qualityGrade',
  'reviewStatus',
  'matchedAt',
]);

export type CatalogLookupCandidate = Readonly<{
  productId: string;
  barcode: string;
  name: string;
  brand: string | null;
  category: string | null;
  catalogSourceId: string;
  sourceKey: string;
  sourceDisplayName: string | null;
  qualityGrade: 'verified' | 'usable';
  reviewStatus: 'reviewed';
  matchedAt: string;
}>;

type CatalogLookupQueueItem = {
  ownerUserId: string;
  barcode: string;
  shelfProductId: string | null;
  state: 'pending' | 'ready';
  enqueuedAt: string;
  expiresAt: string;
  attemptCount: number;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  candidate: CatalogLookupCandidate | null;
};

type CatalogLookupQueueEnvelope = {
  version: typeof SCHEMA_VERSION;
  items: CatalogLookupQueueItem[];
};

export type ReadyCatalogLookup = Readonly<{
  barcode: string;
  shelfProductId: string | null;
  enqueuedAt: string;
  expiresAt: string;
  candidate: CatalogLookupCandidate;
}>;

export type CatalogLookupQueueDrainResult = Readonly<{
  attempted: number;
  ready: number;
  resolved: number;
  deferred: number;
  expired: number;
  remaining: number;
  nextRetryAt: string | null;
  nextExpiryAt: string | null;
}>;

export type CatalogLookupQueueSchedule = Readonly<{
  expired: number;
  remaining: number;
  nextRetryAt: string | null;
  nextExpiryAt: string | null;
}>;

export type CatalogLookupExecutor = (barcode: string) => Promise<CatalogLookupResponse>;

type CatalogLookupQueueChangeListener = () => void;
const queueChangeListeners = new Set<CatalogLookupQueueChangeListener>();

export function subscribeCatalogLookupQueueChanges(
  listener: CatalogLookupQueueChangeListener,
): () => void {
  queueChangeListeners.add(listener);
  return () => queueChangeListeners.delete(listener);
}

function publishCatalogLookupQueueChange(): void {
  for (const listener of queueChangeListeners) listener();
}

type DrainOutcome =
  | { kind: 'ready'; candidate: CatalogLookupCandidate }
  | { kind: 'resolved' }
  | { kind: 'retry' };

function queueError(code: string): Error {
  return new Error(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: ReadonlySet<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== 24) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function validNow(now: Date): number {
  const milliseconds = now.getTime();
  if (!Number.isFinite(milliseconds)) throw queueError(CATALOG_LOOKUP_QUEUE_INVALID);
  return milliseconds;
}

function isOpaqueId(value: unknown): value is string {
  return typeof value === 'string' && OPAQUE_ID_PATTERN.test(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isBoundedCanonicalString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength &&
    value.trim() === value
  );
}

function isBoundedNullableCanonicalString(
  value: unknown,
  maxLength: number,
): value is string | null {
  return value === null || isBoundedCanonicalString(value, maxLength);
}

/**
 * Canonicalize an already-decoded catalog barcode. Camera callers should pass
 * their normalized lookup value (for example, expanded UPC-E), not raw frames.
 */
export function normalizeCatalogLookupBarcode(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || !FORMATTED_BARCODE_PATTERN.test(trimmed)) return null;
  const canonical = trimmed.replace(/[ -]/g, '');
  const normalized = normalizeScannedBarcode(canonical);
  return normalized?.validChecksum === true && normalized.lookupValue === canonical
    ? canonical
    : null;
}

function decodeCandidate(value: unknown, expectedBarcode: string): CatalogLookupCandidate | null {
  if (!isRecord(value) || !hasExactKeys(value, CANDIDATE_KEYS)) return null;
  if (
    !isUuid(value.productId) ||
    value.barcode !== expectedBarcode ||
    normalizeCatalogLookupBarcode(value.barcode) !== value.barcode ||
    !isBoundedCanonicalString(value.name, 200) ||
    !isBoundedNullableCanonicalString(value.brand, 200) ||
    !isBoundedNullableCanonicalString(value.category, 100) ||
    !isUuid(value.catalogSourceId) ||
    !isBoundedCanonicalString(value.sourceKey, 100) ||
    !isBoundedNullableCanonicalString(value.sourceDisplayName, 200) ||
    (value.qualityGrade !== 'verified' && value.qualityGrade !== 'usable') ||
    value.reviewStatus !== 'reviewed' ||
    !isCanonicalTimestamp(value.matchedAt)
  ) {
    return null;
  }
  return value as CatalogLookupCandidate;
}

function decodeItem(value: unknown): CatalogLookupQueueItem | null {
  if (!isRecord(value) || !hasExactKeys(value, ITEM_KEYS)) return null;
  if (
    !isOpaqueId(value.ownerUserId) ||
    typeof value.barcode !== 'string' ||
    normalizeCatalogLookupBarcode(value.barcode) !== value.barcode ||
    (value.shelfProductId !== null && !isOpaqueId(value.shelfProductId)) ||
    !isCanonicalTimestamp(value.enqueuedAt) ||
    !isCanonicalTimestamp(value.expiresAt) ||
    typeof value.attemptCount !== 'number' ||
    !Number.isInteger(value.attemptCount) ||
    value.attemptCount < 0 ||
    value.attemptCount > MAX_RECORDED_ATTEMPTS ||
    (value.lastAttemptAt !== null && !isCanonicalTimestamp(value.lastAttemptAt))
  ) {
    return null;
  }

  const enqueuedMs = Date.parse(value.enqueuedAt);
  const expiresMs = Date.parse(value.expiresAt);
  if (expiresMs <= enqueuedMs || expiresMs - enqueuedMs > CATALOG_LOOKUP_QUEUE_TTL_MS) {
    return null;
  }
  if (
    value.lastAttemptAt !== null &&
    (Date.parse(value.lastAttemptAt) < enqueuedMs || Date.parse(value.lastAttemptAt) > expiresMs)
  ) {
    return null;
  }

  if (value.state === 'pending') {
    if (
      !isCanonicalTimestamp(value.nextAttemptAt) ||
      Date.parse(value.nextAttemptAt) < enqueuedMs ||
      Date.parse(value.nextAttemptAt) > expiresMs ||
      value.candidate !== null
    ) {
      return null;
    }
  } else if (value.state === 'ready') {
    const candidate = decodeCandidate(value.candidate, value.barcode);
    if (
      value.nextAttemptAt !== null ||
      value.lastAttemptAt === null ||
      candidate === null ||
      candidate.matchedAt !== value.lastAttemptAt
    ) {
      return null;
    }
  } else {
    return null;
  }

  return value as CatalogLookupQueueItem;
}

function decodeQueue(raw: string | null): CatalogLookupQueueItem[] {
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw queueError(CATALOG_LOOKUP_QUEUE_INVALID);
  }
  if (!isRecord(parsed) || !hasExactKeys(parsed, ENVELOPE_KEYS)) {
    throw queueError(CATALOG_LOOKUP_QUEUE_INVALID);
  }
  if (parsed.version !== SCHEMA_VERSION) {
    if (
      typeof parsed.version === 'number' &&
      Number.isSafeInteger(parsed.version) &&
      parsed.version > SCHEMA_VERSION
    ) {
      throw queueError(CATALOG_LOOKUP_QUEUE_UNSUPPORTED_VERSION);
    }
    throw queueError(CATALOG_LOOKUP_QUEUE_INVALID);
  }
  if (!Array.isArray(parsed.items) || parsed.items.length > CATALOG_LOOKUP_QUEUE_MAX_ITEMS) {
    throw queueError(CATALOG_LOOKUP_QUEUE_INVALID);
  }

  const decoded: CatalogLookupQueueItem[] = [];
  const keys = new Set<string>();
  for (const value of parsed.items) {
    const item = decodeItem(value);
    if (item === null) throw queueError(CATALOG_LOOKUP_QUEUE_INVALID);
    const key = itemKey(item.ownerUserId, item.barcode);
    if (keys.has(key)) throw queueError(CATALOG_LOOKUP_QUEUE_INVALID);
    keys.add(key);
    decoded.push(item);
  }
  return decoded;
}

function encodeQueue(items: CatalogLookupQueueItem[]): string {
  return JSON.stringify({ version: SCHEMA_VERSION, items } satisfies CatalogLookupQueueEnvelope);
}

function encodeQueueOrRemove(items: CatalogLookupQueueItem[]): string | null {
  return items.length === 0 ? null : encodeQueue(items);
}

function itemKey(ownerUserId: string, barcode: string): string {
  return `${ownerUserId}\u0000${barcode}`;
}

function ownedLiveItems(
  items: CatalogLookupQueueItem[],
  ownerUserId: string,
  nowMs: number,
): CatalogLookupQueueItem[] {
  return items.filter(
    (item) => item.ownerUserId === ownerUserId && Date.parse(item.expiresAt) > nowMs,
  );
}

function earliestTimestamp(values: (string | null)[]): string | null {
  let earliest: string | null = null;
  let earliestMs = Number.POSITIVE_INFINITY;
  for (const value of values) {
    if (value === null) continue;
    const milliseconds = Date.parse(value);
    if (milliseconds < earliestMs) {
      earliest = value;
      earliestMs = milliseconds;
    }
  }
  return earliest;
}

function queueSchedule(
  items: CatalogLookupQueueItem[],
  expired: number,
): CatalogLookupQueueSchedule {
  return {
    expired,
    remaining: items.length,
    nextRetryAt: earliestTimestamp(
      items.map((item) => (item.state === 'pending' ? item.nextAttemptAt : null)),
    ),
    nextExpiryAt: earliestTimestamp(items.map((item) => item.expiresAt)),
  };
}

function toReady(item: CatalogLookupQueueItem): ReadyCatalogLookup | null {
  if (item.state !== 'ready' || item.candidate === null) return null;
  return {
    barcode: item.barcode,
    shelfProductId: item.shelfProductId,
    enqueuedAt: item.enqueuedAt,
    expiresAt: item.expiresAt,
    candidate: { ...item.candidate },
  };
}

function normalizedNullableProductString(value: unknown, maxLength: number): string | null | false {
  if (value === null) return null;
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : false;
}

function reviewedCandidate(
  product: CatalogProductSummary,
  expectedBarcode: string,
  matchedAt: string,
): CatalogLookupCandidate | null {
  const barcode =
    typeof product.barcode === 'string' ? normalizeCatalogLookupBarcode(product.barcode) : null;
  const name = typeof product.name === 'string' ? product.name.trim() : '';
  const brand = normalizedNullableProductString(product.brand, 200);
  const category = normalizedNullableProductString(product.category, 100);
  const sourceKey = typeof product.source === 'string' ? product.source.trim() : '';
  const source = product.catalog_sources;
  const sourceDisplayName = normalizedNullableProductString(source?.display_name ?? null, 200);
  if (
    barcode !== expectedBarcode ||
    !isUuid(product.id) ||
    !name ||
    name.length > 200 ||
    brand === false ||
    category === false ||
    !isUuid(product.catalog_source_id) ||
    !sourceKey ||
    sourceKey.length > 100 ||
    !isRecord(source) ||
    source.id !== product.catalog_source_id ||
    source.source_key !== sourceKey ||
    sourceDisplayName === false ||
    (product.quality_grade !== 'verified' && product.quality_grade !== 'usable') ||
    product.review_status !== 'reviewed'
  ) {
    return null;
  }

  return {
    productId: product.id,
    barcode,
    name,
    brand,
    category,
    catalogSourceId: product.catalog_source_id,
    sourceKey,
    sourceDisplayName,
    qualityGrade: product.quality_grade,
    reviewStatus: 'reviewed',
    matchedAt,
  };
}

function backoffMs(attemptCount: number): number {
  const exponent = Math.max(0, Math.min(attemptCount - 1, MAX_RECORDED_ATTEMPTS - 1));
  return Math.min(
    CATALOG_LOOKUP_QUEUE_BASE_BACKOFF_MS * 2 ** exponent,
    CATALOG_LOOKUP_QUEUE_MAX_BACKOFF_MS,
  );
}

function nextAttemptCount(previous: number): number {
  return Math.min(previous + 1, MAX_RECORDED_ATTEMPTS);
}

function normalizedOwner(ownerUserId: string): string {
  if (!isOpaqueId(ownerUserId)) throw queueError(CATALOG_LOOKUP_QUEUE_INVALID_OWNER);
  return ownerUserId;
}

function normalizedShelfProductId(shelfProductId: string | null | undefined): string | null {
  if (shelfProductId === null || shelfProductId === undefined) return null;
  if (!isOpaqueId(shelfProductId)) {
    throw queueError(CATALOG_LOOKUP_QUEUE_INVALID_SHELF_PRODUCT);
  }
  return shelfProductId;
}

export async function enqueueCatalogLookup(input: {
  ownerUserId: string;
  barcode: string;
  shelfProductId?: string | null;
  now?: Date;
}): Promise<{ barcode: string; enqueued: boolean }> {
  const ownerUserId = normalizedOwner(input.ownerUserId);
  const barcode = normalizeCatalogLookupBarcode(input.barcode);
  if (barcode === null) throw queueError(CATALOG_LOOKUP_QUEUE_INVALID_BARCODE);
  const shelfProductId = normalizedShelfProductId(input.shelfProductId);
  const nowMs = validNow(input.now ?? new Date());
  const enqueuedAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + CATALOG_LOOKUP_QUEUE_TTL_MS).toISOString();
  let enqueued = false;

  await runHealthDataOperation(ownerUserId, async (lease) => {
    lease.assertCurrent();
    await updatePrivateItem(CATALOG_LOOKUP_QUEUE_KEY, (current) => {
      const items = ownedLiveItems(decodeQueue(current), ownerUserId, nowMs);
      const existingIndex = items.findIndex((item) => item.barcode === barcode);
      if (existingIndex >= 0) {
        const existing = items[existingIndex]!;
        if (existing.shelfProductId === null && shelfProductId !== null) {
          items[existingIndex] = { ...existing, shelfProductId };
        }
        return encodeQueue(items);
      }
      if (items.length >= CATALOG_LOOKUP_QUEUE_MAX_ITEMS) {
        throw queueError(CATALOG_LOOKUP_QUEUE_FULL);
      }
      items.push({
        ownerUserId,
        barcode,
        shelfProductId,
        state: 'pending',
        enqueuedAt,
        expiresAt,
        attemptCount: 0,
        nextAttemptAt: enqueuedAt,
        lastAttemptAt: null,
        candidate: null,
      });
      enqueued = true;
      return encodeQueue(items);
    });
    lease.assertCurrent();
  });
  publishCatalogLookupQueueChange();
  return { barcode, enqueued };
}

/** Bind an unbound lookup, or confirm the same binding, without allowing rebinding. */
export async function bindCatalogLookupToShelfProduct(input: {
  ownerUserId: string;
  barcode: string;
  shelfProductId: string | null;
  now?: Date;
}): Promise<boolean> {
  const ownerUserId = normalizedOwner(input.ownerUserId);
  const barcode = normalizeCatalogLookupBarcode(input.barcode);
  if (barcode === null) throw queueError(CATALOG_LOOKUP_QUEUE_INVALID_BARCODE);
  const shelfProductId = normalizedShelfProductId(input.shelfProductId);
  const nowMs = validNow(input.now ?? new Date());
  let bound = false;

  await runHealthDataOperation(ownerUserId, async (lease) => {
    lease.assertCurrent();
    await updatePrivateItem(CATALOG_LOOKUP_QUEUE_KEY, (current) => {
      const items = ownedLiveItems(decodeQueue(current), ownerUserId, nowMs);
      return encodeQueueOrRemove(
        items.map((item) => {
          if (item.barcode !== barcode) return item;
          if (item.shelfProductId !== null && item.shelfProductId !== shelfProductId) return item;
          bound = true;
          return item.shelfProductId === shelfProductId ? item : { ...item, shelfProductId };
        }),
      );
    });
    lease.assertCurrent();
  });
  if (bound) publishCatalogLookupQueueChange();
  return bound;
}

export async function readReadyCatalogLookups(
  now: Date = new Date(),
): Promise<ReadyCatalogLookup[]> {
  const nowMs = validNow(now);
  return runCurrentHealthDataOperation(async (lease) => {
    let ready: ReadyCatalogLookup[] = [];
    lease.assertCurrent();
    await updatePrivateItem(CATALOG_LOOKUP_QUEUE_KEY, (current) => {
      const items = ownedLiveItems(decodeQueue(current), lease.ownerUserId, nowMs);
      ready = items.flatMap((item) => {
        const value = toReady(item);
        return value === null ? [] : [value];
      });
      return encodeQueueOrRemove(items);
    });
    lease.assertCurrent();
    return ready;
  });
}

/** Physically purge expired bytes and return the exact next retry/expiry schedule. */
export function maintainCatalogLookupQueue(
  now: Date = new Date(),
): Promise<CatalogLookupQueueSchedule> {
  const nowMs = validNow(now);
  return runCurrentHealthDataOperation(async (lease) => {
    let schedule: CatalogLookupQueueSchedule = queueSchedule([], 0);
    lease.assertCurrent();
    await updatePrivateItem(CATALOG_LOOKUP_QUEUE_KEY, (current) => {
      const decoded = decodeQueue(current);
      const owned = decoded.filter((item) => item.ownerUserId === lease.ownerUserId);
      const live = ownedLiveItems(decoded, lease.ownerUserId, nowMs);
      schedule = queueSchedule(
        live,
        owned.filter((item) => Date.parse(item.expiresAt) <= nowMs).length,
      );
      return encodeQueueOrRemove(live);
    });
    lease.assertCurrent();
    return schedule;
  });
}

/**
 * Reduce the queue to live records for the verified export owner before a data
 * export reads it. A null owner represents a verified unclaimed local store;
 * validated live local records remain eligible because no exact account owner
 * exists against which to classify them as foreign.
 */
export async function purgeExpiredCatalogLookupQueueForPurposeLimitedExport(
  accountLease: AccountGenerationLease,
  expectedUserId: string | null,
  now: Date = new Date(),
): Promise<CatalogLookupQueueSchedule> {
  accountLease.assertCurrent();
  const expectedOwnerUserId = expectedUserId === null ? null : normalizedOwner(expectedUserId);
  const nowMs = validNow(now);
  let schedule: CatalogLookupQueueSchedule = queueSchedule([], 0);
  await updateCatalogLookupQueueForPurposeLimitedExport(accountLease, (current) => {
    const decoded = decodeQueue(current);
    const owned =
      expectedOwnerUserId === null
        ? decoded
        : decoded.filter((item) => item.ownerUserId === expectedOwnerUserId);
    const live =
      expectedOwnerUserId === null
        ? owned.filter((item) => Date.parse(item.expiresAt) > nowMs)
        : ownedLiveItems(owned, expectedOwnerUserId, nowMs);
    schedule = queueSchedule(live, owned.length - live.length);
    return encodeQueueOrRemove(live);
  });
  accountLease.assertCurrent();
  return schedule;
}

async function consumeReadyCatalogLookup(
  input: {
    barcode: string;
    productId: string;
    expectedShelfProductId: string | null;
    now?: Date;
  },
  returnCandidate: boolean,
): Promise<ReadyCatalogLookup | boolean | null> {
  const barcode = normalizeCatalogLookupBarcode(input.barcode);
  if (barcode === null) throw queueError(CATALOG_LOOKUP_QUEUE_INVALID_BARCODE);
  if (!isUuid(input.productId)) throw queueError(CATALOG_LOOKUP_QUEUE_INVALID);
  if (input.expectedShelfProductId === undefined) {
    throw queueError(CATALOG_LOOKUP_QUEUE_INVALID_SHELF_PRODUCT);
  }
  const expectedShelfProductId = normalizedShelfProductId(input.expectedShelfProductId);
  const nowMs = validNow(input.now ?? new Date());

  const consumed = await runCurrentHealthDataOperation<ReadyCatalogLookup | null>(async (lease) => {
    let consumed: ReadyCatalogLookup | null = null;
    lease.assertCurrent();
    await updatePrivateItem(CATALOG_LOOKUP_QUEUE_KEY, (current) => {
      const items = ownedLiveItems(decodeQueue(current), lease.ownerUserId, nowMs);
      const next = items.filter((item) => {
        const ready = toReady(item);
        if (
          consumed === null &&
          ready !== null &&
          ready.barcode === barcode &&
          ready.candidate.productId === input.productId &&
          ready.shelfProductId === expectedShelfProductId
        ) {
          consumed = ready;
          return false;
        }
        return true;
      });
      return encodeQueueOrRemove(next);
    });
    lease.assertCurrent();
    return consumed;
  });
  if (consumed !== null) publishCatalogLookupQueueChange();
  return returnCandidate ? consumed : consumed !== null;
}

/**
 * Consume and return a reviewed candidate. No Shelf write occurs here; callers
 * must obtain user confirmation and perform that mutation separately.
 */
export async function acceptReadyCatalogLookup(input: {
  barcode: string;
  productId: string;
  expectedShelfProductId: string | null;
  now?: Date;
}): Promise<ReadyCatalogLookup | null> {
  return (await consumeReadyCatalogLookup(input, true)) as ReadyCatalogLookup | null;
}

/**
 * Atomically prove an exact reviewed candidate, bind it to the Shelf row that
 * has already committed, and consume it. A different candidate sharing the
 * barcode is left untouched and unbound.
 */
export async function acceptReadyCatalogLookupAfterShelfSave(input: {
  ownerUserId: string;
  barcode: string;
  productId: string;
  shelfProductId: string;
  now?: Date;
}): Promise<ReadyCatalogLookup | null> {
  const ownerUserId = normalizedOwner(input.ownerUserId);
  const barcode = normalizeCatalogLookupBarcode(input.barcode);
  if (barcode === null) throw queueError(CATALOG_LOOKUP_QUEUE_INVALID_BARCODE);
  if (!isUuid(input.productId)) throw queueError(CATALOG_LOOKUP_QUEUE_INVALID);
  const shelfProductId = normalizedShelfProductId(input.shelfProductId);
  if (shelfProductId === null) throw queueError(CATALOG_LOOKUP_QUEUE_INVALID_SHELF_PRODUCT);
  const nowMs = validNow(input.now ?? new Date());

  const consumed = await runHealthDataOperation<ReadyCatalogLookup | null>(
    ownerUserId,
    async (lease) => {
      let consumed: ReadyCatalogLookup | null = null;
      lease.assertCurrent();
      await updatePrivateItem(CATALOG_LOOKUP_QUEUE_KEY, (current) => {
        const items = ownedLiveItems(decodeQueue(current), ownerUserId, nowMs);
        const next = items.filter((item) => {
          const ready = toReady(item);
          if (
            consumed === null &&
            ready !== null &&
            ready.barcode === barcode &&
            ready.candidate.productId === input.productId &&
            ready.shelfProductId === null
          ) {
            consumed = { ...ready, shelfProductId };
            return false;
          }
          return true;
        });
        return encodeQueueOrRemove(next);
      });
      lease.assertCurrent();
      return consumed;
    },
  );
  if (consumed !== null) publishCatalogLookupQueueChange();
  return consumed;
}

/** Remove a reviewed candidate the user has rejected. */
export async function rejectReadyCatalogLookup(input: {
  barcode: string;
  productId: string;
  expectedShelfProductId: string | null;
  now?: Date;
}): Promise<boolean> {
  return (await consumeReadyCatalogLookup(input, false)) as boolean;
}

async function performCatalogLookupDrain(
  ownerUserId: string,
  now: Date,
  lookup: CatalogLookupExecutor,
): Promise<CatalogLookupQueueDrainResult> {
  const nowMs = validNow(now);
  const attemptedAt = new Date(nowMs).toISOString();
  return runHealthDataOperation(ownerUserId, async (lease) => {
    lease.assertCurrent();
    const initial = decodeQueue(await getPrivateItem(CATALOG_LOOKUP_QUEUE_KEY));
    lease.assertCurrent();

    const owned = initial.filter((item) => item.ownerUserId === ownerUserId);
    const expired = owned.filter((item) => Date.parse(item.expiresAt) <= nowMs).length;
    const due = owned
      .filter(
        (item) =>
          item.state === 'pending' &&
          Date.parse(item.expiresAt) > nowMs &&
          item.nextAttemptAt !== null &&
          Date.parse(item.nextAttemptAt) <= nowMs,
      )
      .slice(0, CATALOG_LOOKUP_QUEUE_MAX_ATTEMPTS_PER_DRAIN);

    if (initial.length === 0) {
      return {
        attempted: 0,
        ready: 0,
        resolved: 0,
        deferred: 0,
        expired: 0,
        remaining: 0,
        nextRetryAt: null,
        nextExpiryAt: null,
      };
    }

    const outcomes = new Map<string, DrainOutcome>();
    for (const item of due) {
      let outcome: DrainOutcome = { kind: 'retry' };
      try {
        lease.assertCurrent();
        const response = await lookup(item.barcode);
        lease.assertCurrent();
        if (response.result === 'matched') {
          const candidate = reviewedCandidate(response.product, item.barcode, attemptedAt);
          if (candidate !== null) outcome = { kind: 'ready', candidate };
        } else if (response.result === 'no_match' || response.result === 'too_short') {
          outcome = { kind: 'resolved' };
        }
      } catch (error) {
        // Only an ordinary lookup/network failure is retryable. A consent,
        // expiry, or account transition must escape before the queue mutates.
        lease.assertCurrent();
        void error;
      }
      outcomes.set(itemKey(ownerUserId, item.barcode), outcome);
    }

    let schedule: CatalogLookupQueueSchedule = queueSchedule([], expired);
    lease.assertCurrent();
    await updatePrivateItem(CATALOG_LOOKUP_QUEUE_KEY, (current) => {
      const latest = ownedLiveItems(decodeQueue(current), ownerUserId, nowMs);
      const next: CatalogLookupQueueItem[] = [];
      for (const item of latest) {
        const outcome = outcomes.get(itemKey(item.ownerUserId, item.barcode));
        if (item.state !== 'pending' || outcome === undefined) {
          next.push(item);
          continue;
        }
        if (outcome.kind === 'resolved') continue;

        const attemptCount = nextAttemptCount(item.attemptCount);
        if (outcome.kind === 'ready') {
          next.push({
            ...item,
            state: 'ready',
            attemptCount,
            nextAttemptAt: null,
            lastAttemptAt: attemptedAt,
            candidate: outcome.candidate,
          });
          continue;
        }

        const nextAttemptMs = Math.min(nowMs + backoffMs(attemptCount), Date.parse(item.expiresAt));
        next.push({
          ...item,
          attemptCount,
          nextAttemptAt: new Date(nextAttemptMs).toISOString(),
          lastAttemptAt: attemptedAt,
        });
      }
      schedule = queueSchedule(next, expired);
      return encodeQueueOrRemove(next);
    });
    lease.assertCurrent();

    const values = [...outcomes.values()];
    return {
      attempted: outcomes.size,
      ready: values.filter((outcome) => outcome.kind === 'ready').length,
      resolved: values.filter((outcome) => outcome.kind === 'resolved').length,
      deferred: values.filter((outcome) => outcome.kind === 'retry').length,
      ...schedule,
    };
  });
}

type DrainLeaseIdentity = Readonly<{
  ownerUserId: string;
  generation: number;
  epoch: number;
  accountGeneration: number;
}>;

let activeDrain: {
  lease: DrainLeaseIdentity;
  promise: Promise<CatalogLookupQueueDrainResult>;
} | null = null;

function sameDrainLease(left: DrainLeaseIdentity, right: DrainLeaseIdentity): boolean {
  return (
    left.ownerUserId === right.ownerUserId &&
    left.generation === right.generation &&
    left.epoch === right.epoch &&
    left.accountGeneration === right.accountGeneration
  );
}

/** Drain at most eight due lookups; concurrent foreground triggers share one run. */
export function drainCatalogLookupQueue(
  options: {
    now?: Date;
    lookup?: CatalogLookupExecutor;
  } = {},
): Promise<CatalogLookupQueueDrainResult> {
  const lease = captureHealthDataWriteLease();
  if (activeDrain && sameDrainLease(activeDrain.lease, lease)) return activeDrain.promise;

  const task = performCatalogLookupDrain(
    lease.ownerUserId,
    options.now ?? new Date(),
    options.lookup ?? lookupBarcode,
  );
  let tracked: Promise<CatalogLookupQueueDrainResult>;
  tracked = task.finally(() => {
    if (activeDrain?.promise === tracked) activeDrain = null;
  });
  activeDrain = { lease, promise: tracked };
  return tracked;
}
