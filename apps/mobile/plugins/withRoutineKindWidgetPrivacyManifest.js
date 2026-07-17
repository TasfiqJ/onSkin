const fs = require('node:fs');
const path = require('node:path');

const plist = require('@expo/plist').default;
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const TARGET_NAME = 'ExpoWidgetsTarget';
const PRIVACY_MANIFEST_FILENAME = 'PrivacyInfo.xcprivacy';
const USER_DEFAULTS_API_TYPE = 'NSPrivacyAccessedAPICategoryUserDefaults';
const APP_GROUP_USER_DEFAULTS_REASON = '1C8F.1';
const WIDGET_LIFECYCLE_VERSION_KEY = 'RoutineKindWidgetLifecycleVersion';
const WIDGET_PUBLICATION_ENABLED_KEY = 'RoutineKindWidgetInteractivePublicationEnabled';
const LIVE_ACTIVITY_START_ENABLED_KEY = 'RoutineKindLiveActivityStartEnabled';
const WIDGET_DEEP_LINK_KEY = 'RoutineKindWidgetDeepLink';
const WIDGET_LIFECYCLE_VERSION = 1;
const WIDGET_DEEP_LINK_RE = /^[a-z][a-z0-9+.-]{0,63}:\/\/today$/;

const REQUIRED_WIDGET_PRIVACY_MANIFEST = Object.freeze({
  NSPrivacyAccessedAPITypes: Object.freeze([
    Object.freeze({
      NSPrivacyAccessedAPIType: USER_DEFAULTS_API_TYPE,
      NSPrivacyAccessedAPITypeReasons: Object.freeze([APP_GROUP_USER_DEFAULTS_REASON]),
    }),
  ]),
});

function unquote(value) {
  return String(value ?? '').replace(/^"(.*)"$/, '$1');
}

function assertPrivacyManifestShape(manifest, filePath) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error(`Widget privacy manifest must be a plist dictionary: ${filePath}`);
  }

  for (const key of [
    'NSPrivacyAccessedAPITypes',
    'NSPrivacyCollectedDataTypes',
    'NSPrivacyTrackingDomains',
  ]) {
    if (manifest[key] !== undefined && !Array.isArray(manifest[key])) {
      throw new Error(`Widget privacy manifest ${key} must be an array: ${filePath}`);
    }
  }

  if (manifest.NSPrivacyTracking !== undefined && typeof manifest.NSPrivacyTracking !== 'boolean') {
    throw new Error(`Widget privacy manifest NSPrivacyTracking must be a boolean: ${filePath}`);
  }
}

function mergeWidgetPrivacyManifest(existing = {}) {
  assertPrivacyManifestShape(existing, PRIVACY_MANIFEST_FILENAME);
  const merged = IOSConfig.PrivacyInfo.mergePrivacyInfo(existing, REQUIRED_WIDGET_PRIVACY_MANIFEST);
  const userDefaultsEntry = merged.NSPrivacyAccessedAPITypes.find(
    (entry) => entry.NSPrivacyAccessedAPIType === USER_DEFAULTS_API_TYPE,
  );

  if (
    !userDefaultsEntry ||
    !Array.isArray(userDefaultsEntry.NSPrivacyAccessedAPITypeReasons) ||
    !userDefaultsEntry.NSPrivacyAccessedAPITypeReasons.includes(APP_GROUP_USER_DEFAULTS_REASON)
  ) {
    throw new Error('Widget privacy manifest did not retain the required App Group reason.');
  }

  return merged;
}

