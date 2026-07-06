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

describe('Expo app identity config', () => {
  it('defaults unset local config reads to the development install identity', () => {
    const expo = buildExpoConfig({});

    expect(expo.name).toBe('OnSkin Dev');
    expect(expo.slug).toBe('onskin');
    expect(expo.scheme).toBe('onskin-development');
    expect(expo.ios.bundleIdentifier).toBe('com.onskin.app.development');
    expect(expo.android.package).toBe('com.onskin.app.development');
    expect(expo.extra.appVariant).toBe('development');
    expect(expo.extra.appEnvironment).toBe('development');
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

  it('blocks uncleared production builds that would resolve legacy identity values', () => {
    expect(() =>
      buildExpoConfig({
        APP_VARIANT: 'production',
        EXPO_PUBLIC_APP_ENV: 'production',
      }),
    ).toThrow(/Production app identity still resolves legacy OnSkin values/);
  });

  it('blocks partial rebrand production builds that still inherit legacy package IDs', () => {
    expect(() =>
      buildExpoConfig({
        APP_VARIANT: 'production',
        EXPO_PUBLIC_APP_ENV: 'production',
        APP_DISPLAY_NAME: 'RoutineKind',
        APP_SLUG: 'routinekind',
        APP_SCHEME: 'routinekind',
      }),
    ).toThrow(/APP_IOS_BUNDLE_IDENTIFIER/);
  });

  it('allows public runtime identity env to drive native display and scheme fallbacks', () => {
    const expo = buildExpoConfig({
      EXPO_PUBLIC_APP_DISPLAY_NAME: 'RoutineKind',
      EXPO_PUBLIC_APP_SCHEME: 'routinekind',
    });

    expect(expo.name).toBe('RoutineKind');
    expect(expo.scheme).toBe('routinekind');
    expect(expo.ios.bundleIdentifier).toBe('com.onskin.app.development');
    expect(expo.android.package).toBe('com.onskin.app.development');
  });
});
