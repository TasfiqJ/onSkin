#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  createWriteStream,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { CATALOG_IMPORTER_VERSION, runCatalogImport } from './catalog-import-core.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATABASE = 'layerwell_catalog_replay';
const PASSWORD = 'layerwell-local-opt117-only';
const MIN_EVIDENCE_ROWS = 50_000;
const DEFAULT_REPORT = path.join(
  repoRoot,
  'docs',
  'optimization',
  'reports',
  '2026-07-25_catalog-import-postgres-replay-report.json',
);
const migrationNames = [
  '20260612000001_extensions_and_helpers.sql',
  '20260612000003_catalog.sql',
  '20260612000005_user_products.sql',
  '20260614000026_phase4_catalog.sql',
  '20260713000042_catalog_search_indexed_rpc.sql',
  '20260718000045_catalog_import_pipeline.sql',
  '20260718000052_catalog_search_bigram_index.sql',
  '20260725000054_catalog_import_identity_and_visibility.sql',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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
    const safe = `${result.stderr ?? ''}\n${result.stdout ?? ''}`.trim().slice(0, 4_000);
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

function psql(container, sql) {
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
      '-U',
      'postgres',
      '-d',
      DATABASE,
    ],
    { input: sql },
  );
}

function psqlFailure(container, sql) {
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
    { cwd: repoRoot, encoding: 'utf8', input: sql, maxBuffer: 8 * 1024 * 1024 },
  );
  assert(result.status !== 0, 'expected PostgreSQL command to fail');
  return `${result.stderr ?? ''}\n${result.stdout ?? ''}`.trim();
}

function jsonQuery(container, sql) {
  const output = psql(container, sql);
  if (!output) throw new Error('PostgreSQL returned an empty JSON result.');
  return JSON.parse(output);
}

function roleSql(role, sql) {
  assert(
    role === 'service_role' || role === 'authenticated' || role === 'anon',
    'unsupported PostgreSQL role',
  );
  return `set role ${role};\n${sql}`;
}

function jsonQueryAsRole(container, role, sql) {
  return jsonQuery(container, roleSql(role, sql));
}

function psqlFailureAsRole(container, role, sql) {
  return psqlFailure(container, roleSql(role, sql));
}

function encodedText(value) {
  const base64 = Buffer.from(String(value), 'utf8').toString('base64');
  return `convert_from(decode('${base64}', 'base64'), 'UTF8')`;
}

function encodedJson(value) {
  return `(${encodedText(JSON.stringify(value))})::jsonb`;
}

function beginImportSql(input) {
  return `select public.begin_catalog_import(
    ${encodedText(input.sourceKey)},
    ${encodedText(input.sourceRevision)},
    ${encodedText(input.artifactUri ?? '')},
    ${encodedText(input.artifactSha256)},
    ${encodedText(input.importerVersion)}
  );`;
}

function stageBatchSql(input) {
  assert(Number.isSafeInteger(input.expectedCheckpoint), 'invalid expected checkpoint');
  assert(Number.isSafeInteger(input.lastLine), 'invalid last line');
  assert(Number.isSafeInteger(input.rejectedCount), 'invalid rejected count');
  return `select public.stage_catalog_import_batch(
    ${encodedText(input.importId)}::uuid,
    ${input.expectedCheckpoint},
    ${input.lastLine},
    ${encodedJson(input.rows)},
    ${input.rejectedCount},
    ${encodedText(input.batchSha256)}
  );`;
}

class PostgresCatalogAdapter {
  constructor(container, batchSize, injectFailures = false) {
    this.container = container;
    this.responseLossRemaining = injectFailures ? 1 : 0;
    this.rollbackCheckpoint = batchSize;
    this.rollbackFailuresRemaining = injectFailures ? 2 : 0;
  }

  beginImport(input) {
    return jsonQueryAsRole(this.container, 'service_role', beginImportSql(input));
  }

  stageBatch(input) {
    const sql = stageBatchSql(input);
    if (
      input.expectedCheckpoint === this.rollbackCheckpoint &&
      this.rollbackFailuresRemaining > 0
    ) {
      this.rollbackFailuresRemaining -= 1;
      psql(this.container, `set role service_role;\nbegin;\n${sql}\nrollback;`);
      throw new Error('CATALOG_REPLAY_INJECTED_PRECOMMIT_ROLLBACK');
    }

    const receipt = jsonQueryAsRole(this.container, 'service_role', sql);
    if (input.expectedCheckpoint === 0 && this.responseLossRemaining > 0) {
      this.responseLossRemaining -= 1;
      throw new Error('CATALOG_REPLAY_INJECTED_RESPONSE_LOSS');
    }
    return receipt;
  }

