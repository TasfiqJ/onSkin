import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

type AndroidManifest = {
  manifest: {
    $: Record<string, string>;
    application: { $: Record<string, string> }[];
  };
};

type InfoPlist = Record<string, unknown> & {
  NSAppTransportSecurity?: Record<string, unknown>;
};

type ReleaseTransportSecurityPlugin = {
  applyAndroidTransportSecurity(manifest: AndroidManifest, variant: string): AndroidManifest;
  applyIosTransportSecurity(infoPlist: InfoPlist, variant: string): InfoPlist;
  readAppVariant(config: { extra?: { appVariant?: unknown } }): string;
};

type IntrospectedConfig = {
  _internal?: {
    modResults?: {
      android?: {
        manifest?: AndroidManifest;
      };
      ios?: { infoPlist?: InfoPlist };
    };
  };
};

const requireFromTest = createRequire(import.meta.url);
const APP_BASE_PATH = requireFromTest.resolve('../../app.base.json');
const PLUGIN_PATH = requireFromTest.resolve('../../plugins/withReleaseTransportSecurity.js');
const EXPO_CLI_PATH = requireFromTest.resolve('expo/bin/cli');
const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const plugin = requireFromTest(PLUGIN_PATH) as ReleaseTransportSecurityPlugin;

function manifest(applicationAttributes: Record<string, string> = {}): AndroidManifest {
  return {
    manifest: {
      $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
      application: [{ $: { 'android:name': '.MainApplication', ...applicationAttributes } }],
    },
  };
}

function introspect(variant: 'development' | 'staging') {
  const result = spawnSync(
    process.execPath,
    [EXPO_CLI_PATH, 'config', '--type', 'introspect', '--json'],
    {
      cwd: MOBILE_ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        APP_VARIANT: variant,
        EXPO_PUBLIC_APP_ENV: variant,
      },
    },
  );

  expect(result.status, result.stderr || result.stdout).toBe(0);
  return JSON.parse(result.stdout) as IntrospectedConfig;
}

describe('release transport security config plugin', () => {
  it('is the final app-owned plugin in the base config', () => {
    const app = JSON.parse(readFileSync(APP_BASE_PATH, 'utf8')).expo as {
      plugins: (string | [string, Record<string, unknown>])[];
    };
    const pluginNames = app.plugins.map((entry) => (Array.isArray(entry) ? entry[0] : entry));

    expect(pluginNames.at(-1)).toBe('./plugins/withReleaseTransportSecurity');
  });

  it('hardens staging and production iOS transport policy without removing unrelated ATS keys', () => {
    for (const variant of ['staging', 'production']) {
      const infoPlist: InfoPlist = {
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
          NSAllowsArbitraryLoadsForMedia: true,
          NSAllowsArbitraryLoadsInWebContent: true,
          NSAllowsLocalNetworking: true,
          NSExceptionDomains: {
            localhost: { NSExceptionAllowsInsecureHTTPLoads: true },
          },
          NSPinnedDomains: { 'api.example.com': { NSIncludesSubdomains: true } },
        },
      };

      expect(plugin.applyIosTransportSecurity(infoPlist, variant)).toBe(infoPlist);
      expect(infoPlist.NSAppTransportSecurity).toEqual({
        NSAllowsArbitraryLoads: false,
        NSAllowsArbitraryLoadsForMedia: false,
        NSAllowsArbitraryLoadsInWebContent: false,
        NSAllowsLocalNetworking: false,
        NSPinnedDomains: { 'api.example.com': { NSIncludesSubdomains: true } },
      });
    }
  });

  it('hardens Android release variants and rejects unreviewed network-security resources', () => {
    for (const variant of ['staging', 'production']) {
      const androidManifest = manifest({ 'android:usesCleartextTraffic': 'true' });

      expect(plugin.applyAndroidTransportSecurity(androidManifest, variant)).toBe(androidManifest);
      expect(androidManifest.manifest.application[0].$).toMatchObject({
        'android:name': '.MainApplication',
        'android:usesCleartextTraffic': 'false',
      });
    }

    expect(() =>
      plugin.applyAndroidTransportSecurity(
        manifest({ 'android:networkSecurityConfig': '@xml/network_security_config' }),
        'production',
      ),
    ).toThrow('unreviewed android:networkSecurityConfig');
  });

  it('preserves development transport allowances and rejects an ambiguous app variant', () => {
    const infoPlist: InfoPlist = {
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
        NSExceptionDomains: { localhost: { NSExceptionAllowsInsecureHTTPLoads: true } },
      },
    };
    const androidManifest = manifest({ 'android:usesCleartextTraffic': 'true' });

    expect(plugin.applyIosTransportSecurity(infoPlist, 'development')).toBe(infoPlist);
    expect(infoPlist.NSAppTransportSecurity?.NSAllowsArbitraryLoads).toBe(true);
    expect(plugin.applyAndroidTransportSecurity(androidManifest, 'development')).toBe(
      androidManifest,
    );
    expect(androidManifest.manifest.application[0].$['android:usesCleartextTraffic']).toBe('true');
    expect(plugin.readAppVariant({ extra: { appVariant: 'staging' } })).toBe('staging');
    expect(() => plugin.readAppVariant({})).toThrow('extra.appVariant');
    expect(() => plugin.readAppVariant({ extra: { appVariant: 'preview' } })).toThrow(
      'extra.appVariant',
    );
  });

  it('wins the complete Expo plugin chain only for release-like variants', () => {
    const development = introspect('development');
    const developmentAts =
      development._internal?.modResults?.ios?.infoPlist?.NSAppTransportSecurity;
    expect(developmentAts?.NSAllowsArbitraryLoads).toBe(true);
    expect(developmentAts?.NSExceptionDomains).toHaveProperty('localhost');

    const staging = introspect('staging');
    const stagingAts = staging._internal?.modResults?.ios?.infoPlist?.NSAppTransportSecurity;
    const stagingApplication =
      staging._internal?.modResults?.android?.manifest?.manifest.application[0];

    expect(stagingAts).toMatchObject({
      NSAllowsArbitraryLoads: false,
      NSAllowsArbitraryLoadsForMedia: false,
      NSAllowsArbitraryLoadsInWebContent: false,
      NSAllowsLocalNetworking: false,
    });
    expect(stagingAts).not.toHaveProperty('NSExceptionDomains');
    expect(stagingApplication?.$['android:usesCleartextTraffic']).toBe('false');
    expect(stagingApplication?.$).not.toHaveProperty('android:networkSecurityConfig');
  }, 60_000);
});
