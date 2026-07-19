#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixturePath = path.join(
  repoRoot,
  'scripts',
  'optimization',
  'rate-limit-cleanup-plan-load.sql',
);
const pgbenchPath = path.join(
  repoRoot,
  'scripts',
  'optimization',
  'rate-limit-cleanup-pgbench.sql',
);
const baseMigrationPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '20260705000029_phase9_edge_rate_limits.sql',
);
const indexMigrationPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '20260712000040_edge_rate_limit_cleanup_index.sql',
);
const indexGuardMigrationPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '20260718000053_edge_rate_limit_cleanup_index_guard.sql',
);
const DEFAULT_REPORT = path.join(
  repoRoot,
  'docs',
  'optimization',
  'reports',
  '2026-07-18_rate-limit-cleanup-plan-load-report.json',
);
const MIN_REALISTIC_ROWS = 250_000;
const DEFAULT_STALE_ROWS = 2_500;
const DATABASE = 'onskin_rate_limit_benchmark';
const PASSWORD = 'onskin-local-opt119-only';
const CLEANUP_PREDICATE = 'window_start < now() - make_interval(secs => greatest(60 * 4, 3600))';

function integerOption(name, fallback, minimum, maximum) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Invalid --${name}; expected an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
}

function stringOption(name, fallback) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    input: options.input,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const safe = `${result.stderr ?? ''}\n${result.stdout ?? ''}`.trim().slice(0, 2_000);
    throw new Error(`${commandName} failed (${result.status ?? 'signal'}): ${safe}`);
  }
  return result.stdout.trim();
}

function docker(args, options) {
  return command('docker', args, options);
}

function waitForPostgres(container) {
  let consecutiveReadyProbes = 0;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = spawnSync(
      'docker',
      ['exec', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', DATABASE, '-c', 'select 1'],
      { cwd: repoRoot, encoding: 'utf8' },
    );
    consecutiveReadyProbes =
      result.status === 0 && result.stdout.trim() === '1' ? consecutiveReadyProbes + 1 : 0;
    if (consecutiveReadyProbes >= 3) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  throw new Error('PostgreSQL did not become ready within 20 seconds.');
}

function psql(container, sql, extraArgs = []) {
  return docker(
    [
      'exec',
      '-i',
      container,
      'psql',
      '-X',
      '-qAt',
      '-v',
      'ON_ERROR_STOP=1',
      ...extraArgs,
      '-U',
      'postgres',
      '-d',
      DATABASE,
    ],
    { input: sql },
  );
}

function psqlFails(container, sql) {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      container,
      'psql',
      '-X',
      '-qAt',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      DATABASE,
    ],
    { cwd: repoRoot, encoding: 'utf8', input: sql },
  );
  return result.status !== 0;
}

function jsonQuery(container, sql) {
  const output = psql(container, sql);
  if (!output) throw new Error('PostgreSQL returned an empty JSON result.');
  return JSON.parse(output.split(/\r?\n/).filter(Boolean).at(-1));
}

function collectPlanNodes(value, nodes = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectPlanNodes(item, nodes);
    return nodes;
  }
  if (!value || typeof value !== 'object') return nodes;
  if (typeof value['Node Type'] === 'string') {
    nodes.push({
      nodeType: value['Node Type'],
      relationName: typeof value['Relation Name'] === 'string' ? value['Relation Name'] : null,
      indexName: typeof value['Index Name'] === 'string' ? value['Index Name'] : null,
      actualRows: typeof value['Actual Rows'] === 'number' ? value['Actual Rows'] : null,
    });
  }
  for (const nested of Object.values(value)) collectPlanNodes(nested, nodes);
  return nodes;
}

export function summarizeCleanupPlan(explain) {
  if (!Array.isArray(explain) || !explain[0] || typeof explain[0] !== 'object') {
    throw new Error('Invalid PostgreSQL JSON cleanup EXPLAIN payload.');
  }
  const root = explain[0];
  const nodes = collectPlanNodes(root);
  const relationNodes = nodes.filter((node) => node.relationName === 'edge_rate_limits');
  return Object.freeze({
    planningMs: Number(root['Planning Time'] ?? 0),
    executionMs: Number(root['Execution Time'] ?? 0),
    nodeTypes: [...new Set(nodes.map((node) => node.nodeType))].sort(),
    indexNames: [...new Set(nodes.map((node) => node.indexName).filter(Boolean))].sort(),
    edgeRateLimitsSequentialScan: relationNodes.some((node) => node.nodeType === 'Seq Scan'),
    affectedRows: Math.max(0, ...relationNodes.map((node) => node.actualRows ?? 0)),
    sharedHitBlocks: Number(root.Plan?.['Shared Hit Blocks'] ?? 0),
    sharedReadBlocks: Number(root.Plan?.['Shared Read Blocks'] ?? 0),
    dirtiedBlocks: Number(root.Plan?.['Shared Dirtied Blocks'] ?? 0),
    writtenBlocks: Number(root.Plan?.['Shared Written Blocks'] ?? 0),
    walRecords: Number(root.Plan?.['WAL Records'] ?? 0),
    walBytes: Number(root.Plan?.['WAL Bytes'] ?? 0),
  });
}

function percentile(sorted, quantile) {
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)];
}

