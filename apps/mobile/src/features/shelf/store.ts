import * as Crypto from 'expo-crypto';

import type { AddedVia, ExpirySource, PaoSource, ProductStatus } from '@onskin/types';
import type { CatalogQualityGrade } from '@/features/catalog/quality';
import { readPrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';

import { normalizeShelfFreshness, validLocalDate } from './freshness';

// Local-first shelf store (docs/04 §8: the shelf must work in a bathroom with no
// signal. View, manual-add, and queued lookups all offline). AsyncStorage is the
// source of truth for v1 (single-user, last-write-wins is safe, DECISIONS D-029);
// intake also fires a best-effort Supabase mirror (B-SUPABASE) so it's ready to
// reconcile via the persisted mutation queue (D-007) once the project exists.
const KEY = 'onskin.shelf.v1';
const SCHEMA_VERSION = 1 as const;
const REPLENISHMENT_ID_NAMESPACE = 'onskin:shelf-replenishment:v1:';

export const SHELF_STATE_INVALID = 'SHELF_STATE_INVALID';
export const SHELF_STATE_UNSUPPORTED_VERSION = 'SHELF_STATE_UNSUPPORTED_VERSION';
export const SHELF_STATE_UNAVAILABLE = 'SHELF_STATE_UNAVAILABLE';
export const SHELF_REPLENISHMENT_ALREADY_REPLACED = 'SHELF_REPLENISHMENT_ALREADY_REPLACED';

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
  expiryDate: string | null; // printed expiry (ISO), if known
  expirySource: ExpirySource;
  status: ProductStatus;
  finishedAt: string | null;
  addedVia: AddedVia;
  /** Repurchase history powering the archive + replenishment (docs/04 §5.7). */
  repurchaseCount: number;
  thumbnailPath: string | null; // LOCAL device path by default (docs/04 §7)
  createdAt: string;
  updatedAt: string;
};

