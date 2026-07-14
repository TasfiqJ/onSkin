import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const LEGACY_COMPATIBILITY_NOTICE =
  'Reviewed technical compatibility classification only; this is not trademark, legal, domain, store-name, or final production identity clearance.';

export const DEFAULT_LEGACY_COMPATIBILITY_MANIFEST = 'scripts/brand-legacy-compatibility.json';

export const DEFAULT_TARGETS = [
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
];

const LEGACY_COMPATIBILITY_SUBTYPES = new Set([
  'cryptographic-domain-separation',
  'live-compatibility-harness',
  'migration-history',
  'test-fixture',
]);

const MANIFEST_TOP_LEVEL_KEYS = ['entries', 'notice', 'schemaVersion'];
const MANIFEST_ENTRY_KEYS = ['expectedCount', 'literal', 'path', 'rationale', 'subtype'];

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
  /^scripts\/brand-audit(?:-lib|\.test)?\.mjs$/,
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
  /\.test\.[cm]?[jt]sx?$/,
  /\/test\//,
  /^scripts\/phase9\/live-revenuecat-webhook\.mjs$/,
];

function hasExactKeys(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actualKeys = Object.keys(value).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key, index) => actualKeys[index] === key)
  );
}

function normalizePath(repoRoot, filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function isMatch(patterns, relPath) {
  return patterns.some((pattern) => pattern.test(relPath));
}

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

function identityMatches(value) {
  const matches = [];
  for (const pattern of identityPatterns) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(value))) {
      matches.push({ kind: pattern.id, index: match.index, value: match[0] });
    }
  }
  return matches;
}

function countOccurrences(content, literal) {
  let count = 0;
  let cursor = 0;
  while (cursor <= content.length - literal.length) {
    const index = content.indexOf(literal, cursor);
    if (index === -1) break;
    count += 1;
    cursor = index + literal.length;
  }
  return count;
}

function validManifestPath(relPath) {
  if (typeof relPath !== 'string' || !relPath || relPath.includes('\\')) return false;
  if (path.posix.isAbsolute(relPath) || path.win32.isAbsolute(relPath)) return false;
  const segments = relPath.split('/');
  return segments.every((segment) => segment && segment !== '.' && segment !== '..');
}