  markReady(input) {
    return jsonQueryAsRole(
      this.container,
      'service_role',
      `select public.ready_catalog_import(
        ${encodedText(input.importId)}::uuid,
        ${encodedText(input.inputSha256)},
        ${input.inputRecords},
        ${input.acceptedRecords},
        ${input.rejectedRecords},
        ${encodedJson(input.manifest)}
      );`,
    );
  }

  promote(input) {
    return jsonQueryAsRole(
      this.container,
      'service_role',
      `select public.promote_catalog_import(${encodedText(input.importId)}::uuid);`,
    );
  }
}

function gtin(body) {
  let sum = 0;
  for (let index = body.length - 1, position = 0; index >= 0; index -= 1, position += 1) {
    sum += Number(body[index]) * (position % 2 === 0 ? 3 : 1);
  }
  return `${body}${(10 - (sum % 10)) % 10}`;
}

function fixtureRecord(barcode, name, modifiedOffset = 0) {
  return {
    code: barcode,
    product_name: name,
    brands: 'Replay Fixture Lab',
    ingredients_text: 'Water, Glycerin, Niacinamide',
    categories_tags: ['en:beauty', 'en:skin-care', 'en:serums'],
    last_modified_t: 1_767_225_600 + modifiedOffset,
  };
}

async function writeLine(stream, line) {
  if (!stream.write(`${line}\n`, 'utf8')) await once(stream, 'drain');
}

async function writePrimaryFixture(filePath, rows) {
  const stream = createWriteStream(filePath, { encoding: 'utf8', mode: 0o600 });
  const retainedBarcode = gtin('950000000000');
  const retiredBarcode = gtin('950000000001');
  const duplicateLine = rows - 2;
  let rejected = 0;

  for (let index = 0; index < rows; index += 1) {
    if (index % 1_000 === 999) {
      rejected += 1;
      await writeLine(stream, '{invalid-json');
      continue;
    }

    if (index === duplicateLine) {
      await writeLine(
        stream,
        JSON.stringify(fixtureRecord(retainedBarcode, 'Retained Product Serum Updated', index)),
      );
      continue;
    }

    const barcode = gtin(`9500000${String(index).padStart(5, '0')}`);
    const name =
      index === 0
        ? 'Retained Product Serum'
        : index === 1
          ? 'Retire Probe Serum'
          : `Replay Fixture Serum ${String(index).padStart(6, '0')}`;
    await writeLine(stream, JSON.stringify(fixtureRecord(barcode, name, index)));
  }

  stream.end();
  await once(stream, 'finish');
  return {
    accepted: rows - rejected,
    rejected,
    retainedBarcode,
    retiredBarcode,
    staged: rows - rejected - 1,
  };
}

async function writeReplacementFixture(filePath, retainedBarcode) {
  const stream = createWriteStream(filePath, { encoding: 'utf8', mode: 0o600 });
  await writeLine(
    stream,
    JSON.stringify(fixtureRecord(retainedBarcode, 'Retained Product Serum Current', 60_001)),
  );
  await writeLine(
    stream,
    JSON.stringify(fixtureRecord(gtin('959999999999'), 'Replacement Snapshot Serum', 60_002)),
  );
  stream.end();
  await once(stream, 'finish');
}

function bootstrapSql() {
  return `
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon noinherit;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated noinherit;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role noinherit bypassrls;
      end if;
    end;
    $$;
    create schema if not exists auth;
    create schema if not exists extensions;
    create table if not exists auth.users (id uuid primary key);
    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
  `;
}

function seedApprovedSource(container) {
  psql(
    container,
    `insert into public.catalog_sources (
      source_key, display_name, source_url, license_name, production_approved, review_status
    ) values (
      'open_beauty_facts',
      'Open Beauty Facts',
      'https://world.openbeautyfacts.org',
      'ODbL',
      true,
      'legal_approved'
    )
    on conflict (source_key) do update
      set production_approved = true,
          review_status = 'legal_approved';`,
  );
}

