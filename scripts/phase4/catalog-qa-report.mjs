#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const inputPath = resolve(root, process.argv[2] ?? 'docs/phase-4/generated/obf-fixture-import.json');
const jsonOutputPath = resolve(root, process.argv[3] ?? 'docs/phase-4/generated/catalog-qa-report.json');
const mdOutputPath = jsonOutputPath.replace(/\.json$/i, '.md');

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

if (duplicateBarcodes.length > 0) blockers.push(`Duplicate barcodes: ${[...new Set(duplicateBarcodes)].join(', ')}`);
if (missingCategory.length > 0) warnings.push(`${missingCategory.length} accepted products have no mapped category.`);
if (missingIngredients.length > 0) warnings.push(`${missingIngredients.length} accepted products have no ingredient text.`);
if (products.length < 1) blockers.push('No accepted products in import output.');

const localQaClear = blockers.length === 0 && warnings.length === 0;
const launchClearReason =
  'No. This report only validates the local fixture/export output; launch clearance still requires final source identity, ODbL/CosIng legal review, curated batch QA, beta coverage, and reviewer signoff.';

const report = {
  generatedAt: new Date().toISOString(),
  inputPath,
  source: manifest.source,
  importMode: manifest.importMode,
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
writeFileSync(
  mdOutputPath,
  `# Catalog QA Report\n\nGenerated: ${report.generatedAt}\n\n` +
    `Accepted products: ${report.totals.acceptedProducts}\n\n` +
    `Rejected records: ${report.totals.rejectedRecords}\n\n` +
    `Blockers: ${blockers.length ? blockers.join('; ') : 'none'}\n\n` +
    `Warnings: ${warnings.length ? warnings.join('; ') : 'none'}\n\n` +
    `Local fixture QA clear: ${report.localQaClear ? 'yes' : 'no'}\n\n` +
    `Launch clear: no\n\n` +
    `Launch clear reason: ${report.launchClearReason}\n`,
);

console.log(`Wrote ${jsonOutputPath}`);
console.log(`Blockers ${blockers.length}; warnings ${warnings.length}.`);
