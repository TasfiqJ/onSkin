\set ON_ERROR_STOP on

-- This file intentionally runs outside the structural pgTAP transaction.
-- Its committed fixtures must be visible to two independent dblink sessions.
-- The isolated DB05 sandbox is destroyed after verification.
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
set search_path = extensions, public, pg_catalog;
\ir generated/catalog-operator-dblink-target.inc

select plan(10);

do $$
declare
  v_host text := pg_catalog.current_setting('test.cat08_dblink_host', true);
  v_port text := pg_catalog.current_setting('test.cat08_dblink_port', true);
begin
  if v_host <> 'host.docker.internal'
     or v_port is null
     or v_port !~ '^[0-9]{4,5}$'
     or v_port::integer < 1024
     or v_port::integer > 65535
  then
    raise exception 'CAT08_REHEARSAL_DBLINK_TARGET_INVALID'
      using errcode = '42501';
  end if;
end;
$$;

update private.catalog_operator_runtime_control
set control_generation = 2,
    admission_state = 'open',
    environment = 'development',
    source_revision = repeat('a', 40),
    edge_deployment_id = 'local_cat08_race',
    reason_code = 'deployment_cutover',
    change_receipt_sha256 = repeat('b', 64),
    changed_at = pg_catalog.clock_timestamp() + interval '1 millisecond'
where singleton;

insert into auth.users (id, email, email_confirmed_at)
values
  (
    '65000000-0000-4000-8000-000000000001',
    'cat08-race-one@example.test',
    pg_catalog.clock_timestamp()
  ),
  (
    '65000000-0000-4000-8000-000000000002',
    'cat08-race-two@example.test',
    pg_catalog.clock_timestamp()
  ),
  ('65000000-0000-4000-8000-000000000003', null, null),
  ('65000000-0000-4000-8000-000000000004', null, null);

insert into auth.mfa_factors (
  id, user_id, friendly_name, factor_type, status,
  created_at, updated_at, secret
)
values
  (
    '65100000-0000-4000-8000-000000000001',
    '65000000-0000-4000-8000-000000000001',
    'cat08-race-one',
    'totp',
    'verified',
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp(),
    null
  ),
  (
    '65100000-0000-4000-8000-000000000002',
    '65000000-0000-4000-8000-000000000002',
    'cat08-race-two',
    'totp',
    'verified',
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp(),
    null
  );

insert into auth.sessions (
  id, user_id, created_at, updated_at, factor_id, aal, not_after
)
values
  (
    '65200000-0000-4000-8000-000000000001',
    '65000000-0000-4000-8000-000000000001',
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp(),
    '65100000-0000-4000-8000-000000000001',
    'aal2',
    pg_catalog.clock_timestamp() + interval '1 hour'
  ),
  (
    '65200000-0000-4000-8000-000000000002',
    '65000000-0000-4000-8000-000000000002',
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp(),
    '65100000-0000-4000-8000-000000000002',
    'aal2',
    pg_catalog.clock_timestamp() + interval '1 hour'
  );

