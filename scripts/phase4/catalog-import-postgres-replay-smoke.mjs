#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const migration = read(
  'supabase/migrations/20260725000054_catalog_import_identity_and_visibility.sql',
);
const lookup = read('supabase/functions/catalog-lookup/index.ts');
const contract = read('supabase/functions/catalog-lookup/catalogContract.ts');
const harness = read('scripts/phase4/catalog-import-postgres-replay.mjs');

for (const required of [
  'CATALOG_IMPORT_REVISION_IDENTITY_CONFLICT',
  'catalog_import_versions_source_revision_uidx',
  'CATALOG_IMPORT_REVISION_ARTIFACT_MISMATCH',
  'CATALOG_IMPORT_REVISION_IMPORTER_MISMATCH',
  'products_catalog_active_name_trgm_idx',
  'products_catalog_active_brand_trgm_idx',
  'products_catalog_active_bigram_idx',
  'products_catalog_active_rank_idx',
  "status = ''active''",
  'drop index concurrently',
]) {
  assert(migration.includes(required), `forward migration contract missing: ${required}`);
}

assert(
  lookup.includes('.eq(ACTIVE_CATALOG_PRODUCT_FILTER.column, ACTIVE_CATALOG_PRODUCT_FILTER.value)'),
  'barcode lookup does not filter mapped products to active status',
);
assert(
  lookup.indexOf('shouldFetchExternalCatalogCandidate(Boolean(barcodeRow?.product_id))') <
    lookup.indexOf('fetchOpenBeautyFacts(barcode)'),
  'mapped inactive barcode is not fenced before the external fallback',
);
assert(
  contract.includes('return !hasCatalogBarcodeMapping'),
  'catalog barcode tombstone policy is missing',
);

for (const migrationName of [
  '20260612000001_extensions_and_helpers.sql',
  '20260612000003_catalog.sql',
  '20260612000005_user_products.sql',
  '20260614000026_phase4_catalog.sql',
  '20260713000042_catalog_search_indexed_rpc.sql',
  '20260718000045_catalog_import_pipeline.sql',
  '20260718000052_catalog_search_bigram_index.sql',
  '20260725000054_catalog_import_identity_and_visibility.sql',
]) {
  assert(harness.includes(migrationName), `Docker migration closure missing: ${migrationName}`);
}

for (const proof of [
  'CATALOG_REPLAY_INJECTED_RESPONSE_LOSS',
  'CATALOG_REPLAY_INJECTED_PRECOMMIT_ROLLBACK',
  'set role ${role}',
  'running import promotion did not fail closed',
  'unapproved source promotion did not fail closed',
  'exact begin replay changed import ID',
  'replacement predecessor pointer is incorrect',
  'two-character search exposed an inactive product',
  'active plan used a products sequential scan',
  'tested_source_sha256',
]) {
  assert(harness.includes(proof), `Docker replay assertion missing: ${proof}`);
}

console.log('OK catalog PostgreSQL replay source contracts');
