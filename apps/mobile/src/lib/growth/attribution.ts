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
const PUBLIC_HOSTNAME =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const RESERVED_PUBLIC_HOSTNAME =
  /(?:^localhost$|\.localhost$|\.local$|\.test$|\.invalid$|\.example$)/;
const PUBLIC_PATH = /^\/[A-Za-z0-9/_~-]*$/;

export function normalizePublicDomain(domain: string = env.finalBrandDomain): string | null {
  const trimmed = domain.trim();
  if (!trimmed) return null;

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.port) return null;

  const hostname = parsed.hostname.toLowerCase();
  if (
    !PUBLIC_HOSTNAME.test(hostname) ||
    RESERVED_PUBLIC_HOSTNAME.test(hostname) ||
    hostname.includes('example.com') ||
    hostname === 'localhost'
  ) {
    return null;
  }
  return hostname;
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

function normalizePublicPath(path: string): string | null {
  const safePath = path.startsWith('/') ? path : `/${path}`;
  if (safePath.startsWith('//') || !PUBLIC_PATH.test(safePath)) return null;
  return safePath;
}

export function buildPublicGrowthUrl(
  path: string,
  attribution: Record<string, unknown>,
  opts: { domain?: string } = {},
): string | null {
  const domain = normalizePublicDomain(opts.domain ?? env.finalBrandDomain);
  if (!domain) return null;
  const safePath = normalizePublicPath(path);
  if (!safePath) return null;
  const query = encodeQuery(sanitizeAttribution(attribution));
  return `https://${domain}${safePath}${query ? `?${query}` : ''}`;
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function parseGrowthAttributionFromUrl(url: string): GrowthAttribution {
  const query = url.split('?')[1]?.split('#')[0];
  if (!query) return {};
  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    const [rawKey, rawValue = ''] = pair.split('=');
    if (!rawKey) continue;
    const key = safeDecodeURIComponent(rawKey);
    const value = safeDecodeURIComponent(rawValue.replace(/\+/g, ' '));
    if (!key || value === null) continue;
    params[key] = value;
  }
  return sanitizeAttribution(params);
}
