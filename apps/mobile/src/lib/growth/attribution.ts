import { env } from '@/lib/env';

export type GrowthAttributionKey =
  | 'source'
  | 'medium'
  | 'campaign'
  | 'content'
  | 'term'
  | 'creative_variant'
  | 'landing_variant'
  | 'platform'
  | 'app_version'
  | 'build_number'
  | 'store'
  | 'share_id';

export type GrowthAttribution = Partial<Record<GrowthAttributionKey, string>>;

export const GROWTH_ATTRIBUTION_KEYS: readonly GrowthAttributionKey[] = [
  'source',
  'medium',
  'campaign',
  'content',
  'term',
  'creative_variant',
  'landing_variant',
  'platform',
  'app_version',
  'build_number',
  'store',
  'share_id',
] as const;

const allowedKeys = new Set<string>(GROWTH_ATTRIBUTION_KEYS);

export const SENSITIVE_GROWTH_KEY =
  /(barcode|ingredient|ocr|raw_text|note|localuri|local_uri|file|path|photo|image|receipt|product_id|product_name|conflict_text|pregnan|condition|diagnos|skin|goal|profile|free_text|message|body|email|phone|address|name|user_id|app_user_id|age|birth|zip|postal|retinoid|retinol|aha|bha|benzoyl|hydroquinone|niacinamide|vitamin_c|sunscreen|peptide)/i;

const OPAQUE_ID = /^[A-Za-z0-9_-]{8,64}$/;
const ATTRIBUTION_VALUE = /^[A-Za-z0-9._~-]{1,120}$/;

export function normalizePublicDomain(domain: string = env.finalBrandDomain): string | null {
  const normalized = domain
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
  if (!normalized || normalized.includes('example.com') || normalized === 'localhost') return null;
  return normalized;
}

export function isSafeOpaqueId(value: string): boolean {
  return OPAQUE_ID.test(value);
}

function safeString(value: unknown): string | null {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('@') || /\s/.test(trimmed)) return null;
  if (!ATTRIBUTION_VALUE.test(trimmed)) return null;
  if (SENSITIVE_GROWTH_KEY.test(trimmed)) return null;
  return trimmed;
}

export function sanitizeAttribution(
  input: Record<string, unknown> | null | undefined,
): GrowthAttribution {
  const clean: GrowthAttribution = {};
  if (!input) return clean;

  for (const [key, rawValue] of Object.entries(input)) {
    if (!allowedKeys.has(key)) continue;
    if (SENSITIVE_GROWTH_KEY.test(key)) continue;
    const value = safeString(rawValue);
    if (!value) continue;
    if (key === 'share_id' && !isSafeOpaqueId(value)) continue;
    clean[key as GrowthAttributionKey] = value;
  }

  return clean;
}

function encodeQuery(params: GrowthAttribution): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

export function buildPublicGrowthUrl(
  path: string,
  attribution: Record<string, unknown>,
  opts: { domain?: string } = {},
): string | null {
  const domain = normalizePublicDomain(opts.domain ?? env.finalBrandDomain);
  if (!domain) return null;
  const safePath = path.startsWith('/') ? path : `/${path}`;
  const query = encodeQuery(sanitizeAttribution(attribution));
  return `https://${domain}${safePath}${query ? `?${query}` : ''}`;
}

export function parseGrowthAttributionFromUrl(url: string): GrowthAttribution {
  const query = url.split('?')[1]?.split('#')[0];
  if (!query) return {};
  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    const [rawKey, rawValue = ''] = pair.split('=');
    if (!rawKey) continue;
    params[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.replace(/\+/g, ' '));
  }
  return sanitizeAttribution(params);
}
