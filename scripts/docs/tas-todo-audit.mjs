#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const check = process.argv.includes('--check');
const forTasPath = 'docs/FOR_TAS_TO_DO.md';
const packagePath = 'package.json';
const envExamplePath = '.env.example';
const outJson = process.env.TAS_TODO_AUDIT_JSON ?? 'docs/generated/tas-todo-audit.json';
const outMd = process.env.TAS_TODO_AUDIT_MD ?? 'docs/generated/tas-todo-audit.md';

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

function listFiles(path) {
  if (!exists(path)) return [];
  return readdirSync(abs(path), { withFileTypes: true }).flatMap((entry) => {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) return listFiles(child);
    if (entry.isFile()) return [child];
    return [];
  });
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
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
    console.error(`FAIL Missing ${path}. Run npm run docs:tas-todo-audit:strict.`);
    return false;
  }
  const current = read(path);
  if (normalize(current) !== normalize(expectedContent)) {
    console.error(`FAIL ${path} is stale. Run npm run docs:tas-todo-audit:strict.`);
    return false;
  }
  return true;
}

function collectScriptText(dirs) {
  return dirs
    .flatMap((dir) => listFiles(dir))
    .filter((file) => extname(file) === '.mjs')
    .map((file) => read(file))
    .join('\n');
}

function collectKeys(text, patterns) {
  return uniqueSorted(
    patterns.flatMap((pattern) => {
      const matches = text.match(pattern);
      return matches ?? [];
    }),
  );
}

function isLocalOnlyGeneratedKey(key) {
  return (
    /_OUT_DIR$/.test(key) ||
    key === 'PHASE8_STORE_METADATA_PACKET' ||
    key === 'PHASE9_RELEASE_CANDIDATE_DIR'
  );
}

function docHasAny(text, needles) {
  return needles.some((needle) => text.includes(needle));
}

const blockers = [];
const warnings = [];

if (!exists(forTasPath)) blockers.push(`Missing ${forTasPath}.`);
if (!exists(packagePath)) blockers.push(`Missing ${packagePath}.`);
if (!exists(envExamplePath)) blockers.push(`Missing ${envExamplePath}.`);

const forTasText = exists(forTasPath) ? read(forTasPath) : '';
const envExampleText = exists(envExamplePath) ? read(envExamplePath) : '';
const packageJson = exists(packagePath) ? readJson(packagePath) : { scripts: {} };
const packageScripts = Object.keys(packageJson.scripts ?? {});

