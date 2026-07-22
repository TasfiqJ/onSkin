#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import {
  launchContractSnapshot,
  loadLaunchContract,
  platformRequirementStatus,
} from '../launch/contract.mjs';

const root = process.cwd();
const launchContract = loadLaunchContract(root);
const strict = process.argv.includes('--strict');
const check = process.argv.includes('--check');

const outJson =
  process.env.PERFORMANCE_READINESS_AUDIT_JSON ?? 'docs/generated/performance-readiness-audit.json';
const outMd =
  process.env.PERFORMANCE_READINESS_AUDIT_MD ?? 'docs/generated/performance-readiness-audit.md';

const files = {
  architecture: 'docs/00-architecture.md',
  blockers: 'BLOCKERS.md',
  forTas: 'docs/FOR_TAS_TO_DO.md',
  launchReadiness: 'LAUNCH_READINESS.md',
  packageJson: 'package.json',
  performanceChecker: 'scripts/phase5/check-performance-evidence.mjs',
  performanceContract: 'scripts/phase5/performance-evidence-contract.mjs',
  performanceRunbook: 'docs/phase-5/performance-evidence-runbook.md',
  performanceSmoke: 'scripts/phase5/performance-evidence-smoke.mjs',
  performanceTemplate: 'docs/phase-5/performance-evidence.template.json',
  photoProgress: 'docs/06-photo-progress.md',
  smartShelf: 'docs/04-smart-shelf.md',
  testingStrategy: 'docs/TESTING_STRATEGY.md',
  launchContract: 'docs/hugeToDo/launch-contract.json',
  launchContractScript: 'scripts/launch/contract.mjs',
};

const requiredPerformanceMetrics = [
  'app startup time',
  'product add time',
  'barcode lookup latency',
  'routine generation time',
  'local photo loading',
  'memory use in photo timeline',
];
const requiredPerformanceMetricIds = ['native_ocr_recognition_ms', 'photo_capture_analysis_ms'];

const docNeedles = [
  {
    path: files.testingStrategy,
    needles: [
      'Performance Checks',
      ...requiredPerformanceMetrics,
      'npm run docs:performance-readiness-audit:check',
      'npm run phase5:performance-evidence:strict',
      'npm run phase5:performance-evidence:summarize',
      'PHASE5_PERFORMANCE_EVIDENCE_PATH',
      'raw samples',
      'nearest-rank p50/p95',
    ],
  },
  {
    path: files.forTas,
    needles: [
      'supported physical iPhones',
      'Android credentials, builds, device evidence',
      'performance, beta, and release approval are outside the current release',
    ],
  },
  {
    path: files.launchReadiness,
    needles: [
      'Performance readiness',
      'Performance baseline and scale evidence',
      'docs:performance-readiness-audit:check',
      ...requiredPerformanceMetrics,
      'native_ocr_recognition_ms',
      'photo_capture_analysis_ms',
    ],
  },
  {
    path: files.blockers,
    needles: [
      'B-PERFORMANCE',
      'Performance baseline and scale evidence',
      ...requiredPerformanceMetrics,
      'native_ocr_recognition_ms',
      'photo_capture_analysis_ms',
    ],
  },
  {
    path: files.architecture,
    needles: ['cold start', 'startup-to-interactive', 'Benchmarks that would change'],
  },
  {
    path: files.smartShelf,
    needles: ['Barcode scan reliability is a competitive bar', 'on-device camera performance'],
  },
  {
    path: files.photoProgress,
    needles: ['frame-processor performance must be verified on real devices', 'local and fast'],
  },
  {
    path: files.performanceRunbook,
    needles: [
      'define every threshold before measurement',
      'at least five raw samples',
      'at least 50 encrypted local photos',
      'native_ocr_recognition_ms',
      'photo_capture_analysis_ms',
      'PHASE5_PERFORMANCE_EVIDENCE_PATH',
      'phase5:performance-evidence:summarize',
      'nearest-rank p50 and p95',
      'raw samples',
      'calculates threshold failures',
    ],
  },
  {
    path: files.performanceChecker,
    needles: [
      'PHASE5_PERFORMANCE_EVIDENCE_PATH',
      'validatePerformanceEvidence',
      '--check-template',
      '--write-summaries',
    ],
  },
  {
    path: files.performanceContract,
    needles: [
      'PERFORMANCE_MIN_SAMPLE_COUNT = 5',
      'PERFORMANCE_EVIDENCE_SCHEMA_VERSION = 4',
      'nearestRankPercentile',
      'sampleCount must equal samples.length',
      'post-hoc targets are rejected',
      'native_ocr_recognition_ms',
      'photo_capture_analysis_ms',
      'photo_timeline_peak_memory_mb',
      'logicalWidth must be at least',
      'requiredReleasePlatforms',
      'platformStatus',
    ],
  },
  {
    path: files.performanceSmoke,
    needles: [
      'rejects thresholds defined after measurements',
      'calculates threshold failure instead of trusting the signoff field',
      'rejects one-off timing samples',
      'rejects declared percentiles that do not match raw samples',
      'rejects zero or invalid raw observations',
      'writes deterministic summaries from complete raw observations',
      'refuses to summarize incomplete raw observations',
    ],
  },
  {
    path: files.performanceTemplate,
    needles: [
      '"schemaVersion": 4',
      '"platformStatus"',
      '"android": "not_applicable"',
      '"app_startup_cold_ms"',
      '"native_ocr_recognition_ms"',
      '"photo_capture_analysis_ms"',
      '"photo_timeline_peak_memory_mb"',
      '"measurements"',
    ],
  },
];

