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
const SCHEMA_VERSION = 3 as const;
const LEGACY_ENVELOPE_VERSION = 1 as const;
const LEGACY_ADD_OPERATION_ENVELOPE_VERSION = 2 as const;
const MAX_ADD_OPERATION_MAPPINGS = 128;
const ADD_OWNER_HASH_NAMESPACE = 'onskin:shelf-add-owner:v1:';
const ADD_INPUT_HASH_NAMESPACE = 'onskin:shelf-add-input:v1:';
const LOCAL_UNCLAIMED_ADD_OWNER = 'onskin:shelf-local-unclaimed-owner:v1';
const ADD_INPUT_FINGERPRINT_MAX_LOCAL_DATE = '9999-12-31';
const REPLENISHMENT_ID_NAMESPACE = 'onskin:shelf-replenishment:v1:';

export const SHELF_STATE_INVALID = 'SHELF_STATE_INVALID';
export const SHELF_STATE_UNSUPPORTED_VERSION = 'SHELF_STATE_UNSUPPORTED_VERSION';
export const SHELF_STATE_UNAVAILABLE = 'SHELF_STATE_UNAVAILABLE';
export const SHELF_REPLENISHMENT_ALREADY_REPLACED = 'SHELF_REPLENISHMENT_ALREADY_REPLACED';
export const SHELF_ADD_OPERATION_OWNER_MISMATCH = 'SHELF_ADD_OPERATION_OWNER_MISMATCH';
export const SHELF_ADD_OPERATION_INPUT_MISMATCH = 'SHELF_ADD_OPERATION_INPUT_MISMATCH';
export const SHELF_ADD_OPERATION_LIMIT_REACHED = 'SHELF_ADD_OPERATION_LIMIT_REACHED';

const PRODUCT_STATUSES = new Set<ProductStatus>(['active', 'finished', 'discarded']);
const ADDED_VIA = new Set<AddedVia>(['barcode', 'search', 'ocr', 'manual', 'onboarding']);
const FRESHNESS_PATCH_KEYS = [
  'openedAt',
  'isOpened',
  'paoMonths',
  'paoSource',
  'expiryDate',
  'expirySource',
] as const;
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

export type ShelfAddOwner = Readonly<{
  /** Raw owner identity is hashed before it enters encrypted Shelf state. */
  ownerId?: string;
  /** Captured account-generation assertion supplied by the public hook. */
  assertCurrent?: () => void;
  /** Stable caller-owned identity for one explicit add intent. */
  operationId: string;
}>;

type ShelfOperationOwner = Readonly<{
  ownerId?: string;
  assertCurrent?: () => void;
}>;

type ShelfAddOperation = {
  operationId: string;
  ownerHash: string;
  inputHash: string;
  productId: string;
  createdAt: string;
  status: 'pending' | 'acknowledged';
  acknowledgedAt: string | null;
};

type ShelfEnvelope = {
  version: typeof SCHEMA_VERSION;
  products: ShelfProduct[];
  addOperations: ShelfAddOperation[];
};