do $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  insert into private.catalog_operator_grant_attestations (
    id, operator_user_id, attested_by_user_id,
    authority_receipt_sha256, evidence_sha256,
    attested_at, valid_until
  )
  values
    (
      '65300000-0000-4000-8000-000000000001',
      '65000000-0000-4000-8000-000000000001',
      '65000000-0000-4000-8000-000000000003',
      private.catalog_operator_sha256(
        '{"actor":"race-one","kind":"authority"}'::jsonb
      ),
      private.catalog_operator_sha256(
        '{"actor":"race-one","kind":"evidence"}'::jsonb
      ),
      v_now,
      v_now + interval '1 day'
    ),
    (
      '65300000-0000-4000-8000-000000000002',
      '65000000-0000-4000-8000-000000000002',
      '65000000-0000-4000-8000-000000000003',
      private.catalog_operator_sha256(
        '{"actor":"race-two","kind":"authority"}'::jsonb
      ),
      private.catalog_operator_sha256(
        '{"actor":"race-two","kind":"evidence"}'::jsonb
      ),
      v_now,
      v_now + interval '1 day'
    );

  insert into private.catalog_operator_grants (
    id, operator_user_id, attestation_id, issued_by_user_id,
    issued_at, valid_from, valid_until, grant_sha256
  )
  values
    (
      '65400000-0000-4000-8000-000000000001',
      '65000000-0000-4000-8000-000000000001',
      '65300000-0000-4000-8000-000000000001',
      '65000000-0000-4000-8000-000000000004',
      v_now,
      v_now,
      v_now + interval '1 day',
      private.catalog_operator_grant_sha256(
        '65000000-0000-4000-8000-000000000001',
        '65300000-0000-4000-8000-000000000001',
        '65000000-0000-4000-8000-000000000004',
        v_now,
        v_now,
        v_now + interval '1 day'
      )
    ),
    (
      '65400000-0000-4000-8000-000000000002',
      '65000000-0000-4000-8000-000000000002',
      '65300000-0000-4000-8000-000000000002',
      '65000000-0000-4000-8000-000000000004',
      v_now,
      v_now,
      v_now + interval '1 day',
      private.catalog_operator_grant_sha256(
        '65000000-0000-4000-8000-000000000002',
        '65300000-0000-4000-8000-000000000002',
        '65000000-0000-4000-8000-000000000004',
        v_now,
        v_now,
        v_now + interval '1 day'
      )
    );

  insert into private.catalog_operator_capability_bindings (
    grant_id, capability, bound_at, binding_sha256
  )
  values
    (
      '65400000-0000-4000-8000-000000000001',
      'correction_queue_read',
      v_now,
      private.catalog_operator_binding_sha256(
        '65400000-0000-4000-8000-000000000001',
        'correction_queue_read',
        v_now
      )
    ),
    (
      '65400000-0000-4000-8000-000000000002',
      'correction_queue_read',
      v_now,
      private.catalog_operator_binding_sha256(
        '65400000-0000-4000-8000-000000000002',
        'correction_queue_read',
        v_now
      )
    );
end;
$$;

create temporary table cat08_session_results (
  established_count bigint not null
) on commit preserve rows;
grant insert, select on table pg_temp.cat08_session_results
  to catalog_operator_edge;

-- The deployed gateway role must remain membership-free. Supabase CLI runs
-- this isolated rehearsal as the fixed local `postgres` role, which is not a
-- superuser; add only a bounded test-harness SET ROLE lane after proving the
-- migrated role has no inherited membership. The isolated sandbox is destroyed
-- after verification, and the grant is explicitly revoked before finish().
do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_auth_members as membership
    inner join pg_catalog.pg_roles as edge_role
      on edge_role.oid = membership.roleid
    where edge_role.rolname = 'catalog_operator_edge'
  ) then
    raise exception 'CAT08_REHEARSAL_EDGE_MEMBERSHIP_DRIFT'
      using errcode = '42501';
  end if;
end;
$$;
grant catalog_operator_edge to postgres;

set role catalog_operator_edge;
insert into pg_temp.cat08_session_results (established_count)
select count(*)
from catalog_operator_gateway.catalog_operator_session(
  '65200000-0000-4000-8000-000000000001',
  'development', repeat('a', 40), 'local_cat08_race', 2, 'session'
);
reset role;

