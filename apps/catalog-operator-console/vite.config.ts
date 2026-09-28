import { defineConfig, loadEnv, type Plugin, type UserConfig } from 'vite';

export function exactBackendSources(rawUrl: string | undefined): readonly string[] {
  if (!rawUrl?.trim()) return [];
  const url = new URL(rawUrl);
  if (
    url.hostname.includes('*') ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('VITE_SUPABASE_URL must be an exact origin.');
  }
  const isLoopback =
    url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
  if (url.protocol !== 'https:' && !(isLoopback && url.protocol === 'http:')) {
    throw new Error('VITE_SUPABASE_URL must use HTTPS outside exact loopback development.');
  }
  const webSocketOrigin = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`;
  return Object.freeze([url.origin, webSocketOrigin]);
}

export function securityPolicy(backendSources: readonly string[]): string {
  return [
    "default-src 'self'",
    "base-uri 'none'",
    `connect-src 'self'${backendSources.map((source) => ` ${source}`).join('')}`,
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export function staticHeaders(contentSecurityPolicy: string): string {
  return `/*
  Cache-Control: no-store
  Content-Security-Policy: ${contentSecurityPolicy}
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Referrer-Policy: no-referrer
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-Robots-Tag: noindex, nofollow, noarchive
`;
}

export function exactHeadersAsset(contentSecurityPolicy: string): Plugin {
  return {
    name: 'catalog-operator-exact-security-headers',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: '_headers',
        source: staticHeaders(contentSecurityPolicy),
      });
    },
  };
}

export function catalogOperatorConfig(rawSupabaseUrl: string | undefined): UserConfig {
  const contentSecurityPolicy = securityPolicy(
    exactBackendSources(rawSupabaseUrl),
  );
  return {
    plugins: [exactHeadersAsset(contentSecurityPolicy)],
    build: {
      emptyOutDir: true,
      sourcemap: false,
      target: 'es2022',
    },
    preview: {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Security-Policy': contentSecurityPolicy,
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      },
    },
    server: {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Security-Policy': contentSecurityPolicy,
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      },
      port: 4318,
      strictPort: true,
    },
  };
}

export default defineConfig(({ mode }) => {
  const buildEnvironment = loadEnv(mode, '.', 'VITE_');
  return catalogOperatorConfig(buildEnvironment.VITE_SUPABASE_URL);
});