export function latencyPercentiles(microseconds) {
  const sorted = microseconds
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);
  return Object.freeze({
    samples: sorted.length,
    p50Ms: percentile(sorted, 0.5) === null ? null : percentile(sorted, 0.5) / 1_000,
    p95Ms: percentile(sorted, 0.95) === null ? null : percentile(sorted, 0.95) / 1_000,
    p99Ms: percentile(sorted, 0.99) === null ? null : percentile(sorted, 0.99) / 1_000,
    maxMs: sorted.length === 0 ? null : sorted.at(-1) / 1_000,
  });
}

function parsePgbenchLatencies(raw) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => Number(line.split(/\s+/)[2]))
    .filter(Number.isFinite);
}

function indexContract(container) {
  return jsonQuery(
    container,
    `select json_build_object(
      'valid', indexes.indisvalid,
      'ready', indexes.indisready,
      'unique', indexes.indisunique,
      'access_method', access_method.amname,
      'key_attributes', indexes.indnkeyatts,
      'total_attributes', indexes.indnatts,
      'partial', indexes.indpred is not null,
      'expression', indexes.indexprs is not null,
      'sole_key_is_window_start', indexes.indkey[0] = window_start.attnum,
      'table_is_edge_rate_limits', table_relation.oid = 'public.edge_rate_limits'::regclass
    )
    from pg_catalog.pg_class as index_relation
    join pg_catalog.pg_namespace as index_namespace
      on index_namespace.oid = index_relation.relnamespace
    join pg_catalog.pg_index as indexes
      on indexes.indexrelid = index_relation.oid
    join pg_catalog.pg_class as table_relation
      on table_relation.oid = indexes.indrelid
    join pg_catalog.pg_am as access_method
      on access_method.oid = index_relation.relam
    join pg_catalog.pg_attribute as window_start
      on window_start.attrelid = table_relation.oid
     and window_start.attname = 'window_start'
     and not window_start.attisdropped
    where index_namespace.nspname = 'public'
      and index_relation.relname = 'edge_rate_limits_window_start_idx';`,
  );
}

function rejectsWrongNamedIndex(container, guardMigration) {
  const rejected = psqlFails(
    container,
    `begin;
drop index public.edge_rate_limits_window_start_idx;
create index edge_rate_limits_window_start_idx
  on public.edge_rate_limits (updated_at);
${guardMigration}`,
  );
  const restoredContract = indexContract(container);
  return Object.freeze({
    wrong_definition_rejected: rejected,
    transaction_rollback_restored_original:
      restoredContract.valid === true &&
      restoredContract.ready === true &&
      restoredContract.sole_key_is_window_start === true,
  });
}

function tableState(container) {
  psql(container, 'select pg_stat_force_next_flush(); analyze public.edge_rate_limits;');
  return jsonQuery(
    container,
    `select json_build_object(
      'rows', (select count(*) from public.edge_rate_limits),
      'stale_rows', (select count(*) from public.edge_rate_limits where ${CLEANUP_PREDICATE}),
      'relation_bytes', pg_total_relation_size('public.edge_rate_limits'),
      'table_bytes', pg_relation_size('public.edge_rate_limits'),
      'window_index_bytes', pg_relation_size('public.edge_rate_limits_window_start_idx'),
      'primary_key_bytes', pg_relation_size('public.edge_rate_limits_pkey'),
      'updated_index_bytes', pg_relation_size('public.edge_rate_limits_updated_idx'),
      'n_live_tup', stats.n_live_tup,
      'n_dead_tup', stats.n_dead_tup,
      'n_tup_ins', stats.n_tup_ins,
      'n_tup_upd', stats.n_tup_upd,
      'n_tup_del', stats.n_tup_del,
      'analyze_count', stats.analyze_count,
      'autoanalyze_count', stats.autoanalyze_count,
      'autovacuum_count', stats.autovacuum_count,
      'window_index_scans', indexes.idx_scan
    )
    from pg_stat_user_tables as stats
    join pg_stat_user_indexes as indexes
      on indexes.relid = stats.relid
     and indexes.indexrelname = 'edge_rate_limits_window_start_idx'
    where stats.relid = 'public.edge_rate_limits'::regclass;`,
  );
}

function cleanupCounts(container) {
  return jsonQuery(
    container,
    `select json_build_object(
      'rows', count(*),
      'stale_rows', count(*) filter (where ${CLEANUP_PREDICATE})
    ) from public.edge_rate_limits;`,
  );
}

function captureCleanupPlan(container, label) {
  const before = cleanupCounts(container);
  const planFile = `/tmp/opt119-cleanup-${label}.json`;
  const insideRaw = psql(
    container,
    `begin;
\\o ${planFile}
explain (analyze, buffers, wal, format json)
delete from public.edge_rate_limits
where ${CLEANUP_PREDICATE};
\\o
select json_build_object(
  'rows', count(*),
  'stale_rows', count(*) filter (where ${CLEANUP_PREDICATE})
) from public.edge_rate_limits;
rollback;`,
  );
  const inside = JSON.parse(insideRaw.split(/\r?\n/).filter(Boolean).at(-1));
  const plan = summarizeCleanupPlan(JSON.parse(docker(['exec', container, 'cat', planFile])));
  const after = cleanupCounts(container);
  return Object.freeze({
    before,
    inside,
    after,
    plan,
    rolledBack:
      before.rows === after.rows &&
      before.stale_rows === after.stale_rows &&
      inside.rows === before.rows - before.stale_rows &&
      inside.stale_rows === 0,
  });
}