function writeWidgetPrivacyManifest(platformProjectRoot, targetName = TARGET_NAME) {
  const targetDirectory = path.join(platformProjectRoot, targetName);
  const infoPlistPath = path.join(targetDirectory, 'Info.plist');
  if (!fs.existsSync(infoPlistPath)) {
    throw new Error(
      `${targetName}/Info.plist is missing. Place this plugin after expo-widgets so its iOS target is generated first.`,
    );
  }

  const manifestPath = path.join(targetDirectory, PRIVACY_MANIFEST_FILENAME);
  let existing = {};
  if (fs.existsSync(manifestPath)) {
    try {
      existing = plist.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (error) {
      throw new Error(
        `Widget privacy manifest is not a valid plist and was preserved: ${manifestPath}`,
        { cause: error },
      );
    }
  }

  const contents = plist.build(mergeWidgetPrivacyManifest(existing));
  if (!fs.existsSync(manifestPath) || fs.readFileSync(manifestPath, 'utf8') !== contents) {
    fs.writeFileSync(manifestPath, contents, 'utf8');
  }
  return manifestPath;
}

function writeWidgetLifecycleConfiguration(
  platformProjectRoot,
  targetName = TARGET_NAME,
  deepLink,
) {
  const infoPlistPath = path.join(platformProjectRoot, targetName, 'Info.plist');
  if (!fs.existsSync(infoPlistPath)) {
    throw new Error(
      `${targetName}/Info.plist is missing. Place this plugin after expo-widgets so its iOS target is generated first.`,
    );
  }
  let infoPlist;
  try {
    infoPlist = plist.parse(fs.readFileSync(infoPlistPath, 'utf8'));
  } catch (error) {
    throw new Error(`Widget Info.plist is invalid and was preserved: ${infoPlistPath}`, {
      cause: error,
    });
  }
  infoPlist[WIDGET_LIFECYCLE_VERSION_KEY] = WIDGET_LIFECYCLE_VERSION;
  infoPlist[WIDGET_PUBLICATION_ENABLED_KEY] = false;
  infoPlist[LIVE_ACTIVITY_START_ENABLED_KEY] = false;
  infoPlist[WIDGET_DEEP_LINK_KEY] = deepLink;
  const contents = plist.build(infoPlist);
  if (fs.readFileSync(infoPlistPath, 'utf8') !== contents) {
    fs.writeFileSync(infoPlistPath, contents, 'utf8');
  }
  return infoPlistPath;
}

function findTargetUuid(project, targetName) {
  const directMatch = project.findTargetKey?.(targetName);
  if (directMatch) return directMatch;

  const targets = project.pbxNativeTargetSection?.() ?? {};
  return Object.entries(targets).find(
    ([uuid, target]) => !uuid.endsWith('_comment') && unquote(target?.name) === targetName,
  )?.[0];
}

function findResourcesBuildPhase(project, targetUuid, targetName = TARGET_NAME) {
  const target = project.pbxNativeTargetSection?.()?.[targetUuid];
  const phases = project.hash?.project?.objects?.PBXResourcesBuildPhase ?? {};
  const matches = (target?.buildPhases ?? [])
    .map((reference) => phases[reference.value])
    .filter(Boolean);

  if (matches.length > 1) {
    throw new Error(`Widget target ${targetName} has more than one Resources build phase.`);
  }
  return matches[0] ?? null;
}

function ensureWidgetPrivacyManifestResource(
  project,
  targetName = TARGET_NAME,
  xcodeUtils = IOSConfig.XcodeUtils,
) {
  const targetUuid = findTargetUuid(project, targetName);
  if (!targetUuid) {
    throw new Error(
      `${targetName} is missing from the Xcode project. Place this plugin after expo-widgets.`,
    );
  }

  const group = project.pbxGroupByName?.(targetName);
  if (!group) {
    throw new Error(`${targetName} PBXGroup is missing from the Xcode project.`);
  }

  let resourcesPhase = findResourcesBuildPhase(project, targetUuid, targetName);
  if (!resourcesPhase) {
    project.addBuildPhase(
      [],
      'PBXResourcesBuildPhase',
      'Resources',
      targetUuid,
      'app_extension',
      '""',
    );
    resourcesPhase = findResourcesBuildPhase(project, targetUuid, targetName);
  }
  if (!resourcesPhase) {
    throw new Error(`Could not create the ${targetName} Resources build phase.`);
  }

  const manifestChildren = (group.children ?? []).filter(
    (child) => unquote(child.comment) === PRIVACY_MANIFEST_FILENAME,
  );
  if (manifestChildren.length > 1) {
    throw new Error(`${targetName} contains duplicate ${PRIVACY_MANIFEST_FILENAME} references.`);
  }

  if (manifestChildren.length === 0) {
    xcodeUtils.addResourceFileToGroup({
      filepath: PRIVACY_MANIFEST_FILENAME,
      groupName: targetName,
      project,
      isBuildFile: true,
      verbose: true,
      targetUuid,
    });
  } else {
    const fileReferenceUuid = manifestChildren[0].value;
    const fileReference = project.pbxFileReferenceSection?.()?.[fileReferenceUuid];
    if (
      !fileReference ||
      path.basename(unquote(fileReference.path)) !== PRIVACY_MANIFEST_FILENAME
    ) {
      throw new Error(`${targetName} has an invalid ${PRIVACY_MANIFEST_FILENAME} reference.`);
    }

    const buildFiles = project.pbxBuildFileSection?.() ?? {};
    const matchingBuildFileUuids = Object.entries(buildFiles).flatMap(([uuid, buildFile]) =>
      !uuid.endsWith('_comment') && buildFile?.fileRef === fileReferenceUuid ? [uuid] : [],
    );
    let buildFileUuid = (resourcesPhase.files ?? []).find((phaseFile) =>
      matchingBuildFileUuids.includes(phaseFile.value),
    )?.value;

    if (!buildFileUuid) {
      buildFileUuid = matchingBuildFileUuids[0];
      if (!buildFileUuid) {
        buildFileUuid = project.generateUuid();
        project.addToPbxBuildFileSection({
          uuid: buildFileUuid,
          fileRef: fileReferenceUuid,
          basename: PRIVACY_MANIFEST_FILENAME,
          group: 'Resources',
        });
      }
      resourcesPhase.files ??= [];
      resourcesPhase.files.push({
        value: buildFileUuid,
        comment: `${PRIVACY_MANIFEST_FILENAME} in Resources`,
      });
    }
  }

  const finalGroup = project.pbxGroupByName(targetName);
  const finalChildren = (finalGroup?.children ?? []).filter(
    (child) => unquote(child.comment) === PRIVACY_MANIFEST_FILENAME,
  );
  const finalPhase = findResourcesBuildPhase(project, targetUuid, targetName);
  const buildFiles = project.pbxBuildFileSection?.() ?? {};
  const finalFileReferenceUuid = finalChildren[0]?.value;
  const isAttachedToTarget = (finalPhase?.files ?? []).some(
    (phaseFile) => buildFiles[phaseFile.value]?.fileRef === finalFileReferenceUuid,
  );
  const manifestResourceAttachments = Object.values(
    project.hash?.project?.objects?.PBXResourcesBuildPhase ?? {},
  ).flatMap((phase) =>
    typeof phase === 'object' && phase !== null
      ? (phase.files ?? []).filter(
          (phaseFile) => buildFiles[phaseFile.value]?.fileRef === finalFileReferenceUuid,
        )
      : [],
  );

  if (
    finalChildren.length !== 1 ||
    !isAttachedToTarget ||
    manifestResourceAttachments.length !== 1
  ) {
    throw new Error(
      `${PRIVACY_MANIFEST_FILENAME} was not attached exclusively to the ${targetName} Resources phase.`,
    );
  }

  return project;
}

const withRoutineKindWidgetPrivacyManifest = (config, props = {}) => {
  const targetName = props.targetName ?? TARGET_NAME;
  const deepLink = props.deepLink;
  if (typeof deepLink !== 'string' || !WIDGET_DEEP_LINK_RE.test(deepLink)) {
    throw new Error('The widget lifecycle requires one exact signed deepLink ending in ://today.');
  }

  config.ios ??= {};
  config.ios.infoPlist ??= {};
  config.ios.infoPlist[WIDGET_LIFECYCLE_VERSION_KEY] = WIDGET_LIFECYCLE_VERSION;
  config.ios.infoPlist[WIDGET_PUBLICATION_ENABLED_KEY] = false;
  config.ios.infoPlist[LIVE_ACTIVITY_START_ENABLED_KEY] = false;
  config.ios.infoPlist[WIDGET_DEEP_LINK_KEY] = deepLink;

  config = withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      writeWidgetPrivacyManifest(modConfig.modRequest.platformProjectRoot, targetName);
      writeWidgetLifecycleConfiguration(
        modConfig.modRequest.platformProjectRoot,
        targetName,
        deepLink,
      );
      return modConfig;
    },
  ]);

  return withXcodeProject(config, (modConfig) => {
    ensureWidgetPrivacyManifestResource(modConfig.modResults, targetName);
    return modConfig;
  });
};

