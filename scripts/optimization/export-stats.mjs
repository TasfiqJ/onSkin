#!/usr/bin/env node
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FONT_EXTENSIONS = new Set(['.otf', '.ttf', '.woff', '.woff2']);
const HERMES_EXTENSIONS = new Set(['.hbc', '.hermes']);
const JAVASCRIPT_BUNDLE_EXTENSIONS = new Set(['.bundle', '.js']);
const SUPPORTED_PLATFORMS = new Set(['android', 'ios', 'web']);
const CONTROL_CHARACTER_RE = /[\u0000-\u001f\u007f]/;
const NPM_PACKAGE_SEGMENT_RE = /^[a-z0-9][a-z0-9._~-]{0,213}$/i;
const SOURCE_GROUP_LIMIT = 50;
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const SOURCE_MAP_BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const SOURCE_MAP_BASE64_VALUES = new Map(
  [...SOURCE_MAP_BASE64_ALPHABET].map((character, index) => [character, index]),
);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/optimization/export-stats.mjs \\',
    '    --input <expo-export-directory> --platform <ios|android|web> \\',
    '    [--generated-at <ISO-8601>] [--source-sha <git-sha>] \\',
    '    [--json <path|->] [--markdown <path|->]',
    '',
    'Metadata may instead be supplied with OPTIMIZATION_GENERATED_AT and',
    'OPTIMIZATION_SOURCE_SHA (GITHUB_SHA is also accepted for the source SHA).',
    'When neither output flag is supplied, JSON is printed to stdout.',
  ].join('\n');
}

function fail(message) {
  throw new Error(message);
}