function findCleanupSeed(container) {
  return Number(
    psql(
      container,
      `create temporary table opt119_cleanup_seed(seed double precision);
do $$
declare
  v_step integer;
  v_seed double precision;
begin
  for v_step in 0..400 loop
    v_seed := -1 + v_step::double precision / 200;
    perform setseed(v_seed);
    if random() < 0.01 then
      insert into opt119_cleanup_seed(seed) values (v_seed);
      return;
    end if;
  end loop;
  raise exception 'could not find deterministic cleanup seed';
end
$$;
select seed from opt119_cleanup_seed;`,
    ),
  );
}

function runtimeCleanupEvidence(container) {
  const outerBefore = cleanupCounts(container);
  const seed = findCleanupSeed(container);
  const raw = psql(
    container,
    `begin;
insert into public.edge_rate_limits (
  scope, key_hash, window_start, window_seconds, request_count
) values
  ('runtime_trigger', repeat('d', 64), to_timestamp(floor(extract(epoch from now()) / 60) * 60), 60, 1),
  ('runtime_old', repeat('e', 64), now() - interval '3601 seconds', 60, 1),
  ('runtime_boundary', repeat('f', 64), now() - interval '3600 seconds', 60, 1),
  ('runtime_newer', repeat('1', 64), now() - interval '3599 seconds', 60, 1);
create temporary table opt119_runtime_before on commit drop as
select
  count(*) as total_rows,
  count(*) filter (where ${CLEANUP_PREDICATE}) as expired_rows,
  count(*) filter (where not (${CLEANUP_PREDICATE})) as survivor_rows,
  coalesce(sum(request_count) filter (where not (${CLEANUP_PREDICATE})), 0) as survivor_request_count
from public.edge_rate_limits;
select setseed(${seed});
create temporary table opt119_runtime_decision on commit drop as
select public.consume_edge_rate_limit(
  'runtime_trigger',
  repeat('d', 64),
  10,
  60
) as allowed;
select json_build_object(
  'decision_allowed', (select allowed from opt119_runtime_decision),
  'pre_total_rows', (select total_rows from opt119_runtime_before),
  'pre_expired_rows', (select expired_rows from opt119_runtime_before),
  'post_total_rows', count(*),
  'post_expired_rows', count(*) filter (where ${CLEANUP_PREDICATE}),
  'post_survivor_rows', count(*) filter (where not (${CLEANUP_PREDICATE})),
  'pre_survivor_rows', (select survivor_rows from opt119_runtime_before),
  'post_survivor_request_count', coalesce(
    sum(request_count) filter (where not (${CLEANUP_PREDICATE})),
    0
  ),
  'pre_survivor_request_count', (
    select survivor_request_count from opt119_runtime_before
  ),
  'trigger_count', coalesce(
    max(request_count) filter (where scope = 'runtime_trigger'),
    0
  ),
  'boundary_retained', bool_or(scope = 'runtime_boundary'),
  'newer_retained', bool_or(scope = 'runtime_newer'),
  'expired_sentinel_removed', not bool_or(scope = 'runtime_old')
) from public.edge_rate_limits;
rollback;`,
  );
  const aggregate = JSON.parse(raw.split(/\r?\n/).filter(Boolean).at(-1));
  const outerAfter = cleanupCounts(container);
  return Object.freeze({
    trigger_probability_branch_forced: true,
    decision_allowed: aggregate.decision_allowed,
    pre_total_rows: Number(aggregate.pre_total_rows),
    pre_expired_rows: Number(aggregate.pre_expired_rows),
    post_total_rows: Number(aggregate.post_total_rows),
    post_expired_rows: Number(aggregate.post_expired_rows),
    trigger_count: Number(aggregate.trigger_count),
    boundary_retained: aggregate.boundary_retained,
    newer_retained: aggregate.newer_retained,
    expired_sentinel_removed: aggregate.expired_sentinel_removed,
    expired_rows_removed: Number(aggregate.pre_total_rows) - Number(aggregate.post_total_rows),
    survivors_reconciled:
      Number(aggregate.post_survivor_rows) === Number(aggregate.pre_survivor_rows) &&
      Number(aggregate.post_survivor_request_count) ===
        Number(aggregate.pre_survivor_request_count) + 1,
    transaction_rolled_back:
      outerBefore.rows === outerAfter.rows && outerBefore.stale_rows === outerAfter.stale_rows,
  });
}

function prepareLoadFixture(container) {
  const before = cleanupCounts(container);
  const started = performance.now();
  psql(container, `delete from public.edge_rate_limits where ${CLEANUP_PREDICATE};`);
  const executionMs = performance.now() - started;
  const after = cleanupCounts(container);
  psql(container, 'vacuum (analyze) public.edge_rate_limits;');
  return Object.freeze({
    purpose: 'throwaway_fixture_isolation_not_production_cleanup',
    before,
    after,
    execution_ms: executionMs,
    removed_rows: before.rows - after.rows,
    reconciled:
      before.stale_rows > 0 &&
      after.stale_rows === 0 &&
      before.rows - after.rows === before.stale_rows,
  });
}

