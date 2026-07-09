#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { command, gitStatusExcludingGeneratedEvidence } from '../phase9/lib.mjs';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const check = process.argv.includes('--check');
const outJson =
  process.env.PHASE4_SOURCE_WORKLIST_JSON ?? 'docs/phase-4/generated/source-worklist.json';
const outMd =
  process.env.PHASE4_SOURCE_WORKLIST_MD ?? 'docs/phase-4/generated/source-worklist.md';
const outputPaths = [outJson, outMd].map((path) => normalizeRepoPath(path));
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.sql']);

const workItems = [
  {
    id: 'source-identity',
    domain: 'sourceReview',
    area: 'Final catalog API identity and attribution surface',
    status: 'blocked',
    launchGate: 'B-CATALOG-SOURCE-REVIEW',
    owner: 'Founder + counsel + engineering',
    requiredEvidence: [
      'Final cleared app name, production version, support email, and attribution URL.',
      '`phase4:check-source-env:strict` passes with production values.',
      'Counsel-approved public source/attribution copy under the final brand domain.',
    ],
    sources: [
      '.env.example',
      'scripts/phase4/check-source-env.mjs',
      'docs/phase-4/catalog-source-memo-open-beauty-facts.md',
      'docs/phase-4/catalog-source-memo-cosing.md',
      'docs/phase-4/phase-4-exit-review.md',
      'docs/FOR_TAS_TO_DO.md',
    ],
  },
  {
    id: 'obf-odbl-posture',
    domain: 'sourceReview',
    area: 'Open Beauty Facts and ODbL launch posture',
    status: 'blocked',
    launchGate: 'B-ODBL-REVIEW',
    owner: 'Counsel + engineering',
    requiredEvidence: [
      'Counsel records whether OBF data can be used for the launch catalog and under what attribution/share-alike obligations.',
      'Product images remain disabled unless image rights are separately approved.',
      'Bulk import uses approved export artifacts, not API crawling or search-as-you-type scraping.',
    ],
    sources: [
      'docs/phase-4/catalog-source-memo-open-beauty-facts.md',
      'docs/phase-4/odbl-compliance-memo.md',
      'scripts/phase4/import-obf-snapshot.mjs',
      'scripts/phase4/catalog-qa-report.mjs',
      'supabase/migrations/20260614000026_phase4_catalog.sql',
      'supabase/functions/catalog-lookup/index.ts',
      'supabase/functions/catalog-search/index.ts',
      'supabase/functions/catalog-report/index.ts',
    ],
  },
  {
    id: 'cosing-reuse-taxonomy',
    domain: 'sourceReview',
    area: 'CosIng reuse and ingredient-tag taxonomy',
    status: 'blocked',
    launchGate: 'B-CATALOG-SOURCE-REVIEW',
    owner: 'Counsel + cosmetic chemist',
    requiredEvidence: [
      'Counsel records CosIng reuse and attribution obligations.',
      'Cosmetic chemist signs the ingredient-tag taxonomy and confirms CosIng is not presented as product-level approval.',
      'Parser import artifact records snapshot date, parser version, and QA output hash.',
    ],
    sources: [
      'docs/phase-4/catalog-source-memo-cosing.md',
      'docs/phase-4/ingredient-tag-taxonomy.md',
      'scripts/phase4/import-cosing-dictionary.mjs',
      'apps/mobile/src/features/catalog/ingredientParser.ts',
      'apps/mobile/src/features/catalog/ingredientParser.test.ts',
      'apps/mobile/src/features/intelligence/tags.ts',
      'apps/mobile/src/features/intelligence/tags.test.ts',
    ],
  },
  {
    id: 'curated-first-batch',
    domain: 'curation',
    area: 'First curated launch product batch',
    status: 'blocked',
    launchGate: 'B-CURATED-CATALOG',
    owner: 'Founder + catalog operator + clinical reviewers',
    requiredEvidence: [
      'Approved source exports and real beta shelf input drive the first batch; fixtures are not production data.',
      'Recommendable rows are `verified` or `usable`, reviewed, and correction-free.',
      'Sunscreen/OTC-adjacent rows have separate source, expiry, and reviewer handling.',
    ],
    sources: [
      'docs/phase-4/curated-product-curation-sheet.md',
      'docs/phase-4/first-curated-product-batch.md',
      'scripts/phase4/fixtures/curated-products.sample.json',
      'apps/mobile/src/features/catalog/quality.ts',
      'apps/mobile/src/features/catalog/quality.test.ts',
      'apps/mobile/src/features/recommendations/catalog.ts',
      'apps/mobile/src/features/recommendations/claimsafety.test.ts',
    ],
  },
  {
    id: 'import-qa',
    domain: 'curation',
    area: 'Import QA and generated catalog evidence',
    status: 'local-scaffold',
    launchGate: 'B-CATALOG-SEED',
    owner: 'Engineering + catalog operator',
    requiredEvidence: [
      'Production import artifact hash, source snapshot date, and parser version are archived.',
      '`phase4:qa-report` has zero blockers against the approved import artifact.',
      'Generated packet status audit reports no dirty packet text and no stale source hashes.',
    ],
    sources: [
      'scripts/phase4/catalog-qa-report.mjs',
      'scripts/phase4/catalog-qa-report-smoke.mjs',
      'scripts/phase4/import-obf-snapshot.mjs',
      'scripts/phase4/import-cosing-dictionary.mjs',
      'scripts/docs/generated-packet-status-audit.mjs',
      'docs/phase-4/generated/catalog-qa-report.json',
      'docs/phase-4/generated/catalog-qa-report.md',
    ],
  },
  {
    id: 'beta-coverage',
    domain: 'betaEvidence',
    area: 'Closed-beta catalog coverage and correction loop',
    status: 'blocked',
    launchGate: 'B-CATALOG-COVERAGE',
    owner: 'Founder + engineering + support',
    requiredEvidence: [
      '50-100 real target users add at least three products each.',
      'Barcode, search, OCR, and manual fallback are all exercised and reported.',
      'Wrong-match rate, parser unknown-token rate, catalog support tickets, and top gaps are triaged.',
      '`phase4:beta-coverage-report:strict` passes only with real beta exports and named signoff.',
    ],
    sources: [
      'docs/phase-4/beta-coverage-report.md',
      'scripts/phase4/beta-coverage-report.mjs',
      'scripts/phase4/beta-coverage-report-smoke.mjs',
      'docs/phase-10/catalog-beta-report.md',
      'docs/phase-10/support-beta-report.md',
      'docs/phase-10/retention-activation-report.md',
      'docs/FOR_TAS_TO_DO.md',
    ],
  },
  {
    id: 'mobile-catalog-disclosure',
    domain: 'productSurface',
    area: 'Mobile catalog source, quality, and report-issue disclosure',
    status: 'local-scaffold',
    launchGate: 'B-CATALOG-SEED',
    owner: 'Engineering + counsel',
    requiredEvidence: [
      'Product detail and shelf flows show source/quality without implying completeness or endorsement.',
      'Wrong-match reporting stays route-owned and privacy-safe.',
      'Product-specific recommendations remain blocked for below-usable, unreviewed, or correction-open rows.',
    ],
    sources: [
      'apps/mobile/src/features/catalog/*',
      'apps/mobile/src/features/shelf/*',
      'apps/mobile/src/app/shelf/[id].tsx',
      'apps/mobile/src/app/shelf/search.tsx',
      'apps/mobile/src/app/shelf/manual.tsx',
      'apps/mobile/src/features/recommendations/*',
    ],
  },
  {
    id: 'obf-contribution-back',
    domain: 'operations',
    area: 'Unmatched-product contribution-back operation',
    status: 'blocked',
    launchGate: 'B-SHELF-CONTRIB',
    owner: 'Counsel + catalog operator + engineering',
    requiredEvidence: [
      'Contribution-back account, credentials, moderation/validation owner, and retry policy are approved.',
      'User-facing copy does not promise contribution-back unless the queue job is live and legally approved.',
      'No personal shelf/profile data is sent as contribution-back payload.',
    ],
    sources: [
      'docs/phase-4/odbl-compliance-memo.md',
      'docs/04-smart-shelf.md',
      'supabase/migrations/20260614000026_phase4_catalog.sql',
      'supabase/functions/catalog-report/index.ts',
      'apps/mobile/src/features/catalog/client.ts',
      'apps/mobile/src/features/catalog/client.test.ts',
      'docs/FOR_TAS_TO_DO.md',
    ],
  },
  {
    id: 'observability-support',
    domain: 'operations',
    area: 'Catalog dashboards, alerts, and support feedback loop',
    status: 'blocked',
    launchGate: 'B-CATALOG-COVERAGE',
    owner: 'Founder + support + engineering',
    requiredEvidence: [
      'Production catalog, analytics, and support dashboards exist under the final brand/account setup.',
      'Catalog miss, wrong-match, correction status, parser unknown-token, and support-ticket metrics are reviewed weekly during beta.',
      'Open P0/P1 catalog trust issues are zero before public launch.',
    ],
    sources: [
      'docs/phase-4/observability-dashboard.md',
      'docs/phase-4/beta-coverage-report.md',
      'docs/phase-10/support-operations.md',
      'docs/phase-10/support-beta-report.md',
      'scripts/phase4/beta-coverage-report.mjs',
      'docs/FOR_TAS_TO_DO.md',
    ],
  },
];

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
    `### ${item.id} - ${item.area}`,
    '',
    `- Domain: ${item.domain}`,
    `- Status: ${item.status}`,
    `- Launch gate: ${item.launchGate}`,
    `- Owner: ${item.owner}`,
    '',
    'Required evidence:',
    '',
    ...item.requiredEvidence.map((entry) => `- ${entry}`),
    '',
    'Sources:',
    '',
    ...item.sourcePaths.map(sourceLine),
    '',
  ].join('\n');
}

