import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateIosExtensionConfig,
  validateIosExtensionVariantIsolation,
} from './ios-extension-contract.mjs';

function fixture(variant = 'development') {
  const appBundleIdentifier = `com.layerwell.app.${variant}`;
  return {
    packageJson: {
      dependencies: { '@expo/ui': '~57.0.20', 'expo-widgets': '57.0.9' },
    },
    packageLock: {
      lockfileVersion: 3,
      packages: {
        'apps/mobile': {
          dependencies: { '@expo/ui': '~57.0.20', 'expo-widgets': '57.0.9' },
        },
        'node_modules/@expo/ui': {
          version: '57.0.20',
          resolved: 'https://registry.npmjs.org/@expo/ui/-/ui-57.0.20.tgz',
          integrity:
            'sha512-0ChmuyWBwEy3JHMR5wDkJGyvkTR5zH3BTwjJrv3f2ymtamhpU9hD5uH4GsLoWuB6MJFOPTuchq4zByZbtgPyNw==',
        },
        'apps/mobile/node_modules/expo-widgets': {
          version: '57.0.9',
          resolved: 'https://registry.npmjs.org/expo-widgets/-/expo-widgets-57.0.9.tgz',
          integrity:
            'sha512-B0WcPQeY+hillPO0IGsX/MEVUpan5fAWgrBJV7ZVFbK9gcyZ0PsDtPE+2MOOd3XeNlnfyGvaQunW52/8A7FbZw==',
        },
      },
    },
    config: {
      scheme: `layerwell-${variant}`,
      ios: {
        bundleIdentifier: appBundleIdentifier,
        supportsTablet: false,
        infoPlist: { NSSupportsLiveActivities: true },
      },
      plugins: [
        [
          'expo-widgets',
          {
            enableAndroid: false,
            enablePushNotifications: false,
            frequentUpdates: false,
            widgets: [
              {
                name: 'LayerwellToday',
                displayName: 'Today',
                description: 'Generic progress.',
                ios: {
                  supportedFamilies: [
                    'systemSmall',
                    'systemMedium',
                    'accessoryRectangular',
                    'accessoryInline',
                  ],
                },
                android: null,
              },
            ],
          },
        ],
      ],
      extra: {
        eas: {
          build: {
            experimental: {
              ios: {
                appExtensions: [
                  {
                    targetName: 'ExpoWidgetsTarget',
                    bundleIdentifier: `${appBundleIdentifier}.ExpoWidgetsTarget`,
                    entitlements: {
                      'com.apple.security.application-groups': [`group.${appBundleIdentifier}`],
                    },
                  },
                ],
              },
            },
          },
        },
      },
    },
    variant,
  };
}

test('accepts the single derived iOS WidgetKit + ActivityKit extension contract', () => {
  const result = validateIosExtensionConfig(fixture());
  assert.deepEqual(result.errors, []);
  assert.equal(
    result.identity.extensionBundleIdentifier,
    'com.layerwell.app.development.ExpoWidgetsTarget',
  );
});

for (const [name, mutate, pattern] of [
  [
    'rejects a URL scheme that diverges from the compiled widget link allowlist',
    (value) => {
      value.config.scheme = 'wrong-scheme';
    },
    /widget deep links must be regenerated/,
  ],
  [
    'rejects drift in the exact reviewed widget dependency lock',
    (value) => {
      value.packageLock.packages['apps/mobile/node_modules/expo-widgets'].version = '57.0.8';
    },
    /exact registry URL and integrity/,
  ],
  [
    'rejects widget APNs entitlement',
    (value) => {
      value.config.extra.eas.build.experimental.ios.appExtensions[0].entitlements[
        'aps-environment'
      ] = 'production';
    },
    /entitlements must contain only its App Group/,
  ],
  [
    'rejects a colliding or wrong extension identifier',
    (value) => {
      value.config.extra.eas.build.experimental.ios.appExtensions[0].bundleIdentifier =
        'com.layerwell.shared.ExpoWidgetsTarget';
    },
    /extension bundle identifier must be/,
  ],
  [
    'rejects frequent updates',
    (value) => {
      value.config.plugins[0][1].frequentUpdates = true;
    },
    /frequent Live Activity updates must stay disabled/,
  ],
  [
    'rejects Android generation',
    (value) => {
      value.config.plugins[0][1].enableAndroid = true;
    },
    /enableAndroid must be explicitly false/,
  ],
  [
    'rejects Android widget options',
    (value) => {
      value.config.plugins[0][1].widgets[0].android = { targetCellWidth: 4 };
    },
    /must not declare Android generation options/,
  ],
  [
    'rejects the iPad-only extra-large family',
    (value) => {
      value.config.plugins[0][1].widgets[0].ios.supportedFamilies.push('systemExtraLarge');
    },
    /systemExtraLarge\/iPad is out of scope/,
  ],
  [
    'rejects an extra extension',
    (value) => {
      value.config.extra.eas.build.experimental.ios.appExtensions.push({});
    },
    /exactly one generated iOS \.appex/,
  ],
]) {
  test(name, () => {
    const value = fixture();
    mutate(value);
    assert.match(validateIosExtensionConfig(value).errors.join('\n'), pattern);
  });
}

test('rejects cross-variant App Group collisions', () => {
  const identities = [fixture('development'), fixture('staging')].map(
    (value) => validateIosExtensionConfig(value).identity,
  );
  identities[1].appGroupIdentifier = identities[0].appGroupIdentifier;
  assert.match(
    validateIosExtensionVariantIsolation(identities).join('\n'),
    /collide on appGroupIdentifier/,
  );
});
