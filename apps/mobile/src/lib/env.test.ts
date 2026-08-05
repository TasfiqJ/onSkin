import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ORIGINAL_SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const ORIGINAL_APP_ENV = process.env.EXPO_PUBLIC_APP_ENV;
const ORIGINAL_CUSTOM_PRO_GRANT_ENABLED = process.env.EXPO_PUBLIC_CUSTOM_PRO_GRANT_ENABLED;
const ORIGINAL_NATIVE_CAMERA_ENABLED = process.env.EXPO_PUBLIC_NATIVE_CAMERA_ENABLED;
const ORIGINAL_NATIVE_OCR_ENABLED = process.env.EXPO_PUBLIC_NATIVE_OCR_ENABLED;
const ORIGINAL_PHASE7_TREND_ENABLED = process.env.EXPO_PUBLIC_PHASE7_TREND_ENABLED;
const ORIGINAL_PHASE7_SHARE_CARD_ENABLED = process.env.EXPO_PUBLIC_PHASE7_SHARE_CARD_ENABLED;
const ORIGINAL_PHASE7_REVIEWED_CONFLICT_SHARING_ENABLED =
  process.env.EXPO_PUBLIC_PHASE7_REVIEWED_CONFLICT_SHARING_ENABLED;
const ORIGINAL_PHASE8_PUBLIC_LINKS_ENABLED = process.env.EXPO_PUBLIC_PHASE8_PUBLIC_LINKS_ENABLED;
const ORIGINAL_DEV = (globalThis as { __DEV__?: boolean }).__DEV__;

async function loadEnvWith(overrides: {
  supabaseUrl?: string;
  supabaseKey?: string;
  appEnv?: string;
  customProGrantEnabled?: string;
  nativeCameraEnabled?: string;
  nativeOcrEnabled?: string;
  phase7TrendEnabled?: string;
  phase7ShareCardEnabled?: string;
  phase7ReviewedConflictSharingEnabled?: string;
  phase8PublicLinksEnabled?: string;
  dev?: boolean;
}) {
  vi.resetModules();
  setEnv('EXPO_PUBLIC_SUPABASE_URL', overrides.supabaseUrl);
  setEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', overrides.supabaseKey);
  setEnv('EXPO_PUBLIC_APP_ENV', overrides.appEnv);
  setEnv('EXPO_PUBLIC_CUSTOM_PRO_GRANT_ENABLED', overrides.customProGrantEnabled);
  setEnv('EXPO_PUBLIC_NATIVE_CAMERA_ENABLED', overrides.nativeCameraEnabled);
  setEnv('EXPO_PUBLIC_NATIVE_OCR_ENABLED', overrides.nativeOcrEnabled);
  setEnv('EXPO_PUBLIC_PHASE7_TREND_ENABLED', overrides.phase7TrendEnabled);
  setEnv('EXPO_PUBLIC_PHASE7_SHARE_CARD_ENABLED', overrides.phase7ShareCardEnabled);
  setEnv(
    'EXPO_PUBLIC_PHASE7_REVIEWED_CONFLICT_SHARING_ENABLED',
    overrides.phase7ReviewedConflictSharingEnabled,
  );
  setEnv('EXPO_PUBLIC_PHASE8_PUBLIC_LINKS_ENABLED', overrides.phase8PublicLinksEnabled);
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
  setEnv('EXPO_PUBLIC_CUSTOM_PRO_GRANT_ENABLED', ORIGINAL_CUSTOM_PRO_GRANT_ENABLED);
  setEnv('EXPO_PUBLIC_NATIVE_CAMERA_ENABLED', ORIGINAL_NATIVE_CAMERA_ENABLED);
  setEnv('EXPO_PUBLIC_NATIVE_OCR_ENABLED', ORIGINAL_NATIVE_OCR_ENABLED);
  setEnv('EXPO_PUBLIC_PHASE7_TREND_ENABLED', ORIGINAL_PHASE7_TREND_ENABLED);
  setEnv('EXPO_PUBLIC_PHASE7_SHARE_CARD_ENABLED', ORIGINAL_PHASE7_SHARE_CARD_ENABLED);
  setEnv(
    'EXPO_PUBLIC_PHASE7_REVIEWED_CONFLICT_SHARING_ENABLED',
    ORIGINAL_PHASE7_REVIEWED_CONFLICT_SHARING_ENABLED,
  );
  setEnv('EXPO_PUBLIC_PHASE8_PUBLIC_LINKS_ENABLED', ORIGINAL_PHASE8_PUBLIC_LINKS_ENABLED);
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

  it('does not let an explicit development label reopen release-only behavior', async () => {
    const mod = await loadEnvWith({ appEnv: 'development', dev: false });

    expect(mod.env.appEnvironment).toBe('production');
  });
});

describe('env boolean flags', () => {
  it('allows the custom Pro grant only in an explicit development runtime', async () => {
    await expect(
      loadEnvWith({ appEnv: 'development', customProGrantEnabled: 'true', dev: true }),
    ).resolves.toMatchObject({
      env: expect.objectContaining({ customProGrantEnabled: true }),
    });
    await expect(
      loadEnvWith({ appEnv: 'production', customProGrantEnabled: 'true', dev: false }),
    ).resolves.toMatchObject({
      env: expect.objectContaining({ customProGrantEnabled: false }),
    });
    await expect(
      loadEnvWith({ appEnv: 'development', customProGrantEnabled: 'true', dev: false }),
    ).resolves.toMatchObject({
      env: expect.objectContaining({ customProGrantEnabled: false }),
    });
  });

  it('normalizes case and whitespace for explicit boolean flags', async () => {
    const mod = await loadEnvWith({
      nativeCameraEnabled: ' TRUE ',
      nativeOcrEnabled: ' True ',
      phase7TrendEnabled: 'FALSE',
      phase7ShareCardEnabled: ' true ',
      phase7ReviewedConflictSharingEnabled: ' TRUE ',
      phase8PublicLinksEnabled: ' true ',
    });

    expect(mod.env.nativeCameraEnabled).toBe(true);
    expect(mod.env.nativeOcrEnabled).toBe(true);
    expect(mod.env.phase7TrendEnabled).toBe(false);
    expect(mod.env.phase7ShareCardEnabled).toBe(true);
    expect(mod.env.phase7ReviewedConflictSharingEnabled).toBe(true);
    expect(mod.env.phase8PublicLinksEnabled).toBe(true);
  });

  it('keeps native camera enabled when unset but honors explicit false', async () => {
    await expect(loadEnvWith({})).resolves.toMatchObject({
      env: expect.objectContaining({ nativeCameraEnabled: true }),
    });
    await expect(loadEnvWith({ nativeCameraEnabled: ' false ' })).resolves.toMatchObject({
      env: expect.objectContaining({ nativeCameraEnabled: false }),
    });
  });

  it('fails closed for malformed native and deferred-surface flags', async () => {
    const mod = await loadEnvWith({
      nativeCameraEnabled: 'yes',
      nativeOcrEnabled: '1',
      phase7ShareCardEnabled: 'enabled',
      phase7ReviewedConflictSharingEnabled: '1',
      phase8PublicLinksEnabled: 'on',
    });

    expect(mod.env.nativeCameraEnabled).toBe(false);
    expect(mod.env.nativeOcrEnabled).toBe(false);
    expect(mod.env.phase7ShareCardEnabled).toBe(false);
    expect(mod.env.phase7ReviewedConflictSharingEnabled).toBe(false);
    expect(mod.env.phase8PublicLinksEnabled).toBe(false);
  });
});