function gitStatusExcludingGeneratedWorklist() {
  return gitStatusExcludingGeneratedEvidence(outputPaths);
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
    console.error(`FAIL Missing ${path}. Run npm run phase4:source-worklist.`);
    return false;
  }
  if (normalize(read(path)) !== normalize(expectedContent)) {
    console.error(`FAIL ${path} is stale. Run npm run phase4:source-worklist.`);
    return false;
  }
  return true;
}

const blockers = [];
const warnings = [];
let gitSha = 'unknown';
let gitStatus = 'unknown';
try {
  gitSha = command('git', ['rev-parse', 'HEAD']).trim();
  gitStatus = gitStatusExcludingGeneratedWorklist();
} catch {
  warnings.push('Git SHA/status could not be captured.');
}
if (gitStatus.length > 0) {
  warnings.push(
    'Phase 4 source worklist generated with a dirty Git worktree; do not use it as final catalog-source evidence.',
  );
}

const items = workItems.map((item) => {
  const sourcePaths = item.sources.flatMap(expandSourcePath).map(fileRecord);
  for (const source of sourcePaths.filter((source) => !source.exists)) {
    blockers.push(`${item.id} references missing source ${source.path}.`);
  }
  if (item.requiredEvidence.length === 0) {
    blockers.push(`${item.id} has no required evidence entries.`);
  }
  return { ...item, sourcePaths };
});

