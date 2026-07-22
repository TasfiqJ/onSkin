import { randomUUID } from 'expo-crypto';

import type { AddedVia, ExpirySource, PaoSource, ProductStatus } from '@onskin/types';
import type { CatalogQualityGrade } from '@/features/catalog/quality';
import { runCurrentHealthDataOperation } from '@/lib/consent/healthDataWriteAdmission';
import { getPrivateItem, removePrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';

import {
  currentLocalDate,
  normalizeShelfFreshness,
  normalizeShelfFreshnessV1,
  validLocalDate,
  type ShelfFreshness,
  type ShelfFreshnessInput,
} from './freshness';

// Local-first shelf store (docs/04 §8: the shelf must work in a bathroom with no
// signal. View, manual-add, and queued lookups all offline). AsyncStorage is the
// source of truth for the versioned shelf envelope (single-user,
// last-write-wins is safe, DECISIONS D-029);
// intake also fires a best-effort Supabase mirror (B-SUPABASE) so it's ready to
// reconcile via the persisted mutation queue (D-007) once the project exists.
const KEY = 'onskin.shelf.v1';
const LEGACY_SCHEMA_VERSION = 1 as const;
const SCHEMA_VERSION = 2 as const;

export const SHELF_STATE_INVALID = 'SHELF_STATE_INVALID';
export const SHELF_STATE_UNSUPPORTED_VERSION = 'SHELF_STATE_UNSUPPORTED_VERSION';

const PRODUCT_STATUSES = new Set<ProductStatus>(['active', 'finished', 'discarded']);
const ADDED_VIA = new Set<AddedVia>(['barcode', 'search', 'ocr', 'manual', 'onboarding']);
const CATALOG_QUALITY_GRADES = new Set<CatalogQualityGrade | 'manual'>([
  'verified',
  'usable',
  'limited',
  'unverified',
  'blocked',
  'manual',
]);

export type ShelfProduct = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  barcode: string | null;
  catalogProductId: string | null;
  catalogSourceId: string | null;
  catalogSource: string | null;
  catalogSourceName: string | null;
  catalogSourceRef: string | null;
  catalogSourceUrl: string | null;
  catalogSourceSnapshotDate: string | null;
  catalogMatchQuality: CatalogQualityGrade | 'manual' | null;
  dataQualityScore: number | null;
  ingredientParseStatus: string | null;
  ingredientParseConfidence: number | null;
  parserVersion: string | null;
  sourceDisclosureAckAt: string | null;
  /** Free-text / parsed INCI tokens. The engine tags off these + the name. */
  ingredients: string[];
  openedAt: string | null; // ISO local date; null when unopened or unknown
  isOpened: boolean; // false = unopened, no PAO clock (docs/04 §4.5)
  paoMonths: number | null;
  paoSource: PaoSource;
  expiryDate: string | null; // date printed on the physical package, if known
  expirySource: ExpirySource;
  /** Historical catalog-transferred package date. Non-actionable until the user
   * reconfirms it from the exact package in hand. */
  legacyUnverifiedExpiryDate: string | null;
  status: ProductStatus;
  finishedAt: string | null;
  addedVia: AddedVia;
  /** Repurchase history powering the archive + replenishment (docs/04 §5.7). */
  repurchaseCount: number;
  /** Immutable local lineage. Optional only while authenticating historical v1 bytes. */
  replacementRootId?: string;
  replacesProductId?: string | null;
  replacementLineageAmbiguous?: boolean;
  thumbnailPath: string | null; // LOCAL device path by default (docs/04 §7)
  createdAt: string;
  updatedAt: string;
};

export type NewShelfProduct = {
  /** Stable for one intake submission so an uncertain retry cannot duplicate the shelf row. */
  operationId?: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  barcode?: string | null;
  catalogProductId?: string | null;
  catalogSourceId?: string | null;
  catalogSource?: string | null;
  catalogSourceName?: string | null;
  catalogSourceRef?: string | null;
  catalogSourceUrl?: string | null;
  catalogSourceSnapshotDate?: string | null;
  catalogMatchQuality?: CatalogQualityGrade | 'manual' | null;
  dataQualityScore?: number | null;
  ingredientParseStatus?: string | null;
  ingredientParseConfidence?: number | null;
  parserVersion?: string | null;
  sourceDisclosureAckAt?: string | null;
  ingredients?: string[];
  openedAt?: string | null;
  isOpened?: boolean;
  paoMonths?: number | null;
  paoSource?: PaoSource;
  expiryDate?: string | null;
  expirySource?: ExpirySource;
  addedVia: AddedVia;
};

