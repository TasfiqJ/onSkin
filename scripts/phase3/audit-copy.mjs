#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const json = process.argv.includes('--json');

const scanRoots = ['apps/mobile/src', 'docs', 'supabase/functions'];
const extensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md']);
const ignoredDirs = new Set([
  '.git',
  '.expo',
  '.turbo',
  'node_modules',
  'coverage',
  'dist',
  'build',
  'generated',
]);
const ignoredFilePatterns = [/\.test\.[jt]sx?$/i, /\.spec\.[jt]sx?$/i];

const checks = [
  {
    id: 'placeholder-or-blocker',
    severity: 'blocker',
    re: /\[PLACEHOLDER\b|\bPLACEHOLDER_|\bplaceholder-v0\b|\bB-(QUIZ-COPY|PRIVACY-COPY|DERM-REVIEW|LEGAL|AI-ASSISTANT|SHOPMY|CATALOG-SEED)\b/i,
  },
  {
    id: 'unreviewed-launch-gate',
    severity: 'review',
    re: /\breviewedBy:\s*null\b|\breviewed_by\s*=\s*NULL\b|\b(RECS_REVIEWED|STACKS_REVIEWED|PAO_DEFAULTS_REVIEWED)\s*=\s*false\b/i,
  },
  {
    id: 'drug-or-disease-claim-risk',
    severity: 'claim',
    re: /\btreats\b|\bcures?\b|\bheals?\b|\bprevents?\b|\bdiagnos\w*\b|\b(acne|eczema|rosacea|psoriasis|dermatitis|melasma|hyperpigmentation)\b/i,
  },
  {
    id: 'substantiation-risk',
    severity: 'claim',
    re: /\bclinically\s+proven\b|\bdermatologist-grade\b|\bobjective\s+(analysis|score|measure)\b|\bmore\s+accurate\s+than\b/i,
  },
  {
    id: 'score-or-metric-risk',
    severity: 'claim',
    re: /\bskin\s*(score|age|health)\b|\bhazard\s*score\b|\b(improved|improvement|clearer|better|worse)\s+\d+\s*%|\b\d+\s*%\s+(improved|improvement|clearer|better|worse)\b/i,
  },
  {
    id: 'commerce-disclosure-risk',
    severity: 'claim',
    re: /\baffiliate\s+link\b|\bcommissionable\s+link\b|\bbuy\s+now\b|\blimited\s+time\b|\blast\s+chance\b|\bonly\s+\d+\s+left\b/i,
  },
];

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    if (ignoredDirs.has(entry)) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walk(full, files);
    } else if (stats.isFile() && extensions.has(extname(entry))) {
      if (ignoredFilePatterns.some((pattern) => pattern.test(full))) continue;
      files.push(full);
    }
  }
  return files;
}

function isCommentLine(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('<!--')
  );
}

function isClaimScannerFile(rel) {
  return (
    /claimsafety/i.test(rel) ||
    rel.endsWith('/claimSafetyScan.ts') ||
    rel.endsWith('/guard.ts') ||
    rel.endsWith('/intent.ts') ||
    rel.endsWith('/attribution.ts')
  );
}

function isBoundaryDisclosure(line) {
  const lower = line.toLowerCase();
  return (
    lower.includes('does not diagnose') ||
    lower.includes('do not diagnose') ||
    lower.includes('not intended to diagnose') ||
    lower.includes('no diagnosis') ||
    lower.includes('not a diagnosis') ||
    lower.includes('nothing here is a diagnosis') ||
    lower.includes('non-diagnostic') ||
    lower.includes('no score') ||
    lower.includes('no “skin age') ||
    lower.includes('no "skin age') ||
    lower.includes('never a hazard score') ||
    lower.includes('without scores') ||
    lower.includes('no medical claims') ||
    lower.includes('never a medical claim') ||
    lower.includes('no “treats/cures”') ||
    lower.includes('no "treats/cures"')
  );
}

