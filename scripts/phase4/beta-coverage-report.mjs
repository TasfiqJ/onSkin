#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import {
  command,
  gitStatusExcludingGeneratedEvidence,
  normalizeNamedSignoff,
  normalizeProductionUrl,
} from '../phase9/lib.mjs';
import { launchContractSnapshot, loadLaunchContract } from '../launch/contract.mjs';
import { parseCatalogControlJson } from './source-policy.mjs';

const root = process.cwd();
const launchContract = loadLaunchContract(root);
const strict = process.argv.includes('--strict');
const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const inputPath = resolve(
  root,
  process.env.PHASE4_BETA_COVERAGE_INPUT ??
    positional[0] ??
    'docs/phase-4/beta-coverage-input.json',
);
const jsonOutputPath = resolve(
  root,
  process.env.PHASE4_BETA_COVERAGE_REPORT ??
    positional[1] ??
    'docs/phase-4/generated/beta-coverage-report.json',
);
const mdOutputPath = jsonOutputPath.replace(/\.json$/i, '.md');
const reportOutputPaths = [jsonOutputPath, mdOutputPath].map((path) =>
  relative(root, path).replace(/\\/g, '/'),
);
const generatedOutputPaths = [
  ...reportOutputPaths,
  'docs/phase-4/generated/catalog-qa-report.json',
  'docs/phase-4/generated/catalog-qa-report.md',
];

const sourceHashPaths = [
  '.gitignore',
  'package.json',
  'docs/hugeToDo/launch-contract.json',
  'scripts/launch/contract.mjs',
  '.env.example',
  'scripts/phase4/build-source-worklist.mjs',
  'scripts/phase4/beta-coverage-report.mjs',
  'scripts/phase4/beta-coverage-report-smoke.mjs',
  'scripts/phase4/catalog-curation-contract.mjs',
  'scripts/phase4/catalog-curation-contract.test.mjs',
  'scripts/phase4/build-catalog-curation-envelope.mjs',
  'scripts/phase4/catalog-coverage-quality-report.mjs',
  'scripts/phase4/catalog-coverage-quality-report.test.mjs',
  'scripts/phase4/catalog-qa-report.mjs',
  'scripts/phase4/catalog-qa-report-smoke.mjs',
  'supabase/functions/catalog-report/index.ts',
  'supabase/functions/catalog-report/privacy.ts',
  'supabase/functions/catalog-report/privacy.test.ts',
  'supabase/functions/deno.lock',
  'scripts/phase9/lib.mjs',
  'docs/FOR_TAS_TO_DO.md',
  'docs/phase-3/consent-matrix.md',
  'docs/phase-3/data-inventory.md',
  'docs/store-privacy-inventory.md',
  'docs/phase-4/beta-coverage-input.template.json',
  'docs/phase-4/beta-shelf-corpus.template.json',
  'docs/phase-4/beta-coverage-report.md',
  'docs/phase-4/catalog-coverage-quality-targets.template.json',
  'docs/phase-4/catalog-curation-review.template.json',
  'docs/phase-4/catalog-cat02-membership-proof.template.json',
  'docs/phase-4/catalog-curation-database-readback.template.json',
  'docs/phase-4/catalog-curation-release-runbook.md',
  'docs/phase-4/generated/source-worklist.json',
  'docs/phase-4/generated/source-worklist.md',
  'docs/phase-4/observability-dashboard.md',
  'docs/phase-4/phase-4-exit-review.md',
  'supabase/migrations/20260717000058_catalog_launch_curation.sql',
  'supabase/tests/database/catalog_launch_curation.test.sql',
  'docs/phase-4/generated/catalog-qa-report.json',
  'docs/phase-4/generated/catalog-qa-report.md',
  'docs/phase-10/beta-event-schema.md',
  'docs/phase-10/catalog-beta-report.md',
  'docs/phase-10/support-beta-report.md',
  'docs/phase-10/retention-activation-report.md',
];

