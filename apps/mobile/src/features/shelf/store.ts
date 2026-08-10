import { randomUUID } from 'expo-crypto';

import type { AddedVia, ExpirySource, PaoSource, ProductStatus } from '@layerwell/types';
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
import {
  SHELF_PRODUCT_BRAND_MAX_LENGTH,
  SHELF_PRODUCT_NAME_MAX_LENGTH,
  SHELF_PRODUCT_TEXT_MAX_BYTES,
} from './limits';

export {
  SHELF_PRODUCT_BRAND_MAX_LENGTH,
  SHELF_PRODUCT_NAME_MAX_LENGTH,
  SHELF_PRODUCT_TEXT_MAX_BYTES,
} from './limits';

// Local-first shelf store (docs/04 §8: the shelf must work in a bathroom with no
// signal. View, manual-add, and queued lookups all offline). AsyncStorage is the
// source of truth for the versioned shelf envelope (single-user,
// last-write-wins is safe, DECISIONS D-029);
// Each committed lifecycle mutation also appends owner-free Supabase replay
// work inside this same encrypted envelope. The authenticated sync boundary
// supplies the owner later, so a local commit cannot race a separate queue write.
const KEY = 'layerwell.shelf.v1';
const LEGACY_SCHEMA_VERSION = 1 as const;
const PREVIOUS_SCHEMA_VERSION = 2 as const;
const SCHEMA_VERSION = 3 as const;

export const SHELF_STATE_INVALID = 'SHELF_STATE_INVALID';
export const SHELF_STATE_UNSUPPORTED_VERSION = 'SHELF_STATE_UNSUPPORTED_VERSION';

const PRODUCT_STATUSES = new Set<ProductStatus>(['active', 'finished', 'discarded']);
const ADDED_VIA = new Set<AddedVia>(['barcode', 'search', 'ocr', 'manual', 'onboarding']);
const PAO_SOURCES = new Set<PaoSource>(['label', 'catalog', 'category_default', 'unknown']);
const EXPIRY_SOURCES = new Set<ExpirySource>(['printed', 'pao_computed', 'estimated', 'unknown']);
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

/**
 * Owner-free Supabase `user_products` replay bytes. The sync boundary adds the
 * currently authenticated owner from its health-data lease; an account
 * identifier is never retained in this encrypted feature envelope.
 */
export type ShelfMirrorUpsertPayload = {
  id: string;
  catalog_product_id: string | null;
  catalog_source_id: string | null;
  catalog_match_quality: CatalogQualityGrade | 'manual' | null;
  catalog_source_snapshot_date: string | null;
  manual_name: string;
  manual_brand: string | null;
  barcode: string | null;
  opened_at: string | null;
  pao_months: number | null;
  expiry_date: string | null;
  is_opened: boolean;
  pao_source: PaoSource;
  expiry_source: ExpirySource;
  added_via: AddedVia;
  source_disclosure_ack_at: string | null;
  status: ProductStatus;
  finished_at: string | null;
};

type ShelfMirrorOperationBase = {
  operationId: string;
  enqueuedAt: string;
};

export type ShelfMirrorOperation =
  | (ShelfMirrorOperationBase & {
      kind: 'upsert';
      payload: ShelfMirrorUpsertPayload;
    })
  | (ShelfMirrorOperationBase & {
      kind: 'delete';
      productId: string;
    });

export type ShelfMirrorTerminalCode =
  | 'SHELF_PRODUCT_ID_INVALID'
  | 'SHELF_PRODUCT_PAYLOAD_INVALID'
  | 'SHELF_PRODUCT_PROVENANCE_INVALID'
  | 'SHELF_PRODUCT_OWNERSHIP_CONFLICT';

export type ShelfMirrorTerminal = Readonly<{
  operation: ShelfMirrorOperation;
  code: ShelfMirrorTerminalCode;
}>;

export type ShelfMirrorIncompatibilityCode =
  | 'SHELF_MIRROR_PRODUCT_ID_REPAIR_REQUIRED'
  | 'SHELF_MIRROR_NAME_REPAIR_REQUIRED'
  | 'SHELF_MIRROR_BRAND_REPAIR_REQUIRED'
  | 'SHELF_MIRROR_BARCODE_REPAIR_REQUIRED';

export type ShelfMirrorIncompatibility = Readonly<{
  productId: string;
  codes: ShelfMirrorIncompatibilityCode[];
}>;

type ShelfEnvelope = {
  version: typeof SCHEMA_VERSION;
  products: ShelfProduct[];
  mirrorOutbox: ShelfMirrorOperation[];
  terminal: ShelfMirrorTerminal[];
  mirrorIncompatibilities: ShelfMirrorIncompatibility[];
};

type ShelfFreshnessNormalizer = (input: ShelfFreshnessInput, today?: string) => ShelfFreshness;

