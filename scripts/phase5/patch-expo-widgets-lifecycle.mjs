import { createHash, randomBytes } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const EXPO_WIDGETS_PACKAGE_NAME = 'expo-widgets';
export const EXPO_WIDGETS_PACKAGE_VERSION = '57.0.8';
export const EXPO_WIDGETS_LOCK_RESOLVED =
  'https://registry.npmjs.org/expo-widgets/-/expo-widgets-57.0.8.tgz';
export const EXPO_WIDGETS_LOCK_INTEGRITY =
  'sha512-D5pSnmz48/AEYFfZAQuy+TS+HwkXxj0RB10n0jeORMc4gPM9LKqj0hWt1xCYZ6PpuyJ4QS8hrXSKLK8kXphWPg==';

const SCRIPT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PAYLOAD_DIRECTORY = 'scripts/phase5/expo-widgets-57.0.8';
const EXPO_WIDGETS_TARGET_PREFIX = 'node_modules/expo-widgets/';
const REVIEWED_INSTALL_DIRECTORIES = new Set([
  'node_modules/expo-widgets',
  'apps/mobile/node_modules/expo-widgets',
]);
const MAX_JSON_BYTES = 32 * 1024 * 1024;
const MAX_SOURCE_BYTES = 256 * 1024;

export const EXPO_WIDGETS_PATCH_TARGETS = Object.freeze([
  {
    target: 'node_modules/expo-widgets/ios/Widgets/AppIntent.swift',
    payload: 'AppIntent.swift',
    original: 'f9c61057350a4f42cba5d90642688ea1abe182fec6c503702238d48e828f5fbd',
    patched: '12f011532fd24abc3d8809eb4ee94b679ea8335bf1b77ae8d1cefcc0ea5e7310',
  },
  {
    target: 'node_modules/expo-widgets/ios/Widgets/EntryView.swift',
    payload: 'EntryView.swift',
    original: 'd03d043c4941060bc98f2ad7d8c647de45527e961fbb14de2f2587d16273fc7f',
    patched: '35d07280d61a55fa159b7f9f30e32bbb3bf8ec4a350a7b0d6e73987bd4e11112',
  },
  {
    target: 'node_modules/expo-widgets/ios/ExpoWidgets.podspec',
    payload: 'ExpoWidgets.podspec',
    original: 'fe7fa8b631006c117ed9b7a079a65c362bca470df8c8e171d1c8e65b204d362e',
    patched: '616a1ec19f9a6e09474163ca0ae0df9ca3823395a16c16e914a17c376d5aee0a',
  },
  {
    target: 'node_modules/expo-widgets/ios/LiveActivity.swift',
    payload: 'LiveActivity.swift',
    original: 'ad5a9c4665074b186ba00e4d6f43fe23c494401fb2e23d9e9032f0d06a803be7',
    priorPatched: ['63dd154a7f0a4fba90cce7a2656badf9682b871343616e3f14324aff2a09c99e'],
    patched: 'f7e0548a5057743d27e0748b521e1e2873794f55be39b6f7739f22a57af17770',
  },
  {
    target: 'node_modules/expo-widgets/ios/LiveActivityFactory.swift',
    payload: 'LiveActivityFactory.swift',
    original: 'b1bf7c1d8a4b1ec8932df6caa9e05a264ae99f21954284be42f3bb113b6915fb',
    priorPatched: [
      'b87dfc25badeb66e8e009316b3004d1318d82ac686029562281f3dc48cfc3a5c',
      '71e1307e35bfc7a7e22256548ddd77d359e6ecacb0d65d7202e59f49ba61a48e',
    ],
    patched: 'a612cab3a7071b7c12277b5230b7988432d5e15d565c0504301ebb922d2fbdaf',
  },
  {
    target: 'node_modules/expo-widgets/ios/RoutineKindWidgetLifecycleStore.swift',
    payload: 'RoutineKindWidgetLifecycleStore.swift',
    original: null,
    priorPatched: [
      '486041f38b7b600b4d2e4b40be03cfa11994d85048ead09751d24735ccdea2a2',
      '47a9ffdfbc63c7ecaa477df6e3d7ff67c57572333d8b608d4e74a39e6884a83c',
    ],
    patched: '6b01f4e2cd54874eab2a8e5cb773e4dc87992d7ac179cf490ec88044fe5ef8bc',
  },
  {
    target: 'node_modules/expo-widgets/ios/Widgets/TimelineProvider.swift',
    payload: 'TimelineProvider.swift',
    original: 'd815a984030c8b1e1f51a4068c6bba71f8d78f5f9e230e80e5fa0d1980652757',
    patched: '63d077ce0ea7d8d875f2af0dc15c7d6706e9d154f3ea747c4209353a4a51328e',
  },
  {
    target: 'node_modules/expo-widgets/ios/Widgets/Utils.swift',
    payload: 'Utils.swift',
    original: '3ff98e21d29d43d358fec29069795781e31961ad1ebd77d5cae13178e30cfd49',
    patched: 'd32a56a95515badc2abed0603e6fe14214a895e8ef5f4fcd5f7f1ac236f5688b',
  },
  {
    target: 'node_modules/expo-widgets/ios/Widgets/WidgetLiveActivity.swift',
    payload: 'WidgetLiveActivity.swift',
    original: '36c7448b31a6791d996015859bea1e87cf8df884837c0b895c7963d8569efe3c',
    patched: '2b12bc9aa8d900f5e9ad72e00e396a607f5dc6fdbd033a9b917b2062b8e67717',
  },
  {
    target: 'node_modules/expo-widgets/ios/WidgetObject.swift',
    payload: 'WidgetObject.swift',
    original: '3bbbc29258eaa549d2074e17664f3804511053b9cb5396761c960b3cb5ee9d4e',
    patched: 'ef703f95a235024a169a0a35aea301af5ded638fb9d572e278d7a283c729fe6a',
  },
  {
    target: 'node_modules/expo-widgets/ios/WidgetsModule.swift',
    payload: 'WidgetsModule.swift',
    original: '73ea58436924bf50512db7cd5971b7650d7c266fc02d51176d7cdbffe371bdd2',
    priorPatched: [
      '357649a8d57b3a41b08ad0d582498dacdecca20e05d05515a17922c81b7ca06a',
      '7952c4b55e73a1f3cec15554051ee2ccfd91f1ae3ac5d7b101489b7eca5640b1',
    ],
    patched: '48cba3cdba4ad6de32cabf84769a59fcd8dc474f03de1e94a9d6c329fcb2b172',
  },
]);

