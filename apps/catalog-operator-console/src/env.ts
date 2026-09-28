export type ConsoleEnvironment = 'local' | 'staging' | 'production';

export interface OperatorConsoleEnvironment {
  readonly environment: ConsoleEnvironment;
  readonly supabaseUrl: string;
  readonly publishableKey: string;
  readonly operatorApiUrl: string;
}

const PUBLISHABLE_KEY_PATTERN = /^sb_publishable_[A-Za-z0-9_-]{20,256}$/;
const BASE64URL_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function decodeBase64UrlJson(segment: string): unknown {
  if (
    segment.length < 2 ||
    segment.length > 2_048 ||
    !BASE64URL_SEGMENT_PATTERN.test(segment)
  ) {
    throw new Error('The legacy Supabase API key is malformed.');
  }
  const normalized = segment.replaceAll('-', '+').replaceAll('_', '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  try {
    const bytes = Uint8Array.from(atob(`${normalized}${padding}`), (character) =>
      character.charCodeAt(0),
    );
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new Error('The legacy Supabase API key is malformed.');
  }
}

export function validatedPublishableKey(rawValue: string): string {
  const value = rawValue.trim();
  if (value.length < 20 || value.length > 4_096) {
    throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is malformed.');
  }
  if (PUBLISHABLE_KEY_PATTERN.test(value)) return value;
  if (value.startsWith('sb_')) {
    throw new Error('Only an sb_publishable_ key may be supplied to this console.');
  }

  const segments = value.split('.');
  if (segments.length !== 3 || segments.some((segment) => !BASE64URL_SEGMENT_PATTERN.test(segment))) {
    throw new Error('Only a Supabase publishable key or legacy anon key may be supplied.');
  }
  const header = decodeBase64UrlJson(segments[0] ?? '');
  const payload = decodeBase64UrlJson(segments[1] ?? '');
  if (
    !isRecord(header) ||
    header.alg !== 'HS256' ||
    (header.typ !== undefined && header.typ !== 'JWT') ||
    !isRecord(payload) ||
    payload.role !== 'anon'
  ) {
    throw new Error('Only a legacy Supabase anon key may be supplied; elevated JWTs are rejected.');
  }
  return value;
}

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim() ?? '';
  if (normalized.length === 0) throw new Error(`${name} is required.`);
  return normalized;
}

function validatedSupabaseUrl(value: string, environment: ConsoleEnvironment): URL {
  const url = new URL(value);
  const isLoopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('VITE_SUPABASE_URL must not include credentials, query, or fragment data.');
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new Error('VITE_SUPABASE_URL must contain only the project origin.');
  }
  if (url.protocol !== 'https:' && !(environment === 'local' && isLoopback)) {
    throw new Error('The operator console requires HTTPS outside local development.');
  }
  return url;
}

export function readEnvironment(
  source: Record<string, string | boolean | undefined> = import.meta.env,
): OperatorConsoleEnvironment {
  const environmentValue = required(
    typeof source.VITE_OPERATOR_CONSOLE_ENV === 'string'
      ? source.VITE_OPERATOR_CONSOLE_ENV
      : undefined,
    'VITE_OPERATOR_CONSOLE_ENV',
  );
  if (!['local', 'staging', 'production'].includes(environmentValue)) {
    throw new Error('VITE_OPERATOR_CONSOLE_ENV must be local, staging, or production.');
  }
  const environment = environmentValue as ConsoleEnvironment;
  const supabaseUrl = validatedSupabaseUrl(
    required(
      typeof source.VITE_SUPABASE_URL === 'string' ? source.VITE_SUPABASE_URL : undefined,
      'VITE_SUPABASE_URL',
    ),
    environment,
  );
  const publishableKey = validatedPublishableKey(
    required(
      typeof source.VITE_SUPABASE_PUBLISHABLE_KEY === 'string'
        ? source.VITE_SUPABASE_PUBLISHABLE_KEY
        : undefined,
      'VITE_SUPABASE_PUBLISHABLE_KEY',
    ),
  );

  return {
    environment,
    supabaseUrl: supabaseUrl.origin,
    publishableKey,
    operatorApiUrl: new URL('/functions/v1/catalog-operator', supabaseUrl).toString(),
  };
}
