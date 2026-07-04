const base = require('./app.base.json');

const variant = process.env.APP_VARIANT ?? 'production';
const isProduction = variant === 'production';

const variantSuffix = {
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
  if (isProduction || !variantSuffix) return baseName;
  return `${baseName} ${variantSuffix}`;
}

function pluginName(plugin) {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

function buildPlugins(plugins) {
  const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  const sentryOrg = process.env.SENTRY_ORG;
  const sentryProject = process.env.SENTRY_PROJECT;

  return plugins.map((plugin) => {
    const name = pluginName(plugin);

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
  const domain = (value ?? '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
  if (!domain || domain.includes('example.com') || domain === 'localhost') return '';
  return domain;
}

function productionUrl(value) {
  const url = (value ?? '').trim();
  if (!url || /example\.com/i.test(url)) return '';
  return url;
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
  expo.slug = process.env.APP_SLUG ?? expo.slug;
  expo.scheme =
    process.env.APP_SCHEME ?? (isProduction ? baseScheme : `${baseScheme}-${variant}`);
  expo.ios.bundleIdentifier =
    process.env.APP_IOS_BUNDLE_IDENTIFIER ?? withVariant(baseIosBundle, variant);
  expo.android.package =
    process.env.APP_ANDROID_PACKAGE ?? withVariant(baseAndroidPackage, variant);
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
  expo.plugins = buildPlugins(expo.plugins);
  expo.extra = {
    ...(expo.extra ?? {}),
    appVariant: variant,
    appEnvironment: process.env.EXPO_PUBLIC_APP_ENV ?? variant,
    publicLinkDomain: finalDomain,
    appStoreUrl,
    playStoreUrl,
  };

  return { expo };
};
