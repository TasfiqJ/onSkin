const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withDangerousMod,
} = require('expo/config-plugins');

const FULL_BACKUP_RESOURCE = 'private_data_backup_rules.xml';
const DATA_EXTRACTION_RESOURCE = 'private_data_extraction_rules.xml';
const ANDROID_RESOURCE_DIRECTORY = join('app', 'src', 'main', 'res', 'xml');

const ANDROID_BACKUP_RESOURCE_FILES = Object.freeze([
  Object.freeze({
    source: require.resolve(`./android/${FULL_BACKUP_RESOURCE}`),
    target: join(ANDROID_RESOURCE_DIRECTORY, FULL_BACKUP_RESOURCE),
  }),
  Object.freeze({
    source: require.resolve(`./android/${DATA_EXTRACTION_RESOURCE}`),
    target: join(ANDROID_RESOURCE_DIRECTORY, DATA_EXTRACTION_RESOURCE),
  }),
]);

function applyAndroidBackupManifest(androidManifest) {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  application.$['android:allowBackup'] = 'false';
  application.$['android:fullBackupContent'] = '@xml/private_data_backup_rules';
  application.$['android:dataExtractionRules'] = '@xml/private_data_extraction_rules';
  return androidManifest;
}

function writeFileIfChanged(targetPath, contents) {
  let currentContents;
  try {
    currentContents = readFileSync(targetPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  if (currentContents?.equals(contents)) return;
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, contents);
}

function writeAndroidBackupRules(androidProjectRoot) {
  for (const resource of ANDROID_BACKUP_RESOURCE_FILES) {
    writeFileIfChanged(join(androidProjectRoot, resource.target), readFileSync(resource.source));
  }
}

function withPrivateStorageProtection(config) {
  config = withAndroidManifest(config, (manifestConfig) => {
    manifestConfig.modResults = applyAndroidBackupManifest(manifestConfig.modResults);
    return manifestConfig;
  });

  return withDangerousMod(config, [
    'android',
    async (dangerousConfig) => {
      writeAndroidBackupRules(dangerousConfig.modRequest.platformProjectRoot);
      return dangerousConfig;
    },
  ]);
}

const plugin = createRunOncePlugin(
  withPrivateStorageProtection,
  'with-private-storage-protection',
  '1.0.0',
);

module.exports = plugin;
module.exports.ANDROID_BACKUP_RESOURCE_FILES = ANDROID_BACKUP_RESOURCE_FILES;
module.exports.applyAndroidBackupManifest = applyAndroidBackupManifest;
module.exports.writeAndroidBackupRules = writeAndroidBackupRules;
