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
  'operator_class.oid = index_state.indclass[0]',
  "v_index.operator_class_schema <> 'extensions'",
  "v_index.operator_class_name <> 'gin_trgm_ops'",
  "status = ''active''",
  'drop index concurrently',
]) {
  assert(migration.includes(required), `forward migration contract missing: ${required}`);
}

assert(
  lookup.includes('await admin.rpc(CATALOG_LOOKUP_RPC, {'),
  'barcode lookup bypasses the guarded catalog RPC',
);
assert(
  !lookup.includes('fetchOpenBeautyFacts') &&
    !lookup.includes('shouldFetchExternalCatalogCandidate'),
  'barcode lookup reintroduced a runtime external-catalog fallback',
);
assert(
  contract.includes("'lookup_catalog_product_by_barcode'") &&
    lookup.includes('requireActiveHealthProcessing(') &&
    lookup.includes('requireSameAccountAccess('),
  'guarded catalog barcode contract or caller fences are missing',
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
  'index.operator_class_schema === contract.operatorClass[0]',
  'index.operator_class_name === contract.operatorClass[1]',
  'lower\\(name\\) (?:extensions\\.)?gin_trgm_ops',
]) {
  assert(harness.includes(proof), `Docker replay assertion missing: ${proof}`);
}

console.log('OK catalog PostgreSQL replay source contracts');