type DecodedShelfState = {
  products: ShelfProduct[];
  mirrorOutbox: ShelfMirrorOperation[];
  terminal: ShelfMirrorTerminal[];
  mirrorIncompatibilities: ShelfMirrorIncompatibility[];
  upgradeFrom: 'none' | 'legacy' | 'v2';
};

const SHELF_MIRROR_TERMINAL_CODES = new Set<ShelfMirrorTerminalCode>([
  'SHELF_PRODUCT_ID_INVALID',
  'SHELF_PRODUCT_PAYLOAD_INVALID',
  'SHELF_PRODUCT_PROVENANCE_INVALID',
  'SHELF_PRODUCT_OWNERSHIP_CONFLICT',
]);

const shelfMirrorOutboxListeners = new Set<() => void>();

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

const SHELF_PRODUCT_CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/u;
const SHELF_PRODUCT_BARCODE = /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/u;

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function strictShelfProductText(value: unknown, maxCharacters: number): string | null {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxCharacters &&
    value === value.trim() &&
    !SHELF_PRODUCT_CONTROL_CHARACTER.test(value) &&
    utf8ByteLength(value) <= SHELF_PRODUCT_TEXT_MAX_BYTES
    ? value
    : null;
}

function strictShelfProductBarcode(value: unknown): string | null {
  return typeof value === 'string' && SHELF_PRODUCT_BARCODE.test(value) ? value : null;
}

function shelfMirrorIncompatibilityCodes(product: ShelfProduct): ShelfMirrorIncompatibilityCode[] {
  const codes: ShelfMirrorIncompatibilityCode[] = [];
  if (!validCanonicalOperationId(product.id)) {
    codes.push('SHELF_MIRROR_PRODUCT_ID_REPAIR_REQUIRED');
  }
  if (strictShelfProductText(product.name, SHELF_PRODUCT_NAME_MAX_LENGTH) !== product.name) {
    codes.push('SHELF_MIRROR_NAME_REPAIR_REQUIRED');
  }
  if (
    product.brand !== null &&
    strictShelfProductText(product.brand, SHELF_PRODUCT_BRAND_MAX_LENGTH) !== product.brand
  ) {
    codes.push('SHELF_MIRROR_BRAND_REPAIR_REQUIRED');
  }
  if (product.barcode !== null && strictShelfProductBarcode(product.barcode) !== product.barcode) {
    codes.push('SHELF_MIRROR_BARCODE_REPAIR_REQUIRED');
  }
  return codes;
}

function shelfMirrorIncompatibilities(
  products: readonly ShelfProduct[],
): ShelfMirrorIncompatibility[] {
  return products.flatMap((product) => {
    const codes = shelfMirrorIncompatibilityCodes(product);
    return codes.length === 0 ? [] : [{ productId: product.id, codes }];
  });
}

function validCanonicalOperationId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
  );
}

function validCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const timestamp = new Date(value);
  return !Number.isNaN(timestamp.getTime()) && timestamp.toISOString() === value;
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

function mirrorPayloadForProduct(product: ShelfProduct): ShelfMirrorUpsertPayload {
  if (
    !validCanonicalOperationId(product.id) ||
    strictShelfProductText(product.name, SHELF_PRODUCT_NAME_MAX_LENGTH) !== product.name ||
    (product.brand !== null &&
      strictShelfProductText(product.brand, SHELF_PRODUCT_BRAND_MAX_LENGTH) !== product.brand) ||
    (product.barcode !== null && strictShelfProductBarcode(product.barcode) !== product.barcode)
  ) {
    throw new Error(SHELF_STATE_INVALID);
  }
  return {
    id: product.id,
    catalog_product_id: product.catalogProductId,
    catalog_source_id: product.catalogSourceId,
    catalog_match_quality: product.catalogMatchQuality,
    catalog_source_snapshot_date: product.catalogSourceSnapshotDate,
    manual_name: product.name,
    manual_brand: product.brand,
    barcode: product.barcode,
    opened_at: product.openedAt,
    pao_months: product.paoMonths,
    expiry_date: product.expiryDate,
    is_opened: product.isOpened,
    pao_source: product.paoSource,
    expiry_source: product.expirySource,
    added_via: product.addedVia,
    source_disclosure_ack_at: product.sourceDisclosureAckAt,
    status: product.status,
    finished_at: product.finishedAt,
  };
}

const MIRROR_UPSERT_PAYLOAD_KEYS = [
  'id',
  'catalog_product_id',
  'catalog_source_id',
  'catalog_match_quality',
  'catalog_source_snapshot_date',
  'manual_name',
  'manual_brand',
  'barcode',
  'opened_at',
  'pao_months',
  'expiry_date',
  'is_opened',
  'pao_source',
  'expiry_source',
  'added_via',
  'source_disclosure_ack_at',
  'status',
  'finished_at',
] as const;