function grantReplayRolePrivileges(container) {
  psql(
    container,
    `grant usage on schema public to service_role;
     grant all privileges on all tables in schema public to service_role;
     grant usage, select on all sequences in schema public to service_role;`,
  );
}

function assertRoleBoundaries(container) {
  const beginInput = {
    sourceKey: 'open_beauty_facts',
    sourceRevision: 'role-boundary-v1',
    artifactUri: 'fixture://role-boundary',
    artifactSha256: 'c'.repeat(64),
    importerVersion: CATALOG_IMPORTER_VERSION,
  };
  const serviceResult = jsonQueryAsRole(container, 'service_role', beginImportSql(beginInput));
  assert(serviceResult.status === 'running', 'service role could not begin an import');

  for (const role of ['anon', 'authenticated']) {
    const beginFailure = psqlFailureAsRole(container, role, beginImportSql(beginInput));
    assert(
      beginFailure.includes('permission denied for function begin_catalog_import'),
      `${role} unexpectedly executed begin_catalog_import`,
    );
    const searchFailure = psqlFailureAsRole(
      container,
      role,
      `select count(*) from public.search_catalog_products('serum', 10);`,
    );
    assert(
      searchFailure.includes('permission denied for function search_catalog_products'),
      `${role} unexpectedly executed search_catalog_products`,
    );
  }
  return {
    serviceRoleImportExecution: true,
    anonImportDenied: true,
    authenticatedImportDenied: true,
    anonSearchDenied: true,
    authenticatedSearchDenied: true,
  };
}

function assertPromotionGates(container) {
  const notReady = jsonQueryAsRole(
    container,
    'service_role',
    beginImportSql({
      sourceKey: 'open_beauty_facts',
      sourceRevision: 'promotion-not-ready-v1',
      artifactUri: 'fixture://not-ready',
      artifactSha256: 'd'.repeat(64),
      importerVersion: CATALOG_IMPORTER_VERSION,
    }),
  );
  const notReadyFailure = psqlFailureAsRole(
    container,
    'service_role',
    `select public.promote_catalog_import(${encodedText(notReady.importId)}::uuid);`,
  );
  assert(
    notReadyFailure.includes('CATALOG_IMPORT_NOT_READY'),
    'running import promotion did not fail closed',
  );

  const unapproved = jsonQueryAsRole(
    container,
    'service_role',
    beginImportSql({
      sourceKey: 'curated',
      sourceRevision: 'promotion-unapproved-v1',
      artifactUri: 'fixture://unapproved',
      artifactSha256: 'e'.repeat(64),
      importerVersion: CATALOG_IMPORTER_VERSION,
    }),
  );
  jsonQueryAsRole(
    container,
    'service_role',
    `select public.ready_catalog_import(
      ${encodedText(unapproved.importId)}::uuid,
      ${encodedText('e'.repeat(64))},
      0,
      0,
      0,
      '{}'::jsonb
    );`,
  );
  const unapprovedFailure = psqlFailureAsRole(
    container,
    'service_role',
    `select public.promote_catalog_import(${encodedText(unapproved.importId)}::uuid);`,
  );
  assert(
    unapprovedFailure.includes('CATALOG_IMPORT_SOURCE_NOT_APPROVED'),
    'unapproved source promotion did not fail closed',
  );
  return {
    runningImportPromotionDenied: true,
    unapprovedSourcePromotionDenied: true,
  };
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
    });
  }
  for (const nested of Object.values(value)) collectPlanNodes(nested, nodes);
  return nodes;
}

function summarizePlan(explain) {
  const nodes = collectPlanNodes(explain);
  return {
    nodeTypes: [...new Set(nodes.map((node) => node.nodeType))].sort(),
    indexNames: [...new Set(nodes.map((node) => node.indexName).filter(Boolean))].sort(),
    productsSequentialScan: nodes.some(
      (node) => node.nodeType === 'Seq Scan' && node.relationName === 'products',
    ),
  };
}