module.exports = withRoutineKindWidgetPrivacyManifest;
module.exports.APP_GROUP_USER_DEFAULTS_REASON = APP_GROUP_USER_DEFAULTS_REASON;
module.exports.LIVE_ACTIVITY_START_ENABLED_KEY = LIVE_ACTIVITY_START_ENABLED_KEY;
module.exports.PRIVACY_MANIFEST_FILENAME = PRIVACY_MANIFEST_FILENAME;
module.exports.REQUIRED_WIDGET_PRIVACY_MANIFEST = REQUIRED_WIDGET_PRIVACY_MANIFEST;
module.exports.TARGET_NAME = TARGET_NAME;
module.exports.USER_DEFAULTS_API_TYPE = USER_DEFAULTS_API_TYPE;
module.exports.WIDGET_LIFECYCLE_VERSION = WIDGET_LIFECYCLE_VERSION;
module.exports.WIDGET_LIFECYCLE_VERSION_KEY = WIDGET_LIFECYCLE_VERSION_KEY;
module.exports.WIDGET_PUBLICATION_ENABLED_KEY = WIDGET_PUBLICATION_ENABLED_KEY;
module.exports.WIDGET_DEEP_LINK_KEY = WIDGET_DEEP_LINK_KEY;
module.exports.ensureWidgetPrivacyManifestResource = ensureWidgetPrivacyManifestResource;
module.exports.mergeWidgetPrivacyManifest = mergeWidgetPrivacyManifest;
module.exports.writeWidgetLifecycleConfiguration = writeWidgetLifecycleConfiguration;
module.exports.writeWidgetPrivacyManifest = writeWidgetPrivacyManifest;