function decodeShelfMirrorPayload(value: unknown): ShelfMirrorUpsertPayload | null {
  if (!isRecord(value) || !hasExactKeys(value, MIRROR_UPSERT_PAYLOAD_KEYS)) return null;
  const id = typeof value.id === 'string' && validCanonicalOperationId(value.id) ? value.id : null;
  const manualName = strictShelfProductText(value.manual_name, SHELF_PRODUCT_NAME_MAX_LENGTH);
  const catalogProductId = stringOrNull(value.catalog_product_id);
  const catalogSourceId = stringOrNull(value.catalog_source_id);
  const catalogMatchQuality = catalogQualityOrNull(value.catalog_match_quality);
  const catalogSourceSnapshotDate = localDateOrNull(value.catalog_source_snapshot_date);
  const manualBrand =
    value.manual_brand === null
      ? null
      : strictShelfProductText(value.manual_brand, SHELF_PRODUCT_BRAND_MAX_LENGTH);
  const barcode = value.barcode === null ? null : strictShelfProductBarcode(value.barcode);
  const openedAt = localDateOrNull(value.opened_at);
  const expiryDate = localDateOrNull(value.expiry_date);
  const sourceDisclosureAckAt = isoStringOrNull(value.source_disclosure_ack_at);
  const finishedAt = localDateOrNull(value.finished_at);

  if (
    !id ||
    !manualName ||
    (value.catalog_product_id !== null && catalogProductId === null) ||
    (value.catalog_source_id !== null && catalogSourceId === null) ||
    (value.catalog_match_quality !== null && catalogMatchQuality === null) ||
    (value.catalog_source_snapshot_date !== null && catalogSourceSnapshotDate === null) ||
    (value.manual_brand !== null && manualBrand === null) ||
    (value.barcode !== null && barcode === null) ||
    (value.opened_at !== null && openedAt === null) ||
    (value.expiry_date !== null && expiryDate === null) ||
    (value.source_disclosure_ack_at !== null && sourceDisclosureAckAt === null) ||
    (value.finished_at !== null && finishedAt === null) ||
    typeof value.is_opened !== 'boolean' ||
    typeof value.pao_source !== 'string' ||
    !PAO_SOURCES.has(value.pao_source as PaoSource) ||
    typeof value.expiry_source !== 'string' ||
    !EXPIRY_SOURCES.has(value.expiry_source as ExpirySource) ||
    typeof value.added_via !== 'string' ||
    !ADDED_VIA.has(value.added_via as AddedVia) ||
    typeof value.status !== 'string' ||
    !PRODUCT_STATUSES.has(value.status as ProductStatus) ||
    (value.pao_months !== null &&
      (typeof value.pao_months !== 'number' ||
        !Number.isInteger(value.pao_months) ||
        value.pao_months < 1 ||
        value.pao_months > 120))
  ) {
    return null;
  }

  return {
    id,
    catalog_product_id: catalogProductId,
    catalog_source_id: catalogSourceId,
    catalog_match_quality: catalogMatchQuality,
    catalog_source_snapshot_date: catalogSourceSnapshotDate,
    manual_name: manualName,
    manual_brand: manualBrand,
    barcode,
    opened_at: openedAt,
    pao_months: value.pao_months as number | null,
    expiry_date: expiryDate,
    is_opened: value.is_opened,
    pao_source: value.pao_source as PaoSource,
    expiry_source: value.expiry_source as ExpirySource,
    added_via: value.added_via as AddedVia,
    source_disclosure_ack_at: sourceDisclosureAckAt,
    status: value.status as ProductStatus,
    finished_at: finishedAt,
  };
}

function decodeShelfMirrorOperation(value: unknown): ShelfMirrorOperation | null {
  if (
    !isRecord(value) ||
    !validCanonicalOperationId(value.operationId) ||
    !validCanonicalTimestamp(value.enqueuedAt)
  ) {
    return null;
  }
  if (value.kind === 'upsert') {
    if (!hasExactKeys(value, ['operationId', 'enqueuedAt', 'kind', 'payload'])) return null;
    const payload = decodeShelfMirrorPayload(value.payload);
    return payload === null
      ? null
      : {
          operationId: value.operationId,
          enqueuedAt: value.enqueuedAt,
          kind: 'upsert',
          payload,
        };
  }
  if (
    value.kind !== 'delete' ||
    !hasExactKeys(value, ['operationId', 'enqueuedAt', 'kind', 'productId'])
  ) {
    return null;
  }
  const productId =
    typeof value.productId === 'string' && validCanonicalOperationId(value.productId)
      ? value.productId
      : null;
  return productId === null
    ? null
    : {
        operationId: value.operationId,
        enqueuedAt: value.enqueuedAt,
        kind: 'delete',
        productId,
      };
}

function decodeShelfMirrorOutbox(value: unknown): ShelfMirrorOperation[] | null {
  if (!Array.isArray(value)) return null;
  const operations: ShelfMirrorOperation[] = [];
  const operationIds = new Set<string>();
  for (const candidate of value) {
    const operation = decodeShelfMirrorOperation(candidate);
    if (operation === null || operationIds.has(operation.operationId)) return null;
    operationIds.add(operation.operationId);
    operations.push(operation);
  }
  return operations;
}

