import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

type IntrospectedConfig = {
  ios?: { deploymentTarget?: string; supportsTablet?: boolean };
  _internal?: {
    modResults?: {
      android?: {
        manifest?: {
          manifest?: {
            application?: { $?: Record<string, string> }[];
          };
        };
      };
      ios?: { entitlements?: Record<string, string> };
    };
  };
};

const requireFromTest = createRequire(import.meta.url);
const EXPO_CLI_PATH = requireFromTest.resolve('expo/bin/cli');
const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('resolved native data protection', () => {
  it('survives the complete Expo config-plugin chain', () => {
    const result = spawnSync(
      process.execPath,
      [EXPO_CLI_PATH, 'config', '--type', 'introspect', '--json'],
      {
        cwd: MOBILE_ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          APP_VARIANT: 'development',
          EXPO_PUBLIC_APP_ENV: 'development',
        },
      },
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
    const config = JSON.parse(result.stdout) as IntrospectedConfig;
    const application = config._internal?.modResults?.android?.manifest?.manifest?.application?.[0];
    const entitlements = config._internal?.modResults?.ios?.entitlements;

    expect(application?.$).toMatchObject({
      'android:allowBackup': 'false',
      'android:dataExtractionRules': '@xml/private_data_extraction_rules',
      'android:fullBackupContent': '@xml/private_data_backup_rules',
    });
    expect(entitlements?.['com.apple.developer.default-data-protection']).toBe(
      'NSFileProtectionComplete',
    );
    expect(config.ios).toMatchObject({ deploymentTarget: '17.0', supportsTablet: false });
  }, 60_000);
});
