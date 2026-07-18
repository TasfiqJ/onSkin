const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withInfoPlist,
} = require('expo/config-plugins');

const APP_VARIANTS = new Set(['development', 'staging', 'production']);
const RELEASE_VARIANTS = new Set(['staging', 'production']);

function readAppVariant(config) {
  const variant = config.extra?.appVariant;
  if (typeof variant === 'string' && APP_VARIANTS.has(variant)) return variant;
  throw new Error(
    `withReleaseTransportSecurity requires extra.appVariant to be development, staging, or production; got ${variant ?? '<unset>'}.`,
  );
}

function applyIosTransportSecurity(infoPlist, variant) {
  if (!RELEASE_VARIANTS.has(variant)) return infoPlist;

  const current =
    infoPlist.NSAppTransportSecurity &&
    typeof infoPlist.NSAppTransportSecurity === 'object' &&
    !Array.isArray(infoPlist.NSAppTransportSecurity)
      ? infoPlist.NSAppTransportSecurity
      : {};
  const hardened = {
    ...current,
    NSAllowsArbitraryLoads: false,
    NSAllowsArbitraryLoadsForMedia: false,
    NSAllowsArbitraryLoadsInWebContent: false,
    NSAllowsLocalNetworking: false,
  };

  delete hardened.NSExceptionDomains;
  infoPlist.NSAppTransportSecurity = hardened;
  return infoPlist;
}

function applyAndroidTransportSecurity(androidManifest, variant) {
  if (!RELEASE_VARIANTS.has(variant)) return androidManifest;

  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  if (application.$['android:networkSecurityConfig']) {
    throw new Error(
      'Release transport security rejects an unreviewed android:networkSecurityConfig resource.',
    );
  }
  application.$['android:usesCleartextTraffic'] = 'false';
  return androidManifest;
}

function withReleaseTransportSecurity(config) {
  const variant = readAppVariant(config);

  config = withInfoPlist(config, (infoPlistConfig) => {
    infoPlistConfig.modResults = applyIosTransportSecurity(infoPlistConfig.modResults, variant);
    return infoPlistConfig;
  });

  return withAndroidManifest(config, (manifestConfig) => {
    manifestConfig.modResults = applyAndroidTransportSecurity(manifestConfig.modResults, variant);
    return manifestConfig;
  });
}

const plugin = createRunOncePlugin(
  withReleaseTransportSecurity,
  'with-release-transport-security',
  '1.0.0',
);

module.exports = plugin;
module.exports.applyAndroidTransportSecurity = applyAndroidTransportSecurity;
module.exports.applyIosTransportSecurity = applyIosTransportSecurity;
module.exports.readAppVariant = readAppVariant;
