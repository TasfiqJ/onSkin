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
  'barcode',
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

type CatalogReportScalar = string | number | boolean | null;

export function normalizeBarcode(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
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

export function safeUrl(value: unknown): string | null {
  const raw = safeString(value, 300);
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    const normalized = `${url.origin}${url.pathname}`;
    return normalized.length <= 300 && !sensitiveText.test(normalized) ? normalized : null;
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
    const safe = key === 'sourceUrl' ? safeUrl(raw) : safeScalar(raw, maxLength);
    if (safe !== null || raw === null) out[key] = safe;
  }
  if (JSON.stringify(out).length > 3000) return { value: {}, errorCode: code };
  return { value: out, errorCode: null };
}