function ensureStableLoadWindow(container, minimumRemainingSeconds) {
  const initialRemaining = Number(
    psql(container, `select 900 - mod(floor(extract(epoch from now()))::bigint, 900);`),
  );
  if (initialRemaining <= minimumRemainingSeconds) {
    Atomics.wait(
      new Int32Array(new SharedArrayBuffer(4)),
      0,
      0,
      Math.min(60_000, (initialRemaining + 1) * 1_000),
    );
  }
  const finalRemaining = Number(
    psql(container, `select 900 - mod(floor(extract(epoch from now()))::bigint, 900);`),
  );
  if (finalRemaining <= minimumRemainingSeconds) {
    throw new Error('Insufficient time remains in the fixed load-test window.');
  }
  return Object.freeze({
    window_seconds: 900,
    seconds_remaining_before_wait: initialRemaining,
    seconds_remaining_before_run: finalRemaining,
    waited_for_boundary: initialRemaining <= minimumRemainingSeconds,
  });
}

function runPgbench(
  container,
  { label, workload, clients, threads, seconds = null, transactionsPerClient = null, cacheState },
) {
  const keyMode = workload === 'hot_key' ? 1 : 2;
  const prefix = `opt119_${label}`;
  docker(['cp', pgbenchPath, `${container}:/tmp/rate-limit-pgbench.sql`]);
  const durationArgs =
    transactionsPerClient === null
      ? ['-T', String(seconds)]
      : ['-t', String(transactionsPerClient)];
  const started = performance.now();
  const summary = docker([
    'exec',
    '-w',
    '/tmp',
    container,
    'pgbench',
    '-n',
    '-c',
    String(clients),
    '-j',
    String(threads),
    ...durationArgs,
    '-D',
    `key_mode=${keyMode}`,
    '-D',
    'txn_no=0',
    '-f',
    '/tmp/rate-limit-pgbench.sql',
    '-l',
    `--log-prefix=${prefix}`,
    '-U',
    'postgres',
    DATABASE,
  ]);
  const durationMs = performance.now() - started;
  const rawLogs = docker(['exec', container, 'sh', '-c', `cat /tmp/${prefix}.*`]);
  const rawLatencyUs = parsePgbenchLatencies(rawLogs);
  const percentiles = latencyPercentiles(rawLatencyUs);
  const tpsMatch = summary.match(/tps = ([0-9.]+)/);
  const failedMatch = summary.match(/number of failed transactions:\s+([0-9]+)/);
  const processedMatch = summary.match(/number of transactions actually processed:\s+([0-9]+)/);
  const tps = tpsMatch ? Number(tpsMatch[1]) : Number.NaN;
  const failedTransactions = failedMatch ? Number(failedMatch[1]) : Number.NaN;
  const processedTransactions = processedMatch ? Number(processedMatch[1]) : Number.NaN;
  const decisions = jsonQuery(
    container,
    workload === 'hot_key'
      ? `select json_build_object(
          'requests', coalesce(sum(request_count), 0),
          'buckets', count(*),
          'allowed', coalesce(sum(least(request_count, 1000)), 0),
          'rejected', coalesce(sum(greatest(request_count - 1000, 0)), 0)
        ) from public.edge_rate_limits where scope = 'load_hot';`
      : `select json_build_object(
          'requests', coalesce(sum(request_count), 0),
          'buckets', count(*),
          'allowed', coalesce(sum(least(request_count, 1000)), 0),
          'rejected', coalesce(sum(greatest(request_count - 1000, 0)), 0),
          'reused_buckets', count(*) filter (where request_count > 1)
        ) from public.edge_rate_limits where scope = 'load_many';`,
  );
  const requests = Number(decisions.requests);
  const rejected = Number(decisions.rejected);
  return Object.freeze({
    label,
    workload,
    clients,
    threads,
    configured_seconds: seconds,
    transactions_per_client: transactionsPerClient,
    duration_ms: durationMs,
    cache_state: cacheState,
    host_filesystem_cache: 'uncontrolled',
    tps,
    failed_transactions: failedTransactions,
    processed_transactions: processedTransactions,
    reject_ratio: requests > 0 ? rejected / requests : null,
    decisions,
    ...percentiles,
    raw_latency_us: rawLatencyUs,
  });
}

