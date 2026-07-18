import { normalizeCatalogBarcode } from '../_shared/catalogBarcode.ts';

export const correctionTypes = new Set([
  'wrong_match',
  'missing_product',
  'ingredient_issue',
  'duplicate',
  'source_issue',
  'expiry_issue',
  'category_issue',
]);

export const allowedTopLevelKeys = new Set([
  'reportRequestId',
  'correctionType',
  'productId',
  'barcode',
  'description',
  'proposedPayload',
  'clientContext',
]);

export const allowedPayloadKeys = new Set([
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

export const allowedContextKeys = new Set([
  'addedVia',
  'quality',
  'source',
  'platform',
  'appVersion',
  'buildNumber',
  'route',
]);

const sensitiveText =
  /(access[_-]?token|refresh[_-]?token|authorization|bearer|jwt|signed[_-]?url|localuri|local_uri|file:|[a-z]:\\|\/data\/|\/var\/mobile\/|photo|image|email|phone|address|user[_-]?id|app[_-]?user[_-]?id|pregnan|diagnos|medical|medication|prescription|allerg|free[_-]?text|message|ask prompt)/i;
const secretOrLocalArtifactText =
  /(?:access[_ -]?token|refresh[_ -]?token|authorization|bearer|jwt|signed[_ -]?url|local[_ -]?uri|file:|[a-z]:\\|\/data\/|\/var\/mobile\/|\.(?:heic|jpe?g|png)(?:\s|$))/i;
const emailAddressText = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;
const formattedPhoneNumberText = /(?:^|\s)(?:\+\d{7,15}|\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4})(?:\s|$)/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RANDOM_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CatalogReportScalar = string | number | boolean | null;

export function normalizeBarcode(value: unknown): string | null {
  return normalizeCatalogBarcode(value);
}

export function normalizeProductId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

export function normalizeReportRequestId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return RANDOM_UUID_PATTERN.test(trimmed) ? trimmed.toLowerCase() : null;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function validateAllowedKeys(
  input: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): boolean {
  return !Object.keys(input).some((key) => !allowed.has(key));
}

export function safeString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed || trimmed.length > maxLength || sensitiveText.test(trimmed)) return null;
  return trimmed;
}

/**
 * Product identity is not a user-health narrative. Keep legitimate catalog
 * names such as `Photoderm` and `Image Skincare`, while rejecting concrete
 * credentials, local artifacts, email addresses, and formatted phone numbers.
 */
export function safeProductString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (
    !trimmed ||
    trimmed.length > maxLength ||
    secretOrLocalArtifactText.test(trimmed) ||
    emailAddressText.test(trimmed) ||
    formattedPhoneNumberText.test(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

export function catalogReportIdentityError(input: {
  correctionType: string;
  productId: unknown;
  barcode: unknown;
  productName: unknown;
}): string | null {
  const productId = normalizeProductId(input.productId);
  const barcode = normalizeBarcode(input.barcode);
  // `sanitizeObject` already treats product identity as a bounded catalog
  // scalar rather than an operational/free-text field. Apply that same rule
  // here so legitimate names containing words such as "Photoderm" or
  // "Image" are not accepted into the sanitized payload and then silently
  // discarded as identity immediately before persistence.
  const productName = safeProductString(input.productName, 200);

  if (input.correctionType === 'missing_product') {
    return barcode || productName ? null : 'missing_product_identity_required';
  }
  if (input.correctionType === 'wrong_match') {
    if (!productId) return 'wrong_match_product_id_required';
    return barcode || productName ? null : 'wrong_match_identity_required';
  }
  return null;
}

export function safeUrl(value: unknown): string | null {
  const raw = safeProductString(value, 300);
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    const normalized = `${url.origin}${url.pathname}`;
    return normalized.length <= 300 && !secretOrLocalArtifactText.test(normalized)
      ? normalized
      : null;
  } catch {
    return null;
  }
}

export function safeScalar(value: unknown, maxStringLength = 200): CatalogReportScalar {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  return safeString(value, maxStringLength);
}

export function sanitizeObject(
  value: unknown,
  allowed: ReadonlySet<string>,
  code: string,
): { value: Record<string, CatalogReportScalar>; errorCode: string | null } {
  if (value === undefined || value === null) return { value: {}, errorCode: null };
  if (!isPlainObject(value)) return { value: {}, errorCode: code };
  if (!validateAllowedKeys(value, allowed)) return { value: {}, errorCode: code };

  const out: Record<string, CatalogReportScalar> = {};
  for (const [key, raw] of Object.entries(value)) {
    const maxLength = key === 'ingredientsText' ? 1500 : key === 'sourceUrl' ? 300 : 200;
    const safe =
      key === 'sourceUrl'
        ? safeUrl(raw)
        : ['productName', 'brand', 'category', 'ingredientsText', 'sourceName'].includes(key)
          ? safeProductString(raw, maxLength)
          : safeScalar(raw, maxLength);
    if (safe !== null || raw === null) out[key] = safe;
  }
  if (JSON.stringify(out).length > 3000) return { value: {}, errorCode: code };
  return { value: out, errorCode: null };
}
