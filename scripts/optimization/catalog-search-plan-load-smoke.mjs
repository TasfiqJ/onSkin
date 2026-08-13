#!/usr/bin/env node

import assert from 'node:assert/strict';

import {
  latencyPercentiles,
  summarizePlan,
  validateCatalogPlanEvidence,
} from './catalog-search-plan-load.mjs';

function explain(indexName, { rows = 20, sequential = false } = {}) {
  const indexNames = Array.isArray(indexName) ? indexName : [indexName];
  return [
    {
      Plan: {
        'Node Type': 'Limit',
        'Actual Rows': rows,
        'Shared Hit Blocks': 4,
        Plans: sequential
          ? [{ 'Node Type': 'Seq Scan', 'Relation Name': 'products', 'Actual Rows': rows }]
          : indexNames.map((name) => ({
              'Node Type': 'Bitmap Index Scan',
              'Index Name': name,
              'Actual Rows': rows,
              'Shared Hit Blocks': 4,
            })),
      },
      'Planning Time': 0.2,
      'Execution Time': 1.5,
    },
  ];
}

const trigram = summarizePlan(
  explain(['products_catalog_name_trgm_idx', 'products_catalog_brand_trgm_idx']),
);
assert.equal(trigram.productsSequentialScan, false);
assert.deepEqual(trigram.indexNames, [
  'products_catalog_brand_trgm_idx',
  'products_catalog_name_trgm_idx',
]);
assert.equal(trigram.returnedRows, 20);
assert.equal(trigram.sharedHitBlocks, 4);

const sequential = summarizePlan(explain(null, { sequential: true }));
assert.equal(sequential.productsSequentialScan, true);

assert.deepEqual(latencyPercentiles([1_000, 2_000, 3_000, 4_000, 5_000]), {
  samples: 5,
  p50Ms: 3,
  p95Ms: 5,
  p99Ms: 5,
  maxMs: 5,
});

const plans = Object.fromEntries(
  ['common_name', 'brand', 'prefix', 'misspelling', 'no_result'].map((queryClass) => [
    queryClass,
    { warm: trigram },
  ]),
);
plans.exact_barcode = {
  warm: summarizePlan(explain('products_barcode_key', { rows: 1 })),
};
plans.two_character_rare = {
  warm: summarizePlan(explain('products_catalog_bigram_idx')),
};
plans.two_character_selective = {
  warm: summarizePlan(explain('products_catalog_rank_idx')),
};
plans.two_character_common = {
  warm: summarizePlan(explain('products_catalog_rank_idx')),
};
const requiredEvidence = {
  database: { products: 250_000 },
  fixture: { synthetic_only: true, requested_rows: 250_000 },
  writeCost: {
    insertedRowsPerRun: 1_000,
    runsPerIndexSet: 5,
    trigramOnly: { p50Ms: 1 },
    final: { p50Ms: 2 },
  },
  maintenance: { n_live_tup: 250_000, analyze_count: 1 },
  twoCharacterProbes: {
    rare: { warm: summarizePlan(explain('products_catalog_bigram_idx')) },
    selective: { warm: summarizePlan(explain('products_catalog_bigram_idx')) },
    common: { warm: summarizePlan(explain('products_catalog_rank_idx')) },
  },
};
const valid = validateCatalogPlanEvidence({
  ...requiredEvidence,
  plans,
  correctness: {
    blockedVisible: false,
    boundedResultCount: true,
    stableRanking: true,
    semanticEquivalentToLikeBaseline: true,
  },
  concurrency: { samples: 100 },
});
assert.deepEqual(valid, []);

plans.brand = { warm: sequential };
const invalid = validateCatalogPlanEvidence({
  ...requiredEvidence,
  plans,
  correctness: {
    blockedVisible: true,
    boundedResultCount: false,
    stableRanking: false,
    semanticEquivalentToLikeBaseline: false,
  },
  concurrency: { samples: 2 },
});
assert(invalid.includes('brand:products_seq_scan'));
assert(invalid.includes('blocked_visibility'));
assert(invalid.includes('substring_semantic_mismatch'));
assert(invalid.includes('insufficient_concurrency_samples'));

const insufficientScale = validateCatalogPlanEvidence({
  ...requiredEvidence,
  database: { products: 1_000 },
  fixture: { synthetic_only: true, requested_rows: 1_000 },
  plans,
  correctness: {
    blockedVisible: false,
    boundedResultCount: true,
    stableRanking: true,
    semanticEquivalentToLikeBaseline: true,
  },
  concurrency: { samples: 100 },
});
assert(insufficientScale.includes('insufficient_realistic_scale'));

console.log('Catalog search plan/load smoke passed.');
