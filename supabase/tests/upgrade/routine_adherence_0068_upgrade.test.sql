\set ON_ERROR_STOP on

-- Forward-only 0067 -> 0068 data-cutover rehearsal. The local gate temporarily
-- withholds 0068, resets through the real 0067 history, seeds production-shaped
-- legacy rows, then executes the exact checked-in 0068 bytes below.
set client_min_messages = warning;
set search_path = extensions, public, pg_catalog;

set session_replication_role = replica;
insert into auth.users (id)
values ('68400000-0000-4000-8000-000000000001');
insert into auth.sessions (id, user_id)
values (
  '68410000-0000-4000-8000-000000000001',
  '68400000-0000-4000-8000-000000000001'
);
insert into public.profiles (id, current_streak, longest_streak)
values (
  '68400000-0000-4000-8000-000000000001',
  9,
  12
);
insert into public.health_processing_states (user_id, state, epoch)
values (
  '68400000-0000-4000-8000-000000000001',
  'unconsented',
  0
);
insert into public.routines (id, user_id, type, name)
values (
  '68420000-0000-4000-8000-000000000001',
  '68400000-0000-4000-8000-000000000001',
  'PM',
  '0068 legacy cutover fixture'
);
insert into public.routine_steps (id, routine_id, step_order)
values (
  '68430000-0000-4000-8000-000000000001',
  '68420000-0000-4000-8000-000000000001',
  1
);
insert into public.routine_completions (
  id,
  user_id,
  routine_id,
  step_id,
  completed_date
)
values
  (
    '68440000-0000-4000-8000-000000000001',
    '68400000-0000-4000-8000-000000000001',
    '68420000-0000-4000-8000-000000000001',
    '68430000-0000-4000-8000-000000000001',
    (pg_catalog.statement_timestamp() at time zone 'America/Toronto')::date
  ),
  (
    '68440000-0000-4000-8000-000000000002',
    '68400000-0000-4000-8000-000000000001',
    '68420000-0000-4000-8000-000000000001',
    null,
    (pg_catalog.statement_timestamp() at time zone 'America/Toronto')::date
  ),
  (
    '68440000-0000-4000-8000-000000000003',
    '68400000-0000-4000-8000-000000000001',
    '68420000-0000-4000-8000-000000000001',
    null,
    (pg_catalog.statement_timestamp() at time zone 'America/Toronto')::date - 2
  );
insert into public.streak_freezes (
  id,
  user_id,
  applied_for_date,
  source
)
values
  (
    '68450000-0000-4000-8000-000000000001',
    '68400000-0000-4000-8000-000000000001',
    (pg_catalog.statement_timestamp() at time zone 'America/Toronto')::date - 1,
    'legacy-client'
  ),
  (
    '68450000-0000-4000-8000-000000000002',
    '68400000-0000-4000-8000-000000000001',
    (pg_catalog.statement_timestamp() at time zone 'America/Toronto')::date - 3,
    'legacy-client'
  );
set session_replication_role = origin;

do $$
begin
  if not exists (
    select 1
      from public.profiles
     where id = '68400000-0000-4000-8000-000000000001'
       and current_streak = 9
       and longest_streak = 12
  ) or (
    select count(*)
      from public.streak_freezes
     where user_id = '68400000-0000-4000-8000-000000000001'
  ) <> 2 then
    raise exception 'CORE05_0068_LEGACY_FIXTURE_INVALID';
  end if;
end;
$$;

-- @@INCLUDE_EXACT_0068_MIGRATION@@

set search_path = extensions, public, pg_catalog;
select plan(8);

