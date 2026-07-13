#!/usr/bin/env node

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');
const showAll = process.argv.includes('--all');
const targetArgs = process.argv
  .slice(2)
  .filter((arg) => !arg.startsWith('--'))
  .map((arg) => path.resolve(repoRoot, arg));

const defaultTargets = [
  'apps/mobile',
  'packages',
  'supabase',
  'scripts',
  'docs/phase-8',
  'docs/phase-9',
  'docs/phase-10',
  'docs/phase-11',
  '.env.example',
  'package.json',
  'LAUNCH_READINESS.md',
  'BLOCKERS.md',
].map((target) => path.resolve(repoRoot, target));

const targets = targetArgs.length ? targetArgs : defaultTargets;

const skipDirs = new Set([
  '.git',
  '.expo',
  '.turbo',
  'coverage',
  'dist',
  'node_modules',
  'test-results',
]);

const textExtensions = new Set([
  '.cjs',
  '.css',
  '.example',
  '.html',
  '.js',
  '.json',
  '.jsonl',
  '.md',
  '.mjs',
  '.ps1',
  '.sql',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.yml',
  '.yaml',
]);

const identityPatterns = [
  { id: 'display-name', regex: /\bOnSkin\b/g },
  { id: 'lowercase-name', regex: /\bonskin\b/g },
  { id: 'bundle-id', regex: /com\.onskin\.app/g },
  { id: 'url-scheme', regex: /onskin:\/\//g },
  { id: 'domain', regex: /onskin\.app/g },
  { id: 'product-id', regex: /onskin_pro/g },
  { id: 'social-handle', regex: /@onskin\b/gi },
];

const contextDocs = [
  /^04_repo_docs\//,
  /^docs\/(MASTER_PLAN|PRODUCT_REQUIREMENTS|ARCHITECTURE|FEATURE_INDEX|ROADMAP|DECISIONS|TESTING_STRATEGY|CODE_REVIEW|MASTER_PLAN_UPDATE_PATCH|CODEX_IMPLEMENTATION_PROMPT|FOR_TAS_TO_DO|rebrand-and-core-loop-migration-checklist)\.md$/,
  /^docs\/brand-/,
  /^BLOCKERS\.md$/,
  /^LAUNCH_READINESS\.md$/,
  /^PROGRESS\.md$/,
  /^CLAUDE\.md$/,
  /^AGENTS\.md$/,
  /^scripts\/brand-audit\.mjs$/,
];

const internalNamespacePatterns = [
  /@onskin\//,
  /\bask_onskin\b/,
  /\bonskin\.(ageVerified|appLock|ask|commerce|community|completions|conflict|cycle|entitlement|healthData|milestones|notif|photo|photos|private|ramp|rec|reviewPrompt|shelf|skinprofile|subscription|trend)/,
  /\bonskin-(export|share|trial-reminder)\b/,
  /\bonskin:user:/,
  /\.onskinphoto\b/,
  /"name"\s*:\s*"@onskin\//,
  /"name"\s*:\s*"onskin"/,
];

const publicAssetPatterns = [
  /^apps\/mobile\/app\.base\.json$/,
  /^apps\/mobile\/src\//,
  /^apps\/mobile\/tailwind\.config\.js$/,
  /^docs\/phase-8\/public-site\//,
  /^docs\/phase-8\/store-metadata-source-of-truth\.md$/,
  /^docs\/phase-8\/creator-brief\.md$/,
  /^docs\/phase-8\/support-review-response-playbook\.md$/,
  /^docs\/phase-11\/generated\/public-launch-packet\./,
  /^supabase\/config\.toml$/,
  /^package\.json$/,
  /^\.env\.example$/,
];

const testOrScriptFixturePatterns = [
  /\.test\.[jt]sx?$/,
  /\/test\//,
  /^scripts\/phase9\/live-revenuecat-webhook\.mjs$/,
];

function isGuardRail(relPath, line) {
  if (relPath === 'apps/mobile/app.config.js' && /legacyIdentityPattern/.test(line)) return true;
  if (
    relPath === 'apps/mobile/src/lib/storage/plaintextStagingCore.ts' &&
    /LEGACY_PLAINTEXT_STAGING_JOURNAL_KEY/.test(line)
  ) {
    return true;
  }
  if (
    relPath === 'scripts/phase2/check-env.mjs' &&
    (/\/onskin\/i\.test\(displayName\)/.test(line) ||
      /Production identity still uses OnSkin without BRAND_LEGAL_CLEARANCE=cleared/.test(line))
  ) {
    return true;
  }
  if (
    relPath === 'scripts/phase4/check-source-env.mjs' &&
    (/\/onskin\/i\.test\(value\)/.test(line) || /\/onskin\/i\.test\(appName\)/.test(line))
  ) {
    return true;
  }
  return false;
}

function normalizePath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

async function* walk(filePath) {
  let entryStat;
  try {
    entryStat = await stat(filePath);
  } catch {
    return;
  }

  if (entryStat.isDirectory()) {
    const basename = path.basename(filePath);
    if (skipDirs.has(basename)) return;
    for (const child of await readdir(filePath)) {
      yield* walk(path.join(filePath, child));
    }
    return;
  }

  if (!entryStat.isFile()) return;
  if (!textExtensions.has(path.extname(filePath))) return;
  yield filePath;
}

function isMatch(patterns, relPath) {
  return patterns.some((pattern) => pattern.test(relPath));
}

function classify(relPath, line) {
  if (isMatch(contextDocs, relPath)) return 'context-doc';
  if (isGuardRail(relPath, line)) return 'guard-rail';
  if (internalNamespacePatterns.some((pattern) => pattern.test(line))) return 'internal-namespace';
  if (isMatch(testOrScriptFixturePatterns, relPath)) return 'test-or-fixture';
  if (isMatch(publicAssetPatterns, relPath)) return 'public-launch-risk';
  return 'review-needed';
}

function scanLine(relPath, line, lineNumber) {
  const matches = [];
  for (const pattern of identityPatterns) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(line))) {
      matches.push({
        relPath,
        lineNumber,
        kind: pattern.id,
        value: match[0],
        category: classify(relPath, line),
        line: line.trim(),
      });
    }
  }
  return matches;
}