function decodeShelfMirrorTerminal(value: unknown): ShelfMirrorTerminal[] | null {
  if (!Array.isArray(value)) return null;
  const terminal: ShelfMirrorTerminal[] = [];
  const operationIds = new Set<string>();
  for (const candidate of value) {
    if (!isRecord(candidate) || !hasExactKeys(candidate, ['operation', 'code'])) return null;
    const operation = decodeShelfMirrorOperation(candidate.operation);
    if (
      operation === null ||
      operationIds.has(operation.operationId) ||
      typeof candidate.code !== 'string' ||
      !SHELF_MIRROR_TERMINAL_CODES.has(candidate.code as ShelfMirrorTerminalCode)
    ) {
      return null;
    }
    operationIds.add(operation.operationId);
    terminal.push({
      operation,
      code: candidate.code as ShelfMirrorTerminalCode,
    });
  }
  return terminal;
}

function normalizeShelfProduct(
  value: unknown,
  fallbackISO: string,
  freshnessNormalizer: ShelfFreshnessNormalizer = normalizeShelfFreshness,
  freshnessToday: string | null = currentLocalDate(),
  includeV2Fields = true,
  allowLegacyMirrorFields = false,
): ShelfProduct | null {
  if (!isRecord(value)) return null;
  const id = nonEmptyString(value.id);
  const name = allowLegacyMirrorFields
    ? nonEmptyString(value.name)
    : strictShelfProductText(value.name, SHELF_PRODUCT_NAME_MAX_LENGTH);
  if (!id || !name) return null;
  const brand =
    value.brand === null || value.brand === undefined
      ? null
      : allowLegacyMirrorFields
        ? nonEmptyString(value.brand)
        : strictShelfProductText(value.brand, SHELF_PRODUCT_BRAND_MAX_LENGTH);
  const barcode =
    value.barcode === null || value.barcode === undefined
      ? null
      : allowLegacyMirrorFields
        ? nonEmptyString(value.barcode)
        : strictShelfProductBarcode(value.barcode);
  if (
    (value.brand !== null && value.brand !== undefined && brand === null) ||
    (value.barcode !== null && value.barcode !== undefined && barcode === null)
  ) {
    return null;
  }

  const addedVia = enumValue(value.addedVia, ADDED_VIA, 'manual');
  const catalogSource =
    stringOrNull(value.catalogSource) ?? (addedVia === 'manual' ? 'user_local' : null);
  const catalogMatchQuality =
    catalogQualityOrNull(value.catalogMatchQuality) ?? (addedVia === 'manual' ? 'manual' : null);
  const status = enumValue(value.status, PRODUCT_STATUSES, 'active');
  const createdAt = isoStringOrFallback(value.createdAt, fallbackISO);
  const updatedAt = isoStringOrFallback(value.updatedAt, createdAt);
  const freshness = freshnessNormalizer(value, freshnessToday ?? utcCalendarDayPlusOne(updatedAt));
  const legacyUnverifiedExpiryDate =
    freshness.expiryDate === null ? validLocalDate(value.legacyUnverifiedExpiryDate) : null;

  const replacementRootId = nonEmptyString(value.replacementRootId) ?? id;
  return {
    id,
    name,
    brand,
    category: stringOrNull(value.category),
    barcode,
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
    Pick<ShelfProduct, 'replacementRootId' | 'replacesProductId' | 'replacementLineageAmbiguous'>
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
    const ambiguous = ordered.length > 1 && (!uniqueConsecutive || !chronological || !exactChain);
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
  allowLegacyMirrorFields = false,
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
      allowLegacyMirrorFields,
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

function canonicalV1Product(
  product: ShelfProduct,
): Omit<
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
  if (raw === null) {
    return {
      products: [],
      mirrorOutbox: [],
      terminal: [],
      mirrorIncompatibilities: [],
      upgradeFrom: 'none',
    };
  }
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
      true,
      true,
    );
    if (!legacy) throw new Error(SHELF_STATE_INVALID);
    return {
      products: legacy,
      mirrorOutbox: [],
      terminal: [],
      mirrorIncompatibilities: shelfMirrorIncompatibilities(legacy),
      upgradeFrom: 'legacy',
    };
  }
  if (!isRecord(parsed)) throw new Error(SHELF_STATE_INVALID);
  if (
    parsed.version !== LEGACY_SCHEMA_VERSION &&
    parsed.version !== PREVIOUS_SCHEMA_VERSION &&
    parsed.version !== SCHEMA_VERSION
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
  if (parsed.version === LEGACY_SCHEMA_VERSION) {
    if (!hasExactKeys(parsed, ['version', 'products'])) throw new Error(SHELF_STATE_INVALID);
    const historical = normalizeShelfProducts(
      parsed.products,
      fallbackISO,
      normalizeShelfFreshnessV1,
      null,
      false,
      true,
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
      true,
      true,
    );
    const upgraded = current ? attachHistoricalReplacementLineage(current) : null;
    if (!upgraded) throw new Error(SHELF_STATE_INVALID);
    return {
      products: upgraded,
      mirrorOutbox: [],
      terminal: [],
      mirrorIncompatibilities: shelfMirrorIncompatibilities(upgraded),
      upgradeFrom: 'legacy',
    };
  }
  if (parsed.version === PREVIOUS_SCHEMA_VERSION) {
    if (!hasExactKeys(parsed, ['version', 'products'])) throw new Error(SHELF_STATE_INVALID);
    const products = normalizeShelfProducts(
      parsed.products,
      fallbackISO,
      normalizeShelfFreshness,
      null,
      true,
      true,
    );
    if (!products || raw !== JSON.stringify({ version: PREVIOUS_SCHEMA_VERSION, products })) {
      throw new Error(SHELF_STATE_INVALID);
    }
    return {
      products,
      mirrorOutbox: [],
      terminal: [],
      mirrorIncompatibilities: shelfMirrorIncompatibilities(products),
      upgradeFrom: 'v2',
    };
  }
  if (
    !hasExactKeys(parsed, [
      'version',
      'products',
      'mirrorOutbox',
      'terminal',
      'mirrorIncompatibilities',
    ])
  ) {
    throw new Error(SHELF_STATE_INVALID);
  }
  // Canonical persisted bytes must remain valid after a timezone/date-line
  // change. Bind future-date validation to each row's persisted write instant,
  // not the device's current calendar date.
  const products = normalizeShelfProducts(
    parsed.products,
    fallbackISO,
    normalizeShelfFreshness,
    null,
    true,
    true,
  );
  const mirrorOutbox = decodeShelfMirrorOutbox(parsed.mirrorOutbox);
  const terminal = decodeShelfMirrorTerminal(parsed.terminal);
  const mirrorIncompatibilities = shelfMirrorIncompatibilities(products ?? []);
  if (
    !products ||
    !mirrorOutbox ||
    !terminal ||
    JSON.stringify(parsed.mirrorIncompatibilities) !== JSON.stringify(mirrorIncompatibilities) ||
    terminal.some(({ operation }) =>
      mirrorOutbox.some((pending) => pending.operationId === operation.operationId),
    ) ||
    raw !== encodeShelfState(products, mirrorOutbox, terminal)
  ) {
    throw new Error(SHELF_STATE_INVALID);
  }
  return {
    products,
    mirrorOutbox,
    terminal,
    mirrorIncompatibilities,
    upgradeFrom: 'none',
  };
}

