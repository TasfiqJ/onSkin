#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const check = process.argv.includes('--check');

const launchReadinessPath = 'LAUNCH_READINESS.md';
const blockersPath = 'BLOCKERS.md';
const progressPath = 'PROGRESS.md';
const packagePath = 'package.json';
const humanE2eManifestPath = 'docs/e2e/generated/human-e2e-manifest.json';
const outJson =
  process.env.READINESS_STATUS_AUDIT_JSON ?? 'docs/generated/readiness-status-audit.json';
const outMd = process.env.READINESS_STATUS_AUDIT_MD ?? 'docs/generated/readiness-status-audit.md';

const expectedMobileTestFiles = Number(process.env.READINESS_TEST_FILES ?? 171);
const expectedMobileTests = Number(process.env.READINESS_TESTS ?? 1760);

const staleTestPatterns = [
  /\b170\s+(?:mobile\s+)?test files?\b/i,
  /\b1743\s+tests?\b/i,
  /\b1744\s+tests?\b/i,
  /\b1748\s+tests?\b/i,
  /\b1751\s+tests?\b/i,
  /320 x 480 support-floor 200%\s+text-pressure/i,
  /support-floor\s+170%\s+text-pressure/i,
];

const requiredManifestNeedles = [
  '360 x 640 launch-floor 200% text-pressure',
  '360 x 740',
  '375 x 812',
  '390 x 844',
  '412 x 915',
  '414 x 896',
  '430 x 932',
  'API 36',
  'text-pressure-200-supported-360-640-postfix',
  'text-pressure-200-android-360-740-postfix',
  'text-pressure-200-iphone-375-812-postfix',
  'text-pressure-200-android-412-915-postfix2',
  'text-pressure-200-boundary-414-896-postfix3',
];

const requiredLaunchCommands = [
  'npm run launch:verify',
  'npm run typecheck',
  'npm run lint',
  'npm test',
  'npm run docs:source-packet-audit:check',
  'npm run docs:tas-todo-audit:check',
  'npm run e2e:human:manifest:check',
  'npm run docs:generated-packet-status-audit:check',
  'npm run phase9:verify',
  'npm run phase10-11:verify',
];

const requiredPackageScripts = [
  'launch:verify',
  'docs:readiness-status-audit',
  'docs:readiness-status-audit:strict',
  'docs:readiness-status-audit:check',
];

const requiredLaunchVerifyScriptParts = [
  'docs:source-packet-audit:check',
  'docs:tas-todo-audit:check',
  'docs:readiness-status-audit:check',
  'docs:generated-packet-status-audit:check',
  'e2e:human:manifest:check',
  'phase9:release-smoke',
  'phase10:beta-readiness',
  'phase11:launch-readiness',
  'phase11:ring-gates',
  'typecheck',
  'lint',
  'test',
];

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

function readJson(path) {
  return JSON.parse(read(path));
}

function walkFiles(path) {
  if (!exists(path)) return [];
  return readdirSync(abs(path), { withFileTypes: true }).flatMap((entry) => {
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
    console.error(`FAIL Missing ${path}. Run npm run docs:readiness-status-audit:strict.`);
    return false;
  }
  const current = read(path);
  if (normalize(current) !== normalize(expectedContent)) {
    console.error(`FAIL ${path} is stale. Run npm run docs:readiness-status-audit:strict.`);
    return false;
  }
  return true;
}

function extractDate(text) {
  return text.match(/^Date:\s*(\d{4}-\d{2}-\d{2})$/m)?.[1] ?? null;
}

function matchingStalePatterns(text) {
  return staleTestPatterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => String(pattern));
}

const blockers = [];
const warnings = [];

for (const path of [launchReadinessPath, blockersPath, progressPath, packagePath]) {
  if (!exists(path)) blockers.push(`Missing ${path}.`);
}
if (!exists(humanE2eManifestPath)) blockers.push(`Missing ${humanE2eManifestPath}.`);

const launchText = exists(launchReadinessPath) ? read(launchReadinessPath) : '';
const blockersText = exists(blockersPath) ? read(blockersPath) : '';
const progressText = exists(progressPath) ? read(progressPath) : '';
const packageJson = exists(packagePath) ? readJson(packagePath) : { scripts: {} };
const humanManifest = exists(humanE2eManifestPath) ? readJson(humanE2eManifestPath) : {};

const evidenceDate = String(humanManifest.evidenceDate ?? '').trim();
if (!/^\d{4}-\d{2}-\d{2}$/.test(evidenceDate)) {
  blockers.push(`${humanE2eManifestPath} does not expose a valid evidenceDate.`);
}
if (humanManifest.status !== 'pass') {
  blockers.push(`${humanE2eManifestPath} status is ${humanManifest.status ?? 'missing'}.`);
}

const actualMobileTestFiles = walkFiles('apps/mobile').filter(
  (path) => /\.test\.(?:ts|tsx)$/.test(path) || /\.spec\.(?:ts|tsx)$/.test(path),
).length;

if (actualMobileTestFiles !== expectedMobileTestFiles) {
  blockers.push(
    `Expected ${expectedMobileTestFiles} mobile test files, but found ${actualMobileTestFiles}. Update READINESS_TEST_FILES and source-of-truth docs after running npm test.`,
  );
}