-- dblink refuses passwordless connections for the intentionally nonsuperuser
-- local runner, while PostgreSQL also prevents that runner from altering its
-- own privileged-role password. Create one isolated, unprivileged login with a
-- session-generated credential and a narrowly caller-bound SECURITY DEFINER
-- controller helper. The rehearsal is the final DB05 step, the credential is
-- never emitted, and cleanup destroys the sandbox even on failure. Drop the
-- helper and login explicitly after disconnecting as defense in depth.
select pg_catalog.set_config(
  'test.cat08_dblink_password',
  pg_catalog.encode(extensions.gen_random_bytes(32), 'hex'),
  false
);
do $$
begin
  if current_user <> 'postgres' then
    raise exception 'CAT08_REHEARSAL_RUNNER_ROLE_INVALID'
      using errcode = '42501';
  end if;
  if exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'cat08_rehearsal_connection'
  ) then
    raise exception 'CAT08_REHEARSAL_CONNECTION_ROLE_DRIFT'
      using errcode = '42501';
  end if;
  execute pg_catalog.format(
    'create role cat08_rehearsal_connection login nosuperuser noinherit ' ||
      'nocreatedb nocreaterole noreplication nobypassrls connection limit 2 password %L',
    pg_catalog.current_setting('test.cat08_dblink_password')
  );
end;
$$;
grant catalog_operator_edge to cat08_rehearsal_connection;
grant usage on schema catalog_operator_gateway to cat08_rehearsal_connection;

