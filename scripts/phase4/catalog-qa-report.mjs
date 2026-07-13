#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { command, gitStatusExcludingGeneratedEvidence } from '../phase9/lib.mjs';
import { launchContractSnapshot, loadLaunchContract } from '../launch/contract.mjs';

const root = process.cwd();
const launchContract = loadLaunchContract(root);
const inputPath = resolve(
  root,
  process.argv[2] ?? 'docs/phase-4/generated/obf-fixture-import.json',
);
const jsonOutputPath = resolve(
  root,
  process.argv[3] ?? 'docs/phase-4/generated/catalog-qa-report.json',
);
const mdOutputPath = jsonOutputPath.replace(/\.json$/i, '.md');
const reportOutputPaths = [jsonOutputPath, mdOutputPath].map((path) =>
  relative(root, path).replace(/\\/g, '/'),
);

const requiredSourceHashPaths = [
  'package.json',
  'docs/hugeToDo/launch-contract.json',
  'scripts/launch/contract.mjs',
  'scripts/phase4/catalog-qa-report.mjs',
  'scripts/phase4/build-source-worklist.mjs',
  'scripts/phase4/beta-coverage-report.mjs',
  'scripts/phase4/beta-coverage-report-smoke.mjs',
  'scripts/phase4/import-obf-snapshot.mjs',
  'scripts/phase4/import-cosing-dictionary.mjs',
  'scripts/phase4/import-fixture-smoke.mjs',
  'scripts/phase4/check-source-env.mjs',
  'scripts/phase4/check-source-env-smoke.mjs',
  'scripts/phase4/catalog-qa-report-smoke.mjs',
  'supabase/functions/catalog-report/index.ts',
  'supabase/functions/catalog-report/privacy.ts',
  'supabase/functions/catalog-report/privacy.test.ts',
  'supabase/functions/deno.lock',
  'scripts/phase9/lib.mjs',
  'docs/FOR_TAS_TO_DO.md',
  'docs/phase-4/beta-coverage-report.md',
  'docs/phase-4/catalog-source-memo-cosing.md',
  'docs/phase-4/catalog-source-memo-open-beauty-facts.md',
  'docs/phase-4/generated/source-worklist.json',
  'docs/phase-4/generated/source-worklist.md',
  'docs/phase-4/odbl-compliance-memo.md',
  'docs/phase-4/phase-4-exit-review.md',
];

const manifest = JSON.parse(readFileSync(inputPath, 'utf8'));
const products = Array.isArray(manifest.products) ? manifest.products : [];
const rejected = Array.isArray(manifest.rejected) ? manifest.rejected : [];

const blockers = [];
const warnings = [];

const missingCategory = products.filter((product) => !product.category);
const missingIngredients = products.filter((product) => !product.ingredientsText);
const duplicateBarcodes = products
  .map((product) => product.barcode)
  .filter((barcode, index, all) => all.indexOf(barcode) !== index);

if (duplicateBarcodes.length > 0)
  blockers.push(`Duplicate barcodes: ${[...new Set(duplicateBarcodes)].join(', ')}`);
if (missingCategory.length > 0)
  warnings.push(`${missingCategory.length} accepted products have no mapped category.`);
if (missingIngredients.length > 0)
  warnings.push(`${missingIngredients.length} accepted products have no ingredient text.`);
if (products.length < 1) blockers.push('No accepted products in import output.');

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
  return gitStatusExcludingGeneratedEvidence(reportOutputPaths);
}

const inputArtifact = hashAbsolute(inputPath);
const sourceHashes = requiredSourceHashPaths.map(hashRepoFile);
for (const sourceHash of sourceHashes) {
  if (!sourceHash.exists) blockers.push(`Missing source hash input ${sourceHash.path}.`);
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
    'Catalog QA report generated with a dirty Git worktree; do not use it as final catalog-source evidence.',
  );
}

const localQaClear = blockers.length === 0 && warnings.length === 0;
const launchClearReason =
  'No. This report only validates the local fixture/export output; launch clearance still requires final source identity, ODbL/CosIng legal review, curated batch QA, beta coverage, and reviewer signoff.';

const report = {
  generatedAt: new Date().toISOString(),
  launchContract: launchContractSnapshot(launchContract),
  inputPath,
  gitSha,
  gitStatus,
  source: manifest.source,
  importMode: manifest.importMode,
  inputArtifact,
  sourceHashes,
  totals: {
    inputRecords: manifest.totals?.inputRecords ?? null,
    acceptedProducts: products.length,
    rejectedRecords: rejected.length,
    withIngredientText: products.filter((product) => product.ingredientsText).length,
    missingCategory: missingCategory.length,
    missingIngredients: missingIngredients.length,
  },
  blockers,
  warnings,
  localQaClear,
  launchClear: false,
  launchClearReason,
};

mkdirSync(dirname(jsonOutputPath), { recursive: true });
writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`);

const markdownRows = sourceHashes
  .map((sourceHash) =>
    sourceHash.exists
      ? `| ${sourceHash.path} | present | ${sourceHash.bytes} | ${sourceHash.sha256} |`
      : `| ${sourceHash.path} | missing |  |  |`,
  )
  .join('\n');
const dirtyDetails = gitStatus.length ? `\nDirty paths:\n\n\`\`\`\n${gitStatus}\n\`\`\`\n\n` : '\n';
writeFileSync(
  mdOutputPath,
  `# Catalog QA Report\n\nGenerated: ${report.generatedAt}\n\n` +
    `Git SHA: ${report.gitSha}\n\n` +
    `Git status: ${report.gitStatus.length ? 'DIRTY' : 'clean'}\n` +
    dirtyDetails +
    `Accepted products: ${report.totals.acceptedProducts}\n\n` +
    `Rejected records: ${report.totals.rejectedRecords}\n\n` +
    `Blockers: ${blockers.length ? blockers.join('; ') : 'none'}\n\n` +
    `Warnings: ${warnings.length ? warnings.join('; ') : 'none'}\n\n` +
    `Local fixture QA clear: ${report.localQaClear ? 'yes' : 'no'}\n\n` +
    `Launch clear: no\n\n` +
    `Launch clear reason: ${report.launchClearReason}\n\n` +
    `## Input Artifact\n\n` +
    `| Path | Status | Bytes | SHA-256 |\n` +
    `| --- | --- | ---: | --- |\n` +
    (inputArtifact.exists
      ? `| ${inputArtifact.path} | present | ${inputArtifact.bytes} | ${inputArtifact.sha256} |\n\n`
      : `| ${inputArtifact.path} | missing |  |  |\n\n`) +
    `## Source Hashes\n\n` +
    `| Path | Status | Bytes | SHA-256 |\n` +
    `| --- | --- | ---: | --- |\n` +
    `${markdownRows}\n`,
);

console.log(`Wrote ${jsonOutputPath}`);
console.log(`Blockers ${blockers.length}; warnings ${warnings.length}.`);
