import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const plist = require('@expo/plist').default;
const {
  APP_GROUP_USER_DEFAULTS_REASON,
  PRIVACY_MANIFEST_FILENAME,
  TARGET_NAME,
  USER_DEFAULTS_API_TYPE,
  ensureWidgetPrivacyManifestResource,
  mergeWidgetPrivacyManifest,
  writeWidgetPrivacyManifest,
} = require('../../apps/mobile/plugins/withRoutineKindWidgetPrivacyManifest.js');

const root = path.resolve(import.meta.dirname, '..', '..');

function requiredReasonEntry(manifest) {
  return manifest.NSPrivacyAccessedAPITypes.find(
    (entry) => entry.NSPrivacyAccessedAPIType === USER_DEFAULTS_API_TYPE,
  );
}

function fakeXcodeProject({ detachedManifest = false } = {}) {
  let sequence = 0;
  const targetUuid = 'TARGET';
  const group = {
    isa: 'PBXGroup',
    children: [],
    name: TARGET_NAME,
    path: TARGET_NAME,
  };
  const objects = {
    PBXNativeTarget: {
      [targetUuid]: { name: TARGET_NAME, buildPhases: [] },
    },
    PBXGroup: { GROUP: group },
    PBXResourcesBuildPhase: {},
    PBXFileReference: {},
    PBXBuildFile: {},
  };

  if (detachedManifest) {
    group.children.push({ value: 'FILE_REF', comment: PRIVACY_MANIFEST_FILENAME });
    objects.PBXFileReference.FILE_REF = {
      path: `"${PRIVACY_MANIFEST_FILENAME}"`,
    };
    objects.PBXBuildFile.BUILD_FILE = {
      fileRef: 'FILE_REF',
      fileRef_comment: PRIVACY_MANIFEST_FILENAME,
    };
  }

  const project = {
    hash: { project: { objects } },
    findTargetKey(name) {
      return name === TARGET_NAME ? targetUuid : null;
    },
    pbxNativeTargetSection() {
      return objects.PBXNativeTarget;
    },
    pbxGroupByName(name) {
      return name === TARGET_NAME ? group : null;
    },
    pbxFileReferenceSection() {
      return objects.PBXFileReference;
    },
    pbxBuildFileSection() {
      return objects.PBXBuildFile;
    },
    generateUuid() {
      sequence += 1;
      return `GENERATED_${sequence}`;
    },
    addBuildPhase(files, type, comment, target) {
      assert.deepEqual(files, []);
      assert.equal(type, 'PBXResourcesBuildPhase');
      assert.equal(target, targetUuid);
      const uuid = this.generateUuid();
      objects.PBXResourcesBuildPhase[uuid] = {
        isa: type,
        files: [],
      };
      objects.PBXNativeTarget[target].buildPhases.push({ value: uuid, comment });
      return { uuid, buildPhase: objects.PBXResourcesBuildPhase[uuid] };
    },
    addToPbxBuildFileSection(file) {
      objects.PBXBuildFile[file.uuid] = {
        isa: 'PBXBuildFile',
        fileRef: file.fileRef,
        fileRef_comment: file.basename,
      };
    },
  };

  let addResourceCalls = 0;
  const xcodeUtils = {
    addResourceFileToGroup({ filepath, groupName, targetUuid: requestedTarget }) {
      addResourceCalls += 1;
      assert.equal(filepath, PRIVACY_MANIFEST_FILENAME);
      assert.equal(groupName, TARGET_NAME);
      assert.equal(requestedTarget, targetUuid);
      const fileReferenceUuid = project.generateUuid();
      const buildFileUuid = project.generateUuid();
      group.children.push({ value: fileReferenceUuid, comment: PRIVACY_MANIFEST_FILENAME });
      objects.PBXFileReference[fileReferenceUuid] = {
        path: `"${PRIVACY_MANIFEST_FILENAME}"`,
      };
      objects.PBXBuildFile[buildFileUuid] = {
        fileRef: fileReferenceUuid,
        fileRef_comment: PRIVACY_MANIFEST_FILENAME,
      };
      const phaseUuid = objects.PBXNativeTarget[targetUuid].buildPhases[0].value;
      objects.PBXResourcesBuildPhase[phaseUuid].files.push({
        value: buildFileUuid,
        comment: `${PRIVACY_MANIFEST_FILENAME} in Resources`,
      });
    },
  };

  return { project, xcodeUtils, objects, group, getAddResourceCalls: () => addResourceCalls };
}