/** A replacement package must have an explicit opening state. Buying another
 * unit alone never starts its PAO clock. */
export type ReplacementOpeningState =
  | { isOpened: true; openedAt: string }
  | { isOpened: false; openedAt: null };

export type CatalogRecoveryProductUpdate = {
  id: string;
  expectedUpdatedAt: string;
  useCatalogIdentity: boolean;
  catalogProductId: string;
  catalogSourceId: string;
  catalogSource: string;
  catalogSourceName: string;
  catalogSourceRef: string | null;
  catalogSourceUrl: string | null;
  catalogSourceSnapshotDate: string | null;
  catalogMatchQuality: 'verified' | 'usable';
  dataQualityScore: number | null;
  sourceDisclosureAckAt: string;
  catalogName: string;
  catalogBrand: string | null;
  catalogCategory: string | null;
};

export type CatalogRecoveryProductUpdateResult =
  | { status: 'updated'; product: ShelfProduct }
  | { status: 'missing' | 'stale' };

type ShelfEnvelope = {
  version: typeof SCHEMA_VERSION;
  products: ShelfProduct[];
};

type ShelfFreshnessNormalizer = (
  input: ShelfFreshnessInput,
  today?: string,
) => ShelfFreshness;

type DecodedShelfState = {
  products: ShelfProduct[];
  upgradeRequired: boolean;
};

function nowISO(): string {
  return new Date().toISOString();
}

function utcCalendarDayPlusOne(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function preserveExistingOpenedDateToday(product: ShelfProduct): string {
  const today = currentLocalDate();
  return product.openedAt && product.openedAt > today ? product.openedAt : today;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => hasOwn(value, key));
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function validOperationId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function stringOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : nonEmptyString(value);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

function localDateOrNull(value: unknown): string | null {
  return validLocalDate(value);
}

function isoStringOrFallback(value: unknown, fallback: string): string {
  const text = nonEmptyString(value);
  return text && !Number.isNaN(Date.parse(text)) ? text : fallback;
}

function isoStringOrNull(value: unknown): string | null {
  const text = nonEmptyString(value);
  return text && !Number.isNaN(Date.parse(text)) ? text : null;
}

function zeroToOneOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : null;
}

function zeroToHundredOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null;
}

function enumValue<T extends string>(value: unknown, allowed: ReadonlySet<T>, fallback: T): T {
  return typeof value === 'string' && allowed.has(value as T) ? (value as T) : fallback;
}

function catalogQualityOrNull(value: unknown): CatalogQualityGrade | 'manual' | null {
  return typeof value === 'string' &&
    CATALOG_QUALITY_GRADES.has(value as CatalogQualityGrade | 'manual')
    ? (value as CatalogQualityGrade | 'manual')
    : null;
}