const requiredPackageScripts = [
  'docs:performance-readiness-audit',
  'docs:performance-readiness-audit:strict',
  'docs:performance-readiness-audit:check',
  'phase5:performance-evidence',
  'phase5:performance-evidence:strict',
  'phase5:performance-evidence:smoke',
  'phase5:performance-evidence:summarize',
  'phase5:performance-evidence:template',
  'phase5:performance-evidence:template:check',
];

const requiredLaunchVerifyParts = [
  'docs:performance-readiness-audit:check',
  'phase5:performance-evidence:template:check',
  'phase5:performance-evidence:smoke',
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
    console.error(`FAIL Missing ${path}. Run npm run docs:performance-readiness-audit:strict.`);
    return false;
  }
  const current = read(path);
  if (normalize(current) !== normalize(expectedContent)) {
    console.error(`FAIL ${path} is stale. Run npm run docs:performance-readiness-audit:strict.`);
    return false;
  }
  return true;
}

const blockers = [];
const warnings = [];

for (const path of Object.values(files)) {
  if (!exists(path)) blockers.push(`Missing ${path}.`);
}

const packageJson = exists(files.packageJson) ? readJson(files.packageJson) : { scripts: {} };
const packageScripts = packageJson.scripts ?? {};
const launchVerify = String(packageScripts['launch:verify'] ?? '');

for (const scriptName of requiredPackageScripts) {
  if (!Object.hasOwn(packageScripts, scriptName)) {
    blockers.push(`package.json is missing script ${scriptName}.`);
  }
}

for (const scriptPart of requiredLaunchVerifyParts) {
  if (!launchVerify.includes(scriptPart)) {
    blockers.push(`launch:verify does not run ${scriptPart}.`);
  }
}

const docResults = docNeedles.map(({ path, needles }) => {
  const text = exists(path) ? read(path) : '';
  const missing = needles.filter((needle) => !text.includes(needle));
  for (const needle of missing)
    blockers.push(`${path} is missing performance readiness text: ${needle}.`);
  return {
    path,
    checkedNeedles: needles.length,
    missing,
  };
});

const audit = {
  generatedAt: new Date().toISOString(),
  launchContract: launchContractSnapshot(launchContract),
  platformStatus: {
    ios: platformRequirementStatus('ios', launchContract),
    android: platformRequirementStatus('android', launchContract),
  },
  status: blockers.length === 0 ? 'pass' : 'fail',
  strict,
  summary: {
    performanceMetricCount: requiredPerformanceMetrics.length + requiredPerformanceMetricIds.length,
    docsChecked: docResults.length,
    packageScriptsChecked: requiredPackageScripts.length,
    blockers: blockers.length,
    warnings: warnings.length,
  },
  metrics: [...requiredPerformanceMetrics, ...requiredPerformanceMetricIds],
  packageScripts: requiredPackageScripts.map((scriptName) => ({
    scriptName,
    present: Object.hasOwn(packageScripts, scriptName),
  })),
  launchVerify: requiredLaunchVerifyParts.map((scriptPart) => ({
    scriptPart,
    present: launchVerify.includes(scriptPart),
  })),
  docs: docResults,
  blockers,
  warnings,
};