test('main Expo config declares the App Group UserDefaults reason and orders the companion plugin', () => {
  const app = JSON.parse(readFileSync(path.join(root, 'apps/mobile/app.base.json'), 'utf8')).expo;
  const entry = requiredReasonEntry(app.ios.privacyManifests);
  assert.deepEqual(entry, {
    NSPrivacyAccessedAPIType: USER_DEFAULTS_API_TYPE,
    NSPrivacyAccessedAPITypeReasons: [APP_GROUP_USER_DEFAULTS_REASON],
  });

  const pluginNames = app.plugins.map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));
  const widgetsIndex = pluginNames.indexOf('expo-widgets');
  const privacyIndex = pluginNames.indexOf('./plugins/withRoutineKindWidgetPrivacyManifest');
  assert.ok(widgetsIndex >= 0);
  assert.equal(privacyIndex, widgetsIndex + 1);
});

test('widget manifest merge is idempotent and preserves unrelated declarations', () => {
  const existing = {
    NSPrivacyAccessedAPITypes: [
      {
        NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
        NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
      },
    ],
    NSPrivacyCollectedDataTypes: [],
    NSPrivacyTracking: false,
    NSPrivacyTrackingDomains: [],
  };
  const once = mergeWidgetPrivacyManifest(existing);
  const twice = mergeWidgetPrivacyManifest(once);

  assert.deepEqual(twice, once);
  assert.deepEqual(requiredReasonEntry(once).NSPrivacyAccessedAPITypeReasons, [
    APP_GROUP_USER_DEFAULTS_REASON,
  ]);
  assert.ok(
    once.NSPrivacyAccessedAPITypes.some(
      (entry) => entry.NSPrivacyAccessedAPIType === 'NSPrivacyAccessedAPICategorySystemBootTime',
    ),
  );
});

test('writes a stable target manifest after expo-widgets and preserves invalid source bytes', () => {
  const platformRoot = mkdtempSync(path.join(tmpdir(), 'routinekind-widget-privacy-'));
  const targetDirectory = path.join(platformRoot, TARGET_NAME);
  const infoPlistPath = path.join(targetDirectory, 'Info.plist');
  const manifestPath = path.join(targetDirectory, PRIVACY_MANIFEST_FILENAME);
  try {
    mkdirSync(targetDirectory, { recursive: true });
    writeFileSync(infoPlistPath, plist.build({ NSExtension: {} }));

    assert.equal(writeWidgetPrivacyManifest(platformRoot), manifestPath);
    const first = readFileSync(manifestPath, 'utf8');
    assert.deepEqual(requiredReasonEntry(plist.parse(first)).NSPrivacyAccessedAPITypeReasons, [
      APP_GROUP_USER_DEFAULTS_REASON,
    ]);
    writeWidgetPrivacyManifest(platformRoot);
    assert.equal(readFileSync(manifestPath, 'utf8'), first);

    const corrupt = '<not-a-plist>';
    writeFileSync(manifestPath, corrupt);
    assert.throws(
      () => writeWidgetPrivacyManifest(platformRoot),
      /not a valid plist and was preserved/,
    );
    assert.equal(readFileSync(manifestPath, 'utf8'), corrupt);
  } finally {
    rmSync(platformRoot, { recursive: true, force: true });
  }
});

test('creates and idempotently attaches the target manifest to extension resources only', () => {
  const fixture = fakeXcodeProject();
  ensureWidgetPrivacyManifestResource(fixture.project, TARGET_NAME, fixture.xcodeUtils);
  const once = JSON.stringify(fixture.objects);
  ensureWidgetPrivacyManifestResource(fixture.project, TARGET_NAME, fixture.xcodeUtils);

  assert.equal(fixture.getAddResourceCalls(), 1);
  assert.equal(JSON.stringify(fixture.objects), once);
  assert.equal(fixture.group.children.length, 1);
  const phases = Object.values(fixture.objects.PBXResourcesBuildPhase);
  assert.equal(phases.length, 1);
  assert.equal(phases[0].files.length, 1);
});

test('repairs a detached existing manifest reference without duplicating it', () => {
  const fixture = fakeXcodeProject({ detachedManifest: true });
  ensureWidgetPrivacyManifestResource(fixture.project, TARGET_NAME, fixture.xcodeUtils);

  assert.equal(fixture.getAddResourceCalls(), 0);
  assert.equal(fixture.group.children.length, 1);
  const phase = Object.values(fixture.objects.PBXResourcesBuildPhase)[0];
  assert.deepEqual(phase.files, [
    {
      value: 'BUILD_FILE',
      comment: `${PRIVACY_MANIFEST_FILENAME} in Resources`,
    },
  ]);
});