const expectedTestPhrase = `${expectedMobileTestFiles} mobile test files / ${expectedMobileTests} tests`;
const expectedWorkspaceTestPhrase = `${expectedMobileTestFiles} test files / ${expectedMobileTests} tests`;

const docs = [
  { path: launchReadinessPath, text: launchText, requireCommands: true },
  { path: blockersPath, text: blockersText, requireCommands: false },
];

const docResults = docs.map((doc) => {
  const date = extractDate(doc.text);
  const stalePatterns = matchingStalePatterns(doc.text);
  const hasExpectedTestPhrase =
    doc.text.includes(expectedTestPhrase) || doc.text.includes(expectedWorkspaceTestPhrase);
  const missingManifestNeedles = requiredManifestNeedles.filter(
    (needle) => !doc.text.includes(needle),
  );
  const missingCommands = doc.requireCommands
    ? requiredLaunchCommands.filter((command) => !doc.text.includes(command))
    : [];

  if (evidenceDate && date !== evidenceDate) {
    blockers.push(`${doc.path} Date is ${date ?? 'missing'}, expected ${evidenceDate}.`);
  }
  if (stalePatterns.length > 0) {
    blockers.push(`${doc.path} contains stale test-count pattern(s): ${stalePatterns.join(', ')}.`);
  }
  if (!hasExpectedTestPhrase) {
    blockers.push(`${doc.path} does not mention current test baseline ${expectedTestPhrase}.`);
  }
  for (const command of missingCommands) {
    blockers.push(`${doc.path} does not mention ${command}.`);
  }
  for (const needle of missingManifestNeedles) {
    blockers.push(`${doc.path} does not mention current human-E2E manifest evidence: ${needle}.`);
  }

  return {
    path: doc.path,
    date,
    expectedDate: evidenceDate,
    hasExpectedTestPhrase,
    missingManifestNeedles,
    stalePatterns,
    missingCommands,
  };
});

for (const command of requiredPackageScripts) {
  if (!Object.hasOwn(packageJson.scripts ?? {}, command)) {
    blockers.push(`${packagePath} is missing ${command}.`);
  }
}

const launchVerifyScript = String(packageJson.scripts?.['launch:verify'] ?? '');
for (const scriptPart of requiredLaunchVerifyScriptParts) {
  if (!launchVerifyScript.includes(scriptPart)) {
    blockers.push(`${packagePath} launch:verify is missing ${scriptPart}.`);
  }
}

if (!progressText.includes('readiness-status-audit')) {
  warnings.push(`${progressPath} does not mention the readiness status audit yet.`);
}

const audit = {
  generatedAt: new Date().toISOString(),
  status: blockers.length === 0 ? 'pass' : 'blocked',
  strict,
  purpose:
    'Audit source-of-truth launch readiness docs for current evidence dates, non-mutating verification commands, and stale test-count baselines.',
  evidenceDate,
  humanE2eManifestPath,
  expectedMobileTestFiles,
  expectedMobileTests,
  actualMobileTestFiles,
  expectedTestPhrase,
  docs: docResults,
  requiredLaunchCommands,
  requiredPackageScripts,
  requiredLaunchVerifyScriptParts,
  summary: {
    blockerCount: blockers.length,
    warningCount: warnings.length,
    checkedDocCount: docResults.length,
  },
  blockers,
  warnings,
};

const jsonContent = `${JSON.stringify(audit, null, 2)}\n`;

const mdContent = [
  '# Readiness Status Audit',
  '',
  `Generated: ${audit.generatedAt}`,
  `Status: ${audit.status}`,
  `Strict mode: ${strict ? 'yes' : 'no'}`,
  '',
  'This generated audit keeps the launch source-of-truth docs aligned with',
  'the latest committed human-simulated E2E evidence and current verification',
  'baseline. It intentionally checks documentation freshness only; it does not',
  'replace the launch gates, physical-device QA, live Supabase, RevenueCat,',
  'store, legal, clinical, beta, or launch signoff evidence.',
  '',
  '## Summary',
  '',
  `- Evidence date: ${audit.evidenceDate || 'missing'}`,
  `- Expected mobile test baseline: ${audit.expectedTestPhrase}`,
  `- Actual mobile test files found: ${audit.actualMobileTestFiles}`,
  `- Blockers: ${audit.summary.blockerCount}`,
  `- Warnings: ${audit.summary.warningCount}`,
  '',
  '## Docs',
  '',
  markdownTable(
    [
      'Doc',
      'Date',
      'Expected date',
      'Current test phrase',
      'Manifest evidence',
      'Stale patterns',
      'Missing commands',
    ],
    docResults.map((doc) => [
      doc.path,
      doc.date ?? 'missing',
      doc.expectedDate || 'missing',
      doc.hasExpectedTestPhrase ? 'yes' : 'no',
      doc.missingManifestNeedles.length === 0 ? 'yes' : 'no',
      doc.stalePatterns.length,
      doc.missingCommands.length,
    ]),
  ),
  '',
  '## Required Launch Commands',
  '',
  ...requiredLaunchCommands.map((command) => `- \`${command}\``),
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
  console.log('Readiness status audit is current.');
  console.log('Readiness status audit passed.');
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

console.log('Readiness status audit passed.');
