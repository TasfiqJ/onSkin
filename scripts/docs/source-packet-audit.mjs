#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const check = process.argv.includes('--check');
const sourceRoot = '04_repo_docs';
const sourceDocsDir = `${sourceRoot}/docs`;
const activeDocsDir = 'docs';
const outJson = process.env.SOURCE_PACKET_AUDIT_JSON ?? 'docs/generated/source-packet-audit.json';
const outMd = process.env.SOURCE_PACKET_AUDIT_MD ?? 'docs/generated/source-packet-audit.md';
const expectedTopLevelPacketFileNames = ['README.md', 'AGENTS.md'];

function abs(path) {
  return resolve(root, path);
}

function rel(path) {
  return relative(root, path).replaceAll('\\', '/');
}

function exists(path) {
  return existsSync(abs(path));
}

function read(path) {
  return readFileSync(abs(path), 'utf8');
}

function hash(path) {
  return createHash('sha256')
    .update(readFileSync(abs(path)))
    .digest('hex');
}

function bytes(path) {
  return readFileSync(abs(path)).length;
}

function walkFiles(path) {
  if (!exists(path)) return [];
  const entries = readdirSync(abs(path), { withFileTypes: true });
  return entries.flatMap((entry) => {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) return walkFiles(child);
    if (entry.isFile()) return [child];
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
    console.error(`FAIL Missing ${path}. Run npm run docs:source-packet-audit:strict.`);
    return false;
  }
  const current = read(path);
  if (normalize(current) !== normalize(expectedContent)) {
    console.error(`FAIL ${path} is stale. Run npm run docs:source-packet-audit:strict.`);
    return false;
  }
  return true;
}