const gateGroups = [
  {
    id: 'phase2',
    title: 'Phase 2 environment and RLS',
    scriptDirs: ['scripts/phase2'],
    packageScriptNeedles: ['phase2:check-env:strict', 'phase2:rls-smoke'],
    forTasNeedles: ['phase2:check-env:strict', 'phase2:rls-smoke'],
    keyPatterns: [
      /\bBRAND_LEGAL_CLEARANCE\b/g,
      /\bAPP_VARIANT\b/g,
      /\bEXPO_PUBLIC_(?:APP|PRIVACY|TERMS|SUPPORT|ACCOUNT|DATA|CONSUMER|SUPABASE|REVENUECAT|GOOGLE|POSTHOG|SENTRY|TURNSTILE)[A-Z0-9_]*\b/g,
      /\bSUPABASE_[A-Z0-9_]+\b/g,
      /\bREVENUECAT_[A-Z0-9_]+\b/g,
      /\bAPPLE_[A-Z0-9_]+\b/g,
      /\bPOSTHOG_[A-Z0-9_]+\b/g,
      /\bSENTRY_[A-Z0-9_]+\b/g,
      /\bPHASE2_[A-Z0-9_]+\b/g,
    ],
  },
  {
    id: 'phase3',
    title: 'Phase 3 legal and reviewer signoff',
    scriptDirs: ['scripts/phase3'],
    packageScriptNeedles: ['phase3:audit-copy:strict'],
    forTasNeedles: ['phase3:audit-copy:strict'],
    keyPatterns: [/\bPHASE3_[A-Z0-9_]+\b/g],
  },
  {
    id: 'phase4',
    title: 'Phase 4 catalog source posture',
    scriptDirs: ['scripts/phase4'],
    packageScriptNeedles: ['phase4:check-source-env:strict'],
    forTasNeedles: ['phase4:check-source-env'],
    keyPatterns: [/\bCATALOG_[A-Z0-9_]+\b/g, /\bOBF_[A-Z0-9_]+\b/g, /\bPHASE4_[A-Z0-9_]+\b/g],
  },
  {
    id: 'phase5',
    title: 'Phase 5 native build and device QA',
    scriptDirs: ['scripts/phase5'],
    packageScriptNeedles: ['phase5:check-native-config:strict', 'phase5:qa-packet:strict'],
    forTasNeedles: ['phase5:check-native-config:strict', 'phase5:qa-packet:strict'],
    keyPatterns: [/\bPHASE5_[A-Z0-9_]+\b/g],
  },
  {
    id: 'phase6',
    title: 'Phase 6 payments and RevenueCat',
    scriptDirs: ['scripts/phase6'],
    packageScriptNeedles: ['phase6:check-payments-env:strict', 'phase6:qa-packet:strict'],
    forTasNeedles: ['phase6:check-payments-env:strict'],
    keyPatterns: [
      /\bPHASE6_[A-Z0-9_]+\b/g,
      /\bEXPO_PUBLIC_REVENUECAT_[A-Z0-9_]+\b/g,
      /\bREVENUECAT_[A-Z0-9_]+\b/g,
    ],
  },
  {
    id: 'phase7',
    title: 'Phase 7 core loop launch gates',
    scriptDirs: ['scripts/phase7'],
    packageScriptNeedles: ['phase7:check-core-loop:strict', 'phase7:qa-packet:strict'],
    forTasNeedles: ['phase7:check-core-loop:strict', 'phase7:qa-packet:strict'],
    keyPatterns: [/\bPHASE7_[A-Z0-9_]+\b/g, /\bEXPO_PUBLIC_PHASE7_[A-Z0-9_]+\b/g],
  },
  {
    id: 'phase8',
    title: 'Phase 8 growth and store readiness',
    scriptDirs: ['scripts/phase8'],
    packageScriptNeedles: ['phase8:check-growth-store:strict', 'phase8:qa-packet:strict'],
    forTasNeedles: ['phase8:verify', 'Phase 8'],
    keyPatterns: [
      /\bPHASE8_[A-Z0-9_]+\b/g,
      /\bEXPO_PUBLIC_PHASE8_[A-Z0-9_]+\b/g,
      /\bANDROID_CERT_SHA256_FINGERPRINTS\b/g,
      /\bAPPLE_TEAM_ID\b/g,
    ],
  },
  {
    id: 'phase9',
    title: 'Phase 9 release engineering',
    scriptDirs: ['scripts/phase9'],
    packageScriptNeedles: ['phase9:verify', 'phase9:release-smoke:strict'],
    forTasNeedles: ['phase9:verify', 'Phase 9'],
    keyPatterns: [/\bPHASE9_[A-Z0-9_]+\b/g],
  },
  {
    id: 'phase10',
    title: 'Phase 10 closed beta',
    scriptDirs: ['scripts/phase10'],
    packageScriptNeedles: ['phase10:verify', 'phase10:beta-readiness:strict'],
    forTasNeedles: ['phase10:verify', 'Phase 10'],
    keyPatterns: [/\bPHASE10_[A-Z0-9_]+\b/g],
  },
  {
    id: 'phase11',
    title: 'Phase 11 public launch',
    scriptDirs: ['scripts/phase11'],
    packageScriptNeedles: ['phase11:verify', 'phase11:launch-readiness:strict'],
    forTasNeedles: ['phase11:verify', 'Phase 11'],
    keyPatterns: [/\bPHASE11_[A-Z0-9_]+\b/g],
  },
];

if (!/## Current Command-Gate Evidence Needed/.test(forTasText)) {
  blockers.push(`${forTasPath} is missing "Current Command-Gate Evidence Needed".`);
}
if (!/## How Codex Should Use This/.test(forTasText)) {
  blockers.push(`${forTasPath} is missing "How Codex Should Use This".`);
}

const groups = gateGroups.map((group) => {
  const scriptText = collectScriptText(group.scriptDirs);
  const sourceText = `${scriptText}\n${envExampleText}`;
  const extractedKeys = collectKeys(sourceText, group.keyPatterns);
  const localOnlyKeys = extractedKeys.filter(isLocalOnlyGeneratedKey);
  const keys = extractedKeys.filter((key) => !isLocalOnlyGeneratedKey(key));
  const packageScriptsPresent = group.packageScriptNeedles.filter((needle) =>
    packageScripts.includes(needle),
  );
  const forTasCovered = docHasAny(forTasText, group.forTasNeedles);
  const keysMentionedInForTas = keys.filter((key) => forTasText.includes(key));
  const keysNotMentionedInForTas = keys.filter((key) => !forTasText.includes(key));

  if (packageScriptsPresent.length === 0) {
    blockers.push(
      `${group.title} has no expected package.json strict/verify script (${group.packageScriptNeedles.join(
        ', ',
      )}).`,
    );
  }
  if (!forTasCovered) {
    blockers.push(
      `${forTasPath} does not cover ${group.title}; expected one of: ${group.forTasNeedles.join(
        ', ',
      )}.`,
    );
  }
  if (keysNotMentionedInForTas.length > 0) {
    warnings.push(
      `${group.title} has ${keysNotMentionedInForTas.length} extracted key(s) not named verbatim in ${forTasPath}; see generated audit inventory.`,
    );
  }

  return {
    ...group,
    packageScriptsPresent,
    forTasCovered,
    localOnlyKeys,
    keys,
    keysMentionedInForTas,
    keysNotMentionedInForTas,
  };
});

