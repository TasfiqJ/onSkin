#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { command, gitStatusExcludingGeneratedEvidence } from '../phase9/lib.mjs';

const root = process.cwd();
const check = process.argv.includes('--check');
const strict = process.argv.includes('--strict');
const sourceWorklistPath =
  process.env.PHASE3_REVIEW_WORKLIST_JSON ?? 'docs/phase-3/generated/review-worklist.json';
const outJson =
  process.env.PHASE3_REVIEW_OPERATOR_QUEUE_JSON ??
  'docs/phase-3/generated/review-operator-queue.json';
const outMd =
  process.env.PHASE3_REVIEW_OPERATOR_QUEUE_MD ?? 'docs/phase-3/generated/review-operator-queue.md';
const outputPaths = [outJson, outMd].map((path) => normalizeRepoPath(path));

const domainLabel = {
  legalRegulatory: 'Legal/regulatory',
  clinical: 'Clinical',
  cosmeticChemistry: 'Cosmetic chemistry',
  privacySecurity: 'Privacy/security',
  ipFto: 'IP/FTO',
};

const domainOwner = {
  legalRegulatory: 'Founder + qualified legal counsel',
  clinical: 'Founder + board-certified dermatologist',
  cosmeticChemistry: 'Founder + qualified cosmetic chemist',
  privacySecurity: 'Founder + privacy counsel + technical security owner',
  ipFto: 'Founder + trademark/IP/FTO counsel',
};

function abs(path) {
  return resolve(root, path);
}