function encodeShelfState(
  products: ShelfProduct[],
  mirrorOutbox: ShelfMirrorOperation[],
  terminal: ShelfMirrorTerminal[],
): string {
  return JSON.stringify({
    version: SCHEMA_VERSION,
    products,
    mirrorOutbox,
    terminal,
    mirrorIncompatibilities: shelfMirrorIncompatibilities(products),
  } satisfies ShelfEnvelope);
}

function createMirrorOperationId(outbox: readonly ShelfMirrorOperation[]): string {
  const used = new Set(outbox.map((operation) => operation.operationId));
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const operationId = randomUUID().toLowerCase();
    if (validCanonicalOperationId(operationId) && !used.has(operationId)) return operationId;
  }
  throw new Error(SHELF_STATE_INVALID);
}

function appendMirrorUpsert(
  outbox: ShelfMirrorOperation[],
  product: ShelfProduct,
  enqueuedAt: string,
): boolean {
  if (shelfMirrorIncompatibilityCodes(product).length > 0) return false;
  outbox.push({
    operationId: createMirrorOperationId(outbox),
    enqueuedAt,
    kind: 'upsert',
    payload: mirrorPayloadForProduct(product),
  });
  return true;
}

function appendMirrorDelete(
  outbox: ShelfMirrorOperation[],
  productId: string,
  enqueuedAt: string,
): void {
  outbox.push({
    operationId: createMirrorOperationId(outbox),
    enqueuedAt,
    kind: 'delete',
    productId,
  });
}

function prepareShelfStateForWrite(
  decoded: DecodedShelfState,
  enqueuedAt: string,
): {
  products: ShelfProduct[];
  mirrorOutbox: ShelfMirrorOperation[];
  terminal: ShelfMirrorTerminal[];
  mirrorIncompatibilities: ShelfMirrorIncompatibility[];
  outboxChanged: boolean;
} {
  const mirrorOutbox = [...decoded.mirrorOutbox];
  if (decoded.upgradeFrom === 'v2') {
    // v2 contains canonical, fully validated products but no durable retry
    // state. An owner-free idempotent upsert is safe; a historical delete can
    // never be inferred from rows that remain, so no delete is fabricated.
    for (const product of decoded.products) {
      if (shelfMirrorIncompatibilityCodes(product).length === 0) {
        appendMirrorUpsert(mirrorOutbox, product, enqueuedAt);
      }
    }
  }
  return {
    products: decoded.products,
    mirrorOutbox,
    terminal: decoded.terminal,
    mirrorIncompatibilities: decoded.mirrorIncompatibilities,
    outboxChanged: mirrorOutbox.length !== decoded.mirrorOutbox.length,
  };
}

