const base = require('./app.base.json');
const { assertReleaseReadyReviewEvidence } = require('./phase3-review-evidence');

const APP_VARIANTS = new Set(['development', 'staging', 'production']);

function readVariantEnv(name, value, defaultValue) {
  const rawValue = value === undefined ? defaultValue : value;
  const candidate = typeof rawValue === 'string' ? rawValue.trim().toLowerCase() : '';
  if (candidate && APP_VARIANTS.has(candidate)) return candidate;
  throw new Error(
    `${name} must be development, staging, or production; got ${value ?? '<unset>'}.`,
  );
}

const variant = readVariantEnv('APP_VARIANT', process.env.APP_VARIANT, 'development');
const appEnvironment =
  process.env.EXPO_PUBLIC_APP_ENV === undefined
    ? variant
    : readVariantEnv('EXPO_PUBLIC_APP_ENV', process.env.EXPO_PUBLIC_APP_ENV);
const isProduction = variant === 'production';
const legacyIdentityPattern = /(^|[./:_-])onskin($|[./:_-])|onskin/i;
const CONTROL_CHAR_RE = /[\u0000-\u001F\u007F]/;
const MAX_EXTERNAL_URL_LENGTH = 2048;
const PLACEHOLDER_ENV_VALUE =
  /example\.com|your-project|replace-with|__blocked_placeholder__|x{4,}|\.{3,}|pending/i;
const PUBLIC_PRODUCTION_HOSTNAME =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const RESERVED_PRODUCTION_HOSTNAME =
  /(?:^localhost$|\.localhost$|\.local$|\.test$|\.invalid$|\.example$)/;

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

function buildPlugins(plugins, permissionCopy) {
  const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  const sentryOrg = process.env.SENTRY_ORG;
  const sentryProject = process.env.SENTRY_PROJECT;

  return plugins.map((plugin) => {
    const name = pluginName(plugin);

    if (name === 'expo-camera') {
      return [
        name,
        {
          ...pluginOptions(plugin),
          cameraPermission: permissionCopy.cameraPermission,
        },
      ];
    }

    if (name === 'expo-local-authentication') {
      return [
        name,
        {
          ...pluginOptions(plugin),
          faceIDPermission: permissionCopy.faceIDPermission,
        },
      ];
    }

    if (name === '@react-native-google-signin/google-signin' && googleIosUrlScheme) {
      return [name, { iosUrlScheme: googleIosUrlScheme }];
    }

    if (name === '@sentry/react-native' && sentryOrg && sentryProject) {
      return [
        name,
        {
          url: 'https://sentry.io/',
          organization: sentryOrg,
          project: sentryProject,
        },
      ];
    }

    return plugin;
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
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
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
    APP_SLUG: expo.slug,
    APP_SCHEME: expo.scheme,
    APP_IOS_BUNDLE_IDENTIFIER: expo.ios?.bundleIdentifier,
    APP_ANDROID_PACKAGE: expo.android?.package,
    APP_CAMERA_USAGE_DESCRIPTION: permissionCopy.cameraUsageDescription,
    APP_FACE_ID_USAGE_DESCRIPTION: permissionCopy.faceIDUsageDescription,
    APP_CAMERA_PERMISSION: permissionCopy.cameraPermission,
    APP_FACE_ID_PERMISSION: permissionCopy.faceIDPermission,
  };
  const legacyKeys = Object.entries(identityValues)
    .filter(([, value]) => legacyIdentityPattern.test(String(value ?? '')))
    .map(([key]) => key);

  if (process.env.BRAND_LEGAL_CLEARANCE !== 'cleared') {
    throw new Error(
      `Production app identity requires BRAND_LEGAL_CLEARANCE=cleared before native config can resolve.${
        legacyKeys.length > 0 ? ` Current resolved legacy keys: ${legacyKeys.join(', ')}.` : ''
      }`,
    );
  }

  const finalIdentityEnv = {
    'APP_DISPLAY_NAME or EXPO_PUBLIC_APP_DISPLAY_NAME':
      process.env.APP_DISPLAY_NAME ?? process.env.EXPO_PUBLIC_APP_DISPLAY_NAME,
    APP_SLUG: process.env.APP_SLUG,
    'APP_SCHEME or EXPO_PUBLIC_APP_SCHEME':
      process.env.APP_SCHEME ?? process.env.EXPO_PUBLIC_APP_SCHEME,
    APP_IOS_BUNDLE_IDENTIFIER: process.env.APP_IOS_BUNDLE_IDENTIFIER,
    APP_ANDROID_PACKAGE: process.env.APP_ANDROID_PACKAGE,
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
      'Production release requires PHASE3_RELEASE_CLEARANCE=cleared after the Phase 3 legal, privacy, clinical, chemistry, and IP review packet is signed off. Development and staging builds remain available for review.',
    );
  }

  const testWorklist =
    process.env.NODE_ENV === 'test'
      ? globalThis.__ROUTINEKIND_PHASE3_REVIEW_TEST_WORKLIST__
      : undefined;
  assertReleaseReadyReviewEvidence({ worklist: testWorklist });
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
  const permissionCopy = {
    cameraUsageDescription:
      process.env.APP_CAMERA_USAGE_DESCRIPTION ??
      `${appName} uses the camera to scan product barcodes, capture ingredient labels, and take guided progress photos. Camera processing happens on your device; no faceprint is stored.`,
    faceIDUsageDescription:
      process.env.APP_FACE_ID_USAGE_DESCRIPTION ??
      `${appName} uses Face ID to keep your private photo timeline for your eyes only.`,
    cameraPermission:
      process.env.APP_CAMERA_PERMISSION ??
      `Allow ${appName} to scan barcodes, capture ingredient labels, and take guided progress photos.`,
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
  assertProductionIdentity(expo, permissionCopy);
  assertProductionReviewClearance();
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
  expo.plugins = buildPlugins(expo.plugins, permissionCopy);
  expo.extra = {
    ...(expo.extra ?? {}),
    appVariant: variant,
    appEnvironment,
    publicLinkDomain: finalDomain,
    appStoreUrl,
    playStoreUrl,
  };

  return { expo };
};
