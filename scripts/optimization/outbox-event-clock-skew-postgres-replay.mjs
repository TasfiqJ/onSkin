#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const database = 'layerwell_outbox_clock_skew';
const password = 'layerwell-local-clock-skew-only';
const container = `layerwell-outbox-clock-${process.pid}`;

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
create schema extensions;
create extension pgcrypto with schema extensions;

create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.mobile_outbox_receipts (
  user_id uuid not null,
  operation_id uuid not null,
  idempotency_key text not null,
  entity_type text not null,
  entity_id uuid not null,
  operation_kind text not null,
  client_revision bigint not null,
  result_status text not null,
  primary key (user_id, operation_id),
  constraint mobile_outbox_receipts_owner_idempotency_key
    unique (user_id, idempotency_key),
  constraint mobile_outbox_receipts_entity_type_check
    check (entity_type = 'shelf_product')
);

create table public.notification_log (
  id uuid primary key,
  user_id uuid not null,
  tier text not null,
  kind text not null,
  sent_at timestamptz not null
);
alter table public.notification_log enable row level security;

create table public.products (
  id uuid primary key
);

create table public.shelf_scans (
  id uuid primary key,
  user_id uuid not null,
  barcode text not null,
  result text not null,
  matched_product_id uuid,
  contributed_back boolean not null,
  created_at timestamptz not null
);
alter table public.shelf_scans enable row level security;

create table public.outbox_replay_clock (
  base timestamptz not null
);
insert into public.outbox_replay_clock (base)
values (pg_catalog.date_trunc('milliseconds', pg_catalog.now()));

grant usage on schema public, auth, extensions to authenticated;
grant select on table public.outbox_replay_clock to authenticated;
`;

const timestampCte = String.raw`
with clock as (
  select base from public.outbox_replay_clock
),
times as (
  select
    pg_catalog.to_char(
      base - interval '29 days',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ) as recent,
    pg_catalog.to_char(
      base - interval '31 days',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ) as expired,
    pg_catalog.to_char(
      base + interval '4 minutes',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ) as allowed_future,
    pg_catalog.to_char(
      base + interval '6 minutes',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ) as rejected_future
  from clock
)`;

function notificationSql() {
  return String.raw`
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
set role authenticated;
${timestampCte},
events as (
  select *
  from times
  cross join lateral (
    values
      (1, '00000000-0000-4000-8000-000000000101'::text, recent),
      (2, '00000000-0000-4000-8000-000000000102'::text, expired),
      (3, '00000000-0000-4000-8000-000000000103'::text, allowed_future),
      (4, '00000000-0000-4000-8000-000000000104'::text, rejected_future)
  ) as event(ordinal, operation_id, sent_at)
),
batch as (
  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'operation_id', operation_id,
      'entity_type', 'notification_delivery',
      'entity_id', operation_id,
      'operation_kind', 'upsert',
      'payload', pg_catalog.jsonb_build_object(
        'kind', 'replenishment',
        'tier', 'behavioural',
        'sent_at', sent_at
      ),
      'client_revision', 1,
      'idempotency_key',
        'notification_delivery:' || operation_id || ':replenishment:' || sent_at
    )
    order by ordinal
  ) as operations
  from events
)
select public.apply_notification_delivery_outbox_batch(operations) from batch;
`;
}

function shelfScanSql() {
  return String.raw`
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
set role authenticated;
${timestampCte},
events as (
  select *
  from times
  cross join lateral (
    values
      (1, '00000000-0000-4000-8000-000000000201'::text, recent),
      (2, '00000000-0000-4000-8000-000000000202'::text, expired),
      (3, '00000000-0000-4000-8000-000000000203'::text, allowed_future),
      (4, '00000000-0000-4000-8000-000000000204'::text, rejected_future)
  ) as event(ordinal, operation_id, scanned_at)
),
payloads as (
  select
    ordinal,
    operation_id,
    scanned_at,
    pg_catalog.jsonb_build_object(
      'barcode', '1234567890123',
      'result', 'no_match',
      'matched_product_id', null,
      'scanned_at', scanned_at
    ) as payload,
    pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(
          'layerwell:shelf-scan-payload:v1' || E'\n' ||
          '1234567890123' || E'\n' ||
          'no_match' || E'\n' ||
          '-' || E'\n' ||
          scanned_at,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    ) as payload_hash
  from events
),
batch as (
  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'operation_id', operation_id,
      'entity_type', 'shelf_scan',
      'entity_id', operation_id,
      'operation_kind', 'upsert',
      'payload', payload,
      'client_revision', 1,
      'idempotency_key', 'shelf_scan:' || operation_id || ':' || payload_hash
    )
    order by ordinal
  ) as operations
  from payloads
)
select public.apply_shelf_scan_outbox_batch(operations) from batch;
`;
}

function statuses(results) {
  return results.map(({ status }) => status);
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
  psql(readMigration('20260718000049_notification_delivery_outbox_rpc.sql'));
  psql(readMigration('20260718000050_shelf_scan_outbox_rpc.sql'));

  const baselineNotification = jsonQuery(notificationSql());
  const baselineScan = jsonQuery(shelfScanSql());
  assert(
    JSON.stringify(statuses(baselineNotification)) ===
      JSON.stringify(['applied', 'stale', 'applied', 'permanent']),
    'baseline notification future event was not permanent',
  );
  assert(
    JSON.stringify(statuses(baselineScan)) ===
      JSON.stringify(['applied', 'stale', 'applied', 'permanent']),
    'baseline Shelf scan future event was not permanent',
  );

  psql(
    'truncate table public.notification_log, public.shelf_scans, public.mobile_outbox_receipts;',
  );
  const forwardMigration = readMigration('20260726000055_immutable_event_clock_skew.sql');
  psql(forwardMigration);
  const functionDefinitionHash = psql(String.raw`
