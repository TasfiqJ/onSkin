const { createHash } = require('node:crypto');
const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { dirname, extname, resolve, relative } = require('node:path');

const MOBILE_ROOT = dirname(require.resolve('./app.base.json'));
const REPO_ROOT = resolve(MOBILE_ROOT, '../..');
const DEFAULT_WORKLIST_PATH = resolve(REPO_ROOT, 'docs/phase-3/generated/review-worklist.json');
const REQUIRED_DOMAINS = Object.freeze([
  'legalRegulatory',
  'clinical',
  'cosmeticChemistry',
  'privacySecurity',
  'ipFto',
]);
const RELEASE_DISPOSITIONS = new Set(['approved', 'deferred']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.sql']);
const SHA256_RE = /^[a-f0-9]{64}$/i;
const PLACEHOLDER_RE =
  /^(?:|tbd|n\/a|none|not cleared|.*\b(?:placeholder|example|test(?:er)?|reviewer name|decision owner)\b.*)$/i;
const REVIEW_LOG_CONFIG = Object.freeze({
  legalRegulatory: { tableHeading: '## Inventory' },
  clinical: { tableHeading: '## Content Inventory' },
  cosmeticChemistry: { tableHeading: '## Inventory' },
  privacySecurity: { tableHeading: '## Inventory' },
  ipFto: { tableHeading: '## Inventory' },
});

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validIsoDate(value) {
  const candidate = text(value);
  const match = candidate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const date = new Date(`${candidate}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) &&
    date.getUTCDate() === Number(match[3])
  );
}

function futureIsoDate(value) {
  const candidate = text(value);
  if (!validIsoDate(candidate)) return false;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return new Date(`${candidate}T00:00:00.000Z`).getTime() > todayUtc;
}

function withinRoot(rootDir, candidate) {
  const rel = relative(rootDir, candidate);
  return rel === '' || (!rel.startsWith('..') && !/^[A-Za-z]:/.test(rel));
}

function hashFile(path) {
  const bytes = readFileSync(path);
  return {
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function normalizeRepoPath(value) {
  return text(value).replaceAll('\\', '/').replace(/^\.\//, '');
}

function splitMarkdownRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function parseInventoryTable(markdown, tableHeading) {
  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === tableHeading);
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

function slug(value) {
  return text(value)
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function dispositionForStatus(status) {
  const normalized = text(status).toLowerCase();
  if (normalized === 'approved') return 'approved';
  if (normalized === 'deferred') return 'deferred';
  if (normalized === 'blocked') return 'blocked';
  if (normalized.includes('not cleared')) return 'notCleared';
  return 'needsReview';
}

function walkSourceFiles(rootDir, relativeDir, files = []) {
  const absoluteDir = resolve(rootDir, relativeDir);
  if (!withinRoot(rootDir, absoluteDir) || !existsSync(absoluteDir)) return files;
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const child = normalizeRepoPath(`${relativeDir}/${entry.name}`);
    if (entry.isDirectory()) walkSourceFiles(rootDir, child, files);
    if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(child);
  }
  return files;
}

function expectedSourcePaths(sourceText, rootDir) {
  return [...text(sourceText).matchAll(/`([^`]+)`/g)]
    .map((match) => normalizeRepoPath(match[1]))
    .flatMap((sourcePath) =>
      sourcePath.endsWith('/*')
        ? walkSourceFiles(rootDir, sourcePath.slice(0, -2)).sort((a, b) => a.localeCompare(b))
        : [sourcePath],
    );
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = text(item?.[key]);
    if (value) counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function compareCounts(label, actual, declared, errors) {
  const actualEntries = Object.entries(actual).sort(([a], [b]) => a.localeCompare(b));
  const declaredEntries = Object.entries(declared ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (JSON.stringify(actualEntries) !== JSON.stringify(declaredEntries)) {
    errors.push(`${label} does not match the worklist items.`);
  }
}

function validateFileRecord(record, label, rootDir, verifyHashes, errors) {
  if (!record || typeof record !== 'object') {
    errors.push(`${label} is missing its source record.`);
    return;
  }
  const sourcePath = text(record.path);
  if (!sourcePath || record.exists !== true) {
    errors.push(`${label} does not record an existing source path.`);
    return;
  }
  if (!verifyHashes) return;

  const absolutePath = resolve(rootDir, sourcePath);
  if (!withinRoot(rootDir, absolutePath)) {
    errors.push(`${label} escapes the repository root: ${sourcePath}.`);
    return;
  }
  if (!existsSync(absolutePath)) {
    errors.push(`${label} source is missing: ${sourcePath}.`);
    return;
  }
  if (!SHA256_RE.test(text(record.sha256))) {
    errors.push(`${label} has an invalid SHA-256 for ${sourcePath}.`);
    return;
  }

  const current = hashFile(absolutePath);
  if (current.sha256 !== text(record.sha256).toLowerCase()) {
    errors.push(`${label} source hash is stale: ${sourcePath}.`);
  }
  if (Number(record.bytes) !== current.bytes) {
    errors.push(`${label} source byte count is stale: ${sourcePath}.`);
  }
}

function validateReviewWorklist(worklist, options = {}) {
  const errors = [];
  const rootDir = resolve(options.rootDir ?? REPO_ROOT);
  const verifyHashes = options.verifyHashes !== false;
  const verifyLogRows = options.verifyLogRows ?? verifyHashes;

  if (!worklist || typeof worklist !== 'object' || Array.isArray(worklist)) {
    return ['Phase 3 review worklist is not a JSON object.'];
  }
  if (text(worklist.gitStatus)) {
    errors.push('Phase 3 review worklist was generated from a dirty worktree.');
  }
  if (!worklist.summary || typeof worklist.summary !== 'object') {
    errors.push('Phase 3 review worklist summary is missing.');
  }
  if (Number(worklist.summary?.blockerCount) !== 0) {
    errors.push('Phase 3 review worklist reports contract blockers.');
  }
  if (Number(worklist.summary?.missingSourcePathCount) !== 0) {
    errors.push('Phase 3 review worklist reports missing source paths.');
  }
  if (Number(worklist.summary?.warningCount) !== 0) {
    errors.push('Phase 3 review worklist summary reports warnings.');
  }
  if (Array.isArray(worklist.blockers) && worklist.blockers.length > 0) {
    errors.push('Phase 3 review worklist contains blocker details.');
  }
  if (Array.isArray(worklist.warnings) && worklist.warnings.length > 0) {
    errors.push('Phase 3 review worklist contains warnings.');
  }

  const items = Array.isArray(worklist.items) ? worklist.items : [];
  if (items.length === 0) errors.push('Phase 3 review worklist has no review items.');
  if (Number(worklist.summary?.itemCount) !== items.length) {
    errors.push('Phase 3 review worklist item count is inconsistent.');
  }

  const ids = new Set();
  for (const [index, item] of items.entries()) {
    const label = `Phase 3 review item ${index + 1}`;
    const id = text(item?.id);
    const domain = text(item?.domain);
    const disposition = text(item?.statusBucket);
    if (!id) errors.push(`${label} has no stable id.`);
    if (ids.has(id)) errors.push(`${label} duplicates id ${id}.`);
    ids.add(id);
    if (!REQUIRED_DOMAINS.includes(domain)) {
      errors.push(`${label} has unsupported review domain ${domain || '<missing>'}.`);
    }
    if (!RELEASE_DISPOSITIONS.has(disposition)) {
      errors.push(`${id || label} is unresolved (${disposition || 'missing disposition'}).`);
    }
    if (PLACEHOLDER_RE.test(text(item?.reviewer))) {
      errors.push(`${id || label} has no named reviewer or decision owner.`);
    }
    if (!validIsoDate(item?.date)) {
      errors.push(`${id || label} has no valid ISO review date.`);
    } else if (futureIsoDate(item?.date)) {
      errors.push(`${id || label} has a future review date.`);
    }
    if (disposition === 'deferred') {
      if (PLACEHOLDER_RE.test(text(item?.notes))) {
        errors.push(`${id || label} has no deferral reason.`);
      }
      if (
        !/(?:hidden|deferred|inert|disabled|excluded|not exposed|non-operational)/i.test(
          text(item?.currentBehavior),
        )
      ) {
        errors.push(`${id || label} does not document a production exposure gate.`);
      }
    }
    const sources = Array.isArray(item?.sourcePaths) ? item.sourcePaths : [];
    if (sources.length === 0 && verifyHashes) {
      errors.push(`${id || label} has no exact source-hash evidence.`);
    }
    for (const [sourceIndex, source] of sources.entries()) {
      validateFileRecord(
        source,
        `${id || label} source ${sourceIndex + 1}`,
        rootDir,
        verifyHashes,
        errors,
      );
    }
  }

  const domains = new Set(items.map((item) => text(item?.domain)));
  for (const domain of REQUIRED_DOMAINS) {
    if (!domains.has(domain)) errors.push(`Phase 3 review domain is missing: ${domain}.`);
  }
  compareCounts(
    'Phase 3 domain counts',
    countBy(items, 'domain'),
    worklist.summary?.domainCounts,
    errors,
  );
  compareCounts(
    'Phase 3 disposition counts',
    countBy(items, 'statusBucket'),
    worklist.summary?.statusCounts,
    errors,
  );

  const reviewLogs = Array.isArray(worklist.reviewLogs) ? worklist.reviewLogs : [];
  if (reviewLogs.length !== REQUIRED_DOMAINS.length) {
    errors.push('Phase 3 review worklist does not contain exactly five review logs.');
  }
  const logDomains = new Set(reviewLogs.map((log) => text(log?.domain)));
  for (const domain of REQUIRED_DOMAINS) {
    if (!logDomains.has(domain)) errors.push(`Phase 3 review log is missing: ${domain}.`);
  }
  for (const log of reviewLogs) {
    validateFileRecord(
      log,
      `Phase 3 ${text(log?.domain) || 'unknown'} review log`,
      rootDir,
      verifyHashes,
      errors,
    );

    if (!verifyLogRows) continue;
    const domain = text(log?.domain);
    const config = REVIEW_LOG_CONFIG[domain];
    const sourcePath = normalizeRepoPath(log?.path);
    const absolutePath = resolve(rootDir, sourcePath);
    if (!config || !withinRoot(rootDir, absolutePath) || !existsSync(absolutePath)) continue;
    const rows = parseInventoryTable(readFileSync(absolutePath, 'utf8'), config.tableHeading);
    if (rows.length === 0) {
      errors.push(`Phase 3 ${domain} review log has no parseable inventory.`);
      continue;
    }
    const domainItems = new Map(
      items.filter((item) => text(item?.domain) === domain).map((item) => [text(item?.id), item]),
    );
    if (domainItems.size !== rows.length) {
      errors.push(`Phase 3 ${domain} worklist item count does not match its review log.`);
    }
    for (const row of rows) {
      const id = `${domain}:${slug(row.Area)}`;
      const item = domainItems.get(id);
      if (!item) {
        errors.push(`Phase 3 ${domain} review row is missing from the worklist: ${row.Area}.`);
        continue;
      }
      if (text(item.statusBucket) !== dispositionForStatus(row.Status)) {
        errors.push(`${id} disposition does not match its review log.`);
      }
      if (text(item.reviewer) !== text(row.Reviewer) || text(item.date) !== text(row.Date)) {
        errors.push(`${id} reviewer/date does not match its review log.`);
      }
      if (text(item.sourceText) !== text(row.Source)) {
        errors.push(`${id} source declaration does not match its review log.`);
      }
      const declaredPaths = (Array.isArray(item.sourcePaths) ? item.sourcePaths : [])
        .map((source) => normalizeRepoPath(source?.path))
        .sort((a, b) => a.localeCompare(b));
      const expectedPaths = expectedSourcePaths(row.Source, rootDir).sort((a, b) =>
        a.localeCompare(b),
      );
      if (JSON.stringify(declaredPaths) !== JSON.stringify(expectedPaths)) {
        errors.push(`${id} source-path inventory does not match its review log.`);
      }
    }
  }

  return errors;
}

function loadReviewWorklist(path = DEFAULT_WORKLIST_PATH) {
  if (!existsSync(path)) throw new Error(`Phase 3 review worklist is missing: ${path}.`);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Phase 3 review worklist is invalid JSON: ${error.message}`);
  }
}

function createReleaseReadyTestWorklist() {
  const items = REQUIRED_DOMAINS.map((domain) => ({
    id: `${domain}:test-release-decision`,
    domain,
    statusBucket: 'approved',
    reviewer: `Qualified ${domain} reviewer`,
    date: '2026-07-09',
    currentBehavior: 'Approved for production.',
    notes: 'Test-only complete review decision.',
    sourcePaths: [],
  }));
  return {
    gitStatus: '',
    reviewLogs: REQUIRED_DOMAINS.map((domain) => ({
      domain,
      path: `test/${domain}.md`,
      exists: true,
    })),
    summary: {
      itemCount: items.length,
      domainCounts: Object.fromEntries(REQUIRED_DOMAINS.map((domain) => [domain, 1])),
      statusCounts: { approved: items.length },
      missingSourcePathCount: 0,
      blockerCount: 0,
      warningCount: 0,
    },
    items,
    blockers: [],
    warnings: [],
  };
}

function assertReleaseReadyReviewEvidence(options = {}) {
  const hasInjectedWorklist = options.worklist && typeof options.worklist === 'object';
  const worklist = hasInjectedWorklist ? options.worklist : loadReviewWorklist();
  const errors = validateReviewWorklist(worklist, {
    rootDir: options.rootDir,
    verifyHashes: options.verifyHashes ?? !hasInjectedWorklist,
  });
  if (errors.length > 0) {
    throw new Error(
      `Phase 3 review evidence is not release-ready: ${errors.slice(0, 6).join(' ')}`,
    );
  }
}

module.exports = {
  DEFAULT_WORKLIST_PATH,
  REQUIRED_DOMAINS,
  assertReleaseReadyReviewEvidence,
  createReleaseReadyTestWorklist,
  loadReviewWorklist,
  validateReviewWorklist,
};
