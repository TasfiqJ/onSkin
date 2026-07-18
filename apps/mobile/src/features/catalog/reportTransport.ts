import { normalizeCanonicalProductBarcode } from '@/features/native/camera/barcode';

export type CatalogCorrectionType =
  | 'wrong_match'
  | 'missing_product'
  | 'ingredient_issue'
  | 'duplicate'
  | 'source_issue'
  | 'expiry_issue'
  | 'category_issue';

export type CatalogCorrectionStatus = 'open' | 'triaged' | 'accepted' | 'rejected' | 'closed';

type CatalogReportScalar = string | number | boolean | null;
type CatalogReportPayloadKey =
  | 'productName'
  | 'brand'
  | 'category'
  | 'ingredientsText'
  | 'sourceUrl'
  | 'sourceName'
  | 'defaultPaoMonths'
  | 'qualityIssue'
  | 'suggestedCorrection';
type CatalogReportContextKey =
  | 'addedVia'
  | 'quality'
  | 'source'
  | 'platform'
  | 'appVersion'
  | 'buildNumber'
  | 'route';

export type CatalogReportInput = {
  reportRequestId?: string | null;
  correctionType: CatalogCorrectionType;
  productId?: string | null;
  barcode?: string | null;
  description?: string | null;
  proposedPayload?: Partial<Record<CatalogReportPayloadKey, CatalogReportScalar>>;
  clientContext?: Partial<Record<CatalogReportContextKey, CatalogReportScalar>>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RANDOM_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SENSITIVE_TEXT =
  /(access[_-]?token|refresh[_-]?token|authorization|bearer|jwt|signed[_-]?url|localuri|local_uri|file:|[a-z]:\\|\/data\/|\/var\/mobile\/|photo|image|email|phone|address|user[_-]?id|app[_-]?user[_-]?id|pregnan|diagnos|medical|medication|prescription|allerg|free[_-]?text|message|ask prompt)/i;
const SECRET_OR_LOCAL_ARTIFACT_TEXT =
  /(?:access[_ -]?token|refresh[_ -]?token|authorization|bearer|jwt|signed[_ -]?url|local[_ -]?uri|file:|[a-z]:\\|\/data\/|\/var\/mobile\/|\.(?:heic|jpe?g|png)(?:\s|$))/i;
const EMAIL_ADDRESS_TEXT = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;
const FORMATTED_PHONE_NUMBER_TEXT =
  /(?:^|\s)(?:\+\d{7,15}|\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4})(?:\s|$)/;
const PRODUCT_STRING_KEYS = new Set<CatalogReportPayloadKey>([
  'productName',
  'brand',
  'category',
  'ingredientsText',
  'sourceName',
]);
const PAYLOAD_KEYS = new Set<CatalogReportPayloadKey>([
  'productName',
  'brand',
  'category',
  'ingredientsText',
  'sourceUrl',
  'sourceName',
  'defaultPaoMonths',
  'qualityIssue',
  'suggestedCorrection',
]);
const CONTEXT_KEYS = new Set<CatalogReportContextKey>([
  'addedVia',
  'quality',
  'source',
  'platform',
  'appVersion',
  'buildNumber',
  'route',
]);

function normalizedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function safeOperationalString(value: unknown, maxLength: number): string | null {
  const normalized = normalizedString(value, maxLength);
  return normalized && !SENSITIVE_TEXT.test(normalized) ? normalized : null;
}

function safeProductString(value: unknown, maxLength: number): string | null {
  const normalized = normalizedString(value, maxLength);
  if (
    !normalized ||
    SECRET_OR_LOCAL_ARTIFACT_TEXT.test(normalized) ||
    EMAIL_ADDRESS_TEXT.test(normalized) ||
    FORMATTED_PHONE_NUMBER_TEXT.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function safeUrl(value: unknown): string | null {
  const raw = safeProductString(value, 300);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    const normalized = `${url.origin}${url.pathname}`;
    return normalized.length <= 300 && !SECRET_OR_LOCAL_ARTIFACT_TEXT.test(normalized)
      ? normalized
      : null;
  } catch {
    return null;
  }
}

function safeScalar(
  key: CatalogReportPayloadKey | CatalogReportContextKey,
  value: unknown,
): CatalogReportScalar | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const maxLength = key === 'ingredientsText' ? 1500 : key === 'sourceUrl' ? 300 : 200;
  if (key === 'sourceUrl') return safeUrl(value) ?? undefined;
  if (PRODUCT_STRING_KEYS.has(key as CatalogReportPayloadKey)) {
    return safeProductString(value, maxLength) ?? undefined;
  }
  return safeOperationalString(value, maxLength) ?? undefined;
}

/** Canonical request-body sanitizer used by both confirmation UI and transport. */
export function catalogReportTransportInput(input: CatalogReportInput): CatalogReportInput {
  const proposedPayload: CatalogReportInput['proposedPayload'] = {};
  for (const [rawKey, rawValue] of Object.entries(input.proposedPayload ?? {})) {
    // Runtime defense for old clients or casts: barcode identity is top-level only.
    if (rawKey === 'barcode') continue;
    const key = rawKey as CatalogReportPayloadKey;
    if (!PAYLOAD_KEYS.has(key)) continue;
    const safe = safeScalar(key, rawValue);
    if (safe !== undefined) proposedPayload[key] = safe;
  }

  const clientContext: CatalogReportInput['clientContext'] = {};
  for (const [rawKey, rawValue] of Object.entries(input.clientContext ?? {})) {
    const key = rawKey as CatalogReportContextKey;
    if (!CONTEXT_KEYS.has(key)) continue;
    const safe = safeScalar(key, rawValue);
    if (safe !== undefined) clientContext[key] = safe;
  }

  const productId =
    typeof input.productId === 'string' && UUID_PATTERN.test(input.productId.trim())
      ? input.productId.trim()
      : null;
  const barcode =
    typeof input.barcode === 'string' ? normalizeCanonicalProductBarcode(input.barcode) : null;
  const description = safeOperationalString(input.description, 500);
  const reportRequestId =
    typeof input.reportRequestId === 'string' &&
    RANDOM_UUID_PATTERN.test(input.reportRequestId.trim())
      ? input.reportRequestId.trim().toLowerCase()
      : null;
  return {
    ...(reportRequestId ? { reportRequestId } : {}),
    correctionType: input.correctionType,
    ...(productId ? { productId } : {}),
    ...(barcode ? { barcode } : {}),
    ...(description ? { description } : {}),
    ...(Object.keys(proposedPayload).length > 0 ? { proposedPayload } : {}),
    ...(Object.keys(clientContext).length > 0 ? { clientContext } : {}),
  };
}

export function catalogReportHasValidRequestId(input: CatalogReportInput): boolean {
  return catalogReportTransportInput(input).reportRequestId !== undefined;
}