const PLACEHOLDER_TEXT = /^(?:tbd|todo|pending|sample|fixture|example|test|unknown|n\/a)$/i;
const PLACEHOLDER_FRAGMENT =
  /example\.com|localhost|\.local|\.test|\.invalid|fixture|sample|placeholder|replace|pending|tbd/i;

function repoRelative(path) {
  const candidate = relative(root, path).replace(/\\/g, '/');
  return candidate && !candidate.startsWith('..') ? candidate : path;
}

function hashAbsolute(path, label = repoRelative(path)) {
  if (!existsSync(path)) return { path: label, exists: false };
  const bytes = readFileSync(path);
  return {
    path: label,
    exists: true,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function hashRepoFile(path) {
  return hashAbsolute(resolve(root, path), path);
}

function gitStatusExcludingGeneratedReport() {
  return gitStatusExcludingGeneratedEvidence(generatedOutputPaths);
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function numberValue(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function proportionValue(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : null;
}

function textValue(value) {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function cleanText(value) {
  const text = textValue(value);
  if (!text || PLACEHOLDER_TEXT.test(text) || PLACEHOLDER_FRAGMENT.test(text)) return null;
  return text;
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function rate(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return numerator / denominator;
}

function percent(value) {
  return value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}

function count(value) {
  return Number.isFinite(value) ? String(value) : 'n/a';
}

function metricRow(label, value, threshold, status) {
  return `| ${label} | ${value} | ${threshold} | ${status} |`;
}

function isRealUrl(value) {
  return Boolean(normalizeProductionUrl(value));
}

const codeErrors = [];
const evidenceBlockers = [];
const warnings = [];
let input = null;
let parseError = null;

if (existsSync(inputPath)) {
  try {
    input = parseCatalogControlJson(readFileSync(inputPath), 'Legacy beta coverage input');
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }
}

if (!existsSync(inputPath)) {
  evidenceBlockers.push(
    'Missing beta coverage input artifact. Set PHASE4_BETA_COVERAGE_INPUT or copy docs/phase-4/beta-coverage-input.template.json to docs/phase-4/beta-coverage-input.json and replace it with real beta exports.',
  );
} else if (parseError) {
  evidenceBlockers.push(`Beta coverage input is not valid JSON: ${parseError}.`);
}

const packetInput = asObject(input);
const cohort = asObject(packetInput.cohort);
const catalog = asObject(packetInput.catalog);
const support = asObject(packetInput.support);
const evidence = asObject(packetInput.evidence);
const productAdd = asObject(packetInput.productAddCompletion);
const barcode = asObject(catalog.barcodeLookups);
const search = asObject(catalog.searches);
const ocr = asObject(catalog.ocr);
const manual = asObject(catalog.manualFallback);
const wrongMatch = asObject(catalog.wrongMatchReports);
const recommendations = asObject(catalog.recommendationEligibility);
const parser = asObject(catalog.parser);

const completedUsers =
  numberValue(cohort.completedUsers) ??
  numberValue(cohort.realTargetCompletedUsers) ??
  numberValue(packetInput.completedUsers);
const invitedUsers = numberValue(cohort.invitedUsers) ?? numberValue(cohort.totalInvited);
const targetUsers = numberValue(cohort.realTargetUsers) ?? completedUsers;
const usersAddedThreePlus =
  numberValue(productAdd.usersAddedThreePlusProducts) ??
  numberValue(cohort.usersAddedThreePlusProducts);
const productsAdded = numberValue(catalog.productsAdded) ?? numberValue(productAdd.productsAdded);
const barcodeTotal = numberValue(barcode.total);
const barcodeMatched = numberValue(barcode.matched);
const searchTotal = numberValue(search.total);
const searchMatched = numberValue(search.matched);
const ocrAttempts = numberValue(ocr.attempts) ?? numberValue(ocr.total);
const ocrParsed = numberValue(ocr.parsed);
const manualStarted = numberValue(manual.started);
const manualSaved = numberValue(manual.saved);
const wrongMatchTotal = numberValue(wrongMatch.total);
const wrongMatchOpen = numberValue(wrongMatch.open) ?? 0;
const wrongMatchTriaged = numberValue(wrongMatch.triaged) ?? 0;
const wrongMatchMatchedScans =
  numberValue(wrongMatch.matchedScans) ?? (barcodeMatched ?? 0) + (searchMatched ?? 0);
const wrongMatchRate = rate(wrongMatchTotal, wrongMatchMatchedScans);
const unknownTokenRate =
  proportionValue(parser.unknownTokenRate) ?? proportionValue(catalog.parserUnknownTokenRate);
const lowerThanUsableUsed =
  numberValue(recommendations.lowerThanUsableUsedInRecommendations) ??
  numberValue(catalog.lowerThanUsableUsedInRecommendations);
const supportTickets = numberValue(support.totalTickets);
const catalogSupportTickets = numberValue(support.catalogTickets);
const trustAccuracyTickets =
  numberValue(support.trustAccuracySourceConfusionTickets) ??
  numberValue(support.trustOrAccuracyTickets);
const openP0P1SupportTickets = numberValue(support.openP0P1Tickets) ?? 0;
const barcodeMatchRate = rate(barcodeMatched, barcodeTotal);
const searchSuccessRate = rate(searchMatched, searchTotal);
const manualCompletionRate = rate(manualSaved, manualStarted);
const ocrParseRate = rate(ocrParsed, ocrAttempts);
const averageProductsPerCompleted = rate(productsAdded, completedUsers);
const usersAddedThreePlusRate = rate(usersAddedThreePlus, completedUsers);
const topNoMatches = arrayValue(catalog.topNoMatches);
const topWrongMatches = arrayValue(catalog.topWrongMatches);
const topUnknownTokens = arrayValue(parser.topUnknownTokens ?? catalog.topUnknownTokens);
const categoryCoverage = arrayValue(catalog.categoryCoverage);
const expectedRecommendationProducts = arrayValue(catalog.expectedRecommendationProducts);
const realBetaData = evidence.realBetaData === true;
const signedOffBy = normalizeNamedSignoff(evidence.signedOffBy);
const dashboardUrl = normalizeProductionUrl(evidence.dashboardUrl ?? evidence.catalogDashboardUrl);
const supportDashboardUrl = normalizeProductionUrl(evidence.supportDashboardUrl);
const analyticsDashboardUrl = normalizeProductionUrl(evidence.analyticsDashboardUrl);
const sourceExportHash = /^[0-9a-f]{64}$/i.test(String(evidence.sourceExportHash ?? ''))
  ? String(evidence.sourceExportHash).toLowerCase()
  : null;

if (input) {
  evidenceBlockers.push(
    'Legacy beta coverage input is informational only and can never authorize CAT-03. Use the signed catalog-curation contract and privacy-minimized holdout report.',
  );
  if (!realBetaData) {
    evidenceBlockers.push(
      'Evidence must explicitly set evidence.realBetaData=true for real beta exports.',
    );
  }
  if (!dashboardUrl) evidenceBlockers.push('Missing real production catalog/beta dashboard URL.');
  if (!supportDashboardUrl) evidenceBlockers.push('Missing real production support dashboard URL.');
  if (!analyticsDashboardUrl)
    evidenceBlockers.push('Missing real production analytics dashboard URL.');
  if (!sourceExportHash) evidenceBlockers.push('Missing non-placeholder source export hash.');
  if (!signedOffBy) evidenceBlockers.push('Missing real named beta coverage signoff.');

  if (!Number.isFinite(completedUsers)) evidenceBlockers.push('Missing cohort.completedUsers.');
  else if (completedUsers < 50)
    evidenceBlockers.push('Closed beta completed users must be at least 50.');
  else if (completedUsers > 100) {
    warnings.push(
      'Closed beta completed users exceed the 50-100 target; segment the report by target cohort.',
    );
  }

  if (
    Number.isFinite(invitedUsers) &&
    Number.isFinite(completedUsers) &&
    completedUsers > invitedUsers
  ) {
    evidenceBlockers.push('Completed beta users cannot exceed invited users.');
  }
  if (
    Number.isFinite(targetUsers) &&
    Number.isFinite(completedUsers) &&
    completedUsers > targetUsers
  ) {
    evidenceBlockers.push('Completed beta users cannot exceed real target users.');
  }

  if (!Number.isFinite(usersAddedThreePlus)) {
    evidenceBlockers.push('Missing productAddCompletion.usersAddedThreePlusProducts.');
  } else if (Number.isFinite(completedUsers) && usersAddedThreePlus < completedUsers) {
    evidenceBlockers.push('Every completed beta user must have added at least 3 products.');
  }

  if (!Number.isFinite(productsAdded)) evidenceBlockers.push('Missing catalog.productsAdded.');
  else if (Number.isFinite(completedUsers) && productsAdded < completedUsers * 3) {
    evidenceBlockers.push(
      'Catalog products added must average at least 3 per completed beta user.',
    );
  }

  for (const [label, total, matched] of [
    ['barcode lookup', barcodeTotal, barcodeMatched],
    ['search', searchTotal, searchMatched],
  ]) {
    if (!Number.isFinite(total) || total <= 0)
      evidenceBlockers.push(`Beta must exercise ${label}.`);
    if (!Number.isFinite(matched)) evidenceBlockers.push(`Missing matched count for ${label}.`);
    if (Number.isFinite(total) && Number.isFinite(matched) && matched > total) {
      evidenceBlockers.push(`${label} matched count cannot exceed its total.`);
    }
  }

  if (!Number.isFinite(ocrAttempts) || ocrAttempts <= 0)
    evidenceBlockers.push('Beta must exercise OCR/label parsing.');
  if (!Number.isFinite(ocrParsed)) evidenceBlockers.push('Missing OCR parsed count.');
  if (Number.isFinite(ocrAttempts) && Number.isFinite(ocrParsed) && ocrParsed > ocrAttempts) {
    evidenceBlockers.push('OCR parsed count cannot exceed attempts.');
  }
  if (!Number.isFinite(manualStarted) || manualStarted <= 0) {
    evidenceBlockers.push('Beta must exercise manual fallback start.');
  }
  if (!Number.isFinite(manualSaved) || manualSaved <= 0) {
    evidenceBlockers.push('Beta must exercise manual fallback save.');
  }
  if (
    Number.isFinite(manualStarted) &&
    Number.isFinite(manualSaved) &&
    manualSaved > manualStarted
  ) {
    evidenceBlockers.push('Manual fallback saved count cannot exceed started count.');
  }

  if (!Number.isFinite(wrongMatchTotal)) evidenceBlockers.push('Missing wrong-match report total.');
  if (
    Number.isFinite(wrongMatchTotal) &&
    Number.isFinite(wrongMatchMatchedScans) &&
    wrongMatchTotal > wrongMatchMatchedScans
  ) {
    evidenceBlockers.push('Wrong-match total cannot exceed the matched-scan denominator.');
  }
  if (wrongMatchRate !== null && wrongMatchRate > 0.02) {
    evidenceBlockers.push('Wrong-match report rate exceeds the 2% Phase 4 alert threshold.');
  }
  if (wrongMatchOpen > 0)
    evidenceBlockers.push(
      'Open wrong-match reports must be resolved before beta coverage can pass.',
    );
  if (wrongMatchTriaged > 0 && lowerThanUsableUsed !== 0) {
    evidenceBlockers.push(
      'Triaged correction reports require explicit proof that affected products are excluded from recommendations.',
    );
  }
  if (wrongMatchTotal > 0 && topWrongMatches.length === 0) {
    evidenceBlockers.push('Wrong-match reports exist but topWrongMatches is empty.');
  }

  if (!Number.isFinite(unknownTokenRate))
    evidenceBlockers.push('Missing parser unknown-token rate.');
  else if (unknownTokenRate > 0.15) {
    evidenceBlockers.push('Parser unknown-token rate exceeds the 15% Phase 4 alert threshold.');
  }
  if (unknownTokenRate > 0 && topUnknownTokens.length === 0) {
    evidenceBlockers.push('Parser unknown tokens exist but topUnknownTokens is empty.');
  }

  if (!Number.isFinite(lowerThanUsableUsed)) {
    evidenceBlockers.push(
      'Missing recommendationEligibility.lowerThanUsableUsedInRecommendations.',
    );
  } else if (lowerThanUsableUsed > 0) {
    evidenceBlockers.push(
      'Products below usable quality must not be used in product-specific recommendations.',
    );
  }

  if (categoryCoverage.length === 0)
    evidenceBlockers.push('Missing catalog.categoryCoverage rows.');
  const seenCategories = new Set();
  for (const row of categoryCoverage) {
    const category = cleanText(row?.category) ?? 'unknown';
    const added = numberValue(row?.added);
    const matched = numberValue(row?.matched);
    if (!Number.isFinite(added) || !Number.isFinite(matched)) {
      evidenceBlockers.push(`Category ${category} is missing added/matched counts.`);
    } else if (matched > added) {
      evidenceBlockers.push(`Category ${category} matched count cannot exceed added count.`);
    } else if (added >= 5 && matched === 0) {
      evidenceBlockers.push(
        `Category ${category} has a beta catalog dead zone: 0 matches for ${added} added products.`,
      );
    }
    const categoryKey = category.toLocaleLowerCase('en-US');
    if (seenCategories.has(categoryKey)) {
      evidenceBlockers.push(`Category ${category} appears more than once.`);
    }
    seenCategories.add(categoryKey);
  }

  if (topNoMatches.length === 0)
    evidenceBlockers.push('Missing top no-match barcode/product list.');
  if (expectedRecommendationProducts.length === 0) {
    evidenceBlockers.push('Missing products users expected recommendations for.');
  }

  if (!Number.isFinite(supportTickets)) evidenceBlockers.push('Missing support.totalTickets.');
  if (!Number.isFinite(catalogSupportTickets))
    evidenceBlockers.push('Missing support.catalogTickets.');
  if (!Number.isFinite(trustAccuracyTickets)) {
    evidenceBlockers.push('Missing support trust/accuracy/source-confusion ticket count.');
  }
  if (openP0P1SupportTickets > 0)
    evidenceBlockers.push('Open P0/P1 support tickets block beta coverage.');
}

const sourceHashes = sourceHashPaths.map(hashRepoFile);
for (const sourceHash of sourceHashes) {
  if (!sourceHash.exists) codeErrors.push(`Missing source hash input ${sourceHash.path}.`);
}

let gitSha = 'unknown';
let gitStatus = 'unknown';
try {
  gitSha = command('git', ['rev-parse', 'HEAD']).trim();
  gitStatus = gitStatusExcludingGeneratedReport();
} catch {
  warnings.push('Git SHA/status could not be captured.');
}
if (gitStatus.length > 0) {
  warnings.push(
    'Beta coverage report generated with a dirty Git worktree; do not use it as final beta evidence.',
  );
}

const inputArtifact = hashAbsolute(inputPath);
const metrics = {
  invitedUsers,
  targetUsers,
  completedUsers,
  usersAddedThreePlus,
  usersAddedThreePlusRate,
  productsAdded,
  averageProductsPerCompleted,
  barcodeTotal,
  barcodeMatched,
  barcodeMatchRate,
  searchTotal,
  searchMatched,
  searchSuccessRate,
  ocrAttempts,
  ocrParsed,
  ocrParseRate,
  manualStarted,
  manualSaved,
  manualCompletionRate,
  wrongMatchTotal,
  wrongMatchMatchedScans,
  wrongMatchRate,
  unknownTokenRate,
  lowerThanUsableUsed,
  supportTickets,
  catalogSupportTickets,
  trustAccuracyTickets,
  openP0P1SupportTickets,
};

const report = {
  generatedAt: new Date().toISOString(),
  launchContract: launchContractSnapshot(launchContract),
  inputPath: repoRelative(inputPath),
  gitSha,
  gitStatus,
  inputArtifact,
  sourceHashes,
  status:
    codeErrors.length === 0 && evidenceBlockers.length === 0 && warnings.length === 0
      ? 'ready'
      : 'blocked',
  strict,
  metrics,
  evidence: {
    realBetaDataClaimed: realBetaData,
    dashboardEvidencePresent: Boolean(dashboardUrl),
    supportDashboardEvidencePresent: Boolean(supportDashboardUrl),
    analyticsDashboardEvidencePresent: Boolean(analyticsDashboardUrl),
    sourceExportDigestPresent: Boolean(sourceExportHash),
    namedSignoffPresent: Boolean(signedOffBy),
  },
  privacy: {
    classification: 'minimized-aggregate-only',
    rawShelfLabelsCommitted: false,
    dashboardUrlsCommitted: false,
  },
  aggregateDetailCounts: {
    categoryRows: categoryCoverage.length,
    noMatchRows: topNoMatches.length,
    wrongMatchRows: topWrongMatches.length,
    unknownTokenRows: topUnknownTokens.length,
    expectedRecommendationRows: expectedRecommendationProducts.length,
  },
  codeErrors,
  evidenceBlockers,
  warnings,
  localBetaCoverageClear: false,
};

mkdirSync(dirname(jsonOutputPath), { recursive: true });
writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`);

const metricRows = [
  metricRow(
    'Completed beta users',
    count(completedUsers),
    '50-100 real target users',
    completedUsers >= 50 ? 'ok' : 'blocked',
  ),
  metricRow(
    'Users with 3+ products',
    count(usersAddedThreePlus),
    'all completed users',
    usersAddedThreePlusRate === 1 ? 'ok' : 'blocked',
  ),
  metricRow(
    'Average products per completed user',
    averageProductsPerCompleted === null ? 'n/a' : averageProductsPerCompleted.toFixed(2),
    '>= 3.00',
    averageProductsPerCompleted >= 3 ? 'ok' : 'blocked',
  ),
  metricRow(
    'Barcode match rate',
    percent(barcodeMatchRate),
    'exercised and trended by category',
    barcodeTotal > 0 ? 'tracked' : 'blocked',
  ),
  metricRow(
    'Search success rate',
    percent(searchSuccessRate),
    'no major category dead zone',
    searchTotal > 0 ? 'tracked' : 'blocked',
  ),
  metricRow(
    'OCR parse rate',
    percent(ocrParseRate),
    'low-confidence routed to review',
    ocrAttempts > 0 ? 'tracked' : 'blocked',
  ),
  metricRow(
    'Manual fallback completion',
    percent(manualCompletionRate),
    'fallback saves exercised',
    manualSaved > 0 ? 'tracked' : 'blocked',
  ),
  metricRow(
    'Wrong-match report rate',
    percent(wrongMatchRate),
    '<= 2%',
    wrongMatchRate !== null && wrongMatchRate <= 0.02 ? 'ok' : 'blocked',
  ),
  metricRow(
    'Parser unknown-token rate',
    percent(unknownTokenRate),
    '<= 15%',
    unknownTokenRate !== null && unknownTokenRate <= 0.15 ? 'ok' : 'blocked',
  ),
  metricRow(
    'Below-usable products used in recs',
    count(lowerThanUsableUsed),
    '0',
    lowerThanUsableUsed === 0 ? 'ok' : 'blocked',
  ),
  metricRow(
    'Open P0/P1 support tickets',
    count(openP0P1SupportTickets),
    '0',
    openP0P1SupportTickets === 0 ? 'ok' : 'blocked',
  ),
].join('\n');

const sourceRows = sourceHashes
  .map((sourceHash) =>
    sourceHash.exists
      ? `| ${sourceHash.path} | present | ${sourceHash.bytes} | ${sourceHash.sha256} |`
      : `| ${sourceHash.path} | missing |  |  |`,
  )
  .join('\n');
const dirtyDetails = gitStatus.length ? `\nDirty paths:\n\n\`\`\`\n${gitStatus}\n\`\`\`\n\n` : '\n';

writeFileSync(
  mdOutputPath,
  [
    '# Phase 4 Beta Coverage Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status}`,
    `Git SHA: ${report.gitSha}`,
    `Git status: ${report.gitStatus.length ? 'DIRTY' : 'clean'}`,
    dirtyDetails.trimEnd(),
    '',
    '## Verdict',
    '',
    `Local beta coverage clear: ${report.localBetaCoverageClear ? 'yes' : 'no'}`,
    '',
    'This legacy aggregate report is informational and can never be launch-clear.',
    'CAT-03 authority requires the signed catalog-curation contract, a minimized',
    'sealed holdout report, and an active database curation revision.',
    '',
    '## Evidence',
    '',
    `- Real beta data claimed: ${report.evidence.realBetaDataClaimed ? 'yes' : 'BLOCKED'}`,
    `- Catalog/beta dashboard evidence present: ${report.evidence.dashboardEvidencePresent ? 'yes' : 'BLOCKED'}`,
    `- Analytics dashboard evidence present: ${report.evidence.analyticsDashboardEvidencePresent ? 'yes' : 'BLOCKED'}`,
    `- Support dashboard evidence present: ${report.evidence.supportDashboardEvidencePresent ? 'yes' : 'BLOCKED'}`,
    `- Exact source export digest present: ${report.evidence.sourceExportDigestPresent ? 'yes' : 'BLOCKED'}`,
    `- Named signoff present: ${report.evidence.namedSignoffPresent ? 'yes' : 'BLOCKED'}`,
    '',
    '## Metrics',
    '',
    '| Metric | Value | Threshold | Status |',
    '| --- | ---: | --- | --- |',
    metricRows,
    '',
    '## Blockers',
    '',
    ...(codeErrors.length > 0 ? codeErrors.map((item) => `- ${item}`) : []),
    ...(evidenceBlockers.length > 0
      ? evidenceBlockers.map((item) => `- ${item}`)
      : codeErrors.length === 0
        ? ['- None.']
        : []),
    '',
    '## Warnings',
    '',
    ...(warnings.length > 0 ? warnings.map((item) => `- ${item}`) : ['- None.']),
    '',
    '## Input Artifact',
    '',
    '| Path | Status | Bytes | SHA-256 |',
    '| --- | --- | ---: | --- |',
    inputArtifact.exists
      ? `| ${inputArtifact.path} | present | ${inputArtifact.bytes} | ${inputArtifact.sha256} |`
      : `| ${inputArtifact.path} | missing |  |  |`,
    '',
    '## Source Hashes',
    '',
    '| Path | Status | Bytes | SHA-256 |',
    '| --- | --- | ---: | --- |',
    sourceRows,
    '',
  ].join('\n'),
);

console.log(`Wrote ${repoRelative(jsonOutputPath)}`);
console.log(
  `Status ${report.status}; blockers ${codeErrors.length + evidenceBlockers.length}; warnings ${warnings.length}.`,
);

if (codeErrors.length > 0) {
  for (const error of codeErrors) console.error(`FAIL ${error}`);
  process.exit(1);
}

if (strict && (evidenceBlockers.length > 0 || warnings.length > 0)) {
  for (const blocker of evidenceBlockers) console.error(`FAIL ${blocker}`);
  for (const warning of warnings) console.warn(`WARN ${warning}`);
  process.exit(1);
}
