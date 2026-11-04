/** C46 current installed-native technical compatibility. No owner admission. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nativeTree23, LOCK_SUCCESSION23_SHA256 } from '../../phase9/ios-privacy-lock-succession23.mjs';
import { IOS_WIDGET_EXTENSION_CONTRACT, validateIosExtensionConfig,
  validateIosExtensionVariantIsolation } from '../../phase5/ios-extension-contract.mjs';

const BASE = '20c761fa5e3fbf427fb33ab319218bd0c1d022bd';
const BASE_LOCK = '1485297ffa6cc20367a5f2fda35bc33e12dc11ef422c813f5f28a4e339cb3b95';
const CURRENT_LOCK = '71aef9b618c23b3d15c94251f5d9548d4a3c6a1a88af42471ed03ad3d0b062aa';
const CURRENT_PACKAGE = 'cc37998ca18d43326f11e47cc78f2b3aa62231b0381d1948578804190ec2269b';
export const LOCK_DELTA46 = Object.freeze(['',
  'node_modules/@expo/fingerprint/node_modules/minimatch',
  'node_modules/@isaacs/nonrecursive-glob-match',
  'node_modules/@onskin/decode-uri-component-compat',
  'node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch',
  'node_modules/decode-uri-component', 'node_modules/glob',
  'node_modules/glob/node_modules/minimatch', 'node_modules/path-scurry',
  'node_modules/path-scurry/node_modules/lru-cache', 'packages/decode-uri-component-compat',
  'packages/decode-uri-component-compat/node_modules/decode-uri-component']);
const WITNESS = 'docs/phase-9/ios-sdk-lock-succession23.v1.json';
const SOURCE_READERS = ['scripts/phase5/ios-extension-contract.mjs',
  'scripts/phase5/check-native-config.mjs', 'scripts/phase5/resolve-ios-extension-config.mjs',
  'scripts/phase9/ios-privacy-contract.mjs', 'scripts/phase9/ios-privacy-lock-succession23.mjs'];
const privateProofs = new WeakMap();
const bytesJson = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const refuse = (message) => { throw new Error(`C46_NATIVE_${message}`); };

function gitBytes(root, path) {
  const result = spawnSync('git', ['--no-replace-objects', 'show', `${BASE}:${path}`],
    { cwd: root, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) refuse(`BASE_INPUT:${path}`);
  return result.stdout;
}

function gitInputMap(root, paths) {
  const result = spawnSync('git', ['--no-replace-objects', 'cat-file', '--batch'], {
    cwd: root, input: paths.map((path) => `${BASE}:${path}\n`).join(''),
    windowsHide: true, maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) refuse('BASE_BATCH');
  const inputs = new Map();
  let offset = 0;
  for (const path of paths) {
    const lineEnd = result.stdout.indexOf(10, offset);
    const [object, kind, length] = result.stdout.subarray(offset, lineEnd).toString('ascii').split(' ');
    const size = Number(length);
    if (lineEnd < offset || !/^[a-f0-9]{40}$/u.test(object) || kind !== 'blob' ||
        !Number.isSafeInteger(size) || size < 0 || size > 16 * 1024 * 1024) refuse('BASE_BATCH_HEADER');
    offset = lineEnd + 1;
    const bytes = result.stdout.subarray(offset, offset + size);
    if (result.stdout[offset + size] !== 10 || bytes.length !== size ||
        createHash('sha1').update(`blob ${size}\0`).update(bytes).digest('hex') !== object) refuse('BASE_BATCH_BYTES');
    inputs.set(path, bytes);
    offset += size + 1;
  }
  if (offset !== result.stdout.length) refuse('BASE_BATCH_EXTRA');
  return inputs;
}

function checkedRoot(value) {
  const absolute = resolve(value);
  if (lstatSync(absolute).isSymbolicLink() || !lstatSync(absolute).isDirectory()) refuse('ROOT');
  return { absolute, real: realpathSync(absolute) };
}

export function checkedNativePath46(root, name) {
  if (typeof name !== 'string' || isAbsolute(name) || !name || /[\\:\u0000-\u001f]/u.test(name) ||
      name.split('/').some((part) => !part || part === '.' || part === '..' || /[. ]$/u.test(part))) refuse('PATH');
  let absolute = root.absolute;
  for (const part of name.split('/')) {
    absolute = join(absolute, part);
    if (lstatSync(absolute).isSymbolicLink()) refuse('LINK');
  }
  const rel = relative(root.real, realpathSync(absolute));
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) refuse('ESCAPE');
  return { absolute };
}

export function readNativeFile46(root, name, maximum = 16 * 1024 * 1024) {
  const { absolute } = checkedNativePath46(root, name);
  const before = lstatSync(absolute, { bigint: true });
  if (!before.isFile() || before.nlink !== 1n || before.size < 1n || before.size > BigInt(maximum)) refuse('FILE');
  const descriptor = openSync(absolute, 'r');
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    const final = lstatSync(absolute, { bigint: true });
    for (const stat of [opened, after, final]) {
      if (['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs', 'nlink'].some((key) => before[key] !== stat[key])) refuse('RACE');
    }
    if (BigInt(bytes.length) !== before.size) refuse('READ_SIZE');
    return { bytes, sha256: hash(bytes) };
  } finally { closeSync(descriptor); }
}

export function verifyLockDelta46(baseBytes, currentBytes) {
  if (hash(baseBytes) !== BASE_LOCK || hash(currentBytes) !== CURRENT_LOCK) refuse('LOCK_IDENTITY');
  const base = JSON.parse(baseBytes);
  const current = JSON.parse(currentBytes);
  const changed = [...new Set([...Object.keys(base.packages), ...Object.keys(current.packages)])]
    .filter((key) => !same(base.packages[key], current.packages[key])).sort();
  assert.deepEqual(changed, LOCK_DELTA46, 'C46_NATIVE_FINITE_LOCK_DELTA');
  const reversed = structuredClone(current);
  for (const key of LOCK_DELTA46) {
    if (Object.hasOwn(base.packages, key)) reversed.packages[key] = base.packages[key];
    else delete reversed.packages[key];
  }
  if (!bytesJson(reversed).equals(baseBytes)) refuse('BASE_LOCK_RECONSTRUCTION');
  return { base, current, changed };
}

export function verifyNativeTree46(root, expected) {
  const actual = nativeTree23(checkedRoot(root), expected.path, {
    checkedPath: checkedNativePath46, readBoundedFile: readNativeFile46,
    reject: (message) => refuse(`TREE:${message}`),
  });
  if (!same(actual, expected)) refuse(`TREE_DENOMINATOR:${expected.path}`);
  return actual;
}

export function proveNativeCompletion46(rootValue = process.cwd()) {
  const root = checkedRoot(rootValue);
  const currentLock = readNativeFile46(root, 'package-lock.json');
  const { current, changed } = verifyLockDelta46(gitBytes(root.absolute, 'package-lock.json'), currentLock.bytes);
  const rootPackage = readNativeFile46(root, 'package.json');
  if (rootPackage.sha256 !== CURRENT_PACKAGE) refuse('ROOT_PACKAGE');
  const witnessFile = readNativeFile46(root, WITNESS);
  if (witnessFile.sha256 !== LOCK_SUCCESSION23_SHA256) refuse('WITNESS');
  const witness = JSON.parse(witnessFile.bytes);
  const pins = [...witness.immutableInputs, ...witness.sourcePins, ...witness.mandatoryPatchInputs, witness.mobilePackage];
  const inputs = [];
  for (const pin of pins) {
    const actual = readNativeFile46(root, pin.path);
    if (actual.sha256 !== pin.sha256 || actual.bytes.length !== pin.bytes) refuse(`PIN:${pin.path}`);
    inputs.push({ path: pin.path, bytes: actual.bytes.length, sha256: actual.sha256 });
  }
  for (const [name, node] of Object.entries(witness.unchangedNativeNodes)) {
    if (!same(current.packages[name], node)) refuse(`NATIVE_LOCK:${name}`);
  }
  // The original program's literal source inventory is itself authenticated at
  // BASE. Every existing referenced native/config/contract input stays exact.
  const oldCheck = gitBytes(root.absolute, 'scripts/phase5/check-native-config.mjs').toString('utf8');
  const literalInputs = [...oldCheck.matchAll(/['"]((?:apps|scripts|docs|packages)\/[A-Za-z0-9_/.()@-]+)['"]/gu)]
    .map((match) => match[1]);
  const listing = spawnSync('git', ['--no-replace-objects', 'ls-tree', '-r', '--name-only', BASE],
    { cwd: root.absolute, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  if (listing.status !== 0) refuse('BASE_TREE_INVENTORY');
  const basePaths = new Set(listing.stdout.trim().split('\n'));
  const sourcePaths = [...new Set([...SOURCE_READERS, ...literalInputs])].sort();
  const originalInputs = gitInputMap(root.absolute, sourcePaths.filter((path) => basePaths.has(path)));
  for (const path of sourcePaths) {
    if (!basePaths.has(path)) {
      // The frozen original also contains explicit absence/negative assertions.
      let absent = false;
      let candidate = root.absolute;
      for (const part of path.split('/')) {
        candidate = join(candidate, part);
        try { if (lstatSync(candidate).isSymbolicLink()) refuse(`NEGATIVE_INPUT_LINK:${path}`); }
        catch (error) { if (error.code !== 'ENOENT') throw error; absent = true; break; }
      }
      if (!absent) refuse(`EXPECTED_ABSENCE:${path}`);
      inputs.push({ path, status: 'ABSENT_IN_PINNED_PARENT_AND_CURRENT_NEGATIVE_SOURCE_LITERAL' });
      continue;
    }
    const before = originalInputs.get(path);
    const actual = readNativeFile46(root, path);
    if (!actual.bytes.equals(before)) refuse(`UNCHANGED_SOURCE:${path}`);
    inputs.push({ path, bytes: actual.bytes.length, sha256: actual.sha256 });
  }
  const trees = witness.installedNativeTrees.map((expected) => verifyNativeTree46(root.absolute, expected));
  const report = Object.freeze({ status: 'C46_NATIVE_SOURCE_TECHNICAL_ONLY',
    base: BASE, currentLockSHA256: currentLock.sha256, baseLockSHA256: BASE_LOCK,
    changedLockNodes: Object.freeze(changed), witnessSHA256: witnessFile.sha256,
    inputs: Object.freeze(inputs), installedNativeTrees: Object.freeze(trees),
    originalCurrentReader: 'NOT_RUN_BY_THIS_SUCCESSOR_ORIGINAL_COMPLETE_LOCK_PIN_RETAINED',
    sourceOnly: true, nativeAccepted: false, archiveInspected: false,
    acceptanceGranted: false, publicReleaseAuthorized: false, release: 'NO_GO' });
  privateProofs.set(report, { witness, currentLockSHA256: currentLock.sha256 });
  return report;
}

/** Only after actual current proof: retain every original pure config assertion. */
export function validateNativeWidget46(proof, { config, packageJson, packageLock, variant }) {
  const held = privateProofs.get(proof);
  if (!held) refuse('PROOF_REQUIRED');
  if (hash(bytesJson(packageLock)) !== held.currentLockSHA256 ||
      hash(bytesJson(packageJson)) !== held.witness.mobilePackage.sha256) refuse('CONFIG_INPUT_DRIFT');
  const projectedPackage = structuredClone(packageJson);
  const projectedLock = structuredClone(packageLock);
  for (const [name, expected] of Object.entries(held.witness.widgetCompatibility)) {
    const actual = packageLock.packages[`node_modules/${name}`];
    if (packageJson.dependencies[name] !== expected.specifier ||
        packageLock.packages['apps/mobile'].dependencies[name] !== expected.specifier ||
        ['version', 'resolved', 'integrity'].some((key) => actual?.[key] !== expected[key])) refuse('WIDGET_METADATA');
  }
  for (const [name, expected] of Object.entries(IOS_WIDGET_EXTENSION_CONTRACT.reviewedDependencyLocks)) {
    projectedPackage.dependencies[name] = expected.specifier;
    projectedLock.packages['apps/mobile'].dependencies[name] = expected.specifier;
    for (const key of ['version', 'resolved', 'integrity']) projectedLock.packages[expected.path][key] = expected[key];
  }
  return validateIosExtensionConfig({ config, packageJson: projectedPackage,
    packageLock: projectedLock, variant });
}