function docTitle(path) {
  if (!exists(path)) return '';
  const firstHeading = read(path)
    .split(/\r?\n/)
    .find((line) => /^#\s+/.test(line));
  return firstHeading?.replace(/^#\s+/, '').trim() ?? '';
}

const blockers = [];
const warnings = [];

if (!exists(sourceRoot)) blockers.push(`Missing ${sourceRoot}.`);
if (!exists(sourceDocsDir)) blockers.push(`Missing ${sourceDocsDir}.`);
if (!exists(activeDocsDir)) blockers.push(`Missing ${activeDocsDir}.`);

const sourceDocNames = exists(sourceDocsDir)
  ? readdirSync(abs(sourceDocsDir))
      .filter((name) => name.endsWith('.md'))
      .sort()
  : [];

const sourcePacketFiles = walkFiles(sourceRoot).sort();
const topLevelMarkdownNames = exists(sourceRoot)
  ? readdirSync(abs(sourceRoot), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => entry.name)
      .sort()
  : [];
const unexpectedTopLevelMarkdownNames = topLevelMarkdownNames.filter(
  (name) => !expectedTopLevelPacketFileNames.includes(name),
);
if (strict && unexpectedTopLevelMarkdownNames.length > 0) {
  blockers.push(
    `Unexpected top-level packet markdown files: ${unexpectedTopLevelMarkdownNames
      .map((name) => `${sourceRoot}/${name}`)
      .join(', ')}.`,
  );
}

const rootAgentsText = exists('AGENTS.md') ? read('AGENTS.md') : '';
const claudeText = exists('CLAUDE.md') ? read('CLAUDE.md') : '';

const docs = sourceDocNames.map((name) => {
  const sourcePath = `${sourceDocsDir}/${name}`;
  const activePath = `${activeDocsDir}/${name}`;
  const activeExists = exists(activePath);
  const sourceHash = hash(sourcePath);
  const activeHash = activeExists ? hash(activePath) : null;
  const identical = activeExists && sourceHash === activeHash;
  const mentionedInRootAgents =
    rootAgentsText.includes(activePath.replaceAll('/', '\\')) ||
    rootAgentsText.includes(activePath);
  const mentionedInClaude =
    claudeText.includes(activePath.replaceAll('/', '\\')) || claudeText.includes(activePath);

  if (!activeExists) blockers.push(`Missing active docs mirror for ${sourcePath}.`);
  if (strict && activeExists && !identical) {
    blockers.push(`${activePath} differs from ${sourcePath} in strict mode.`);
  }
  if (!mentionedInRootAgents && !mentionedInClaude) {
    warnings.push(
      `${activePath} is not mentioned in AGENTS.md or CLAUDE.md source-of-truth lists.`,
    );
  }

  return {
    name,
    title: docTitle(sourcePath),
    sourcePath,
    activePath,
    sourceBytes: bytes(sourcePath),
    activeBytes: activeExists ? bytes(activePath) : null,
    sourceSha256: sourceHash,
    activeSha256: activeHash,
    identical,
    mentionedInRootAgents,
    mentionedInClaude,
  };
});

const topLevelPacketFiles = expectedTopLevelPacketFileNames.map((name) => {
  const path = `${sourceRoot}/${name}`;
  if (!exists(path)) blockers.push(`Missing ${path}.`);
  return {
    name,
    path,
    exists: exists(path),
    bytes: exists(path) ? bytes(path) : null,
    sha256: exists(path) ? hash(path) : null,
    title: docTitle(path),
  };
});

if (docs.length === 0) blockers.push(`No markdown docs found under ${sourceDocsDir}.`);

const packetFiles = sourcePacketFiles.map((path) => ({
  path,
  bytes: bytes(path),
  sha256: hash(path),
}));

const packet = {
  generatedAt: new Date().toISOString(),
  status: blockers.length === 0 ? 'pass' : 'blocked',
  strict,
  purpose:
    'Audit the original 04_repo_docs strategy packet against the active docs/ source-of-truth tree.',
  sourceRoot,
  activeDocsDir,
  topLevelPacketFiles,
  unexpectedTopLevelMarkdownNames,
  packetFiles,
  docs,
  summary: {
    totalPacketFileCount: sourcePacketFiles.length,
    topLevelPacketFileCount: topLevelPacketFiles.filter((file) => file.exists).length,
    expectedTopLevelPacketFileCount: expectedTopLevelPacketFileNames.length,
    unexpectedTopLevelMarkdownCount: unexpectedTopLevelMarkdownNames.length,
    sourceDocCount: docs.length,
    activeMirrorCount: docs.filter((doc) => doc.activeSha256).length,
    identicalMirrorCount: docs.filter((doc) => doc.identical).length,
    blockerCount: blockers.length,
    warningCount: warnings.length,
  },
  blockers,
  warnings,
};

const jsonContent = `${JSON.stringify(packet, null, 2)}\n`;

const docRows = docs.map((doc) => [
  doc.name,
  doc.identical ? 'identical' : doc.activeSha256 ? 'differs' : 'missing',
  doc.mentionedInRootAgents ? 'yes' : 'no',
  doc.mentionedInClaude ? 'yes' : 'no',
  doc.sourceSha256.slice(0, 12),
]);

const mdContent = [
  '# Source Packet Audit',
  '',
  `Generated: ${packet.generatedAt}`,
  `Status: ${packet.status}`,
  `Strict mode: ${strict ? 'yes' : 'no'}`,
  '',
  'This generated audit checks the original `04_repo_docs` source packet and',
  'verifies that its strategy docs are represented in the active `docs/` tree.',
  'Non-strict mode fails on missing packet files or active mirror files; strict',
  'mode also fails if a mirrored active doc differs from the packet copy, or if',
  'the top-level packet markdown shape changes without updating the audit.',
  '',
  '## Summary',
  '',
  `- Total packet files: ${packet.summary.totalPacketFileCount}`,
  `- Expected top-level packet files: ${packet.summary.topLevelPacketFileCount}/${packet.summary.expectedTopLevelPacketFileCount}`,
  `- Unexpected top-level packet markdown files: ${packet.summary.unexpectedTopLevelMarkdownCount}`,
  `- Source docs: ${packet.summary.sourceDocCount}`,
  `- Active mirrors: ${packet.summary.activeMirrorCount}`,
  `- Identical mirrors: ${packet.summary.identicalMirrorCount}`,
  `- Blockers: ${packet.summary.blockerCount}`,
  `- Warnings: ${packet.summary.warningCount}`,
  '',
  '## Docs Crosswalk',
  '',
  markdownTable(
    ['Packet doc', 'Active docs status', 'AGENTS.md', 'CLAUDE.md', 'Packet SHA-256'],
    docRows,
  ),
  '',
  '## Top-Level Packet Files',
  '',
  markdownTable(
    ['Packet file', 'Status', 'Bytes', 'SHA-256'],
    topLevelPacketFiles.map((file) => [
      file.path,
      file.exists ? 'present' : 'missing',
      file.bytes ?? '',
      file.sha256?.slice(0, 12) ?? '',
    ]),
  ),
  '',
  '## Full Packet Inventory',
  '',
  markdownTable(
    ['Packet file', 'Bytes', 'SHA-256'],
    packetFiles.map((file) => [file.path, file.bytes, file.sha256.slice(0, 12)]),
  ),
  '',
  '## Blockers',
  '',
  ...(blockers.length ? blockers.map((blocker) => `- ${blocker}`) : ['- None.']),
  '',
  '## Warnings',
  '',
  ...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ['- None.']),
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
  console.log('Source packet audit is current.');
  console.log('Source packet audit passed.');
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

console.log('Source packet audit passed.');