function normalizeShelfProduct(
  value: unknown,
  fallbackISO: string,
  freshnessNormalizer: ShelfFreshnessNormalizer = normalizeShelfFreshness,
  freshnessToday: string | null = currentLocalDate(),
  includeV2Fields = true,
): ShelfProduct | null {
  if (!isRecord(value)) return null;
  const id = nonEmptyString(value.id);
  const name = nonEmptyString(value.name);
  if (!id || !name) return null;

  const addedVia = enumValue(value.addedVia, ADDED_VIA, 'manual');
  const catalogSource =
    stringOrNull(value.catalogSource) ?? (addedVia === 'manual' ? 'user_local' : null);
  const catalogMatchQuality =
    catalogQualityOrNull(value.catalogMatchQuality) ?? (addedVia === 'manual' ? 'manual' : null);
  const status = enumValue(value.status, PRODUCT_STATUSES, 'active');
  const createdAt = isoStringOrFallback(value.createdAt, fallbackISO);
  const updatedAt = isoStringOrFallback(value.updatedAt, createdAt);
  const freshness = freshnessNormalizer(
    value,
    freshnessToday ?? utcCalendarDayPlusOne(updatedAt),
  );
  const legacyUnverifiedExpiryDate =
    freshness.expiryDate === null ? validLocalDate(value.legacyUnverifiedExpiryDate) : null;

  const replacementRootId = nonEmptyString(value.replacementRootId) ?? id;
  return {
    id,
    name,
    brand: stringOrNull(value.brand),
    category: stringOrNull(value.category),
    barcode: stringOrNull(value.barcode),
    catalogProductId: stringOrNull(value.catalogProductId),
    catalogSourceId: stringOrNull(value.catalogSourceId),
    catalogSource,
    catalogSourceName: stringOrNull(value.catalogSourceName),
    catalogSourceRef: stringOrNull(value.catalogSourceRef),
    catalogSourceUrl: stringOrNull(value.catalogSourceUrl),
    catalogSourceSnapshotDate: localDateOrNull(value.catalogSourceSnapshotDate),
    catalogMatchQuality,
    dataQualityScore: zeroToHundredOrNull(value.dataQualityScore),
    ingredientParseStatus: stringOrNull(value.ingredientParseStatus),
    ingredientParseConfidence: zeroToOneOrNull(value.ingredientParseConfidence),
    parserVersion: stringOrNull(value.parserVersion),
    sourceDisclosureAckAt: isoStringOrNull(value.sourceDisclosureAckAt),
    ingredients: stringArray(value.ingredients),
    ...freshness,
    legacyUnverifiedExpiryDate: includeV2Fields ? legacyUnverifiedExpiryDate : null,
    status,
    finishedAt: status === 'active' ? null : localDateOrNull(value.finishedAt),
    addedVia,
    repurchaseCount:
      typeof value.repurchaseCount === 'number' &&
      Number.isInteger(value.repurchaseCount) &&
      value.repurchaseCount > 0
        ? value.repurchaseCount
        : 1,
    ...(includeV2Fields
      ? {
          replacementRootId,
          replacesProductId: stringOrNull(value.replacesProductId),
          replacementLineageAmbiguous: value.replacementLineageAmbiguous === true,
        }
      : {}),
    thumbnailPath: stringOrNull(value.thumbnailPath),
    createdAt,
    updatedAt,
  };
}

function normalizedLineageText(value: string | null): string {
  return value?.trim().replace(/\s+/g, ' ').toLowerCase() ?? '';
}

function historicalReplacementIdentities(product: ShelfProduct): string[] {
  return [
    product.catalogProductId ? `catalog:${product.catalogProductId.toLowerCase()}` : '',
    product.barcode ? `barcode:${product.barcode}` : '',
    [
      'manual',
      normalizedLineageText(product.brand),
      normalizedLineageText(product.name),
      normalizedLineageText(product.category),
    ].join(':'),
  ].filter((identity) => identity.length > 0);
}

/** v1 had no explicit predecessor IDs. Build conservative connected components
 * from every retained identity and the exact timestamp pair written by the
 * replacement transaction. The latter survives later catalog enrichment even
 * when name/brand/category identity changes. Only a unique consecutive chain
 * receives predecessor edges; ambiguous peers share a root so an archived retry
 * cannot create another active unit. */