export function runNativeCompletion46(root = process.cwd()) {
  const proof = proveNativeCompletion46(root);
  const packageJson = JSON.parse(readFileSync(resolve(root, 'apps/mobile/package.json')));
  const packageLock = JSON.parse(readFileSync(resolve(root, 'package-lock.json')));
  const identities = [];
  for (const variant of ['development', 'staging']) {
    const result = spawnSync(process.execPath, [resolve(root, 'scripts/phase5/resolve-ios-extension-config.mjs'), variant],
      { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
    if (result.status !== 0) refuse(`RESOLVE:${variant}`);
    const checked = validateNativeWidget46(proof, { config: JSON.parse(result.stdout), packageJson, packageLock, variant });
    if (checked.errors.length || !checked.identity) refuse(`CONFIG:${JSON.stringify(checked.errors)}`);
    identities.push(checked.identity);
  }
  assert.deepEqual(validateIosExtensionVariantIsolation(identities), []);
  const after = proveNativeCompletion46(root);
  if (!same(after, proof)) refuse('SOURCE_CHANGED_DURING_RESOLUTION');
  return { ...proof, identities, qualification: 'CURRENT_INSTALLED_SOURCE_AND_PURE_CONFIG_ONLY_NOT_ORIGINAL_READER_OR_SIGNED_DEVICE_ACCEPTANCE' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(runNativeCompletion46(resolve(dirname(fileURLToPath(import.meta.url)), '../../..'))));
}