function captureActiveIndexPlans(container, requireExpectedIndexes) {
  psql(container, 'analyze public.products;');
  const plans = {
    twoCharacter: summarizePlan(
      jsonQueryAsRole(
        container,
        'service_role',
        `explain (analyze, buffers, format json)
         select id
         from public.products
         where status = 'active'
           and (
             public.catalog_search_bigram_tokens(name) ||
             public.catalog_search_bigram_tokens(coalesce(brand, ''))
           ) @> public.catalog_search_bigram_tokens('zq');`,
      ),
    ),
    longQuery: summarizePlan(
      jsonQueryAsRole(
        container,
        'service_role',
        `explain (analyze, buffers, format json)
         select id
         from public.products
         where status = 'active'
           and lower(name) like '%retained product%';`,
      ),
    ),
    ranked: summarizePlan(
      jsonQueryAsRole(
        container,
        'service_role',
        `explain (analyze, buffers, format json)
         select id
         from public.products
         where status = 'active'
         order by data_quality_score desc, lower(name), id
         limit 20;`,
      ),
    ),
  };
  const expectedIndexes = {
    twoCharacter: 'products_catalog_active_bigram_idx',
    longQuery: 'products_catalog_active_name_trgm_idx',
    ranked: 'products_catalog_active_rank_idx',
  };
  for (const [name, expectedIndex] of Object.entries(expectedIndexes)) {
    const plan = plans[name];
    if (requireExpectedIndexes) {
      assert(!plan.productsSequentialScan, `${name} active plan used a products sequential scan`);
      assert(
        plan.indexNames.includes(expectedIndex),
        `${name} active plan did not use ${expectedIndex}`,
      );
    }
  }
  return plans;
}

function captureVisibilityEvidence(container) {
  psql(
    container,
    `insert into public.products (barcode, name, brand, source, status)
     values
       ('99000000000001', 'Zqactive Sentinel', 'Visibility Lab', 'curated', 'active'),
       ('99000000000002', 'Zqretired Sentinel', 'Visibility Lab', 'curated', 'retired'),
       ('99000000000003', 'Zqblocked Sentinel', 'Visibility Lab', 'curated', 'blocked');`,
  );

  const results = jsonQueryAsRole(
    container,
    'service_role',
    `select json_build_object(
      'two_character', (
        select coalesce(json_agg(name order by name), '[]'::json)
        from public.search_catalog_products('zq', 20)
      ),
      'long_query', (
        select coalesce(json_agg(name order by name), '[]'::json)
        from public.search_catalog_products('sentinel', 20)
      ),
      'retired_snapshot_search_count', (
        select count(*) from public.search_catalog_products('retire probe', 20)
      )
    );`,
  );
  assert(
    JSON.stringify(results.two_character) === JSON.stringify(['Zqactive Sentinel']),
    'two-character search exposed an inactive product',
  );
  assert(
    JSON.stringify(results.long_query) === JSON.stringify(['Zqactive Sentinel']),
    'long search exposed an inactive product',
  );
  assert(
    Number(results.retired_snapshot_search_count) === 0,
    'replacement-retired product remained searchable',
  );

  return results;
}