function attachHistoricalReplacementLineage(products: ShelfProduct[]): ShelfProduct[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  const adjacency = new Map(products.map((product) => [product.id, new Set<string>()]));
  const connect = (left: ShelfProduct, right: ShelfProduct): void => {
    if (left.id === right.id) return;
    adjacency.get(left.id)!.add(right.id);
    adjacency.get(right.id)!.add(left.id);
  };

  const identityGroups = new Map<string, ShelfProduct[]>();
  for (const product of products) {
    for (const identity of historicalReplacementIdentities(product)) {
      identityGroups.set(identity, [...(identityGroups.get(identity) ?? []), product]);
    }
  }
  for (const group of identityGroups.values()) {
    const [first, ...rest] = group;
    if (first) rest.forEach((product) => connect(first, product));
  }

  for (const successor of products) {
    if (successor.repurchaseCount <= 1) continue;
    for (const predecessor of products) {
      if (
        predecessor.repurchaseCount + 1 === successor.repurchaseCount &&
        predecessor.updatedAt === successor.createdAt &&
        predecessor.createdAt <= successor.createdAt
      ) {
        connect(predecessor, successor);
      }
    }
  }

  const lineageById = new Map<
    string,
    Pick<
      ShelfProduct,
      'replacementRootId' | 'replacesProductId' | 'replacementLineageAmbiguous'
    >
  >();
  const visited = new Set<string>();
  for (const start of products) {
    if (visited.has(start.id)) continue;
    const component: ShelfProduct[] = [];
    const pending = [start.id];
    while (pending.length > 0) {
      const id = pending.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      component.push(byId.get(id)!);
      for (const neighbor of adjacency.get(id) ?? []) pending.push(neighbor);
    }

    const ordered = component.sort(
      (left, right) =>
        left.repurchaseCount - right.repurchaseCount ||
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id),
    );
    const uniqueConsecutive = ordered.every(
      (product, index) =>
        index === 0 || product.repurchaseCount === ordered[index - 1]!.repurchaseCount + 1,
    );
    const chronological = ordered.every(
      (product, index) => index === 0 || product.createdAt >= ordered[index - 1]!.createdAt,
    );
    const exactChain = ordered.every(
      (product, index) =>
        index === 0 ||
        (ordered[index - 1]!.updatedAt === product.createdAt &&
          ordered[index - 1]!.repurchaseCount + 1 === product.repurchaseCount),
    );
    const ambiguous =
      ordered.length > 1 && (!uniqueConsecutive || !chronological || !exactChain);
    const rootId = ordered[0]!.id;
    ordered.forEach((product, index) => {
      lineageById.set(product.id, {
        replacementRootId: rootId,
        replacesProductId: !ambiguous && index > 0 ? ordered[index - 1]!.id : null,
        replacementLineageAmbiguous: ambiguous,
      });
    });
  }
  return products.map((product) => ({ ...product, ...lineageById.get(product.id)! }));
}

function normalizeShelfProducts(
  value: unknown,
  fallbackISO: string,
  freshnessNormalizer: ShelfFreshnessNormalizer = normalizeShelfFreshness,
  freshnessToday: string | null = currentLocalDate(),
  includeV2Fields = true,
): ShelfProduct[] | null {
  if (!Array.isArray(value)) return null;
  const items: ShelfProduct[] = [];
  const ids = new Set<string>();
  for (const row of value) {
    const product = normalizeShelfProduct(
      row,
      fallbackISO,
      freshnessNormalizer,
      freshnessToday,
      includeV2Fields,
    );
    if (!product || ids.has(product.id)) return null;
    ids.add(product.id);
    items.push(product);
  }
  return items;
}

function quarantineHistoricalCatalogExpiry(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const historicalDate = validLocalDate(value.expiryDate);
  const catalogLinked = nonEmptyString(value.catalogProductId) !== null;
  return {
    ...value,
    expiryDate: catalogLinked && historicalDate ? null : value.expiryDate,
    legacyUnverifiedExpiryDate: catalogLinked ? historicalDate : null,
  };
}

function canonicalV1Product(product: ShelfProduct): Omit<
  ShelfProduct,
  | 'legacyUnverifiedExpiryDate'
  | 'replacementRootId'
  | 'replacesProductId'
  | 'replacementLineageAmbiguous'
> {
  const {
    legacyUnverifiedExpiryDate: _legacyUnverifiedExpiryDate,
    replacementRootId: _replacementRootId,
    replacesProductId: _replacesProductId,
    replacementLineageAmbiguous: _replacementLineageAmbiguous,
    ...v1Product
  } = product;
  return v1Product;
}

