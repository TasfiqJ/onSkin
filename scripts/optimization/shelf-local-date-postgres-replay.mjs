#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const database = 'onskin_shelf_local_date';
const password = 'onskin-local-date-only';
const container = `onskin-shelf-date-${process.pid}`;
const ownerId = '00000000-0000-4000-8000-000000000001';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function command(commandName, args, input) {
  const result = spawnSync(commandName, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `${commandName} failed (${result.status ?? 'signal'}): ${`${result.stderr ?? ''}\n${result.stdout ?? ''}`
        .trim()
        .slice(0, 4_000)}`,
    );
  }
  return result.stdout.trim();
}

function docker(args, input) {
  return command('docker', args, input);
}

function waitForPostgres() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = spawnSync(
      'docker',
      ['exec', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', database, '-c', 'select 1'],
      { cwd: repoRoot, encoding: 'utf8' },
    );
    if (result.status === 0 && result.stdout.trim() === '1') return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  throw new Error('PostgreSQL did not become ready within 20 seconds.');
}

function psql(sql) {
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
      database,
    ],
    sql,
  );
}

function psqlFailure(sql) {
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
      database,
    ],
    { cwd: repoRoot, encoding: 'utf8', input: sql, maxBuffer: 8 * 1024 * 1024 },
  );
  assert(result.status !== 0, 'expected PostgreSQL command to fail');
  return `${result.stderr ?? ''}\n${result.stdout ?? ''}`.trim();
}

function jsonQuery(sql) {
  const value = psql(sql);
  assert(value.length > 0, 'PostgreSQL returned an empty JSON result');
  return JSON.parse(value);
}

function readMigration(name) {
  return readFileSync(path.join(repoRoot, 'supabase', 'migrations', name), 'utf8');
}

const bootstrap = String.raw`
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;

create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table auth.users (
  id uuid primary key
);

create table public.user_products (
  id                           uuid primary key,
  user_id                      uuid not null references auth.users (id) on delete cascade,
  catalog_product_id           uuid,
  catalog_source_id            uuid,
  catalog_match_quality        text,
  catalog_source_snapshot_date date,
  manual_name                  text,
  manual_brand                 text,
  barcode                      text,
  opened_at                    date,
  pao_months                   integer check (pao_months is null or pao_months > 0),
  expiry_date                  date,
  expiry_computed              date generated always as (
    least(
      expiry_date,
      (opened_at + pg_catalog.make_interval(months => pao_months))::date
    )
  ) stored,
  is_opened                    boolean not null default true,
  pao_source                   text,
  expiry_source                text,
  added_via                    text,
  source_disclosure_ack_at     timestamptz,
  status                       text not null default 'active',
  finished_at                  date,
  created_at                   timestamptz not null default pg_catalog.now(),
  updated_at                   timestamptz not null default pg_catalog.now()
);
alter table public.user_products enable row level security;

create table public.shelf_date_replay_clock (
  utc_date date not null
);
insert into public.shelf_date_replay_clock (utc_date)
values ((pg_catalog.statement_timestamp() at time zone 'UTC')::date);

insert into auth.users (id) values ('${ownerId}');
grant usage on schema public, auth to authenticated;
grant select on table public.shelf_date_replay_clock to authenticated;
`;