create function catalog_operator_gateway.cat08_rehearsal_revoke_then_latch(
  p_grant_id uuid,
  p_latch_key bigint
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if session_user <> 'cat08_rehearsal_connection' then
    raise exception 'CAT08_REHEARSAL_CONNECTION_CALLER_INVALID'
      using errcode = '42501';
  end if;

  insert into private.catalog_operator_grant_revocations (
    grant_id,
    revoked_by_user_id,
    reason_code,
    evidence_sha256,
    revoked_at
  ) values (
    p_grant_id,
    '65000000-0000-4000-8000-000000000004',
    'security_response',
    repeat('d', 64),
    pg_catalog.clock_timestamp() + interval '1 day'
  );
  if p_latch_key is not null then
    perform pg_catalog.pg_advisory_xact_lock(p_latch_key);
  end if;
  return 'revoked';
end;
$$;
revoke all on function
  catalog_operator_gateway.cat08_rehearsal_revoke_then_latch(uuid, bigint)
  from public, anon, authenticated, service_role, catalog_operator_edge;
grant execute on function
  catalog_operator_gateway.cat08_rehearsal_revoke_then_latch(uuid, bigint)
  to cat08_rehearsal_connection;

select is(
  (select established_count from pg_temp.cat08_session_results),
  1::bigint,
  'race actor one establishes a real database operator session'
);

create or replace function pg_temp.cat08_wait_for_activity(
  p_application_name text,
  p_wait_event_type text,
  p_wait_event text default null,
  p_blocker_application_name text default null
)
returns boolean
language plpgsql
volatile
set search_path = ''
as $$
begin
  for v_attempt in 1..200 loop
    if exists (
      select 1
      from pg_catalog.pg_stat_activity as activity
      where activity.application_name = p_application_name
        and activity.wait_event_type = p_wait_event_type
        and (
          p_wait_event is null
          or activity.wait_event = p_wait_event
        )
        and (
          p_blocker_application_name is null
          or exists (
            select 1
            from pg_catalog.pg_stat_activity as blocker
            where blocker.application_name = p_blocker_application_name
              and blocker.pid = any(pg_catalog.pg_blocking_pids(activity.pid))
          )
        )
    ) then
      return true;
    end if;
    perform pg_catalog.pg_sleep(0.01);
  end loop;
  return false;
end;
$$;

select extensions.dblink_connect(
  'cat08_race_a',
  'dbname=' || pg_catalog.current_database() ||
    ' host=' ||
    pg_catalog.current_setting('test.cat08_dblink_host') ||
    ' port=' ||
    pg_catalog.current_setting('test.cat08_dblink_port') ||
    ' user=cat08_rehearsal_connection password=' ||
    pg_catalog.current_setting('test.cat08_dblink_password') ||
    ' options=''-c application_name=cat08_race_a -c statement_timeout=5000'''
);
select extensions.dblink_connect(
  'cat08_race_b',
  'dbname=' || pg_catalog.current_database() ||
    ' host=' ||
    pg_catalog.current_setting('test.cat08_dblink_host') ||
    ' port=' ||
    pg_catalog.current_setting('test.cat08_dblink_port') ||
    ' user=cat08_rehearsal_connection password=' ||
    pg_catalog.current_setting('test.cat08_dblink_password') ||
    ' options=''-c application_name=cat08_race_b -c statement_timeout=5000'''
);

select extensions.dblink_exec(
  'cat08_race_a',
  $remote$
    create or replace function pg_temp.cat08_queue_then_latch(
      p_auth_session_id uuid,
      p_latch_key bigint
    )
    returns text
    language plpgsql
    volatile
    security invoker
    set search_path = ''
    as $function$
    begin
      perform *
      from catalog_operator_gateway.catalog_operator_queue(
        p_auth_session_id,
        'development',
        repeat('a', 40),
        'local_cat08_race',
        2,
        'correction',
        null,
        null,
        25
      );
      if p_latch_key is not null then
        perform pg_catalog.pg_advisory_xact_lock(p_latch_key);
      end if;
      return 'ok';
    exception
      when others then
        return sqlstate || ':' || sqlerrm;
    end;
    $function$;

    create or replace function pg_temp.cat08_session_then_latch(
      p_auth_session_id uuid,
      p_latch_key bigint
    )
    returns text
    language plpgsql
    volatile
    security invoker
    set search_path = ''
    as $function$
    begin
      perform *
      from catalog_operator_gateway.catalog_operator_session(
        p_auth_session_id,
        'development',
        repeat('a', 40),
        'local_cat08_race',
        2,
        'session'
      );
      if p_latch_key is not null then
        perform pg_catalog.pg_advisory_xact_lock(p_latch_key);
      end if;
      return 'ok';
    exception
      when others then
        return sqlstate || ':' || sqlerrm;
    end;
    $function$;
  $remote$
);
select extensions.dblink_exec(
  'cat08_race_a',
  'set role catalog_operator_edge'
);
select extensions.dblink_exec(
  'cat08_race_b',
  $remote$
    create or replace function pg_temp.cat08_revoke_then_latch(
      p_grant_id uuid,
      p_latch_key bigint
    )
    returns text
    language plpgsql
    volatile
    security invoker
    set search_path = ''
    as $function$
    begin
      return catalog_operator_gateway.cat08_rehearsal_revoke_then_latch(
        p_grant_id,
        p_latch_key
      );
    end;
    $function$;
  $remote$
);

-- Action-first: the successful action owns the grant row lock; revocation
-- waits and linearizes after that action commits.
do $$
begin
  perform pg_catalog.pg_advisory_lock(820801);
end;
$$;
select extensions.dblink_send_query(
  'cat08_race_a',
  $$select pg_temp.cat08_queue_then_latch(
    '65200000-0000-4000-8000-000000000001',
    820801
  )$$
);
select ok(
  pg_temp.cat08_wait_for_activity(
    'cat08_race_a',
    'Lock',
    'advisory'
  ),
  'action-first worker reaches its controller-held transaction latch'
);
select extensions.dblink_send_query(
  'cat08_race_b',
  $$select pg_temp.cat08_revoke_then_latch(
    '65400000-0000-4000-8000-000000000001',
    null
  )$$
);
select ok(
  pg_temp.cat08_wait_for_activity(
    'cat08_race_b',
    'Lock',
    'transactionid',
    'cat08_race_a'
  ),
  'revocation waits behind the authorized action grant-row lock'
);
do $$
begin
  if not pg_catalog.pg_advisory_unlock(820801) then
    raise exception 'CAT08_ACTION_LATCH_NOT_HELD';
  end if;
end;
$$;
select is(
  (
    select (pg_catalog.array_agg(result))[1]
    from extensions.dblink_get_result(
      'cat08_race_a'
    ) as result(result text)
  ),
  'ok',
  'the action that won the lock order commits before revocation'
);
select *
from extensions.dblink_get_result(
  'cat08_race_a'
) as drained(result text);
select is(
  (
    select (pg_catalog.array_agg(result))[1]
    from extensions.dblink_get_result(
      'cat08_race_b'
    ) as result(result text)
  ),
  'revoked',
  'the waiting revocation commits immediately after the winning action'
);
select *
from extensions.dblink_get_result(
  'cat08_race_b'
) as drained(result text);

select is(
  (
    select result
    from extensions.dblink(
      'cat08_race_a',
      $$select pg_temp.cat08_queue_then_latch(
        '65200000-0000-4000-8000-000000000001',
        null
      )$$
    ) as result(result text)
  ),
  '42501:CATALOG_OPERATOR_CAPABILITY_DENIED',
  'every later action observes the committed revocation'
);

-- Revocation-first: the FK key-share lock is acquired before the sleep. The
-- real session-establishment request must wait, then re-read and deny after
-- revocation commits.
do $$
begin
  perform pg_catalog.pg_advisory_lock(820802);
end;
$$;
select extensions.dblink_send_query(
  'cat08_race_b',
  $$select pg_temp.cat08_revoke_then_latch(
    '65400000-0000-4000-8000-000000000002',
    820802
  )$$
);
select ok(
  pg_temp.cat08_wait_for_activity(
    'cat08_race_b',
    'Lock',
    'advisory'
  ),
  'revocation-first worker reaches its controller-held transaction latch'
);
select extensions.dblink_send_query(
  'cat08_race_a',
  $$select pg_temp.cat08_session_then_latch(
    '65200000-0000-4000-8000-000000000002',
    null
  )$$
);
select ok(
  pg_temp.cat08_wait_for_activity(
    'cat08_race_a',
    'Lock',
    'transactionid',
    'cat08_race_b'
  ),
  'the real session request waits behind the uncommitted revocation'
);
do $$
begin
  if not pg_catalog.pg_advisory_unlock(820802) then
    raise exception 'CAT08_REVOCATION_LATCH_NOT_HELD';
  end if;
end;
$$;
select is(
  (
    select (pg_catalog.array_agg(result))[1]
    from extensions.dblink_get_result(
      'cat08_race_b'
    ) as result(result text)
  ),
  'revoked',
  'revocation-first worker commits its incident fence'
);
select *
from extensions.dblink_get_result(
  'cat08_race_b'
) as drained(result text);
select is(
  (
    select (pg_catalog.array_agg(result))[1]
    from extensions.dblink_get_result(
      'cat08_race_a'
    ) as result(result text)
  ),
  '42501:CATALOG_OPERATOR_GRANT_REQUIRED',
  'the waiting session request refreshes authority and fails closed'
);
select *
from extensions.dblink_get_result(
  'cat08_race_a'
) as drained(result text);

select extensions.dblink_disconnect('cat08_race_a');
select extensions.dblink_disconnect('cat08_race_b');

revoke execute on function
  catalog_operator_gateway.cat08_rehearsal_revoke_then_latch(uuid, bigint)
  from cat08_rehearsal_connection;
drop function
  catalog_operator_gateway.cat08_rehearsal_revoke_then_latch(uuid, bigint);
revoke usage on schema catalog_operator_gateway
  from cat08_rehearsal_connection;
revoke catalog_operator_edge from cat08_rehearsal_connection;
drop role cat08_rehearsal_connection;
select pg_catalog.set_config('test.cat08_dblink_password', '', false);
revoke catalog_operator_edge from postgres;
select pg_catalog.set_config('test.cat08_dblink_host', '', false);
select pg_catalog.set_config('test.cat08_dblink_port', '', false);

update private.catalog_operator_runtime_control
set control_generation = 3,
    admission_state = 'frozen',
    reason_code = 'incident_freeze',
    change_receipt_sha256 = repeat('e', 64),
    changed_at = pg_catalog.clock_timestamp() + interval '1 millisecond'
where singleton;

select * from finish();
