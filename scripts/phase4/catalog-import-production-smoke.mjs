#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MAX_CATALOG_LINE_BYTES, normalizeGtin, runCatalogImport } from './catalog-import-core.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function gtin(body) {
  let sum = 0;
  for (let index = body.length - 1, position = 0; index >= 0; index -= 1, position += 1) {
    sum += Number(body[index]) * (position % 2 === 0 ? 3 : 1);
  }
  return `${body}${(10 - (sum % 10)) % 10}`;
}

class FakeCatalogAdapter {
  importId = '00000000-0000-4000-8000-000000000117';
  status = 'running';
  checkpointLine = 0;
  acceptedRecords = 0;
  rejectedRecords = 0;
  staged = new Map();
  receipts = new Map();
  responseLossInjected = false;
  outageFailuresRemaining = 2;

  async beginImport() {
    return this.snapshot();
  }

  snapshot(extra = {}) {
    return {
      importId: this.importId,
      status: this.status,
      checkpointLine: this.checkpointLine,
      acceptedRecords: this.acceptedRecords,
      rejectedRecords: this.rejectedRecords,
      stagedProducts: this.staged.size,
      ...extra,
    };
  }

  async stageBatch(input) {
    const receipt = this.receipts.get(input.expectedCheckpoint);
    if (this.checkpointLine === input.lastLine && receipt) {
      assert(receipt.batchSha256 === input.batchSha256, 'replayed batch checksum changed');
      return this.snapshot({ replayed: true });
    }
    assert(this.status === 'running', 'batch accepted outside running import');
    assert(input.expectedCheckpoint === this.checkpointLine, 'checkpoint advanced out of order');

    if (input.expectedCheckpoint === 2 && this.outageFailuresRemaining > 0) {
      this.outageFailuresRemaining -= 1;
      throw new Error('simulated pre-commit outage');
    }

    assert(
      input.rows.length + input.rejectedCount === input.lastLine - input.expectedCheckpoint,
      'batch cardinality mismatch',
    );
    for (const row of input.rows) {
      const existing = this.staged.get(row.canonical_identity);
      if (!existing || row.line_number > existing.line_number) {
        this.staged.set(row.canonical_identity, row);
      }
    }
    this.acceptedRecords += input.rows.length;
    this.rejectedRecords += input.rejectedCount;
    this.checkpointLine = input.lastLine;
    this.receipts.set(input.expectedCheckpoint, {
      batchSha256: input.batchSha256,
      lastLine: input.lastLine,
    });

    if (input.expectedCheckpoint === 0 && !this.responseLossInjected) {
      this.responseLossInjected = true;
      throw new Error('simulated commit-then-response-loss');
    }
    return this.snapshot({ replayed: false });
  }

  async markReady(input) {
    assert(input.inputRecords === this.checkpointLine, 'ready before complete checkpoint');
    assert(input.acceptedRecords === this.acceptedRecords, 'accepted count mismatch');
    assert(input.rejectedRecords === this.rejectedRecords, 'reject count mismatch');
    assert(input.acceptedRecords + input.rejectedRecords === input.inputRecords, 'input count gap');
    this.status = 'ready';
    this.manifest = input.manifest;
    return this.snapshot();
  }

  async promote() {
    assert(this.status === 'ready', 'partial import was promoted');
    this.status = 'active';
    return { importId: this.importId, status: 'active', activeProducts: this.staged.size };
  }
}

