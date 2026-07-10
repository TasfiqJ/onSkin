#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, relative, resolve } from 'node:path';
import { command, gitStatusExcludingGeneratedEvidence } from '../phase9/lib.mjs';

const require = createRequire(import.meta.url);
const {
  REVIEW_WORKLIST_SCHEMA_VERSION,
  computeReviewSnapshotSha256,
  validateReviewSignoff,
} = require('../../apps/mobile/phase3-review-evidence');
const root = process.cwd();
const check = process.argv.includes('--check');
const strict = process.argv.includes('--strict');
const outJson =
  process.env.PHASE3_REVIEW_WORKLIST_JSON ?? 'docs/phase-3/generated/review-worklist.json';
const outMd = process.env.PHASE3_REVIEW_WORKLIST_MD ?? 'docs/phase-3/generated/review-worklist.md';
const signoffDir = 'docs/phase-3/signoffs';
const reviewLogs = [
  {
    domain: 'legalRegulatory',
    path: 'docs/phase-3/legal-regulatory-review-log.md',
    tableHeading: '## Inventory',
    requiredReviewer:
      'qualified attorney with consumer health, subscriptions, privacy, advertising, and app-platform experience',
  },
  {
    domain: 'clinical',
    path: 'docs/phase-3/clinical-review-log.md',
    tableHeading: '## Content Inventory',
    requiredReviewer: 'board-certified dermatologist or equivalent qualified clinician',
  },
  {
    domain: 'cosmeticChemistry',
    path: 'docs/phase-3/cosmetic-chemistry-review-log.md',
    tableHeading: '## Inventory',
    requiredReviewer: 'qualified cosmetic chemist/formulator',
  },
  {
    domain: 'privacySecurity',
    path: 'docs/phase-3/privacy-security-review-log.md',
    tableHeading: '## Inventory',
    requiredReviewer: 'privacy counsel plus technical security owner',
  },
  {
    domain: 'ipFto',
    path: 'docs/phase-3/ip-fto-review-log.md',
    tableHeading: '## Inventory',
    requiredReviewer: 'qualified trademark, copyright, and product/FTO counsel',
  },
];
const packetOutputPaths = [outJson, outMd].map((path) => normalizeRepoPath(path));
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.sql']);

function abs(path) {
  return resolve(root, path);
}

