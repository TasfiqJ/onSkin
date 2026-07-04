#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const fixtureMode = process.argv.includes('--fixture');
const approved = process.env.COSING_IMPORT_APPROVED === 'true';
const inputArg = process.argv.find((arg) => !arg.startsWith('--') && arg.endsWith('.csv'));
const inputPath = resolve(root, inputArg ?? 'scripts/phase4/fixtures/cosing-sample.csv');
const outputPath = resolve(root, 'docs/phase-4/generated/cosing-fixture-import.json');

if (!fixtureMode && !approved) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        status: 'blocked',
        reason: 'COSING_IMPORT_APPROVED is not true. Production CosIng import requires source/legal review.',
        inputPath,
      },
      null,
      2,
    )}\n`,
  );
  console.error('CosIng import blocked. Re-run with --fixture for local fixtures or COSING_IMPORT_APPROVED=true after review.');
  process.exit(0);
}

function parseCsvLine(line) {
  const out = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      out.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  out.push(current);
  return out.map((value) => value.trim());
}

const raw = readFileSync(inputPath, 'utf8');
const lines = raw.split(/\r?\n/).filter(Boolean);
const headers = parseCsvLine(lines.shift() ?? '');
const rows = lines.map((line) => {
  const values = parseCsvLine(line);
  return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
});

const ingredients = rows
  .filter((row) => row.inci_name)
  .map((row) => ({
    inciName: row.inci_name,
    displayName: row.display_name || row.inci_name,
    casNumber: row.cas_number || null,
    ecNumber: row.ec_number || null,
    annexStatus: row.annex_status || null,
    source: 'cosing',
    reviewStatus: 'unreviewed',
    synonyms: row.synonyms ? row.synonyms.split('|').map((value) => value.trim()).filter(Boolean) : [],
  }));

const manifest = {
  generatedAt: new Date().toISOString(),
  status: fixtureMode ? 'fixture' : 'approved_transform',
  warning: 'CosIng is informative only. Do not treat ingredient presence as approval or safety.',
  inputPath,
  inputSha256: createHash('sha256').update(raw).digest('hex'),
  totals: {
    inputRows: rows.length,
    ingredients: ingredients.length,
    synonyms: ingredients.reduce((sum, ingredient) => sum + ingredient.synonyms.length, 0),
  },
  ingredients,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);