function notifyShelfMirrorOutboxChanged(): void {
  for (const listener of shelfMirrorOutboxListeners) {
    try {
      listener();
    } catch {
      // A UI/worker listener cannot retroactively fail an already-committed
      // private transaction. Consumers re-read the durable FIFO on wake.
    }
  }
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

/** Deterministic, non-sensitive repair evidence for locally readable products
 * that cannot yet satisfy the server mirror contract. */
export function getShelfMirrorIncompatibilities(): Promise<ShelfMirrorIncompatibility[]> {
  return runCurrentHealthDataOperation(async (lease) => {
    lease.assertCurrent();
    const raw = await getPrivateItem(KEY);
    lease.assertCurrent();
    const decoded = decodeShelfState(raw);
    lease.assertCurrent();
    return decoded.mirrorIncompatibilities;
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
    const productId = (input.operationId ?? randomUUID()).toLowerCase();
    if (!validCanonicalOperationId(productId)) {
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
    let outboxChanged = false;
    lease.assertCurrent();
    await updatePrivateItem(KEY, (current) => {
      lease.assertCurrent();
      const decoded = decodeShelfState(current, ts);
      const prepared = prepareShelfStateForWrite(decoded, ts);
      const items = prepared.products;
      const mirrorOutbox = prepared.mirrorOutbox;
      outboxChanged = prepared.outboxChanged;
      const existing = items.find((item) => item.id === product.id);
      if (existing) {
        committed = existing;
        return decoded.upgradeFrom === 'none'
          ? current
          : encodeShelfState(items, mirrorOutbox, prepared.terminal);
      }
      appendMirrorUpsert(mirrorOutbox, product, ts);
      outboxChanged = true;
      lease.assertCurrent();
      return encodeShelfState([product, ...items], mirrorOutbox, prepared.terminal);
    });
    lease.assertCurrent();
    if (outboxChanged) notifyShelfMirrorOutboxChanged();
    return committed;
  });
}

export async function updateProduct(
  id: string,
  patch: Partial<Omit<ShelfProduct, 'id' | 'createdAt'>>,
): Promise<ShelfProduct | null> {
  if (
    (Object.hasOwn(patch, 'name') &&
      strictShelfProductText(patch.name, SHELF_PRODUCT_NAME_MAX_LENGTH) === null) ||
    (Object.hasOwn(patch, 'brand') &&
      patch.brand !== null &&
      strictShelfProductText(patch.brand, SHELF_PRODUCT_BRAND_MAX_LENGTH) === null) ||
    (Object.hasOwn(patch, 'barcode') &&
      patch.barcode !== null &&
      strictShelfProductBarcode(patch.barcode) === null)
  ) {
    throw new Error(SHELF_STATE_INVALID);
  }
  return runCurrentHealthDataOperation(async (lease) => {
    const ts = nowISO();
    let updated: ShelfProduct | null = null;
    let outboxChanged = false;
    lease.assertCurrent();
    await updatePrivateItem(KEY, (current) => {
      lease.assertCurrent();
      const decoded = decodeShelfState(current, ts);
      const prepared = prepareShelfStateForWrite(decoded, ts);
      const items = prepared.products;
      const mirrorOutbox = prepared.mirrorOutbox;
      outboxChanged = prepared.outboxChanged;
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
        appendMirrorUpsert(mirrorOutbox, updated, ts);
        outboxChanged = true;
        return updated;
      });
      lease.assertCurrent();
      if (updated) return encodeShelfState(next, mirrorOutbox, prepared.terminal);
      return decoded.upgradeFrom === 'v2'
        ? encodeShelfState(items, mirrorOutbox, prepared.terminal)
        : current;
    });
    lease.assertCurrent();
    if (outboxChanged) notifyShelfMirrorOutboxChanged();
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
  if (
    input.useCatalogIdentity &&
    (strictShelfProductText(input.catalogName, SHELF_PRODUCT_NAME_MAX_LENGTH) === null ||
      (input.catalogBrand !== null &&
        strictShelfProductText(input.catalogBrand, SHELF_PRODUCT_BRAND_MAX_LENGTH) === null))
  ) {
    return Promise.reject(new Error(SHELF_STATE_INVALID));
  }
  return runCurrentHealthDataOperation(async (lease) => {
    const ts = nowISO();
    let result: CatalogRecoveryProductUpdateResult = { status: 'missing' };
    let outboxChanged = false;
    lease.assertCurrent();
    await updatePrivateItem(KEY, (current) => {
      lease.assertCurrent();
      const decoded = decodeShelfState(current, ts);
      const prepared = prepareShelfStateForWrite(decoded, ts);
      const items = prepared.products;
      const mirrorOutbox = prepared.mirrorOutbox;
      outboxChanged = prepared.outboxChanged;
      const index = items.findIndex((product) => product.id === input.id);
      if (index < 0) {
        return decoded.upgradeFrom === 'v2'
          ? encodeShelfState(items, mirrorOutbox, prepared.terminal)
          : current;
      }

      const existing = items[index]!;
      if (existing.updatedAt !== input.expectedUpdatedAt) {
        result = { status: 'stale' };
        return decoded.upgradeFrom === 'v2'
          ? encodeShelfState(items, mirrorOutbox, prepared.terminal)
          : current;
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
      appendMirrorUpsert(mirrorOutbox, updated, ts);
      outboxChanged = true;
      lease.assertCurrent();
      return encodeShelfState(next, mirrorOutbox, prepared.terminal);
    });
    lease.assertCurrent();
    if (outboxChanged) notifyShelfMirrorOutboxChanged();
    return result;
  });
}

export async function removeProduct(id: string): Promise<ShelfProduct | null> {
  return runCurrentHealthDataOperation(async (lease) => {
    const ts = nowISO();
    let removed: ShelfProduct | null = null;
    let outboxChanged = false;
    lease.assertCurrent();
    await updatePrivateItem(KEY, (current) => {
      lease.assertCurrent();
      const decoded = decodeShelfState(current, ts);
      const prepared = prepareShelfStateForWrite(decoded, ts);
      const items = prepared.products;
      const mirrorOutbox = prepared.mirrorOutbox;
      outboxChanged = prepared.outboxChanged;
      removed = items.find((product) => product.id === id) ?? null;
      if (removed && validCanonicalOperationId(id)) {
        appendMirrorDelete(mirrorOutbox, id, ts);
        outboxChanged = true;
      }
      lease.assertCurrent();
      if (removed) {
        return encodeShelfState(
          items.filter((product) => product.id !== id),
          mirrorOutbox,
          prepared.terminal,
        );
      }
      return decoded.upgradeFrom === 'v2'
        ? encodeShelfState(items, mirrorOutbox, prepared.terminal)
        : current;
    });
    lease.assertCurrent();
    if (outboxChanged) notifyShelfMirrorOutboxChanged();
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
    const replacementId = operationId.toLowerCase();
    if (!validCanonicalOperationId(replacementId)) throw new Error(SHELF_STATE_INVALID);
    let fresh: ShelfProduct | null = null;
    let outboxChanged = false;
    lease.assertCurrent();
    await updatePrivateItem(KEY, (current) => {
      lease.assertCurrent();
      const decoded = decodeShelfState(current, ts);
      const prepared = prepareShelfStateForWrite(decoded, ts);
      const items = prepared.products;
      const mirrorOutbox = prepared.mirrorOutbox;
      outboxChanged = prepared.outboxChanged;
      const prev = items.find((product) => product.id === id);
      if (!prev) {
        lease.assertCurrent();
        return decoded.upgradeFrom === 'v2'
          ? encodeShelfState(items, mirrorOutbox, prepared.terminal)
          : current;
      }
      const existingOperation = items.find((product) => product.id === replacementId);
      const replacementRootId = prev.replacementRootId ?? prev.id;
      if (existingOperation) {
        if (
          existingOperation.repurchaseCount > prev.repurchaseCount &&
          existingOperation.replacementRootId === replacementRootId
        ) {
          fresh = existingOperation;
          return decoded.upgradeFrom === 'v2'
            ? encodeShelfState(items, mirrorOutbox, prepared.terminal)
            : current;
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
        if (descendants.length > 0) {
          return decoded.upgradeFrom === 'v2'
            ? encodeShelfState(items, mirrorOutbox, prepared.terminal)
            : current;
        }
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
      appendMirrorUpsert(mirrorOutbox, archived, ts);
      appendMirrorUpsert(mirrorOutbox, fresh, ts);
      outboxChanged = true;
      lease.assertCurrent();
      return encodeShelfState(
        [fresh, ...items.map((product) => (product.id === id ? archived : product))],
        mirrorOutbox,
        prepared.terminal,
      );
    });
    lease.assertCurrent();
    if (outboxChanged) notifyShelfMirrorOutboxChanged();
    return fresh;
  });
}

/**
 * Return the durable owner-free FIFO. Reading this API also performs the one
 * safe v2 migration: canonical rows become idempotent upserts, while no delete
 * is inferred. Malformed or future bytes fail closed instead of looking like an
 * empty/successfully drained queue.
 */
export function getPendingShelfMirrorOperations(): Promise<ShelfMirrorOperation[]> {
  return runCurrentHealthDataOperation(async (lease) => {
    const ts = nowISO();
    let pending: ShelfMirrorOperation[] = [];
    let outboxChanged = false;
    lease.assertCurrent();
    await updatePrivateItem(KEY, (current) => {
      lease.assertCurrent();
      const decoded = decodeShelfState(current, ts);
      const prepared = prepareShelfStateForWrite(decoded, ts);
      pending = prepared.mirrorOutbox;
      outboxChanged = prepared.outboxChanged;
      if (decoded.upgradeFrom !== 'v2') return current;
      return encodeShelfState(prepared.products, prepared.mirrorOutbox, prepared.terminal);
    });
    lease.assertCurrent();
    if (outboxChanged) notifyShelfMirrorOutboxChanged();
    return pending;
  });
}

/**
 * Acknowledge exactly the current FIFO head. An out-of-order or unknown
 * operation never discards work and returns false.
 */
export function acknowledgeShelfMirrorOperation(operationId: string): Promise<boolean> {
  if (!validCanonicalOperationId(operationId)) {
    return Promise.reject(new Error(SHELF_STATE_INVALID));
  }
  return runCurrentHealthDataOperation(async (lease) => {
    const ts = nowISO();
    let acknowledged = false;
    let outboxChanged = false;
    lease.assertCurrent();
    await updatePrivateItem(KEY, (current) => {
      lease.assertCurrent();
      const decoded = decodeShelfState(current, ts);
      const prepared = prepareShelfStateForWrite(decoded, ts);
      const [head] = prepared.mirrorOutbox;
      if (head?.operationId === operationId) {
        prepared.mirrorOutbox.shift();
        acknowledged = true;
        outboxChanged = true;
        return encodeShelfState(prepared.products, prepared.mirrorOutbox, prepared.terminal);
      }
      outboxChanged = prepared.outboxChanged;
      return decoded.upgradeFrom === 'v2'
        ? encodeShelfState(prepared.products, prepared.mirrorOutbox, prepared.terminal)
        : current;
    });
    lease.assertCurrent();
    if (outboxChanged) notifyShelfMirrorOutboxChanged();
    return acknowledged;
  });
}

/**
 * Atomically move only the current FIFO head to the governed terminal lane.
 * The complete canonical operation is retained with the exact server code so
 * support/export tooling can diagnose it without reconstructing lost intent.
 */
export function rejectShelfMirrorOperation(
  operationId: string,
  code: ShelfMirrorTerminalCode,
): Promise<boolean> {
  if (!validCanonicalOperationId(operationId) || !SHELF_MIRROR_TERMINAL_CODES.has(code)) {
    return Promise.reject(new Error(SHELF_STATE_INVALID));
  }
  return runCurrentHealthDataOperation(async (lease) => {
    const ts = nowISO();
    let rejected = false;
    let outboxChanged = false;
    lease.assertCurrent();
    await updatePrivateItem(KEY, (current) => {
      lease.assertCurrent();
      const decoded = decodeShelfState(current, ts);
      const prepared = prepareShelfStateForWrite(decoded, ts);
      const [head] = prepared.mirrorOutbox;
      if (head?.operationId === operationId) {
        prepared.mirrorOutbox.shift();
        const terminal = [...prepared.terminal, { operation: head, code }];
        rejected = true;
        outboxChanged = true;
        return encodeShelfState(prepared.products, prepared.mirrorOutbox, terminal);
      }
      outboxChanged = prepared.outboxChanged;
      return decoded.upgradeFrom === 'v2'
        ? encodeShelfState(prepared.products, prepared.mirrorOutbox, prepared.terminal)
        : current;
    });
    lease.assertCurrent();
    if (outboxChanged) notifyShelfMirrorOutboxChanged();
    return rejected;
  });
}

/**
 * Durable evidence used only after the completion RPC reports that this exact
 * product identity is still absent. Pending corrective Shelf work suppresses
 * the inference so replay can establish the identity first.
 */
export function hasUnresolvedTerminalShelfMirrorOperationForProduct(
  productId: string,
): Promise<boolean> {
  if (!validCanonicalOperationId(productId)) {
    return Promise.reject(new Error(SHELF_STATE_INVALID));
  }
  return runCurrentHealthDataOperation(async (lease) => {
    lease.assertCurrent();
    const raw = await getPrivateItem(KEY);
    lease.assertCurrent();
    const decoded = decodeShelfState(raw);
    const operationProductId = (operation: ShelfMirrorOperation): string =>
      operation.kind === 'upsert' ? operation.payload.id : operation.productId;
    const hasPendingCorrection = decoded.mirrorOutbox.some(
      (operation) => operationProductId(operation) === productId,
    );
    const hasTerminalFact = decoded.terminal.some(
      ({ operation }) => operationProductId(operation) === productId,
    );
    lease.assertCurrent();
    return hasTerminalFact && !hasPendingCorrection;
  });
}

/** Subscribe to committed FIFO changes. No product or owner bytes are emitted. */
export function subscribeShelfMirrorOutboxChanges(listener: () => void): () => void {
  shelfMirrorOutboxListeners.add(listener);
  return () => {
    shelfMirrorOutboxListeners.delete(listener);
  };
}

/** Test/seed reset. */
export async function clearShelf(): Promise<void> {
  // Closed-consent cleanup: deletion is account-scoped and never reads plaintext.
  await removePrivateItem(KEY);
  notifyShelfMirrorOutboxChanged();
}
