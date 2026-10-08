-- P2A-R2 native multi-session publication rehearsal. NOT a PGlite concurrency test.
-- Run only after all migrations in a NEW, EMPTY disposable local PostgreSQL 15+
-- database with dblink, never against hosted/development/production account data.
-- Example (adjust only the independently verified disposable local port/name):
-- env -u PGHOST -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE \
--   PGOPTIONS='-c c10.disposable_database=on' psql -X -v ON_ERROR_STOP=1 \
--   -h 127.0.0.1 -p 5432 -U postgres -d onskin_c10_r2_review \
--   -f scripts/phase9/c10-webhook-publication-concurrency.sql
-- Only disposable fixture objects, rows and helper grants are created.
-- Keep the synthetic rows for inspection; dispose of this entire database later.
-- Claim native success only when every C10_R2_NATIVE_*_PASS marker is observed.

do $$
begin
  if current_setting('c10.disposable_database', true) is distinct from 'on' then
    raise exception 'C10_R2_DISPOSABLE_DATABASE_ACKNOWLEDGEMENT_REQUIRED';
  end if;
  if exists(select 1 from auth.users)
    or exists(select 1 from public.entitlements)
    or exists(select 1 from public.subscriptions_events)
    or exists(select 1 from public.account_deletion_operations)
    or exists(select 1 from revenuecat_publication.projections)
    or to_regclass('public.c10r2_target') is not null then
    raise exception 'C10_R2_FRESH_DISPOSABLE_DATABASE_REQUIRED';
  end if;
end;
$$;

