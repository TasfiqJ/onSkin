import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  EXPO_WIDGETS_LOCK_INTEGRITY,
  EXPO_WIDGETS_LOCK_RESOLVED,
  EXPO_WIDGETS_PACKAGE_NAME,
  EXPO_WIDGETS_PACKAGE_VERSION,
  EXPO_WIDGETS_PATCH_TARGETS,
  ExpoWidgetsLifecyclePatchError,
  classifyExpoWidgetsPatchTarget,
  patchExpoWidgetsLifecycle,
} from './patch-expo-widgets-lifecycle.mjs';

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PAYLOAD_ROOT = join(REPOSITORY_ROOT, 'scripts/phase5/expo-widgets-57.0.9');

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function cleanup(root) {
  const absolute = resolve(root);
  const temporaryRoot = resolve(tmpdir());
  const rel = relative(temporaryRoot, absolute);
  if (
    rel.startsWith('..') ||
    rel.includes(sep) ||
    !rel.startsWith('layerwell-expo-widgets-patch-')
  ) {
    throw new Error('Refusing to remove an unexpected fixture path.');
  }
  rmSync(absolute, { recursive: true, force: true });
}

function createFixture(
  t,
  { omitNewTarget = false, installDirectory = 'node_modules/expo-widgets' } = {},
) {
  const root = mkdtempSync(join(tmpdir(), 'layerwell-expo-widgets-patch-'));
  t.after(() => cleanup(root));
  writeJson(join(root, 'apps/mobile/package.json'), {
    dependencies: { [EXPO_WIDGETS_PACKAGE_NAME]: EXPO_WIDGETS_PACKAGE_VERSION },
  });
  writeJson(join(root, 'package-lock.json'), {
    lockfileVersion: 3,
    packages: {
      'apps/mobile': {
        dependencies: { [EXPO_WIDGETS_PACKAGE_NAME]: EXPO_WIDGETS_PACKAGE_VERSION },
      },
      [installDirectory]: {
        version: EXPO_WIDGETS_PACKAGE_VERSION,
        resolved: EXPO_WIDGETS_LOCK_RESOLVED,
        integrity: EXPO_WIDGETS_LOCK_INTEGRITY,
      },
    },
  });
  writeJson(join(root, installDirectory, 'package.json'), {
    name: EXPO_WIDGETS_PACKAGE_NAME,
    version: EXPO_WIDGETS_PACKAGE_VERSION,
  });

  for (const descriptor of EXPO_WIDGETS_PATCH_TARGETS) {
    const payloadSource = join(PAYLOAD_ROOT, descriptor.payload);
    const fixturePayload = join(root, 'scripts/phase5/expo-widgets-57.0.9', descriptor.payload);
    mkdirSync(dirname(fixturePayload), { recursive: true });
    copyFileSync(payloadSource, fixturePayload);

    if (omitNewTarget && descriptor.original === null) continue;
    const target = join(
      root,
      installDirectory,
      ...descriptor.target.slice('node_modules/expo-widgets/'.length).split('/'),
    );
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(payloadSource, target);
  }
  return root;
}

function expectFailure(root, code, options = {}) {
  assert.throws(
    () => patchExpoWidgetsLifecycle({ root, ...options }),
    (error) => {
      assert.ok(error instanceof ExpoWidgetsLifecyclePatchError);
      assert.equal(error.code, code);
      return true;
    },
  );
}

test('pins every reviewed original and patched source hash', () => {
  assert.equal(EXPO_WIDGETS_PATCH_TARGETS.length, 11);
  assert.equal(new Set(EXPO_WIDGETS_PATCH_TARGETS.map(({ target }) => target)).size, 11);
  assert.equal(new Set(EXPO_WIDGETS_PATCH_TARGETS.map(({ payload }) => payload)).size, 11);
  assert.equal(EXPO_WIDGETS_PATCH_TARGETS.filter(({ original }) => original === null).length, 1);
  for (const descriptor of EXPO_WIDGETS_PATCH_TARGETS) {
    const payload = readFileSync(join(PAYLOAD_ROOT, descriptor.payload));
    assert.equal(hash(payload), descriptor.patched, descriptor.payload);
    assert.match(descriptor.patched, /^[0-9a-f]{64}$/);
    if (descriptor.original !== null) assert.match(descriptor.original, /^[0-9a-f]{64}$/);
    for (const priorPatched of descriptor.priorPatched ?? []) {
      assert.match(priorPatched, /^[0-9a-f]{64}$/);
      assert.notEqual(priorPatched, descriptor.patched);
      assert.notEqual(priorPatched, descriptor.original);
    }
  }
});

test('durably stages files and synchronizes each POSIX rename for crash recovery', () => {
  const installer = readFileSync(
    join(REPOSITORY_ROOT, 'scripts/phase5/patch-expo-widgets-lifecycle.mjs'),
    'utf8',
  );
  assert.match(installer, /writeFileSync\(descriptor, bytes\);\s+fsyncSync\(descriptor\)/);
  assert.match(installer, /function syncParentDirectory\(path\)/);
  assert.match(installer, /descriptor = openSync\(path\.parent, constants\.O_RDONLY\)/);
  assert.match(
    installer,
    /renameSync\(entry\.temporary, entry\.item\.target\.absolute\);\s+committed\.push\(entry\.item\);\s+syncParentDirectory\(entry\.item\.target\)/,
  );
  assert.doesNotMatch(installer, /atomically install the expo-widgets patch set/);
});

