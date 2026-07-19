#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MACH_O_MAGICS = new Set([
  'feedface',
  'cefaedfe',
  'feedfacf',
  'cffaedfe',
  'cafebabe',
  'bebafeca',
  'cafebabf',
  'bfbafeca',
]);

function sortedUnique(values) {
  return [...new Set(values.map((value) => value.toLowerCase()))].sort();
}

export function parseDwarfdumpUuidOutput(output) {
  const values = [];
  for (const line of String(output ?? '').split(/\r?\n/)) {
    const match = line.match(
      /^UUID:\s*([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\s+/i,
    );
    if (match) values.push(match[1]);
  }
  return sortedUnique(values);
}

export function parseHermesSourceMapDebugId(source) {
  let map;
  try {
    map = JSON.parse(String(source ?? ''));
  } catch {
    throw new Error('The Hermes source map must be valid JSON.');
  }
  const candidate = String(
    map.debug_id ?? map.debugId ?? map.x_sentry_debug_id ?? map.x_sentry_debugId ?? '',
  ).trim();
  if (!UUID.test(candidate)) {
    throw new Error('The Hermes source map must contain a UUID debug ID.');
  }
  return candidate.toLowerCase();
}

function walkFiles(root) {
  if (!existsSync(root)) return [];
  if (!lstatSync(root).isDirectory()) return [root];
  const files = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) stack.push(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  return files;
}

export function isMachOMagic(value) {
  const buffer = Buffer.from(value ?? []);
  return buffer.length >= 4 && MACH_O_MAGICS.has(buffer.subarray(0, 4).toString('hex'));
}

function isMachO(path) {
  const descriptor = openSync(path, 'r');
  try {
    const prefix = Buffer.alloc(4);
    return readSync(descriptor, prefix, 0, 4, 0) === 4 && isMachOMagic(prefix);
  } finally {
    closeSync(descriptor);
  }
}

export function isBundledSourceMapPath(path) {
  return /(?:\.(?:map|sourcemap)(?:\.|$)|source[-_.]?maps?)/i.test(String(path ?? ''));
}

export function hasInlineSourceMapMarker(source) {
  return /sourceMappingURL\s*=\s*data:/i.test(String(source ?? ''));
}

function containsInlineSourceMap(path) {
  if (!isInlineSourceMapCandidatePath(path)) return false;
  try {
    return hasInlineSourceMapMarker(readFileSync(path, 'utf8'));
  } catch {
    throw new Error('A shipped JavaScript bundle could not be inspected for inline source maps.');
  }
}

export function isInlineSourceMapCandidatePath(path) {
  return /\.(?:js|mjs|cjs|jsbundle|bundle|hbc)$/i.test(String(path ?? ''));
}

function sourceMapDocumentSource(path) {
  const size = statSync(path).size;
  if (size === 0) return '';
  const descriptor = openSync(path, 'r');
  let prefix;
  try {
    prefix = Buffer.alloc(Math.min(size, 64 * 1024));
    const bytes = readSync(descriptor, prefix, 0, prefix.length, 0);
    prefix = prefix.subarray(0, bytes).toString('utf8');
  } finally {
    closeSync(descriptor);
  }
  const first = prefix.replace(/^\uFEFF/, '').match(/\S/)?.[0] ?? '';
  if (!first) {
    if (size > prefix.length) {
      throw new Error('A whitespace-prefixed shipped resource exceeds the inspection prefix.');
    }
    return '';
  }
  if (first !== '{') return '';
  if (size > 128 * 1024 * 1024) {
    throw new Error('A JSON-shaped shipped resource exceeds the source-map inspection ceiling.');
  }
  return readFileSync(path, 'utf8');
}

export function looksLikeSourceMapDocumentPrefix(source) {
  const prefix = String(source ?? '');
  return (
    /^\s*\{/.test(prefix) &&
    /"version"\s*:\s*3\b/.test(prefix) &&
    ((/"sources"\s*:\s*\[/.test(prefix) && /"mappings"\s*:\s*"/.test(prefix)) ||
      /"sections"\s*:\s*\[/.test(prefix))
  );
}

function compressedSourceMapPrefix(path) {
  const size = statSync(path).size;
  if (size === 0) return '';
  const descriptor = openSync(path, 'r');
  let magic;
  try {
    magic = Buffer.alloc(2);
    readSync(descriptor, magic, 0, 2, 0);
  } finally {
    closeSync(descriptor);
  }
  const compression = compressedResourceKind(path, magic);
  if (!compression) return '';
  if (size > 32 * 1024 * 1024) {
    throw new Error('A compressed shipped resource exceeds the source-map inspection ceiling.');
  }
  try {
    const source = readFileSync(path);
    const options = { maxOutputLength: 64 * 1024 * 1024 };
    const expanded =
      compression === 'gzip'
        ? gunzipSync(source, options)
        : compression === 'zlib'
          ? inflateSync(source, options)
          : brotliDecompressSync(source, options);
    return expanded.toString('utf8');
  } catch {
    throw new Error('A compressed shipped resource could not be inspected for source-map content.');
  }
}

export function compressedResourceKind(path, prefix) {
  const magic = Buffer.from(prefix ?? []);
  if (magic.length >= 2 && magic[0] === 0x1f && magic[1] === 0x8b) return 'gzip';
  if (magic.length >= 2 && (magic[0] & 0x0f) === 8 && ((magic[0] << 8) + magic[1]) % 31 === 0) {
    return 'zlib';
  }
  return /\.br$/i.test(String(path ?? '')) ? 'brotli' : '';
}

function containsSourceMapDocument(path) {
  if (isBundledSourceMapPath(path)) return true;
  let source = '';
  try {
    source = sourceMapDocumentSource(path);
  } catch {
    throw new Error('A shipped resource could not be inspected for source-map content.');
  }
  if (looksLikeSourceMapDocumentPrefix(source)) return true;
  return looksLikeSourceMapDocumentPrefix(compressedSourceMapPrefix(path));
}

export function isDsymDwarfPath(path) {
  return /\.dSYM\/Contents\/Resources\/DWARF\/[^/]+$/i.test(
    String(path ?? '').replaceAll('\\', '/'),
  );
}

export function hasUsableDwarfSections(output) {
  const sections = new Map();
  const lines = String(output ?? '').split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const name = lines[index].match(/^\s*sectname\s+(__debug_[A-Za-z0-9_]+)\s*$/)?.[1];
    if (!name) continue;
    for (let offset = index + 1; offset < Math.min(lines.length, index + 8); offset += 1) {
      const size = lines[offset].match(/^\s*size\s+(0x[0-9a-f]+|\d+)\s*$/i)?.[1];
      if (!size) continue;
      sections.set(name, BigInt(size) > 0n);
      break;
    }
  }
  return sections.get('__debug_info') === true && sections.get('__debug_abbrev') === true;
}

function dsymDwarfUuids(root) {
  const files = walkFiles(root).filter(isDsymDwarfPath);
  if (files.length === 0) {
    throw new Error('The dSYM archive contains no canonical DWARF files.');
  }
  for (const path of files) {
    if (!isMachO(path)) throw new Error('A dSYM DWARF file is not Mach-O data.');
    let loadCommands = '';
    try {
      loadCommands = execFileSync('xcrun', ['otool', '-l', path], {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      throw new Error('A dSYM DWARF file failed debug-information inspection.');
    }
    if (!hasUsableDwarfSections(loadCommands)) {
      throw new Error('A dSYM DWARF file contains no usable debug information.');
    }
  }
  return dwarfdumpUuids(files);
}

function dwarfdumpUuids(paths) {
  const uuids = [];
  for (const path of paths) {
    let machO = false;
    try {
      machO = isMachO(path);
    } catch {
      throw new Error('A shipped file could not be inspected for Mach-O identity.');
    }
    if (!machO) continue;
    try {
      const output = execFileSync('xcrun', ['dwarfdump', '--uuid', path], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const extracted = parseDwarfdumpUuidOutput(output);
      if (extracted.length === 0) {
        throw new Error('A detected Mach-O file returned no parseable UUID.');
      }
      uuids.push(...extracted);
    } catch {
      throw new Error('A detected Mach-O file failed UUID extraction.');
    }
  }
  return sortedUnique(uuids);
}

function extractZip(path, destination) {
  try {
    execFileSync('/usr/bin/unzip', ['-qq', path, '-d', destination], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  } catch {
    throw new Error('Signed archive extraction failed.');
  }
}

function materializeArchive(path, workRoot, label) {
  if (lstatSync(path).isDirectory()) return path;
  const destination = join(workRoot, label);
  extractZip(path, destination);
  return destination;
}

function plistValue(path, key) {
  try {
    return execFileSync('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', path], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    throw new Error(`The signed app is missing required ${key} identity.`);
  }
}

export function parseDistributionSignatureDetails(source) {
  const details = String(source ?? '');
  const teamIdentifier = details.match(/^TeamIdentifier=([A-Z0-9]{10})$/m)?.[1] ?? '';
  const distributionAuthority = /^Authority=(?:Apple Distribution|iPhone Distribution):/m.test(
    details,
  );
  return distributionAuthority && teamIdentifier ? { signingTeamIdentifier: teamIdentifier } : null;
}

function plistJsonFromXml(source, label) {
  const text = String(source ?? '');
  const start = text.indexOf('<?xml');
  const plistStart = start >= 0 ? start : text.indexOf('<plist');
  const end = text.indexOf('</plist>', plistStart) + '</plist>'.length;
  if (plistStart < 0 || end < '</plist>'.length) {
    throw new Error(`${label} did not contain a readable property list.`);
  }
  try {
    return JSON.parse(
      execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', '-'], {
        encoding: 'utf8',
        input: text.slice(plistStart, end),
        stdio: ['pipe', 'pipe', 'ignore'],
      }),
    );
  } catch {
    throw new Error(`${label} property list conversion failed.`);
  }
}

function entitlementValueCovered(value, allowed) {
  if (Array.isArray(value)) {
    return (
      Array.isArray(allowed) &&
      value.every((item) => allowed.some((candidate) => entitlementValueCovered(item, candidate)))
    );
  }
  if (value && typeof value === 'object') {
    if (!allowed || typeof allowed !== 'object' || Array.isArray(allowed)) return false;
    return Object.entries(value).every(([key, item]) =>
      entitlementValueCovered(item, allowed[key]),
    );
  }
  return value === allowed;
}

export function validateProvisioningBinding({
  profile,
  appEntitlements,
  bundleIdentifier,
  signingTeamIdentifier,
  now = Date.now(),
}) {
  const errors = [];
  const profileEntitlements = profile?.Entitlements;
  const teams = Array.isArray(profile?.TeamIdentifier) ? profile.TeamIdentifier : [];
  const applicationIdentifier = `${signingTeamIdentifier}.${bundleIdentifier}`;
  if (!teams.includes(signingTeamIdentifier)) {
    errors.push('The provisioning profile team does not match the signing certificate.');
  }
  if (!profileEntitlements || typeof profileEntitlements !== 'object') {
    errors.push('The provisioning profile has no entitlement contract.');
    return errors;
  }
  if (profileEntitlements['application-identifier'] !== applicationIdentifier) {
    errors.push('The provisioning profile application identifier does not match the signed app.');
  }
  if (
    profileEntitlements['com.apple.developer.team-identifier'] !== signingTeamIdentifier ||
    appEntitlements?.['com.apple.developer.team-identifier'] !== signingTeamIdentifier
  ) {
    errors.push('The signed entitlements do not match the Apple team identifier.');
  }
  if (appEntitlements?.['application-identifier'] !== applicationIdentifier) {
    errors.push('The signed application entitlement does not match the bundle identifier.');
  }
  if (
    profileEntitlements['get-task-allow'] === true ||
    appEntitlements?.['get-task-allow'] === true
  ) {
    errors.push('The release app must not permit debugger attachment.');
  }
  if (Array.isArray(profile?.ProvisionedDevices) || profile?.ProvisionsAllDevices === true) {
    errors.push('The release app must use an App Store distribution profile.');
  }
  const expiration = Date.parse(String(profile?.ExpirationDate ?? ''));
  if (!Number.isFinite(expiration) || expiration <= now) {
    errors.push('The provisioning profile is missing, invalid, or expired.');
  }
  if (!appEntitlements || typeof appEntitlements !== 'object') {
    errors.push('The signed app has no readable entitlements.');
  } else {
    for (const [key, value] of Object.entries(appEntitlements)) {
      if (!entitlementValueCovered(value, profileEntitlements[key])) {
        errors.push(`The signed ${key} entitlement is not covered by the provisioning profile.`);
      }
    }
  }
  return errors;
}

function signedAppSignature(infoPlistPath, bundleIdentifier) {
  const appPath = infoPlistPath.replace(/\/Info\.plist$/i, '');
  try {
    execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', appPath], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    const detailsResult = spawnSync('/usr/bin/codesign', ['-dv', '--verbose=4', appPath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (detailsResult.status !== 0) throw new Error('signature details unavailable');
    const signature = parseDistributionSignatureDetails(
      `${detailsResult.stdout ?? ''}\n${detailsResult.stderr ?? ''}`,
    );
    if (!signature) {
      throw new Error('not a distribution signature');
    }
    const requirement =
      `anchor apple generic and certificate 1[field.1.2.840.113635.100.6.2.1] exists ` +
      `and certificate leaf[field.1.2.840.113635.100.6.1.4] exists ` +
      `and certificate leaf[subject.OU] = ${signature.signingTeamIdentifier} ` +
      `and identifier "${bundleIdentifier}"`;
    execFileSync('/usr/bin/codesign', ['--verify', '--strict', `-R=${requirement}`, appPath], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });

    const profileSource = execFileSync(
      '/usr/bin/security',
      ['cms', '-D', '-u', '6', '-i', join(appPath, 'embedded.mobileprovision')],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const entitlementsResult = spawnSync(
      '/usr/bin/codesign',
      ['-d', '--entitlements', ':-', appPath],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    if (entitlementsResult.status !== 0) throw new Error('signed entitlements unavailable');
    const profile = plistJsonFromXml(profileSource, 'The embedded provisioning profile');
    const appEntitlements = plistJsonFromXml(
      `${entitlementsResult.stdout ?? ''}\n${entitlementsResult.stderr ?? ''}`,
      'The signed entitlements',
    );
    const provisioningErrors = validateProvisioningBinding({
      profile,
      appEntitlements,
      bundleIdentifier,
      signingTeamIdentifier: signature.signingTeamIdentifier,
    });
    if (provisioningErrors.length > 0) throw new Error(provisioningErrors.join(' '));
    return { signatureVerified: true, ...signature };
  } catch {
    throw new Error('The root app must have a valid Apple distribution signature.');
  }
}

function signedAppIdentity(appFiles) {
  const normalized = appFiles.map((path) => path.replaceAll('\\', '/'));
  const infoPlists = normalized.filter((path) => /\/Payload\/[^/]+\.app\/Info\.plist$/i.test(path));
  const expoPlists = normalized.filter((path) =>
    /\/Payload\/[^/]+\.app\/(?:Supporting\/)?Expo\.plist$/i.test(path),
  );
  const extensionInfoPlists = normalized.filter((path) => /\.appex\/Info\.plist$/i.test(path));
  if (infoPlists.length !== 1)
    throw new Error('The IPA must contain exactly one root app Info.plist.');
  if (expoPlists.length !== 1) throw new Error('The IPA must contain exactly one root Expo.plist.');
  const bundleIdentifier = plistValue(infoPlists[0], 'CFBundleIdentifier');
  const signature = signedAppSignature(infoPlists[0], bundleIdentifier);
  for (const extensionInfoPlist of extensionInfoPlists) {
    const extensionBundleIdentifier = plistValue(extensionInfoPlist, 'CFBundleIdentifier');
    const extensionSignature = signedAppSignature(extensionInfoPlist, extensionBundleIdentifier);
    if (extensionSignature.signingTeamIdentifier !== signature.signingTeamIdentifier) {
      throw new Error('Every signed app extension must use the root app signing team.');
    }
  }
  return {
    ...signature,
    bundleIdentifier,
    appVersion: plistValue(infoPlists[0], 'CFBundleShortVersionString'),
    buildNumber: plistValue(infoPlists[0], 'CFBundleVersion'),
    runtimeVersion: plistValue(expoPlists[0], 'EXUpdatesRuntimeVersion'),
  };
}

export function inspectIosArtifactIdentities({ iosArtifactPath, dsymArchivePath, sourceMapPath }) {
  if (process.platform !== 'darwin') {
    throw new Error('Exact iOS UUID verification must run on a macOS release host.');
  }
  for (const [label, path] of [
    ['iOS artifact', iosArtifactPath],
    ['dSYM archive', dsymArchivePath],
    ['Hermes source map', sourceMapPath],
  ]) {
    if (!path || !existsSync(path)) throw new Error(`${label} is missing.`);
  }

  const workRoot = mkdtempSync(join(tmpdir(), 'onskin-ios-symbols-'));
  try {
    const appRoot = materializeArchive(iosArtifactPath, workRoot, 'ipa');
    const dsymRoot = materializeArchive(dsymArchivePath, workRoot, 'dsym');
    const appFiles = walkFiles(appRoot);
    const appIdentity = signedAppIdentity(appFiles);
    const binaryUuids = dwarfdumpUuids(appFiles);
    const dsymUuids = dsymDwarfUuids(dsymRoot);
    if (binaryUuids.length === 0) {
      throw new Error('No Mach-O UUIDs were extracted from the iOS artifact.');
    }
    if (dsymUuids.length === 0) {
      throw new Error('No Mach-O UUIDs were extracted from the dSYM archive.');
    }
    let sourceMapSource = '';
    try {
      sourceMapSource = readFileSync(sourceMapPath, 'utf8');
    } catch {
      throw new Error('The Hermes source map could not be read.');
    }
    return {
      binaryUuids,
      dsymUuids,
      ...appIdentity,
      hermesDebugId: parseHermesSourceMapDebugId(sourceMapSource),
      bundledSourceMapCount: appFiles.filter(
        (path) => containsSourceMapDocument(path) || containsInlineSourceMap(path),
      ).length,
    };
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
}

function normalizedJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const iosArtifactPath = String(process.env.PHASE9_IOS_ARTIFACT ?? '').trim();
  const dsymArchivePath = String(process.env.PHASE9_IOS_DSYM_ARCHIVE ?? '').trim();
  const sourceMapPath = String(process.env.PHASE9_IOS_HERMES_SOURCE_MAP ?? '').trim();
  const binaryOut = String(process.env.PHASE9_IOS_BINARY_UUID_EVIDENCE ?? '').trim();
  const dsymOut = String(process.env.PHASE9_IOS_DSYM_UUID_EVIDENCE ?? '').trim();
  const hermesOut = String(process.env.PHASE9_IOS_HERMES_DEBUG_ID_EVIDENCE ?? '').trim();
  if (!binaryOut || !dsymOut || !hermesOut) {
    console.error('FAIL Set all three PHASE9_IOS_*_EVIDENCE output paths.');
    process.exit(1);
  }
  try {
    const result = inspectIosArtifactIdentities({
      iosArtifactPath,
      dsymArchivePath,
      sourceMapPath,
    });
    writeFileSync(
      binaryOut,
      normalizedJson({ schemaVersion: 1, kind: 'ios_binary_uuids', uuids: result.binaryUuids }),
    );
    writeFileSync(
      dsymOut,
      normalizedJson({ schemaVersion: 1, kind: 'ios_dsym_uuids', uuids: result.dsymUuids }),
    );
    writeFileSync(
      hermesOut,
      normalizedJson({
        schemaVersion: 1,
        kind: 'ios_hermes_debug_id',
        uuid: result.hermesDebugId,
      }),
    );
    console.log(
      `Captured ${result.binaryUuids.length} binary UUIDs, ${result.dsymUuids.length} dSYM UUIDs, one Hermes debug ID, and ${result.bundledSourceMapCount} bundled source maps.`,
    );
  } catch (error) {
    console.error(
      `FAIL ${error instanceof Error ? error.message : 'iOS artifact inspection failed.'}`,
    );
    process.exit(1);
  }
}