async function loadLegacyCompatibilityManifest(repoRoot, manifestRelPath) {
  const errors = [];
  const entries = [];
  const manifestPath = path.resolve(repoRoot, manifestRelPath);
  let parsed;

  try {
    parsed = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    errors.push(`Cannot read and parse ${manifestRelPath}: ${detail}`);
    return { entries, errors, manifestRelPath };
  }

  if (!hasExactKeys(parsed, MANIFEST_TOP_LEVEL_KEYS)) {
    errors.push(`${manifestRelPath} must contain exactly: ${MANIFEST_TOP_LEVEL_KEYS.join(', ')}.`);
    return { entries, errors, manifestRelPath };
  }
  if (parsed.schemaVersion !== 1) {
    errors.push(`${manifestRelPath} schemaVersion must be 1.`);
  }
  if (parsed.notice !== LEGACY_COMPATIBILITY_NOTICE) {
    errors.push(`${manifestRelPath} must retain the exact non-clearance notice.`);
  }
  if (!Array.isArray(parsed.entries)) {
    errors.push(`${manifestRelPath} entries must be an array.`);
    return { entries, errors, manifestRelPath };
  }

  const seen = new Set();
  for (const [index, entry] of parsed.entries.entries()) {
    const label = `${manifestRelPath} entries[${index}]`;
    if (!hasExactKeys(entry, MANIFEST_ENTRY_KEYS)) {
      errors.push(`${label} must contain exactly: ${MANIFEST_ENTRY_KEYS.join(', ')}.`);
      continue;
    }
    if (!validManifestPath(entry.path)) {
      errors.push(`${label}.path must be a normalized repository-relative path.`);
      continue;
    }
    if (entry.path === manifestRelPath) {
      errors.push(`${label}.path cannot classify the manifest itself.`);
      continue;
    }
    if (isMatch(publicAssetPatterns, entry.path)) {
      errors.push(`${label}.path is a public asset and cannot be compatibility-allowlisted.`);
      continue;
    }
    if (
      typeof entry.literal !== 'string' ||
      entry.literal.length <= 'onskin'.length ||
      entry.literal.includes('\n') ||
      entry.literal.includes('\r') ||
      ![`'`, '"', '`'].includes(entry.literal[0]) ||
      entry.literal.at(-1) !== entry.literal[0]
    ) {
      errors.push(
        `${label}.literal must be one exact, quoted, non-empty, single-line source literal.`,
      );
      continue;
    }
    if (identityMatches(entry.literal).length !== 1) {
      errors.push(`${label}.literal must contain exactly one legacy identity match.`);
      continue;
    }
    if (!Number.isInteger(entry.expectedCount) || entry.expectedCount < 1) {
      errors.push(`${label}.expectedCount must be a positive integer.`);
      continue;
    }
    if (!LEGACY_COMPATIBILITY_SUBTYPES.has(entry.subtype)) {
      errors.push(`${label}.subtype is not an approved compatibility subtype.`);
      continue;
    }
    if (
      typeof entry.rationale !== 'string' ||
      entry.rationale.trim() !== entry.rationale ||
      entry.rationale.length < 24 ||
      identityMatches(entry.rationale).length > 0
    ) {
      errors.push(
        `${label}.rationale must be trimmed, specific, at least 24 characters, and contain no legacy identity match.`,
      );
      continue;
    }

    const key = `${entry.path}\u0000${entry.literal}`;
    if (seen.has(key)) {
      errors.push(`${label} duplicates an earlier path + literal entry.`);
      continue;
    }
    seen.add(key);

    let content;
    try {
      content = await readFile(path.resolve(repoRoot, entry.path), 'utf8');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      errors.push(`${label} cannot read ${entry.path}: ${detail}`);
      continue;
    }
    const actualCount = countOccurrences(content, entry.literal);
    if (actualCount !== entry.expectedCount) {
      errors.push(
        `${label} expected ${entry.expectedCount} exact occurrence(s) in ${entry.path}, found ${actualCount}.`,
      );
      continue;
    }

    entries.push({ ...entry, key });
  }

  return { entries, errors, manifestRelPath };
}

function compatibilityEntryForMatch(entries, line, matchIndex, matchLength) {
  for (const entry of entries) {
    let cursor = 0;
    while (cursor <= line.length - entry.literal.length) {
      const literalIndex = line.indexOf(entry.literal, cursor);
      if (literalIndex === -1) break;
      const literalEnd = literalIndex + entry.literal.length;
      if (matchIndex >= literalIndex && matchIndex + matchLength <= literalEnd) return entry;
      cursor = literalEnd;
    }
  }
  return null;
}

function classify(relPath, line, compatibilityEntry) {
  if (isMatch(contextDocs, relPath)) return 'context-doc';
  if (isGuardRail(relPath, line)) return 'guard-rail';
  if (internalNamespacePatterns.some((pattern) => pattern.test(line))) return 'internal-namespace';
  if (isMatch(testOrScriptFixturePatterns, relPath)) return 'test-or-fixture';
  if (isMatch(publicAssetPatterns, relPath)) return 'public-launch-risk';
  if (compatibilityEntry) return 'legacy-compatibility';
  return 'review-needed';
}

function scanLine(relPath, line, lineNumber, compatibilityEntries) {
  const findings = [];
  for (const match of identityMatches(line)) {
    const compatibilityEntry = compatibilityEntryForMatch(
      compatibilityEntries,
      line,
      match.index,
      match.value.length,
    );
    findings.push({
      relPath,
      lineNumber,
      kind: match.kind,
      value: match.value,
      category: classify(relPath, line, compatibilityEntry),
      line: line.trim(),
      compatibilitySubtype: compatibilityEntry?.subtype ?? null,
      compatibilityRationale: compatibilityEntry?.rationale ?? null,
    });
  }
  return findings;
}

