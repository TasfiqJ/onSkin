#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  latencyPercentiles,
  summarizeCleanupPlan,
  validateRateLimitEvidence,
} from './rate-limit-cleanup-plan-load.mjs';

const explain = (sequential = false) => [
  {
    Plan: {
      'Node Type': 'ModifyTable',
      'Shared Hit Blocks': 10,
      Plans: [
        sequential
          ? {
              'Node Type': 'Seq Scan',
              'Relation Name': 'edge_rate_limits',
              'Actual Rows': 5_000,
            }
          : {
              'Node Type': 'Index Scan',
              'Relation Name': 'edge_rate_limits',
              'Index Name': 'edge_rate_limits_window_start_concurrent_idx',
              'Actual Rows': 5_000,
            },
      ],
    },
    'Planning Time': 0.2,
    'Execution Time': 12.5,
  },
];

const indexedPlan = summarizeCleanupPlan(explain());
assert.equal(indexedPlan.edgeRateLimitsSequentialScan, false);
assert.equal(indexedPlan.affectedRows, 5_000);
assert.deepEqual(indexedPlan.indexNames, ['edge_rate_limits_window_start_concurrent_idx']);
assert.equal(indexedPlan.sharedHitBlocks, 10);
assert.equal(summarizeCleanupPlan(explain(true)).edgeRateLimitsSequentialScan, true);

assert.deepEqual(latencyPercentiles([1_000, 2_000, 3_000, 4_000, 5_000]), {
  samples: 5,
  p50Ms: 3,
  p95Ms: 5,
  p99Ms: 5,
  maxMs: 5,
});

const cleanup = {
  before: { rows: 250_001, stale_rows: 5_000 },
  inside: { rows: 245_001, stale_rows: 0 },
  after: { rows: 250_001, stale_rows: 5_000 },
  plan: indexedPlan,
  rolledBack: true,
};
const evidence = {
  database: { major: 15, fixture_rows: 250_000, fixture_stale_rows: 5_000 },
  fixture: { synthetic_only: true, requested_rows: 250_000 },
  cleanup: { cold: cleanup, warm: cleanup },
  runtimeCleanup: {
    trigger_probability_branch_forced: true,
    decision_allowed: true,
    pre_expired_rows: 5_001,
    post_expired_rows: 0,
    expired_rows_removed: 5_001,
    trigger_count: 2,
    boundary_retained: true,
    newer_retained: true,
    expired_sentinel_removed: true,
    survivors_reconciled: true,
    transaction_rolled_back: true,
  },
  loadIsolation: { reconciled: true },
  indexContract: {
    valid: true,
    ready: true,
    unique: false,
    access_method: 'btree',
    key_attributes: 1,
    total_attributes: 1,
    partial: false,
    expression: false,
    sole_key_is_window_start: true,
    table_is_edge_rate_limits: true,
  },
  concurrentDml: {
    postgres_fixture: true,
    processed_transactions: 500,
    failed_transactions: 0,
    dml_before_migration: 5,
    dml_during_migration: 100,
    dml_total: 500,
    migration_duration_ms: 125,
    forward_progress_during_migration: true,
    zero_dml_errors: true,
  },
  indexMigration: {
    create_index_concurrently: true,
    drop_legacy_index_concurrently: true,
    safe_reapply: true,
    wrong_definition: {
      rejected: true,
      sqlstate: '55000',
      message: 'edge_rate_limits_cleanup_index_definition_mismatch',
      hint: 'Run DROP INDEX CONCURRENTLY IF EXISTS public.edge_rate_limits_window_start_concurrent_idx; then retry migration 20260726000059.',
      exact_contract: true,
      fixture_sole_key_is_window_start: false,
      legacy_oid_unchanged: true,
      recovered: true,
    },
    invalid_or_unready: {
      rejected: true,
      sqlstate: '55000',
      message: 'edge_rate_limits_cleanup_index_invalid_or_unready',
      hint: 'Run DROP INDEX CONCURRENTLY IF EXISTS public.edge_rate_limits_window_start_concurrent_idx; then retry migration 20260726000059.',
      exact_contract: true,
      fixture_valid: false,
      fixture_ready: false,
      legacy_oid_unchanged: true,
      recovered: true,
    },
    legacy_index_absent: true,
  },
  loads: {
    hot_key: {
      clients: 32,
      samples: 500,
      processed_transactions: 500,
      failed_transactions: 0,
      tps: 100,
      reject_ratio: 0.8,
      decisions: { requests: 500, buckets: 1 },
    },
    many_keys_insert: {
      clients: 10,
      transactions_per_client: 50,
      samples: 500,
      processed_transactions: 500,
      failed_transactions: 0,
      tps: 100,
      reject_ratio: 0,
      decisions: { requests: 500, buckets: 500, reused_buckets: 0 },
    },
    many_keys_replay: {
      clients: 10,
      transactions_per_client: 50,
      samples: 500,
      processed_transactions: 500,
      failed_transactions: 0,
      tps: 100,
      reject_ratio: 0,
      decisions: { requests: 1_000, buckets: 500, reused_buckets: 500 },
    },
  },
  growth: {
    after_hot_key: { rows: 245_002 },
    after_many_keys_insert: { rows: 245_502 },
    after_many_keys_replay: { rows: 245_502 },
  },
  correctness: {
    exact_limit_semantics: true,
    rejects_invalid_scope: true,
    rejects_invalid_hash: true,
    rejects_invalid_limit: true,
    rejects_invalid_window: true,
    grants: {
      service_role: true,
      anon: false,
      authenticated: false,
      public_table_access: false,
      anon_table_access: false,
      authenticated_table_access: false,
      rls_enabled: true,
    },
    function_metadata: {
      security_definer: true,
      returns_boolean: true,
      arguments_exact: true,
      empty_search_path: true,
      owner_name: 'postgres',
      owner_is_superuser: true,
      public_execute: false,
    },
    privacy: { all_keys_are_64_hex: true, raw_identity_columns_absent: true },
  },
  policyRisks: {
    cleanup_is_global: true,
    cleanup_age_comes_from_triggering_window: true,
    primary_key_omits_window_seconds: true,
    potential_active_long_window_deletion: true,
    exact_strict_cleanup_predicate: true,
  },
};
assert.deepEqual(validateRateLimitEvidence(evidence), []);

