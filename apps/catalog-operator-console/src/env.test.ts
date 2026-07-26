import { describe, expect, it } from 'vitest';

import { readEnvironment } from './env';

const publishableKey = 'sb_publishable_0123456789abcdefghijklmnopqrstuvwxyz';

function legacyKey(role: string): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role, iss: 'supabase' })}.signature`;
}

describe('operator console environment', () => {
  it('derives the fixed same-origin Edge endpoint', () => {
    expect(
      readEnvironment({
        VITE_OPERATOR_CONSOLE_ENV: 'production',
        VITE_SUPABASE_URL: 'https://project.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      }),
    ).toEqual({
      environment: 'production',
      supabaseUrl: 'https://project.supabase.co',
      publishableKey,
      operatorApiUrl: 'https://project.supabase.co/functions/v1/catalog-operator',
    });
  });

  it('allows plaintext only for a local loopback project', () => {
    expect(
      readEnvironment({
        VITE_OPERATOR_CONSOLE_ENV: 'local',
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      }).supabaseUrl,
    ).toBe('http://127.0.0.1:54321');
    expect(() =>
      readEnvironment({
        VITE_OPERATOR_CONSOLE_ENV: 'staging',
        VITE_SUPABASE_URL: 'http://example.test',
        VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      }),
    ).toThrow(/HTTPS/);
  });

  it('rejects credential-bearing URLs and opaque secret keys', () => {
    expect(() =>
      readEnvironment({
        VITE_OPERATOR_CONSOLE_ENV: 'production',
        VITE_SUPABASE_URL: 'https://user:pass@project.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      }),
    ).toThrow(/credentials/);
    expect(() =>
      readEnvironment({
        VITE_OPERATOR_CONSOLE_ENV: 'production',
        VITE_SUPABASE_URL: 'https://project.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_0123456789abcdefghijklmnopqrstuvwxyz',
      }),
    ).toThrow(/sb_publishable/);
  });

  it('accepts only anon-role legacy JWT keys', () => {
    expect(
      readEnvironment({
        VITE_OPERATOR_CONSOLE_ENV: 'local',
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: legacyKey('anon'),
      }).publishableKey,
    ).toBe(legacyKey('anon'));
    expect(() =>
      readEnvironment({
        VITE_OPERATOR_CONSOLE_ENV: 'production',
        VITE_SUPABASE_URL: 'https://project.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: legacyKey('service_role'),
      }),
    ).toThrow(/elevated JWTs/);
    expect(() =>
      readEnvironment({
        VITE_OPERATOR_CONSOLE_ENV: 'production',
        VITE_SUPABASE_URL: 'https://project.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'eyJhbGciOiJIUzI1NiJ9.not-json.signature',
      }),
    ).toThrow(/malformed/);
  });
});
