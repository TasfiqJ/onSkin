const base = require('./app.base.json');
const { createExpoFontPluginOptions } = require('./font-assets');
const { assertReleaseReadyReviewEvidence } = require('./phase3-review-evidence');
const launchContract = require('../../docs/hugeToDo/launch-contract.json');

const APP_VARIANTS = new Set(['development', 'staging', 'production']);
const IOS_WIDGET_EXTENSION_BUILD_ENV = 'IOS_WIDGET_EXTENSION_BUILD_ENABLED';

function readVariantEnv(name, value, defaultValue) {
  const rawValue = value === undefined ? defaultValue : value;
  const candidate = typeof rawValue === 'string' ? rawValue.trim().toLowerCase() : '';
  if (candidate && APP_VARIANTS.has(candidate)) return candidate;
  throw new Error(
    `${name} must be development, staging, or production; got ${value ?? '<unset>'}.`,
  );
}

function readOptionalBooleanEnv(name, value) {
  if (value === undefined) return false;
  const candidate = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (candidate === 'true') return true;
  if (candidate === 'false') return false;
  throw new Error(`${name} must be true or false; got ${value ?? '<unset>'}.`);
}

const variant = readVariantEnv('APP_VARIANT', process.env.APP_VARIANT, 'development');
const appEnvironment =
  process.env.EXPO_PUBLIC_APP_ENV === undefined
    ? variant
    : readVariantEnv('EXPO_PUBLIC_APP_ENV', process.env.EXPO_PUBLIC_APP_ENV);
if (appEnvironment !== variant) {
  throw new Error(
    `APP_VARIANT and EXPO_PUBLIC_APP_ENV must match exactly; got ${variant} and ${appEnvironment}.`,
  );
}
const isProduction = variant === 'production';
const customProGrantEnabled = readOptionalBooleanEnv(
  'EXPO_PUBLIC_CUSTOM_PRO_GRANT_ENABLED',
  process.env.EXPO_PUBLIC_CUSTOM_PRO_GRANT_ENABLED,
);
if (customProGrantEnabled && variant !== 'development') {
  throw new Error(
    'EXPO_PUBLIC_CUSTOM_PRO_GRANT_ENABLED may be true only for a development build; the iOS release candidate must use StoreKit purchase or introductory-offer authority.',
  );
}
const iosWinBackEnabled = readOptionalBooleanEnv(
  'EXPO_PUBLIC_IOS_WIN_BACK_ENABLED',
  process.env.EXPO_PUBLIC_IOS_WIN_BACK_ENABLED,
);
if (iosWinBackEnabled && launchContract.iosWinBackOfferAdmission?.winBackOfferAdmitted !== true) {
  throw new Error(
    'EXPO_PUBLIC_IOS_WIN_BACK_ENABLED cannot be true while the versioned launch contract does not admit an iOS win-back offer. Reopen PAY-08 and update the reviewed admission before enabling a build.',
  );
}
const iosWidgetExtensionBuildEnabled = readOptionalBooleanEnv(
  IOS_WIDGET_EXTENSION_BUILD_ENV,
  process.env[IOS_WIDGET_EXTENSION_BUILD_ENV],
);
if ((isProduction || appEnvironment === 'production') && iosWidgetExtensionBuildEnabled) {
  throw new Error(
    'Production iOS widget extension builds remain blocked until lifecycle, withdrawal cleanup, privacy, signed-binary, and physical-device evidence gates are implemented and bound to a separate production clearance.',
  );
}
const androidReleaseRequired = launchContract.release.platforms.includes('android');
const legacyIdentityPattern = /(^|[./:_-])onskin($|[./:_-])|on\s*skin/i;
const CONTROL_CHAR_RE = /[\u0000-\u001F\u007F]/;
const MAX_EXTERNAL_URL_LENGTH = 2048;
const PLACEHOLDER_ENV_VALUE =
  /example\.com|your-project|replace-with|__blocked_placeholder__|x{4,}|\.{3,}|pending/i;
const PUBLIC_PRODUCTION_HOSTNAME =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const RESERVED_PRODUCTION_HOSTNAME =
  /(?:^localhost$|\.localhost$|\.local$|\.test$|\.invalid$|\.example$)/;