function decodeShelfState(raw: string | null, fallbackISO = nowISO()): DecodedShelfState {
  if (raw === null) return { products: [], upgradeRequired: false };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(SHELF_STATE_INVALID);
  }

  if (Array.isArray(parsed)) {
    const legacy = normalizeShelfProducts(
      parsed.map(quarantineHistoricalCatalogExpiry),
      fallbackISO,
      normalizeShelfFreshness,
      null,
    );
    if (!legacy) throw new Error(SHELF_STATE_INVALID);
    return { products: legacy, upgradeRequired: true };
  }
  if (!isRecord(parsed)) throw new Error(SHELF_STATE_INVALID);
  if (parsed.version !== LEGACY_SCHEMA_VERSION && parsed.version !== SCHEMA_VERSION) {
    if (
      typeof parsed.version === 'number' &&
      Number.isSafeInteger(parsed.version) &&
      parsed.version > SCHEMA_VERSION
    ) {
      throw new Error(SHELF_STATE_UNSUPPORTED_VERSION);
    }
    throw new Error(SHELF_STATE_INVALID);
  }
  if (!hasExactKeys(parsed, ['version', 'products'])) throw new Error(SHELF_STATE_INVALID);
  if (parsed.version === LEGACY_SCHEMA_VERSION) {
    const historical = normalizeShelfProducts(
      parsed.products,
      fallbackISO,
      normalizeShelfFreshnessV1,
      null,
      false,
    );
    if (
      !historical ||
      raw !==
        JSON.stringify({
          version: LEGACY_SCHEMA_VERSION,
          products: historical.map(canonicalV1Product),
        })
    ) {
      throw new Error(SHELF_STATE_INVALID);
    }
    const current = normalizeShelfProducts(
      Array.isArray(parsed.products)
        ? parsed.products.map(quarantineHistoricalCatalogExpiry)
        : parsed.products,
      fallbackISO,
      normalizeShelfFreshness,
      null,
    );
    const upgraded = current ? attachHistoricalReplacementLineage(current) : null;
    if (!upgraded) throw new Error(SHELF_STATE_INVALID);
    return { products: upgraded, upgradeRequired: true };
  }
  // Canonical persisted bytes must remain valid after a timezone/date-line
  // change. Bind future-date validation to each row's persisted write instant,
  // not the device's current calendar date.
  const products = normalizeShelfProducts(
    parsed.products,
    fallbackISO,
    normalizeShelfFreshness,
    null,
  );
  if (!products || raw !== encodeShelfState(products)) {
    throw new Error(SHELF_STATE_INVALID);
  }
  return { products, upgradeRequired: false };
}

function encodeShelfState(products: ShelfProduct[]): string {
  return JSON.stringify({ version: SCHEMA_VERSION, products } satisfies ShelfEnvelope);
}

export function loadShelf(): Promise<ShelfProduct[]> {
  return runCurrentHealthDataOperation(async (lease) => {
    try {
      lease.assertCurrent();
      const raw = await getPrivateItem(KEY);
      lease.assertCurrent();
      const decoded = decodeShelfState(raw);
      lease.assertCurrent();
      return decoded.products;
    } catch {
      // Ordinary reads never repair, delete, or replace private shelf bytes.
      // Authorization invalidation is not an ordinary recovery condition.
      lease.assertCurrent();
      return [];
    }
  });
}

function normalizeProductForWrite(
  value: ShelfProduct,
  fallbackISO: string,
  fallback: ShelfProduct,
  freshnessToday: string = currentLocalDate(),
): ShelfProduct {
  return (
    normalizeShelfProduct(value, fallbackISO, normalizeShelfFreshness, freshnessToday) ?? {
      ...fallback,
      updatedAt: fallbackISO,
    }
  );
}

export function addProduct(input: NewShelfProduct): Promise<ShelfProduct> {
  return runCurrentHealthDataOperation(async (lease) => {
    const ts = nowISO();
    const today = currentLocalDate();
    const productId = input.operationId ?? randomUUID();
    if (
      input.operationId &&
      !validOperationId(productId)
    ) {
      throw new Error(SHELF_STATE_INVALID);
    }
    const freshness = normalizeShelfFreshness(input, today);
    const candidate: ShelfProduct = {
      id: productId,
      name: input.name,
      brand: input.brand ?? null,
      category: input.category ?? null,
      barcode: input.barcode ?? null,
      catalogProductId: input.catalogProductId ?? null,
      catalogSourceId: input.catalogSourceId ?? null,
      catalogSource: input.catalogSource ?? (input.addedVia === 'manual' ? 'user_local' : null),
      catalogSourceName: input.catalogSourceName ?? null,
      catalogSourceRef: input.catalogSourceRef ?? null,
      catalogSourceUrl: input.catalogSourceUrl ?? null,
      catalogSourceSnapshotDate: input.catalogSourceSnapshotDate ?? null,
      catalogMatchQuality:
        input.catalogMatchQuality ?? (input.addedVia === 'manual' ? 'manual' : null),
      dataQualityScore: input.dataQualityScore ?? null,
      ingredientParseStatus: input.ingredientParseStatus ?? null,
      ingredientParseConfidence: input.ingredientParseConfidence ?? null,
      parserVersion: input.parserVersion ?? null,
      sourceDisclosureAckAt: input.sourceDisclosureAckAt ?? null,
      ingredients: input.ingredients ?? [],
      ...freshness,
      legacyUnverifiedExpiryDate: null,
      status: 'active',
      finishedAt: null,
      addedVia: input.addedVia,
      repurchaseCount: 1,
      replacementRootId: productId,
      replacesProductId: null,
      replacementLineageAmbiguous: false,
      thumbnailPath: null,
      createdAt: ts,
      updatedAt: ts,
    };
    const product = normalizeShelfProduct(candidate, ts);
    if (!product) throw new Error(SHELF_STATE_INVALID);
    let committed = product;
    lease.assertCurrent();
    await updatePrivateItem(KEY, (current) => {
      lease.assertCurrent();
      const decoded = decodeShelfState(current, ts);
      const items = decoded.products;
      const existing = items.find((item) => item.id === product.id);
      if (existing) {
        committed = existing;
        return decoded.upgradeRequired ? encodeShelfState(items) : current;
      }
      lease.assertCurrent();
      return encodeShelfState([product, ...items]);
    });
    lease.assertCurrent();
    return committed;
  });
}

