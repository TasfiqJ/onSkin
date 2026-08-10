import { createHash, randomBytes } from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TextDecoder } from 'node:util';

export const VIEW_SHOT_PACKAGE_NAME = 'react-native-view-shot';
export const VIEW_SHOT_PACKAGE_VERSION = '5.1.0';
export const VIEW_SHOT_LOCK_RESOLVED =
  'https://registry.npmjs.org/react-native-view-shot/-/react-native-view-shot-5.1.0.tgz';
export const VIEW_SHOT_LOCK_INTEGRITY =
  'sha512-JZgElCD82aO+hejIF/leUzI7JufL9mgJ6ChzGWIcdZ2ajpaEvvSnvIcw0qD32XWkrbId8wfSbyz/4u/ulTQzQA==';
export const VIEW_SHOT_ORIGINAL_MANIFEST_SHA256 =
  '74b0cd72fc23c1ef302f22ee2753f61817cdc5af0ff7a7f2d0632b524fb8acea';
export const VIEW_SHOT_PATCHED_MANIFEST_SHA256 =
  '7a411ba0c8b0c43834b84b23b3959aa98df450c52db9e0a4efb4ba1b2786f0c9';

const LOCKFILE_PATH = 'package-lock.json';
const MOBILE_PACKAGE_PATH = 'apps/mobile/package.json';
const LOCK_MOBILE_WORKSPACE_PATH = 'apps/mobile';
const LOCK_VIEW_SHOT_PATH = 'node_modules/react-native-view-shot';
const INSTALLED_PACKAGE_PATH = 'node_modules/react-native-view-shot/package.json';
const INSTALLED_MANIFEST_PATH = 'node_modules/react-native-view-shot/ios/PrivacyInfo.xcprivacy';
const MAX_LOCKFILE_BYTES = 32 * 1024 * 1024;
const MAX_PACKAGE_JSON_BYTES = 512 * 1024;
const MAX_PRIVACY_MANIFEST_BYTES = 64 * 1024;
const SCRIPT_REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const INVALID_ACCESSED_API_FRAGMENT = '\t<key>NSPrivacyAccessedAPITypes</key>\n\t<array/>\n';
const ORIGINAL_MANIFEST_TEXT = `<?xml version="1.0" encoding="UTF-8"?>
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
const PATCHED_MANIFEST_TEXT = ORIGINAL_MANIFEST_TEXT.replace(INVALID_ACCESSED_API_FRAGMENT, '');
const ORIGINAL_MANIFEST_BYTES = Buffer.from(ORIGINAL_MANIFEST_TEXT, 'utf8');
const PATCHED_MANIFEST_BYTES = Buffer.from(PATCHED_MANIFEST_TEXT, 'utf8');
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

export class ViewShotPrivacyPatchError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'ViewShotPrivacyPatchError';
    this.code = code;
  }
}

function fail(code, message, cause) {
  throw new ViewShotPrivacyPatchError(code, message, cause ? { cause } : undefined);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertModuleInvariants() {
  if (
    !ORIGINAL_MANIFEST_TEXT.includes(INVALID_ACCESSED_API_FRAGMENT) ||
    PATCHED_MANIFEST_TEXT.includes('NSPrivacyAccessedAPITypes') ||
    sha256(ORIGINAL_MANIFEST_BYTES) !== VIEW_SHOT_ORIGINAL_MANIFEST_SHA256 ||
    sha256(PATCHED_MANIFEST_BYTES) !== VIEW_SHOT_PATCHED_MANIFEST_SHA256
  ) {
    fail('INTERNAL_CONTRACT', 'The pinned privacy-manifest patch contract is inconsistent.');
  }
}

function checkedRoot(rootValue) {
  if (typeof rootValue !== 'string' || rootValue.length === 0) {
    fail('ROOT_INVALID', 'The repository root must be a non-empty filesystem path.');
  }
  const absolute = resolve(rootValue);
  let stat;
  try {
    stat = lstatSync(absolute, { bigint: true });
  } catch (error) {
    fail('ROOT_MISSING', 'The repository root does not exist.', error);
  }
  if (stat.isSymbolicLink()) {
    fail('ROOT_SYMLINK', 'The repository root must not be a symbolic link or junction.');
  }
  if (!stat.isDirectory()) {
    fail('ROOT_TYPE', 'The repository root must be a directory.');
  }
  let real;
  try {
    real = realpathSync(absolute);
  } catch (error) {
    fail('ROOT_REALPATH', 'The repository root could not be resolved safely.', error);
  }
  return Object.freeze({ absolute, real });
}

function isWithinRoot(realRoot, candidate) {
  const rel = relative(realRoot, candidate);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}

function validateRelativePath(relativePath) {
  const segments = relativePath.split('/');
  if (
    !relativePath ||
    isAbsolute(relativePath) ||
    /^[A-Za-z]:/.test(relativePath) ||
    relativePath.includes('\\') ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    fail('INTERNAL_PATH', 'A pinned dependency path is not normalized.');
  }
  return segments;
}

function checkedPath(root, relativePath, expectedType) {
  const segments = validateRelativePath(relativePath);
  let current = root.absolute;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    let entries;
    try {
      entries = readdirSync(current);
    } catch (error) {
      fail('PATH_PARENT', 'A pinned dependency parent directory could not be read.', error);
    }
    if (!entries.includes(segment)) {
      fail('PATH_MISSING', `The pinned dependency path is missing: ${relativePath}.`);
    }

    current = join(current, segment);
    let stat;
    try {
      stat = lstatSync(current, { bigint: true });
    } catch (error) {
      fail('PATH_RACE', 'A pinned dependency path changed while it was inspected.', error);
    }
    if (stat.isSymbolicLink()) {
      fail('PATH_SYMLINK', `The pinned dependency path must not contain links: ${relativePath}.`);
    }
    const leaf = index === segments.length - 1;
    if (!leaf && !stat.isDirectory()) {
      fail('PATH_TYPE', `A pinned dependency parent is not a directory: ${relativePath}.`);
    }
    if (leaf && expectedType === 'file' && !stat.isFile()) {
      fail('PATH_TYPE', `The pinned dependency path is not a regular file: ${relativePath}.`);
    }
    if (leaf && expectedType === 'directory' && !stat.isDirectory()) {
      fail('PATH_TYPE', `The pinned dependency path is not a directory: ${relativePath}.`);
    }
  }

  let real;
  try {
    real = realpathSync(current);
  } catch (error) {
    fail('PATH_REALPATH', 'A pinned dependency path could not be resolved safely.', error);
  }
  if (!isWithinRoot(root.real, real)) {
    fail('PATH_ESCAPE', 'A pinned dependency path resolves outside the repository root.');
  }

  return Object.freeze({
    absolute: current,
    relative: relativePath,
    stat: lstatSync(current, { bigint: true }),
  });
}

function sameFileIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function readCheckedFile(root, relativePath, maximumBytes) {
  const file = checkedPath(root, relativePath, 'file');
  if (file.stat.size <= 0n || file.stat.size > BigInt(maximumBytes)) {
    fail('FILE_SIZE', `The pinned file has an invalid size: ${relativePath}.`);
  }

  let descriptor;
  try {
    descriptor = openSync(file.absolute, constants.O_RDONLY);
    const opened = fstatSync(descriptor, { bigint: true });
    if (!opened.isFile() || !sameFileIdentity(file.stat, opened)) {
      fail('PATH_RACE', 'A pinned dependency file changed while it was opened.');
    }
    const bytes = readFileSync(descriptor);
    const finished = fstatSync(descriptor, { bigint: true });
    if (
      !sameFileIdentity(opened, finished) ||
      opened.size !== finished.size ||
      opened.mtimeNs !== finished.mtimeNs ||
      BigInt(bytes.length) !== finished.size
    ) {
      fail('PATH_RACE', 'A pinned dependency file changed while it was read.');
    }
    return Object.freeze({ ...file, bytes });
  } catch (error) {
    if (error instanceof ViewShotPrivacyPatchError) throw error;
    fail('FILE_READ', `The pinned file could not be read safely: ${relativePath}.`, error);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function decodeUtf8(bytes, relativePath) {
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
    fail('FILE_ENCODING', `The pinned file must use BOM-free UTF-8: ${relativePath}.`);
  }
  try {
    return UTF8_DECODER.decode(bytes);
  } catch (error) {
    fail('FILE_ENCODING', `The pinned file must contain valid UTF-8: ${relativePath}.`, error);
  }
}

function readJson(root, relativePath, maximumBytes) {
  const file = readCheckedFile(root, relativePath, maximumBytes);
  let value;
  try {
    value = JSON.parse(decodeUtf8(file.bytes, relativePath));
  } catch (error) {
    if (error instanceof ViewShotPrivacyPatchError) throw error;
    fail('JSON_INVALID', `The pinned JSON file is invalid: ${relativePath}.`, error);
  }
  if (!isRecord(value)) {
    fail('JSON_SHAPE', `The pinned JSON file must contain an object: ${relativePath}.`);
  }
  return Object.freeze({ ...file, value });
}

function validateLockfile(root) {
  const lock = readJson(root, LOCKFILE_PATH, MAX_LOCKFILE_BYTES).value;
  if (lock.lockfileVersion !== 3 || !isRecord(lock.packages)) {
    fail('LOCK_SHAPE', 'package-lock.json must use the pinned npm lockfile v3 shape.');
  }

  const mobile = lock.packages[LOCK_MOBILE_WORKSPACE_PATH];
  if (
    !isRecord(mobile) ||
    !isRecord(mobile.dependencies) ||
    mobile.dependencies[VIEW_SHOT_PACKAGE_NAME] !== VIEW_SHOT_PACKAGE_VERSION
  ) {
    fail('LOCK_WORKSPACE_DEPENDENCY', 'The mobile lockfile dependency is not exactly pinned.');
  }

  const candidatePaths = Object.keys(lock.packages).filter(
    (path) =>
      path === LOCK_VIEW_SHOT_PATH || path.endsWith(`/node_modules/${VIEW_SHOT_PACKAGE_NAME}`),
  );
  if (candidatePaths.length !== 1 || candidatePaths[0] !== LOCK_VIEW_SHOT_PATH) {
    fail('LOCK_ENTRY_PATH', 'The lockfile must contain exactly one package at the pinned path.');
  }

  const entry = lock.packages[LOCK_VIEW_SHOT_PATH];
  if (!isRecord(entry) || entry.version !== VIEW_SHOT_PACKAGE_VERSION) {
    fail('LOCK_VERSION', 'The installed lock entry is not the reviewed package version.');
  }
  if (entry.resolved !== VIEW_SHOT_LOCK_RESOLVED) {
    fail('LOCK_RESOLVED', 'The installed lock entry is not the reviewed registry artifact.');
  }
  if (entry.integrity !== VIEW_SHOT_LOCK_INTEGRITY) {
    fail('LOCK_INTEGRITY', 'The installed lock entry does not have the reviewed integrity.');
  }
  if (
    entry.link !== undefined ||
    entry.dev !== undefined ||
    entry.devOptional !== undefined ||
    entry.optional !== undefined ||
    entry.inBundle !== undefined
  ) {
    fail('LOCK_FLAGS', 'The installed lock entry has unreviewed placement flags.');
  }
}

function validateMobilePackage(root) {
  const mobile = readJson(root, MOBILE_PACKAGE_PATH, MAX_PACKAGE_JSON_BYTES).value;
  if (
    !isRecord(mobile.dependencies) ||
    mobile.dependencies[VIEW_SHOT_PACKAGE_NAME] !== VIEW_SHOT_PACKAGE_VERSION
  ) {
    fail('MOBILE_DEPENDENCY', 'The mobile package dependency is not exactly pinned.');
  }
}

function validateInstalledPackage(root) {
  const installed = readJson(root, INSTALLED_PACKAGE_PATH, MAX_PACKAGE_JSON_BYTES).value;
  if (installed.name !== VIEW_SHOT_PACKAGE_NAME) {
    fail('PACKAGE_NAME', 'The installed package name does not match the reviewed dependency.');
  }
  if (installed.version !== VIEW_SHOT_PACKAGE_VERSION) {
    fail(
      'PACKAGE_VERSION',
      'The installed package version does not match the reviewed dependency.',
    );
  }
}

function verifyCurrentManifest(root) {
  const manifest = readCheckedFile(root, INSTALLED_MANIFEST_PATH, MAX_PRIVACY_MANIFEST_BYTES);
  const hash = sha256(manifest.bytes);
  if (hash === VIEW_SHOT_PATCHED_MANIFEST_SHA256 && manifest.bytes.equals(PATCHED_MANIFEST_BYTES)) {
    return Object.freeze({ ...manifest, state: 'patched', sha256: hash });
  }
  if (
    hash === VIEW_SHOT_ORIGINAL_MANIFEST_SHA256 &&
    manifest.bytes.equals(ORIGINAL_MANIFEST_BYTES)
  ) {
    return Object.freeze({ ...manifest, state: 'original', sha256: hash });
  }
  fail('MANIFEST_HASH', 'The privacy manifest is neither the reviewed original nor patched file.');
}

function atomicPatch(root, original) {
  const parentRelative = dirname(INSTALLED_MANIFEST_PATH).replaceAll('\\', '/');
  const parent = checkedPath(root, parentRelative, 'directory');
  const temporaryName = `.${basename(INSTALLED_MANIFEST_PATH)}.layerwell-${process.pid}-${randomBytes(8).toString('hex')}.tmp`;
  const temporaryPath = join(parent.absolute, temporaryName);
  let descriptor;
  let temporaryCreated = false;

  try {
    descriptor = openSync(
      temporaryPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      Number(original.stat.mode & 0o777n),
    );
    temporaryCreated = true;
    writeFileSync(descriptor, PATCHED_MANIFEST_BYTES);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;

    const temporaryStat = lstatSync(temporaryPath, { bigint: true });
    const temporaryBytes = readFileSync(temporaryPath);
    if (
      temporaryStat.isSymbolicLink() ||
      !temporaryStat.isFile() ||
      sha256(temporaryBytes) !== VIEW_SHOT_PATCHED_MANIFEST_SHA256 ||
      !temporaryBytes.equals(PATCHED_MANIFEST_BYTES)
    ) {
      fail('ATOMIC_TEMP', 'The atomic replacement file failed its integrity check.');
    }

    const current = verifyCurrentManifest(root);
    if (current.state === 'patched') return current;
    if (
      !sameFileIdentity(original.stat, current.stat) ||
      current.stat.size !== original.stat.size ||
      current.stat.mtimeNs !== original.stat.mtimeNs
    ) {
      fail('PATH_RACE', 'The privacy manifest changed before atomic replacement.');
    }

    renameSync(temporaryPath, original.absolute);
    temporaryCreated = false;
  } catch (error) {
    if (error instanceof ViewShotPrivacyPatchError) throw error;
    fail('ATOMIC_WRITE', 'The privacy manifest could not be replaced atomically.', error);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    if (temporaryCreated && existsSync(temporaryPath)) {
      try {
        unlinkSync(temporaryPath);
      } catch {
        // Preserve the original error; a later run rejects unexpected manifest bytes or links.
      }
    }
  }

  const patched = verifyCurrentManifest(root);
  if (patched.state !== 'patched') {
    fail('PATCH_VERIFY', 'The privacy manifest did not match the reviewed patched bytes.');
  }
  return patched;
}

export function patchReactNativeViewShotPrivacy(options = {}) {
  assertModuleInvariants();
  const check = options.check === true;
  if (options.check !== undefined && typeof options.check !== 'boolean') {
    fail('OPTION_CHECK', 'The check option must be a boolean.');
  }

  const root = checkedRoot(options.root ?? SCRIPT_REPOSITORY_ROOT);
  validateLockfile(root);
  validateMobilePackage(root);
  validateInstalledPackage(root);
  const manifest = verifyCurrentManifest(root);

  if (manifest.state === 'patched') {
    return Object.freeze({
      manifestPath: INSTALLED_MANIFEST_PATH,
      sha256: VIEW_SHOT_PATCHED_MANIFEST_SHA256,
      status: check ? 'checked' : 'already-patched',
    });
  }
  if (check) {
    fail(
      'MANIFEST_UNPATCHED',
      'The reviewed original manifest is installed but the required source patch is absent.',
    );
  }

  atomicPatch(root, manifest);
  return Object.freeze({
    manifestPath: INSTALLED_MANIFEST_PATH,
    sha256: VIEW_SHOT_PATCHED_MANIFEST_SHA256,
    status: 'patched',
  });
}

function parseArguments(args) {
  if (args.length === 0) return { check: false };
  if (args.length === 1 && args[0] === '--check') return { check: true };
  fail(
    'CLI_ARGUMENT',
    'Usage: node scripts/phase9/patch-react-native-view-shot-privacy.mjs [--check]',
  );
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
}

if (isMainModule()) {
  try {
    const result = patchReactNativeViewShotPrivacy(parseArguments(process.argv.slice(2)));
    console.log(`react-native-view-shot privacy manifest: ${result.status} (${result.sha256})`);
  } catch (error) {
    const code = error instanceof ViewShotPrivacyPatchError ? error.code : 'UNEXPECTED_FAILURE';
    const message =
      error instanceof ViewShotPrivacyPatchError
        ? error.message
        : 'The privacy-manifest patch failed unexpectedly.';
    console.error(`react-native-view-shot privacy manifest failed [${code}]: ${message}`);
    process.exitCode = 1;
  }
}
