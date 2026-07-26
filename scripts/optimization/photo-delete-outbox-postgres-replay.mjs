#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const IMAGE = process.env.PHOTO_DELETE_OUTBOX_POSTGRES_IMAGE ?? 'postgres:15-alpine';
const CONTAINER = `onskin-photo-delete-${process.pid}`;
const DATABASE = 'onskin_photo_delete';
const OWNER_A = '00000000-0000-4000-8000-000000000001';
const OWNER_B = '00000000-0000-4000-8000-000000000002';
const PHOTO_A = '00000000-0000-4000-8000-000000000101';
const PHOTO_A_POISON_PAIR = '00000000-0000-4000-8000-000000000102';
const PHOTO_A_REWRITE = '00000000-0000-4000-8000-000000000103';
const PHOTO_B = '00000000-0000-4000-8000-000000000201';
const ABSENT_A = '00000000-0000-4000-8000-000000000199';
const OP_APPLY = '00000000-0000-4000-8000-000000000301';
const OP_FOREIGN = '00000000-0000-4000-8000-000000000302';
const OP_ABSENT = '00000000-0000-4000-8000-000000000303';
const OP_POISON = '00000000-0000-4000-8000-000000000304';
const OP_POISON_PAIR = '00000000-0000-4000-8000-000000000305';
const OP_DELETION_RACE = '00000000-0000-4000-8000-000000000306';
const OP_CONCURRENT = '00000000-0000-4000-8000-000000000307';

function docker(args, options = {}) {
  return execFileSync('docker', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024,
  }).trim();
}

function psql(sql) {
  return docker([
    'exec',
    CONTAINER,
    'psql',
    '-X',
    '-qAt',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'postgres',
    '-d',
    DATABASE,
    '-c',
    sql,
  ]);
}