function parseArguments(argv) {
  const options = {};
  const valueFlags = new Map([
    ['--generated-at', 'generatedAt'],
    ['--input', 'input'],
    ['--json', 'json'],
    ['--markdown', 'markdown'],
    ['--platform', 'platform'],
    ['--source-sha', 'sourceSha'],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    const key = valueFlags.get(argument);
    if (!key) fail(`Unknown argument: ${argument}`);
    const value = argv[index + 1];
    if (value === undefined || (value.startsWith('--') && value !== '-')) {
      fail(`${argument} requires a value.`);
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

function canonicalGeneratedAt(value) {
  if (!value) {
    fail('A generated timestamp is required via --generated-at or OPTIMIZATION_GENERATED_AT.');
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) fail('The generated timestamp must be valid ISO-8601.');
  return new Date(milliseconds).toISOString();
}

function canonicalSourceSha(value) {
  const sourceSha = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!/^[0-9a-f]{7,64}$/.test(sourceSha)) {
    fail('A hexadecimal source SHA is required via --source-sha or OPTIMIZATION_SOURCE_SHA.');
  }
  return sourceSha;
}

function isWithin(parentPath, candidatePath) {
  const pathFromParent = relative(parentPath, candidatePath);
  return pathFromParent === '' || (!pathFromParent.startsWith('..') && !isAbsolute(pathFromParent));
}

function validateRelativePath(path) {
  if (
    !path ||
    isAbsolute(path) ||
    path.includes('\\') ||
    path.split('/').includes('..') ||
    CONTROL_CHARACTER_RE.test(path)
  ) {
    fail('The export contains an unsafe file path.');
  }
}

function collectFiles(inputRoot, currentDirectory = inputRoot, prefix = '') {
  const entries = readdirSync(currentDirectory, { withFileTypes: true }).sort((left, right) =>
    compareText(left.name, right.name),
  );
  const files = [];

  for (const entry of entries) {
    if (CONTROL_CHARACTER_RE.test(entry.name)) fail('The export contains an unsafe file path.');
    const absolutePath = resolve(currentDirectory, entry.name);
    if (!isWithin(inputRoot, absolutePath)) fail('The export contains an unsafe file path.');

    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    validateRelativePath(relativePath);

    const filesystemEntry = lstatSync(absolutePath);
    if (filesystemEntry.isSymbolicLink()) {
      fail('Symbolic links are not supported in an export directory.');
    }
    if (filesystemEntry.isDirectory()) {
      files.push(...collectFiles(inputRoot, absolutePath, relativePath));
      continue;
    }
    if (!filesystemEntry.isFile()) fail('The export contains an unsupported filesystem entry.');

    files.push({
      absolutePath,
      path: relativePath,
      bytes: filesystemEntry.size,
    });
  }

  return files;
}

function lowerExtension(path) {
  return extname(path).toLowerCase() || '<none>';
}

function isSourceMap(file) {
  return lowerExtension(file.path) === '.map';
}

function safePackageName(segments, nodeModulesIndex) {
  const firstSegment = segments[nodeModulesIndex + 1];
  if (!firstSegment) return null;

  if (firstSegment.startsWith('@')) {
    const secondSegment = segments[nodeModulesIndex + 2];
    if (
      !NPM_PACKAGE_SEGMENT_RE.test(firstSegment.slice(1)) ||
      !NPM_PACKAGE_SEGMENT_RE.test(secondSegment ?? '')
    ) {
      return null;
    }
    return `${firstSegment}/${secondSegment}`.toLowerCase();
  }

  return NPM_PACKAGE_SEGMENT_RE.test(firstSegment) ? firstSegment.toLowerCase() : null;
}

function checkedInPackageNames() {
  let lockfile;
  try {
    lockfile = JSON.parse(
      readFileSync(resolve(SCRIPT_DIRECTORY, '../../package-lock.json'), 'utf8'),
    );
  } catch {
    fail('The checked-in package lock is unavailable or invalid.');
  }
  if (!lockfile?.packages || typeof lockfile.packages !== 'object') {
    fail('The checked-in package lock has no package inventory.');
  }

  const packageNames = new Set();
  for (const packagePath of Object.keys(lockfile.packages)) {
    const match = packagePath
      .replaceAll('\\', '/')
      .match(/(?:^|\/)node_modules\/(@[^/]+\/[^/]+|[^/]+)$/u);
    if (!match) continue;
    const packageName = match[1].toLowerCase();
    const parts = packageName.split('/');
    const isValid =
      parts.length === 1
        ? NPM_PACKAGE_SEGMENT_RE.test(parts[0])
        : parts.length === 2 &&
          parts[0].startsWith('@') &&
          NPM_PACKAGE_SEGMENT_RE.test(parts[0].slice(1)) &&
          NPM_PACKAGE_SEGMENT_RE.test(parts[1]);
    if (isValid) packageNames.add(packageName);
  }
  if (packageNames.size === 0) fail('The checked-in package inventory is empty.');
  return packageNames;
}

function isAbsoluteSource(source) {
  return (
    source.startsWith('/') ||
    source.startsWith('\\') ||
    /^[a-z]:[\\/]/iu.test(source) ||
    /^[a-z][a-z0-9+.-]*:\/\//iu.test(source)
  );
}

function canonicalSourceIdentity(sourceRoot, source) {
  const rawPath = sourceRoot && !isAbsoluteSource(source) ? `${sourceRoot}/${source}` : source;
  const slashPath = rawPath.replaceAll('\\', '/').replace(/^(?:webpack|file):\/\/(?:\/)?/iu, '/');
  const prefix = slashPath.startsWith('/') ? '/' : '';
  const segments = [];
  for (const segment of slashPath.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return `${prefix}${segments.join('/')}`;
}

function sourceGroup(sourceRoot, source, packageNames) {
  if (source.startsWith('\0polyfill:')) return 'virtual:metro-polyfill';
  const rawPath = sourceRoot && !isAbsoluteSource(source) ? `${sourceRoot}/${source}` : source;
  if (CONTROL_CHARACTER_RE.test(rawPath)) return 'unattributed:unsafe';

  const slashPath = rawPath.replaceAll('\\', '/');
  const isWebpackOrFileUrl = /^(?:webpack|file):\/\//iu.test(slashPath);
  const isOtherUri = /^[a-z][a-z0-9+.-]*:\/\//iu.test(slashPath) && !isWebpackOrFileUrl;
  if (isOtherUri) return 'unattributed:uri';
  const isExternalPath =
    slashPath.startsWith('/') ||
    slashPath.startsWith('//') ||
    /^[a-z]:\//iu.test(slashPath) ||
    /^file:\/\//iu.test(slashPath);
  const combinedPath = slashPath
    .replace(/^(?:webpack|file):\/\/(?:\/)?/iu, '/')
    .replace(/[?#].*$/u, '');
  const segments = combinedPath
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.' && segment !== '..');
  const lowerSegments = segments.map((segment) => segment.toLowerCase());

  for (let index = lowerSegments.length - 1; index >= 0; index -= 1) {
    if (lowerSegments[index] !== 'node_modules') continue;
    const packageName = safePackageName(segments, index);
    if (packageName) {
      return packageNames.has(packageName) ? `npm:${packageName}` : 'unattributed:npm';
    }
  }

  const appsIndex = lowerSegments.findIndex(
    (segment, index) => segment === 'apps' && lowerSegments[index + 1] === 'mobile',
  );
  const mobileSourceIndex =
    appsIndex >= 0
      ? lowerSegments.findIndex((segment, index) => index > appsIndex + 1 && segment === 'src')
      : lowerSegments[0] === 'src'
        ? 0
        : -1;

  if (mobileSourceIndex >= 0) {
    const sourceArea = lowerSegments[mobileSourceIndex + 1];
    if (sourceArea === 'app') return 'workspace:mobile/app';
    if (sourceArea === 'components') return 'workspace:mobile/components';
    if (sourceArea === 'features') return 'workspace:mobile/features';
    if (sourceArea === 'lib') return 'workspace:mobile/lib';
    if (sourceArea === 'theme') return 'workspace:mobile/theme';
    return 'workspace:mobile/other';
  }

  const packagesIndex = lowerSegments.findIndex((segment) => segment === 'packages');
  if (packagesIndex >= 0) {
    return lowerSegments[packagesIndex + 1] === 'types'
      ? 'workspace:packages/types'
      : 'workspace:packages/other';
  }

  return isExternalPath ? 'unattributed:external' : 'unattributed:relative';
}

function decodeVlqSegment(segment) {
  if (segment.length === 0) fail('SOURCE_MAP_INVALID_STRUCTURE');

  const values = [];
  let cursor = 0;
  while (cursor < segment.length) {
    let encodedValue = 0;
    let placeValue = 1;
    let continuation = true;

    while (continuation) {
      if (cursor >= segment.length) fail('SOURCE_MAP_INVALID_STRUCTURE');
      const digit = SOURCE_MAP_BASE64_VALUES.get(segment[cursor]);
      cursor += 1;
      if (digit === undefined) fail('SOURCE_MAP_INVALID_STRUCTURE');

      continuation = (digit & 32) !== 0;
      encodedValue += (digit & 31) * placeValue;
      if (!Number.isSafeInteger(encodedValue)) fail('SOURCE_MAP_LIMIT_EXCEEDED');
      placeValue *= 32;
      if (!Number.isSafeInteger(placeValue)) fail('SOURCE_MAP_LIMIT_EXCEEDED');
    }

    const magnitude = Math.floor(encodedValue / 2);
    values.push((encodedValue & 1) === 1 ? -magnitude : magnitude);
  }
  return values;
}

function referencedSourceIndexes(sourceMap) {
  const referenced = new Set();
  let sourceIndex = 0;
  let originalLine = 0;
  let originalColumn = 0;
  let nameIndex = 0;
  const names =
    sourceMap.names === undefined
      ? []
      : Array.isArray(sourceMap.names) && sourceMap.names.every((name) => typeof name === 'string')
        ? sourceMap.names
        : null;
  if (names === null) fail('SOURCE_MAP_INVALID_STRUCTURE');

  for (const generatedLine of sourceMap.mappings.split(';')) {
    if (generatedLine === '') continue;
    let generatedColumn = 0;

    for (const rawSegment of generatedLine.split(',')) {
      const values = decodeVlqSegment(rawSegment);
      if (values.length !== 1 && values.length !== 4 && values.length !== 5) {
        fail('SOURCE_MAP_INVALID_STRUCTURE');
      }

      generatedColumn += values[0];
      if (!Number.isSafeInteger(generatedColumn) || generatedColumn < 0) {
        fail('SOURCE_MAP_INVALID_STRUCTURE');
      }
      if (values.length === 1) continue;

      sourceIndex += values[1];
      originalLine += values[2];
      originalColumn += values[3];
      if (
        !Number.isSafeInteger(sourceIndex) ||
        !Number.isSafeInteger(originalLine) ||
        !Number.isSafeInteger(originalColumn) ||
        sourceIndex < 0 ||
        sourceIndex >= sourceMap.sources.length ||
        originalLine < 0 ||
        originalColumn < 0
      ) {
        fail('SOURCE_MAP_INVALID_STRUCTURE');
      }
      referenced.add(sourceIndex);

      if (values.length === 5) {
        nameIndex += values[4];
        if (!Number.isSafeInteger(nameIndex) || nameIndex < 0 || nameIndex >= names.length) {
          fail('SOURCE_MAP_INVALID_STRUCTURE');
        }
      }
    }
  }
  return referenced;
}

function parseSourceMap(file) {
  if (file.bytes > 128 * 1024 * 1024) fail('SOURCE_MAP_TOO_LARGE');

  let sourceMap;
  try {
    sourceMap = JSON.parse(readFileSync(file.absolutePath, 'utf8'));
  } catch {
    fail('SOURCE_MAP_INVALID_JSON');
  }

  if (!sourceMap || typeof sourceMap !== 'object' || Array.isArray(sourceMap)) {
    fail('SOURCE_MAP_INVALID_STRUCTURE');
  }
  if (sourceMap.version !== 3) fail('SOURCE_MAP_UNSUPPORTED_VERSION');
  if (sourceMap.sections !== undefined) fail('SOURCE_MAP_INDEX_UNSUPPORTED');
  if (
    sourceMap.sourceRoot !== undefined &&
    sourceMap.sourceRoot !== null &&
    (typeof sourceMap.sourceRoot !== 'string' ||
      sourceMap.sourceRoot.length > 32_768 ||
      CONTROL_CHARACTER_RE.test(sourceMap.sourceRoot))
  ) {
    fail('SOURCE_MAP_INVALID_STRUCTURE');
  }
  if (
    !Array.isArray(sourceMap.sources) ||
    sourceMap.sources.length > 50_000 ||
    !sourceMap.sources.every(
      (source) => typeof source === 'string' && source.length > 0 && source.length <= 32_768,
    ) ||
    typeof sourceMap.mappings !== 'string'
  ) {
    fail('SOURCE_MAP_INVALID_STRUCTURE');
  }
  if (
    !Array.isArray(sourceMap.sourcesContent) ||
    sourceMap.sourcesContent.length !== sourceMap.sources.length ||
    !sourceMap.sourcesContent.every((content) => typeof content === 'string')
  ) {
    fail('SOURCE_MAP_CONTENT_UNAVAILABLE');
  }
  const referencedSources = referencedSourceIndexes(sourceMap);
  if (referencedSources.size === 0) fail('SOURCE_MAP_CONTENT_UNAVAILABLE');
  if (referencedSources.size !== sourceMap.sources.length) {
    fail('SOURCE_MAP_COVERAGE_INCOMPLETE');
  }

  return {
    referencedSourceCount: referencedSources.size,
    sourceRoot: sourceMap.sourceRoot ?? '',
    sources: sourceMap.sources,
    sourcesContent: sourceMap.sourcesContent,
  };
}

function sourceMapAttribution(sourceMaps) {
  if (sourceMaps.length === 0) {
    fail('SOURCE_MAP_REQUIRED');
  }

  const packageNames = checkedInPackageNames();
  const groups = new Map();
  const uniqueSources = new Set();
  let sourceOccurrenceCount = 0;
  let referencedSourceCount = 0;
  let totalSourceContentBytes = 0;

  for (const sourceMap of sourceMaps) {
    const parsed = parseSourceMap(sourceMap);
    referencedSourceCount += parsed.referencedSourceCount;
    for (let index = 0; index < parsed.sources.length; index += 1) {
      const source = parsed.sources[index];
      const content = parsed.sourcesContent[index];
      const contentBytes = Buffer.byteLength(content);
      const groupName = sourceGroup(parsed.sourceRoot, source, packageNames);
      const fingerprint = createHash('sha256')
        .update(canonicalSourceIdentity(parsed.sourceRoot, source))
        .update('\0')
        .update(content)
        .digest('hex');
      const group = groups.get(groupName) ?? {
        group: groupName,
        sourceOccurrenceCount: 0,
        sourceContentBytes: 0,
        uniqueSources: new Set(),
      };

      sourceOccurrenceCount += 1;
      totalSourceContentBytes += contentBytes;
      uniqueSources.add(fingerprint);
      group.sourceOccurrenceCount += 1;
      group.sourceContentBytes += contentBytes;
      group.uniqueSources.add(fingerprint);
      groups.set(groupName, group);
    }
  }

  if (sourceOccurrenceCount === 0) fail('SOURCE_MAP_CONTENT_UNAVAILABLE');
  if (
    !Number.isSafeInteger(sourceOccurrenceCount) ||
    !Number.isSafeInteger(totalSourceContentBytes)
  ) {
    fail('SOURCE_MAP_LIMIT_EXCEEDED');
  }

  const allGroups = [...groups.values()]
    .map(
      ({
        group,
        sourceOccurrenceCount: occurrences,
        sourceContentBytes,
        uniqueSources: unique,
      }) => ({
        group,
        sourceOccurrenceCount: occurrences,
        uniqueSourceCount: unique.size,
        sourceContentBytes,
      }),
    )
    .sort(
      (left, right) =>
        right.sourceContentBytes - left.sourceContentBytes ||
        right.sourceOccurrenceCount - left.sourceOccurrenceCount ||
        compareText(left.group, right.group),
    );
  const unattributedGroups = allGroups.filter((group) => group.group.startsWith('unattributed:'));
  const reportedGroups = allGroups.slice(0, SOURCE_GROUP_LIMIT);
  const reportedSourceContentBytes = sum(reportedGroups, (group) => group.sourceContentBytes);
  const unattributedSourceContentBytes = sum(
    unattributedGroups,
    (group) => group.sourceContentBytes,
  );

  return {
    basis: 'utf8_sources_content',
    complete: true,
    mapCount: sourceMaps.length,
    sourceOccurrenceCount,
    referencedSourceCount,
    uniqueSourceCount: uniqueSources.size,
    sourceContentBytes: totalSourceContentBytes,
    totalGroupCount: allGroups.length,
    reportedGroupCount: reportedGroups.length,
    omittedGroupCount: allGroups.length - reportedGroups.length,
    reportedSourceContentBytes,
    omittedSourceContentBytes: totalSourceContentBytes - reportedSourceContentBytes,
    unattributedSourceCount: sum(unattributedGroups, (group) => group.sourceOccurrenceCount),
    unattributedSourceContentBytes,
    groups: reportedGroups,
  };
}

function validateSourceMapCoverage(bundleFiles, sourceMaps) {
  const bundlePaths = new Set(bundleFiles.map((file) => file.path));
  const sourceMapPaths = new Set(sourceMaps.map((file) => file.path));
  if (
    bundleFiles.some((bundle) => !sourceMapPaths.has(`${bundle.path}.map`)) ||
    sourceMaps.some((sourceMap) => !bundlePaths.has(sourceMap.path.slice(0, -4)))
  ) {
    fail('SOURCE_MAP_COVERAGE_INCOMPLETE');
  }
}

function bundleKind(file) {
  const extension = lowerExtension(file.path);
  if (HERMES_EXTENSIONS.has(extension)) return 'hermes';
  if (JAVASCRIPT_BUNDLE_EXTENSIONS.has(extension)) return 'javascript';
  return null;
}

function isAsset(file) {
  return file.path === 'assets' || file.path.startsWith('assets/');
}

function assetExtensionIndex(files) {
  const assetMapFile = files.find((file) => file.path === 'assetmap.json');
  if (!assetMapFile) return new Map();

  let assetMap;
  try {
    assetMap = JSON.parse(readFileSync(assetMapFile.absolutePath, 'utf8'));
  } catch {
    fail('The Expo asset map is not valid JSON.');
  }
  if (!assetMap || typeof assetMap !== 'object' || Array.isArray(assetMap)) {
    fail('The Expo asset map must be a JSON object.');
  }

  const index = new Map();
  for (const asset of Object.values(assetMap)) {
    if (!asset || typeof asset !== 'object' || Array.isArray(asset)) continue;
    const rawType = typeof asset.type === 'string' ? asset.type.trim().toLowerCase() : '';
    if (!/^[a-z0-9]{1,16}$/.test(rawType) || !Array.isArray(asset.fileHashes)) continue;
    const extension = `.${rawType}`;

    for (const rawHash of asset.fileHashes) {
      const hash = typeof rawHash === 'string' ? rawHash.trim().toLowerCase() : '';
      if (!/^[0-9a-f]{16,128}$/.test(hash)) continue;
      const assetPath = `assets/${hash}`;
      const previousExtension = index.get(assetPath);
      if (previousExtension && previousExtension !== extension) {
        fail('The Expo asset map assigns conflicting types to one exported asset.');
      }
      index.set(assetPath, extension);
    }
  }
  return index;
}

function assetExtension(file, extensionIndex) {
  const filesystemExtension = lowerExtension(file.path);
  return filesystemExtension === '<none>'
    ? (extensionIndex.get(file.path) ?? filesystemExtension)
    : filesystemExtension;
}

function compressionStats(file) {
  const bytes = readFileSync(file.absolutePath);
  return {
    gzipBytes: gzipSync(bytes, { level: 9 }).length,
    brotliBytes: brotliCompressSync(bytes, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
      },
    }).length,
  };
}

function sum(items, select) {
  return items.reduce((total, item) => total + select(item), 0);
}

function buildStats({ files, generatedAt, platform, sourceSha }) {
  const sortedFiles = [...files].sort((left, right) => compareText(left.path, right.path));
  const sourceMaps = sortedFiles.filter(isSourceMap);
  const bundleFiles = sortedFiles
    .map((file) => ({ file, kind: bundleKind(file) }))
    .filter(({ kind }) => kind !== null)
    .map(({ file, kind }) => ({
      path: file.path,
      kind,
      bytes: file.bytes,
      ...compressionStats(file),
    }));
  validateSourceMapCoverage(bundleFiles, sourceMaps);
  const sourceAttribution = sourceMapAttribution(sourceMaps);
  const javascriptBundles = bundleFiles.filter((bundle) => bundle.kind === 'javascript');
  const hermesBundles = bundleFiles.filter((bundle) => bundle.kind === 'hermes');
  const assetFiles = sortedFiles.filter(isAsset);
  const extensionIndex = assetExtensionIndex(sortedFiles);
  const assetsByExtension = new Map();

  for (const asset of assetFiles) {
    const extension = assetExtension(asset, extensionIndex);
    const group = assetsByExtension.get(extension) ?? { extension, count: 0, bytes: 0 };
    group.count += 1;
    group.bytes += asset.bytes;
    assetsByExtension.set(extension, group);
  }

  const fontFiles = assetFiles.filter((file) =>
    FONT_EXTENSIONS.has(assetExtension(file, extensionIndex)),
  );
  const largestFiles = [...sortedFiles]
    .sort((left, right) => right.bytes - left.bytes || compareText(left.path, right.path))
    .slice(0, 50)
    .map(({ path, bytes }) => ({ path, bytes }));

  return {
    schemaVersion: 2,
    platform,
    generatedAt,
    sourceSha,
    files: {
      totalCount: sortedFiles.length,
      totalBytes: sum(sortedFiles, (file) => file.bytes),
    },
    bundles: {
      count: bundleFiles.length,
      bytes: sum(bundleFiles, (bundle) => bundle.bytes),
      gzipBytes: sum(bundleFiles, (bundle) => bundle.gzipBytes),
      brotliBytes: sum(bundleFiles, (bundle) => bundle.brotliBytes),
      javascript: {
        count: javascriptBundles.length,
        bytes: sum(javascriptBundles, (bundle) => bundle.bytes),
      },
      hermes: {
        count: hermesBundles.length,
        bytes: sum(hermesBundles, (bundle) => bundle.bytes),
      },
      files: bundleFiles,
    },
    sourceMaps: {
      shipped: false,
      count: sourceMaps.length,
      bytes: sum(sourceMaps, (file) => file.bytes),
      files: sourceMaps.map(({ path, bytes }) => ({ path, bytes })),
    },
    sourceGroups: sourceAttribution,
    assets: {
      count: assetFiles.length,
      bytes: sum(assetFiles, (file) => file.bytes),
      byExtension: [...assetsByExtension.values()].sort((left, right) =>
        compareText(left.extension, right.extension),
      ),
    },
    fonts: {
      count: fontFiles.length,
      bytes: sum(fontFiles, (file) => file.bytes),
      files: fontFiles.map(({ path, bytes }) => ({ path, bytes })),
    },
    largestFiles,
  };
}

function markdownCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\r', '').replaceAll('\n', ' ');
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.map(markdownCell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(markdownCell).join(' | ')} |`),
  ].join('\n');
}

function renderMarkdown(stats) {
  const assetRows = stats.assets.byExtension.map((group) => [
    `\`${group.extension}\``,
    group.count,
    group.bytes,
  ]);
  const fontRows = stats.fonts.files.map((file) => [`\`${file.path}\``, file.bytes]);
  const largestRows = stats.largestFiles.map((file, index) => [
    index + 1,
    `\`${file.path}\``,
    file.bytes,
  ]);
  const largestSourceGroupRows = stats.sourceGroups.groups.map((group, index) => [
    index + 1,
    `\`${group.group}\``,
    group.sourceOccurrenceCount,
    group.uniqueSourceCount,
    group.sourceContentBytes,
  ]);

  return `${[
    '# Expo Export Statistics',
    '',
    `- Platform: \`${stats.platform}\``,
    `- Generated at: \`${stats.generatedAt}\``,
    `- Source SHA: \`${stats.sourceSha}\``,
    `- Total files / bytes: ${stats.files.totalCount} / ${stats.files.totalBytes}`,
    '',
    '## Bundles',
    '',
    markdownTable(
      ['Kind', 'Count', 'Uncompressed bytes'],
      [
        ['JavaScript', stats.bundles.javascript.count, stats.bundles.javascript.bytes],
        ['Hermes', stats.bundles.hermes.count, stats.bundles.hermes.bytes],
        ['Total', stats.bundles.count, stats.bundles.bytes],
      ],
    ),
    '',
    `- Gzip bytes (sum of bundles): ${stats.bundles.gzipBytes}`,
    `- Brotli bytes (sum of bundles): ${stats.bundles.brotliBytes}`,
    '',
    '## Source Maps',
    '',
    '- Shipped: no',
    `- Files / bytes: ${stats.sourceMaps.count} / ${stats.sourceMaps.bytes}`,
    `- Source occurrences / referenced / unique sources: ${stats.sourceGroups.sourceOccurrenceCount} / ${stats.sourceGroups.referencedSourceCount} / ${stats.sourceGroups.uniqueSourceCount}`,
    `- UTF-8 source-content bytes: ${stats.sourceGroups.sourceContentBytes}`,
    `- Source groups: ${stats.sourceGroups.totalGroupCount}`,
    `- Unattributed source occurrences: ${stats.sourceGroups.unattributedSourceCount}`,
    `- Reported / omitted groups: ${stats.sourceGroups.reportedGroupCount} / ${stats.sourceGroups.omittedGroupCount}`,
    `- Reported / omitted source-content bytes: ${stats.sourceGroups.reportedSourceContentBytes} / ${stats.sourceGroups.omittedSourceContentBytes}`,
    '',
    '## Largest 50 Mapped Source Groups',
    '',
    'Source-content bytes identify investigation targets; they do not equal generated JavaScript or Hermes bytecode bytes.',
    '',
    largestSourceGroupRows.length
      ? markdownTable(
          ['Rank', 'Source group', 'Occurrences', 'Unique sources', 'Source-content bytes'],
          largestSourceGroupRows,
        )
      : 'No attributable mapped sources were found.',
    '',
    '## Assets by Extension',
    '',
    assetRows.length
      ? markdownTable(['Extension', 'Count', 'Bytes'], assetRows)
      : 'No exported asset files were found.',
    '',
    '## Font Asset Manifest',
    '',
    `- Font files / bytes: ${stats.fonts.count} / ${stats.fonts.bytes}`,
    '',
    fontRows.length ? markdownTable(['File', 'Bytes'], fontRows) : 'No font assets were found.',
    '',
    '## Largest 50 Files',
    '',
    largestRows.length
      ? markdownTable(['Rank', 'File', 'Bytes'], largestRows)
      : 'The export directory is empty.',
    '',
  ].join('\n')}\n`;
}

function validateOptions(options) {
  if (!options.input) fail('--input is required.');
  if (!options.platform || !SUPPORTED_PLATFORMS.has(options.platform)) {
    fail('--platform must be one of: ios, android, web.');
  }

  const inputRoot = resolve(options.input);
  if (!existsSync(inputRoot) || !lstatSync(inputRoot).isDirectory()) {
    fail('--input must reference an existing export directory.');
  }
  if (lstatSync(inputRoot).isSymbolicLink()) {
    fail('--input must not be a symbolic link.');
  }

  const outputValues = [options.json, options.markdown].filter(
    (value) => value !== undefined && value !== '-',
  );
  const outputPaths = outputValues.map((value) => resolve(value));
  if (new Set(outputPaths).size !== outputPaths.length) {
    fail('--json and --markdown must use different output paths.');
  }
  if (outputPaths.some((path) => isWithin(inputRoot, path))) {
    fail('Statistics outputs must be outside the export directory.');
  }
  if (options.json === '-' && options.markdown === '-') {
    fail('Only one output format can be written to stdout.');
  }

  return {
    inputRoot,
    generatedAt: canonicalGeneratedAt(options.generatedAt ?? process.env.OPTIMIZATION_GENERATED_AT),
    sourceSha: canonicalSourceSha(
      options.sourceSha ?? process.env.OPTIMIZATION_SOURCE_SHA ?? process.env.GITHUB_SHA,
    ),
  };
}

function writeOutput(path, content) {
  if (path === '-') {
    process.stdout.write(content);
    return;
  }
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(resolve(path), content, 'utf8');
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const validated = validateOptions(options);
  const stats = buildStats({
    files: collectFiles(validated.inputRoot),
    generatedAt: validated.generatedAt,
    platform: options.platform,
    sourceSha: validated.sourceSha,
  });
  const json = `${JSON.stringify(stats, null, 2)}\n`;
  const markdown = renderMarkdown(stats);

  if (options.json === undefined && options.markdown === undefined) {
    process.stdout.write(json);
    return;
  }
  if (options.json !== undefined) writeOutput(options.json, json);
  if (options.markdown !== undefined) writeOutput(options.markdown, markdown);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown export analysis failure.';
  console.error(`Export stats failed: ${message}`);
  process.exitCode = 1;
}