export async function auditBrandIdentity({
  repoRoot,
  targets = DEFAULT_TARGETS,
  manifestRelPath = DEFAULT_LEGACY_COMPATIBILITY_MANIFEST,
}) {
  const absoluteRoot = path.resolve(repoRoot);
  const absoluteTargets = targets.map((target) =>
    path.isAbsolute(target) ? target : path.resolve(absoluteRoot, target),
  );
  const manifest = await loadLegacyCompatibilityManifest(absoluteRoot, manifestRelPath);
  const entriesByPath = new Map();
  for (const entry of manifest.entries) {
    const current = entriesByPath.get(entry.path) ?? [];
    current.push(entry);
    entriesByPath.set(entry.path, current);
  }

  const findings = [];
  for (const target of absoluteTargets) {
    for await (const filePath of walk(target)) {
      const relPath = normalizePath(absoluteRoot, filePath);
      if (relPath === manifestRelPath) continue;
      const content = await readFile(filePath, 'utf8');
      const compatibilityEntries = entriesByPath.get(relPath) ?? [];
      content.split(/\r?\n/).forEach((line, index) => {
        findings.push(...scanLine(relPath, line, index + 1, compatibilityEntries));
      });
    }
  }

  const grouped = findings.reduce((acc, finding) => {
    acc[finding.category] = (acc[finding.category] ?? 0) + 1;
    return acc;
  }, {});

  return {
    findings,
    grouped,
    manifest,
    targets: absoluteTargets.map((target) => normalizePath(absoluteRoot, target)),
    publicRiskCount: grouped['public-launch-risk'] ?? 0,
    reviewNeededCount: grouped['review-needed'] ?? 0,
    legacyCompatibilityCount: grouped['legacy-compatibility'] ?? 0,
  };
}

export function auditShouldFail(result, strict) {
  if (result.manifest.errors.length > 0) return true;
  return strict && (result.publicRiskCount > 0 || result.reviewNeededCount > 0);
}

export function formatBrandAudit(result, { showAll = false } = {}) {
  const lines = [
    'Brand identity audit',
    `Targets: ${result.targets.join(', ')}`,
    `Legacy compatibility manifest: ${result.manifest.manifestRelPath}`,
    LEGACY_COMPATIBILITY_NOTICE,
    '',
  ];

  for (const category of [
    'public-launch-risk',
    'review-needed',
    'legacy-compatibility',
    'guard-rail',
    'internal-namespace',
    'test-or-fixture',
    'context-doc',
  ]) {
    lines.push(`${category}: ${result.grouped[category] ?? 0}`);
  }

  if (result.manifest.errors.length) {
    lines.push('', 'Legacy compatibility manifest errors:');
    for (const error of result.manifest.errors) lines.push(`- ${error}`);
  }

  const reportableCategories = showAll
    ? ['public-launch-risk', 'review-needed', 'legacy-compatibility']
    : ['public-launch-risk', 'review-needed'];
  const reportable = result.findings.filter((finding) =>
    reportableCategories.includes(finding.category),
  );
  const rows = showAll ? reportable : reportable.slice(0, 200);

  if (rows.length) {
    lines.push(
      '',
      showAll ? 'Findings:' : `Findings (first ${rows.length} of ${reportable.length}):`,
    );
    for (const finding of rows) {
      const subtype = finding.compatibilitySubtype ? ` | ${finding.compatibilitySubtype}` : '';
      lines.push(
        `${finding.category} | ${finding.relPath}:${finding.lineNumber} | ${finding.kind}${subtype} | ${finding.line}`,
      );
    }
  }

  if (!showAll && reportable.length > rows.length) {
    lines.push(
      '',
      `Use "npm run brand:audit -- --all" to print all ${reportable.length} reportable findings.`,
    );
  }

  return lines.join('\n');
}