function normalizeRepoPath(path) {
  return String(path ?? '')
    .replaceAll('\\', '/')
    .replace(/^\.\//, '');
}

function exists(path) {
  return existsSync(abs(path));
}

function read(path) {
  return readFileSync(abs(path), 'utf8');
}

function hashFile(path) {
  return createHash('sha256')
    .update(readFileSync(abs(path)))
    .digest('hex');
}

function fileRecord(path) {
  const normalized = normalizeRepoPath(path);
  if (!exists(normalized)) return { path: normalized, exists: false };
  const bytes = readFileSync(abs(normalized));
  return {
    path: normalized,
    exists: true,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function parseJson(path, blockers) {
  if (!exists(path)) {
    blockers.push(`Missing ${path}. Run npm run phase3:review-worklist first.`);
    return null;
  }
  try {
    return JSON.parse(read(path));
  } catch (error) {
    blockers.push(
      `${path} could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

function isPlaceholder(value) {
  return /^(?:|TBD|N\/A|not cleared)$/i.test(String(value ?? '').trim());
}

function statusBucket(item) {
  const bucket = String(item?.statusBucket ?? '').trim();
  if (bucket) return bucket;
  const status = String(item?.status ?? '')
    .trim()
    .toLowerCase();
  if (status === 'approved') return 'approved';
  if (status === 'blocked') return 'blocked';
  if (status.includes('not cleared')) return 'notCleared';
  return 'needsReview';
}

function priorityFor(item) {
  const bucket = statusBucket(item);
  const id = String(item?.id ?? '');
  if (
    bucket === 'blocked' ||
    /brand|trademark|store|consent|deletion|export|auth|catalog-source|native-identifiers/i.test(id)
  ) {
    return 'P0';
  }
  if (
    ['legalRegulatory', 'clinical', 'cosmeticChemistry', 'privacySecurity'].includes(item.domain)
  ) {
    return 'P1';
  }
  return 'P2';
}

function prioritySortValue(priority) {
  return { P0: 0, P1: 1, P2: 2 }[priority] ?? 3;
}

function operatorActionFor(item) {
  const bucket = statusBucket(item);
  if (bucket === 'approved') {
    return 'Confirm the current source hashes still match the approved row and preserve any conditions.';
  }
  if (bucket === 'blocked') {
    return 'Resolve the prerequisite in docs/FOR_TAS_TO_DO.md, then send this exact packet to the required reviewer.';
  }
  return 'Send this packet to the required reviewer and capture name, credential, date, decision, conditions, and exact source hashes.';
}

function validateItem(item, blockers) {
  for (const key of ['id', 'domain', 'area', 'status', 'requiredReviewer']) {
    if (!String(item?.[key] ?? '').trim()) blockers.push(`Review worklist item is missing ${key}.`);
  }
  if (!Array.isArray(item?.sourcePaths)) {
    blockers.push(`Review worklist item ${item?.id ?? '<unknown>'} has no sourcePaths array.`);
    return;
  }
  if (item.sourcePaths.length === 0) {
    blockers.push(`Review worklist item ${item.id} has no source files.`);
  }
  for (const source of item.sourcePaths) {
    if (!source?.path)
      blockers.push(`Review worklist item ${item.id} has a source without a path.`);
    if (source?.exists === false) {
      blockers.push(`Review worklist item ${item.id} references missing source ${source.path}.`);
    }
  }
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
    console.error(`FAIL Missing ${path}. Run npm run phase3:review-operator-queue.`);
    return false;
  }
  if (normalize(read(path)) !== normalize(expectedContent)) {
    console.error(`FAIL ${path} is stale. Run npm run phase3:review-operator-queue.`);
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

function sourceLine(source) {
  if (!source.exists) return `- \`${source.path}\` - missing`;
  return `- \`${source.path}\` - ${source.bytes} bytes - sha256 \`${source.sha256}\``;
}

function itemDetailMarkdown(item) {
  return [
    `### ${item.priority} - ${item.domainLabel} - ${item.area}`,
    '',
    `- Queue ID: \`${item.id}\``,
    `- Status: ${item.status}`,
    `- External owner: ${item.externalOwner}`,
    `- Required reviewer: ${item.requiredReviewer}`,
    `- Current reviewer/date: ${item.reviewer} / ${item.date}`,
    `- Operator action: ${item.operatorAction}`,
    `- Required evidence: ${item.requiredEvidence}`,
    `- Notes: ${item.notes || 'None.'}`,
    '',
    'Sources:',
    '',
    ...item.sourcePaths.map(sourceLine),
    '',
  ].join('\n');
}

const blockers = [];
const warnings = [];
const sourceWorklist = parseJson(sourceWorklistPath, blockers);
let gitSha = 'unknown';
let gitStatus = 'unknown';

try {
  gitSha = command('git', ['rev-parse', 'HEAD']).trim();
  gitStatus = gitStatusExcludingGeneratedEvidence(outputPaths);
} catch {
  warnings.push('Git SHA/status could not be captured.');
}

if (gitStatus.length > 0) {
  warnings.push(
    'Phase 3 review operator queue generated with a dirty Git worktree; do not use it as final reviewer handoff evidence.',
  );
}

if (sourceWorklist?.gitStatus) {
  warnings.push(
    'Source Phase 3 review worklist records a dirty Git worktree; regenerate from a clean tree before final reviewer handoff.',
  );
}

const rawItems = Array.isArray(sourceWorklist?.items) ? sourceWorklist.items : [];
if (sourceWorklist && rawItems.length === 0) {
  blockers.push(`${sourceWorklistPath} contains no review items.`);
}

for (const item of rawItems) validateItem(item, blockers);

const items = rawItems
  .map((item) => {
    const priority = priorityFor(item);
    return {
      id: item.id,
      rank: 0,
      priority,
      domain: item.domain,
      domainLabel: domainLabel[item.domain] ?? item.domain,
      area: item.area,
      status: item.status,
      statusBucket: statusBucket(item),
      externalOwner: domainOwner[item.domain] ?? 'Founder + assigned reviewer',
      requiredReviewer: item.requiredReviewer,
      reviewer: isPlaceholder(item.reviewer) ? 'TBD' : item.reviewer,
      date: isPlaceholder(item.date) ? 'TBD' : item.date,
      operatorAction: operatorActionFor(item),
      requiredEvidence: item.requiredEvidence,
      notes: item.notes,
      currentBehavior: item.currentBehavior,
      sourcePaths: item.sourcePaths,
    };
  })
  .sort((a, b) => {
    const priorityDiff = prioritySortValue(a.priority) - prioritySortValue(b.priority);
    if (priorityDiff !== 0) return priorityDiff;
    const domainDiff = a.domain.localeCompare(b.domain);
    if (domainDiff !== 0) return domainDiff;
    return a.area.localeCompare(b.area);
  })
  .map((item, index) => ({ ...item, rank: index + 1 }));

const priorityCounts = items.reduce((acc, item) => {
  acc[item.priority] = (acc[item.priority] ?? 0) + 1;
  return acc;
}, {});
const domainCounts = items.reduce((acc, item) => {
  acc[item.domain] = (acc[item.domain] ?? 0) + 1;
  return acc;
}, {});
const statusCounts = items.reduce((acc, item) => {
  acc[item.statusBucket] = (acc[item.statusBucket] ?? 0) + 1;
  return acc;
}, {});
const sourceRecord = exists(sourceWorklistPath)
  ? {
      ...fileRecord(sourceWorklistPath),
      currentSha256: exists(sourceWorklistPath) ? hashFile(sourceWorklistPath) : null,
    }
  : { path: normalizeRepoPath(sourceWorklistPath), exists: false };

const queue = {
  generatedAt: new Date().toISOString(),
  purpose:
    'Operator queue for Phase 3 legal, clinical, cosmetic chemistry, privacy/security, and IP/FTO review handoffs.',
  strict,
  gitSha,
  gitStatus,
  sourceWorklist: sourceRecord,
  reviewReadiness: items.some((item) => item.priority === 'P0')
    ? 'external-blocked'
    : 'ready-to-send',
  summary: {
    itemCount: items.length,
    priorityCounts,
    domainCounts,
    statusCounts,
    blockerCount: blockers.length,
    warningCount: warnings.length,
  },
  items,
  blockers,
  warnings,
};

const jsonContent = `${JSON.stringify(queue, null, 2)}\n`;
const mdContent = [
  '# Phase 3 Review Operator Queue',
  '',
  `Generated: ${queue.generatedAt}`,
  `Status: ${blockers.length === 0 ? 'pass' : 'blocked'}`,
  `Review readiness: ${queue.reviewReadiness}`,
  `Git SHA: ${queue.gitSha}`,
  `Git status: ${queue.gitStatus ? 'DIRTY' : 'clean'}`,
  '',
  'This generated queue turns the Phase 3 reviewer worklist into the operating',
  'order for founder, counsel, clinical, chemistry, privacy/security, and IP/FTO',
  'handoffs. It does not approve content and must not be used to invent reviewer',
  'names, credentials, dates, or legal/clinical decisions.',
  '',
  '## Summary',
  '',
  `- Queue items: ${queue.summary.itemCount}`,
  `- P0 launch blockers: ${queue.summary.priorityCounts.P0 ?? 0}`,
  `- P1 reviewer handoffs: ${queue.summary.priorityCounts.P1 ?? 0}`,
  `- P2 follow-ups: ${queue.summary.priorityCounts.P2 ?? 0}`,
  `- Blockers: ${queue.summary.blockerCount}`,
  `- Warnings: ${queue.summary.warningCount}`,
  '',
  '## Next Operator Actions',
  '',
  markdownTable(
    ['Rank', 'Priority', 'Domain', 'Area', 'Status', 'Owner', 'Action', 'Sources'],
    items.map((item) => [
      item.rank,
      item.priority,
      item.domainLabel,
      item.area,
      item.status,
      item.externalOwner,
      item.operatorAction,
      item.sourcePaths.length,
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
    process.exit(1);
  }
  console.log('Phase 3 review operator queue is current.');
  console.log('Phase 3 review operator queue passed.');
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
  process.exit(1);
}
console.log('Phase 3 review operator queue passed.');