select pg_catalog.md5(
  pg_catalog.pg_get_functiondef(
    'public.apply_notification_delivery_outbox_batch(jsonb)'::pg_catalog.regprocedure
  ) ||
  pg_catalog.pg_get_functiondef(
    'public.apply_shelf_scan_outbox_batch(jsonb)'::pg_catalog.regprocedure
  )
);
`);
  psql(forwardMigration);
  assert(
    psql(String.raw`
select pg_catalog.md5(
  pg_catalog.pg_get_functiondef(
    'public.apply_notification_delivery_outbox_batch(jsonb)'::pg_catalog.regprocedure
  ) ||
  pg_catalog.pg_get_functiondef(
    'public.apply_shelf_scan_outbox_batch(jsonb)'::pg_catalog.regprocedure
  )
);
`) === functionDefinitionHash,
    'forward migration reapply changed the function definitions',
  );

  const security = jsonQuery(String.raw`
select pg_catalog.jsonb_build_object(
  'notification_security_definer', notification.prosecdef,
  'notification_empty_search_path',
    pg_catalog.pg_get_functiondef(notification.oid) like '%SET search_path TO ''''%',
  'notification_authenticated_execute',
    pg_catalog.has_function_privilege('authenticated', notification.oid, 'EXECUTE'),
  'notification_anon_execute',
    pg_catalog.has_function_privilege('anon', notification.oid, 'EXECUTE'),
  'notification_service_execute',
    pg_catalog.has_function_privilege('service_role', notification.oid, 'EXECUTE'),
  'scan_security_definer', scan.prosecdef,
  'scan_empty_search_path',
    pg_catalog.pg_get_functiondef(scan.oid) like '%SET search_path TO ''''%',
  'scan_authenticated_execute',
    pg_catalog.has_function_privilege('authenticated', scan.oid, 'EXECUTE'),
  'scan_anon_execute',
    pg_catalog.has_function_privilege('anon', scan.oid, 'EXECUTE'),
  'scan_service_execute',
    pg_catalog.has_function_privilege('service_role', scan.oid, 'EXECUTE')
)
from pg_catalog.pg_proc as notification
cross join pg_catalog.pg_proc as scan
where notification.oid =
  'public.apply_notification_delivery_outbox_batch(jsonb)'::pg_catalog.regprocedure
  and scan.oid = 'public.apply_shelf_scan_outbox_batch(jsonb)'::pg_catalog.regprocedure;