type DecodedShelfState = {
  products: ShelfProduct[];
  addOperations: ShelfAddOperation[];
  format: ShelfStateFormat | 'absent';
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
  // Persisted local dates must not be reinterpreted against a UTC timestamp on
  // every read. Mutation entry points normalize against the current local date
  // before this strict, clock-independent codec pass.
  const freshness = normalizeShelfFreshness(value, ADD_INPUT_FINGERPRINT_MAX_LOCAL_DATE);

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

const SHA256_HEX = /^[0-9a-f]{64}$/;

function normalizeShelfAddOperations(
  value: unknown,
  products: readonly ShelfProduct[],
  version: typeof SCHEMA_VERSION | typeof LEGACY_ADD_OPERATION_ENVELOPE_VERSION,
): ShelfAddOperation[] | null {
  if (!Array.isArray(value) || value.length > MAX_ADD_OPERATION_MAPPINGS) return null;
  const productIds = new Set(products.map((product) => product.id));
  const operationIds = new Set<string>();
  const productReceipts = new Set<string>();
  const operations: ShelfAddOperation[] = [];

  for (const row of value) {
    const expectedKeys =
      version === LEGACY_ADD_OPERATION_ENVELOPE_VERSION
        ? ['operationId', 'ownerHash', 'inputHash', 'productId', 'createdAt']
        : [
            'operationId',
            'ownerHash',
            'inputHash',
            'productId',
            'createdAt',
            'status',
            'acknowledgedAt',
          ];
    if (
      !isRecord(row) ||
      !hasExactKeys(row, expectedKeys)
    ) {
      return null;
    }
    const operationId = nonEmptyString(row.operationId);
    const productId = nonEmptyString(row.productId);
    const createdAt = isoStringOrNull(row.createdAt);
    if (
      !operationId ||
      operationId.length > 128 ||
      !SHA256_HEX.test(String(row.ownerHash)) ||
      !SHA256_HEX.test(String(row.inputHash)) ||
      !productId ||
      !productIds.has(productId) ||
      !createdAt ||
      operationIds.has(operationId) ||
      productReceipts.has(productId)
    ) {
      return null;
    }
    const ownerHash = String(row.ownerHash);
    const inputHash = String(row.inputHash);
    const status =
      version === LEGACY_ADD_OPERATION_ENVELOPE_VERSION ? 'pending' : row.status;
    const acknowledgedAt =
      version === LEGACY_ADD_OPERATION_ENVELOPE_VERSION
        ? null
        : row.acknowledgedAt === null
          ? null
          : isoStringOrNull(row.acknowledgedAt);
    if (
      (status !== 'pending' && status !== 'acknowledged') ||
      (status === 'pending' && acknowledgedAt !== null) ||
      (status === 'acknowledged' && acknowledgedAt === null)
    ) {
      return null;
    }
    operationIds.add(operationId);
    productReceipts.add(productId);
    operations.push({
      operationId,
      ownerHash,
      inputHash,
      productId,
      createdAt,
      status,
      acknowledgedAt,
    });
  }
  return operations;
}

function decodeShelfState(raw: string | null, fallbackISO = nowISO()): DecodedShelfState {
  if (raw === null) return { products: [], addOperations: [], format: 'absent' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(SHELF_STATE_INVALID);
  }

  if (Array.isArray(parsed)) {
    const legacy = normalizeShelfProducts(parsed, fallbackISO);
    if (!legacy) throw new Error(SHELF_STATE_INVALID);
    return { products: legacy, addOperations: [], format: 'legacy' };
  }
  if (!isRecord(parsed)) throw new Error(SHELF_STATE_INVALID);
  if (
    parsed.version !== SCHEMA_VERSION &&
    parsed.version !== LEGACY_ENVELOPE_VERSION &&
    parsed.version !== LEGACY_ADD_OPERATION_ENVELOPE_VERSION
  ) {
    if (
      typeof parsed.version === 'number' &&
      Number.isSafeInteger(parsed.version) &&
      parsed.version > SCHEMA_VERSION
    ) {
      throw new Error(SHELF_STATE_UNSUPPORTED_VERSION);
    }
    throw new Error(SHELF_STATE_INVALID);
  }
  const isProductOnlyLegacyEnvelope = parsed.version === LEGACY_ENVELOPE_VERSION;
  if (
    !hasExactKeys(
      parsed,
      isProductOnlyLegacyEnvelope
        ? ['version', 'products']
        : ['version', 'products', 'addOperations'],
    )
  ) {
    throw new Error(SHELF_STATE_INVALID);
  }
  const products = normalizeShelfProducts(parsed.products, fallbackISO);
  if (!products || canonicalJson(products) !== canonicalJson(parsed.products)) {
    throw new Error(SHELF_STATE_INVALID);
  }
  if (isProductOnlyLegacyEnvelope) return { products, addOperations: [], format: 'legacy' };
  const addOperationVersion =
    parsed.version === LEGACY_ADD_OPERATION_ENVELOPE_VERSION
      ? LEGACY_ADD_OPERATION_ENVELOPE_VERSION
      : SCHEMA_VERSION;
  const addOperations = normalizeShelfAddOperations(
    parsed.addOperations,
    products,
    addOperationVersion,
  );
  if (!addOperations) {
    throw new Error(SHELF_STATE_INVALID);
  }
  return {
    products,
    addOperations,
    format: parsed.version === SCHEMA_VERSION ? 'current' : 'legacy',
  };
}

function encodeShelfState(products: ShelfProduct[], addOperations: ShelfAddOperation[]): string {
  return JSON.stringify({
    version: SCHEMA_VERSION,
    products,
    addOperations,
  } satisfies ShelfEnvelope);
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

function fingerprintText(value: string | null): string | null {
  return value === null ? null : value.trim();
}

function canonicalAddInput(product: ShelfProduct): string {
  return canonicalJson({
    name: product.name.trim(),
    brand: fingerprintText(product.brand),
    category: fingerprintText(product.category),
    barcode: fingerprintText(product.barcode),
    catalogProductId: fingerprintText(product.catalogProductId),
    catalogSourceId: fingerprintText(product.catalogSourceId),
    catalogSource: fingerprintText(product.catalogSource),
    catalogSourceName: fingerprintText(product.catalogSourceName),
    catalogSourceRef: fingerprintText(product.catalogSourceRef),
    catalogSourceUrl: fingerprintText(product.catalogSourceUrl),
    catalogSourceSnapshotDate: product.catalogSourceSnapshotDate,
    catalogMatchQuality: product.catalogMatchQuality,
    dataQualityScore: product.dataQualityScore,
    ingredientParseStatus: fingerprintText(product.ingredientParseStatus),
    ingredientParseConfidence: product.ingredientParseConfidence,
    parserVersion: fingerprintText(product.parserVersion),
    sourceDisclosureAckAt: fingerprintText(product.sourceDisclosureAckAt),
    ingredients: product.ingredients,
    openedAt: product.openedAt,
    isOpened: product.isOpened,
    paoMonths: product.paoMonths,
    paoSource: product.paoSource,
    expiryDate: product.expiryDate,
    expirySource: product.expirySource,
    addedVia: product.addedVia,
  });
}

async function digestAddIdentity(namespace: string, value: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${namespace}${value}`,
  );
  const normalized = digest.toLowerCase();
  if (!SHA256_HEX.test(normalized)) throw new Error(SHELF_STATE_INVALID);
  return normalized;
}

function normalizedAddOwnerId(owner: ShelfOperationOwner | undefined): string {
  if (owner?.ownerId === undefined) return LOCAL_UNCLAIMED_ADD_OWNER;
  const ownerId = owner.ownerId.trim();
  if (!ownerId || ownerId.length > 512) throw new Error(SHELF_STATE_INVALID);
  return ownerId;
}

function normalizedAddOperationId(owner: ShelfAddOwner): string {
  const operationId = owner?.operationId;
  if (
    typeof operationId !== 'string' ||
    operationId.trim().length === 0 ||
    operationId.trim() !== operationId ||
    operationId.length > 128
  ) {
    throw new Error(SHELF_STATE_INVALID);
  }
  return operationId;
}

function assertShelfAddOwnerCurrent(owner: ShelfOperationOwner | undefined): void {
  owner?.assertCurrent?.();
}

async function shelfAddIdentity(
  product: ShelfProduct,
  owner: ShelfOperationOwner | undefined,
): Promise<{ ownerHash: string; inputHash: string }> {
  assertShelfAddOwnerCurrent(owner);
  const ownerId = normalizedAddOwnerId(owner);
  const [ownerHash, inputHash] = await Promise.all([
    digestAddIdentity(ADD_OWNER_HASH_NAMESPACE, ownerId).then((digest) => {
      assertShelfAddOwnerCurrent(owner);
      return digest;
    }),
    digestAddIdentity(ADD_INPUT_HASH_NAMESPACE, canonicalAddInput(product)).then((digest) => {
      assertShelfAddOwnerCurrent(owner);
      return digest;
    }),
  ]);
  assertShelfAddOwnerCurrent(owner);
  return { ownerHash, inputHash };
}

/**
 * Atomically commits a product and an owner/operation mapping. A retry with the
 * same stable operation id and semantic input returns the original row. An
 * acknowledgement converts the pending mapping to a bounded tombstone rather
 * than deleting the only proof of the committed operation.
 */
export async function addProduct(
  input: NewShelfProduct,
  owner: ShelfAddOwner,
): Promise<ShelfProduct> {
  const ts = nowISO();
  const freshness = normalizeShelfFreshness(input);
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
  const operationId = normalizedAddOperationId(owner);
  // Retry identity must not change as the clock crosses UTC/local midnight.
  // A maximal valid date makes syntactically valid freshness input canonical
  // without applying the first commit's time-dependent future-date policy.
  const fingerprintProduct: ShelfProduct = {
    ...product,
    ...normalizeShelfFreshness(input, ADD_INPUT_FINGERPRINT_MAX_LOCAL_DATE),
  };
  const { ownerHash, inputHash } = await shelfAddIdentity(fingerprintProduct, owner);
  const operation: ShelfAddOperation = {
    operationId,
    ownerHash,
    inputHash,
    productId: product.id,
    createdAt: ts,
    status: 'pending',
    acknowledgedAt: null,
  };
  let result: ShelfProduct | null = null;
  assertShelfAddOwnerCurrent(owner);
  await updatePrivateItem(KEY, (current) => {
    assertShelfAddOwnerCurrent(owner);
    const state = decodeShelfState(current, ts);
    const ownerConflict = state.addOperations.find((existing) => existing.ownerHash !== ownerHash);
    if (ownerConflict) throw new Error(SHELF_ADD_OPERATION_OWNER_MISMATCH);
    const existingOperation = state.addOperations.find(
      (existing) => existing.operationId === operationId,
    );
    if (existingOperation) {
      if (existingOperation.inputHash !== inputHash) {
        throw new Error(SHELF_ADD_OPERATION_INPUT_MISMATCH);
      }
      result =
        state.products.find((existing) => existing.id === existingOperation.productId) ?? null;
      if (!result) throw new Error(SHELF_STATE_INVALID);
      return current;
    }
    let retainedOperations = state.addOperations;
    if (retainedOperations.length >= MAX_ADD_OPERATION_MAPPINGS) {
      const oldestAcknowledged = retainedOperations
        .filter((existing) => existing.status === 'acknowledged')
        .sort((left, right) => {
          const timestampOrder = (left.acknowledgedAt ?? left.createdAt).localeCompare(
            right.acknowledgedAt ?? right.createdAt,
          );
          return timestampOrder || left.operationId.localeCompare(right.operationId);
        })[0];
      if (!oldestAcknowledged) throw new Error(SHELF_ADD_OPERATION_LIMIT_REACHED);
      retainedOperations = retainedOperations.filter(
        (existing) => existing.operationId !== oldestAcknowledged.operationId,
      );
    }
    const items = state.products;
    if (items.some((item) => item.id === product.id)) throw new Error(SHELF_STATE_INVALID);
    result = product;
    return encodeShelfState([product, ...items], [operation, ...retainedOperations]);
  });
  assertShelfAddOwnerCurrent(owner);
  if (!result) throw new Error(SHELF_STATE_INVALID);
  return result;
}

async function addOperationWasAcknowledged(
  productId: string,
  ownerHash: string,
  owner: ShelfOperationOwner | undefined,
): Promise<boolean> {
  assertShelfAddOwnerCurrent(owner);
  let stored: Awaited<ReturnType<typeof readPrivateItem>>;
  try {
    stored = await readPrivateItem(KEY);
  } catch {
    assertShelfAddOwnerCurrent(owner);
    return false;
  }
  assertShelfAddOwnerCurrent(owner);
  if (stored.status === 'absent') return false;
  if (stored.status !== 'available') return false;
  try {
    const state = decodeShelfState(stored.value);
    assertShelfAddOwnerCurrent(owner);
    if (!state.products.some((product) => product.id === productId)) return false;
    const operation = state.addOperations.find((entry) => entry.productId === productId);
    if (!operation) return false;
    if (operation.ownerHash !== ownerHash) {
      throw new Error(SHELF_ADD_OPERATION_OWNER_MISMATCH);
    }
    return operation.status === 'acknowledged';
  } catch (error) {
    if (error instanceof Error && error.message === SHELF_ADD_OPERATION_OWNER_MISMATCH) throw error;
    return false;
  }
}

/** Idempotently tombstones that the current UI received an add result. */
export async function acknowledgeProductAdd(
  productId: string,
  owner?: ShelfOperationOwner,
): Promise<void> {
  const normalizedProductId = nonEmptyString(productId);
  if (!normalizedProductId) throw new Error(SHELF_STATE_INVALID);
  const ownerId = normalizedAddOwnerId(owner);
  assertShelfAddOwnerCurrent(owner);
  const ownerHash = await digestAddIdentity(ADD_OWNER_HASH_NAMESPACE, ownerId);
  assertShelfAddOwnerCurrent(owner);

  try {
    assertShelfAddOwnerCurrent(owner);
    await updatePrivateItem(KEY, (current) => {
      assertShelfAddOwnerCurrent(owner);
      const state = decodeShelfState(current);
      const receipt = state.addOperations.find(
        (operation) => operation.productId === normalizedProductId,
      );
      if (!receipt) return current;
      if (receipt.ownerHash !== ownerHash) {
        throw new Error(SHELF_ADD_OPERATION_OWNER_MISMATCH);
      }
      if (receipt.status === 'acknowledged') return current;
      const acknowledgedAt = nowISO();
      return encodeShelfState(
        state.products,
        state.addOperations.map((operation) =>
          operation.operationId === receipt.operationId
            ? { ...operation, status: 'acknowledged', acknowledgedAt }
            : operation,
        ),
      );
    });
    assertShelfAddOwnerCurrent(owner);
  } catch (error) {
    assertShelfAddOwnerCurrent(owner);
    // Native storage may commit the acknowledgement and lose only its response.
    // Exact typed readback treats only the acknowledged mapping as success.
    if (await addOperationWasAcknowledged(normalizedProductId, ownerHash, owner)) return;
    throw error;
  }
}

export async function updateProduct(
  id: string,
  patch: Partial<Omit<ShelfProduct, 'id' | 'createdAt'>>,
): Promise<ShelfProduct | null> {
  const ts = nowISO();
  let updated: ShelfProduct | null = null;
  await updatePrivateItem(KEY, (current) => {
    const state = decodeShelfState(current, ts);
    const items = state.products;
    let changed = false;
    const next = items.map((product) => {
      if (product.id !== id) return product;
      const patched = {
        ...product,
        ...patch,
        id: product.id,
        createdAt: product.createdAt,
        updatedAt: ts,
      };
      const freshness = FRESHNESS_PATCH_KEYS.some((key) => hasOwn(patch, key))
        ? normalizeShelfFreshness(patched)
        : {
            openedAt: product.openedAt,
            isOpened: product.isOpened,
            paoMonths: product.paoMonths,
            paoSource: product.paoSource,
            expiryDate: product.expiryDate,
            expirySource: product.expirySource,
          };
      const candidate = normalizeShelfProduct({ ...patched, ...freshness }, ts);
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
    return changed ? encodeShelfState(next, state.addOperations) : current;
  });
  return updated;
}

export async function removeProduct(id: string): Promise<ShelfProduct | null> {
  let removed: ShelfProduct | null = null;
  await updatePrivateItem(KEY, (current) => {
    const state = decodeShelfState(current);
    const items = state.products;
    removed = items.find((product) => product.id === id) ?? null;
    return removed
      ? encodeShelfState(
          items.filter((product) => product.id !== id),
          state.addOperations.filter((operation) => operation.productId !== id),
        )
      : current;
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
    const state = decodeShelfState(current, ts);
    const items = state.products;
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
    return encodeShelfState(
      [fresh, ...items.map((product) => (product.id === id ? archived : product))],
      state.addOperations,
    );
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