function shelfBatchSql({ idOffset, timezone }) {
  const id = (ordinal) => `00000000-0000-4000-8000-${String(idOffset + ordinal).padStart(12, '0')}`;

  return String.raw`
set time zone '${timezone}';
set request.jwt.claim.sub = '${ownerId}';
set role authenticated;
with dates as (
  select utc_date as utc_today
  from public.shelf_date_replay_clock
),
events as (
  select *
  from dates
  cross join lateral (
    values
      (1, '${id(1)}'::text, utc_today),
      (2, '${id(2)}'::text, utc_today + 1),
      (3, '${id(3)}'::text, utc_today + 2),
      (4, '${id(4)}'::text, utc_today)
  ) as event(ordinal, entity_id, opened_at)
),
batch as (
  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'operation_id', entity_id,
      'entity_type', 'shelf_product',
      'entity_id', entity_id,
      'operation_kind', 'upsert',
      'payload', pg_catalog.jsonb_build_object(
        'catalog_product_id', null,
        'catalog_source_id', null,
        'catalog_match_quality', null,
        'catalog_source_snapshot_date', null,
        'manual_name', 'Boundary ' || ordinal::text,
        'manual_brand', null,
        'barcode', null,
        'opened_at', pg_catalog.to_char(opened_at, 'YYYY-MM-DD'),
        'pao_months', null,
        'expiry_date', null,
        'is_opened', true,
        'pao_source', 'unknown',
        'expiry_source', 'unknown',
        'added_via', 'manual',
        'source_disclosure_ack_at', null,
        'status', 'active',
        'finished_at', null
      ),
      'client_revision', 1,
      'idempotency_key', 'shelf_product:' || entity_id || ':1'
    )
    order by ordinal
  ) as operations
  from events
)
select public.apply_shelf_outbox_batch(operations) from batch;
`;
}

function statuses(results) {
  return results.map(({ status }) => status);
}

function assertCheckViolation(error, label) {
  assert(/\b23514\b/.test(error), `${label} did not fail with SQLSTATE 23514`);
  assert(
    /user_products_opened_state_coherent/.test(error),
    `${label} did not fail on the Shelf opened-state constraint`,
  );
}

function assertUtcDateStable(stage) {
  const clock = jsonQuery(String.raw`
select pg_catalog.jsonb_build_object(
  'anchor', utc_date,
  'current', (pg_catalog.statement_timestamp() at time zone 'UTC')::date
)
from public.shelf_date_replay_clock;
`);
  assert(
    clock.anchor === clock.current,
    `server UTC date changed during the Shelf date replay (${stage}): ${clock.anchor} -> ${clock.current}`,
  );
  return clock.anchor;
}

function directBoundaryProof(timezone, idOffset) {
  const id = (ordinal) => `10000000-0000-4000-8000-${String(idOffset + ordinal).padStart(12, '0')}`;

  assertUtcDateStable(`${timezone} direct proof start`);
  const accepted = jsonQuery(String.raw`
set time zone '${timezone}';
with dates as (
  select
    (pg_catalog.statement_timestamp() at time zone 'UTC')::date as utc_today
),
inserted as (
  insert into public.user_products (
    id,
    user_id,
    manual_name,
    opened_at,
    is_opened,
    pao_source,
    expiry_source,
    added_via
  )
  select *
  from (
    select
      '${id(1)}'::uuid,
      '${ownerId}'::uuid,
      'UTC today',
      utc_today,
      true,
      'unknown',
      'unknown',
      'manual'
    from dates
    union all
    select
      '${id(2)}'::uuid,
      '${ownerId}'::uuid,
      'UTC tomorrow',
      utc_today + 1,
      true,
      'unknown',
      'unknown',
      'manual'
    from dates
    union all
    select
      '${id(3)}'::uuid,
      '${ownerId}'::uuid,
      'Unopened',
      null::date,
      false,
      'unknown',
      'estimated',
      'manual'
    from dates
  ) as candidates
  returning id
)
select pg_catalog.jsonb_build_object(
  'timezone', pg_catalog.current_setting('TimeZone'),
  'session_date', current_date,
  'utc_date', (pg_catalog.statement_timestamp() at time zone 'UTC')::date,
  'accepted', (select pg_catalog.count(*) from inserted)
);
`);
  assertUtcDateStable(`${timezone} accepted boundaries`);
  assert(accepted.accepted === 3, `${timezone} did not accept all valid boundary rows`);

  const utcPlusTwoFailure = psqlFailure(String.raw`
\set VERBOSITY verbose
set time zone '${timezone}';
insert into public.user_products (
  id,
  user_id,
  manual_name,
  opened_at,
  is_opened,
  pao_source,
  expiry_source,
  added_via
) values (
  '${id(4)}',
  '${ownerId}',
  'UTC plus two',
  (pg_catalog.statement_timestamp() at time zone 'UTC')::date + 2,
  true,
  'unknown',
  'unknown',
  'manual'
);
`);
  assertUtcDateStable(`${timezone} UTC+2 rejection`);
  assertCheckViolation(utcPlusTwoFailure, `${timezone} UTC+2 row`);

  const openedWithoutDateFailure = psqlFailure(String.raw`
\set VERBOSITY verbose
set time zone '${timezone}';
insert into public.user_products (
  id,
  user_id,
  manual_name,
  opened_at,
  is_opened,
  pao_source,
  expiry_source,
  added_via
) values (
  '${id(5)}',
  '${ownerId}',
  'Opened without date',
  null,
  true,
  'unknown',
  'unknown',
  'manual'
);
`);
  assertUtcDateStable(`${timezone} opened-without-date rejection`);
  assertCheckViolation(openedWithoutDateFailure, `${timezone} opened-without-date row`);

  const unopenedWithDateFailure = psqlFailure(String.raw`
\set VERBOSITY verbose
set time zone '${timezone}';
insert into public.user_products (
  id,
  user_id,
  manual_name,
  opened_at,
  is_opened,
  pao_source,
  expiry_source,
  added_via
) values (
  '${id(6)}',
  '${ownerId}',
  'Unopened with date',
  (pg_catalog.statement_timestamp() at time zone 'UTC')::date,
  false,
  'unknown',
  'estimated',
  'manual'
);
`);
  assertUtcDateStable(`${timezone} unopened-with-date rejection`);
  assertCheckViolation(unopenedWithDateFailure, `${timezone} unopened-with-date row`);

  return accepted;
}

