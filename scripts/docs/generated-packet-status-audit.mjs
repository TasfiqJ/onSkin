#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const check = process.argv.includes('--check');
const packagePath = 'package.json';
const generatedRoots = [
  'docs/phase-3/generated',
  'docs/phase-4/generated',
  'docs/phase-5/generated',
  'docs/phase-6/generated',
  'docs/phase-7/generated',
  'docs/phase-8/generated',
  'docs/phase-9/generated',
  'docs/phase-10/generated',
  'docs/phase-11/generated',
];
const outJson =
  process.env.GENERATED_PACKET_STATUS_AUDIT_JSON ??
  'docs/generated/generated-packet-status-audit.json';
const outMd =
  process.env.GENERATED_PACKET_STATUS_AUDIT_MD ??
  'docs/generated/generated-packet-status-audit.md';

const requiredPackageScripts = [
  'docs:generated-packet-status-audit',
  'docs:generated-packet-status-audit:strict',
  'docs:generated-packet-status-audit:check',
];

const dirtyTextPatterns = [
  /dirty Git worktree/i,
  /Git status:\s*DIRTY/i,
];
const sha256Pattern = /^[a-f0-9]{64}$/i;

function abs(path) {
  return resolve(root, path);
}

function rel(path) {
  return relative(root, path).replaceAll('\\', '/');
}

function normalizeRepoPath(path) {
  return String(path).replaceAll('\\', '/').replace(/^\.\//, '');
}

function formatJsonPath(path) {
  return path.length > 0 ? path.join('.') : '<root>';
}

function looksLikeRepoPath(path) {
  const normalized = normalizeRepoPath(path);
  return (
    normalized === 'package.json' ||
    normalized === '.env.example' ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.includes('/') ||
    /\.(?:cjs|css|html|json|js|jsx|md|mjs|sql|ts|tsx)$/.test(normalized)
  );
}

function exists(path) {
  return existsSync(abs(path));
}

function read(path) {
  return readFileSync(abs(path), 'utf8');
}

function readJson(path) {
  return JSON.parse(read(path));
}

function hashFile(path) {
  return createHash('sha256')
    .update(readFileSync(abs(path)))
    .digest('hex');
}

function walkFiles(path) {
  if (!exists(path)) return [];
  return readdirSync(abs(path), { withFileTypes: true }).flatMap((entry) => {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) return walkFiles(child);
    if (entry.isFile()) return [normalizeRepoPath(child)];
    return [];
  });
}

function markdownTable(headers, rows) {
  const allRows = [headers, ...rows];
  const widths = headers.map((_, index) =>
    Math.max(...allRows.map((row) => String(row[index] ?? '').length), 3),
  );
  const render = (row) =>
    `| ${row.map((cell, index) => String(cell ?? '').padEnd(widths[index])).join(' | ')} |`;
  return [
    render(headers),
    render(widths.map((width) => '-'.repeat(width))),
    ...rows.map(render),
  ].join('\n');
}

function normalizeGeneratedMarkdown(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^Generated: .+$/m, 'Generated: <ignored>')
    .trimEnd();
}

function normalizeGeneratedJson(text) {
  const parsed = JSON.parse(text);
  delete parsed.generatedAt;
  return JSON.stringify(parsed, null, 2);
}

function checkGeneratedFile(path, expectedContent, normalize) {
  if (!exists(path)) {
    console.error(
      `FAIL Missing ${path}. Run npm run docs:generated-packet-status-audit:strict.`,
    );
    return false;
  }
  const current = read(path);
  if (normalize(current) !== normalize(expectedContent)) {
    console.error(
      `FAIL ${path} is stale. Run npm run docs:generated-packet-status-audit:strict.`,
    );
    return false;
  }
  return true;
}

function collectGitStatuses(value, path = []) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectGitStatuses(item, [...path, String(index)]));
  }
  return Object.entries(value).flatMap(([key, item]) => {
    const nextPath = [...path, key];
    const current =
      key === 'gitStatus' && typeof item === 'string' && item.trim().length > 0
        ? [{ path: nextPath.join('.'), value: item.trim() }]
        : [];
    return [...current, ...collectGitStatuses(item, nextPath)];
  });
}