create extension if not exists dblink with schema public;
create table public.c10r2_target(
  singleton boolean primary key check(singleton), nonce uuid not null,
  fixture_at timestamptz not null
);
insert into public.c10r2_target values(true, gen_random_uuid(), date_trunc('milliseconds',clock_timestamp()) - interval '3 minutes');
grant select on public.c10r2_target to service_role;
insert into auth.users(id)
select ('00000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid
from generate_series(501,506) fixture(i);
insert into auth.sessions(id,user_id)
select ('10000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
       ('00000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid
from generate_series(501,506) fixture(i);

-- C10_R2_HELPERS_BEGIN
-- Helpers are invokers. Every write enters the actual service-only boundary.
create function public.c10r2_assert(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception using message = label; end if;
end;
$$;

create function public.c10r2_event(
  owner_id uuid, event_id text, event_type text default 'INITIAL_PURCHASE',
  event_offset interval default interval '0 seconds',
  transaction_id text default 'c10r2-current-transaction',
  cancel_reason text default null, opaque_identity text default null
)
returns jsonb language sql set search_path = '' as $$
  with fixture as (
    select fixture_at, fixture_at - interval '1 day' as purchased_at,
      fixture_at + interval '30 days' as expires_at,
      coalesce(opaque_identity, owner_id::text) as identity
    from public.c10r2_target where singleton
  ), payload as (
    select fixture.*, jsonb_build_object('event', jsonb_strip_nulls(jsonb_build_object(
      'id', event_id, 'type', event_type, 'app_user_id', identity,
      'original_app_user_id', identity, 'entitlement_ids', jsonb_build_array('pro'),
      'product_id', 'layerwell_pro_annual', 'store', 'APP_STORE',
      'environment', 'PRODUCTION', 'period_type', 'NORMAL',
      'transaction_id', transaction_id, 'original_transaction_id', 'c10r2-original-chain',
      'cancel_reason', cancel_reason,
      'event_timestamp_ms', floor(extract(epoch from fixture_at + event_offset) * 1000),
      'purchased_at_ms', floor(extract(epoch from purchased_at) * 1000),
      'expiration_at_ms', floor(extract(epoch from expires_at) * 1000)))) as body
    from fixture
  )
  select to_jsonb(result) from payload cross join lateral public.process_revenuecat_webhook_event_guarded(
    event_id, event_type, '{}'::text[], identity, identity,
    null::text[], null::text[], null::text[],
    'production', 'app_store', 'layerwell_pro_annual', 'pro',
    expires_at, purchased_at, fixture_at + event_offset, clock_timestamp(),
    'c10r2-original-chain', transaction_id, 'normal',
    case when event_type = 'EXPIRATION' or cancel_reason = 'UNSUBSCRIBE' then false else true end,
    event_type <> 'EXPIRATION' and cancel_reason is distinct from 'CUSTOMER_SUPPORT', true,
    (case when event_type = 'EXPIRATION' or cancel_reason = 'CUSTOMER_SUPPORT' then 300
      when event_type = 'CANCELLATION' then 100 else 200 end)::smallint,
    'default', body, false, true,
    array[1::smallint],
    array[encode(sha256(convert_to('synthetic-c10r2:' || identity,'UTF8')),'hex')],
    array[identity]
  ) result;
$$;
grant execute on function public.c10r2_event(uuid,text,text,interval,text,text,text) to service_role;

-- Execute only inside a remote session (or an already locked writer session).
-- The actual authenticated reader takes an owner advisory transaction lock;
-- never call it in the controller transaction before a remote writer.
create function public.c10r2_read_session(owner_id uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare
  old_role text := current_setting('role');
  old_sub text := current_setting('request.jwt.claim.sub',true);
  old_claims text := current_setting('request.jwt.claims',true);
  result jsonb;
begin
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('session_id',
    regexp_replace(owner_id::text, '^00000000', '10000000'))::text, true);
  perform set_config('role', 'authenticated', true);
  result := public.read_entitlement_projections();
  perform set_config('role', old_role, true);
  perform set_config('request.jwt.claim.sub', coalesce(old_sub,''), true);
  perform set_config('request.jwt.claims', coalesce(old_claims,''), true);
  if result ->> 'schema_version' <> '2' then raise exception 'C10_R2_READER_NOT_VERSION_TWO'; end if;
  return result;
exception when others then
  perform set_config('role', old_role, true);
  perform set_config('request.jwt.claim.sub', coalesce(old_sub,''), true);
  perform set_config('request.jwt.claims', coalesce(old_claims,''), true);
  raise;
end;
$$;

-- Independent autocommit calls used by controller assertions. The committed
-- sentinel binds each connection to this exact disposable database before any
-- authenticated read or service write can acquire an account lock.
create function public.c10r2_remote(statement text, as_service boolean default false)
returns jsonb language plpgsql set search_path = '' as $$
declare
  host text := coalesce(inet_server_addr()::text,
    nullif(btrim(split_part(current_setting('unix_socket_directories'), ',', 1),' "'),''));
  expected_nonce uuid := (select nonce from public.c10r2_target where singleton);
  actual_nonce uuid;
  remote_pid integer;
  opened boolean := false;
  result jsonb;
begin
  if host is null then raise exception 'C10_R2_EXPLICIT_LOCAL_SERVER_OR_SOCKET_REQUIRED'; end if;
  perform public.dblink_connect('c10r2_observe',
    'dbname=' || quote_literal(current_database()) || ' host=' || quote_literal(host)
    || ' port=' || current_setting('port') || ' user=' || quote_literal(session_user)
    || ' connect_timeout=5 options=''-c statement_timeout=8000''');
  opened := true;
  select nonce,pid into strict actual_nonce,remote_pid from public.dblink('c10r2_observe',
    'select nonce,pg_backend_pid() from public.c10r2_target where singleton') as target(nonce uuid,pid integer);
  perform public.c10r2_assert(actual_nonce = expected_nonce and remote_pid <> pg_backend_pid(),
    'C10_R2_UNVERIFIED_REMOTE_DATABASE');
  if as_service then perform public.dblink_exec('c10r2_observe','set role service_role'); end if;
  select value into strict result from public.dblink('c10r2_observe',statement) as remote(value jsonb);
  perform public.dblink_disconnect('c10r2_observe');
  return result;
exception when query_canceled or others then
  if opened then
    begin perform public.dblink_disconnect('c10r2_observe');
    exception when query_canceled or others then null;
    end;
  end if;
  raise;
end;
$$;

-- A writes inside BEGIN. Independent writer B and authenticated reader C must
-- both visibly wait on A in distinct backends. Plain administrator MVCC reads
-- compare the private committed materialization without acquiring owner locks.
-- Only after observing both waits is A committed or rolled back. A fresh C read
-- after B finishes supplies the authoritative final DTO. The controller never
-- invokes the real authenticated reader or writer in its own transaction.
create function public.c10r2_pair(owner_id uuid, first_sql text, second_sql text,
  rollback_first boolean default false, read_projection boolean default true)
returns jsonb language plpgsql set search_path = '' as $$
declare
  host text := coalesce(inet_server_addr()::text,
    nullif(btrim(split_part(current_setting('unix_socket_directories'), ',', 1),' "'),''));
  conninfo text;
  expected_nonce uuid := (select nonce from public.c10r2_target where singleton);
  actual_nonce uuid;
  connection text;
  opened text[] := '{}'::text[];
  first_pid integer;
  second_pid integer;
  reader_pid integer;
  deadline timestamptz;
  saw_wait boolean := false;
  saw_reader_wait boolean := false;
  first_result jsonb;
  second_result jsonb;
  before_projection jsonb;
  first_projection jsonb;
  during_read_result jsonb;
  before_materialization jsonb;
  during_materialization jsonb;
  after_projection jsonb;
  read_sql text := format('select public.c10r2_read_session(%L::uuid)',owner_id);
begin
  if host is null then raise exception 'C10_R2_EXPLICIT_LOCAL_SERVER_OR_SOCKET_REQUIRED'; end if;
  conninfo := 'dbname=' || quote_literal(current_database()) || ' host=' || quote_literal(host)
    || ' port=' || current_setting('port') || ' user=' || quote_literal(session_user)
    || ' connect_timeout=5 options=''-c statement_timeout=8000''';
  foreach connection in array array['c10r2_first','c10r2_second','c10r2_reader'] loop
    perform public.dblink_connect(connection,conninfo);
    opened := array_append(opened,connection);
    select nonce into strict actual_nonce from public.dblink(connection,
      'select nonce from public.c10r2_target where singleton') as target(nonce uuid);
    perform public.c10r2_assert(actual_nonce = expected_nonce,'C10_R2_UNVERIFIED_REMOTE_DATABASE');
  end loop;
  select pid into strict first_pid from public.dblink('c10r2_first','select pg_backend_pid()') as remote(pid integer);
  select pid into strict second_pid from public.dblink('c10r2_second','select pg_backend_pid()') as remote(pid integer);
  select pid into strict reader_pid from public.dblink('c10r2_reader','select pg_backend_pid()') as remote(pid integer);
  perform public.c10r2_assert((select count(distinct pid) from
    unnest(array[first_pid,second_pid,reader_pid,pg_backend_pid()]) as backend(pid)) = 4,
    'C10_R2_DISTINCT_NATIVE_BACKENDS_REQUIRED');
  if read_projection then
    select result into strict before_projection from public.dblink('c10r2_reader',read_sql) as remote(result jsonb);
    select to_jsonb(p) into before_materialization from revenuecat_publication.projections p where p.user_id=owner_id;
  end if;
  perform public.dblink_exec('c10r2_first','set role service_role');
  perform public.dblink_exec('c10r2_second','set role service_role');
  perform public.dblink_exec('c10r2_first','begin');
  select result into strict first_result from public.dblink('c10r2_first',first_sql) as remote(result jsonb);
  if read_projection then
    perform public.dblink_exec('c10r2_first','reset role');
    select result into strict first_projection from public.dblink('c10r2_first',read_sql) as remote(result jsonb);
    select to_jsonb(p) into during_materialization from revenuecat_publication.projections p where p.user_id=owner_id;
    perform public.c10r2_assert(during_materialization is not distinct from before_materialization,
      'C10_R2_UNCOMMITTED_PUBLICATION_VISIBLE');
  end if;
  perform public.c10r2_assert(public.dblink_send_query('c10r2_second',second_sql) = 1,'C10_R2_ASYNC_DISPATCH_FAILED');
  deadline := clock_timestamp() + interval '3 seconds';
  while not saw_wait and public.dblink_is_busy('c10r2_second') = 1 loop
    saw_wait := exists(select 1 from pg_catalog.pg_locks where pid = second_pid
      and locktype = 'advisory' and not granted) and first_pid = any(pg_catalog.pg_blocking_pids(second_pid));
    if clock_timestamp() > deadline then raise exception 'C10_R2_SECOND_WRITER_DID_NOT_WAIT'; end if;
    perform pg_sleep(0.005);
  end loop;
  perform public.c10r2_assert(saw_wait,'C10_R2_REAL_ADVISORY_LOCK_OVERLAP_REQUIRED');
  if read_projection then
    perform public.c10r2_assert(public.dblink_send_query('c10r2_reader',read_sql) = 1,'C10_R2_READER_DISPATCH_FAILED');
    deadline := clock_timestamp() + interval '3 seconds';
    while not saw_reader_wait and public.dblink_is_busy('c10r2_reader') = 1 loop
      saw_reader_wait := exists(select 1 from pg_catalog.pg_locks where pid = reader_pid
        and locktype = 'advisory' and not granted) and first_pid = any(pg_catalog.pg_blocking_pids(reader_pid));
      if clock_timestamp() > deadline then raise exception 'C10_R2_AUTHENTICATED_READER_DID_NOT_WAIT'; end if;
      perform pg_sleep(0.005);
    end loop;
    perform public.c10r2_assert(saw_reader_wait,'C10_R2_REAL_READER_LOCK_OVERLAP_REQUIRED');
  end if;
  perform public.dblink_exec('c10r2_first',case when rollback_first then 'rollback' else 'commit' end);
  deadline := clock_timestamp() + interval '5 seconds';
  while public.dblink_is_busy('c10r2_second') = 1 loop
    if clock_timestamp() > deadline then raise exception 'C10_R2_SECOND_WRITER_DID_NOT_FINISH'; end if;
    perform pg_sleep(0.005);
  end loop;
  select result into strict second_result from public.dblink_get_result('c10r2_second') as remote(result jsonb);
  if read_projection then
    deadline := clock_timestamp() + interval '5 seconds';
    while public.dblink_is_busy('c10r2_reader') = 1 loop
      if clock_timestamp() > deadline then raise exception 'C10_R2_READER_DID_NOT_FINISH'; end if;
      perform pg_sleep(0.005);
    end loop;
    select result into strict during_read_result from public.dblink_get_result('c10r2_reader') as remote(result jsonb);
    -- Drain the trailing empty result before reusing the autocommit reader.
    perform result from public.dblink_get_result('c10r2_reader') as remote(result jsonb);
    select result into strict after_projection from public.dblink('c10r2_reader',read_sql) as remote(result jsonb);
    perform public.c10r2_assert(during_read_result = before_projection
      or during_read_result = after_projection
      or (not rollback_first and during_read_result = first_projection),
      'C10_R2_AUTHENTICATED_READER_OBSERVED_UNCOMMITTED_PUBLICATION');
    if rollback_first then
      perform public.c10r2_assert(during_read_result is distinct from first_projection,
        'C10_R2_READER_OBSERVED_ROLLED_BACK_REVISION');
    end if;
  end if;
  foreach connection in array opened loop perform public.dblink_disconnect(connection); end loop;
  raise notice 'C10_R2_NATIVE_OVERLAP owner=% first_pid=% second_pid=% reader_pid=% controller_pid=% writer_wait=% reader_wait=% rollback=% before_materialization=% during_materialization=% first_projection=% overlapping_reader=% after=%',
    owner_id,first_pid,second_pid,reader_pid,pg_backend_pid(),saw_wait,saw_reader_wait,rollback_first,
    before_materialization,during_materialization,first_projection,during_read_result,after_projection;
  return jsonb_build_object('first',first_result,'second',second_result,'sawWait',saw_wait,
    'sawReaderWait',saw_reader_wait,'firstPid',first_pid,'secondPid',second_pid,'readerPid',reader_pid,
    'controllerPid',pg_backend_pid(),'before',before_projection,'firstProjection',first_projection,
    'beforeMaterialization',before_materialization,'duringMaterialization',during_materialization,
    'overlappingReaderResult',during_read_result,'after',after_projection);
exception when query_canceled or others then
  -- Cleanup owns only successfully opened connections, and does not mask the
  -- first error. Disconnect also closes a transaction with unread results.
  foreach connection in array opened loop
    if connection = any(coalesce(public.dblink_get_connections(),'{}'::text[])) then
      begin
        if public.dblink_is_busy(connection) = 1 then perform public.dblink_cancel_query(connection); end if;
        perform public.dblink_exec(connection,'rollback',false);
      exception when query_canceled or others then null;
      end;
      begin perform public.dblink_disconnect(connection);
      exception when query_canceled or others then null;
      end;
    end if;
  end loop;
  raise;
end;
$$;
-- C10_R2_HELPERS_END

do $$
declare
  owner_id uuid := '00000000-0000-4000-8000-000000000501';
  query text := 'select public.c10r2_event(''00000000-0000-4000-8000-000000000501'',''c10r2-concurrent-duplicate'')';
  race jsonb;
  duplicate jsonb;
begin
  race := public.c10r2_pair(owner_id,query,query);
  perform public.c10r2_assert(race #>> '{first,outcome}' = 'processed'
    and race #>> '{second,outcome}' = 'duplicate'
    and race -> 'firstProjection' = race -> 'after'
    and (race #>> '{after,store_projection,row,cursor,revision}')::bigint > 0
    and (select count(*) from public.subscriptions_events where rc_event_id = 'c10r2-concurrent-duplicate'
      and processing_attempts = 1 and processing_status = 'processed') = 1,
    'C10_R2_DUPLICATE_PUBLISHED_MORE_THAN_ONE_RESULT');
  duplicate := public.c10r2_remote(query,true);
  perform public.c10r2_assert(duplicate ->> 'outcome' = 'duplicate'
    and public.c10r2_remote(format('select public.c10r2_read_session(%L::uuid)',owner_id)) = race -> 'after','C10_R2_LOST_ACK_CHANGED_COMMITTED_REVISION');
end;
$$;
select 'C10_R2_NATIVE_DUPLICATE_AND_LOST_ACK_PASS' as result;

do $$
declare race jsonb;
begin
  race := public.c10r2_pair('00000000-0000-4000-8000-000000000502',
    'select public.c10r2_event(''00000000-0000-4000-8000-000000000502'',''c10r2-concurrent-purchase'')',
    'select public.c10r2_event(''00000000-0000-4000-8000-000000000502'',''c10r2-concurrent-refund'',''CANCELLATION'',interval ''1 minute'',''c10r2-current-transaction'',''CUSTOMER_SUPPORT'')');
  perform public.c10r2_assert(race #>> '{after,store_projection,state}' = 'inactive'
    and (race #>> '{after,store_projection,row,cursor,revision}')::bigint >
      (race #>> '{firstProjection,store_projection,row,cursor,revision}')::bigint
    and race #>> '{after,store_projection,row,will_renew}' = 'true',
    'C10_R2_DIFFERENT_EVENTS_LOST_FACT_OR_REVISION');
end;
$$;
select 'C10_R2_NATIVE_DIFFERENT_OWNER_EVENTS_PASS' as result;

do $$
declare
  owner_id uuid := '00000000-0000-4000-8000-000000000503';
  query text := 'select public.c10r2_event(''00000000-0000-4000-8000-000000000503'',''c10r2-rolled-back-purchase'')';
  race jsonb;
begin
  race := public.c10r2_pair(owner_id,query,query,true);
  perform public.c10r2_assert(race #>> '{second,outcome}' = 'processed'
    and race #>> '{before,store_projection,state}' = 'absent'
    and (race -> 'beforeMaterialization') is not distinct from (race -> 'duringMaterialization')
    and race #>> '{after,store_projection,state}' = 'active'
    and (race #>> '{after,store_projection,row,cursor,revision}')::bigint >
      (race #>> '{firstProjection,store_projection,row,cursor,revision}')::bigint
    and (select count(*) from public.subscriptions_events where rc_event_id = 'c10r2-rolled-back-purchase'
      and processing_attempts = 1 and processing_status = 'processed') = 1,
    'C10_R2_ROLLBACK_ACKNOWLEDGED_OR_REUSED_UNCOMMITTED_REVISION');
end;
$$;
select 'C10_R2_NATIVE_OUTER_ROLLBACK_AND_RETRY_PASS' as result;

-- Snapshot writers participate in the same lock/revision boundary. This checks
-- compatibility only, without retrieving/reconciling provider history.
set role service_role;
select public.c10r2_event('00000000-0000-4000-8000-000000000504','c10r2-snapshot-race-purchase');
reset role;
do $$
declare
  race jsonb;
  at timestamptz := (select fixture_at from public.c10r2_target where singleton);
  snapshot_query text;
begin
  snapshot_query := format('select to_jsonb(public.reconcile_revenuecat_entitlement_snapshot(%L::uuid,%L::timestamptz,''pro'',true,''layerwell_pro_annual'',%L::timestamptz,''app_store'',''normal'',true,%L::timestamptz,''default'',''production'',null,null))',
    '00000000-0000-4000-8000-000000000504',at + interval '1 minute',at + interval '30 days',at - interval '1 day');
  race := public.c10r2_pair('00000000-0000-4000-8000-000000000504',
    'select public.c10r2_event(''00000000-0000-4000-8000-000000000504'',''c10r2-refund-before-older-snapshot'',''CANCELLATION'',interval ''2 minutes'',''c10r2-current-transaction'',''CUSTOMER_SUPPORT'')',snapshot_query);
  perform public.c10r2_assert(race #>> '{after,store_projection,state}' = 'inactive'
    and race -> 'after' = race -> 'firstProjection','C10_R2_OLDER_SNAPSHOT_REGRESSED_REFUND_PUBLICATION');
  snapshot_query := format('select to_jsonb(public.reconcile_revenuecat_entitlement_snapshot(%L::uuid,%L::timestamptz,''pro'',false,''layerwell_pro_annual'',%L::timestamptz,''app_store'',''normal'',false,%L::timestamptz,''default'',''production'',null,null))',
    '00000000-0000-4000-8000-000000000505',at,at - interval '1 second',at - interval '1 day');
  race := public.c10r2_pair('00000000-0000-4000-8000-000000000505',snapshot_query,
    'select public.c10r2_event(''00000000-0000-4000-8000-000000000505'',''c10r2-new-purchase-after-snapshot'',''RENEWAL'',interval ''2 minutes'',''c10r2-genuine-new-transaction'')');
  perform public.c10r2_assert(race #>> '{after,store_projection,state}' = 'active'
    and (race #>> '{after,store_projection,row,cursor,revision}')::bigint >
      (race #>> '{firstProjection,store_projection,row,cursor,revision}')::bigint
    and race #>> '{after,store_projection,row,cursor,provider,kind}' = 'rc_webhook',
    'C10_R2_POST_SNAPSHOT_PURCHASE_DID_NOT_PUBLISH_NEW_REVISION');
end;
$$;
select 'C10_R2_NATIVE_SNAPSHOT_RACE_BOTH_DIRECTIONS_PASS' as result;

-- The actual publication-drained deletion barrier, with synthetic operation and
-- leased deletion step, follows the existing C10 native fixture discipline.
insert into public.account_deletion_operations(id,user_id,state,expires_at,idempotency_digest,capability_digest)
values('20000000-0000-4000-8000-000000000506','00000000-0000-4000-8000-000000000506',
  'running',clock_timestamp() + interval '1 day',repeat('6',64),repeat('c',64));
insert into public.account_deletion_barriers(user_id,operation_id,expires_at)
values('00000000-0000-4000-8000-000000000506','20000000-0000-4000-8000-000000000506',
  clock_timestamp() + interval '1 day');
update public.account_deletion_operations set publication_drain_started_at = now() - interval '6 minutes',
  publication_drained_at = now() - interval '6 minutes',publication_settle_not_before = now() - interval '1 minute'
where id = '20000000-0000-4000-8000-000000000506';
insert into public.account_deletion_steps(operation_id,step_name,step_order,status,lease_kind,claim_digest,lease_expires_at)
values('20000000-0000-4000-8000-000000000506','revenuecat_delete',20,'leased','dispatch',
  public._account_deletion_claim_digest(repeat('6',64)),clock_timestamp() + interval '1 hour');
do $$
declare race jsonb;
begin
  race := public.c10r2_pair('00000000-0000-4000-8000-000000000506',$query$
    select to_jsonb(result) from public.establish_revenuecat_deletion_identity_barrier(
      '20000000-0000-4000-8000-000000000506',repeat('6',64),1::smallint,
      array[encode(sha256(convert_to('synthetic-c10r2:00000000-0000-4000-8000-000000000506','UTF8')),'hex'),
        encode(sha256(convert_to('synthetic-c10r2:$RCAnonymousID:c10r2-native-deleted','UTF8')),'hex')],
      array['00000000-0000-4000-8000-000000000506','$RCAnonymousID:c10r2-native-deleted'],
      clock_timestamp() + interval '30 days') result
  $query$,$query$
    select public.c10r2_event(null,'c10r2-after-deletion','INITIAL_PURCHASE',interval '0 seconds',
      'c10r2-deleted-transaction',null,'$RCAnonymousID:c10r2-native-deleted')
  $query$,false,false);
  perform public.c10r2_assert(race #>> '{first,established}' = 'true'
    and race #>> '{second,outcome}' = 'suppressed_deleted_account'
    and not exists(select 1 from public.subscriptions_events where rc_event_id = 'c10r2-after-deletion')
    and not exists(select 1 from public.entitlements where user_id = '00000000-0000-4000-8000-000000000506'),
    'C10_R2_DELETION_RACE_PUBLISHED_SUPPRESSED_IDENTITY');
end;
$$;
select 'C10_R2_NATIVE_DELETION_WEBHOOK_PASS' as result;
select 'C10_R2_NATIVE_PUBLICATION_CONCURRENCY_PASS' as result;