function normalizeRepoPath(path) {
  return String(path).replaceAll('\\', '/').replace(/^\.\//, '');
}

function exists(path) {
  return existsSync(abs(path));
}

function read(path) {
  return readFileSync(abs(path), 'utf8');
}

function hashFile(path) {
  const bytes = readFileSync(abs(path));
  return {
    path: normalizeRepoPath(path),
    exists: true,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function fileRecord(path) {
  return exists(path) ? hashFile(path) : { path: normalizeRepoPath(path), exists: false };
}

function loadSignoffs(blockers) {
  const signoffs = new Map();
  if (!exists(signoffDir)) {
    blockers.push(`Missing Phase 3 signoff directory ${signoffDir}.`);
    return signoffs;
  }

  const paths = readdirSync(abs(signoffDir), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map((entry) => normalizeRepoPath(`${signoffDir}/${entry.name}`))
    .sort((a, b) => a.localeCompare(b));

  for (const path of paths) {
    let record;
    try {
      record = JSON.parse(read(path));
    } catch (error) {
      blockers.push(
        `${path} cannot be parsed as JSON: ${error instanceof Error ? error.message : String(error)}.`,
      );
      continue;
    }
    const itemId = typeof record?.itemId === 'string' ? record.itemId.trim() : '';
    if (!itemId) {
      blockers.push(`${path} has no itemId.`);
      continue;
    }
    if (signoffs.has(itemId)) {
      blockers.push(
        `${path} duplicates Phase 3 signoff itemId ${itemId}; keep exactly one signoff per item.`,
      );
      continue;
    }
    signoffs.set(itemId, { file: fileRecord(path), record });
  }

  return signoffs;
}

function walk(dir, files = []) {
  if (!exists(dir)) return files;
  for (const entry of readdirSync(abs(dir), { withFileTypes: true })) {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(child, files);
    if (entry.isFile() && sourceExtensions.has(extname(entry.name))) {
      files.push(normalizeRepoPath(child));
    }
  }
  return files;
}

function expandSourcePath(path) {
  const normalized = normalizeRepoPath(path);
  if (normalized.endsWith('/*'))
    return walk(normalized.slice(0, -2)).sort((a, b) => a.localeCompare(b));
  return [normalized];
}

function splitMarkdownRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseInventoryTable(markdown, log) {
  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === log.tableHeading);
  if (headingIndex === -1) return [];
  const tableStart = lines.findIndex(
    (line, index) => index > headingIndex && line.trim().startsWith('|'),
  );
  if (tableStart === -1) return [];

  const header = splitMarkdownRow(lines[tableStart]);
  const rows = [];
  for (let index = tableStart + 2; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim().startsWith('|')) break;
    const cells = splitMarkdownRow(line);
    rows.push(Object.fromEntries(header.map((name, cellIndex) => [name, cells[cellIndex] ?? ''])));
  }
  return rows;
}

function extractBacktickPaths(text) {
  return [...String(text).matchAll(/`([^`]+)`/g)]
    .map((match) => normalizeRepoPath(match[1]))
    .filter((path) => path.length > 0);
}

function isTbd(value) {
  return /^(?:|TBD|N\/A|not cleared)$/i.test(String(value ?? '').trim());
}

function statusBucket(status) {
  const normalized = String(status ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'approved') return 'approved';
  if (normalized === 'deferred') return 'deferred';
  if (normalized === 'blocked') return 'blocked';
  if (normalized.includes('not cleared')) return 'notCleared';
  return 'needsReview';
}

function requiredEvidenceFor(bucket) {
  if (bucket === 'approved') {
    return 'Keep reviewer, credential, date, exact source hashes, and decision conditions attached.';
  }
  if (bucket === 'deferred') {
    return 'Keep the named decision owner, date, exact source hashes, deferral reason, and production exposure gate attached.';
  }
  return 'Named reviewer, credential, review date, decision, conditions, and approval tied to the exact source hashes.';
}

function gitStatusExcludingGeneratedPacket() {
  return gitStatusExcludingGeneratedEvidence(packetOutputPaths);
}

function normalizeGeneratedMarkdown(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^Generated: .+$/m, 'Generated: <ignored>')
    .replace(/^Git SHA: .+$/m, 'Git SHA: <ignored>')
    .trimEnd();
}

function normalizeGeneratedJson(text) {
  const parsed = JSON.parse(text);
  delete parsed.generatedAt;
  delete parsed.gitSha;
  delete parsed.strict;
  return JSON.stringify(parsed, null, 2);
}

function checkGeneratedFile(path, expectedContent, normalize) {
  if (!exists(path)) {
    console.error(`FAIL Missing ${path}. Run npm run phase3:review-worklist.`);
    return false;
  }
  if (normalize(read(path)) !== normalize(expectedContent)) {
    console.error(`FAIL ${path} is stale. Run npm run phase3:review-worklist.`);
    return false;
  }
  return true;
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

function displayValue(value, fallback = 'TBD') {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : fallback;
}

function sourceLine(source) {
  if (!source.exists) return `- \`${source.path}\` - missing`;
  return `- \`${source.path}\` - ${source.bytes} bytes - sha256 \`${source.sha256}\``;
}

function itemDetailMarkdown(item) {
  const sourceLines =
    item.sourcePaths.length > 0
      ? item.sourcePaths.map(sourceLine)
      : ['- No backticked source path was extracted from the review log row.'];
  return [
    `### ${item.domain} - ${item.area}`,
    '',
    `- Worklist ID: \`${item.id}\``,
    `- Status: ${displayValue(item.status, 'Unspecified')}`,
    `- Required reviewer: ${item.requiredReviewer}`,
    `- Current reviewer/date: ${displayValue(item.reviewer)} / ${displayValue(item.date)}`,
    `- Review snapshot SHA-256: \`${item.reviewSnapshotSha256}\``,
    `- Detached signoff: ${item.signoffStatus}${
      item.signoff?.file?.path ? ` (\`${item.signoff.file.path}\`)` : ''
    }`,
    `- Required evidence: ${item.requiredEvidence}`,
    `- Review-log notes: ${displayValue(item.notes, 'None.')}`,
    '',
    'Sources:',
    '',
    ...sourceLines,
    '',
  ].join('\n');
}

const blockers = [];
const warnings = [];
const signoffs = loadSignoffs(blockers);
let gitSha = 'unknown';
let gitStatus = 'unknown';
try {
  gitSha = command('git', ['rev-parse', 'HEAD']).trim();
  gitStatus = gitStatusExcludingGeneratedPacket();
} catch {
  warnings.push('Git SHA/status could not be captured.');
}
if (gitStatus.length > 0) {
  warnings.push(
    'Phase 3 review worklist generated with a dirty Git worktree; do not use it as final reviewer handoff evidence.',
  );
}

const items = [];
for (const log of reviewLogs) {
  if (!exists(log.path)) {
    blockers.push(`Missing review log ${log.path}.`);
    continue;
  }
  const rows = parseInventoryTable(read(log.path), log);
  if (rows.length === 0) blockers.push(`${log.path} has no parseable review inventory table.`);
  for (const row of rows) {
    const sourceText = row.Source ?? '';
    const sourcePaths = extractBacktickPaths(sourceText).flatMap(expandSourcePath).map(fileRecord);
    const bucket = statusBucket(row.Status);
    for (const source of sourcePaths.filter((source) => !source.exists)) {
      blockers.push(`${log.path} item "${row.Area}" references missing source ${source.path}.`);
    }
    if (['approved', 'deferred'].includes(bucket) && (isTbd(row.Reviewer) || isTbd(row.Date))) {
      blockers.push(
        `${log.path} item "${row.Area}" has a release disposition without reviewer/owner and date evidence.`,
      );
    }
    if (
      ['approved', 'deferred'].includes(bucket) &&
      !/^\d{4}-\d{2}-\d{2}$/.test(String(row.Date ?? '').trim())
    ) {
      blockers.push(
        `${log.path} item "${row.Area}" has a release disposition without an ISO date.`,
      );
    }
    const item = {
      id: `${log.domain}:${slug(row.Area)}`,
      domain: log.domain,
      requiredReviewer: log.requiredReviewer,
      area: row.Area,
      sourceText,
      currentBehavior: row['Current production behavior'] ?? row['Current behavior'] ?? '',
      reviewer: row.Reviewer ?? '',
      date: row.Date ?? '',
      status: row.Status ?? '',
      statusBucket: bucket,
      notes: row.Notes ?? '',
      sourcePaths,
      requiredEvidence: requiredEvidenceFor(bucket),
    };
    item.reviewSnapshotSha256 = computeReviewSnapshotSha256(item);
    item.signoff = signoffs.get(item.id) ?? null;
    item.signoffStatus = item.signoff ? 'current' : 'not-applicable';

    if (['approved', 'deferred'].includes(bucket) && !item.signoff) {
      item.signoffStatus = 'missing';
      blockers.push(
        `${log.path} item "${row.Area}" has a release disposition without a detached JSON signoff.`,
      );
    } else if (!['approved', 'deferred'].includes(bucket) && item.signoff) {
      item.signoffStatus = 'invalid';
      blockers.push(
        `${item.signoff.file.path} is attached to unresolved item ${item.id}; update the review log disposition atomically.`,
      );
    } else if (item.signoff) {
      const signoffErrors = validateReviewSignoff(item, { rootDir: root, verifyHashes: true });
      if (signoffErrors.length > 0) {
        item.signoffStatus = 'invalid';
        blockers.push(...signoffErrors);
      }
    }

    items.push(item);
  }
}

const itemIds = new Set(items.map((item) => item.id));
for (const [itemId, signoff] of signoffs) {
  if (!itemIds.has(itemId)) {
    blockers.push(`${signoff.file.path} references unknown or stale review item ${itemId}.`);
  }
}

const domainCounts = items.reduce((acc, item) => {
  acc[item.domain] = (acc[item.domain] ?? 0) + 1;
  return acc;
}, {});
const statusCounts = items.reduce((acc, item) => {
  acc[item.statusBucket] = (acc[item.statusBucket] ?? 0) + 1;
  return acc;
}, {});
const sourcePathCount = items.reduce((total, item) => total + item.sourcePaths.length, 0);
const missingSourcePathCount = items.reduce(
  (total, item) => total + item.sourcePaths.filter((source) => !source.exists).length,
  0,
);
const signedItemCount = items.filter((item) => item.signoffStatus === 'current').length;
const unsignedReleaseDispositionCount = items.filter(
  (item) => ['approved', 'deferred'].includes(item.statusBucket) && !item.signoff,
).length;

const worklist = {
  schemaVersion: REVIEW_WORKLIST_SCHEMA_VERSION,
  generatedAt: new Date().toISOString(),
  purpose:
    'Machine-readable Phase 3 reviewer worklist for legal, clinical, cosmetic chemistry, privacy/security, and IP/FTO launch gates.',
  strict,
  gitSha,
  gitStatus,
  reviewLogs: reviewLogs.map((log) => ({
    domain: log.domain,
    requiredReviewer: log.requiredReviewer,
    ...fileRecord(log.path),
  })),
  summary: {
    itemCount: items.length,
    domainCounts,
    statusCounts,
    sourcePathCount,
    missingSourcePathCount,
    signedItemCount,
    unsignedReleaseDispositionCount,
    blockerCount: blockers.length,
    warningCount: warnings.length,
  },
  items,
  blockers,
  warnings,
};

const jsonContent = `${JSON.stringify(worklist, null, 2)}\n`;
const mdContent = [
  '# Phase 3 Reviewer Worklist',
  '',
  `Generated: ${worklist.generatedAt}`,
  `Status: ${blockers.length === 0 ? 'pass' : 'blocked'}`,
  `Git SHA: ${worklist.gitSha}`,
  `Git status: ${worklist.gitStatus ? 'DIRTY' : 'clean'}`,
  '',
  'This generated worklist converts the legal, clinical, cosmetic chemistry,',
  'privacy/security, and IP/FTO review logs into an operator handoff. It does',
  'not mark anything approved; it records the exact source files and hashes',
  'reviewers must inspect before launch gates can close.',
  '',
  '## Summary',
  '',
  `- Review items: ${worklist.summary.itemCount}`,
  `- Source files hashed: ${worklist.summary.sourcePathCount}`,
  `- Missing source files: ${worklist.summary.missingSourcePathCount}`,
  `- Current detached signoffs: ${worklist.summary.signedItemCount}`,
  `- Release dispositions missing signoff: ${worklist.summary.unsignedReleaseDispositionCount}`,
  `- Blockers: ${worklist.summary.blockerCount}`,
  `- Warnings: ${worklist.summary.warningCount}`,
  '',
  '## Items',
  '',
  markdownTable(
    ['Domain', 'Area', 'Status', 'Reviewer', 'Date', 'Signoff', 'Sources', 'Missing sources'],
    items.map((item) => [
      item.domain,
      item.area,
      item.status,
      item.reviewer,
      item.date,
      item.signoffStatus,
      item.sourcePaths.filter((source) => source.exists).length,
      item.sourcePaths.filter((source) => !source.exists).length,
    ]),
  ),
  '',
  '## Item Details',
  '',
  ...items.map(itemDetailMarkdown),
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
  console.log('Phase 3 review worklist is current.');
  console.log('Phase 3 review worklist passed.');
  process.exit(0);
}

mkdirSync(dirname(abs(outJson)), { recursive: true });
writeFileSync(abs(outJson), jsonContent);
writeFileSync(abs(outMd), mdContent);

console.log(`Wrote ${relative(root, abs(outJson)).replaceAll('\\', '/')}`);
console.log(`Wrote ${relative(root, abs(outMd)).replaceAll('\\', '/')}`);
if (blockers.length > 0) {
  for (const blocker of blockers) console.error(`FAIL ${blocker}`);
  process.exit(1);
}
if (strict && warnings.length > 0) {
  for (const warning of warnings) console.warn(`WARN ${warning}`);
}
console.log('Phase 3 review worklist passed.');