export async function updateProduct(
  id: string,
  patch: Partial<Omit<ShelfProduct, 'id' | 'createdAt'>>,
): Promise<ShelfProduct | null> {
  return runCurrentHealthDataOperation(async (lease) => {
    const ts = nowISO();
    let updated: ShelfProduct | null = null;
    lease.assertCurrent();
    await updatePrivateItem(KEY, (current) => {
      lease.assertCurrent();
      const items = decodeShelfState(current, ts).products;
      const next = items.map((product) => {
        if (product.id !== id) return product;
        updated = normalizeProductForWrite(
          {
            ...product,
            ...patch,
            id: product.id,
            createdAt: product.createdAt,
            replacementRootId: product.replacementRootId,
            replacesProductId: product.replacesProductId,
            replacementLineageAmbiguous: product.replacementLineageAmbiguous,
            legacyUnverifiedExpiryDate:
              Object.hasOwn(patch, 'expiryDate') || patch.legacyUnverifiedExpiryDate === null
                ? null
                : product.legacyUnverifiedExpiryDate,
            updatedAt: ts,
          },
          ts,
          product,
          Object.hasOwn(patch, 'openedAt') || Object.hasOwn(patch, 'isOpened')
            ? currentLocalDate()
            : preserveExistingOpenedDateToday(product),
        );
        return updated;
      });
      lease.assertCurrent();
      return updated ? encodeShelfState(next) : current;
    });
    lease.assertCurrent();
    return updated;
  });
}

/**
 * Attach a freshly revalidated catalog identity without racing a later manual
 * edit. User ingredients and every freshness field are intentionally absent
 * from this patch and therefore remain byte-for-byte owned by the Shelf row.
 */
export function applyCatalogRecoveryProductUpdate(
  input: CatalogRecoveryProductUpdate,
): Promise<CatalogRecoveryProductUpdateResult> {
  return runCurrentHealthDataOperation(async (lease) => {
    const ts = nowISO();
    let result: CatalogRecoveryProductUpdateResult = { status: 'missing' };
    lease.assertCurrent();
    await updatePrivateItem(KEY, (current) => {
      lease.assertCurrent();
      const items = decodeShelfState(current, ts).products;
      const index = items.findIndex((product) => product.id === input.id);
      if (index < 0) return current;

      const existing = items[index]!;
      if (existing.updatedAt !== input.expectedUpdatedAt) {
        result = { status: 'stale' };
        return current;
      }

      const updated = normalizeProductForWrite(
        {
          ...existing,
          catalogProductId: input.catalogProductId,
          catalogSourceId: input.catalogSourceId,
          catalogSource: input.catalogSource,
          catalogSourceName: input.catalogSourceName,
          catalogSourceRef: input.catalogSourceRef,
          catalogSourceUrl: input.catalogSourceUrl,
          catalogSourceSnapshotDate: input.catalogSourceSnapshotDate,
          catalogMatchQuality: input.catalogMatchQuality,
          dataQualityScore: input.dataQualityScore,
          sourceDisclosureAckAt: input.sourceDisclosureAckAt,
          ...(input.useCatalogIdentity
            ? {
                name: input.catalogName,
                brand: input.catalogBrand,
                category: input.catalogCategory,
              }
            : {}),
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: ts,
        },
        ts,
        existing,
        preserveExistingOpenedDateToday(existing),
      );
      const next = [...items];
      next[index] = updated;
      result = { status: 'updated', product: updated };
      lease.assertCurrent();
      return encodeShelfState(next);
    });
    lease.assertCurrent();
    return result;
  });
}