function collectHashRefs(value, path = []) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectHashRefs(item, [...path, String(index)]));
  }

  const self =
    typeof value.path === 'string' && typeof value.sha256 === 'string'
      ? [
          {
            jsonPath: formatJsonPath(path),
            path: normalizeRepoPath(value.path),
            expectedExists: value.exists,
            expectedSha256: value.sha256,
          },
        ]
      : [];
  const hashMapRefs = Object.entries(value)
    .filter(
      ([key, item]) =>
        typeof item === 'string' && sha256Pattern.test(item) && looksLikeRepoPath(key),
    )
    .map(([key, item]) => ({
      jsonPath: formatJsonPath([...path, key]),
      path: normalizeRepoPath(key),
      expectedExists: true,
      expectedSha256: item,
    }));
  const children = Object.entries(value).flatMap(([key, item]) =>
    collectHashRefs(item, [...path, key]),
  );
  return [...self, ...hashMapRefs, ...children];
}

const blockers = [];
const warnings = [];

if (!exists(packagePath)) blockers.push(`Missing ${packagePath}.`);
for (const rootPath of generatedRoots) {
  if (!exists(rootPath)) blockers.push(`Missing generated packet directory ${rootPath}.`);
}

const packageJson = exists(packagePath) ? readJson(packagePath) : { scripts: {} };
for (const command of requiredPackageScripts) {
  if (!Object.hasOwn(packageJson.scripts ?? {}, command)) {
    blockers.push(`${packagePath} is missing ${command}.`);
  }
}

const generatedFiles = generatedRoots
  .flatMap((rootPath) => walkFiles(rootPath))
  .filter((path) => ['.json', '.md'].includes(extname(path)))
  .sort((a, b) => a.localeCompare(b));

if (generatedFiles.length === 0) blockers.push('No generated phase packet files found.');

