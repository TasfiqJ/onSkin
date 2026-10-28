import { createHash } from 'node:crypto';
import { proveCurrentNativeSource23 } from '../phase9/ios-privacy-contract.mjs';

const TARGET_NAME = 'ExpoWidgetsTarget';
const WIDGET_NAME = 'LayerwellToday';
const REQUIRED_FAMILIES = [
  'accessoryInline',
  'accessoryRectangular',
  'systemMedium',
  'systemSmall',
];
const EXPECTED_SOURCE_SCHEMES = Object.freeze({
  development: 'layerwell-development',
  staging: 'layerwell-staging',
});
const REVIEWED_DEPENDENCY_LOCKS = Object.freeze({
  '@expo/ui': Object.freeze({
    specifier: '~57.0.25',
    path: 'node_modules/@expo/ui',
    version: '57.0.25',
    resolved: 'https://registry.npmjs.org/@expo/ui/-/ui-57.0.25.tgz',
    integrity:
      'sha512-/BbxsKh/LSIFDnWAHRHfJdCcnqHY7WNcWXjld0soKnYXDUbImjvsFK7y5dqq2XZTbOMyf44BpgAWKUR/B8huCA==',
  }),
  'expo-widgets': Object.freeze({
    specifier: '57.0.26',
    path: 'node_modules/expo-widgets',
    version: '57.0.26',
    resolved: 'https://registry.npmjs.org/expo-widgets/-/expo-widgets-57.0.26.tgz',
    integrity:
      'sha512-gXVYxNeYR08QvohfnyyqTVxGgsF07PtK0Pg/i4vdFs2akT6mf/m4/vc3Co1F5lMDzbQSTpZyCDMxVOImv3F46g==',
  }),
});

export const IOS_WIDGET_EXTENSION_CONTRACT = Object.freeze({
  targetName: TARGET_NAME,
  widgetName: WIDGET_NAME,
  requiredFamilies: Object.freeze([...REQUIRED_FAMILIES]),
  pushUpdatesEnabled: false,
  frequentUpdatesEnabled: false,
  androidEnabled: false,
  reviewedDependencyLocks: REVIEWED_DEPENDENCY_LOCKS,
});