select results_eq(
  $$select current_streak, longest_streak, adherence_timezone,
      streak_reference_day, streak_algorithm_version
      from public.profiles
     where id = '68400000-0000-4000-8000-000000000001'$$,
  $$values (0::integer, 0::integer, null::text, null::date, 0::smallint)$$,
  '0068 atomically resets unverifiable legacy profile adherence'
);
select is(
  (
    select count(*)
      from public.streak_freezes
     where user_id = '68400000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  '0068 purges client-authored legacy freeze rows'
);
select results_eq(
  $$select count(*)::integer,
      count(*) filter (where step_id is null)::integer,
      count(*) filter (where step_id is not null)::integer
      from public.routine_completions
     where user_id = '68400000-0000-4000-8000-000000000001'$$,
  $$values (3::integer, 2::integer, 1::integer)$$,
  '0068 preserves both marker and partial legacy completion evidence'
);
select ok(
  not pg_catalog.has_table_privilege(
    'authenticated', 'public.routine_completions', 'UPDATE'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated', 'public.routine_completions', 'DELETE'
  )
  and not pg_catalog.has_table_privilege(
    'service_role', 'public.routine_completions', 'UPDATE'
  )
  and not pg_catalog.has_table_privilege(
    'service_role', 'public.routine_completions', 'DELETE'
  )
  and not pg_catalog.has_table_privilege(
    'service_role',
    'public.routine_completions',
    'TRUNCATE, REFERENCES, TRIGGER'
  )
  and not pg_catalog.has_table_privilege(
    'service_role',
    'public.streak_freezes',
    'TRUNCATE, REFERENCES, TRIGGER'
  )
  and not pg_catalog.has_table_privilege(
    'service_role', 'public.profiles', 'INSERT'
  )
  and not pg_catalog.has_table_privilege(
    'service_role', 'public.profiles', 'DELETE'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated', 'public.profiles', 'DELETE'
  ),
  '0068 seals adherence authority from direct API mutation and bypass DDL'
);
set session_replication_role = replica;
insert into auth.users (id)
values ('68400000-0000-4000-8000-000000000002');
insert into public.routines (id, user_id, type, name)
values (
  '68420000-0000-4000-8000-000000000002',
  '68400000-0000-4000-8000-000000000002',
  'PM',
  '0068 rejected cross-owner legacy fixture'
);
insert into public.routine_completions (
  id,
  user_id,
  routine_id,
  step_id,
  completed_date
)
values (
  '68440000-0000-4000-8000-000000000004',
  '68400000-0000-4000-8000-000000000001',
  '68420000-0000-4000-8000-000000000002',
  null,
  (pg_catalog.statement_timestamp() at time zone 'America/Toronto')::date - 1
);
set session_replication_role = origin;
select throws_ok(
  $$select private.assert_routine_completion_legacy_integrity()$$,
  '55000',
  'ROUTINE_COMPLETION_LEGACY_INTEGRITY_INVALID',
  'the cutover preflight fails closed on a cross-owner legacy marker'
);
set session_replication_role = replica;
delete from public.routine_completions
 where id = '68440000-0000-4000-8000-000000000004';
delete from public.routines
 where id = '68420000-0000-4000-8000-000000000002';
delete from auth.users
 where id = '68400000-0000-4000-8000-000000000002';
set session_replication_role = origin;

begin;
grant select on table public.profiles, public.streak_freezes
  to authenticated;
do $$
begin
  perform *
    from public.promote_health_consent_copy_for_release(
      'health_data_collection',
      'grant',
      'draft-v1-2026-07-10',
      '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd',
      'PGTAP-CORE05-0068-UPGRADE-2026-07-26',
      'pgtap.db-owner',
      repeat('b', 64)
    );
end;
$$;
update public.health_processing_states
   set state = 'active',
       epoch = 1,
       consent_version = 'draft-v1-2026-07-10',
       consent_text_hash =
         '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd',
       last_server_verified_at = pg_catalog.statement_timestamp()
 where user_id = '68400000-0000-4000-8000-000000000001';

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"68400000-0000-4000-8000-000000000001","role":"authenticated","session_id":"68410000-0000-4000-8000-000000000001"}',
  true
);
select pg_catalog.set_config(
  'request.headers',
  '{"x-health-processing-epoch":"1"}',
  true
);
select lives_ok(
  $$select * from public.set_routine_adherence_timezone('America/Toronto')$$,
  'the upgraded owner can configure exact timezone authority'
);
select results_eq(
  $$select current_streak, longest_streak, adherence_timezone,
      streak_reference_day, streak_algorithm_version
      from public.profiles
     where id = '68400000-0000-4000-8000-000000000001'$$,
  $$values (
      2::integer,
      2::integer,
      'America/Toronto'::text,
      (pg_catalog.statement_timestamp() at time zone 'America/Toronto')::date,
      1::smallint
    )$$,
  'only the two preserved routine markers restore authoritative adherence'
);
select results_eq(
  $$select applied_for_date, source
      from public.streak_freezes
     where user_id = '68400000-0000-4000-8000-000000000001'$$,
  $$values (
      (pg_catalog.statement_timestamp() at time zone 'America/Toronto')::date - 1,
      'auto'::text
    )$$,
  'the restored projection derives one automatic freeze and ignores the partial step'
);

reset role;
select * from finish();
rollback;
