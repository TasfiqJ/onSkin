import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ORIGINAL_SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const ORIGINAL_APP_ENV = process.env.EXPO_PUBLIC_APP_ENV;
const ORIGINAL_DEV = (globalThis as { __DEV__?: boolean }).__DEV__;

async function loadEnvWith(overrides: {
  supabaseUrl?: string;
  supabaseKey?: string;
  appEnv?: string;
  dev?: boolean;
}) {
  vi.resetModules();
  setEnv('EXPO_PUBLIC_SUPABASE_URL', overrides.supabaseUrl);
  setEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', overrides.supabaseKey);
  setEnv('EXPO_PUBLIC_APP_ENV', overrides.appEnv);
  if (overrides.dev === undefined) delete (globalThis as { __DEV__?: boolean }).__DEV__;
  else (globalThis as { __DEV__?: boolean }).__DEV__ = overrides.dev;
  return import('./env');
}

function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  vi.resetModules();
  setEnv('EXPO_PUBLIC_SUPABASE_URL', ORIGINAL_SUPABASE_URL);
  setEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', ORIGINAL_SUPABASE_PUBLISHABLE_KEY);
  setEnv('EXPO_PUBLIC_APP_ENV', ORIGINAL_APP_ENV);
  if (ORIGINAL_DEV === undefined) delete (globalThis as { __DEV__?: boolean }).__DEV__;
  else (globalThis as { __DEV__?: boolean }).__DEV__ = ORIGINAL_DEV;
});

describe('env Supabase configuration', () => {
  it('keeps the app bootable when Supabase env vars are missing', async () => {
    const mod = await loadEnvWith({});

    expect(() => new URL(mod.env.supabaseUrl)).not.toThrow();
    expect(mod.env.supabaseUrl).toBe('https://blocked-supabase-url.invalid');
    expect(mod.isPlaceholder(mod.env.supabaseUrl)).toBe(true);
    expect(mod.isPlaceholder(mod.env.supabasePublishableKey)).toBe(true);
    expect(mod.isSupabaseConfigured).toBe(false);
  });

  it('treats copied example placeholders as unconfigured', async () => {
    const mod = await loadEnvWith({
      supabaseUrl: 'https://YOUR-PROJECT-ref.supabase.co',
      supabaseKey: 'sb_publishable_xxxxxxxxxxxxxxxxxxxx',
    });

    expect(mod.env.supabaseUrl).toBe('https://blocked-supabase-url.invalid');
    expect(mod.env.supabasePublishableKey).toBe('__BLOCKED_PLACEHOLDER__');
    expect(mod.isSupabaseConfigured).toBe(false);
  });

  it('treats invalid Supabase URLs as unconfigured without exposing createClient to them', async () => {
    const mod = await loadEnvWith({
      supabaseUrl: '__BLOCKED_PLACEHOLDER__',
      supabaseKey: 'sb_publishable_real',
    });

    expect(() => new URL(mod.env.supabaseUrl)).not.toThrow();
    expect(mod.env.supabaseUrl).toBe('https://blocked-supabase-url.invalid');
    expect(mod.isSupabaseConfigured).toBe(false);
  });

  it('preserves valid Supabase configuration', async () => {
    const mod = await loadEnvWith({
      supabaseUrl: 'https://example-project.supabase.co',
      supabaseKey: 'sb_publishable_real',
    });

    expect(mod.env.supabaseUrl).toBe('https://example-project.supabase.co');
    expect(mod.env.supabasePublishableKey).toBe('sb_publishable_real');
    expect(mod.isSupabaseConfigured).toBe(true);
  });
});

describe('env appEnvironment fail-closed behavior', () => {
  it('defaults missing non-dev app env to production', async () => {
    const mod = await loadEnvWith({ dev: false });

    expect(mod.env.appEnvironment).toBe('production');
  });

  it('defaults invalid non-dev app env to production', async () => {
    const mod = await loadEnvWith({ appEnv: 'preview', dev: false });

    expect(mod.env.appEnvironment).toBe('production');
  });

  it('keeps development fallback only in the dev runtime', async () => {
    const mod = await loadEnvWith({ dev: true });

    expect(mod.env.appEnvironment).toBe('development');
  });

  it('normalizes supported app env values', async () => {
    const mod = await loadEnvWith({ appEnv: 'Staging', dev: false });

    expect(mod.env.appEnvironment).toBe('staging');
  });
});