const domainCounts = items.reduce((acc, item) => {
  acc[item.domain] = (acc[item.domain] ?? 0) + 1;
  return acc;
}, {});
const statusCounts = items.reduce((acc, item) => {
  acc[item.status] = (acc[item.status] ?? 0) + 1;
  return acc;
}, {});
const sourcePathCount = items.reduce((total, item) => total + item.sourcePaths.length, 0);
const missingSourcePathCount = items.reduce(
  (total, item) => total + item.sourcePaths.filter((source) => !source.exists).length,
  0,
);

const worklist = {
  generatedAt: new Date().toISOString(),
  purpose:
    'Machine-readable Phase 4 catalog source, curation, beta coverage, and operations worklist.',
  strict,
  gitSha,
  gitStatus,
  summary: {
    itemCount: items.length,
    domainCounts,
    statusCounts,
    sourcePathCount,
    missingSourcePathCount,
    blockerCount: blockers.length,
    warningCount: warnings.length,
  },
  items,
  blockers,
  warnings,
};

const jsonContent = `${JSON.stringify(worklist, null, 2)}\n`;
const mdContent = [
  '# Phase 4 Catalog Source Worklist',
  '',
  `Generated: ${worklist.generatedAt}`,
  `Status: ${blockers.length === 0 ? 'pass' : 'blocked'}`,
  `Git SHA: ${worklist.gitSha}`,
  `Git status: ${worklist.gitStatus ? 'DIRTY' : 'clean'}`,
  '',
  'This generated worklist is an operator handoff for the catalog/source launch',
  'gate. It does not approve any catalog source, product batch, beta metric, or',
  'recommendation use. It records the evidence Tas/counsel/reviewers/operators',
  'must attach before Phase 4 can stop blocking launch.',
  '',
  '## Summary',
  '',
  `- Work items: ${worklist.summary.itemCount}`,
  `- Source files hashed: ${worklist.summary.sourcePathCount}`,
  `- Missing source files: ${worklist.summary.missingSourcePathCount}`,
  `- Blockers: ${worklist.summary.blockerCount}`,
  `- Warnings: ${worklist.summary.warningCount}`,
  '',
  '## Items',
  '',
  markdownTable(
    ['ID', 'Domain', 'Area', 'Status', 'Launch gate', 'Sources', 'Missing sources'],
    items.map((item) => [
      item.id,
      item.domain,
      item.area,
      item.status,
      item.launchGate,
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
  console.log('Phase 4 source worklist is current.');
  console.log('Phase 4 source worklist passed.');
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
console.log('Phase 4 source worklist passed.');