function correctnessEvidence(container) {
  const decisions = jsonQuery(
    container,
    `with decisions as (
      select public.consume_edge_rate_limit(
        'contract_check',
        repeat('b', 64),
        2,
        60
      ) as allowed, attempt
      from generate_series(1, 3) as attempts(attempt)
    )
    select json_agg(allowed order by attempt) from decisions;`,
  );
  const storedCount = Number(
    psql(
      container,
      `select coalesce(sum(request_count), 0)
      from public.edge_rate_limits
      where scope = 'contract_check';`,
    ),
  );
  const grants = jsonQuery(
    container,
    `select json_build_object(
      'service_role', has_function_privilege(
        'service_role',
        'public.consume_edge_rate_limit(text,text,integer,integer)',
        'EXECUTE'
      ),
      'anon', has_function_privilege(
        'anon',
        'public.consume_edge_rate_limit(text,text,integer,integer)',
        'EXECUTE'
      ),
      'authenticated', has_function_privilege(
        'authenticated',
        'public.consume_edge_rate_limit(text,text,integer,integer)',
        'EXECUTE'
      ),
      'public_table_access', exists (
        select 1
        from aclexplode(coalesce(tables.relacl, acldefault('r', tables.relowner))) as access
        where access.grantee = 0
      ),
      'anon_table_access', exists (
        select 1
        from aclexplode(coalesce(tables.relacl, acldefault('r', tables.relowner))) as access
        where access.grantee = (select oid from pg_roles where rolname = 'anon')
      ),
      'authenticated_table_access', exists (
        select 1
        from aclexplode(coalesce(tables.relacl, acldefault('r', tables.relowner))) as access
        where access.grantee = (
          select oid from pg_roles where rolname = 'authenticated'
        )
      ),
      'rls_enabled', (
        select relrowsecurity
        from pg_class
        where oid = 'public.edge_rate_limits'::regclass
      )
    )
    from pg_class as tables
    where tables.oid = 'public.edge_rate_limits'::regclass;`,
  );
  const functionMetadata = jsonQuery(
    container,
    `select json_build_object(
      'security_definer', functions.prosecdef,
      'returns_boolean', functions.prorettype = 'boolean'::regtype,
      'arguments_exact', functions.proargtypes = '25 25 23 23'::oidvector,
      'empty_search_path', exists (
        select 1
        from unnest(coalesce(functions.proconfig, array[]::text[])) as settings(setting)
        where setting in ('search_path=', 'search_path=""')
      ),
      'owner_name', owners.rolname,
      'owner_is_superuser', owners.rolsuper,
      'public_execute', exists (
        select 1
        from aclexplode(
          coalesce(functions.proacl, acldefault('f', functions.proowner))
        ) as access
        where access.grantee = 0
          and access.privilege_type = 'EXECUTE'
      )
    )
    from pg_proc as functions
    join pg_namespace as namespaces
      on namespaces.oid = functions.pronamespace
    join pg_roles as owners
      on owners.oid = functions.proowner
    where namespaces.nspname = 'public'
      and functions.proname = 'consume_edge_rate_limit'
      and functions.proargtypes = '25 25 23 23'::oidvector;`,
  );
  const privacy = jsonQuery(
    container,
    `select json_build_object(
      'all_keys_are_64_hex', bool_and(key_hash ~ '^[a-f0-9]{64}$'),
      'raw_identity_columns_absent', not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'edge_rate_limits'
          and column_name in ('ip', 'ip_address', 'user_agent', 'email', 'user_id')
      )
    ) from public.edge_rate_limits;`,
  );
  return Object.freeze({
    decisions,
    stored_count: storedCount,
    exact_limit_semantics:
      JSON.stringify(decisions) === JSON.stringify([true, true, false]) && storedCount === 3,
    rejects_invalid_scope: psqlFails(
      container,
      `select public.consume_edge_rate_limit('INVALID', repeat('c', 64), 1, 60);`,
    ),
    rejects_invalid_hash: psqlFails(
      container,
      `select public.consume_edge_rate_limit('valid_scope', 'raw-identity', 1, 60);`,
    ),
    rejects_invalid_limit: psqlFails(
      container,
      `select public.consume_edge_rate_limit('valid_scope', repeat('c', 64), 1001, 60);`,
    ),
    rejects_invalid_window: psqlFails(
      container,
      `select public.consume_edge_rate_limit('valid_scope', repeat('c', 64), 1, 59);`,
    ),
    grants,
    function_metadata: functionMetadata,
    privacy,
  });
}

