#!/usr/bin/env node
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

const FONT_EXTENSIONS = new Set(['.otf', '.ttf', '.woff', '.woff2']);
const HERMES_EXTENSIONS = new Set(['.hbc', '.hermes']);
const JAVASCRIPT_BUNDLE_EXTENSIONS = new Set(['.bundle', '.js']);
const SUPPORTED_PLATFORMS = new Set(['android', 'ios', 'web']);
const CONTROL_CHARACTER_RE = /[\u0000-\u001f\u007f]/;

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
    schemaVersion: 1,
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