let started = false;
try {
  docker([
    'run',
    '--detach',
    '--rm',
    '--name',
    container,
    '--env',
    `POSTGRES_PASSWORD=${password}`,
    '--env',
    `POSTGRES_DB=${database}`,
    'postgres:15-alpine',
  ]);
  started = true;
  waitForPostgres();
  psql(bootstrap);
  psql(readMigration('20260711000038_shelf_freshness_invariants.sql'));
  psql(readMigration('20260718000046_shelf_outbox_rpc.sql'));

  const anchorDate = assertUtcDateStable('baseline start');
  const baseline = jsonQuery(shelfBatchSql({ idOffset: 100, timezone: 'UTC' }));
  assertUtcDateStable('baseline result');
  assert(
    JSON.stringify(statuses(baseline)) ===
      JSON.stringify(['applied', 'permanent', 'permanent', 'applied']),
    'strict UTC-date baseline did not reproduce the false-permanent boundary',
  );
  assert(
    baseline[1]?.error_class === 'validation' && baseline[2]?.error_class === 'validation',
    'strict baseline did not classify rejected future dates as validation errors',
  );

  psql(
    'truncate table public.user_products, public.shelf_mirror_versions, public.mobile_outbox_receipts;',
  );
  const forwardMigration = readMigration('20260726000056_shelf_local_date_boundary.sql');
  psql(forwardMigration);
  assertUtcDateStable('forward migration');
  const constraintBeforeReapply = jsonQuery(String.raw`
select pg_catalog.jsonb_build_object(
  'definition', pg_catalog.pg_get_constraintdef(con.oid),
  'validated', con.convalidated
)
from pg_catalog.pg_constraint as con
where con.conrelid = 'public.user_products'::pg_catalog.regclass
  and con.conname = 'user_products_opened_state_coherent';
`);
  assert(constraintBeforeReapply.validated, 'forward constraint was left NOT VALID');
  assert(
    /statement_timestamp\(\).*AT TIME ZONE 'UTC'::text/i.test(constraintBeforeReapply.definition),
    'forward constraint is not anchored to the UTC statement date',
  );
  assert(
    /\+ 1\)/.test(constraintBeforeReapply.definition),
    'forward constraint does not admit UTC tomorrow',
  );

  psql(forwardMigration);
  assertUtcDateStable('forward migration reapply');
  const constraintAfterReapply = jsonQuery(String.raw`
select pg_catalog.jsonb_build_object(
  'definition', pg_catalog.pg_get_constraintdef(con.oid),
  'validated', con.convalidated
)
from pg_catalog.pg_constraint as con
where con.conrelid = 'public.user_products'::pg_catalog.regclass
  and con.conname = 'user_products_opened_state_coherent';
`);
  assert(
    JSON.stringify(constraintAfterReapply) === JSON.stringify(constraintBeforeReapply),
    'forward migration reapply changed the opened-state constraint',
  );

  const timezones = [
    directBoundaryProof('UTC', 100),
    directBoundaryProof('Pacific/Honolulu', 200),
    directBoundaryProof('Pacific/Kiritimati', 300),
  ];

  psql(
    'truncate table public.user_products, public.shelf_mirror_versions, public.mobile_outbox_receipts;',
  );
  const honolulu = jsonQuery(shelfBatchSql({ idOffset: 200, timezone: 'Pacific/Honolulu' }));
  const kiritimati = jsonQuery(shelfBatchSql({ idOffset: 300, timezone: 'Pacific/Kiritimati' }));
  assertUtcDateStable('migrated RPC results');
  for (const [timezone, results] of [
    ['Pacific/Honolulu', honolulu],
    ['Pacific/Kiritimati', kiritimati],
  ]) {
    assert(
      JSON.stringify(statuses(results)) ===
        JSON.stringify(['applied', 'applied', 'permanent', 'applied']),
      `${timezone} RPC boundary disposition is incorrect`,
    );
    assert(results[2]?.error_class === 'validation', `${timezone} UTC+2 was not permanent`);
  }

  const honoluluReplay = jsonQuery(shelfBatchSql({ idOffset: 200, timezone: 'Pacific/Honolulu' }));
  const kiritimatiReplay = jsonQuery(
    shelfBatchSql({ idOffset: 300, timezone: 'Pacific/Kiritimati' }),
  );
  assertUtcDateStable('RPC replay results');
  for (const [timezone, results] of [
    ['Pacific/Honolulu', honoluluReplay],
    ['Pacific/Kiritimati', kiritimatiReplay],
  ]) {
    assert(
      JSON.stringify(statuses(results)) ===
        JSON.stringify(['duplicate', 'duplicate', 'permanent', 'duplicate']),
      `${timezone} response-loss replay did not converge safely`,
    );
  }

  const counts = jsonQuery(String.raw`
select pg_catalog.jsonb_build_object(
  'products', (select pg_catalog.count(*) from public.user_products),
  'mirrors', (select pg_catalog.count(*) from public.shelf_mirror_versions),
  'receipts', (select pg_catalog.count(*) from public.mobile_outbox_receipts),
  'utc_tomorrow_products', (
    select pg_catalog.count(*)
    from public.user_products
    where opened_at = (select utc_date + 1 from public.shelf_date_replay_clock)
  ),
  'utc_plus_two_products', (
    select pg_catalog.count(*)
    from public.user_products
    where opened_at > (select utc_date + 1 from public.shelf_date_replay_clock)
  )
);
`);
  assertUtcDateStable('final counts');
  assert(counts.products === 6, 'mixed RPC batches did not isolate rejected operations');
  assert(counts.mirrors === 6, 'rejected operations leaked Shelf mirror versions');
  assert(counts.receipts === 6, 'permanent operations incorrectly retained receipts');
  assert(counts.utc_tomorrow_products === 2, 'UTC-tomorrow Shelf rows were not retained');
  assert(counts.utc_plus_two_products === 0, 'UTC+2 Shelf row bypassed the constraint');
  assertUtcDateStable('completion');

  process.stdout.write(
    `${JSON.stringify(
      {
        postgres: docker(['exec', container, 'psql', '--version']),
        anchorDate,
        baseline: statuses(baseline),
        migrated: {
          honolulu: statuses(honolulu),
          kiritimati: statuses(kiritimati),
        },
        replay: {
          honolulu: statuses(honoluluReplay),
          kiritimati: statuses(kiritimatiReplay),
        },
        timezones,
        counts,
        constraint: constraintAfterReapply,
        coherenceViolationsRejected: 6,
        forwardMigrationReapplied: true,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  if (started) {
    spawnSync('docker', ['rm', '--force', container], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
  }
}
