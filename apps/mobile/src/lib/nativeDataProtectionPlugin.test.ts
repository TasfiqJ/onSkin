import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

type AndroidManifest = {
  manifest: {
    $: Record<string, string>;
    queries: unknown[];
    application: { $: Record<string, string> }[];
  };
};

type BackupResource = Readonly<{ source: string; target: string }>;

type PrivateStorageProtectionPlugin = {
  ANDROID_BACKUP_RESOURCE_FILES: readonly BackupResource[];
  applyAndroidBackupManifest(manifest: AndroidManifest): AndroidManifest;
  writeAndroidBackupRules(androidProjectRoot: string): void;
};

const requirePlugin = createRequire(import.meta.url);
const APP_BASE_PATH = requirePlugin.resolve('../../app.base.json');
const PLUGIN_PATH = requirePlugin.resolve('../../plugins/withPrivateStorageProtection.js');
const plugin = requirePlugin(PLUGIN_PATH) as PrivateStorageProtectionPlugin;
const EXPECTED_DOMAINS = [
  'root',
  'file',
  'database',
  'sharedpref',
  'external',
  'device_root',
  'device_file',
  'device_database',
  'device_sharedpref',
];

function readAppBase() {
  return JSON.parse(readFileSync(APP_BASE_PATH, 'utf8')).expo as {
    ios: { entitlements?: Record<string, string> };
    android: Record<string, unknown>;
    plugins: (string | [string, Record<string, unknown>])[];
  };
}

function excludedDomains(xml: string) {
  return Array.from(xml.matchAll(/<exclude domain="([^"]+)" path="\." \/>/g), (match) => match[1]);
}

describe('private native storage protection config', () => {
  it('moves native protection ownership from Expo fields to the app plugin', () => {
    const app = readAppBase();
    const pluginNames = app.plugins.map((entry) => (Array.isArray(entry) ? entry[0] : entry));

    expect(app.ios.entitlements?.['com.apple.developer.default-data-protection']).toBe(
      'NSFileProtectionComplete',
    );
    expect(app.android).not.toHaveProperty('allowBackup');
    expect(pluginNames).toContain('./plugins/withPrivateStorageProtection');
    expect(app.plugins).toContainEqual([
      'expo-secure-store',
      { configureAndroidBackup: false },
    ]);
  });

  it('owns every Android backup manifest attribute and preserves unrelated values', () => {
    const manifest: AndroidManifest = {
      manifest: {
        $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
        queries: [],
        application: [
          {
            $: {
              'android:name': '.MainApplication',
              'android:label': '@string/app_name',
              'android:allowBackup': 'true',
            },
          },
        ],
      },
    };

    expect(plugin.applyAndroidBackupManifest(manifest)).toBe(manifest);
    expect(manifest.manifest.application[0].$).toEqual({
      'android:name': '.MainApplication',
      'android:label': '@string/app_name',
      'android:allowBackup': 'false',
      'android:fullBackupContent': '@xml/private_data_backup_rules',
      'android:dataExtractionRules': '@xml/private_data_extraction_rules',
    });
  });

  it('excludes every supported storage domain from legacy backup, cloud backup, and D2D transfer', () => {
    const [legacyResource, extractionResource] = plugin.ANDROID_BACKUP_RESOURCE_FILES;
    const legacyXml = readFileSync(legacyResource.source, 'utf8');
    const extractionXml = readFileSync(extractionResource.source, 'utf8');

    expect(legacyXml).toContain('<full-backup-content>');
    expect(legacyXml).not.toContain('<include');
    expect(excludedDomains(legacyXml)).toEqual(EXPECTED_DOMAINS);

    expect(extractionXml).toContain('<cloud-backup disableIfNoEncryptionCapabilities="true">');
    expect(extractionXml).toContain('<device-transfer>');
    expect(extractionXml).not.toContain('<include');
    expect(excludedDomains(extractionXml)).toEqual([...EXPECTED_DOMAINS, ...EXPECTED_DOMAINS]);
  });

  it('copies the checked-in XML byte-for-byte into deterministic Android resource paths', () => {
    const androidProjectRoot = mkdtempSync(join(tmpdir(), 'routinekind-native-protection-'));

    try {
      plugin.writeAndroidBackupRules(androidProjectRoot);
      plugin.writeAndroidBackupRules(androidProjectRoot);

      for (const resource of plugin.ANDROID_BACKUP_RESOURCE_FILES) {
        expect(readFileSync(join(androidProjectRoot, resource.target))).toEqual(
          readFileSync(resource.source),
        );
      }
    } finally {
      rmSync(androidProjectRoot, { recursive: true, force: true });
    }
  });

  it('keeps every plugin-owned resource under the Android res/xml directory', () => {
    const pluginDirectory = dirname(PLUGIN_PATH);

    for (const resource of plugin.ANDROID_BACKUP_RESOURCE_FILES) {
      expect(resource.source.startsWith(join(pluginDirectory, 'android'))).toBe(true);
      expect(resource.target.replaceAll('\\', '/')).toMatch(
        /^app\/src\/main\/res\/xml\/[a-z0-9_]+\.xml$/,
      );
    }
  });
});