function assertIdentityBinding(container, firstImport, firstArtifactSha) {
  const exactReplay = jsonQueryAsRole(
    container,
    'service_role',
    beginImportSql({
      sourceKey: 'open_beauty_facts',
      sourceRevision: 'replay-primary-v1',
      artifactUri: 'relocated://same-artifact',
      artifactSha256: firstArtifactSha,
      importerVersion: CATALOG_IMPORTER_VERSION,
    }),
  );
  assert(exactReplay.importId === firstImport.importId, 'exact begin replay changed import ID');

  const before = jsonQuery(
    container,
    `select row_to_json(state)
     from (
       select id, artifact_sha256, importer_version, status, checkpoint_line, artifact_uri
       from public.catalog_import_versions
       where id = ${encodedText(firstImport.importId)}::uuid
     ) as state;`,
  );
  const hashFailure = psqlFailureAsRole(
    container,
    'service_role',
    beginImportSql({
      sourceKey: 'open_beauty_facts',
      sourceRevision: 'replay-primary-v1',
      artifactUri: 'mutated://must-not-publish',
      artifactSha256: 'f'.repeat(64),
      importerVersion: CATALOG_IMPORTER_VERSION,
    }),
  );
  assert(
    hashFailure.includes('CATALOG_IMPORT_REVISION_ARTIFACT_MISMATCH'),
    'revision/artifact mismatch did not fail with the typed error',
  );
  const importerFailure = psqlFailureAsRole(
    container,
    'service_role',
    beginImportSql({
      sourceKey: 'open_beauty_facts',
      sourceRevision: 'replay-primary-v1',
      artifactUri: 'mutated://must-not-publish',
      artifactSha256: firstArtifactSha,
      importerVersion: `${CATALOG_IMPORTER_VERSION}-changed`,
    }),
  );
  assert(
    importerFailure.includes('CATALOG_IMPORT_REVISION_IMPORTER_MISMATCH'),
    'revision/importer mismatch did not fail with the typed error',
  );
  const after = jsonQuery(
    container,
    `select row_to_json(state)
     from (
       select id, artifact_sha256, importer_version, status, checkpoint_line, artifact_uri
       from public.catalog_import_versions
       where id = ${encodedText(firstImport.importId)}::uuid
     ) as state;`,
  );
  assert(
    JSON.stringify(after) === JSON.stringify(before),
    'identity mismatch mutated import state',
  );

  const index = jsonQuery(
    container,
    `select json_build_object(
       'duplicate_pairs', (
         select count(*)
         from (
           select source_id, source_revision
           from public.catalog_import_versions
           group by source_id, source_revision
           having count(*) > 1
         ) as duplicates
       ),
       'valid', index_state.indisvalid,
       'ready', index_state.indisready,
       'unique', index_state.indisunique,
       'keys', index_state.indnkeyatts,
       'definition', pg_catalog.pg_get_indexdef(index_state.indexrelid)
     )
     from pg_catalog.pg_index as index_state
     join pg_catalog.pg_class as index_relation
       on index_relation.oid = index_state.indexrelid
     join pg_catalog.pg_namespace as index_namespace
       on index_namespace.oid = index_relation.relnamespace
     where index_namespace.nspname = 'public'
       and index_relation.relname = 'catalog_import_versions_source_revision_uidx';`,
  );
  assert(Number(index.duplicate_pairs) === 0, 'duplicate source/revision identity exists');
  assert(
    index.valid && index.ready && index.unique && Number(index.keys) === 2,
    'identity index invalid',
  );

  return {
    exactReplaySameImport: true,
    artifactMismatchRejected: true,
    importerMismatchRejected: true,
    mismatchStateUnchanged: true,
    uniqueIndex: index,
  };
}

function validateActiveIndexSet(container) {
  const indexes = jsonQuery(
    container,
    `select coalesce(json_agg(indexes order by name), '[]'::json)
     from (
       select
         index_relation.relname as name,
         access_method.amname as access_method,
         index_state.indnkeyatts as key_count,
         index_state.indisunique as is_unique,
         index_state.indisvalid as is_valid,
         index_state.indisready as is_ready,
         operator_namespace.nspname as operator_class_schema,
         operator_class.opcname as operator_class_name,
         pg_catalog.pg_get_indexdef(index_state.indexrelid) as definition
       from pg_catalog.pg_index as index_state
       join pg_catalog.pg_class as index_relation
         on index_relation.oid = index_state.indexrelid
       join pg_catalog.pg_namespace as index_namespace
         on index_namespace.oid = index_relation.relnamespace
       join pg_catalog.pg_am as access_method
         on access_method.oid = index_relation.relam
       join pg_catalog.pg_opclass as operator_class
         on operator_class.oid = index_state.indclass[0]
       join pg_catalog.pg_namespace as operator_namespace
         on operator_namespace.oid = operator_class.opcnamespace
       where index_namespace.nspname = 'public'
         and index_relation.relname in (
           'products_catalog_active_name_trgm_idx',
           'products_catalog_active_brand_trgm_idx',
           'products_catalog_active_bigram_idx',
           'products_catalog_active_rank_idx'
         )
     ) as indexes;`,
  );
  assert(indexes.length === 4, 'active catalog index set is incomplete');
  const expected = {
    products_catalog_active_name_trgm_idx: {
      accessMethod: 'gin',
      keyCount: 1,
      operatorClass: ['extensions', 'gin_trgm_ops'],
      fragments: ['lower(name)'],
    },
    products_catalog_active_brand_trgm_idx: {
      accessMethod: 'gin',
      keyCount: 1,
      operatorClass: ['extensions', 'gin_trgm_ops'],
      fragments: ['lower(COALESCE(brand'],
    },
    products_catalog_active_bigram_idx: {
      accessMethod: 'gin',
      keyCount: 1,
      fragments: [
        'catalog_search_bigram_tokens(name)',
        'catalog_search_bigram_tokens(COALESCE(brand',
      ],
    },
    products_catalog_active_rank_idx: {
      accessMethod: 'btree',
      keyCount: 3,
      fragments: ['(data_quality_score DESC, lower(name), id)'],
    },
  };
  for (const index of indexes) {
    const contract = expected[index.name];
    assert(contract, `unexpected active catalog index: ${index.name}`);
    assert(index.is_valid && index.is_ready && !index.is_unique, `${index.name} state invalid`);
    assert(index.access_method === contract.accessMethod, `${index.name} access method invalid`);
    assert(Number(index.key_count) === contract.keyCount, `${index.name} key count invalid`);
    if (contract.operatorClass) {
      assert(
        index.operator_class_schema === contract.operatorClass[0] &&
          index.operator_class_name === contract.operatorClass[1],
        `${index.name} operator class invalid`,
      );
    }
    if (index.name === 'products_catalog_active_name_trgm_idx') {
      assert(
        /lower\(name\) (?:extensions\.)?gin_trgm_ops/.test(index.definition),
        `${index.name} expression invalid`,
      );
    }
    assert(
      index.definition.includes("WHERE (status = 'active'::text)"),
      `${index.name} predicate invalid`,
    );
    for (const fragment of contract.fragments) {
      assert(index.definition.includes(fragment), `${index.name} expression invalid`);
    }
  }
  const functionDefinition = psql(
    container,
    `select pg_catalog.pg_get_functiondef(
      'public.search_catalog_products(text,integer)'::regprocedure
    );`,
  );
  const activePredicates = functionDefinition.match(/status = 'active'/g)?.length ?? 0;
  assert(
    activePredicates === 3,
    'search function does not contain exactly three active predicates',
  );
  assert(!functionDefinition.includes("status <> 'blocked'"), 'legacy search predicate remains');
  return { indexes, activePredicates, legacyPredicatePresent: false };
}

