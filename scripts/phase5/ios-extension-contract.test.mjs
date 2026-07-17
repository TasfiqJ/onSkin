import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateIosExtensionConfig,
  validateIosExtensionVariantIsolation,
} from './ios-extension-contract.mjs';

function fixture(variant = 'development') {
  const appBundleIdentifier = `com.routinekind.app.${variant}`;
  return {
    packageJson: {
      dependencies: { '@expo/ui': '~56.0.22', 'expo-widgets': '56.0.23' },
    },
    packageLock: {
      lockfileVersion: 3,
      packages: {
        'apps/mobile': {
          dependencies: { '@expo/ui': '~56.0.22', 'expo-widgets': '56.0.23' },
        },
        'node_modules/@expo/ui': {
          version: '56.0.22',
          resolved: 'https://registry.npmjs.org/@expo/ui/-/ui-56.0.22.tgz',
          integrity:
            'sha512-B6CXc+WJg2GE4KF6LrCPTf+ozMWKMG9TAVc//gQYUsLzFZzm0vCgUqXRiaNJ6BukpHoZPLKsQZ95VsSyTVda3A==',
        },
        'node_modules/expo-widgets': {
          version: '56.0.23',
          resolved: 'https://registry.npmjs.org/expo-widgets/-/expo-widgets-56.0.23.tgz',
          integrity:
            'sha512-q7A+gqFBpYXSB6gtiiZTbvith1nZTlF8bbhQ0C/dA4A2UOL8+xOG4l9cHnj8MFabZmiArhxXN7uSCji9bRbIpg==',
        },
      },
    },
    config: {
      scheme: `routinekind-${variant}`,
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
                name: 'RoutineKindToday',
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
    'com.routinekind.app.development.ExpoWidgetsTarget',
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
      value.packageLock.packages['node_modules/expo-widgets'].version = '56.0.24';
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
        'com.routinekind.shared.ExpoWidgetsTarget';
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