function pluginName(plugin) {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

function pluginOptions(plugin) {
  return Array.isArray(plugin) && plugin[1] && typeof plugin[1] === 'object' ? plugin[1] : {};
}

function sortedStrings(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    ? [...value].sort()
    : null;
}

function sameStrings(actual, expected) {
  return (
    actual !== null &&
    actual.length === expected.length &&
    actual.every((entry, index) => entry === expected[index])
  );
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate the source/config-plugin contract that deterministically generates the
 * single iOS WidgetKit + ActivityKit extension. Signed-binary and device proof are
 * deliberately separate release gates.
 */
export function validateIosExtensionConfig({ config, packageJson, packageLock, variant }) {
  const errors = [];
  const require = (condition, message) => {
    if (!condition) errors.push(`${variant}: ${message}`);
  };

  require(packageLock?.lockfileVersion ===
    3, 'package-lock.json must use reviewed lockfileVersion 3.');
  for (const [dependency, reviewed] of Object.entries(REVIEWED_DEPENDENCY_LOCKS)) {
    require(packageJson?.dependencies?.[dependency] ===
      reviewed.specifier, `${dependency} must stay pinned to the reviewed Expo SDK 57 range ${reviewed.specifier}.`);
    require(packageLock?.packages?.['apps/mobile']?.dependencies?.[dependency] ===
      reviewed.specifier, `package-lock.json must preserve the ${dependency} workspace specifier ${reviewed.specifier}.`);
    const locked = packageLock?.packages?.[reviewed.path];
    require(locked?.version === reviewed.version &&
      locked?.resolved === reviewed.resolved &&
      locked?.integrity ===
        reviewed.integrity, `${dependency} must resolve to reviewed version ${reviewed.version} with its exact registry URL and integrity.`);
  }

  const appBundleIdentifier = config?.ios?.bundleIdentifier;
  const appScheme = config?.scheme;
  const expectedSourceScheme = EXPECTED_SOURCE_SCHEMES[variant];
  require(isNonEmptyString(
    appBundleIdentifier,
  ), 'the resolved iOS app bundle identifier is missing.');
  require(config?.ios?.supportsTablet === false, 'the launch contract is iPhone-only.');
  require(config?.ios?.infoPlist?.NSSupportsLiveActivities ===
    true, 'NSSupportsLiveActivities must be true.');
  require(isNonEmptyString(appScheme), 'the resolved app URL scheme is missing.');
  if (expectedSourceScheme) {
    require(appScheme ===
      expectedSourceScheme, `the resolved ${variant} app URL scheme must be ${expectedSourceScheme}; widget deep links must be regenerated when final production identity changes.`);
  }

  const widgetPlugins = (config?.plugins ?? []).filter(
    (plugin) => pluginName(plugin) === 'expo-widgets',
  );
  require(widgetPlugins.length === 1, 'exactly one expo-widgets config plugin is required.');

  const options = pluginOptions(widgetPlugins[0]);
  require(options.enableAndroid ===
    false, 'enableAndroid must be explicitly false for iOS-only V1.');
  require(options.enablePushNotifications ===
    false, 'widget push notifications must stay disabled until a reviewed ActivityKit APNs pipeline exists.');
  require(options.frequentUpdates === false, 'frequent Live Activity updates must stay disabled.');
  require(options.bundleIdentifier === undefined &&
    options.groupIdentifier ===
      undefined, 'extension and App Group identifiers must be derived from each resolved app variant.');

  const widgets = Array.isArray(options.widgets) ? options.widgets : [];
  require(widgets.length === 1, 'exactly one allowlisted home/Lock Screen widget is required.');
  const widget = widgets[0] ?? {};
  require(widget.name === WIDGET_NAME, `the only widget must be named ${WIDGET_NAME}.`);
  require(isNonEmptyString(widget.displayName), 'widget displayName is missing.');
  require(isNonEmptyString(widget.description), 'widget description is missing.');
  require(widget.ios !== null &&
    typeof widget.ios === 'object', 'the widget iOS config is missing.');
  require(widget.android === null ||
    widget.android === undefined ||
    (typeof widget.android === 'object' &&
      Object.keys(widget.android).length ===
        0), 'the widget must not declare Android generation options.');
  require(sameStrings(
    sortedStrings(widget.ios?.supportedFamilies),
    REQUIRED_FAMILIES,
  ), `supported families must be exactly ${REQUIRED_FAMILIES.join(', ')}; systemExtraLarge/iPad is out of scope.`);

  const expectedExtensionBundleIdentifier = isNonEmptyString(appBundleIdentifier)
    ? `${appBundleIdentifier}.${TARGET_NAME}`
    : null;
  const expectedGroupIdentifier = isNonEmptyString(appBundleIdentifier)
    ? `group.${appBundleIdentifier}`
    : null;
  const extensions = config?.extra?.eas?.build?.experimental?.ios?.appExtensions;
  require(Array.isArray(extensions), 'Expo did not resolve an iOS app-extension declaration.');
  require(extensions?.length === 1, 'exactly one generated iOS .appex declaration is required.');
  const extension = Array.isArray(extensions) ? (extensions[0] ?? {}) : {};
  require(extension.targetName === TARGET_NAME, `extension target must be ${TARGET_NAME}.`);
  require(extension.bundleIdentifier ===
    expectedExtensionBundleIdentifier, `extension bundle identifier must be ${expectedExtensionBundleIdentifier ?? '<derived>'}.`);

  const entitlements = extension.entitlements;
  const entitlementKeys =
    entitlements && typeof entitlements === 'object' ? Object.keys(entitlements).sort() : [];
  require(sameStrings(entitlementKeys, [
    'com.apple.security.application-groups',
  ]), 'source extension entitlements must contain only its App Group (no APNs, SIWA, or associated domains).');
  require(sameStrings(
    sortedStrings(entitlements?.['com.apple.security.application-groups']),
    expectedGroupIdentifier ? [expectedGroupIdentifier] : [],
  ), `extension App Group must be ${expectedGroupIdentifier ?? '<derived>'}.`);

  return {
    errors,
    identity:
      errors.length === 0
        ? {
            variant,
            appScheme,
            appBundleIdentifier,
            extensionBundleIdentifier: expectedExtensionBundleIdentifier,
            appGroupIdentifier: expectedGroupIdentifier,
          }
        : null,
  };
}

// Current source compatibility is separate from the unchanged historical
// validator. It authenticates the actual current root, lock and installed native
// sources before projecting only the historical dependency metadata expected by
// the old config assertions. All config/entitlement/lifecycle assertions still run.
export function validateIosExtensionConfig23({ root, config, packageJson, packageLock, variant }) {
  try {
    const { report, witness } = proveCurrentNativeSource23(root);
    const hash = (value) => createHash('sha256').update(`${JSON.stringify(value, null, 2)}\n`).digest('hex');
    if (hash(packageJson) !== witness.mobilePackage.sha256 ||
        hash(packageLock) !== report.inputs.packageLock.sha256) throw new Error('CURRENT_CONFIG_INPUT_DRIFT');
    for (const [name, expected] of Object.entries(witness.widgetCompatibility)) {
      const actual = packageLock.packages[`node_modules/${name}`];
      if (packageJson.dependencies[name] !== expected.specifier ||
          packageLock.packages['apps/mobile'].dependencies[name] !== expected.specifier ||
          ['version', 'resolved', 'integrity'].some((key) => actual?.[key] !== expected[key])) {
        throw new Error('CURRENT_WIDGET_SOURCE_DRIFT');
      }
    }
    const historicalPackage = structuredClone(packageJson);
    const historicalLock = structuredClone(packageLock);
    for (const [name, expected] of Object.entries(REVIEWED_DEPENDENCY_LOCKS)) {
      historicalPackage.dependencies[name] = expected.specifier;
      historicalLock.packages['apps/mobile'].dependencies[name] = expected.specifier;
      for (const key of ['version', 'resolved', 'integrity']) {
        historicalLock.packages[expected.path][key] = expected[key];
      }
    }
    return { ...validateIosExtensionConfig({ config, packageJson: historicalPackage,
      packageLock: historicalLock, variant }), sourceCompatibility: {
      kind: 'CURRENT_NATIVE_SOURCE23', sourceOnly: true, nativeAccepted: false,
      archiveInspected: false, publicReleaseAuthorized: false,
      witnessSHA256: report.inputs.lockSuccession23.sha256,
    } };
  } catch {
    return { errors: [`${variant}: CURRENT_NATIVE_SOURCE23_IDENTITY_REQUIRED`], identity: null };
  }
}

export function validateIosExtensionVariantIsolation(identities) {
  const errors = [];
  for (const field of [
    'appScheme',
    'appBundleIdentifier',
    'extensionBundleIdentifier',
    'appGroupIdentifier',
  ]) {
    const values = identities.map((identity) => identity?.[field]).filter(isNonEmptyString);
    if (new Set(values).size !== values.length) {
      errors.push(`Resolved iOS widget variants collide on ${field}.`);
    }
  }
  return errors;
}
