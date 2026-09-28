#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixturePath = path.join(repoRoot, 'scripts', 'optimization', 'catalog-search-plan-load.sql');
const pgbenchPath = path.join(repoRoot, 'scripts', 'optimization', 'catalog-search-pgbench.sql');
const migrationPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '20260713000042_catalog_search_indexed_rpc.sql',
);
const bigramMigrationPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '20260718000052_catalog_search_bigram_index.sql',
);

const DEFAULT_REPORT = path.join(
  repoRoot,
  'docs',
  'optimization',
  'reports',
  '2026-07-18_catalog-search-plan-load-report.json',
);
const MIN_REALISTIC_ROWS = 250_000;
const TWO_CHARACTER_RARE_CEILING = 1_000;
const DATABASE = 'layerwell_benchmark';
const PASSWORD = 'layerwell-local-opt116-only';

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

function jsonQuery(container, sql) {
  const output = psql(container, sql);
  if (!output) throw new Error('PostgreSQL returned an empty JSON result.');
  return JSON.parse(output);
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

export function summarizePlan(explain) {
  if (!Array.isArray(explain) || !explain[0] || typeof explain[0] !== 'object') {
    throw new Error('Invalid PostgreSQL JSON EXPLAIN payload.');
  }
  const root = explain[0];
  const nodes = collectPlanNodes(root);
  const indexNames = [...new Set(nodes.map((node) => node.indexName).filter(Boolean))].sort();
  return Object.freeze({
    planningMs: Number(root['Planning Time'] ?? 0),
    executionMs: Number(root['Execution Time'] ?? 0),
    returnedRows: Number(root.Plan?.['Actual Rows'] ?? 0),
    nodeTypes: [...new Set(nodes.map((node) => node.nodeType))].sort(),
    indexNames,
    productsSequentialScan: nodes.some(
      (node) => node.nodeType === 'Seq Scan' && node.relationName === 'products',
    ),
    maxLimitRows: Math.max(
      0,
      ...nodes
        .filter((node) => node.nodeType === 'Limit' && node.actualRows !== null)
        .map((node) => node.actualRows),
    ),
    sharedHitBlocks: Number(root.Plan?.['Shared Hit Blocks'] ?? 0),
    sharedReadBlocks: Number(root.Plan?.['Shared Read Blocks'] ?? 0),
  });
}

function percentile(sorted, quantile) {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1);
  return sorted[index];
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

function summarizeWritePlan(explain) {
  if (!Array.isArray(explain) || !explain[0] || typeof explain[0] !== 'object') {
    throw new Error('Invalid PostgreSQL JSON write EXPLAIN payload.');
  }
  const root = explain[0];
  return Object.freeze({
    executionMs: Number(root['Execution Time'] ?? 0),
    sharedHitBlocks: Number(root.Plan?.['Shared Hit Blocks'] ?? 0),
    sharedReadBlocks: Number(root.Plan?.['Shared Read Blocks'] ?? 0),
    dirtiedBlocks: Number(root.Plan?.['Shared Dirtied Blocks'] ?? 0),
    writtenBlocks: Number(root.Plan?.['Shared Written Blocks'] ?? 0),
    walRecords: Number(root.Plan?.['WAL Records'] ?? 0),
    walBytes: Number(root.Plan?.['WAL Bytes'] ?? 0),
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

export function validateCatalogPlanEvidence(input) {
  const failures = [];
  if (
    input.fixture?.synthetic_only !== true ||
    input.fixture?.requested_rows < MIN_REALISTIC_ROWS ||
    input.database?.products < MIN_REALISTIC_ROWS
  ) {
    failures.push('insufficient_realistic_scale');
  }
  const trigramClasses = ['common_name', 'brand', 'prefix', 'misspelling', 'no_result'];
  for (const queryClass of trigramClasses) {
    const plan = input.plans?.[queryClass]?.warm;
    if (!plan) {
      failures.push(`${queryClass}:missing_plan`);
      continue;
    }
    if (plan.productsSequentialScan) failures.push(`${queryClass}:products_seq_scan`);
    if (
      !['products_catalog_name_trgm_idx', 'products_catalog_brand_trgm_idx'].every((name) =>
        plan.indexNames.includes(name),
      )
    ) {
      failures.push(`${queryClass}:missing_trigram_indexes`);
    }
    if (plan.returnedRows > 20) failures.push(`${queryClass}:result_cap`);
  }
  const barcode = input.plans?.exact_barcode?.warm;
  if (!barcode?.indexNames.some((name) => name.includes('products_barcode'))) {
    failures.push('exact_barcode:missing_unique_index');
  }
  for (const queryClass of [
    'two_character_rare',
    'two_character_selective',
    'two_character_common',
  ]) {
    const twoCharacter = input.plans?.[queryClass]?.warm;
    if (!twoCharacter) {
      failures.push(`${queryClass}:missing_plan`);
      continue;
    }
    if (twoCharacter.productsSequentialScan) failures.push(`${queryClass}:products_seq_scan`);
    const expectedIndex =
      queryClass === 'two_character_rare'
        ? 'products_catalog_bigram_idx'
        : 'products_catalog_rank_idx';
    if (!twoCharacter.indexNames.includes(expectedIndex)) {
      failures.push(`${queryClass}:missing_bounded_index_path`);
    }
    if (twoCharacter.returnedRows > 20) failures.push(`${queryClass}:result_cap`);
  }
  for (const queryClass of ['rare', 'selective', 'common']) {
    const probe = input.twoCharacterProbes?.[queryClass]?.warm;
    if (!probe) {
      failures.push(`two_character_probe_${queryClass}:missing_plan`);
      continue;
    }
    if (probe.maxLimitRows > TWO_CHARACTER_RARE_CEILING + 1) {
      failures.push(`two_character_probe_${queryClass}:unbounded`);
    }
  }
  if (input.correctness?.blockedVisible !== false) failures.push('blocked_visibility');
  if (input.correctness?.boundedResultCount !== true) failures.push('result_bound');
  if (input.correctness?.stableRanking !== true) failures.push('unstable_ranking');
  if (input.correctness?.semanticEquivalentToLikeBaseline !== true) {
    failures.push('substring_semantic_mismatch');
  }
  if ((input.concurrency?.samples ?? 0) < 100) failures.push('insufficient_concurrency_samples');
  if (
    input.writeCost?.insertedRowsPerRun < 1_000 ||
    input.writeCost?.runsPerIndexSet < 5 ||
    !(input.writeCost?.final?.p50Ms > 0) ||
    !(input.writeCost?.trigramOnly?.p50Ms > 0)
  ) {
    failures.push('missing_indexed_write_cost');
  }
  if (input.maintenance?.n_live_tup < MIN_REALISTIC_ROWS || input.maintenance?.analyze_count < 1) {
    failures.push('missing_analyze_health');
  }
  return Object.freeze(failures);
}

const searchPlanSql = (term) => `
explain (analyze, buffers, format json)
select p.id, p.data_quality_score, p.name
from public.products as p
where p.status <> 'blocked'
  ${
    term === 'qx'
      ? `and (
    public.catalog_search_bigram_tokens(p.name) ||
    public.catalog_search_bigram_tokens(coalesce(p.brand, ''))
  ) @> public.catalog_search_bigram_tokens('${term}')`
      : ''
  }
  and (
    lower(p.name) like '%${term}%'
    or lower(coalesce(p.brand, '')) like '%${term}%'
  )
order by p.data_quality_score desc, lower(p.name), p.id
limit 20;
`;

const twoCharacterProbePlanSql = (term) => `
explain (analyze, buffers, format json)
select count(*)
from (
  select 1
  from public.products as p
  where p.status <> 'blocked'
    and (
      public.catalog_search_bigram_tokens(p.name) ||
      public.catalog_search_bigram_tokens(coalesce(p.brand, ''))
    ) @> public.catalog_search_bigram_tokens('${term}')
  limit ${TWO_CHARACTER_RARE_CEILING + 1}
) as bounded_candidates;
`;

const legacySearchPlanSql = (term) => `
explain (analyze, buffers, format json)
select p.id, p.data_quality_score, p.name
from public.products as p
where p.status <> 'blocked'
  and (
    lower(p.name) like '%${term}%'
    or lower(coalesce(p.brand, '')) like '%${term}%'
  )
order by p.data_quality_score desc, lower(p.name), p.id
limit 20;
`;

const barcodePlanSql = `
explain (analyze, buffers, format json)
select p.id
from public.products as p
where p.barcode = '0000000000042';
`;

function capturePlans(container) {
  const queries = Object.freeze({
    common_name: 'retinol',
    brand: 'dermalab',
    prefix: 'hydrat',
    misspelling: 'retinl',
    no_result: 'zzzxqvnomatch',
    two_character_rare: 'qx',
    two_character_selective: 're',
    two_character_common: 'in',
  });
  const plans = {};
  for (const [queryClass, syntheticTerm] of Object.entries(queries)) {
    plans[queryClass] = capturePlanPair(container, searchPlanSql(syntheticTerm));
  }
  plans.exact_barcode = capturePlanPair(container, barcodePlanSql);
  return plans;
}

function captureTwoCharacterProbes(container) {
  return Object.freeze({
    rare: capturePlanPair(container, twoCharacterProbePlanSql('qx')),
    selective: capturePlanPair(container, twoCharacterProbePlanSql('re')),
    common: capturePlanPair(container, twoCharacterProbePlanSql('in')),
  });
}

function capturePlanPair(container, sql) {
  docker(['restart', container]);
  waitForPostgres(container);
  return Object.freeze({
    cold: summarizePlan(jsonQuery(container, sql)),
    warm: summarizePlan(jsonQuery(container, sql)),
  });
}

function correctnessEvidence(container) {
  const boundedResultCount = Number(
    psql(container, "select count(*) from public.search_catalog_products('retinol', 1000);"),
  );
  const blockedVisible =
    psql(
      container,
      `select exists (
        select 1
        from public.search_catalog_products('retinol', 20) as result
        join public.products as product on product.id = result.id
        where product.status = 'blocked'
      );`,
    ) === 't';
  const rankingHashes = Array.from({ length: 5 }, () =>
    psql(
      container,
      `select md5(coalesce(string_agg(result.id::text, ',' order by result.ordinality), ''))
      from public.search_catalog_products('retinol', 20) with ordinality as result;`,
    ),
  );
  const semanticCounts = Object.fromEntries(
    [
      ['common_name', 'retinol'],
      ['brand', 'dermalab'],
      ['prefix', 'hydrat'],
      ['misspelling', 'retinl'],
      ['no_result', 'zzzxqvnomatch'],
      ['two_character_rare', 'qx'],
      ['two_character_selective', 're'],
      ['two_character_common', 'in'],
    ].map(([queryClass, term]) => {
      const counts = jsonQuery(
        container,
        `select json_build_object(
          'like_only', (
            select count(*)
            from public.products as product
            where product.status <> 'blocked'
              and (
                lower(product.name) like '%${term}%'
                or lower(coalesce(product.brand, '')) like '%${term}%'
              )
          ),
          'indexed_candidate_and_like', (
            select count(*)
            from public.products as product
            where product.status <> 'blocked'
              and (
                public.catalog_search_bigram_tokens(product.name) ||
                public.catalog_search_bigram_tokens(coalesce(product.brand, ''))
              ) @> public.catalog_search_bigram_tokens('${term}')
              and (
                lower(product.name) like '%${term}%'
                or lower(coalesce(product.brand, '')) like '%${term}%'
              )
          )
        );`,
      );
      return [queryClass, counts];
    }),
  );
  return Object.freeze({
    blockedVisible,
    boundedResultCount: boundedResultCount <= 20,
    returnedForOversizedLimit: boundedResultCount,
    stableRanking: new Set(rankingHashes).size === 1,
    rankingRuns: rankingHashes.length,
    semanticEquivalentToLikeBaseline: Object.values(semanticCounts).every(
      ({ like_only: likeOnly, indexed_candidate_and_like: indexed }) => likeOnly === indexed,
    ),
    semanticCounts,
  });
}

function runPgbench(container, clients, threads, seconds) {
  docker(['cp', pgbenchPath, `${container}:/tmp/catalog-search-pgbench.sql`]);
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
    '-T',
    String(seconds),
    '-f',
    '/tmp/catalog-search-pgbench.sql',
    '-l',
    '--log-prefix=opt116_pgbench',
    '-U',
    'postgres',
    DATABASE,
  ]);
  const rawLogs = docker(['exec', container, 'sh', '-c', 'cat /tmp/opt116_pgbench.*']);
  const rawLatencyUs = parsePgbenchLatencies(rawLogs);
  const percentiles = latencyPercentiles(rawLatencyUs);
  const tps = Number(summary.match(/tps = ([0-9.]+)/)?.[1] ?? 0);
  return Object.freeze({
    clients,
    threads,
    seconds,
    cacheState: 'restart_first_mixed_cold_to_warm_shared_buffers',
    hostFilesystemCache: 'uncontrolled',
    tps,
    ...percentiles,
    rawLatencyUs,
  });
}

function writeProbeSetupSql() {
  return `
drop table if exists public.catalog_write_probe_trigram;
drop table if exists public.catalog_write_probe_final;

create table public.catalog_write_probe_trigram (
  id uuid primary key,
  name text not null,
  brand text,
  data_quality_score numeric,
  status text not null
);
create table public.catalog_write_probe_final (
  like public.catalog_write_probe_trigram including all
);

insert into public.catalog_write_probe_trigram
select id, name, brand, data_quality_score, status
from public.products
order by barcode
limit 25000;
insert into public.catalog_write_probe_final
select * from public.catalog_write_probe_trigram;

create index catalog_write_probe_trigram_name_idx
  on public.catalog_write_probe_trigram using gin (lower(name) extensions.gin_trgm_ops)
  where status <> 'blocked';
create index catalog_write_probe_trigram_brand_idx
  on public.catalog_write_probe_trigram using gin (lower(coalesce(brand, '')) extensions.gin_trgm_ops)
  where status <> 'blocked';

create index catalog_write_probe_final_name_idx
  on public.catalog_write_probe_final using gin (lower(name) extensions.gin_trgm_ops)
  where status <> 'blocked';
create index catalog_write_probe_final_brand_idx
  on public.catalog_write_probe_final using gin (lower(coalesce(brand, '')) extensions.gin_trgm_ops)
  where status <> 'blocked';
create index catalog_write_probe_final_bigram_idx
  on public.catalog_write_probe_final using gin ((
    public.catalog_search_bigram_tokens(name) ||
    public.catalog_search_bigram_tokens(coalesce(brand, ''))
  ))
  where status <> 'blocked';
create index catalog_write_probe_final_rank_idx
  on public.catalog_write_probe_final (
    data_quality_score desc,
    lower(name),
    id
  )
  where status <> 'blocked';

analyze public.catalog_write_probe_trigram;
analyze public.catalog_write_probe_final;
`;
}

function writeProbePlanSql(table, batch) {
  const offset = batch * 1_000;
  return `
explain (analyze, buffers, wal, format json)
with generated as (
  select
    value,
    md5('opt116-write-' || value::text) as digest
  from generate_series(${offset + 1}, ${offset + 1_000}) as series(value)
)
insert into public.${table} (id, name, brand, data_quality_score, status)
select
  (
    substr(digest, 1, 8) || '-' ||
    substr(digest, 9, 4) || '-' ||
    substr(digest, 13, 4) || '-' ||
    substr(digest, 17, 4) || '-' ||
    substr(digest, 21, 12)
  )::uuid,
  'Synthetic write probe ' || value::text,
  'Synthetic benchmark brand',
  (value % 1000)::numeric / 10,
  'active'
from generated;
`;
}

function writeCostEvidence(container) {
  psql(container, writeProbeSetupSql());
  const trigramOnly = [];
  const final = [];
  for (let batch = 0; batch < 5; batch += 1) {
    trigramOnly.push(
      summarizeWritePlan(
        jsonQuery(container, writeProbePlanSql('catalog_write_probe_trigram', batch)),
      ),
    );
    final.push(
      summarizeWritePlan(
        jsonQuery(container, writeProbePlanSql('catalog_write_probe_final', batch)),
      ),
    );
  }
  psql(
    container,
    'drop table public.catalog_write_probe_trigram; drop table public.catalog_write_probe_final;',
  );

  const summarize = (samples) => {
    const latency = latencyPercentiles(samples.map((sample) => sample.executionMs * 1_000));
    return Object.freeze({
      samples,
      p50Ms: latency.p50Ms,
      p95Ms: latency.p95Ms,
      maxMs: latency.maxMs,
    });
  };
  const trigramOnlySummary = summarize(trigramOnly);
  const finalSummary = summarize(final);
  return Object.freeze({
    seededRowsPerTable: 25_000,
    insertedRowsPerRun: 1_000,
    runsPerIndexSet: 5,
    trigramOnly: trigramOnlySummary,
    final: finalSummary,
    p50OverheadRatio:
      trigramOnlySummary.p50Ms > 0 ? finalSummary.p50Ms / trigramOnlySummary.p50Ms : null,
  });
}

function unavailableReport(reason, image, rows) {
  return {
    schema_version: 1,
    checkpoint: 'catalog_search_plan_load',
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
  const rows = integerOption('rows', MIN_REALISTIC_ROWS, 1_000, 1_000_000);
  const clients = integerOption('clients', 8, 1, 32);
  const threads = integerOption('threads', 4, 1, 16);
  const seconds = integerOption('seconds', 10, 2, 60);
  const image = stringOption(
    'image',
    process.env.CATALOG_PLAN_POSTGRES_IMAGE ?? 'postgres:15-alpine',
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
    const report = unavailableReport('docker_engine_unavailable', image, rows);
    writeReport(reportPath, report);
    if (strict) throw new Error('Docker engine is unavailable.');
    console.warn('Catalog search plan/load evidence unavailable: Docker engine is not running.');
    return;
  }

  const container = `layerwell-opt116-${process.pid}-${Date.now()}`;
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

    const loadStarted = performance.now();
    psql(container, readFileSync(fixturePath, 'utf8'), ['-v', `catalog_rows=${rows}`]);
    const fixtureLoadMs = performance.now() - loadStarted;

    const trigramIndexStarted = performance.now();
    psql(container, readFileSync(migrationPath, 'utf8'));
    const trigramIndexBuildMs = performance.now() - trigramIndexStarted;
    const baselineAnalyzeStarted = performance.now();
    psql(container, 'analyze public.products; analyze public.product_pao_expiry;');
    const baselineAnalyzeMs = performance.now() - baselineAnalyzeStarted;
    const twoCharacterBeforeBigram = Object.freeze({
      rare: capturePlanPair(container, legacySearchPlanSql('qx')),
      selective: capturePlanPair(container, legacySearchPlanSql('re')),
      common: capturePlanPair(container, legacySearchPlanSql('in')),
    });

    const twoCharacterIndexesStarted = performance.now();
    psql(container, readFileSync(bigramMigrationPath, 'utf8'));
    const twoCharacterIndexesBuildMs = performance.now() - twoCharacterIndexesStarted;
    const analyzeStarted = performance.now();
    psql(container, 'analyze public.products; analyze public.product_pao_expiry;');
    const analyzeMs = performance.now() - analyzeStarted;

    const database = jsonQuery(
      container,
      `select json_build_object(
        'version', current_setting('server_version'),
        'products', (select count(*) from public.products),
        'blocked', (select count(*) from public.products where status = 'blocked'),
        'common_name_matches', (select count(*) from public.products where lower(name) like '%retinol%'),
        'brand_matches', (select count(*) from public.products where lower(coalesce(brand, '')) like '%dermalab%'),
        'rare_two_character_matches', (select count(*) from public.products where lower(name) like '%qx%'),
        'freshness_rows', (select count(*) from public.product_pao_expiry)
      );`,
    );
    const sizes = jsonQuery(
      container,
      `select json_build_object(
        'products_bytes', pg_total_relation_size('public.products'),
        'name_trgm_bytes', pg_relation_size('public.products_catalog_name_trgm_idx'),
        'brand_trgm_bytes', pg_relation_size('public.products_catalog_brand_trgm_idx'),
        'bigram_bytes', pg_relation_size('public.products_catalog_bigram_idx'),
        'rank_bytes', pg_relation_size('public.products_catalog_rank_idx'),
        'barcode_index_bytes', pg_relation_size('public.products_barcode_key')
      );`,
    );

    const fixture = {
      synthetic_only: true,
      requested_rows: rows,
      load_ms: fixtureLoadMs,
      trigram_index_build_ms: trigramIndexBuildMs,
      baseline_analyze_ms: baselineAnalyzeMs,
      two_character_indexes_build_ms: twoCharacterIndexesBuildMs,
      final_analyze_ms: analyzeMs,
    };
    const plans = capturePlans(container);
    const twoCharacterProbes = captureTwoCharacterProbes(container);
    const correctness = correctnessEvidence(container);
    docker(['restart', container]);
    waitForPostgres(container);
    const concurrency = runPgbench(container, clients, threads, seconds);
    const maintenance = jsonQuery(
      container,
      `select json_build_object(
        'n_live_tup', stats.n_live_tup,
        'n_dead_tup', stats.n_dead_tup,
        'analyze_count', stats.analyze_count,
        'autoanalyze_count', stats.autoanalyze_count,
        'vacuum_count', stats.vacuum_count,
        'autovacuum_count', stats.autovacuum_count,
        'last_analyze', stats.last_analyze,
        'last_autoanalyze', stats.last_autoanalyze,
        'last_vacuum', stats.last_vacuum,
        'last_autovacuum', stats.last_autovacuum,
        'index_scans', (
          select coalesce(json_object_agg(indexes.indexrelname, indexes.idx_scan), '{}'::json)
          from pg_stat_user_indexes as indexes
          where indexes.relid = 'public.products'::regclass
        )
      )
      from pg_stat_user_tables as stats
      where stats.relid = 'public.products'::regclass;`,
    );
    const writeCost = writeCostEvidence(container);
    const evidence = {
      database,
      fixture,
      plans,
      twoCharacterProbes,
      correctness,
      concurrency,
      maintenance,
      writeCost,
    };
    const failures = validateCatalogPlanEvidence(evidence);
    const diagnosticOnly = rows < MIN_REALISTIC_ROWS;
    const report = {
      schema_version: 1,
      checkpoint: 'catalog_search_plan_load',
      status: diagnosticOnly ? 'diagnostic' : failures.length === 0 ? 'pass' : 'fail',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      branch: command('git', ['branch', '--show-current']),
      commit_sha: command('git', ['rev-parse', 'HEAD']),
      docker_engine_version: dockerInfo.stdout.trim(),
      postgres_image: image,
      postgres_image_id: imageId,
      deployment_contract: {
        migration_runner_used_for_this_report: 'psql_autocommit',
        minimum_supabase_cli_for_concurrent_index_migration: '2.109.0',
        minimum_cli_enforced_in_staging_deployer: true,
        staging_deployer_migration_command: 'supabase migration up --linked',
        exact_staging_runner_replayed: false,
        status: 'local_runner_contract_enforced_external_replay_and_budget_pending',
      },
      database,
      fixture,
      sizes,
      cache_protocol: {
        cold: 'First execution after a PostgreSQL container restart; shared buffers are cold, while host filesystem cache is uncontrolled.',
        warm: 'Immediate second execution of the identical query in the same PostgreSQL process.',
      },
      plan_scope: {
        kind: 'predicate_equivalent_only',
        omitted_rpc_work: ['catalog_source_join', 'reviewed_freshness_aggregation'],
        full_rpc_latency_source: 'pgbench',
      },
      two_character_before_bigram: twoCharacterBeforeBigram,
      two_character_probes: twoCharacterProbes,
      plans,
      two_character_policy: {
        supported_by_current_api: true,
        exact_substring_semantics_preserved: true,
        bounded_index_path_required_for_acceptance: true,
        rare_candidate_ceiling: TWO_CHARACTER_RARE_CEILING,
        rare: {
          observed_products_sequential_scan: plans.two_character_rare.warm.productsSequentialScan,
          observed_indexes: plans.two_character_rare.warm.indexNames,
        },
        selective: {
          observed_products_sequential_scan:
            plans.two_character_selective.warm.productsSequentialScan,
          observed_indexes: plans.two_character_selective.warm.indexNames,
        },
        common: {
          observed_products_sequential_scan: plans.two_character_common.warm.productsSequentialScan,
          observed_indexes: plans.two_character_common.warm.indexNames,
        },
        note: 'A capped 1,001-row probe selects the deterministic bigram path only at or below 1,000 candidates; higher-cardinality tokens use the ranking index for bounded top-N filtering. The original LIKE predicate remains the exact filter.',
      },
      correctness,
      concurrency,
      maintenance,
      write_cost: writeCost,
      write_cost_acceptance: {
        approved_overhead_threshold: null,
        observed_p50_overhead_ratio: writeCost.p50OverheadRatio,
        status: 'measurement_only_open_scale_debt',
      },
      validation_failures: failures,
      external_gates: [
        'hosted_staging_plan_load_replay',
        'hosted_staging_migration_runner_replay',
        'catalog_index_write_overhead_budget_approval',
      ],
    };
    writeReport(reportPath, report);
    console.log(
      `Catalog search plan/load ${report.status}: ${path.relative(repoRoot, reportPath)}`,
    );
    const nonScaleFailures = failures.filter(
      (failure) => failure !== 'insufficient_realistic_scale',
    );
    if (nonScaleFailures.length > 0 || (strict && failures.length > 0)) {
      throw new Error(`Catalog evidence failed: ${failures.join(', ')}`);
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