const fileResults = generatedFiles.map((path) => {
  const text = read(path);
  const dirtyTextMatches = dirtyTextPatterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => String(pattern));
  let gitStatusMatches = [];
  let hashRefs = [];
  let staleHashRefs = [];

  if (extname(path) === '.json') {
    try {
      const parsed = JSON.parse(text);
      gitStatusMatches = collectGitStatuses(parsed);
      hashRefs = collectHashRefs(parsed);
    } catch (error) {
      blockers.push(
        `${path} could not be parsed as JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (dirtyTextMatches.length > 0) {
    blockers.push(`${path} contains dirty generated-packet text.`);
  }
  for (const match of gitStatusMatches) {
    blockers.push(`${path} records non-empty ${match.path}: ${match.value}`);
  }
  for (const ref of hashRefs) {
    const currentExists = exists(ref.path);
    if (ref.expectedExists === true && !currentExists) {
      staleHashRefs.push({ ...ref, reason: 'recorded present but file is missing' });
      continue;
    }
    if (ref.expectedExists === false && currentExists) {
      staleHashRefs.push({ ...ref, reason: 'recorded missing but file exists' });
      continue;
    }
    if (currentExists) {
      const actualSha256 = hashFile(ref.path);
      if (actualSha256 !== ref.expectedSha256) {
        staleHashRefs.push({
          ...ref,
          actualSha256,
          reason: 'sha256 does not match current file',
        });
      }
    }
  }
  for (const ref of staleHashRefs) {
    blockers.push(`${path} has stale hash reference ${ref.jsonPath} -> ${ref.path}: ${ref.reason}.`);
  }

  return {
    path,
    kind: extname(path).slice(1),
    dirtyTextMatchCount: dirtyTextMatches.length,
    nonEmptyGitStatusCount: gitStatusMatches.length,
    hashReferenceCount: hashRefs.length,
    staleHashReferenceCount: staleHashRefs.length,
  };
});

const audit = {
  generatedAt: new Date().toISOString(),
  status: blockers.length === 0 ? 'pass' : 'blocked',
  strict,
  purpose:
    'Audit committed generated phase packets so dirty-worktree and stale-hash packet output cannot be mistaken for final evidence.',
  generatedRoots,
  generatedFiles: fileResults,
  requiredPackageScripts,
  summary: {
    generatedFileCount: fileResults.length,
    dirtyTextFileCount: fileResults.filter((file) => file.dirtyTextMatchCount > 0).length,
    nonEmptyGitStatusFileCount: fileResults.filter((file) => file.nonEmptyGitStatusCount > 0)
      .length,
    hashReferenceCount: fileResults.reduce((total, file) => total + file.hashReferenceCount, 0),
    staleHashReferenceCount: fileResults.reduce(
      (total, file) => total + file.staleHashReferenceCount,
      0,
    ),
    blockerCount: blockers.length,
    warningCount: warnings.length,
  },
  blockers,
  warnings,
};

const jsonContent = `${JSON.stringify(audit, null, 2)}\n`;

const mdContent = [
  '# Generated Packet Status Audit',
  '',
  `Generated: ${audit.generatedAt}`,
  `Status: ${audit.status}`,
  `Strict mode: ${strict ? 'yes' : 'no'}`,
  '',
  'This generated audit scans committed phase packet outputs for dirty-worktree',
  'status and stale recorded file hashes. It does not prove external launch',
  'evidence; it only prevents a local dirty or stale generated packet from',
  'being treated as trustworthy launch evidence.',
  '',
  '## Summary',
  '',
  `- Generated files scanned: ${audit.summary.generatedFileCount}`,
  `- Files with dirty text: ${audit.summary.dirtyTextFileCount}`,
  `- Files with non-empty gitStatus: ${audit.summary.nonEmptyGitStatusFileCount}`,
  `- Hash references checked: ${audit.summary.hashReferenceCount}`,
  `- Stale hash references: ${audit.summary.staleHashReferenceCount}`,
  `- Blockers: ${audit.summary.blockerCount}`,
  `- Warnings: ${audit.summary.warningCount}`,
  '',
  '## Files',
  '',
  markdownTable(
    [
      'File',
      'Kind',
      'Dirty text matches',
      'Non-empty gitStatus fields',
      'Hash refs',
      'Stale hash refs',
    ],
    fileResults.map((file) => [
      file.path,
      file.kind,
      file.dirtyTextMatchCount,
      file.nonEmptyGitStatusCount,
      file.hashReferenceCount,
      file.staleHashReferenceCount,
    ]),
  ),
  '',
  '## Blockers',
  '',
  ...(blockers.length > 0 ? blockers.map((blocker) => `- ${blocker}`) : ['- None.']),
  '',
  '## Warnings',
  '',
  ...(warnings.length > 0 ? warnings.map((warning) => `- ${warning}`) : ['- None.']),
  '',
].join('\n');

if (check) {
  const jsonCurrent = checkGeneratedFile(outJson, jsonContent, normalizeGeneratedJson);
  const mdCurrent = checkGeneratedFile(outMd, mdContent, normalizeGeneratedMarkdown);
  if (blockers.length > 0) {
    for (const blocker of blockers) console.error(`FAIL ${blocker}`);
    process.exit(1);
  }
  if (!jsonCurrent || !mdCurrent) process.exit(1);
  if (strict && warnings.length > 0) {
    for (const warning of warnings) console.warn(`WARN ${warning}`);
  }
  console.log('Generated packet status audit is current.');
  console.log('Generated packet status audit passed.');
  process.exit(0);
}

mkdirSync(dirname(abs(outJson)), { recursive: true });
writeFileSync(abs(outJson), jsonContent);
writeFileSync(abs(outMd), mdContent);

console.log(`Wrote ${rel(abs(outJson))}`);
console.log(`Wrote ${rel(abs(outMd))}`);

if (blockers.length > 0) {
  for (const blocker of blockers) console.error(`FAIL ${blocker}`);
  process.exit(1);
}

if (strict && warnings.length > 0) {
  for (const warning of warnings) console.warn(`WARN ${warning}`);
}

console.log('Generated packet status audit passed.');