export async function removeProduct(id: string): Promise<ShelfProduct | null> {
  return runCurrentHealthDataOperation(async (lease) => {
    let removed: ShelfProduct | null = null;
    lease.assertCurrent();
    await updatePrivateItem(KEY, (current) => {
      lease.assertCurrent();
      const items = decodeShelfState(current).products;
      removed = items.find((product) => product.id === id) ?? null;
      lease.assertCurrent();
      return removed ? encodeShelfState(items.filter((product) => product.id !== id)) : current;
    });
    lease.assertCurrent();
    return removed;
  });
}

/**
 * Replenish: archive the current unit and add another package of the same
 * product. The caller explicitly records whether that package is opened;
 * repurchase alone never starts its PAO clock (docs/04 §6).
 */
export async function reAddProduct(
  id: string,
  opening: ReplacementOpeningState,
  operationId: string,
): Promise<ShelfProduct | null> {
  return runCurrentHealthDataOperation(async (lease) => {
    const ts = nowISO();
    const today = currentLocalDate();
    const openedAt = opening?.isOpened === true ? validLocalDate(opening.openedAt) : null;
    if (
      !opening ||
      (opening.isOpened !== true && opening.isOpened !== false) ||
      (opening.isOpened && (!openedAt || openedAt > today)) ||
      (!opening.isOpened && opening.openedAt !== null)
    ) {
      throw new Error(SHELF_STATE_INVALID);
    }
    if (!validOperationId(operationId)) throw new Error(SHELF_STATE_INVALID);
    const replacementId = operationId;
    let fresh: ShelfProduct | null = null;
    lease.assertCurrent();
    await updatePrivateItem(KEY, (current) => {
      lease.assertCurrent();
      const items = decodeShelfState(current, ts).products;
      const prev = items.find((product) => product.id === id);
      if (!prev) {
        lease.assertCurrent();
        return current;
      }
      const existingOperation = items.find((product) => product.id === replacementId);
      const replacementRootId = prev.replacementRootId ?? prev.id;
      if (existingOperation) {
        if (
          existingOperation.repurchaseCount > prev.repurchaseCount &&
          existingOperation.replacementRootId === replacementRootId
        ) {
          fresh = existingOperation;
          return current;
        }
        throw new Error(SHELF_STATE_INVALID);
      }
      if (prev.status !== 'active') {
        const descendants = items
          .filter(
            (product) =>
              product.id !== prev.id &&
              product.replacementRootId === replacementRootId &&
              (prev.replacementLineageAmbiguous === true ||
                product.repurchaseCount > prev.repurchaseCount),
          )
          .sort((left, right) => right.repurchaseCount - left.repurchaseCount);
        const activeDescendant = descendants.find((product) => product.status === 'active');
        if (activeDescendant) fresh = activeDescendant;
        if (descendants.length > 0) return current;
      }
      const archived: ShelfProduct =
        prev.status === 'active'
          ? {
              ...prev,
              status: 'finished',
              finishedAt: today,
              updatedAt: ts,
            }
          : { ...prev, updatedAt: ts };
      const freshness = normalizeShelfFreshness(
        {
          ...prev,
          openedAt,
          isOpened: opening.isOpened,
          expiryDate: null,
        },
        today,
      );
      fresh = {
        ...prev,
        id: replacementId,
        ...freshness,
        legacyUnverifiedExpiryDate: null,
        status: 'active',
        finishedAt: null,
        repurchaseCount: prev.repurchaseCount + 1,
        replacementRootId,
        replacesProductId: prev.id,
        replacementLineageAmbiguous: prev.replacementLineageAmbiguous === true,
        createdAt: ts,
        updatedAt: ts,
      };
      lease.assertCurrent();
      return encodeShelfState([
        fresh,
        ...items.map((product) => (product.id === id ? archived : product)),
      ]);
    });
    lease.assertCurrent();
    return fresh;
  });
}

/** Test/seed reset. */
export async function clearShelf(): Promise<void> {
  // Closed-consent cleanup: deletion is account-scoped and never reads plaintext.
  await removePrivateItem(KEY);
}