export function validateRateLimitEvidence(input) {
  const failures = [];
  if (input.database?.major !== 15) failures.push('postgres_major_mismatch');
  if (
    input.fixture?.synthetic_only !== true ||
    input.fixture?.requested_rows < MIN_REALISTIC_ROWS ||
    input.database?.fixture_rows < MIN_REALISTIC_ROWS ||
    input.database?.fixture_stale_rows < 1_000
  ) {
    failures.push('insufficient_realistic_scale');
  }
  for (const cacheState of ['cold', 'warm']) {
    const cleanup = input.cleanup?.[cacheState];
    if (!cleanup) {
      failures.push(`cleanup_${cacheState}:missing`);
      continue;
    }
    if (cleanup.plan.edgeRateLimitsSequentialScan) {
      failures.push(`cleanup_${cacheState}:sequential_scan`);
    }
    if (!cleanup.plan.indexNames.includes('edge_rate_limits_window_start_idx')) {
      failures.push(`cleanup_${cacheState}:missing_window_index`);
    }
    if (!cleanup.rolledBack) failures.push(`cleanup_${cacheState}:rollback_mismatch`);
    if (cleanup.plan.affectedRows !== cleanup.before.stale_rows) {
      failures.push(`cleanup_${cacheState}:affected_row_mismatch`);
    }
  }
  const runtimeCleanup = input.runtimeCleanup;
  if (
    runtimeCleanup?.trigger_probability_branch_forced !== true ||
    runtimeCleanup?.decision_allowed !== true ||
    runtimeCleanup?.post_expired_rows !== 0 ||
    runtimeCleanup?.expired_rows_removed !== runtimeCleanup?.pre_expired_rows ||
    runtimeCleanup?.trigger_count !== 2 ||
    runtimeCleanup?.boundary_retained !== true ||
    runtimeCleanup?.newer_retained !== true ||
    runtimeCleanup?.expired_sentinel_removed !== true ||
    runtimeCleanup?.survivors_reconciled !== true ||
    runtimeCleanup?.transaction_rolled_back !== true
  ) {
    failures.push('runtime_cleanup_reconciliation_mismatch');
  }
  if (input.loadIsolation?.reconciled !== true) {
    failures.push('load_fixture_cleanup_mismatch');
  }
  const index = input.indexContract;
  if (
    index?.valid !== true ||
    index?.ready !== true ||
    index?.unique !== false ||
    index?.access_method !== 'btree' ||
    index?.key_attributes !== 1 ||
    index?.total_attributes !== 1 ||
    index?.partial !== false ||
    index?.expression !== false ||
    index?.sole_key_is_window_start !== true ||
    index?.table_is_edge_rate_limits !== true
  ) {
    failures.push('cleanup_index_definition_mismatch');
  }
  if (
    input.indexGuardNegative?.wrong_definition_rejected !== true ||
    input.indexGuardNegative?.transaction_rollback_restored_original !== true
  ) {
    failures.push('cleanup_index_negative_guard_mismatch');
  }
  for (const scenario of ['hot_key', 'many_keys_insert', 'many_keys_replay']) {
    const load = input.loads?.[scenario];
    if (!load || load.samples < 100) failures.push(`${scenario}:insufficient_samples`);
    if (!Number.isFinite(load?.failed_transactions) || load.failed_transactions !== 0) {
      failures.push(`${scenario}:transaction_errors`);
    }
    if (!Number.isFinite(load?.processed_transactions) || load.processed_transactions < 100) {
      failures.push(`${scenario}:missing_processed_count`);
    }
    if (load?.samples !== load?.processed_transactions) {
      failures.push(`${scenario}:log_sample_mismatch`);
    }
    if (!Number.isFinite(load?.tps) || !(load.tps > 0)) {
      failures.push(`${scenario}:missing_tps`);
    }
  }
  if (!(input.loads?.hot_key?.reject_ratio > 0)) failures.push('hot_key:missing_rejections');
  if (input.loads?.hot_key?.decisions?.buckets !== 1) failures.push('hot_key:window_crossed');
  if (input.loads?.hot_key?.decisions?.requests !== input.loads?.hot_key?.samples) {
    failures.push('hot_key:request_sample_mismatch');
  }
  if (input.loads?.many_keys_insert?.reject_ratio !== 0) {
    failures.push('many_keys_insert:unexpected_rejections');
  }
  if (input.loads?.many_keys_replay?.reject_ratio !== 0) {
    failures.push('many_keys_replay:unexpected_rejections');
  }
  const insertDecisions = input.loads?.many_keys_insert?.decisions;
  const replayDecisions = input.loads?.many_keys_replay?.decisions;
  const expectedManyTransactions =
    input.loads?.many_keys_insert?.clients * input.loads?.many_keys_insert?.transactions_per_client;
  if (
    !Number.isSafeInteger(expectedManyTransactions) ||
    input.loads?.many_keys_insert?.samples !== expectedManyTransactions ||
    insertDecisions?.reused_buckets !== 0 ||
    insertDecisions?.buckets !== expectedManyTransactions ||
    insertDecisions?.requests !== expectedManyTransactions
  ) {
    failures.push('many_keys:non_unique_fixture_keys');
  }
  if (
    input.loads?.many_keys_replay?.samples !== expectedManyTransactions ||
    replayDecisions?.buckets !== insertDecisions?.buckets ||
    replayDecisions?.reused_buckets !== replayDecisions?.buckets ||
    replayDecisions?.requests - insertDecisions?.requests !== expectedManyTransactions
  ) {
    failures.push('many_keys:replay_mismatch');
  }
  if (!(input.growth?.after_many_keys_insert?.rows > input.growth?.after_hot_key?.rows)) {
    failures.push('missing_unique_key_row_growth');
  }
  if (input.growth?.after_many_keys_replay?.rows !== input.growth?.after_many_keys_insert?.rows) {
    failures.push('replay_changed_row_cardinality');
  }
  const correctness = input.correctness;
  if (
    correctness?.exact_limit_semantics !== true ||
    correctness?.rejects_invalid_scope !== true ||
    correctness?.rejects_invalid_hash !== true ||
    correctness?.rejects_invalid_limit !== true ||
    correctness?.rejects_invalid_window !== true
  ) {
    failures.push('function_contract_mismatch');
  }
  if (
    correctness?.grants?.service_role !== true ||
    correctness?.grants?.anon !== false ||
    correctness?.grants?.authenticated !== false ||
    correctness?.grants?.public_table_access !== false ||
    correctness?.grants?.anon_table_access !== false ||
    correctness?.grants?.authenticated_table_access !== false ||
    correctness?.grants?.rls_enabled !== true
  ) {
    failures.push('grant_or_rls_mismatch');
  }
  if (
    correctness?.function_metadata?.security_definer !== true ||
    correctness?.function_metadata?.returns_boolean !== true ||
    correctness?.function_metadata?.arguments_exact !== true ||
    correctness?.function_metadata?.empty_search_path !== true ||
    correctness?.function_metadata?.owner_name !== 'postgres' ||
    correctness?.function_metadata?.owner_is_superuser !== true ||
    correctness?.function_metadata?.public_execute !== false
  ) {
    failures.push('function_security_metadata_mismatch');
  }
  if (
    correctness?.privacy?.all_keys_are_64_hex !== true ||
    correctness?.privacy?.raw_identity_columns_absent !== true
  ) {
    failures.push('privacy_contract_mismatch');
  }
  if (
    input.policyRisks?.cleanup_is_global !== true ||
    input.policyRisks?.cleanup_age_comes_from_triggering_window !== true ||
    input.policyRisks?.primary_key_omits_window_seconds !== true ||
    input.policyRisks?.potential_active_long_window_deletion !== true ||
    input.policyRisks?.exact_strict_cleanup_predicate !== true
  ) {
    failures.push('unacknowledged_abuse_policy_risk');
  }
  return Object.freeze(failures);
}

