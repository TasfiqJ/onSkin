import { randomUUID } from 'expo-crypto';

import type { AddedVia, ExpirySource, PaoSource, ProductStatus } from '@onskin/types';
import type { CatalogQualityGrade } from '@/features/catalog/quality';
import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

// Local-first shelf store (docs/04 §8: the shelf must work in a bathroom with no
// signal. View, manual-add, and queued lookups all offline). AsyncStorage is the
// source of truth for v1 (single-user, last-write-wins is safe, DECISIONS D-029);
// intake also fires a best-effort Supabase mirror (B-SUPABASE) so it's ready to
// reconcile via the persisted mutation queue (D-007) once the project exists.
const KEY = 'onskin.shelf.v1';

const PRODUCT_STATUSES = new Set<ProductStatus>(['active', 'finished', 'discarded']);
const PAO_SOURCES = new Set<PaoSource>(['label', 'catalog', 'category_default', 'unknown']);
const EXPIRY_SOURCES = new Set<ExpirySource>(['printed', 'pao_computed', 'estimated', 'unknown']);
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

function nowISO(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
  const text = nonEmptyString(value);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function isoStringOrFallback(value: unknown, fallback: string): string {
  const text = nonEmptyString(value);
  return text && !Number.isNaN(Date.parse(text)) ? text : fallback;
}

function isoStringOrNull(value: unknown): string | null {
  const text = nonEmptyString(value);
  return text && !Number.isNaN(Date.parse(text)) ? text : null;
}

function positiveIntegerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
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
  const isOpened = typeof value.isOpened === 'boolean' ? value.isOpened : true;

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
    openedAt: isOpened ? localDateOrNull(value.openedAt) : null,
    isOpened,
    paoMonths: positiveIntegerOrNull(value.paoMonths),
    paoSource: enumValue(value.paoSource, PAO_SOURCES, 'unknown'),
    expiryDate: localDateOrNull(value.expiryDate),
    expirySource: enumValue(value.expirySource, EXPIRY_SOURCES, 'unknown'),
    status,
    finishedAt: status === 'active' ? null : localDateOrNull(value.finishedAt),
    addedVia,
    repurchaseCount: positiveIntegerOrNull(value.repurchaseCount) ?? 1,
    thumbnailPath: stringOrNull(value.thumbnailPath),
    createdAt,
    updatedAt: isoStringOrFallback(value.updatedAt, createdAt),
  };
}

function normalizeShelfProducts(
  value: unknown,
  fallbackISO: string,
): { items: ShelfProduct[]; changed: boolean } | null {
  if (!Array.isArray(value)) return null;
  const items: ShelfProduct[] = [];
  let changed = false;
  for (const row of value) {
    const product = normalizeShelfProduct(row, fallbackISO);
    if (!product) {
      changed = true;
      continue;
    }
    items.push(product);
    changed ||= JSON.stringify(product) !== JSON.stringify(row);
  }
  return { items, changed };
}

export async function loadShelf(): Promise<ShelfProduct[]> {
  let raw: string | null = null;
  try {
    raw = await getPrivateItem(KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const normalized = normalizeShelfProducts(JSON.parse(raw) as unknown, nowISO());
    if (!normalized) {
      await removePrivateItem(KEY).catch(() => undefined);
      return [];
    }
    if (normalized.changed) {
      if (normalized.items.length > 0) await persist(normalized.items).catch(() => undefined);
      else await removePrivateItem(KEY).catch(() => undefined);
    }
    return normalized.items;
  } catch {
    await removePrivateItem(KEY).catch(() => undefined);
    return [];
  }
}

async function persist(items: ShelfProduct[]): Promise<void> {
  await setPrivateItem(KEY, JSON.stringify(items));
}

function normalizeProductForWrite(
  value: ShelfProduct,
  fallbackISO: string,
  fallback: ShelfProduct,
): ShelfProduct {
  return normalizeShelfProduct(value, fallbackISO) ?? { ...fallback, updatedAt: fallbackISO };
}

export async function addProduct(input: NewShelfProduct): Promise<ShelfProduct> {
  const items = await loadShelf();
  const ts = nowISO();
  const product: ShelfProduct = {
    id: randomUUID(),
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
    openedAt: input.openedAt ?? null,
    isOpened: input.isOpened ?? true,
    paoMonths: input.paoMonths ?? null,
    paoSource: input.paoSource ?? 'unknown',
    expiryDate: input.expiryDate ?? null,
    expirySource: input.expirySource ?? 'unknown',
    status: 'active',
    finishedAt: null,
    addedVia: input.addedVia,
    repurchaseCount: 1,
    thumbnailPath: null,
    createdAt: ts,
    updatedAt: ts,
  };
  await persist([product, ...items]);
  return product;
}

export async function updateProduct(
  id: string,
  patch: Partial<Omit<ShelfProduct, 'id' | 'createdAt'>>,
): Promise<ShelfProduct | null> {
  const items = await loadShelf();
  const ts = nowISO();
  let updated: ShelfProduct | null = null;
  const next = items.map((product) => {
    if (product.id !== id) return product;
    updated = normalizeProductForWrite(
      {
        ...product,
        ...patch,
        id: product.id,
        createdAt: product.createdAt,
        updatedAt: ts,
      },
      ts,
      product,
    );
    return updated;
  });
  await persist(next);
  return updated;
}

export async function removeProduct(id: string): Promise<ShelfProduct | null> {
  const items = await loadShelf();
  const removed = items.find((product) => product.id === id) ?? null;
  await persist(items.filter((p) => p.id !== id));
  return removed;
}

/**
 * Replenish: archive the current unit and add a fresh one of the same product,
 * resetting the opened-date clock and carrying the repurchase count forward
 * (docs/04 §6 "re-add the same one").
 */
export async function reAddProduct(id: string): Promise<ShelfProduct | null> {
  const items = await loadShelf();
  const prev = items.find((p) => p.id === id);
  if (!prev) return null;
  const ts = nowISO();
  const archived: ShelfProduct = {
    ...prev,
    status: 'finished',
    finishedAt: ts.slice(0, 10),
    updatedAt: ts,
  };
  const fresh: ShelfProduct = {
    ...prev,
    id: randomUUID(),
    openedAt: ts.slice(0, 10),
    isOpened: true,
    status: 'active',
    finishedAt: null,
    repurchaseCount: prev.repurchaseCount + 1,
    createdAt: ts,
    updatedAt: ts,
  };
  await persist([fresh, ...items.map((p) => (p.id === id ? archived : p))]);
  return fresh;
}

/** Test/seed reset. */
export async function clearShelf(): Promise<void> {
  await removePrivateItem(KEY);
}