const directory = mkdtempSync(join(tmpdir(), 'layerwell-catalog-production-smoke-'));
try {
  const rejectedPromotion = spawnSync(
    process.execPath,
    [join(process.cwd(), 'scripts/phase4/import-obf-production.mjs'), '--promote'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, CATALOG_SUPABASE_URL: '', CATALOG_SUPABASE_SECRET_KEY: '' },
      timeout: 10_000,
    },
  );
  assert(rejectedPromotion.status !== 0, 'production CLI accepted unsafe direct promotion');
  assert(
    rejectedPromotion.stderr.includes('CATALOG_IMPORT_PROMOTION_REQUIRES_CAT02'),
    'production CLI did not reject promotion before credential or network setup',
  );

  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260718000045_catalog_import_pipeline.sql'),
    'utf8',
  );
  for (const contract of [
    'catalog_import_versions',
    'catalog_import_staged_products',
    'catalog_import_batch_receipts',
    'catalog_active_imports',
    'begin_catalog_import',
    'stage_catalog_import_batch',
    'ready_catalog_import',
    'promote_catalog_import',
    'previous_active_import_id',
    'production_approved',
    'pg_advisory_xact_lock',
    'for update',
    'enable row level security',
    'to service_role',
    'analyze public.products',
    'distinct on (row.canonical_identity)',
  ]) {
    assert(migration.toLowerCase().includes(contract), `migration contract missing: ${contract}`);
  }

  const inputPath = join(directory, 'obf.jsonl');
  const checkpointPath = join(directory, 'checkpoint.json');
  const cleanserGtin = gtin('400638133393');
  const sunscreenGtin = gtin('590123412345');
  const shampooGtin = gtin('1234567');
  const oversizedGtin = gtin('950123460000');
  const invalidGtin = `${cleanserGtin.slice(0, -1)}${(Number(cleanserGtin.at(-1)) + 1) % 10}`;

  assert(normalizeGtin(cleanserGtin) === cleanserGtin, 'valid GTIN was rejected');
  assert(normalizeGtin(invalidGtin) === null, 'invalid GTIN checksum was accepted');

  const lines = [
    JSON.stringify({
      code: cleanserGtin,
      product_name: 'Gentle Cleanser',
      brands: 'Fixture Lab',
      ingredients_text: 'Water, Glycerin',
      categories_tags: ['en:beauty', 'en:skin-care', 'en:cleansers'],
      last_modified_t: 1767225600,
    }),
    '{invalid-json',
    JSON.stringify({
      code: sunscreenGtin,
      product_name: 'Mineral Sunscreen',
      brands: 'Fixture Lab',
      ingredients_text: 'Zinc Oxide, Water',
      categories_tags: ['en:beauty', 'en:skin-care', 'en:sunscreens'],
    }),
    JSON.stringify({
      code: invalidGtin,
      product_name: 'Invalid GTIN Product',
      categories_tags: ['en:beauty', 'en:skin-care'],
    }),
    JSON.stringify({
      code: cleanserGtin,
      product_name: 'Gentle Cleanser Updated',
      brands: 'Fixture Lab',
      ingredients_text: 'Water, Glycerin, Niacinamide',
      categories_tags: ['en:beauty', 'en:skin-care', 'en:cleansers'],
    }),
    JSON.stringify({
      code: shampooGtin,
      product_name: 'Hair Shampoo',
      categories_tags: ['en:beauty', 'en:hair-care', 'en:shampoos'],
    }),
    JSON.stringify({
      code: oversizedGtin,
      product_name: 'x'.repeat(241),
      categories_tags: ['en:beauty', 'en:skin-care'],
    }),
    JSON.stringify({
      code: gtin('950123460001'),
      product_name: 'Oversized Raw Record',
      categories_tags: ['en:beauty', 'en:skin-care'],
      unused_source_payload: 'x'.repeat(MAX_CATALOG_LINE_BYTES + 1),
    }),
  ];
  writeFileSync(inputPath, `${lines.join('\n')}\n`);

  const adapter = new FakeCatalogAdapter();
  await runCatalogImport({
    adapter,
    batchSize: 2,
    checkpointPath,
    inputPath,
    promote: true,
    sourceRevision: 'fixture-2026-07-18',
  }).then(
    () => {
      throw new Error('expected the first run to stop at the simulated outage');
    },
    (error) => assert(error.message === 'simulated pre-commit outage', 'unexpected first failure'),
  );

  const interrupted = JSON.parse(readFileSync(checkpointPath, 'utf8'));
  assert(interrupted.checkpointLine === 2, 'durable checkpoint did not stop at committed batch');
  assert(interrupted.acceptedRecords === 1, 'response-loss retry duplicated accepted count');
  assert(interrupted.rejectedRecords === 1, 'response-loss retry duplicated reject count');
  assert(
    !JSON.stringify(interrupted).includes('Gentle Cleanser'),
    'checkpoint leaked product data',
  );

  // Prove the durable server receipt is sufficient on another worker/machine;
  // the stream reconstructs content-free reject reasons for already committed lines.
  rmSync(checkpointPath, { force: true });
  adapter.outageFailuresRemaining = 0;
  const completed = await runCatalogImport({
    adapter,
    batchSize: 2,
    checkpointPath,
    inputPath,
    promote: true,
    sourceRevision: 'fixture-2026-07-18',
  });

  assert(completed.inputRecords === 8, 'streamed input count mismatch');
  assert(completed.acceptedRecords === 3, 'accepted record count mismatch');
  assert(completed.rejectedRecords === 5, 'rejected record count mismatch');
  assert(adapter.staged.size === 2, 'canonical identity did not deduplicate staged products');
  assert(
    adapter.staged.get(`gtin:${cleanserGtin}`)?.name === 'Gentle Cleanser Updated',
    'later source revision did not win duplicate canonical identity',
  );
  assert(completed.promotion?.status === 'active', 'complete import was not promoted');
  assert(adapter.manifest.rejectionReasons.invalid_json === 1, 'invalid JSON reject missing');
  assert(adapter.manifest.rejectionReasons.invalid_gtin === 1, 'GTIN reject missing');
  assert(adapter.manifest.rejectionReasons.not_skin_care_category === 1, 'category reject missing');
  assert(adapter.manifest.rejectionReasons.oversized_name === 1, 'oversize reject missing');
  assert(adapter.manifest.rejectionReasons.oversized_record === 1, 'raw oversize reject missing');
  assert(
    adapter.manifest.maximumLineBytes === MAX_CATALOG_LINE_BYTES,
    'bounded line ceiling missing from manifest',
  );

  const repeated = await runCatalogImport({
    adapter,
    batchSize: 2,
    checkpointPath,
    inputPath,
    promote: true,
    sourceRevision: 'fixture-2026-07-18',
  });
  assert(repeated.alreadyActive === true, 'active import rerun was not a no-op');
  assert(adapter.acceptedRecords === 3, 'active rerun duplicated accepted records');

  // A restored/recreated staging database can legitimately start a new import
  // while a checkpoint for the same immutable artifact remains on disk. The
  // server starts at zero and the worker must not seed manifest reasons from
  // the unrelated local import ID.
  const recreatedAdapter = new FakeCatalogAdapter();
  recreatedAdapter.importId = '00000000-0000-4000-8000-000000000118';
  recreatedAdapter.outageFailuresRemaining = 0;
  recreatedAdapter.responseLossInjected = true;
  const recreated = await runCatalogImport({
    adapter: recreatedAdapter,
    batchSize: 2,
    checkpointPath,
    inputPath,
    sourceRevision: 'fixture-2026-07-18',
  });
  assert(recreated.status === 'ready', 'recreated server import did not reach ready');
  assert(
    recreated.manifest.rejectionReasons.invalid_json === 1,
    'stale local checkpoint duplicated reconstructed reject reasons',
  );

  console.log('OK catalog production importer streaming/restart/promotion smoke');
  console.log('8 input records; 3 accepted; 5 rejected; 2 canonical staged products.');
} finally {
  rmSync(directory, { force: true, recursive: true });
}
