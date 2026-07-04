#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const inputPath = resolve(root, process.argv[2] ?? 'scripts/phase4/fixtures/obf-sample.jsonl');
const outputPath = resolve(root, process.argv[3] ?? 'docs/phase-4/generated/obf-fixture-import.json');

const BEAUTY_TAGS = new Set([
  'en:beauty',
  'en:cosmetics',
  'en:skin-care',
  'en:face-care',
  'en:moisturizers',
  'en:sunscreens',
  'en:cleansers',
  'en:serums',
  'en:toners',
]);
const REJECT_TAGS = new Set(['en:mouthwashes', 'en:toothpastes', 'en:oral-care', 'en:shampoos', 'en:hair-care']);

function normalizeBarcode(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

function normalizeText(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : null;
}

function categoryFromTags(tags) {
  const lower = tags.map((tag) => tag.toLowerCase());
  if (lower.some((tag) => tag.includes('sunscreen') || tag.includes('sun-protection'))) return 'spf';
  if (lower.some((tag) => tag.includes('cleanser'))) return 'cleanser';
  if (lower.some((tag) => tag.includes('toner') || tag.includes('essence'))) return 'toner';
  if (lower.some((tag) => tag.includes('serum'))) return 'serum';
  if (lower.some((tag) => tag.includes('moisturizer') || tag.includes('moisturiser'))) return 'moisturiser_tube';
  return null;
}

function isBeautyCandidate(tags) {
  const lower = tags.map((tag) => tag.toLowerCase());
  if (lower.some((tag) => REJECT_TAGS.has(tag))) return false;
  return lower.some((tag) => BEAUTY_TAGS.has(tag));
}

const raw = readFileSync(inputPath, 'utf8');
const records = raw
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSONL at line ${index + 1}: ${error.message}`);
    }
  });

const products = [];
const rejected = [];

for (const record of records) {
  const barcode = normalizeBarcode(record.code);
  const name = normalizeText(record.product_name);
  const brand = normalizeText(record.brands);
  const tags = Array.isArray(record.categories_tags) ? record.categories_tags : [];
  const ingredientsText = normalizeText(record.ingredients_text);
  const beauty = isBeautyCandidate(tags);

  if (!barcode || !name || !beauty) {
    rejected.push({
      code: record.code ?? null,
      product_name: record.product_name ?? null,
      reason: !barcode ? 'invalid_barcode' : !name ? 'missing_name' : 'not_skin_care_category',
    });
    continue;
  }

  products.push({
    barcode,
    name,
    brand,
    category: categoryFromTags(tags),
    ingredientsText,
    source: 'open_beauty_facts',
    sourceRef: barcode,
    sourceUrl: `https://world.openbeautyfacts.org/product/${barcode}`,
    sourceSnapshotDate:
      typeof record.last_modified_t === 'number'
        ? new Date(record.last_modified_t * 1000).toISOString().slice(0, 10)
        : null,
    qualityGrade: ingredientsText ? 'limited' : 'unverified',
    reviewStatus: 'unreviewed',
  });
}

const manifest = {
  generatedAt: new Date().toISOString(),
  inputPath,
  inputSha256: createHash('sha256').update(raw).digest('hex'),
  source: 'open_beauty_facts',
  importMode: 'export_or_fixture',
  warning: 'Fixture import only. Production bulk import must use approved export artifacts and legal/source review.',
  totals: {
    inputRecords: records.length,
    acceptedProducts: products.length,
    rejectedRecords: rejected.length,
    withIngredientText: products.filter((product) => product.ingredientsText).length,
  },
  products,
  rejected,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Wrote ${outputPath}`);
console.log(`Accepted ${products.length}/${records.length}; rejected ${rejected.length}.`);