const findings = [];

for (const target of targets) {
  for await (const filePath of walk(target)) {
    const relPath = normalizePath(filePath);
    const content = await readFile(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      findings.push(...scanLine(relPath, line, index + 1));
    });
  }
}

const grouped = findings.reduce((acc, finding) => {
  acc[finding.category] = (acc[finding.category] ?? 0) + 1;
  return acc;
}, {});

const publicRiskCount = findings.filter(
  (finding) => finding.category === 'public-launch-risk',
).length;
const reviewNeededCount = findings.filter((finding) => finding.category === 'review-needed').length;

console.log('Brand identity audit');
console.log(`Targets: ${targets.map(normalizePath).join(', ')}`);
console.log('');
for (const category of [
  'public-launch-risk',
  'review-needed',
  'guard-rail',
  'internal-namespace',
  'test-or-fixture',
  'context-doc',
]) {
  console.log(`${category}: ${grouped[category] ?? 0}`);
}

const reportable = findings.filter((finding) =>
  ['public-launch-risk', 'review-needed'].includes(finding.category),
);
const rows = showAll ? reportable : reportable.slice(0, 200);

if (rows.length) {
  console.log('');
  console.log(showAll ? 'Findings:' : `Findings (first ${rows.length} of ${reportable.length}):`);
  for (const finding of rows) {
    console.log(
      `${finding.category} | ${finding.relPath}:${finding.lineNumber} | ${finding.kind} | ${finding.line}`,
    );
  }
}

if (!showAll && reportable.length > rows.length) {
  console.log('');
  console.log(
    `Use "npm run brand:audit -- --all" to print all ${reportable.length} reportable findings.`,
  );
}

if (strict && (publicRiskCount > 0 || reviewNeededCount > 0)) {
  console.error('');
  console.error(
    `Brand audit strict mode failed: ${publicRiskCount} public launch risks and ${reviewNeededCount} review-needed references remain.`,
  );
  process.exitCode = 1;
}