`);
  assert(security.notification_security_definer, 'notification RPC lost SECURITY DEFINER');
  assert(security.notification_empty_search_path, 'notification RPC search_path changed');
  assert(security.notification_authenticated_execute, 'notification authenticated grant changed');
  assert(!security.notification_anon_execute, 'notification anon execution became allowed');
  assert(!security.notification_service_execute, 'notification service execution became allowed');
  assert(security.scan_security_definer, 'Shelf scan RPC lost SECURITY DEFINER');
  assert(security.scan_empty_search_path, 'Shelf scan RPC search_path changed');
  assert(security.scan_authenticated_execute, 'Shelf scan authenticated grant changed');
  assert(!security.scan_anon_execute, 'Shelf scan anon execution became allowed');
  assert(!security.scan_service_execute, 'Shelf scan service execution became allowed');

  const anonFailure = psqlFailure(String.raw`
set role anon;
select public.apply_notification_delivery_outbox_batch('[]'::jsonb);
`);
  assert(/permission denied/i.test(anonFailure), 'anonymous RPC call did not fail on permission');
  const insertFailure = psqlFailure(String.raw`
set role authenticated;
insert into public.notification_log (id, user_id, tier, kind, sent_at)
values (
  '00000000-0000-4000-8000-000000000901',
  '00000000-0000-4000-8000-000000000001',
  'behavioural',
  'replenishment',
  pg_catalog.now()
);
`);
  assert(/permission denied/i.test(insertFailure), 'direct authenticated insert became allowed');

  const notification = jsonQuery(notificationSql());
  const scan = jsonQuery(shelfScanSql());
  assert(
    JSON.stringify(statuses(notification)) ===
      JSON.stringify(['applied', 'stale', 'applied', 'stale']),
    'notification clock-skew disposition is incorrect',
  );
  assert(
    JSON.stringify(statuses(scan)) === JSON.stringify(['applied', 'stale', 'applied', 'stale']),
    'Shelf scan clock-skew disposition is incorrect',
  );

  const notificationReplay = jsonQuery(notificationSql());
  const scanReplay = jsonQuery(shelfScanSql());
  assert(
    statuses(notificationReplay).every((status) => status === 'duplicate'),
    'notification response-loss replay did not converge as duplicate',
  );
  assert(
    statuses(scanReplay).every((status) => status === 'duplicate'),
    'Shelf scan response-loss replay did not converge as duplicate',
  );

  const counts = jsonQuery(String.raw`
select pg_catalog.jsonb_build_object(
  'notification_events', (select pg_catalog.count(*) from public.notification_log),
  'notification_receipts', (
    select pg_catalog.count(*) from public.mobile_outbox_receipts
    where entity_type = 'notification_delivery'
  ),
  'scan_events', (select pg_catalog.count(*) from public.shelf_scans),
  'scan_receipts', (
    select pg_catalog.count(*) from public.mobile_outbox_receipts
    where entity_type = 'shelf_scan'
  )
);
`);
  assert(counts.notification_events === 2, 'stale notification event was inserted');
  assert(counts.notification_receipts === 4, 'notification stale receipt was not retained');
  assert(counts.scan_events === 2, 'stale Shelf scan event was inserted');
  assert(counts.scan_receipts === 4, 'Shelf scan stale receipt was not retained');

  process.stdout.write(
    `${JSON.stringify(
      {
        postgres: docker(['exec', container, 'psql', '--version']),
        baseline: {
          notification: statuses(baselineNotification),
          shelfScan: statuses(baselineScan),
        },
        migrated: {
          notification: statuses(notification),
          shelfScan: statuses(scan),
        },
        replay: {
          notification: statuses(notificationReplay),
          shelfScan: statuses(scanReplay),
        },
        counts,
        security,
        anonymousRpcDenied: true,
        directInsertDenied: true,
        functionDefinitionHash,
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