function psqlFailure(sql) {
  try {
    psql(sql);
  } catch (error) {
    return String(error?.stderr ?? error?.message ?? '');
  }
  throw new Error('Expected PostgreSQL statement to fail.');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertSql(sql, expected, label) {
  const actual = psql(sql);
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function waitForPostgres() {
  let consecutiveSuccesses = 0;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      docker([
        'exec',
        CONTAINER,
        'psql',
        '-X',
        '-qAt',
        '-U',
        'postgres',
        '-d',
        DATABASE,
        '-c',
        'select 1',
      ]);
      consecutiveSuccesses += 1;
      if (consecutiveSuccesses >= 3) return;
    } catch {
      consecutiveSuccesses = 0;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error('PostgreSQL did not become ready.');
}

function asOwner(owner, sql) {
  return String.raw`
set role authenticated;
set request.jwt.claim.sub = '${owner}';
${sql}
reset role;`;
}

function operation({
  operationId,
  entityId,
  entityType = 'photo_delete',
  operationKind = 'delete',
  payload = null,
  clientRevision = 1,
  idempotencyKey = `photo_delete:${operationId}`,
  extra = {},
}) {
  return {
    operation_id: operationId,
    entity_type: entityType,
    entity_id: entityId,
    operation_kind: operationKind,
    payload,
    client_revision: clientRevision,
    idempotency_key: idempotencyKey,
    ...extra,
  };
}

function rpcSql(owner, operations) {
  const json = JSON.stringify(operations).replaceAll("'", "''");
  return asOwner(owner, `select public.apply_photo_delete_outbox_batch('${json}'::jsonb);`);
}

function rpc(owner, operations) {
  const output = psql(rpcSql(owner, operations));
  return JSON.parse(output);
}

function byOperation(results, operationId) {
  return results.find((result) => result.operation_id === operationId);
}

function runConcurrent(sql) {
  const child = spawn(
    'docker',
    [
      'exec',
      CONTAINER,
      'psql',
      '-X',
      '-qAt',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      DATABASE,
      '-c',
      sql,
    ],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let stdout = '';
  let stderr = '';
  let readyResolved = false;
  let resolveReady;
  const ready = new Promise((resolveReadyPromise) => {
    resolveReady = resolveReadyPromise;
  });
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
    if (!readyResolved && stdout.includes('account-lock-held')) {
      readyResolved = true;
      resolveReady();
    }
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const completion = new Promise((resolveCompletion) => {
    child.on('close', (code) => {
      if (!readyResolved) {
        readyResolved = true;
        resolveReady();
      }
      resolveCompletion({ code, stdout, stderr });
    });
  });
  return { ready, completion };
}

const bootstrap = String.raw`
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table auth.users (id uuid primary key);
insert into auth.users (id) values ('${OWNER_A}'), ('${OWNER_B}');

create table public.photos (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade
);
alter table public.photos enable row level security;
create policy "photos_select_own" on public.photos
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "photos_insert_own" on public.photos
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "photos_update_own" on public.photos
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "photos_delete_own" on public.photos
  for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.photos to authenticated;

create table public.mobile_outbox_receipts (
  user_id uuid not null references auth.users (id) on delete cascade,
  operation_id uuid not null,
  idempotency_key text not null check (
    pg_catalog.octet_length(idempotency_key) between 1 and 256
  ),
  entity_type text not null,
  entity_id uuid not null,
  operation_kind text not null,
  client_revision bigint not null check (client_revision > 0),
  result_status text not null check (result_status in ('applied', 'stale')),
  applied_at timestamptz not null default pg_catalog.now(),
  primary key (user_id, operation_id),
  constraint mobile_outbox_receipts_owner_idempotency_key
    unique (user_id, idempotency_key),
  constraint mobile_outbox_receipts_entity_type_check
    check (entity_type in (
      'shelf_product',
      'shelf_scan',
      'conflict_choice',
      'notification_delivery',
      'notification_preferences',
      'recommendation_preferences'
    ))
);

create table public.account_deletion_requests (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function public.account_deletion_write_allowed()
returns boolean
language plpgsql
security definer
set search_path = ''
volatile
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('account-deletion:' || v_user_id::text, 0)
  );
  return not exists (
    select 1
      from public.account_deletion_requests as deletion
     where deletion.user_id = v_user_id
  );
end;
$$;

revoke all on function public.account_deletion_write_allowed() from public, anon;
grant execute on function public.account_deletion_write_allowed() to authenticated;
grant usage on schema public, auth to authenticated;
grant execute on function auth.uid() to authenticated;

insert into public.photos (id, user_id) values
  ('${PHOTO_A}', '${OWNER_A}'),
  ('${PHOTO_A_POISON_PAIR}', '${OWNER_A}'),
  ('${PHOTO_A_REWRITE}', '${OWNER_A}'),
  ('${PHOTO_B}', '${OWNER_B}');
`;

let started = false;
try {
  docker([
    'run',
    '--detach',
    '--rm',
    '--name',
    CONTAINER,
    '--env',
    'POSTGRES_PASSWORD=postgres',
    '--env',
    `POSTGRES_DB=${DATABASE}`,
    IMAGE,
  ]);
  started = true;
  waitForPostgres();
  psql(bootstrap);

  const migration = readFileSync(
    resolve(ROOT, 'supabase/migrations/20260726000058_photo_delete_outbox_rpc.sql'),
    'utf8',
  );
  psql(migration);
  const firstDefinitionHash = psql(String.raw`
select pg_catalog.md5(
  pg_catalog.pg_get_functiondef(
    'public.apply_photo_delete_outbox_batch(jsonb)'::pg_catalog.regprocedure
  ) ||
  pg_catalog.pg_get_functiondef(
    'public.photo_outbox_insert_allowed(uuid)'::pg_catalog.regprocedure
  )
);`);
  psql(migration);
  assertSql(
    String.raw`
select pg_catalog.md5(
  pg_catalog.pg_get_functiondef(
    'public.apply_photo_delete_outbox_batch(jsonb)'::pg_catalog.regprocedure
  ) ||
  pg_catalog.pg_get_functiondef(
    'public.photo_outbox_insert_allowed(uuid)'::pg_catalog.regprocedure
  )
);`,
    firstDefinitionHash,
    'byte-identical migration reapplication',
  );

  const directDeleteFailure = psqlFailure(
    asOwner(OWNER_A, `delete from public.photos where id = '${PHOTO_A}';`),
  );
  assert(
    /permission denied|row-level security/i.test(directDeleteFailure),
    'direct delete survived',
  );

  const appliedIntent = operation({ operationId: OP_APPLY, entityId: PHOTO_A });
  const applied = rpc(OWNER_A, [appliedIntent]);
  assert(byOperation(applied, OP_APPLY)?.status === 'applied', 'photo delete did not apply');
  assert(byOperation(applied, OP_APPLY)?.error_class === null, 'applied delete had an error');
  assertSql(
    `select count(*) from public.photos where id = '${PHOTO_A}';`,
    '0',
    'owner photo deletion',
  );
  const staleReinsertFailure = psqlFailure(
    asOwner(
      OWNER_A,
      `insert into public.photos (id, user_id) values ('${PHOTO_A}', '${OWNER_A}');`,
    ),
  );
  assert(
    /row-level security|policy/i.test(staleReinsertFailure),
    'delete receipt did not block owner reinsertion',
  );
  const staleRewriteFailure = psqlFailure(
    asOwner(OWNER_A, `update public.photos set id = '${PHOTO_A}' where id = '${PHOTO_A_REWRITE}';`),
  );
  assert(
    /row-level security|policy/i.test(staleRewriteFailure),
    'delete receipt did not block owner UUID rewrite',
  );
  assertSql(
    `select count(*) from public.photos where id = '${PHOTO_A_REWRITE}';`,
    '1',
    'failed tombstone rewrite preserves original row',
  );
  psql(
    asOwner(
      OWNER_B,
      `insert into public.photos (id, user_id) values ('${PHOTO_A}', '${OWNER_B}');`,
    ),
  );
  assertSql(
    `select count(*) from public.photos where id = '${PHOTO_A}' and user_id = '${OWNER_B}';`,
    '1',
    'photo tombstone must remain owner-scoped',
  );

  const duplicate = rpc(OWNER_A, [appliedIntent]);
  assert(byOperation(duplicate, OP_APPLY)?.status === 'duplicate', 'replay was not duplicate');
  assertSql(
    `select count(*) from public.mobile_outbox_receipts
      where user_id = '${OWNER_A}' and operation_id = '${OP_APPLY}';`,
    '1',
    'single exact receipt after replay',
  );

  const foreign = rpc(OWNER_A, [operation({ operationId: OP_FOREIGN, entityId: PHOTO_B })]);
  assert(
    byOperation(foreign, OP_FOREIGN)?.status === 'applied',
    'foreign/absent owner row did not converge',
  );
  assertSql(
    `select count(*) from public.photos where id = '${PHOTO_B}' and user_id = '${OWNER_B}';`,
    '1',
    'owner A must not delete owner B photo',
  );

  const absent = rpc(OWNER_A, [operation({ operationId: OP_ABSENT, entityId: ABSENT_A })]);
  assert(byOperation(absent, OP_ABSENT)?.status === 'applied', 'absent row did not apply');

  const concurrentIntent = operation({
    operationId: OP_CONCURRENT,
    entityId: ABSENT_A,
  });
  const concurrentA = runConcurrent(rpcSql(OWNER_A, [concurrentIntent]));
  const concurrentB = runConcurrent(rpcSql(OWNER_A, [concurrentIntent]));
  const concurrentResults = await Promise.all([concurrentA.completion, concurrentB.completion]);
  assert(
    concurrentResults.every((result) => result.code === 0),
    `concurrent replay failed: ${concurrentResults.map((result) => result.stderr).join(' | ')}`,
  );
  const concurrentStatuses = concurrentResults
    .map((result) => JSON.parse(result.stdout.trim())[0]?.status)
    .sort();
  assert(
    JSON.stringify(concurrentStatuses) === JSON.stringify(['applied', 'duplicate']),
    `concurrent replay did not converge: ${JSON.stringify(concurrentStatuses)}`,
  );
  assertSql(
    `select count(*) from public.mobile_outbox_receipts
      where user_id = '${OWNER_A}' and operation_id = '${OP_CONCURRENT}';`,
    '1',
    'single receipt after concurrent replay',
  );

  const reusedOperation = rpc(OWNER_A, [
    operation({ operationId: OP_APPLY, entityId: PHOTO_A_POISON_PAIR }),
  ]);
  assert(
    byOperation(reusedOperation, OP_APPLY)?.status === 'permanent',
    'operation UUID reuse with changed intent was not rejected',
  );
  assertSql(
    `select count(*) from public.photos where id = '${PHOTO_A_POISON_PAIR}';`,
    '1',
    'reused operation changed a photo',
  );

  const isolated = rpc(OWNER_A, [
    operation({
      operationId: OP_POISON,
      entityId: ABSENT_A,
      operationKind: 'upsert',
    }),
    operation({
      operationId: OP_POISON_PAIR,
      entityId: PHOTO_A_POISON_PAIR,
    }),
  ]);
  assert(
    byOperation(isolated, OP_POISON)?.status === 'permanent',
    'valid-shaped poison was not isolated',
  );
  assert(
    byOperation(isolated, OP_POISON_PAIR)?.status === 'applied',
    'poison blocked the independent valid row',
  );
  assertSql(
    `select count(*) from public.photos where id = '${PHOTO_A_POISON_PAIR}';`,
    '0',
    'valid row after poison',
  );

  const oversized = Array.from({ length: 26 }, (_, index) =>
    operation({
      operationId: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      entityId: ABSENT_A,
    }),
  );
  assert(
    /invalid_outbox_batch/i.test(psqlFailure(rpcSql(OWNER_A, oversized))),
    '26-row batch was accepted',
  );
  assert(
    /authentication_required/i.test(
      psqlFailure(`select public.apply_photo_delete_outbox_batch('[]'::jsonb);`),
    ),
    'unauthenticated invocation was accepted',
  );

  const lockHolder = runConcurrent(String.raw`
begin;
select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('account-deletion:${OWNER_A}', 0)
);
insert into public.account_deletion_requests (user_id) values ('${OWNER_A}');
select 'account-lock-held';
select pg_catalog.pg_sleep(1);
commit;`);
  await lockHolder.ready;
  const racedFailure = psqlFailure(
    rpcSql(OWNER_A, [operation({ operationId: OP_DELETION_RACE, entityId: ABSENT_A })]),
  );
  const lockResult = await lockHolder.completion;
  assert(lockResult.code === 0, `account deletion lock holder failed: ${lockResult.stderr}`);
  assert(
    /account_deletion_in_progress/i.test(racedFailure),
    'absent photo receipt raced past account deletion',
  );
  assertSql(
    `select count(*) from public.mobile_outbox_receipts
      where user_id = '${OWNER_A}' and operation_id = '${OP_DELETION_RACE}';`,
    '0',
    'no receipt while account deletion is active',
  );

  assertSql(
    String.raw`
select concat_ws(
  ',',
  (select count(*) from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'photos'
      and policyname = 'photos_delete_own'),
  (select count(*) from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'photos'
      and policyname = 'photos_no_outbox_delete_reinsert'),
  (select count(*) from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'photos'
      and policyname = 'photos_no_outbox_delete_rewrite'),
  pg_catalog.has_table_privilege('authenticated', 'public.photos', 'DELETE')::int,
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.apply_photo_delete_outbox_batch(jsonb)',
    'EXECUTE'
  )::int,
  pg_catalog.has_function_privilege(
    'anon',
    'public.apply_photo_delete_outbox_batch(jsonb)',
    'EXECUTE'
  )::int,
  pg_catalog.has_function_privilege(
    'public',
    'public.apply_photo_delete_outbox_batch(jsonb)',
    'EXECUTE'
  )::int,
  pg_catalog.has_function_privilege(
    'service_role',
    'public.apply_photo_delete_outbox_batch(jsonb)',
    'EXECUTE'
  )::int,
  (select prosecdef::int
     from pg_catalog.pg_proc
    where oid = 'public.apply_photo_delete_outbox_batch(jsonb)'::pg_catalog.regprocedure),
  (select ('search_path=""' = any(proconfig))::int
     from pg_catalog.pg_proc
    where oid = 'public.apply_photo_delete_outbox_batch(jsonb)'::pg_catalog.regprocedure),
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.photo_outbox_insert_allowed(uuid)',
    'EXECUTE'
  )::int,
  pg_catalog.has_function_privilege(
    'anon',
    'public.photo_outbox_insert_allowed(uuid)',
    'EXECUTE'
  )::int,
  pg_catalog.has_function_privilege(
    'public',
    'public.photo_outbox_insert_allowed(uuid)',
    'EXECUTE'
  )::int,
  pg_catalog.has_function_privilege(
    'service_role',
    'public.photo_outbox_insert_allowed(uuid)',
    'EXECUTE'
  )::int,
  (select prosecdef::int
     from pg_catalog.pg_proc
    where oid = 'public.photo_outbox_insert_allowed(uuid)'::pg_catalog.regprocedure),
  (select ('search_path=""' = any(proconfig))::int
     from pg_catalog.pg_proc
    where oid = 'public.photo_outbox_insert_allowed(uuid)'::pg_catalog.regprocedure),
  (select count(*)
     from pg_catalog.pg_indexes
    where schemaname = 'public'
      and tablename = 'mobile_outbox_receipts'
      and indexname = 'mobile_outbox_receipts_photo_delete_tombstone_idx'
      and indexdef like '%(user_id, entity_id)%'
      and indexdef like '%entity_type = ''photo_delete''%'
      and indexdef like '%result_status = ''applied''%'),
  (select (
    pg_catalog.pg_get_constraintdef(oid) like '%photo_delete%'
    and pg_catalog.pg_get_constraintdef(oid) like '%shelf_product%'
    and pg_catalog.pg_get_constraintdef(oid) like '%conflict_choice%'
  )::int
   from pg_catalog.pg_constraint
   where conrelid = 'public.mobile_outbox_receipts'::pg_catalog.regclass
     and conname = 'mobile_outbox_receipts_entity_type_check')
);`,
    '0,1,1,0,1,0,0,0,1,1,1,0,0,0,1,1,1,1',
    'RLS/grant/security-definer/search-path/receipt contract',
  );

  process.stdout.write(
    `${JSON.stringify({
      checkpoint: 'photo_delete_outbox_postgres_replay',
      postgres: docker(['exec', CONTAINER, 'psql', '--version']),
      double_apply: true,
      exact_delete: 'applied',
      response_loss_replay: 'duplicate',
      concurrent_replay: 'applied_plus_duplicate',
      absent_row: 'applied',
      cross_owner: 'isolated',
      reused_operation: 'permanent',
      poison_row: 'isolated',
      account_deletion_race: 'serialized_and_denied',
      direct_delete: 'revoked',
      stale_reinsert: 'terminal_owner_tombstone',
      stale_uuid_rewrite: 'terminal_owner_tombstone',
    })}\n`,
  );
} finally {
  if (started) {
    try {
      docker(['rm', '--force', CONTAINER]);
    } catch {
      // Best-effort disposable harness cleanup.
    }
  }
}