const jsonContent = `${JSON.stringify(audit, null, 2)}\n`;
const mdContent = [
  '# Performance Readiness Audit',
  '',
  `Generated: ${audit.generatedAt}`,
  `Status: ${audit.status}`,
  `Strict mode: ${strict ? 'yes' : 'no'}`,
  '',
  'This generated audit keeps performance readiness explicit without faking',
  'runtime benchmarks. It verifies that launch docs, Tas-owned evidence, the',
  'blocked JSON template, raw-sample percentile validation, executable smoke',
  'tests, and `launch:verify`',
  'continue to cover startup, shelf intake, barcode lookup, routine generation,',
  'local photo loading, and photo timeline memory evidence.',
  `Required performance platforms: ${launchContract.release.platforms.join(', ')}. Android evidence: ${platformRequirementStatus('android', launchContract)}.`,
  '',
  '## Summary',
  '',
  `- Performance metrics: ${audit.summary.performanceMetricCount}`,
  `- Docs checked: ${audit.summary.docsChecked}`,
  `- Package scripts checked: ${audit.summary.packageScriptsChecked}`,
  `- Blockers: ${audit.summary.blockers}`,
  `- Warnings: ${audit.summary.warnings}`,
  '',
  '## Metrics',
  '',
  ...audit.metrics.map((metric) => `- ${metric}`),
  '',
  '## Package Scripts',
  '',
  markdownTable(
    ['Script', 'Present'],
    audit.packageScripts.map((item) => [item.scriptName, item.present ? 'yes' : 'no']),
  ),
  '',
  '## Launch Verify',
  '',
  markdownTable(
    ['Script part', 'Present'],
    audit.launchVerify.map((item) => [item.scriptPart, item.present ? 'yes' : 'no']),
  ),
  '',
  '## Docs',
  '',
  markdownTable(
    ['Doc', 'Needles', 'Missing'],
    audit.docs.map((doc) => [
      doc.path,
      doc.checkedNeedles,
      doc.missing.length === 0 ? 'none' : doc.missing.join('; '),
    ]),
  ),
  '',
  '## Blockers',
  '',
  audit.blockers.length === 0 ? '- None.' : audit.blockers.map((item) => `- ${item}`).join('\n'),
  '',
  '## Warnings',
  '',
  audit.warnings.length === 0 ? '- None.' : audit.warnings.map((item) => `- ${item}`).join('\n'),
  '',
].join('\n');

if (check) {
  const jsonOk = checkGeneratedFile(outJson, jsonContent, normalizeGeneratedJson);
  const mdOk = checkGeneratedFile(outMd, mdContent, normalizeGeneratedMarkdown);
  if (!jsonOk || !mdOk || (strict && blockers.length > 0)) process.exit(1);
  console.log('Performance readiness audit is current.');
  console.log('Performance readiness audit passed.');
  process.exit(0);
}

mkdirSync(dirname(abs(outJson)), { recursive: true });
writeFileSync(abs(outJson), jsonContent);
mkdirSync(dirname(abs(outMd)), { recursive: true });
writeFileSync(abs(outMd), mdContent);
console.log(`Wrote ${rel(abs(outJson))}`);
console.log(`Wrote ${rel(abs(outMd))}`);

if (blockers.length > 0) {
  for (const blocker of blockers) console.error(`FAIL ${blocker}`);
}
if (warnings.length > 0) {
  for (const warning of warnings) console.warn(`WARN ${warning}`);
}

if (strict && blockers.length > 0) {
  console.error('Performance readiness audit failed.');
  process.exit(1);
}

console.log('Performance readiness audit passed.');