const EXPORT_CLASSIFICATIONS = new Set(['exempt', 'non_exempt']);
const MAX_APPLE_EXPORT_COMPLIANCE_CODE_LENGTH = 1024;
const IOS_BUILD_NUMBER_PATTERN = /^[1-9]\d{0,17}$/;
const SUPPORT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CAMERA_PERMISSION_PRODUCT_NAME_TOKEN = '$(PRODUCT_NAME)';
const CAMERA_PERMISSION_PRODUCT_NAME_CONTROL_CHAR_RE = /[\u0000-\u001F\u007F-\u009F]/;
const CAMERA_PERMISSION_PRODUCT_NAME_BUILD_VARIABLE_RE = /\$(?:\(|\{)/u;
const REVIEWED_CAMERA_PERMISSION_TEMPLATE =
  'Allow $(PRODUCT_NAME) to use the camera to scan product barcodes, capture ingredient labels, and take guided progress photos. Barcode frames are processed on your device; label and progress photos remain local.';

const variantSuffix =
  {
    development: 'Dev',
    staging: 'Staging',
    production: '',
  }[variant] ?? variant;

function withVariant(baseValue, suffix) {
  if (isProduction || !suffix) return baseValue;
  return `${baseValue}.${variant}`;
}

function displayName(baseName) {
  if (process.env.APP_DISPLAY_NAME) return process.env.APP_DISPLAY_NAME;
  if (process.env.EXPO_PUBLIC_APP_DISPLAY_NAME) return process.env.EXPO_PUBLIC_APP_DISPLAY_NAME;
  if (isProduction || !variantSuffix) return baseName;
  return `${baseName} ${variantSuffix}`;
}

function pluginName(plugin) {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

function pluginOptions(plugin) {
  return Array.isArray(plugin) && typeof plugin[1] === 'object' && plugin[1] !== null
    ? plugin[1]
    : {};
}

function buildPlugins(plugins, permissionCopy, widgetDeepLink) {
  const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  const sentryOrg = process.env.SENTRY_ORG;
  const sentryProject = process.env.SENTRY_PROJECT;

  return plugins.flatMap((plugin) => {
    const name = pluginName(plugin);

    // Keep incomplete native extension source out of ordinary and store
    // binaries. Dedicated QA builds opt in explicitly; production config still
    // has to pass every identity, review, and evidence gate below.
    if (
      (name === 'expo-widgets' || name === './plugins/withLayerwellWidgetPrivacyManifest') &&
      !iosWidgetExtensionBuildEnabled
    ) {
      return [];
    }

    if (name === 'expo-camera') {
      return [
        [
          name,
          {
            ...pluginOptions(plugin),
            cameraPermission: permissionCopy.cameraPermission,
          },
        ],
      ];
    }

    if (name === 'expo-local-authentication') {
      return [
        [
          name,
          {
            ...pluginOptions(plugin),
            faceIDPermission: permissionCopy.faceIDPermission,
          },
        ],
      ];
    }

    if (name === 'expo-font') {
      return [[name, createExpoFontPluginOptions()]];
    }

    if (name === '@react-native-google-signin/google-signin' && googleIosUrlScheme) {
      return [[name, { iosUrlScheme: googleIosUrlScheme }]];
    }

    if (name === '@sentry/react-native' && sentryOrg && sentryProject) {
      return [
        [
          name,
          {
            url: 'https://sentry.io/',
            organization: sentryOrg,
            project: sentryProject,
          },
        ],
      ];
    }

    if (name === './plugins/withLayerwellWidgetPrivacyManifest') {
      return [[name, { ...pluginOptions(plugin), deepLink: widgetDeepLink }]];
    }

    return [plugin];
  });
}

function normalizeDomain(value) {
  const trimmed = String(value ?? '').trim();
  if (placeholderEnvValue(trimmed) || CONTROL_CHAR_RE.test(trimmed)) return '';

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return '';
  }

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.port
  ) {
    return '';
  }

  const hostname = url.hostname.toLowerCase();
  return productionHostname(hostname) ? hostname : '';
}

function productionUrl(value) {
  const trimmed = String(value ?? '').trim();
  if (
    placeholderEnvValue(trimmed) ||
    CONTROL_CHAR_RE.test(trimmed) ||
    trimmed.length > MAX_EXTERNAL_URL_LENGTH
  ) {
    return '';
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return '';
  }

  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return '';
  if (!productionHostname(url.hostname)) return '';
  url.hash = '';
  return url.toString();
}

function hasValue(value) {
  return String(value ?? '').trim().length > 0;
}

function assertCameraPermissionCompatibilityInput(name, value, reviewedCopy) {
  // These legacy keys remain readable only so a blank documented dotenv
  // assignment does not break local builds. They are not customization points:
  // accepting arbitrary copy here would let an EAS environment silently replace
  // the reviewed purpose string after source review.
  if (value === undefined || value === '') return;
  if (typeof value !== 'string' || value !== reviewedCopy) {
    throw new Error(
      `${name} must be blank or exactly equal the reviewed camera permission copy derived from the resolved app display name. Remove this legacy override to use the deterministic source-reviewed value.`,
    );
  }
}

function assertCameraPermissionProductName(appName) {
  if (
    typeof appName !== 'string' ||
    !appName ||
    appName.trim() !== appName ||
    CAMERA_PERMISSION_PRODUCT_NAME_CONTROL_CHAR_RE.test(appName) ||
    appName.includes(CAMERA_PERMISSION_PRODUCT_NAME_TOKEN) ||
    CAMERA_PERMISSION_PRODUCT_NAME_BUILD_VARIABLE_RE.test(appName)
  ) {
    throw new Error(
      'The resolved app display name used in camera permission copy must be non-empty, contain no surrounding whitespace or control characters, and contain no Xcode/build-variable syntax such as $(...) or ${...}.',
    );
  }
}

function resolveCameraPermissionCopy(appName) {
  const baseCameraPlugin = (base.expo.plugins ?? []).find(
    (plugin) => pluginName(plugin) === 'expo-camera',
  );
  const baseUsageDescription = base.expo.ios?.infoPlist?.NSCameraUsageDescription;
  const basePluginPermission = pluginOptions(baseCameraPlugin).cameraPermission;
  if (
    baseUsageDescription !== REVIEWED_CAMERA_PERMISSION_TEMPLATE ||
    basePluginPermission !== REVIEWED_CAMERA_PERMISSION_TEMPLATE
  ) {
    throw new Error(
      'Base iOS NSCameraUsageDescription and expo-camera cameraPermission must both equal the reviewed camera permission template.',
    );
  }

  assertCameraPermissionProductName(appName);
  const reviewedCopy = REVIEWED_CAMERA_PERMISSION_TEMPLATE.replace(
    CAMERA_PERMISSION_PRODUCT_NAME_TOKEN,
    () => appName,
  );
  assertCameraPermissionCompatibilityInput(
    'APP_CAMERA_USAGE_DESCRIPTION',
    process.env.APP_CAMERA_USAGE_DESCRIPTION,
    reviewedCopy,
  );
  assertCameraPermissionCompatibilityInput(
    'APP_CAMERA_PERMISSION',
    process.env.APP_CAMERA_PERMISSION,
    reviewedCopy,
  );
  return reviewedCopy;
}

function placeholderEnvValue(value) {
  const trimmed = String(value ?? '').trim();
  return !trimmed || PLACEHOLDER_ENV_VALUE.test(trimmed);
}

function productionHostname(hostname) {
  const normalized = String(hostname ?? '')
    .trim()
    .toLowerCase();
  return (
    PUBLIC_PRODUCTION_HOSTNAME.test(normalized) &&
    !RESERVED_PRODUCTION_HOSTNAME.test(normalized) &&
    !normalized.includes('example.com') &&
    !placeholderEnvValue(normalized)
  );
}

function assertProductionIdentity(expo, permissionCopy) {
  if (!isProduction) return;

  const identityValues = {
    APP_DISPLAY_NAME: expo.name,
    EXPO_PUBLIC_APP_DISPLAY_NAME: process.env.EXPO_PUBLIC_APP_DISPLAY_NAME,
    APP_SLUG: expo.slug,
    APP_SCHEME: expo.scheme,
    EXPO_PUBLIC_APP_SCHEME: process.env.EXPO_PUBLIC_APP_SCHEME,
    APP_IOS_BUNDLE_IDENTIFIER: expo.ios?.bundleIdentifier,
    APP_ANDROID_PACKAGE: expo.android?.package,
    EXPO_PUBLIC_FINAL_BRAND_DOMAIN: process.env.EXPO_PUBLIC_FINAL_BRAND_DOMAIN,
    EXPO_PUBLIC_APP_STORE_URL: process.env.EXPO_PUBLIC_APP_STORE_URL,
    EXPO_PUBLIC_PLAY_STORE_URL: process.env.EXPO_PUBLIC_PLAY_STORE_URL,
    EXPO_PUBLIC_SUPPORT_EMAIL: process.env.EXPO_PUBLIC_SUPPORT_EMAIL,
    APP_CAMERA_USAGE_DESCRIPTION: permissionCopy.cameraUsageDescription,
    APP_FACE_ID_USAGE_DESCRIPTION: permissionCopy.faceIDUsageDescription,
    APP_CAMERA_PERMISSION: permissionCopy.cameraPermission,
    APP_FACE_ID_PERMISSION: permissionCopy.faceIDPermission,
  };
  const legacyKeys = Object.entries(identityValues)
    .filter(([, value]) => legacyIdentityPattern.test(String(value ?? '')))
    .map(([key]) => key);

  if (legacyKeys.length > 0) {
    throw new Error(
      `Production app identity contains the rejected legacy brand in: ${legacyKeys.join(', ')}.`,
    );
  }

  if (process.env.BRAND_LEGAL_CLEARANCE !== 'cleared') {
    throw new Error(
      'Production app identity requires BRAND_LEGAL_CLEARANCE=cleared before native config can resolve.',
    );
  }

  const finalIdentityEnv = {
    'APP_DISPLAY_NAME or EXPO_PUBLIC_APP_DISPLAY_NAME':
      process.env.APP_DISPLAY_NAME ?? process.env.EXPO_PUBLIC_APP_DISPLAY_NAME,
    APP_SLUG: process.env.APP_SLUG,
    'APP_SCHEME or EXPO_PUBLIC_APP_SCHEME':
      process.env.APP_SCHEME ?? process.env.EXPO_PUBLIC_APP_SCHEME,
    APP_IOS_BUNDLE_IDENTIFIER: process.env.APP_IOS_BUNDLE_IDENTIFIER,
    ...(androidReleaseRequired ? { APP_ANDROID_PACKAGE: process.env.APP_ANDROID_PACKAGE } : {}),
  };
  const missingFinalIdentityKeys = Object.entries(finalIdentityEnv)
    .filter(([, value]) => !hasValue(value))
    .map(([key]) => key);

  if (missingFinalIdentityKeys.length > 0) {
    throw new Error(
      `Production app identity requires explicit final native identity env values after brand clearance: ${missingFinalIdentityKeys.join(
        ', ',
      )}. Set them in EAS env/secrets before building production.`,
    );
  }
}

function assertProductionReviewClearance() {
  if (!isProduction && appEnvironment !== 'production') return;

  if (process.env.PHASE3_RELEASE_CLEARANCE !== 'cleared') {
    throw new Error(
      'Production release requires PHASE3_RELEASE_CLEARANCE=cleared after the Phase 3 legal, privacy, clinical, chemistry, and IP review packet and detached item signoffs are complete. Development and staging builds remain available for review.',
    );
  }

  const testWorklist =
    process.env.NODE_ENV === 'test'
      ? globalThis.__LAYERWELL_PHASE3_REVIEW_TEST_WORKLIST__
      : undefined;
  assertReleaseReadyReviewEvidence({ worklist: testWorklist });
}

function applyProductionExportCompliance(expo) {
  if (!isProduction && appEnvironment !== 'production') return;

  if (process.env.EXPORT_COMPLIANCE_CLEARANCE !== 'cleared') {
    throw new Error(
      'Production release requires EXPORT_COMPLIANCE_CLEARANCE=cleared after a qualified reviewer classifies the exact shipped binary and launch territories. The app includes XChaCha20-Poly1305 and legacy AES migration code, so this declaration must not be guessed.',
    );
  }

  const classification = String(process.env.APP_ENCRYPTION_CLASSIFICATION ?? '')
    .trim()
    .toLowerCase();
  if (!EXPORT_CLASSIFICATIONS.has(classification)) {
    throw new Error(
      'Production release requires APP_ENCRYPTION_CLASSIFICATION=exempt or non_exempt, matching the retained export-compliance decision.',
    );
  }

  expo.ios.infoPlist ??= {};
  if (classification === 'exempt') {
    expo.ios.infoPlist.ITSAppUsesNonExemptEncryption = false;
    delete expo.ios.infoPlist.ITSEncryptionExportComplianceCode;
    return;
  }

  const complianceCode = String(process.env.APP_ENCRYPTION_EXPORT_COMPLIANCE_CODE ?? '').trim();
  if (
    !hasValue(complianceCode) ||
    complianceCode.length > MAX_APPLE_EXPORT_COMPLIANCE_CODE_LENGTH ||
    CONTROL_CHAR_RE.test(complianceCode) ||
    placeholderEnvValue(complianceCode)
  ) {
    throw new Error(
      'APP_ENCRYPTION_CLASSIFICATION=non_exempt requires a valid APP_ENCRYPTION_EXPORT_COMPLIANCE_CODE issued through App Store Connect after documentation review.',
    );
  }
  expo.ios.infoPlist.ITSAppUsesNonExemptEncryption = true;
  expo.ios.infoPlist.ITSEncryptionExportComplianceCode = complianceCode;
}

function applyProductionReleaseBinding(expo) {
  if (!isProduction) return '';

  const buildNumber = String(process.env.CATALOG_RELEASE_IOS_BUILD_NUMBER ?? '').trim();
  if (!IOS_BUILD_NUMBER_PATTERN.test(buildNumber)) {
    throw new Error(
      'Production iOS config requires CATALOG_RELEASE_IOS_BUILD_NUMBER as the exact reviewed positive decimal build number.',
    );
  }

  const supportEmail = String(process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '').trim();
  if (
    !SUPPORT_EMAIL_PATTERN.test(supportEmail) ||
    CONTROL_CHAR_RE.test(supportEmail) ||
    placeholderEnvValue(supportEmail)
  ) {
    throw new Error(
      'Production iOS config requires a final non-placeholder EXPO_PUBLIC_SUPPORT_EMAIL.',
    );
  }

  expo.ios.buildNumber = buildNumber;
  return supportEmail;
}

module.exports = () => {
  const expo = JSON.parse(JSON.stringify(base.expo));
  const baseScheme = expo.scheme;
  const baseIosBundle = expo.ios.bundleIdentifier;
  const baseAndroidPackage = expo.android.package;
  const finalDomain = normalizeDomain(process.env.EXPO_PUBLIC_FINAL_BRAND_DOMAIN);
  const appStoreUrl = productionUrl(process.env.EXPO_PUBLIC_APP_STORE_URL);
  const playStoreUrl = productionUrl(process.env.EXPO_PUBLIC_PLAY_STORE_URL);

  expo.name = displayName(expo.name);
  const appName = expo.name;
  const cameraPermission = resolveCameraPermissionCopy(appName);
  const permissionCopy = {
    cameraUsageDescription: cameraPermission,
    faceIDUsageDescription:
      process.env.APP_FACE_ID_USAGE_DESCRIPTION ??
      `${appName} uses Face ID to keep your private photo timeline for your eyes only.`,
    cameraPermission,
    faceIDPermission:
      process.env.APP_FACE_ID_PERMISSION ??
      `${appName} uses Face ID to keep your private photo timeline for your eyes only.`,
  };
  expo.slug = process.env.APP_SLUG ?? expo.slug;
  expo.scheme =
    process.env.APP_SCHEME ??
    process.env.EXPO_PUBLIC_APP_SCHEME ??
    (isProduction ? baseScheme : `${baseScheme}-${variant}`);
  expo.ios.bundleIdentifier =
    process.env.APP_IOS_BUNDLE_IDENTIFIER ?? withVariant(baseIosBundle, variant);
  expo.android.package =
    process.env.APP_ANDROID_PACKAGE ?? withVariant(baseAndroidPackage, variant);
  expo.ios.infoPlist = {
    ...(expo.ios.infoPlist ?? {}),
    NSCameraUsageDescription: permissionCopy.cameraUsageDescription,
    NSFaceIDUsageDescription: permissionCopy.faceIDUsageDescription,
  };
  expo.ios.entitlements = {
    ...(expo.ios.entitlements ?? {}),
    'com.apple.developer.declared-age-range': true,
  };
  if (!iosWidgetExtensionBuildEnabled) {
    delete expo.ios.infoPlist.NSSupportsLiveActivities;
    delete expo.ios.infoPlist.NSSupportsLiveActivitiesFrequentUpdates;
  }
  assertProductionIdentity(expo, permissionCopy);
  assertProductionReviewClearance();
  applyProductionExportCompliance(expo);
  const productionSupportEmail = applyProductionReleaseBinding(expo);
  if (finalDomain) {
    expo.ios.associatedDomains = Array.from(
      new Set([...(expo.ios.associatedDomains ?? []), `applinks:${finalDomain}`]),
    );
    expo.android.intentFilters = [
      ...(expo.android.intentFilters ?? []),
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: finalDomain, pathPrefix: '/' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ];
  }
  if (appStoreUrl) expo.ios.appStoreUrl = appStoreUrl;
  if (playStoreUrl) expo.android.playStoreUrl = playStoreUrl;
  expo.plugins = buildPlugins(expo.plugins, permissionCopy, `${expo.scheme}://today`);
  expo.extra = {
    ...(expo.extra ?? {}),
    appVariant: variant,
    appEnvironment,
    publicLinkDomain: finalDomain,
    appStoreUrl,
    playStoreUrl,
    supportEmail: productionSupportEmail,
    iosWidgetExtensionBuildEnabled,
  };

  return { expo };
};