function shouldRunClaimCheck(rel, line) {
  if (line.includes('phase3-audit-allow')) return false;
  if (rel.startsWith('docs/')) return false;
  if (isCommentLine(line)) return false;
  if (isClaimScannerFile(rel)) return false;
  if (isBoundaryDisclosure(line)) return false;
  return true;
}

const files = scanRoots.flatMap((scanRoot) => walk(resolve(root, scanRoot))).sort();
const findings = [];

function addContractFinding(message) {
  findings.push({
    file: 'scripts/phase3/build-review-packet.mjs',
    line: 1,
    id: 'review-packet-contract',
    severity: 'blocker',
    match: 'Phase 3 review packet contract',
    sample: message,
  });
}

function checkReviewPacketContract() {
  const rel = 'scripts/phase3/build-review-packet.mjs';
  const abs = resolve(root, rel);

  if (!existsSync(abs)) {
    addContractFinding('Phase 3 review packet builder is missing.');
    return;
  }

  const source = readFileSync(abs, 'utf8');
  if (
    !/function gitStatusExcludingGeneratedPacket\(\)/.test(source) ||
    !/review-packet-manifest\.json/.test(source) ||
    !/review-packet\.md/.test(source) ||
    !/gitStatus = gitStatusExcludingGeneratedPacket\(\)/.test(source)
  ) {
    addContractFinding(
      'Phase 3 review packet must ignore only its own generated outputs when recording Git status.',
    );
  }
  if (
    !/Phase 3 review packet generated with a dirty Git worktree/.test(source) ||
    !/Git status: \$\{manifest\.gitStatus \? 'DIRTY' : 'clean'\}/.test(source)
  ) {
    addContractFinding(
      'Phase 3 review packet must warn on dirty worktrees and expose Git status in Markdown.',
    );
  }

  for (const file of [
    'package.json',
    'scripts/phase3/build-review-packet.mjs',
    'scripts/phase3/audit-copy.mjs',
    'scripts/phase9/lib.mjs',
    'docs/phase-3/review-packet-index.md',
  ]) {
    if (!source.includes(`'${file}'`) && !source.includes(`"${file}"`)) {
      addContractFinding(`Phase 3 review packet must hash ${file}.`);
    }
  }
}

checkReviewPacketContract();

for (const file of files) {
  const rel = relative(root, file).replaceAll('\\', '/');
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const check of checks) {
      if (check.severity === 'claim' && !shouldRunClaimCheck(rel, line)) continue;
      const lineForCheck = check.severity === 'claim' ? (line.split('//')[0] ?? line) : line;
      const match = lineForCheck.match(check.re);
      if (!match) continue;
      findings.push({
        file: rel,
        line: index + 1,
        id: check.id,
        severity: check.severity,
        match: match[0],
        sample: line.trim().slice(0, 220),
      });
    }
  });
}

const counts = findings.reduce((acc, finding) => {
  acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
  return acc;
}, {});

const result = {
  strict,
  scannedFiles: files.length,
  findingCount: findings.length,
  counts,
  findings,
};

if (json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`Phase 3 copy audit scanned ${files.length} files.`);
  console.log(
    `Findings: ${findings.length} ` +
      `(blocker ${counts.blocker ?? 0}, review ${counts.review ?? 0}, claim ${counts.claim ?? 0}).`,
  );
  for (const finding of findings.slice(0, 120)) {
    console.log(
      `${finding.severity.toUpperCase()} ${finding.id} ${finding.file}:${finding.line} ${finding.sample}`,
    );
  }
  if (findings.length > 120) {
    console.log(`... ${findings.length - 120} more findings omitted. Use --json for full output.`);
  }
  if (findings.length > 0) {
    console.log(
      '\nStrict mode is expected to fail until legal, clinical, chemistry, privacy, and IP blockers are actually cleared.',
    );
  }
}

if (strict && findings.length > 0) {
  process.exit(1);
}
