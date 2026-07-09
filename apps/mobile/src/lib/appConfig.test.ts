import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const requireConfig = createRequire(import.meta.url);
const APP_CONFIG_PATH = requireConfig.resolve('../../app.config.js');

const APP_ENV_KEYS = [
  'APP_VARIANT',
  'EXPO_PUBLIC_APP_ENV',
  'BRAND_LEGAL_CLEARANCE',
  'APP_DISPLAY_NAME',
  'EXPO_PUBLIC_APP_DISPLAY_NAME',
  'APP_SLUG',
  'APP_SCHEME',
  'EXPO_PUBLIC_APP_SCHEME',
  'APP_IOS_BUNDLE_IDENTIFIER',
  'APP_ANDROID_PACKAGE',
  'APP_CAMERA_USAGE_DESCRIPTION',
  'APP_FACE_ID_USAGE_DESCRIPTION',
  'APP_CAMERA_PERMISSION',
  'APP_FACE_ID_PERMISSION',
  'EXPO_PUBLIC_FINAL_BRAND_DOMAIN',
  'EXPO_PUBLIC_APP_STORE_URL',
  'EXPO_PUBLIC_PLAY_STORE_URL',
] as const;

function buildExpoConfig(env: Partial<Record<(typeof APP_ENV_KEYS)[number], string>>) {
  const previous = new Map<string, string | undefined>();
  for (const key of APP_ENV_KEYS) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }

  Object.assign(process.env, env);
  delete requireConfig.cache[APP_CONFIG_PATH];

  try {
    return requireConfig(APP_CONFIG_PATH)().expo;
  } finally {
    delete requireConfig.cache[APP_CONFIG_PATH];
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function intentFilterText(expo: ReturnType<typeof buildExpoConfig>): string {
  return JSON.stringify(expo.android?.intentFilters ?? []);
}

function pluginOptions(expo: ReturnType<typeof buildExpoConfig>, name: string): Record<string, unknown> {
  const plugin = (expo.plugins ?? []).find((candidate: unknown) =>
    Array.isArray(candidate) ? candidate[0] === name : candidate === name,
  );
  return Array.isArray(plugin) && typeof plugin[1] === 'object' && plugin[1] !== null
    ? (plugin[1] as Record<string, unknown>)
    : {};
}

describe('Expo app identity config', () => {
  it('defaults unset local config reads to the development install identity', () => {
    const expo = buildExpoConfig({});

    expect(expo.name).toBe('RoutineKind Dev');
    expect(expo.slug).toBe('routinekind');
    expect(expo.scheme).toBe('routinekind-development');
    expect(expo.ios.bundleIdentifier).toBe('com.routinekind.app.development');
    expect(expo.android.package).toBe('com.routinekind.app.development');
    expect(expo.extra.appVariant).toBe('development');
    expect(expo.extra.appEnvironment).toBe('development');
  });

  it('keeps the accepted launch support floor enforced in native config', () => {
    const expo = buildExpoConfig({});
    const buildProperties = pluginOptions(expo, 'expo-build-properties') as {
      android?: {
        compileSdkVersion?: number;
        minSdkVersion?: number;
        targetSdkVersion?: number;
      };
    };

    expect(expo.ios.supportsTablet).toBe(false);
    expect(expo.ios.deploymentTarget).toBe('17.0');
    expect(buildProperties.android?.minSdkVersion).toBe(29);
    expect(buildProperties.android?.compileSdkVersion).toBe(36);
    expect(buildProperties.android?.targetSdkVersion).toBe(36);
  });

  it('uses production identity only when the production variant is explicit', () => {
    const expo = buildExpoConfig({
      APP_VARIANT: 'production',
      EXPO_PUBLIC_APP_ENV: 'production',
      BRAND_LEGAL_CLEARANCE: 'cleared',
      APP_DISPLAY_NAME: 'RoutineKind',
      APP_SLUG: 'routinekind',
      APP_SCHEME: 'routinekind',
      APP_IOS_BUNDLE_IDENTIFIER: 'com.routinekind.app',
      APP_ANDROID_PACKAGE: 'com.routinekind.app',
    });

    expect(expo.name).toBe('RoutineKind');
    expect(expo.slug).toBe('routinekind');
    expect(expo.scheme).toBe('routinekind');
    expect(expo.ios.bundleIdentifier).toBe('com.routinekind.app');
    expect(expo.android.package).toBe('com.routinekind.app');
    expect(expo.extra.appVariant).toBe('production');
    expect(expo.extra.appEnvironment).toBe('production');
  });

  it('normalizes supported app variant and environment values before resolving identity', () => {
    const expo = buildExpoConfig({
      APP_VARIANT: ' Production ',
      EXPO_PUBLIC_APP_ENV: ' PRODUCTION ',
      BRAND_LEGAL_CLEARANCE: 'cleared',
      APP_DISPLAY_NAME: 'RoutineKind',
      APP_SLUG: 'routinekind',
      APP_SCHEME: 'routinekind',
      APP_IOS_BUNDLE_IDENTIFIER: 'com.routinekind.app',
      APP_ANDROID_PACKAGE: 'com.routinekind.app',
    });

    expect(expo.name).toBe('RoutineKind');
    expect(expo.scheme).toBe('routinekind');
    expect(expo.extra.appVariant).toBe('production');
    expect(expo.extra.appEnvironment).toBe('production');
  });

  it('rejects blank or unsupported app variants instead of falling back to base identity', () => {
    expect(() => buildExpoConfig({ APP_VARIANT: '' })).toThrow(
      /APP_VARIANT must be development, staging, or production/,
    );
    expect(() => buildExpoConfig({ APP_VARIANT: 'prod' })).toThrow(
      /APP_VARIANT must be development, staging, or production/,
    );
  });

  it('rejects unsupported public app environments in native config', () => {
    expect(() =>
      buildExpoConfig({
        APP_VARIANT: 'staging',
        EXPO_PUBLIC_APP_ENV: 'preview',
      }),
    ).toThrow(/EXPO_PUBLIC_APP_ENV must be development, staging, or production/);
  });

  it('requires brand clearance before resolving production native config', () => {
    expect(() =>
      buildExpoConfig({
        APP_VARIANT: 'production',
        EXPO_PUBLIC_APP_ENV: 'production',
        APP_DISPLAY_NAME: 'RoutineKind',
        APP_SLUG: 'routinekind',
        APP_SCHEME: 'routinekind',
        APP_IOS_BUNDLE_IDENTIFIER: 'com.routinekind.app',
        APP_ANDROID_PACKAGE: 'com.routinekind.app',
      }),
    ).toThrow(/requires BRAND_LEGAL_CLEARANCE=cleared/);
  });

  it('blocks cleared production builds that inherit base identity defaults', () => {
    expect(() =>
      buildExpoConfig({
        APP_VARIANT: 'production',
        EXPO_PUBLIC_APP_ENV: 'production',
        BRAND_LEGAL_CLEARANCE: 'cleared',
      }),
    ).toThrow(/APP_DISPLAY_NAME or EXPO_PUBLIC_APP_DISPLAY_NAME/);
  });

  it('blocks partial rebrand production builds that still inherit legacy package IDs', () => {
    expect(() =>
      buildExpoConfig({
        APP_VARIANT: 'production',
        EXPO_PUBLIC_APP_ENV: 'production',
        BRAND_LEGAL_CLEARANCE: 'cleared',
        APP_DISPLAY_NAME: 'RoutineKind',
        APP_SLUG: 'routinekind',
        APP_SCHEME: 'routinekind',
      }),
    ).toThrow(/APP_IOS_BUNDLE_IDENTIFIER/);
  });

  it('allows counsel-cleared legacy identity only when explicitly supplied', () => {
    const expo = buildExpoConfig({
      APP_VARIANT: 'production',
      EXPO_PUBLIC_APP_ENV: 'production',
      BRAND_LEGAL_CLEARANCE: 'cleared',
      APP_DISPLAY_NAME: 'OnSkin',
      APP_SLUG: 'onskin',
      APP_SCHEME: 'onskin',
      APP_IOS_BUNDLE_IDENTIFIER: 'com.onskin.app',
      APP_ANDROID_PACKAGE: 'com.onskin.app',
    });

    expect(expo.name).toBe('OnSkin');
    expect(expo.slug).toBe('onskin');
    expect(expo.scheme).toBe('onskin');
    expect(expo.ios.bundleIdentifier).toBe('com.onskin.app');
    expect(expo.android.package).toBe('com.onskin.app');
  });

  it('allows public runtime identity env to drive native display and scheme fallbacks', () => {
    const expo = buildExpoConfig({
      EXPO_PUBLIC_APP_DISPLAY_NAME: 'RoutineKind',
      EXPO_PUBLIC_APP_SCHEME: 'routinekind',
    });

    expect(expo.name).toBe('RoutineKind');
    expect(expo.scheme).toBe('routinekind');
    expect(expo.ios.bundleIdentifier).toBe('com.routinekind.app.development');
    expect(expo.android.package).toBe('com.routinekind.app.development');
  });

  it('configures native app links only for normalized production domains', () => {
    const expo = buildExpoConfig({
      EXPO_PUBLIC_FINAL_BRAND_DOMAIN: ' https://RoutineKind.app/share ',
    });

    expect(expo.extra.publicLinkDomain).toBe('routinekind.app');
    expect(expo.ios.associatedDomains).toContain('applinks:routinekind.app');
    expect(intentFilterText(expo)).toContain('"host":"routinekind.app"');
  });

  it('keeps native app links inert for malformed, reserved, or placeholder domains', () => {
    const badDomains = [
      'https://example.com',
      'https://routinekind.local',
      'https://routinekind.localhost',
      'https://routinekind.test',
      'https://routinekind.invalid',
      'https://routinekind.example',
      'https://routinekind.app?redirect=https://evil.example',
      'https://routinekind.app:444',
      'https://user:pass@routinekind.app',
      'routinekind.app@evil.com',
      'javascript://routinekind.app',
      'routinekind',
    ];

    for (const badDomain of badDomains) {
      const expo = buildExpoConfig({ EXPO_PUBLIC_FINAL_BRAND_DOMAIN: badDomain });
      expect(expo.extra.publicLinkDomain).toBe('');
      expect(expo.ios.associatedDomains ?? []).toEqual([]);
      expect(intentFilterText(expo)).not.toContain('"host":');
    }
  });

  it('exposes only production HTTPS store URLs in native config and extra metadata', () => {
    const expo = buildExpoConfig({
      EXPO_PUBLIC_APP_STORE_URL: ' https://apps.apple.com/app/id123456789#token ',
      EXPO_PUBLIC_PLAY_STORE_URL:
        'https://play.google.com/store/apps/details?id=com.routinekind.app#token',
    });

    expect(expo.ios.appStoreUrl).toBe('https://apps.apple.com/app/id123456789');
    expect(expo.android.playStoreUrl).toBe(
      'https://play.google.com/store/apps/details?id=com.routinekind.app',
    );
    expect(expo.extra.appStoreUrl).toBe('https://apps.apple.com/app/id123456789');
    expect(expo.extra.playStoreUrl).toBe(
      'https://play.google.com/store/apps/details?id=com.routinekind.app',
    );
  });

  it('omits malformed, local, credentialed, or placeholder store URLs from native config', () => {
    const expo = buildExpoConfig({
      EXPO_PUBLIC_APP_STORE_URL: 'http://apps.apple.com/app/id123456789',
      EXPO_PUBLIC_PLAY_STORE_URL:
        'https://user:pass@play.google.com/store/apps/details?id=com.routinekind.app',
    });

    expect(expo.ios.appStoreUrl).toBeUndefined();
    expect(expo.android.playStoreUrl).toBeUndefined();
    expect(expo.extra.appStoreUrl).toBe('');
    expect(expo.extra.playStoreUrl).toBe('');

    const placeholder = buildExpoConfig({
      EXPO_PUBLIC_APP_STORE_URL: 'https://example.com/app',
      EXPO_PUBLIC_PLAY_STORE_URL: 'https://routinekind.test/store',
    });
    expect(placeholder.ios.appStoreUrl).toBeUndefined();
    expect(placeholder.android.playStoreUrl).toBeUndefined();
    expect(placeholder.extra.appStoreUrl).toBe('');
    expect(placeholder.extra.playStoreUrl).toBe('');
  });
});