const audit = {
  generatedAt: new Date().toISOString(),
  status: blockers.length === 0 ? 'pass' : 'blocked',
  strict,
  purpose:
    'Audit that docs/FOR_TAS_TO_DO.md covers Tas-owned strict launch evidence gates and generate an exact key inventory from phase scripts.',
  sourceFiles: {
    forTasPath,
    packagePath,
    envExamplePath,
  },
  summary: {
    gateGroupCount: groups.length,
    coveredGateGroupCount: groups.filter((group) => group.forTasCovered).length,
    extractedKeyCount: groups.reduce((sum, group) => sum + group.keys.length, 0),
    localOnlyKeyCount: groups.reduce((sum, group) => sum + group.localOnlyKeys.length, 0),
    keyMentionCount: groups.reduce((sum, group) => sum + group.keysMentionedInForTas.length, 0),
    keyNotMentionedCount: groups.reduce(
      (sum, group) => sum + group.keysNotMentionedInForTas.length,
      0,
    ),
    blockerCount: blockers.length,
    warningCount: warnings.length,
  },
  groups: groups.map(
    ({
      id,
      title,
      scriptDirs,
      packageScriptNeedles,
      packageScriptsPresent,
      forTasNeedles,
      forTasCovered,
      localOnlyKeys,
      keys,
      keysMentionedInForTas,
      keysNotMentionedInForTas,
    }) => ({
      id,
      title,
      scriptDirs,
      packageScriptNeedles,
      packageScriptsPresent,
      forTasNeedles,
      forTasCovered,
      keys,
      keysMentionedInForTas,
      keysNotMentionedInForTas,
    }),
  ),
  blockers,
  warnings,
};

const jsonContent = `${JSON.stringify(audit, null, 2)}\n`;

const summaryRows = groups.map((group) => [
  group.id,
  group.forTasCovered ? 'yes' : 'no',
  group.packageScriptsPresent.join(', '),
  group.keys.length,
  group.keysNotMentionedInForTas.length,
]);

const keySections = groups.flatMap((group) => [
  `### ${group.title}`,
  '',
  `Covered by \`${forTasPath}\`: ${group.forTasCovered ? 'yes' : 'no'}`,
  '',
  group.keys.length
    ? markdownTable(
        ['Extracted key', 'Named in FOR_TAS_TO_DO.md'],
        group.keys.map((key) => [key, group.keysMentionedInForTas.includes(key) ? 'yes' : 'no']),
      )
    : '- No machine-detected external evidence keys in this group.',
  '',
  group.localOnlyKeys.length
    ? `Local generated-only keys excluded from evidence warnings: ${group.localOnlyKeys.join(', ')}`
    : 'Local generated-only keys excluded from evidence warnings: none.',
  '',
]);

const mdContent = [
  '# Tas To Do Audit',
  '',
  `Generated: ${audit.generatedAt}`,
  `Status: ${audit.status}`,
  `Strict mode: ${strict ? 'yes' : 'no'}`,
  '',
  'This generated audit checks that `docs/FOR_TAS_TO_DO.md` covers the',
  'Tas-owned strict launch evidence gates and records the exact evidence keys',
  'extracted from phase scripts and `.env.example`. Local generated-packet',
  'outputs and source-contract markers are listed separately and excluded',
  'from evidence warnings.',
  'Strict mode fails when a phase gate is no longer covered by the founder',
  'handoff doc; exact key omissions are warnings because the generated',
  'inventory itself is the canonical machine-readable key list.',
  '',
  '## Summary',
  '',
  `- Gate groups: ${audit.summary.gateGroupCount}`,
  `- Covered gate groups: ${audit.summary.coveredGateGroupCount}`,
  `- Extracted keys: ${audit.summary.extractedKeyCount}`,
  `- Local generated-only keys excluded: ${audit.summary.localOnlyKeyCount}`,
  `- Keys named verbatim in FOR_TAS_TO_DO.md: ${audit.summary.keyMentionCount}`,
  `- Keys only in generated inventory: ${audit.summary.keyNotMentionedCount}`,
  `- Blockers: ${audit.summary.blockerCount}`,
  `- Warnings: ${audit.summary.warningCount}`,
  '',
  '## Gate Coverage',
  '',
  markdownTable(
    [
      'Gate',
      'FOR_TAS coverage',
      'Package script evidence',
      'Keys',
      'Keys only in generated inventory',
    ],
    summaryRows,
  ),
  '',
  '## Extracted Evidence Keys',
  '',
  ...keySections,
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
  console.log('Tas To Do audit is current.');
  console.log('Tas To Do audit passed.');
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

console.log('Tas To Do audit passed.');