test('check mode accepts a complete reviewed patch without writing', (t) => {
  const root = createFixture(t);
  const target = join(root, ...EXPO_WIDGETS_PATCH_TARGETS[0].target.split('/'));
  const before = readFileSync(target);
  assert.deepEqual(patchExpoWidgetsLifecycle({ root, check: true }), {
    status: 'checked',
    files: 11,
  });
  assert.deepEqual(readFileSync(target), before);
});

test('accepts one exact workspace-nested reviewed installation', (t) => {
  const installDirectory = 'apps/mobile/node_modules/expo-widgets';
  const root = createFixture(t, { installDirectory });
  const descriptor = EXPO_WIDGETS_PATCH_TARGETS[0];
  const target = join(
    root,
    installDirectory,
    ...descriptor.target.slice('node_modules/expo-widgets/'.length).split('/'),
  );
  assert.deepEqual(patchExpoWidgetsLifecycle({ root, check: true }), {
    status: 'checked',
    files: 11,
  });
  assert.equal(hash(readFileSync(target)), descriptor.patched);
});

test('idempotently completes a reviewed partial install by adding the missing native store', (t) => {
  const root = createFixture(t, { omitNewTarget: true });
  expectFailure(root, 'PATCH_UNAPPLIED', { check: true });
  assert.deepEqual(patchExpoWidgetsLifecycle({ root }), {
    status: 'patched',
    files: 11,
    changed: 1,
  });
  assert.equal(patchExpoWidgetsLifecycle({ root }).status, 'already-patched');
  assert.equal(patchExpoWidgetsLifecycle({ root, check: true }).status, 'checked');

  const newDescriptor = EXPO_WIDGETS_PATCH_TARGETS.find(({ original }) => original === null);
  const target = join(root, ...newDescriptor.target.split('/'));
  assert.equal(hash(readFileSync(target)), newDescriptor.patched);
  assert.equal(
    readdirSync(dirname(target)).some((name) => name.includes('.layerwell-')),
    false,
  );
});

test('classifies only explicitly reviewed prior patch generations as upgradeable', () => {
  let upgradeable = 0;
  for (const descriptor of EXPO_WIDGETS_PATCH_TARGETS) {
    for (const priorPatched of descriptor.priorPatched ?? []) {
      assert.equal(classifyExpoWidgetsPatchTarget(descriptor, priorPatched), 'original');
      upgradeable += 1;
    }
    assert.equal(classifyExpoWidgetsPatchTarget(descriptor, descriptor.patched), 'patched');
    assert.equal(classifyExpoWidgetsPatchTarget(descriptor, '0'.repeat(64)), null);
  }
  assert.equal(upgradeable, 10);
});

test('rejects payload or installed target byte drift before mutation', async (t) => {
  await t.test('payload drift', (child) => {
    const root = createFixture(child, { omitNewTarget: true });
    const descriptor = EXPO_WIDGETS_PATCH_TARGETS[0];
    const target = join(root, ...descriptor.target.split('/'));
    const before = readFileSync(target);
    writeFileSync(
      join(root, 'scripts/phase5/expo-widgets-57.0.9', descriptor.payload),
      Buffer.concat([before, Buffer.from(' ')]),
    );
    expectFailure(root, 'PAYLOAD_HASH');
    assert.deepEqual(readFileSync(target), before);
  });

  await t.test('target drift', (child) => {
    const root = createFixture(child);
    const descriptor = EXPO_WIDGETS_PATCH_TARGETS[0];
    const target = join(root, ...descriptor.target.split('/'));
    writeFileSync(target, Buffer.concat([readFileSync(target), Buffer.from(' ')]));
    expectFailure(root, 'TARGET_HASH');
  });
});

test('rejects reviewed package and lock provenance drift', async (t) => {
  const cases = [
    [
      'mobile range',
      'apps/mobile/package.json',
      (value) => (value.dependencies[EXPO_WIDGETS_PACKAGE_NAME] = '~57.0.9'),
      'MOBILE_DEPENDENCY',
    ],
    [
      'workspace range',
      'package-lock.json',
      (value) =>
        (value.packages['apps/mobile'].dependencies[EXPO_WIDGETS_PACKAGE_NAME] = '~57.0.9'),
      'LOCK_WORKSPACE_DEPENDENCY',
    ],
    [
      'artifact URL',
      'package-lock.json',
      (value) => (value.packages['node_modules/expo-widgets'].resolved += '?drift'),
      'LOCK_RESOLVED',
    ],
    [
      'integrity',
      'package-lock.json',
      (value) => (value.packages['node_modules/expo-widgets'].integrity += 'A'),
      'LOCK_INTEGRITY',
    ],
    [
      'installed version',
      'node_modules/expo-widgets/package.json',
      (value) => (value.version = '57.0.8'),
      'PACKAGE_IDENTITY',
    ],
  ];
  for (const [name, path, mutate, code] of cases) {
    await t.test(name, (child) => {
      const root = createFixture(child);
      const absolute = join(root, ...path.split('/'));
      const value = JSON.parse(readFileSync(absolute, 'utf8'));
      mutate(value);
      writeJson(absolute, value);
      expectFailure(root, code);
    });
  }
});
