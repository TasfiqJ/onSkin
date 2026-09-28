import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import {
  catalogOperatorConfig,
  exactBackendSources,
  exactHeadersAsset,
  securityPolicy,
  staticHeaders,
} from './vite.config';

const selfOnlyPolicy = [
  "default-src 'self'",
  "base-uri 'none'",
  "connect-src 'self'",
  "font-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  'upgrade-insecure-requests',
].join('; ');

function previewPolicy(rawSupabaseUrl: string | undefined): string | undefined {
  const headers = catalogOperatorConfig(rawSupabaseUrl).preview?.headers;
  if (!headers || Array.isArray(headers)) return undefined;
  const policy = headers['Content-Security-Policy'];
  return typeof policy === 'string' ? policy : undefined;
}

function emittedHeaders(contentSecurityPolicy: string): unknown {
  const emitFile = vi.fn();
  const hook = exactHeadersAsset(contentSecurityPolicy).generateBundle;
  if (typeof hook !== 'function') throw new Error('Expected a generateBundle hook.');
  Reflect.apply(hook, { emitFile }, [{}, {}, false]);
  return emitFile.mock.calls[0]?.[0];
}

describe('operator console Content Security Policy', () => {
  it('uses fail-closed self-only connect-src when Supabase is unset', () => {
    expect(exactBackendSources(undefined)).toEqual([]);
    expect(securityPolicy([])).toBe(selfOnlyPolicy);
    expect(previewPolicy(undefined)).toBe(selfOnlyPolicy);
  });

  it('uses exact configured Supabase HTTP and WebSocket origins without wildcards', () => {
    const productionSources = [
      'https://project.supabase.co',
      'wss://project.supabase.co',
    ];
    const productionPolicy = selfOnlyPolicy.replace(
      "connect-src 'self'",
      `connect-src 'self' ${productionSources.join(' ')}`,
    );
    expect(exactBackendSources('https://project.supabase.co')).toEqual(productionSources);
    expect(previewPolicy('https://project.supabase.co')).toBe(productionPolicy);
    expect(emittedHeaders(productionPolicy)).toEqual({
      type: 'asset',
      fileName: '_headers',
      source: staticHeaders(productionPolicy),
    });

    const loopbackSources = ['http://127.0.0.1:54321', 'ws://127.0.0.1:54321'];
    const loopbackPolicy = selfOnlyPolicy.replace(
      "connect-src 'self'",
      `connect-src 'self' ${loopbackSources.join(' ')}`,
    );
    expect(exactBackendSources('http://127.0.0.1:54321')).toEqual(loopbackSources);
    expect(previewPolicy('http://127.0.0.1:54321')).toBe(loopbackPolicy);

    for (const policy of [productionPolicy, loopbackPolicy]) {
      expect(policy).not.toContain('*.supabase.co');
      expect(policy).not.toContain('localhost:*');
      expect(policy).not.toContain('127.0.0.1:*');
      expect(policy).not.toMatch(/connect-src[^;]*\s\*(?:\s|;|$)/);
    }
  });

  it('rejects wildcard, credential-bearing, and path-bearing backend URLs', () => {
    for (const value of [
      'https://*.supabase.co',
      'https://user:password@project.supabase.co',
      'https://project.supabase.co/rest/v1',
      'https://project.supabase.co?tenant=other',
      'https://project.supabase.co#other',
    ]) {
      expect(() => exactBackendSources(value)).toThrow(/exact origin/);
    }
  });

  it('emits the exact _headers asset and keeps the checked-in fallback self-only', () => {
    const expectedHeaders = staticHeaders(selfOnlyPolicy);
    expect(readFileSync(new URL('./public/_headers', import.meta.url), 'utf8')).toBe(expectedHeaders);
    expect(emittedHeaders(selfOnlyPolicy)).toEqual({
      type: 'asset',
      fileName: '_headers',
      source: expectedHeaders,
    });
  });
});
