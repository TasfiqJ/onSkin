#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

const root = process.cwd();
const supersessionPath = 'docs/release/full-app-j01/source-packet-supersession09.v1.json';
// Independently measured immutable Release08 preimages/postimages; changing this
// authority requires a new reviewed version, never a generated hash refresh.
const supersessionSha256 = '46be42762da54173473953a1d621aba60e80d699ee4ea717ee048b3de1f00a51';
const digest = (raw) => createHash('sha256').update(raw).digest('hex');
const blob = (raw) => createHash('sha1').update(`blob ${raw.length}\0`).update(raw).digest('hex');

function safePath(path) {
  if (typeof path !== 'string' || !path || isAbsolute(path) ||
      path.includes('\\') || path.includes(':') ||
      path.split('/').some((x) => !x || x === '.' || x === '..' ||
        /[\x00-\x1f]/u.test(x) || /[. ]$/u.test(x) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(x))) {
    throw new Error(`Unsafe source-packet path: ${path}`);
  }
  let current = resolve(root, path);
  while (true) {
    if (existsSync(current) || current === resolve(root, path)) {
      try {
        const info = lstatSync(current);
        if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory())) {
          throw new Error(`Nonregular/link source-packet path: ${path}`);
        }
        if (current !== resolve(root, path) && !info.isDirectory()) {
          throw new Error(`Non-directory source-packet parent: ${path}`);
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    if (dirname(current) === current) break;
    current = dirname(current);
  }
  return resolve(root, path);
}

const strict = process.argv.includes('--strict');
const check = process.argv.includes('--check');
const sourceRoot = '04_repo_docs';
const sourceDocsDir = `${sourceRoot}/docs`;
const activeDocsDir = 'docs';
const outJson = process.env.SOURCE_PACKET_AUDIT_JSON ?? 'docs/generated/source-packet-audit.json';
const outMd = process.env.SOURCE_PACKET_AUDIT_MD ?? 'docs/generated/source-packet-audit.md';
const expectedTopLevelPacketFileNames = ['README.md', 'AGENTS.md'];

function abs(path) {
  return safePath(path);
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
  const names = entries.map((entry) => entry.name.normalize('NFKC').toLowerCase());
  if (new Set(names).size !== names.length) throw new Error(`Packet filename collision: ${path}`);
  return entries.flatMap((entry) => {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) return walkFiles(child);
    if (entry.isFile()) { safePath(child); return [child]; }
    throw new Error(`Nonregular packet entry: ${child}`);
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
  // Requiring the producer's canonical serialization also rejects duplicate keys
  // that JSON.parse would otherwise silently collapse to a forged final value.
  if (text.replace(/\r\n/g, '\n').trimEnd() !== JSON.stringify(parsed, null, 2)) {
    throw new Error('Noncanonical generated JSON');
  }
  delete parsed.generatedAt;
  return JSON.stringify(parsed, null, 2);
}

function checkGeneratedFile(path, expectedContent, normalize) {
  if (!exists(path)) {
    console.error(`FAIL Missing ${path}. Run npm run docs:source-packet-audit:strict.`);
    return false;
  }
  const current = read(path);
  let matches = false;
  try { matches = normalize(current) === normalize(expectedContent); } catch { /* malformed is stale */ }
  if (!matches) {
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

// Authenticate the *entire* original packet before considering any exception.
const authorityRaw = readFileSync(abs(supersessionPath));
if (digest(authorityRaw) !== supersessionSha256) throw new Error('SUPERSESSION_MANIFEST_IDENTITY');
const authority = JSON.parse(authorityRaw.toString('utf8'));
const expectedInventory = authority.originalPacketFiles;
if (JSON.stringify(sourcePacketFiles) !== JSON.stringify(expectedInventory.map((row) => row.path).sort())) {
  blockers.push('Original packet inventory differs from immutable Release08.');
}
for (const row of expectedInventory) {
  if (!exists(row.path)) { blockers.push(`Missing original packet file: ${row.path}`); continue; }
  const raw = readFileSync(abs(row.path));
  if (raw.length !== row.bytes || digest(raw) !== row.sha256 || blob(raw) !== row.blob) {
    blockers.push(`Original packet identity changed: ${row.path}`);
  }
}
const insert = Buffer.from(authority.insertBase64, 'base64');
if (digest(insert) !== authority.insertSha256) throw new Error('SUPERSESSION_INSERT_IDENTITY');
const supersessions = new Map(authority.supersessions.map((row) => [row.activePath, row]));
function authorizedInsert(sourcePath, activePath) {
  const row = supersessions.get(activePath);
  if (!row || row.sourcePath !== sourcePath || !exists(activePath)) return false;
  const original = readFileSync(abs(sourcePath));
  const current = readFileSync(abs(activePath));
  const offset = original.indexOf(10) + 1;
  // Compare the complete original body and exact insert as bytes, including order,
  // line endings and encoding. Hashes additionally bind measured Git objects.
  return offset === row.insertOffset && digest(original) === row.baseSha256 &&
    blob(original) === row.baseBlob && digest(current) === row.postimageSha256 &&
    blob(current) === row.postimageBlob && current.equals(Buffer.concat([
      original.subarray(0, offset), insert, original.subarray(offset),
    ]));
}

const docs = sourceDocNames.map((name) => {
  const sourcePath = `${sourceDocsDir}/${name}`;
  const activePath = `${activeDocsDir}/${name}`;
  const activeExists = exists(activePath);
  const sourceHash = hash(sourcePath);
  const activeHash = activeExists ? hash(activePath) : null;
  const identical = activeExists && sourceHash === activeHash;
  const authorizedSupersession = authorizedInsert(sourcePath, activePath);
  if (supersessions.has(activePath) && !authorizedSupersession) {
    blockers.push(`Required exact Release08 supersession missing or altered: ${activePath}`);
  }
  const mentionedInRootAgents =
    rootAgentsText.includes(activePath.replaceAll('/', '\\')) ||
    rootAgentsText.includes(activePath);
  const mentionedInClaude =
    claudeText.includes(activePath.replaceAll('/', '\\')) || claudeText.includes(activePath);

  if (!activeExists) blockers.push(`Missing active docs mirror for ${sourcePath}.`);
  if (strict && activeExists && !identical && !authorizedSupersession) {
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
    authorizedSupersession,
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
  authorizedSupersession: {
    id: authority.id, manifestPath: supersessionPath, manifestSha256: supersessionSha256,
    authorization: authority.authorization, sourceAcceptance: authority.sourceAcceptance,
    legacyCutover: authority.legacyCutover, release: authority.release,
  },
  summary: {
    totalPacketFileCount: sourcePacketFiles.length,
    topLevelPacketFileCount: topLevelPacketFiles.filter((file) => file.exists).length,
    expectedTopLevelPacketFileCount: expectedTopLevelPacketFileNames.length,
    unexpectedTopLevelMarkdownCount: unexpectedTopLevelMarkdownNames.length,
    sourceDocCount: docs.length,
    activeMirrorCount: docs.filter((doc) => doc.activeSha256).length,
    identicalMirrorCount: docs.filter((doc) => doc.identical).length,
    authorizedSupersessionCount: docs.filter((doc) => doc.authorizedSupersession).length,
    blockerCount: blockers.length,
    warningCount: warnings.length,
  },
  blockers,
  warnings,
};

const jsonContent = `${JSON.stringify(packet, null, 2)}\n`;

const docRows = docs.map((doc) => [
  doc.name,
  doc.identical ? 'identical' : doc.authorizedSupersession ? 'authorizedSupersession' : doc.activeSha256 ? 'differs' : 'missing',
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
  'Release09 separately authenticates the entire immutable original packet and',
  'exactly five measured Release08 additive notices. These byte-different docs',
  'are authorizedSupersession, never identical. Missing/altered notices fail.',
  `Supersession manifest: ${supersessionPath} (SHA-256 ${supersessionSha256}).`,
  'Planning consistency only; source acceptance REVIEW_REQUIRED; legacy cutover NOT_DONE; release NO_GO.',
  '',
  '## Summary',
  '',
  `- Total packet files: ${packet.summary.totalPacketFileCount}`,
  `- Expected top-level packet files: ${packet.summary.topLevelPacketFileCount}/${packet.summary.expectedTopLevelPacketFileCount}`,
  `- Unexpected top-level packet markdown files: ${packet.summary.unexpectedTopLevelMarkdownCount}`,
  `- Source docs: ${packet.summary.sourceDocCount}`,
  `- Active mirrors: ${packet.summary.activeMirrorCount}`,
  `- Identical mirrors: ${packet.summary.identicalMirrorCount}`,
  `- Authorized supersessions: ${packet.summary.authorizedSupersessionCount}`,
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

const inputPaths = new Set([
  ...sourcePacketFiles, ...docs.map((doc) => doc.activePath),
  'AGENTS.md', 'CLAUDE.md', supersessionPath, 'scripts/docs/source-packet-audit.mjs',
].map(abs));
if (abs(outJson) === abs(outMd) || inputPaths.has(abs(outJson)) || inputPaths.has(abs(outMd))) {
  throw new Error('Audit output must not overwrite an input or its paired output');
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
