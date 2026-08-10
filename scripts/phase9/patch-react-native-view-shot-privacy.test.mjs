import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  VIEW_SHOT_LOCK_INTEGRITY,
  VIEW_SHOT_LOCK_RESOLVED,
  VIEW_SHOT_ORIGINAL_MANIFEST_SHA256,
  VIEW_SHOT_PACKAGE_NAME,
  VIEW_SHOT_PACKAGE_VERSION,
  VIEW_SHOT_PATCHED_MANIFEST_SHA256,
  ViewShotPrivacyPatchError,
  patchReactNativeViewShotPrivacy,
} from './patch-react-native-view-shot-privacy.mjs';

const SCRIPT_PATH = fileURLToPath(
  new URL('./patch-react-native-view-shot-privacy.mjs', import.meta.url),
);
const MANIFEST_RELATIVE_PATH = 'node_modules/react-native-view-shot/ios/PrivacyInfo.xcprivacy';
const INVALID_FRAGMENT = '\t<key>NSPrivacyAccessedAPITypes</key>\n\t<array/>\n';
const ORIGINAL_MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>NSPrivacyAccessedAPITypes</key>
\t<array/>
\t<key>NSPrivacyCollectedDataTypes</key>
\t<array/>
\t<key>NSPrivacyTracking</key>
\t<false/>
\t<key>NSPrivacyTrackingDomains</key>
\t<array/>
</dict>
</plist>
`;
const PATCHED_MANIFEST = ORIGINAL_MANIFEST.replace(INVALID_FRAGMENT, '');

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function safeCleanup(root) {
  const absolute = resolve(root);
  const temporaryRoot = resolve(tmpdir());
  const rel = relative(temporaryRoot, absolute);
  if (
    rel.startsWith('..') ||
    rel.includes(sep) ||
    !rel.startsWith('layerwell-view-shot-patch-')
  ) {
    throw new Error('Refusing to clean an unexpected test fixture path.');
  }
  rmSync(absolute, { force: true, recursive: true });
}

function createFixture(t, manifest = ORIGINAL_MANIFEST) {
  const root = mkdtempSync(join(tmpdir(), 'layerwell-view-shot-patch-'));
  t.after(() => safeCleanup(root));
  mkdirSync(join(root, 'apps/mobile'), { recursive: true });
  mkdirSync(join(root, 'node_modules/react-native-view-shot/ios'), { recursive: true });

  writeJson(join(root, 'apps/mobile/package.json'), {
    dependencies: { [VIEW_SHOT_PACKAGE_NAME]: VIEW_SHOT_PACKAGE_VERSION },
  });
  writeJson(join(root, 'package-lock.json'), {
    lockfileVersion: 3,
    packages: {
      'apps/mobile': {
        dependencies: { [VIEW_SHOT_PACKAGE_NAME]: VIEW_SHOT_PACKAGE_VERSION },
      },
      'node_modules/react-native-view-shot': {
        version: VIEW_SHOT_PACKAGE_VERSION,
        resolved: VIEW_SHOT_LOCK_RESOLVED,
        integrity: VIEW_SHOT_LOCK_INTEGRITY,
      },
    },
  });
  writeJson(join(root, 'node_modules/react-native-view-shot/package.json'), {
    name: VIEW_SHOT_PACKAGE_NAME,
    version: VIEW_SHOT_PACKAGE_VERSION,
  });
  writeFileSync(join(root, MANIFEST_RELATIVE_PATH), manifest, 'utf8');
  return root;
}

function mutateJson(root, relativePath, mutate) {
  const path = join(root, relativePath);
  const value = JSON.parse(readFileSync(path, 'utf8'));
  mutate(value);
  writeJson(path, value);
}

function expectFailure(root, code, options = {}) {
  assert.throws(
    () => patchReactNativeViewShotPrivacy({ root, ...options }),
    (error) => {
      assert.ok(error instanceof ViewShotPrivacyPatchError);
      assert.equal(error.code, code);
      return true;
    },
  );
}

test('pins the reviewed source and minimal target bytes', () => {
  assert.equal(Buffer.byteLength(ORIGINAL_MANIFEST), 373);
  assert.equal(hash(Buffer.from(ORIGINAL_MANIFEST)), VIEW_SHOT_ORIGINAL_MANIFEST_SHA256);
  assert.equal(Buffer.byteLength(PATCHED_MANIFEST), 325);
  assert.equal(hash(Buffer.from(PATCHED_MANIFEST)), VIEW_SHOT_PATCHED_MANIFEST_SHA256);
  assert.equal(PATCHED_MANIFEST.includes('NSPrivacyAccessedAPITypes'), false);
  for (const retained of [
    'NSPrivacyCollectedDataTypes',
    'NSPrivacyTracking',
    'NSPrivacyTrackingDomains',
  ]) {
    assert.equal(PATCHED_MANIFEST.includes(retained), true);
  }
});

test('atomically patches only the reviewed original bytes', (t) => {
  const root = createFixture(t);
  const path = join(root, MANIFEST_RELATIVE_PATH);
  const originalMode = statSync(path).mode & 0o777;
  const beforeEntries = readdirSync(dirname(path));

  assert.deepEqual(patchReactNativeViewShotPrivacy({ root }), {
    manifestPath: MANIFEST_RELATIVE_PATH,
    sha256: VIEW_SHOT_PATCHED_MANIFEST_SHA256,
    status: 'patched',
  });
  assert.equal(readFileSync(path, 'utf8'), PATCHED_MANIFEST);
  assert.equal(statSync(path).mode & 0o777, originalMode);
  assert.deepEqual(readdirSync(dirname(path)), beforeEntries);
});

test('is idempotent without rewriting the reviewed target', (t) => {
  const root = createFixture(t);
  const path = join(root, MANIFEST_RELATIVE_PATH);
  patchReactNativeViewShotPrivacy({ root });
  const before = statSync(path);
  const bytes = readFileSync(path);

  assert.deepEqual(patchReactNativeViewShotPrivacy({ root }), {
    manifestPath: MANIFEST_RELATIVE_PATH,
    sha256: VIEW_SHOT_PATCHED_MANIFEST_SHA256,
    status: 'already-patched',
  });
  assert.deepEqual(readFileSync(path), bytes);
  assert.equal(statSync(path).mtimeMs, before.mtimeMs);
});

test('--check accepts only the patched state and never writes', (t) => {
  const originalRoot = createFixture(t);
  const originalPath = join(originalRoot, MANIFEST_RELATIVE_PATH);
  const originalBytes = readFileSync(originalPath);
  const originalStat = statSync(originalPath);
  expectFailure(originalRoot, 'MANIFEST_UNPATCHED', { check: true });
  assert.deepEqual(readFileSync(originalPath), originalBytes);
  assert.equal(statSync(originalPath).mtimeMs, originalStat.mtimeMs);

  const patchedRoot = createFixture(t, PATCHED_MANIFEST);
  const patchedPath = join(patchedRoot, MANIFEST_RELATIVE_PATH);
  const patchedStat = statSync(patchedPath);
  assert.equal(
    patchReactNativeViewShotPrivacy({ root: patchedRoot, check: true }).status,
    'checked',
  );
  assert.equal(statSync(patchedPath).mtimeMs, patchedStat.mtimeMs);
});

test('rejects every unreviewed manifest byte variant without mutation', async (t) => {
  const variants = [
    ['one-byte drift', `${ORIGINAL_MANIFEST} `],
    ['UTF-8 BOM', `\ufeff${ORIGINAL_MANIFEST}`],
    ['CRLF normalization', ORIGINAL_MANIFEST.replaceAll('\n', '\r\n')],
    [
      'semantically plausible but unreviewed',
      PATCHED_MANIFEST.replace('\t<key>NSPrivacyTrackingDomains</key>\n\t<array/>\n', ''),
    ],
    ['malformed XML', '<plist><dict>'],
  ];
  for (const [name, manifest] of variants) {
    await t.test(name, (child) => {
      const root = createFixture(child, manifest);
      const path = join(root, MANIFEST_RELATIVE_PATH);
      const bytes = readFileSync(path);
      expectFailure(root, 'MANIFEST_HASH');
      assert.deepEqual(readFileSync(path), bytes);
      assert.equal(readdirSync(dirname(path)).length, 1);
    });
  }
});

test('rejects all reviewed lock provenance drift', async (t) => {
  const cases = [
    ['lockfile version', (lock) => (lock.lockfileVersion = 2), 'LOCK_SHAPE'],
    [
      'workspace spec',
      (lock) => (lock.packages['apps/mobile'].dependencies[VIEW_SHOT_PACKAGE_NAME] = '^5.1.0'),
      'LOCK_WORKSPACE_DEPENDENCY',
    ],
    [
      'entry version',
      (lock) => (lock.packages['node_modules/react-native-view-shot'].version = '5.1.1'),
      'LOCK_VERSION',
    ],
    [
      'resolved artifact',
      (lock) => (lock.packages['node_modules/react-native-view-shot'].resolved += '?drift'),
      'LOCK_RESOLVED',
    ],
    [
      'integrity',
      (lock) => (lock.packages['node_modules/react-native-view-shot'].integrity += 'A'),
      'LOCK_INTEGRITY',
    ],
    [
      'placement flag',
      (lock) => (lock.packages['node_modules/react-native-view-shot'].link = true),
      'LOCK_FLAGS',
    ],
    [
      'nested duplicate',
      (lock) =>
        (lock.packages['node_modules/other/node_modules/react-native-view-shot'] = {
          ...lock.packages['node_modules/react-native-view-shot'],
        }),
      'LOCK_ENTRY_PATH',
    ],
    [
      'moved entry',
      (lock) => {
        lock.packages['node_modules/other/node_modules/react-native-view-shot'] =
          lock.packages['node_modules/react-native-view-shot'];
        delete lock.packages['node_modules/react-native-view-shot'];
      },
      'LOCK_ENTRY_PATH',
    ],
  ];
  for (const [name, mutate, code] of cases) {
    await t.test(name, (child) => {
      const root = createFixture(child);
      mutateJson(root, 'package-lock.json', mutate);
      expectFailure(root, code);
      assert.equal(readFileSync(join(root, MANIFEST_RELATIVE_PATH), 'utf8'), ORIGINAL_MANIFEST);
    });
  }
});

test('rejects package declaration and installed identity drift', async (t) => {
  const cases = [
    [
      'mobile dependency',
      'apps/mobile/package.json',
      (value) => (value.dependencies[VIEW_SHOT_PACKAGE_NAME] = '^5.1.0'),
      'MOBILE_DEPENDENCY',
    ],
    [
      'installed name',
      'node_modules/react-native-view-shot/package.json',
      (value) => (value.name = 'react-native-view-shot-fork'),
      'PACKAGE_NAME',
    ],
    [
      'installed version',
      'node_modules/react-native-view-shot/package.json',
      (value) => (value.version = '5.1.1'),
      'PACKAGE_VERSION',
    ],
  ];
  for (const [name, path, mutate, code] of cases) {
    await t.test(name, (child) => {
      const root = createFixture(child);
      mutateJson(root, path, mutate);
      expectFailure(root, code);
    });
  }
});

test('rejects malformed or non-object provenance JSON', (t) => {
  const malformed = createFixture(t);
  writeFileSync(join(malformed, 'package-lock.json'), '{', 'utf8');
  expectFailure(malformed, 'JSON_INVALID');

  const nonObject = createFixture(t);
  writeFileSync(join(nonObject, 'apps/mobile/package.json'), '[]\n', 'utf8');
  expectFailure(nonObject, 'JSON_SHAPE');
});

test('rejects missing, moved, or wrong-type manifest paths', (t) => {
  const missing = createFixture(t);
  rmSync(join(missing, MANIFEST_RELATIVE_PATH));
  expectFailure(missing, 'PATH_MISSING');

  const moved = createFixture(t);
  renameSync(
    join(moved, 'node_modules/react-native-view-shot'),
    join(moved, 'node_modules/react-native-view-shot-drifted'),
  );
  expectFailure(moved, 'PATH_MISSING');

  const directory = createFixture(t);
  rmSync(join(directory, MANIFEST_RELATIVE_PATH));
  mkdirSync(join(directory, MANIFEST_RELATIVE_PATH));
  expectFailure(directory, 'PATH_TYPE');
});

test('rejects a linked dependency directory before following it', (t) => {
  const root = createFixture(t);
  const packagePath = join(root, 'node_modules/react-native-view-shot');
  const realPackagePath = join(root, 'node_modules/react-native-view-shot-real');
  renameSync(packagePath, realPackagePath);
  symlinkSync(realPackagePath, packagePath, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(lstatSync(packagePath).isSymbolicLink(), true);
  expectFailure(root, 'PATH_SYMLINK');
  assert.equal(
    readFileSync(join(realPackagePath, 'ios/PrivacyInfo.xcprivacy'), 'utf8'),
    ORIGINAL_MANIFEST,
  );
});

test('rejects a linked manifest before reading or replacing its target', (t) => {
  const root = createFixture(t);
  const manifestPath = join(root, MANIFEST_RELATIVE_PATH);
  const realManifestPath = `${manifestPath}.real`;
  renameSync(manifestPath, realManifestPath);
  try {
    symlinkSync(realManifestPath, manifestPath, 'file');
  } catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) {
      t.skip('File symlink creation is unavailable on this Windows host.');
      return;
    }
    throw error;
  }
  expectFailure(root, 'PATH_SYMLINK');
  assert.equal(readFileSync(realManifestPath, 'utf8'), ORIGINAL_MANIFEST);
});

test('rejects non-boolean check options', (t) => {
  const root = createFixture(t, PATCHED_MANIFEST);
  expectFailure(root, 'OPTION_CHECK', { check: 'true' });
});

test('CLI rejects unknown and duplicate flags before inspecting dependencies', () => {
  for (const args of [['--force'], ['--check', '--check']]) {
    const result = spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
      cwd: tmpdir(),
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /failed \[CLI_ARGUMENT\]/);
    assert.equal(result.stdout, '');
  }
});

test('CLI root is anchored to its script location, not the caller cwd', (t) => {
  const root = createFixture(t, PATCHED_MANIFEST);
  const copiedScript = join(root, 'scripts/phase9/patch-react-native-view-shot-privacy.mjs');
  mkdirSync(dirname(copiedScript), { recursive: true });
  copyFileSync(SCRIPT_PATH, copiedScript);

  const result = spawnSync(process.execPath, [copiedScript, '--check'], {
    cwd: tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`checked \\(${VIEW_SHOT_PATCHED_MANIFEST_SHA256}\\)`));
  assert.equal(result.stderr, '');
});