export type NewShelfProduct = {
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

type ShelfEnvelope = {
  version: typeof SCHEMA_VERSION;
  products: ShelfProduct[];
};

type ShelfStateFormat = 'current' | 'legacy';

export type ShelfStateRead =
  | { status: 'absent'; products: ShelfProduct[] }
  | { status: 'available'; products: ShelfProduct[]; format: ShelfStateFormat }
  | { status: 'unavailable' | 'corrupt' | 'unsupported_version'; products: null };

export type ReAddedShelfProduct = {
  fresh: ShelfProduct;
  archived: ShelfProduct;
};

function nowISO(): string {
  return new Date().toISOString();
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

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
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

function normalizeShelfProduct(value: unknown, fallbackISO: string): ShelfProduct | null {
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
  const freshness = normalizeShelfFreshness(value, fallbackISO.slice(0, 10));

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
    status,
    finishedAt: status === 'active' ? null : localDateOrNull(value.finishedAt),
    addedVia,
    repurchaseCount:
      typeof value.repurchaseCount === 'number' &&
      Number.isInteger(value.repurchaseCount) &&
      value.repurchaseCount > 0
        ? value.repurchaseCount
        : 1,
    thumbnailPath: stringOrNull(value.thumbnailPath),
    createdAt,
    updatedAt: isoStringOrFallback(value.updatedAt, createdAt),
  };
}

function normalizeShelfProducts(value: unknown, fallbackISO: string): ShelfProduct[] | null {
  if (!Array.isArray(value)) return null;
  const items: ShelfProduct[] = [];
  const ids = new Set<string>();
  for (const row of value) {
    const product = normalizeShelfProduct(row, fallbackISO);
    if (!product || ids.has(product.id)) return null;
    ids.add(product.id);
    items.push(product);
  }
  return items;
}

function decodeShelfState(
  raw: string | null,
  fallbackISO = nowISO(),
): { products: ShelfProduct[]; format: ShelfStateFormat | 'absent' } {
  if (raw === null) return { products: [], format: 'absent' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(SHELF_STATE_INVALID);
  }

  if (Array.isArray(parsed)) {
    const legacy = normalizeShelfProducts(parsed, fallbackISO);
    if (!legacy) throw new Error(SHELF_STATE_INVALID);
    return { products: legacy, format: 'legacy' };
  }
  if (!isRecord(parsed)) throw new Error(SHELF_STATE_INVALID);
  if (parsed.version !== SCHEMA_VERSION) {
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
  const products = normalizeShelfProducts(parsed.products, fallbackISO);
  if (!products || canonicalJson(products) !== canonicalJson(parsed.products)) {
    throw new Error(SHELF_STATE_INVALID);
  }
  return { products, format: 'current' };
}

function encodeShelfState(products: ShelfProduct[]): string {
  return JSON.stringify({ version: SCHEMA_VERSION, products } satisfies ShelfEnvelope);
}

let e2eShelfReadFailureCount = 0;

function consumeE2EShelfReadFailure(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  const fixture = process.env.EXPO_PUBLIC_E2E_SHELF_STORAGE_FAILURE?.trim().toLowerCase();
  if (fixture === 'always') return true;
  if (fixture !== 'once' || e2eShelfReadFailureCount > 0) return false;
  e2eShelfReadFailureCount += 1;
  return true;
}

/** Read and classify Shelf state without repairing, deleting, or migrating bytes. */
export async function readShelfState(): Promise<ShelfStateRead> {
  if (consumeE2EShelfReadFailure()) return { status: 'unavailable', products: null };

  let stored: Awaited<ReturnType<typeof readPrivateItem>>;
  try {
    stored = await readPrivateItem(KEY);
  } catch {
    return { status: 'unavailable', products: null };
  }
  if (stored.status === 'absent') return { status: 'absent', products: [] };
  if (stored.status === 'unavailable') return { status: 'unavailable', products: null };
  if (stored.status === 'corrupt') return { status: 'corrupt', products: null };
  if (stored.status === 'unsupported_version') {
    return { status: 'unsupported_version', products: null };
  }

  try {
    const decoded = decodeShelfState(stored.value);
    return {
      status: 'available',
      products: decoded.products,
      format: decoded.format === 'legacy' ? 'legacy' : 'current',
    };
  } catch (error) {
    return error instanceof Error && error.message === SHELF_STATE_UNSUPPORTED_VERSION
      ? { status: 'unsupported_version', products: null }
      : { status: 'corrupt', products: null };
  }
}

export async function loadShelf(): Promise<ShelfProduct[]> {
  const result = await readShelfState();
  if (result.status === 'available' || result.status === 'absent') return result.products;
  if (result.status === 'unsupported_version') {
    throw new Error(SHELF_STATE_UNSUPPORTED_VERSION);
  }
  if (result.status === 'corrupt') throw new Error(SHELF_STATE_INVALID);
  throw new Error(SHELF_STATE_UNAVAILABLE);
}

export async function addProduct(input: NewShelfProduct): Promise<ShelfProduct> {
  const ts = nowISO();
  const freshness = normalizeShelfFreshness(input, ts.slice(0, 10));
  const candidate: ShelfProduct = {
    id: Crypto.randomUUID(),
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
    status: 'active',
    finishedAt: null,
    addedVia: input.addedVia,
    repurchaseCount: 1,
    thumbnailPath: null,
    createdAt: ts,
    updatedAt: ts,
  };
  const product = normalizeShelfProduct(candidate, ts);
  if (!product) throw new Error(SHELF_STATE_INVALID);
  await updatePrivateItem(KEY, (current) => {
    const items = decodeShelfState(current, ts).products;
    if (items.some((item) => item.id === product.id)) throw new Error(SHELF_STATE_INVALID);
    return encodeShelfState([product, ...items]);
  });
  return product;
}

export async function updateProduct(
  id: string,
  patch: Partial<Omit<ShelfProduct, 'id' | 'createdAt'>>,
): Promise<ShelfProduct | null> {
  const ts = nowISO();
  let updated: ShelfProduct | null = null;
  await updatePrivateItem(KEY, (current) => {
    const items = decodeShelfState(current, ts).products;
    let changed = false;
    const next = items.map((product) => {
      if (product.id !== id) return product;
      const candidate = normalizeShelfProduct(
        {
          ...product,
          ...patch,
          id: product.id,
          createdAt: product.createdAt,
          updatedAt: ts,
        },
        ts,
      );
      if (!candidate) {
        updated = product;
        return product;
      }
      const { updatedAt: candidateUpdatedAt, ...candidateContent } = candidate;
      const { updatedAt: productUpdatedAt, ...productContent } = product;
      void candidateUpdatedAt;
      void productUpdatedAt;
      if (canonicalJson(candidateContent) === canonicalJson(productContent)) {
        updated = product;
        return product;
      }
      changed = true;
      updated = candidate;
      return candidate;
    });
    return changed ? encodeShelfState(next) : current;
  });
  return updated;
}

export async function removeProduct(id: string): Promise<ShelfProduct | null> {
  let removed: ShelfProduct | null = null;
  await updatePrivateItem(KEY, (current) => {
    const items = decodeShelfState(current).products;
    removed = items.find((product) => product.id === id) ?? null;
    return removed ? encodeShelfState(items.filter((product) => product.id !== id)) : current;
  });
  return removed;
}

async function replacementIdForSource(sourceId: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${REPLENISHMENT_ID_NAMESPACE}${sourceId}`,
  );
  if (!/^[0-9a-f]{64}$/i.test(digest)) throw new Error(SHELF_STATE_INVALID);

  // Format the first 128 digest bits as a UUIDv5-shaped identifier. The digest
  // is deterministic from the immutable physical-unit ID, so every retry finds
  // the same successor without persisting mutable coordination metadata.
  const chars = digest.slice(0, 32).toLowerCase().split('');
  chars[12] = '5';
  chars[16] = ((Number.parseInt(chars[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${chars.slice(0, 8).join('')}-${chars.slice(8, 12).join('')}-${chars
    .slice(12, 16)
    .join('')}-${chars.slice(16, 20).join('')}-${chars.slice(20).join('')}`;
}

/**
 * Replenish: archive the current unit and add a fresh one of the same product,
 * resetting the opened-date clock and carrying the repurchase count forward
 * (docs/04 §6 "re-add the same one").
 */
export async function reAddProduct(id: string): Promise<ReAddedShelfProduct | null> {
  const ts = nowISO();
  const replacementId = await replacementIdForSource(id);
  if (!replacementId || replacementId === id) throw new Error(SHELF_STATE_INVALID);
  let result: ReAddedShelfProduct | null = null;
  await updatePrivateItem(KEY, (current) => {
    const items = decodeShelfState(current, ts).products;
    const prev = items.find((product) => product.id === id);
    if (!prev) return current;

    const existingReplacement = items.find((product) => product.id === replacementId);
    if (existingReplacement) {
      // The cryptographic source-derived ID is the immutable lineage marker.
      // An active source alongside that successor is inconsistent/colliding;
      // a consumed successor proves this older source was already replaced.
      if (prev.status === 'active') throw new Error(SHELF_STATE_INVALID);
      if (existingReplacement.status !== 'active') {
        throw new Error(SHELF_REPLENISHMENT_ALREADY_REPLACED);
      }
      result = { fresh: existingReplacement, archived: prev };
      return current;
    }
    const archived: ShelfProduct =
      prev.status === 'active'
        ? {
            ...prev,
            status: 'finished',
            finishedAt: ts.slice(0, 10),
            updatedAt: ts,
          }
        : { ...prev, updatedAt: ts };
    const freshness = normalizeShelfFreshness(
      {
        ...prev,
        openedAt: ts.slice(0, 10),
        isOpened: true,
        expiryDate: null,
      },
      ts.slice(0, 10),
    );
    const fresh: ShelfProduct = {
      ...prev,
      id: replacementId,
      ...freshness,
      status: 'active',
      finishedAt: null,
      repurchaseCount: prev.repurchaseCount + 1,
      createdAt: ts,
      updatedAt: ts,
    };
    result = { fresh, archived };
    return encodeShelfState([
      fresh,
      ...items.map((product) => (product.id === id ? archived : product)),
    ]);
  });
  return result;
}

/** Explicit reset for tests/seeding. Refuses to delete unreadable domain bytes. */
export async function clearShelf(): Promise<void> {
  await updatePrivateItem(KEY, (current) => {
    decodeShelfState(current);
    return current === null ? current : null;
  });
}