function sourceSha256(relativePath) {
  return createHash('sha256')
    .update(readFileSync(path.join(repoRoot, relativePath)))
    .digest('hex');
}

function writeReport(reportPath, report) {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

export async function runPostgresCatalogReplay({
  image = 'postgres:15-alpine',
  reportPath = DEFAULT_REPORT,
  rows = MIN_EVIDENCE_ROWS,
  strict = false,
} = {}) {
  const dockerInfo = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (dockerInfo.status !== 0) {
    const report = {
      schema_version: 1,
      checkpoint: 'catalog_import_postgres_replay',
      status: 'unavailable',
      reason: 'docker_engine_unavailable',
      requested_rows: rows,
      postgres_image: image,
    };
    writeReport(reportPath, report);
    if (strict) throw new Error('Docker engine is unavailable.');
    return report;
  }

  const container = `layerwell-opt117-${process.pid}-${Date.now()}`;
  const directory = mkdtempSync(path.join(tmpdir(), 'layerwell-catalog-replay-'));
  const primaryPath = path.join(directory, 'primary.jsonl');
  const replacementPath = path.join(directory, 'replacement.jsonl');
  const primaryCheckpoint = path.join(directory, 'primary-checkpoint.json');
  const replacementCheckpoint = path.join(directory, 'replacement-checkpoint.json');
  const startedAt = new Date().toISOString();
  let started = false;

  try {
    const fixtureStarted = performance.now();
    const expected = await writePrimaryFixture(primaryPath, rows);
    await writeReplacementFixture(replacementPath, expected.retainedBarcode);
    const fixtureBuildMs = performance.now() - fixtureStarted;

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

    psql(container, bootstrapSql());
    const migrationStarted = performance.now();
    for (const migrationName of migrationNames) {
      const migrationPath = path.join(repoRoot, 'supabase', 'migrations', migrationName);
      psql(container, readFileSync(migrationPath, 'utf8'));
    }
    const migrationMs = performance.now() - migrationStarted;
    const forwardMigrationPath = path.join(
      repoRoot,
      'supabase',
      'migrations',
      '20260725000054_catalog_import_identity_and_visibility.sql',
    );
    const migrationReplayStarted = performance.now();
    psql(container, readFileSync(forwardMigrationPath, 'utf8'));
    const forwardMigrationReplayMs = performance.now() - migrationReplayStarted;
    seedApprovedSource(container);
    grantReplayRolePrivileges(container);
    const roleBoundaries = assertRoleBoundaries(container);
    const promotionGates = assertPromotionGates(container);

    const batchSize = Math.min(500, Math.max(1, Math.floor(rows / 4)));
    const interruptedAdapter = new PostgresCatalogAdapter(container, batchSize, true);
    const interruptionStarted = performance.now();
    let interruptionError = null;
    try {
      await runCatalogImport({
        adapter: interruptedAdapter,
        batchSize,
        checkpointPath: primaryCheckpoint,
        inputPath: primaryPath,
        sourceRevision: 'replay-primary-v1',
      });
    } catch (error) {
      interruptionError = error;
    }
    const interruptionMs = performance.now() - interruptionStarted;
    assert(
      interruptionError?.message === 'CATALOG_REPLAY_INJECTED_PRECOMMIT_ROLLBACK',
      'import did not stop at the injected rollback',
    );
    const interruptedState = jsonQuery(
      container,
      `select json_build_object(
        'checkpointLine', checkpoint_line,
        'acceptedRecords', accepted_record_count,
        'rejectedRecords', rejected_record_count,
        'stagedProducts', staged_product_count,
        'receipts', (
          select count(*) from public.catalog_import_batch_receipts
          where import_id = versions.id
        )
      )
      from public.catalog_import_versions as versions
      where source_revision = 'replay-primary-v1';`,
    );
    assert(
      Number(interruptedState.checkpointLine) === batchSize,
      'response-loss replay did not preserve exactly one committed batch',
    );
    assert(Number(interruptedState.receipts) === 1, 'response-loss replay duplicated a receipt');

    // A second worker has no local checkpoint and trusts the durable server receipt.
    try {
      unlinkSync(primaryCheckpoint);
    } catch {
      // The server checkpoint is still authoritative if a local file was never published.
    }
    const resumeStarted = performance.now();
    const primary = await runCatalogImport({
      adapter: new PostgresCatalogAdapter(container, batchSize, false),
      batchSize,
      checkpointPath: primaryCheckpoint,
      inputPath: primaryPath,
      promote: true,
      sourceRevision: 'replay-primary-v1',
    });
    const resumeMs = performance.now() - resumeStarted;
    assert(primary.promotion?.status === 'active', 'primary import was not promoted');
    assert(primary.inputRecords === rows, 'primary input count mismatch');
    assert(primary.acceptedRecords === expected.accepted, 'primary accepted count mismatch');
    assert(primary.rejectedRecords === expected.rejected, 'primary reject count mismatch');
    assert(primary.stagedProducts === expected.staged, 'primary staged count mismatch');

    const identity = assertIdentityBinding(container, primary, primary.inputSha256);
    const activeIndexes = validateActiveIndexSet(container);
    const activeIndexPlans = captureActiveIndexPlans(container, rows >= MIN_EVIDENCE_ROWS);

    const replacementStarted = performance.now();
    const replacement = await runCatalogImport({
      adapter: new PostgresCatalogAdapter(container, 2, false),
      batchSize: 2,
      checkpointPath: replacementCheckpoint,
      inputPath: replacementPath,
      promote: true,
      sourceRevision: 'replay-replacement-v2',
    });
    const replacementMs = performance.now() - replacementStarted;
    assert(replacement.promotion?.status === 'active', 'replacement import was not promoted');
    assert(
      replacement.promotion.previousActiveImportId === primary.importId,
      'replacement predecessor pointer is incorrect',
    );

    const replacementState = jsonQuery(
      container,
      `select json_build_object(
        'activeProducts', count(*) filter (where status = 'active'),
        'retiredProducts', count(*) filter (where status = 'retired'),
        'primaryStatus', (
          select status from public.catalog_import_versions
          where id = ${encodedText(primary.importId)}::uuid
        ),
        'replacementStatus', (
          select status from public.catalog_import_versions
          where id = ${encodedText(replacement.importId)}::uuid
        ),
        'activePointer', (
          select import_id from public.catalog_active_imports
          where source_id = (
            select id from public.catalog_sources where source_key = 'open_beauty_facts'
          )
        )
      )
      from public.products
      where source_id = (
        select id from public.catalog_sources where source_key = 'open_beauty_facts'
      );`,
    );
    assert(Number(replacementState.activeProducts) === 2, 'replacement active count mismatch');
    assert(
      Number(replacementState.retiredProducts) === expected.staged - 1,
      'replacement retirement count mismatch',
    );
    assert(replacementState.primaryStatus === 'superseded', 'predecessor was not superseded');
    assert(replacementState.replacementStatus === 'active', 'replacement was not active');
    assert(
      replacementState.activePointer === replacement.importId,
      'active import pointer did not switch atomically',
    );

    captureVisibilityEvidence(container);
    const databaseVersion = psql(container, `select current_setting('server_version');`);
    const diagnosticOnly = rows < MIN_EVIDENCE_ROWS;
    const report = {
      schema_version: 1,
      checkpoint: 'catalog_import_postgres_replay',
      status: diagnosticOnly ? 'diagnostic' : 'pass',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      branch: command('git', ['branch', '--show-current']),
      checkpoint_parent_sha: command('git', ['rev-parse', 'HEAD']),
      tested_source_sha256: {
        forward_migration: sourceSha256(
          'supabase/migrations/20260725000054_catalog_import_identity_and_visibility.sql',
        ),
        importer_core: sourceSha256('scripts/phase4/catalog-import-core.mjs'),
        replay_harness: sourceSha256('scripts/phase4/catalog-import-postgres-replay.mjs'),
      },
      docker_engine_version: dockerInfo.stdout.trim(),
      postgres_image: image,
      postgres_image_id: imageId,
      postgres_version: databaseVersion,
      migration_chain: migrationNames,
      fixture: {
        synthetic_only: true,
        input_records: rows,
        accepted_records: expected.accepted,
        rejected_records: expected.rejected,
        staged_products: expected.staged,
        fixture_build_ms: fixtureBuildMs,
      },
      failure_recovery: {
        commit_then_response_loss_replayed_once: true,
        precommit_transaction_rolled_back_twice: true,
        interrupted_checkpoint_line: Number(interruptedState.checkpointLine),
        interrupted_receipts: Number(interruptedState.receipts),
        fresh_worker_resumed_from_server_receipt: true,
        interruption_ms: interruptionMs,
        resume_and_primary_promotion_ms: resumeMs,
      },
      role_boundaries: roleBoundaries,
      promotion_gates: promotionGates,
      identity,
      replacement: {
        previous_active_pointer_preserved: true,
        primary_status: replacementState.primaryStatus,
        replacement_status: replacementState.replacementStatus,
        active_products: Number(replacementState.activeProducts),
        retired_products: Number(replacementState.retiredProducts),
        promotion_ms: replacementMs,
      },
      visibility: {
        two_character_active_only: true,
        long_query_active_only: true,
        retired_snapshot_hidden: true,
        active_index_plans_before_replacement: activeIndexPlans,
      },
      indexes: activeIndexes,
      migration_ms: migrationMs,
      forward_migration_replay_ms: forwardMigrationReplayMs,
      verification_boundary: diagnosticOnly
        ? 'Synthetic small-run diagnostic only.'
        : 'Local synthetic PostgreSQL replay; hosted staging and full OBF artifact rehearsal remain required.',
    };
    writeReport(reportPath, report);
    return report;
  } finally {
    if (started) {
      spawnSync('docker', ['rm', '--force', container], {
        cwd: repoRoot,
        encoding: 'utf8',
      });
    }
    rmSync(directory, { force: true, recursive: true });
  }
}

async function main() {
  const strict = process.argv.includes('--strict');
  const allowSmall = process.argv.includes('--allow-small');
  const rows = integerOption('rows', MIN_EVIDENCE_ROWS, 1_000, 250_000);
  const image = stringOption(
    'image',
    process.env.CATALOG_IMPORT_POSTGRES_IMAGE ?? 'postgres:15-alpine',
  );
  const reportPath = path.resolve(stringOption('report', DEFAULT_REPORT));
  if (!allowSmall && rows < MIN_EVIDENCE_ROWS) {
    throw new Error(`Evidence runs require at least ${MIN_EVIDENCE_ROWS} rows.`);
  }
  const report = await runPostgresCatalogReplay({ image, reportPath, rows, strict });
  console.log(
    `Catalog PostgreSQL replay ${report.status}: ${report.fixture?.input_records ?? rows} rows.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