export class ExpoWidgetsLifecyclePatchError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'ExpoWidgetsLifecyclePatchError';
    this.code = code;
  }
}

function fail(code, message, cause) {
  throw new ExpoWidgetsLifecyclePatchError(code, message, cause ? { cause } : undefined);
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkedRoot(rootValue) {
  if (typeof rootValue !== 'string' || rootValue.length === 0) {
    fail('ROOT_INVALID', 'Repository root must be a non-empty path.');
  }
  const absolute = resolve(rootValue);
  let stat;
  try {
    stat = lstatSync(absolute);
  } catch (error) {
    fail('ROOT_MISSING', 'Repository root does not exist.', error);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail('ROOT_TYPE', 'Repository root must be a real directory.');
  }
  return { absolute, real: realpathSync(absolute) };
}

function checkedRelative(relativePath) {
  if (
    typeof relativePath !== 'string' ||
    !relativePath ||
    isAbsolute(relativePath) ||
    relativePath.includes('\\') ||
    /^[A-Za-z]:/.test(relativePath) ||
    relativePath.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    fail('INTERNAL_PATH', 'Patch path is not normalized.');
  }
  return relativePath.split('/');
}

function isWithin(root, candidate) {
  const rel = relative(root, candidate);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}

function checkedParent(root, relativePath) {
  const parts = checkedRelative(relativePath);
  const leaf = parts.pop();
  let current = root.absolute;
  for (const part of parts) {
    current = join(current, part);
    let stat;
    try {
      stat = lstatSync(current);
    } catch (error) {
      fail('PATH_MISSING', `Patch parent is missing: ${relativePath}.`, error);
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      fail('PATH_TYPE', `Patch parent is unsafe: ${relativePath}.`);
    }
  }
  const real = realpathSync(current);
  if (!isWithin(root.real, real)) {
    fail('PATH_ESCAPE', `Patch path escapes the repository: ${relativePath}.`);
  }
  return { parent: current, leaf, absolute: join(current, leaf) };
}

function readBoundedFile(root, relativePath, maximumBytes, allowMissing = false) {
  const path = checkedParent(root, relativePath);
  if (!existsSync(path.absolute)) {
    if (allowMissing) return { ...path, bytes: null, mode: 0o644 };
    fail('PATH_MISSING', `Patch file is missing: ${relativePath}.`);
  }
  const stat = lstatSync(path.absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail('PATH_TYPE', `Patch target is not a regular file: ${relativePath}.`);
  }
  if (stat.size <= 0 || stat.size > maximumBytes) {
    fail('FILE_SIZE', `Patch file has an invalid size: ${relativePath}.`);
  }
  const before = statSync(path.absolute);
  const bytes = readFileSync(path.absolute);
  const after = statSync(path.absolute);
  if (
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeMs !== after.mtimeMs ||
    bytes.length !== after.size
  ) {
    fail('PATH_RACE', `Patch file changed while read: ${relativePath}.`);
  }
  return { ...path, bytes, mode: stat.mode & 0o777 };
}

function readJson(root, relativePath) {
  const file = readBoundedFile(root, relativePath, MAX_JSON_BYTES);
  let value;
  try {
    value = JSON.parse(file.bytes.toString('utf8'));
  } catch (error) {
    fail('JSON_INVALID', `Invalid JSON: ${relativePath}.`, error);
  }
  if (!isRecord(value)) fail('JSON_SHAPE', `Expected object JSON: ${relativePath}.`);
  return value;
}

export function classifyExpoWidgetsPatchTarget(descriptor, targetHash) {
  if (targetHash === descriptor.patched) return 'patched';
  if (descriptor.original === null && targetHash === null) return 'original';
  if (targetHash === descriptor.original) return 'original';
  if (descriptor.priorPatched?.includes(targetHash)) return 'original';
  return null;
}

function validateProvenance(root) {
  const mobile = readJson(root, 'apps/mobile/package.json');
  if (
    !isRecord(mobile.dependencies) ||
    mobile.dependencies[EXPO_WIDGETS_PACKAGE_NAME] !== EXPO_WIDGETS_PACKAGE_VERSION
  ) {
    fail('MOBILE_DEPENDENCY', 'expo-widgets must be exactly pinned in the mobile package.');
  }

  const lock = readJson(root, 'package-lock.json');
  if (lock.lockfileVersion !== 3 || !isRecord(lock.packages)) {
    fail('LOCK_SHAPE', 'package-lock.json must be npm lockfile v3.');
  }
  const workspace = lock.packages['apps/mobile'];
  if (
    !isRecord(workspace) ||
    !isRecord(workspace.dependencies) ||
    workspace.dependencies[EXPO_WIDGETS_PACKAGE_NAME] !== EXPO_WIDGETS_PACKAGE_VERSION
  ) {
    fail('LOCK_WORKSPACE_DEPENDENCY', 'The lockfile workspace spec is not exact.');
  }
  const paths = Object.keys(lock.packages).filter((value) =>
    REVIEWED_INSTALL_DIRECTORIES.has(value),
  );
  if (paths.length !== 1) {
    fail('LOCK_ENTRY_PATH', 'The reviewed expo-widgets lock entry must be unique.');
  }
  const installDirectory = paths[0];
  const entry = lock.packages[installDirectory];
  if (!isRecord(entry) || entry.version !== EXPO_WIDGETS_PACKAGE_VERSION) {
    fail('LOCK_VERSION', 'The expo-widgets lock version is not reviewed.');
  }
  if (entry.resolved !== EXPO_WIDGETS_LOCK_RESOLVED) {
    fail('LOCK_RESOLVED', 'The expo-widgets registry artifact is not reviewed.');
  }
  if (entry.integrity !== EXPO_WIDGETS_LOCK_INTEGRITY) {
    fail('LOCK_INTEGRITY', 'The expo-widgets integrity is not reviewed.');
  }
  if (entry.link !== undefined || entry.dev !== undefined || entry.optional !== undefined) {
    fail('LOCK_FLAGS', 'The expo-widgets lock placement has unreviewed flags.');
  }

  const installed = readJson(root, `${installDirectory}/package.json`);
  if (
    installed.name !== EXPO_WIDGETS_PACKAGE_NAME ||
    installed.version !== EXPO_WIDGETS_PACKAGE_VERSION
  ) {
    fail('PACKAGE_IDENTITY', 'Installed expo-widgets does not match the reviewed package.');
  }
  return { installDirectory };
}

function preflight(root) {
  const { installDirectory } = validateProvenance(root);
  return EXPO_WIDGETS_PATCH_TARGETS.map((descriptor) => {
    const payloadRelative = `${PAYLOAD_DIRECTORY}/${descriptor.payload}`;
    const payload = readBoundedFile(root, payloadRelative, MAX_SOURCE_BYTES);
    if (hash(payload.bytes) !== descriptor.patched) {
      fail('PAYLOAD_HASH', `Reviewed payload drifted: ${payloadRelative}.`);
    }
    const targetRelative = `${installDirectory}/${descriptor.target.slice(
      EXPO_WIDGETS_TARGET_PREFIX.length,
    )}`;
    const target = readBoundedFile(
      root,
      targetRelative,
      MAX_SOURCE_BYTES,
      descriptor.original === null,
    );
    const targetHash = target.bytes === null ? null : hash(target.bytes);
    const state = classifyExpoWidgetsPatchTarget(descriptor, targetHash);
    if (!state) {
      fail('TARGET_HASH', `Target is neither reviewed original nor patched: ${targetRelative}.`);
    }
    return { descriptor, payload, target, targetRelative, state, targetHash };
  });
}

function makeTemporary(path, bytes, mode) {
  const temporary = join(
    path.parent,
    `.${path.leaf}.routinekind-${process.pid}-${randomBytes(8).toString('hex')}.tmp`,
  );
  let descriptor;
  try {
    descriptor = openSync(
      temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      mode,
    );
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    chmodSync(temporary, mode);
    if (hash(readFileSync(temporary)) !== hash(bytes)) {
      fail('TEMP_VERIFY', 'A staged dependency patch failed verification.');
    }
    return temporary;
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    rmSync(temporary, { force: true });
    if (error instanceof ExpoWidgetsLifecyclePatchError) throw error;
    fail('TEMP_WRITE', 'Could not stage the dependency patch.', error);
  }
}

function syncParentDirectory(path) {
  // Windows cannot portably open a directory with node:fs. EAS/macOS and
  // POSIX CI do support directory fsync, which makes each recovery-capable
  // rename durable before the installer advances to the next reviewed file.
  if (process.platform === 'win32') return;
  let descriptor;
  try {
    descriptor = openSync(path.parent, constants.O_RDONLY);
    fsyncSync(descriptor);
  } catch (error) {
    fail('DIRECTORY_SYNC', 'Could not durably synchronize a patched dependency directory.', error);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function restoreTarget(item) {
  if (item.target.bytes === null) {
    rmSync(item.target.absolute, { force: true });
    syncParentDirectory(item.target);
    return;
  }
  const temporary = makeTemporary(item.target, item.target.bytes, item.target.mode);
  renameSync(temporary, item.target.absolute);
  syncParentDirectory(item.target);
}

export function patchExpoWidgetsLifecycle({ root = SCRIPT_ROOT, check = false } = {}) {
  const checked = checkedRoot(root);
  const items = preflight(checked);
  const originals = items.filter(({ state }) => state === 'original');
  if (check) {
    if (originals.length > 0) {
      fail('PATCH_UNAPPLIED', `${originals.length} reviewed expo-widgets files are unpatched.`);
    }
    return { status: 'checked', files: items.length };
  }
  if (originals.length === 0) {
    return { status: 'already-patched', files: items.length };
  }

  const staged = originals.map((item) => ({
    item,
    temporary: makeTemporary(item.target, item.payload.bytes, item.target.mode),
  }));
  const committed = [];
  try {
    for (const { item } of staged) {
      const current = readBoundedFile(
        checked,
        item.targetRelative,
        MAX_SOURCE_BYTES,
        item.descriptor.original === null,
      );
      const currentHash = current.bytes === null ? null : hash(current.bytes);
      if (currentHash !== item.targetHash) {
        fail('PATH_RACE', `Patch target changed after preflight: ${item.targetRelative}.`);
      }
    }
    for (const entry of staged) {
      renameSync(entry.temporary, entry.item.target.absolute);
      committed.push(entry.item);
      syncParentDirectory(entry.item.target);
    }
  } catch (error) {
    for (const entry of staged) rmSync(entry.temporary, { force: true });
    for (const item of committed.reverse()) {
      try {
        restoreTarget(item);
      } catch {
        // A subsequent run accepts a reviewed partial state and completes safely.
      }
    }
    if (error instanceof ExpoWidgetsLifecyclePatchError) throw error;
    fail('PATCH_COMMIT', 'Could not install the hash-verified expo-widgets patch set.', error);
  }

  const verified = preflight(checked);
  if (verified.some(({ state }) => state !== 'patched')) {
    fail('PATCH_VERIFY', 'The expo-widgets patch set did not verify after installation.');
  }
  return { status: 'patched', files: items.length, changed: originals.length };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    const result = patchExpoWidgetsLifecycle({
      root: process.cwd(),
      check: process.argv.slice(2).includes('--check'),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