const invalid = structuredClone(evidence);
invalid.cleanup.warm.plan = summarizeCleanupPlan(explain(true));
invalid.loads.hot_key.reject_ratio = 0;
invalid.loads.many_keys_insert.decisions.reused_buckets = 1;
invalid.correctness.grants.anon = true;
invalid.indexMigration.legacy_index_absent = false;
invalid.concurrentDml.dml_during_migration = 0;
const failures = validateRateLimitEvidence(invalid);
assert(failures.includes('cleanup_warm:sequential_scan'));
assert(failures.includes('cleanup_warm:missing_window_index'));
assert(failures.includes('hot_key:missing_rejections'));
assert(failures.includes('many_keys:non_unique_fixture_keys'));
assert(failures.includes('grant_or_rls_mismatch'));
assert(failures.includes('cleanup_index_migration_mismatch'));
assert(failures.includes('cleanup_index_concurrent_dml_mismatch'));

const baseMigration = readFileSync(
  'supabase/migrations/20260705000029_phase9_edge_rate_limits.sql',
  'utf8',
);
const indexMigration = readFileSync(
  'supabase/migrations/20260712000040_edge_rate_limit_cleanup_index.sql',
  'utf8',
);
const guardMigration = readFileSync(
  'supabase/migrations/20260718000053_edge_rate_limit_cleanup_index_guard.sql',
  'utf8',
);
const concurrentIndexMigration = readFileSync(
  'supabase/migrations/20260726000059_edge_rate_limit_cleanup_concurrent_index.sql',
  'utf8',
);
const fixtureSql = readFileSync('scripts/optimization/rate-limit-cleanup-plan-load.sql', 'utf8');
const pgbenchSql = readFileSync('scripts/optimization/rate-limit-cleanup-pgbench.sql', 'utf8');

assert.match(baseMigration, /where\s+window_start\s+</i);
assert.match(indexMigration, /edge_rate_limits_window_start_idx[\s\S]*?\(window_start\)/i);
assert.doesNotMatch(indexMigration, /cron\.schedule|delete\s+from/i);
assert.match(guardMigration, /indexes\.indisvalid/i);
assert.match(guardMigration, /indexes\.indisready/i);
assert.match(guardMigration, /indexes\.indkey\[0\]\s*=\s*window_start\.attnum/i);
assert.match(guardMigration, /raise exception/i);
assert.match(
  concurrentIndexMigration,
  /create\s+index\s+concurrently\s+if\s+not\s+exists\s+edge_rate_limits_window_start_concurrent_idx/i,
);
assert.match(
  concurrentIndexMigration,
  /drop\s+index\s+concurrently\s+if\s+exists\s+public\.edge_rate_limits_window_start_idx/i,
);
assert.match(concurrentIndexMigration, /not\s+indexes\.indisunique/i);
assert.match(concurrentIndexMigration, /indexes\.indpred\s+is\s+null/i);
assert.match(concurrentIndexMigration, /indexes\.indexprs\s+is\s+null/i);
assert.match(concurrentIndexMigration, /indexes\.indkey\[0\]\s*=\s*window_start\.attnum/i);
assert.equal((concurrentIndexMigration.match(/errcode\s*=\s*'55000'/g) ?? []).length, 2);
assert.match(
  concurrentIndexMigration,
  /message\s*=\s*'edge_rate_limits_cleanup_index_invalid_or_unready'/i,
);
assert.match(
  concurrentIndexMigration,
  /message\s*=\s*'edge_rate_limits_cleanup_index_definition_mismatch'/i,
);
assert.equal(
  (
    concurrentIndexMigration.match(
      /hint\s*=\s*'Run DROP INDEX CONCURRENTLY IF EXISTS public\.edge_rate_limits_window_start_concurrent_idx; then retry migration 20260726000059\.'/g,
    ) ?? []
  ).length,
  2,
);
assert(
  concurrentIndexMigration.indexOf('edge_rate_limits_cleanup_index_invalid_or_unready') <
    concurrentIndexMigration.indexOf(
      'create index concurrently if not exists edge_rate_limits_window_start_concurrent_idx',
    ),
);
assert(
  concurrentIndexMigration.indexOf('raise exception') <
    concurrentIndexMigration.indexOf(
      'drop index concurrently if exists public.edge_rate_limits_window_start_idx',
    ),
);
assert.doesNotMatch(concurrentIndexMigration, /(?:^|;)\s*create\s+index\s+(?!concurrently)/im);
assert.doesNotMatch(concurrentIndexMigration, /(?:^|;)\s*drop\s+index\s+(?!concurrently)/im);
assert.match(fixtureSql, /autovacuum_enabled\s*=\s*false/i);
assert.match(pgbenchSql, /case\s+when\s+:key_mode\s*=\s*1/i);
assert.match(pgbenchSql, /md5\(/i);
assert.match(pgbenchSql, /\\set\s+txn_no\s+:txn_no\s*\+\s*1/i);
assert.doesNotMatch(pgbenchSql, /ip_address|user_agent|email/i);

console.log('Rate-limit cleanup plan/load smoke passed.');