function unavailableReport(reason, image, rows) {
  return {
    schema_version: 1,
    checkpoint: 'rate_limit_cleanup_plan_load',
    status: 'unavailable',
    reason,
    image,
    requested_rows: rows,
  };
}

function writeReport(reportPath, report) {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main() {
  const strict = process.argv.includes('--strict');
  const allowSmall = process.argv.includes('--allow-small');
  const rows = integerOption('rows', MIN_REALISTIC_ROWS, 10_000, 1_000_000);
  const staleRows = integerOption(
    'stale-rows',
    Math.min(DEFAULT_STALE_ROWS, Math.floor(rows / 10)),
    1_000,
    Math.floor(rows / 2),
  );
  const clients = integerOption('clients', 32, 1, 64);
  const threads = integerOption('threads', 8, 1, 16);
  const seconds = integerOption('seconds', 10, 2, 60);
  const manyTransactionsPerClient = integerOption('many-transactions', 250, 10, 2_000);
  const image = stringOption(
    'image',
    process.env.RATE_LIMIT_PLAN_POSTGRES_IMAGE ?? 'postgres:15-alpine',
  );
  const reportPath = path.resolve(stringOption('report', DEFAULT_REPORT));
  if (!allowSmall && rows < MIN_REALISTIC_ROWS) {
    throw new Error(`Realistic evidence requires at least ${MIN_REALISTIC_ROWS} rows.`);
  }

  const dockerInfo = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (dockerInfo.status !== 0) {
    writeReport(reportPath, unavailableReport('docker_engine_unavailable', image, rows));
    if (strict) throw new Error('Docker engine is unavailable.');
    console.warn('Rate-limit plan/load evidence unavailable: Docker engine is not running.');
    return;
  }

  const container = `onskin-opt119-${process.pid}-${Date.now()}`;
  const startedAt = new Date().toISOString();
  let started = false;
  try {
    const imageId = docker(['image', 'inspect', image, '--format', '{{.Id}}']);
    docker([
      'run',
      '--detach',
      '--name',
      container,
      '--shm-size=512m',
      '-e',
      `POSTGRES_PASSWORD=${PASSWORD}`,
      '-e',
      `POSTGRES_DB=${DATABASE}`,
      image,
    ]);
    started = true;
    waitForPostgres(container);
    psql(
      container,
      `do $$
      begin
        if not exists (select 1 from pg_roles where rolname = 'anon') then
          create role anon nologin;
        end if;
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then
          create role authenticated nologin;
        end if;
        if not exists (select 1 from pg_roles where rolname = 'service_role') then
          create role service_role nologin;
        end if;
      end
      $$;`,
    );
    const baseMigration = readFileSync(baseMigrationPath, 'utf8');
    const indexMigration = readFileSync(indexMigrationPath, 'utf8');
    const indexGuardMigration = readFileSync(indexGuardMigrationPath, 'utf8');
    psql(container, baseMigration);

    const fixtureStarted = performance.now();
    psql(container, readFileSync(fixturePath, 'utf8'), [
      '-v',
      `fresh_rows=${rows - staleRows}`,
      '-v',
      `stale_rows=${staleRows}`,
    ]);
    const fixtureLoadMs = performance.now() - fixtureStarted;
    const indexBuildStarted = performance.now();
    psql(container, indexMigration);
    const indexBuildMs = performance.now() - indexBuildStarted;
    psql(container, indexGuardMigration);
    const cleanupIndexContract = indexContract(container);
    const indexGuardNegative = rejectsWrongNamedIndex(container, indexGuardMigration);
    psql(container, 'analyze public.edge_rate_limits;');
    const fixtureState = tableState(container);
    const databaseVersion = psql(container, `select current_setting('server_version');`);
    const database = {
      version: databaseVersion,
      major: Number(databaseVersion.split('.')[0]),
      fixture_rows: Number(fixtureState.rows),
      fixture_stale_rows: Number(fixtureState.stale_rows),
    };

    docker(['restart', container]);
    waitForPostgres(container);
    const cleanup = {
      cold: captureCleanupPlan(container, 'cold'),
      warm: captureCleanupPlan(container, 'warm'),
    };

    const runtimeCleanup = runtimeCleanupEvidence(container);
    const loadIsolation = prepareLoadFixture(container);
    const correctness = correctnessEvidence(container);
    const beforeLoad = tableState(container);
    psql(container, 'select pg_stat_reset();');
    docker(['restart', container]);
    waitForPostgres(container);
    const hotWindowGuard = ensureStableLoadWindow(container, seconds + 10);
    const hotKey = runPgbench(container, {
      label: 'hot_key',
      workload: 'hot_key',
      clients,
      threads,
      seconds,
      cacheState: 'restart_first_mixed_cold_to_warm_shared_buffers',
    });
    const afterHotKey = tableState(container);

    docker(['restart', container]);
    waitForPostgres(container);
    const manyWindowGuard = ensureStableLoadWindow(container, seconds * 3 + 10);
    const manyKeysInsert = runPgbench(container, {
      label: 'many_keys_insert',
      workload: 'many_keys',
      clients,
      threads,
      transactionsPerClient: manyTransactionsPerClient,
      cacheState: 'restart_first_mixed_cold_to_warm_shared_buffers',
    });
    const afterManyKeysInsert = tableState(container);
    const manyKeysReplay = runPgbench(container, {
      label: 'many_keys_replay',
      workload: 'many_keys',
      clients,
      threads,
      transactionsPerClient: manyTransactionsPerClient,
      cacheState: 'warm_conflict_update_replay',
    });
    const afterManyKeysReplay = tableState(container);

    const fixture = {
      synthetic_only: true,
      requested_rows: rows,
      requested_stale_rows: staleRows,
      load_ms: fixtureLoadMs,
      cleanup_reference_window_seconds: 60,
      cleanup_reference_threshold_seconds: 3600,
    };
    const loads = {
      hot_key: hotKey,
      many_keys_insert: manyKeysInsert,
      many_keys_replay: manyKeysReplay,
    };
    const growth = {
      initial_fixture: fixtureState,
      before_load: beforeLoad,
      after_hot_key: afterHotKey,
      after_many_keys_insert: afterManyKeysInsert,
      after_many_keys_replay: afterManyKeysReplay,
    };
    const policyRisks = {
      cleanup_is_global:
        /delete\s+from\s+public\.edge_rate_limits\s+where\s+window_start\s+</i.test(baseMigration),
      cleanup_age_comes_from_triggering_window:
        /greatest\(p_window_seconds\s*\*\s*4,\s*3600\)/i.test(baseMigration),
      primary_key_omits_window_seconds:
        /primary\s+key\s*\(scope,\s*key_hash,\s*window_start\)/i.test(baseMigration),
      potential_active_long_window_deletion: true,
      exact_strict_cleanup_predicate:
        /where\s+window_start\s+<(?![=])\s+now\(\)\s*-\s*make_interval\(secs\s*=>\s*greatest\(p_window_seconds\s*\*\s*4,\s*3600\)\)/i.test(
          baseMigration,
        ),
      status: 'open_abuse_policy_correctness_debt',
    };
    const evidence = {
      database,
      fixture,
      cleanup,
      runtimeCleanup,
      loadIsolation,
      indexContract: cleanupIndexContract,
      indexGuardNegative,
      loads,
      growth,
      correctness,
      policyRisks,
    };
    const failures = validateRateLimitEvidence(evidence);
    const diagnosticOnly = rows < MIN_REALISTIC_ROWS || database.major !== 15;
    const report = {
      schema_version: 1,
      checkpoint: 'rate_limit_cleanup_plan_load',
      status: diagnosticOnly ? 'diagnostic' : failures.length === 0 ? 'pass' : 'fail',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      branch: command('git', ['branch', '--show-current']),
      commit_sha: command('git', ['rev-parse', 'HEAD']),
      docker_engine_version: dockerInfo.stdout.trim(),
      postgres_image: image,
      postgres_image_id: imageId,
      database,
      fixture,
      index_deployment: {
        build_ms_fixture_rows: indexBuildMs,
        create_index_concurrently: /create\s+index\s+concurrently/i.test(indexMigration),
        blocking_build_risk: true,
        definition_guard_applied: true,
        wrong_named_index_negative_test: indexGuardNegative,
        contract: cleanupIndexContract,
      },
      cleanup_contract: {
        predicate: 'window_start_before_caller_window_derived_threshold',
        representative_window_seconds: 60,
        representative_threshold_seconds: 3600,
        transaction_rolled_back: true,
        scheduled_cleanup_installed: false,
        retention_period_approved: false,
      },
      cache_protocol: {
        cold: 'First execution after a PostgreSQL container restart; shared buffers are cold, while host filesystem cache is uncontrolled.',
        warm: 'Immediate second execution of the identical rolled-back cleanup in the same PostgreSQL process.',
        load: 'Each scenario starts after a PostgreSQL restart and transitions from cold to warm shared buffers; host filesystem cache is uncontrolled.',
      },
      cleanup,
      runtime_cleanup: runtimeCleanup,
      load_isolation: loadIsolation,
      load_window_guards: {
        hot_key: hotWindowGuard,
        many_keys: manyWindowGuard,
      },
      loads,
      growth,
      correctness,
      policy_risks: policyRisks,
      privacy: {
        synthetic_only: true,
        raw_identity_input_used: false,
        raw_keys_or_hashes_in_report: false,
        query_values_in_report: false,
        content_free_classes_only: true,
      },
      acceptance: {
        approved_latency_thresholds: null,
        approved_reject_ratio_thresholds: null,
        approved_table_growth_thresholds: null,
        status: 'measurement_only_open_scale_debt',
      },
      validation_failures: failures,
      external_gates: [
        'hosted_staging_plan_load_replay',
        'approved_retention_batch_deadline_and_schedule',
        'named_operator_alert_and_rollback_owner',
        'approved_latency_reject_ratio_and_growth_budgets',
        'global_cleanup_window_interaction_policy',
        'nonblocking_production_index_build_path',
      ],
    };
    writeReport(reportPath, report);
    console.log(
      `Rate-limit cleanup plan/load ${report.status}: ${path.relative(repoRoot, reportPath)}`,
    );
    const nonScaleFailures = failures.filter(
      (failure) =>
        failure !== 'insufficient_realistic_scale' && failure !== 'postgres_major_mismatch',
    );
    if (nonScaleFailures.length > 0 || (strict && failures.length > 0)) {
      throw new Error(`Rate-limit evidence failed: ${failures.join(', ')}`);
    }
  } finally {
    if (started) {
      spawnSync('docker', ['rm', '--force', container], {
        cwd: repoRoot,
        encoding: 'utf8',
      });
    }
  }
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
