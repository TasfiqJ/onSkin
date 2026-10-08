begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(78);

select is(
  (select count(*) from supabase_migrations.schema_migrations),
  95::bigint,
  'CORE-05 adherence runs against the exact 95-migration source history'
);
select is(
  (select max(version) from supabase_migrations.schema_migrations),
  '20261007000079'::text,
  'the migration history retains adherence authority through the current head'
);
select results_eq(
  $$select column_name::text collate "C"
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name in (
         'adherence_timezone',
         'streak_reference_day',
         'streak_algorithm_version'
       )
     order by column_name$$,
  $$values
      ('adherence_timezone'::text collate "C"),
      ('streak_algorithm_version'::text collate "C"),
      ('streak_reference_day'::text collate "C")$$,
  'profiles contains the exact timezone and dated/versioned cache fields'
);
select ok(
  exists (
    select 1
      from pg_catalog.pg_constraint as con
     where con.conrelid = 'public.profiles'::regclass
       and con.conname = 'profiles_adherence_projection_check'
       and con.convalidated
  ),
  'the profile projection coherence check is validated'
);
select ok(
  exists (
    select 1
      from pg_catalog.pg_constraint as con
     where con.conrelid = 'public.streak_freezes'::regclass
       and con.conname = 'streak_freezes_source_auto_check'
       and con.convalidated
  ),
  'freeze source is constrained to the automatic server projection'
);
select ok(
  pg_catalog.pg_get_functiondef(
    'private.assert_routine_completion_legacy_integrity()'::regprocedure
  ) ilike '%routines.user_id IS DISTINCT FROM completions.user_id%'
  and pg_catalog.pg_get_functiondef(
    'private.assert_routine_completion_legacy_integrity()'::regprocedure
  ) ilike '%steps.routine_id IS DISTINCT FROM completions.routine_id%',
  'the cutover preflight rejects cross-owner routines and cross-routine steps'
);

select ok(
  private.routine_adherence_timezone_is_valid('America/Toronto'),
  'an exact catalog timezone is valid'
);
select ok(
  not private.routine_adherence_timezone_is_valid('america/toronto'),
  'timezone matching is exact and case-sensitive'
);
select throws_ok(
  $$select private.routine_adherence_reference_day(
      'Not/A_Real_Zone', pg_catalog.statement_timestamp()
    )$$,
  '22023',
  'ROUTINE_ADHERENCE_TIMEZONE_INVALID',
  'an unknown timezone fails closed'
);
select is(
  private.routine_adherence_reference_day(
    'America/Toronto', '2026-03-08 04:30:00+00'::timestamptz
  ),
  '2026-03-07'::date,
  'the reference day is correct immediately before the Toronto DST boundary'
);
select is(
  private.routine_adherence_reference_day(
    'America/Toronto', '2026-03-08 05:30:00+00'::timestamptz
  ),
  '2026-03-08'::date,
  'the reference day crosses local midnight independently of the DST jump'
);
select is(
  private.routine_adherence_reference_day(
    'Pacific/Kiritimati', '2025-12-31 10:30:00+00'::timestamptz
  ),
  '2026-01-01'::date,
  'the reference day crosses the local year boundary'
);
select is(
  private.routine_adherence_reference_day(
    'America/Los_Angeles', '2024-03-01 07:30:00+00'::timestamptz
  ),
  '2024-02-29'::date,
  'the reference day preserves a leap day'
);

select results_eq(
  $$select * from private.project_routine_adherence(
      '{}'::date[], '2026-06-13'::date
    )$$,
  $$values (0::integer, 0::integer, '{}'::date[], false)$$,
  'an empty completion log is new, not lapsed'
);
select results_eq(
  $$select * from private.project_routine_adherence(
      array['2026-06-14'::date], '2026-06-13'::date
    )$$,
  $$values (0::integer, 0::integer, '{}'::date[], false)$$,
  'a future tolerance row is excluded from both cache and lapse truth'
);
select results_eq(
  $$select * from private.project_routine_adherence(
      array['2026-06-11'::date, '2026-06-12'::date, '2026-06-13'::date],
      '2026-06-13'::date
    )$$,
  $$values (3::integer, 3::integer, '{}'::date[], false)$$,
  'three consecutive routine days project a three-day current and best streak'
);
select results_eq(
  $$select * from private.project_routine_adherence(
      array['2026-06-10'::date, '2026-06-11'::date, '2026-06-12'::date],
      '2026-06-13'::date
    )$$,
  $$values (3::integer, 3::integer, '{}'::date[], false)$$,
  'today is neutral when yesterday completed a clean run'
);
select results_eq(
  $$select * from private.project_routine_adherence(
      array[
        '2026-06-08'::date, '2026-06-09'::date, '2026-06-10'::date,
        '2026-06-11'::date, '2026-06-13'::date
      ],
      '2026-06-13'::date
    )$$,
  $$values (5::integer, 5::integer, array['2026-06-12'::date], false)$$,
  'one interior miss becomes one current server freeze'
);
select results_eq(
  $$select * from private.project_routine_adherence(
      array['2026-06-06'::date, '2026-06-08'::date, '2026-06-10'::date],
      '2026-06-10'::date
    )$$,
  $$values (
      3::integer,
      3::integer,
      array['2026-06-09'::date, '2026-06-07'::date],
      false
    )$$,
  'two separated misses consume the total two-freeze budget'
);
select results_eq(
  $$select * from private.project_routine_adherence(
      array[
        '2026-06-04'::date, '2026-06-06'::date,
        '2026-06-08'::date, '2026-06-10'::date
      ],
      '2026-06-10'::date
    )$$,
  $$values (
      3::integer,
      3::integer,
      array['2026-06-09'::date, '2026-06-07'::date],
      false
    )$$,
  'a third total miss cuts off the older completion from current and best runs'
);
select results_eq(
  $$select * from private.project_routine_adherence(
      array['2026-06-09'::date, '2026-06-13'::date],
      '2026-06-13'::date
    )$$,
  $$values (1::integer, 1::integer, '{}'::date[], false)$$,
  'a three-day interior gap resets to the newest completion without fake freezes'
);
select results_eq(
  $$select * from private.project_routine_adherence(
      array['2026-06-05'::date], '2026-06-13'::date
    )$$,
  $$values (0::integer, 1::integer, '{}'::date[], true)$$,
  'an old completion outside the forgiveness window is truthfully lapsed'
);
select results_eq(
  $$select * from private.project_routine_adherence(
      array[
        '2026-05-01'::date, '2026-05-02'::date, '2026-05-04'::date,
        '2026-05-05'::date, '2026-05-06'::date, '2026-06-10'::date,
        '2026-06-11'::date
      ],
      '2026-06-13'::date
    )$$,
  $$values (
      2::integer,
      5::integer,
      array['2026-06-12'::date],
      false
    )$$,
  'best remains the longest forgiving historical run while current is shorter'
);
select results_eq(
  $$select * from private.project_routine_adherence(
      array[
        '2026-06-12'::date, '2026-06-12'::date,
        '2026-06-13'::date, '2026-06-14'::date
      ],
      '2026-06-13'::date
    )$$,
  $$values (2::integer, 2::integer, '{}'::date[], false)$$,
  'duplicate and future dates cannot inflate the projection'
);

-- CORE05_PARITY_CORPUS_SHA256: cbcfe0a13f1ef878f8769c875e9fb5b49fdcf667e723b4d918bc46889144fa00
select results_eq(
  $$
    with corpus as (
      select
        $parity${"schemaVersion":1,"canonicalFrozenDateOrder":"newest_to_oldest","cases":[{"id":"separated_misses","completedDates":["2026-06-06","2026-06-08","2026-06-10"],"referenceDay":"2026-06-10","expected":{"current":3,"best":3,"frozenDates":["2026-06-09","2026-06-07"],"lapsed":false}},{"id":"today_neutral_trailing_gap","completedDates":["2026-06-07"],"referenceDay":"2026-06-10","expected":{"current":1,"best":1,"frozenDates":["2026-06-09","2026-06-08"],"lapsed":false}},{"id":"future_only","completedDates":["2026-06-11"],"referenceDay":"2026-06-10","expected":{"current":0,"best":0,"frozenDates":[],"lapsed":false}},{"id":"empty_new","completedDates":[],"referenceDay":"2026-06-10","expected":{"current":0,"best":0,"frozenDates":[],"lapsed":false}},{"id":"lapsed","completedDates":["2026-06-01"],"referenceDay":"2026-06-10","expected":{"current":0,"best":1,"frozenDates":[],"lapsed":true}},{"id":"dst_date_boundary","completedDates":["2026-03-07","2026-03-08","2026-03-09"],"referenceDay":"2026-03-09","expected":{"current":3,"best":3,"frozenDates":[],"lapsed":false}},{"id":"duplicates_and_future","completedDates":["2026-06-09","2026-06-09","2026-06-10","2026-06-11"],"referenceDay":"2026-06-10","expected":{"current":2,"best":2,"frozenDates":[],"lapsed":false}},{"id":"best_preservation_projection","completedDates":["2026-05-01","2026-05-02","2026-05-04","2026-05-05","2026-05-06","2026-06-10","2026-06-11"],"referenceDay":"2026-06-13","expected":{"current":2,"best":5,"frozenDates":["2026-06-12"],"lapsed":false}},{"id":"bounded_current_scan","completedDateRange":{"start":"2024-06-09","end":"2026-06-10"},"referenceDay":"2026-06-10","expected":{"current":731,"best":732,"frozenDates":[],"lapsed":false}}]}$parity$::jsonb
          as document
    ),
    cases as (
      select item
        from corpus
        cross join lateral pg_catalog.jsonb_array_elements(
          corpus.document -> 'cases'
        ) as entries(item)
    ),
    inputs as (
      select
        item ->> 'id' as id,
        case
          when item ? 'completedDates' then array(
            select value::date
              from pg_catalog.jsonb_array_elements_text(
                item -> 'completedDates'
              ) as dates(value)
          )
          else array(
            select generated_day::date
              from pg_catalog.generate_series(
                (item #>> '{completedDateRange,start}')::date,
                (item #>> '{completedDateRange,end}')::date,
                interval '1 day'
              ) as generated(generated_day)
          )
        end as completed_dates,
        (item ->> 'referenceDay')::date as reference_day
        from cases
    )
    select
      inputs.id,
      projection.projected_current_streak,
      projection.projected_best_streak,
      projection.projected_frozen_dates,
      projection.projected_lapsed
      from inputs
      cross join lateral private.project_routine_adherence(
        inputs.completed_dates,
        inputs.reference_day
      ) as projection
     order by inputs.id
  $$,
  $$
    with corpus as (
      select
        $parity${"schemaVersion":1,"canonicalFrozenDateOrder":"newest_to_oldest","cases":[{"id":"separated_misses","completedDates":["2026-06-06","2026-06-08","2026-06-10"],"referenceDay":"2026-06-10","expected":{"current":3,"best":3,"frozenDates":["2026-06-09","2026-06-07"],"lapsed":false}},{"id":"today_neutral_trailing_gap","completedDates":["2026-06-07"],"referenceDay":"2026-06-10","expected":{"current":1,"best":1,"frozenDates":["2026-06-09","2026-06-08"],"lapsed":false}},{"id":"future_only","completedDates":["2026-06-11"],"referenceDay":"2026-06-10","expected":{"current":0,"best":0,"frozenDates":[],"lapsed":false}},{"id":"empty_new","completedDates":[],"referenceDay":"2026-06-10","expected":{"current":0,"best":0,"frozenDates":[],"lapsed":false}},{"id":"lapsed","completedDates":["2026-06-01"],"referenceDay":"2026-06-10","expected":{"current":0,"best":1,"frozenDates":[],"lapsed":true}},{"id":"dst_date_boundary","completedDates":["2026-03-07","2026-03-08","2026-03-09"],"referenceDay":"2026-03-09","expected":{"current":3,"best":3,"frozenDates":[],"lapsed":false}},{"id":"duplicates_and_future","completedDates":["2026-06-09","2026-06-09","2026-06-10","2026-06-11"],"referenceDay":"2026-06-10","expected":{"current":2,"best":2,"frozenDates":[],"lapsed":false}},{"id":"best_preservation_projection","completedDates":["2026-05-01","2026-05-02","2026-05-04","2026-05-05","2026-05-06","2026-06-10","2026-06-11"],"referenceDay":"2026-06-13","expected":{"current":2,"best":5,"frozenDates":["2026-06-12"],"lapsed":false}},{"id":"bounded_current_scan","completedDateRange":{"start":"2024-06-09","end":"2026-06-10"},"referenceDay":"2026-06-10","expected":{"current":731,"best":732,"frozenDates":[],"lapsed":false}}]}$parity$::jsonb
          as document
    ),
    cases as (
      select item
        from corpus
        cross join lateral pg_catalog.jsonb_array_elements(
          corpus.document -> 'cases'
        ) as entries(item)
    )
    select
      item ->> 'id',
      (item #>> '{expected,current}')::integer,
      (item #>> '{expected,best}')::integer,
      array(
        select value::date
          from pg_catalog.jsonb_array_elements_text(
            item #> '{expected,frozenDates}'
          ) as frozen_dates(value)
      ),
      (item #>> '{expected,lapsed}')::boolean
      from cases
     order by item ->> 'id'
  $$,
  'the hashed parity corpus matches the authoritative SQL projection'
);

select is(
  (
    select count(*)
      from pg_catalog.pg_policies as policy
       where policy.schemaname = 'public'
         and policy.tablename = 'streak_freezes'
         and policy.cmd = 'INSERT'
         and policy.permissive = 'PERMISSIVE'
  ),
  0::bigint,
  'no authenticated freeze INSERT policy remains'
);
select ok(
  not pg_catalog.has_table_privilege(
    'authenticated', 'public.streak_freezes', 'INSERT'
  ),
  'authenticated has no direct freeze INSERT privilege'
);
select ok(
  not pg_catalog.has_table_privilege(
    'service_role', 'public.streak_freezes', 'INSERT'
  ),
  'service_role has no direct freeze INSERT privilege'
);
select ok(
  not pg_catalog.has_table_privilege(
    'authenticated', 'public.profiles', 'UPDATE'
  ),
  'authenticated has no table-wide profile UPDATE privilege'
);
select ok(
  pg_catalog.has_column_privilege(
    'authenticated', 'public.profiles', 'display_name', 'UPDATE'
  )
  and pg_catalog.has_column_privilege(
    'authenticated', 'public.profiles', 'avatar_path', 'UPDATE'
  )
  and pg_catalog.has_column_privilege(
    'authenticated', 'public.profiles', 'locale', 'UPDATE'
  )
  and pg_catalog.has_column_privilege(
    'authenticated', 'public.profiles', 'units', 'UPDATE'
  ),
  'authenticated retains only the four intended profile-shell update lanes'
);
select ok(
  not pg_catalog.has_column_privilege(
    'authenticated', 'public.profiles', 'current_streak', 'UPDATE'
  )
  and not pg_catalog.has_column_privilege(
    'authenticated', 'public.profiles', 'longest_streak', 'UPDATE'
  )
  and not pg_catalog.has_column_privilege(
    'authenticated', 'public.profiles', 'adherence_timezone', 'UPDATE'
  )
  and not pg_catalog.has_column_privilege(
    'authenticated', 'public.profiles', 'streak_reference_day', 'UPDATE'
  )
  and not pg_catalog.has_column_privilege(
    'authenticated', 'public.profiles', 'streak_algorithm_version', 'UPDATE'
  ),
  'authenticated has no UPDATE privilege on any adherence projection column'
);
select ok(
  not pg_catalog.has_table_privilege(
    'service_role', 'public.profiles', 'UPDATE'
  )
  and not pg_catalog.has_table_privilege(
    'service_role', 'public.profiles', 'DELETE'
  )
  and not pg_catalog.has_table_privilege(
    'service_role', 'public.profiles', 'INSERT'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated', 'public.profiles', 'DELETE'
  ),
  'API roles cannot delete profiles and service_role cannot insert or mutate profile authority'
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
  ),
  'API roles cannot mutate or directly delete append-only completion evidence'
);
select ok(
  not pg_catalog.has_table_privilege(
    'authenticated', 'public.profiles', 'TRUNCATE, REFERENCES, TRIGGER'
  )
  and not pg_catalog.has_table_privilege(
    'service_role', 'public.profiles', 'TRUNCATE, REFERENCES, TRIGGER'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated',
    'public.routine_completions',
    'TRUNCATE, REFERENCES, TRIGGER'
  )
  and not pg_catalog.has_table_privilege(
    'service_role',
    'public.routine_completions',
    'TRUNCATE, REFERENCES, TRIGGER'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated', 'public.streak_freezes', 'TRUNCATE, REFERENCES, TRIGGER'
  )
  and not pg_catalog.has_table_privilege(
    'service_role', 'public.streak_freezes', 'TRUNCATE, REFERENCES, TRIGGER'
  ),
  'API roles cannot truncate or install dependency and trigger bypasses on adherence authority tables'
);
select ok(
  exists (
    select 1
      from pg_catalog.pg_trigger as trigger
     where trigger.tgrelid = 'public.routine_completions'::regclass
       and trigger.tgname = 'trg_routine_completion_immutable'
       and not trigger.tgisinternal
  )
  and pg_catalog.pg_get_functiondef(
    'private.reject_routine_completion_update()'::regprocedure
  ) ilike '%ROUTINE_COMPLETION_IMMUTABLE%',
  'owner-level completion updates are rejected by an immutable-evidence trigger'
);
select ok(
  pg_catalog.has_function_privilege(
    'authenticated', 'public.set_routine_adherence_timezone(text)', 'EXECUTE'
  ),
  'authenticated may call the owner-derived timezone setter'
);
select ok(
  not pg_catalog.has_function_privilege(
    'anon', 'public.set_routine_adherence_timezone(text)', 'EXECUTE'
  ),
  'anon cannot call the timezone setter'
);
select ok(
  not pg_catalog.has_function_privilege(
    'service_role', 'public.set_routine_adherence_timezone(text)', 'EXECUTE'
  ),
  'service_role cannot impersonate the timezone setter'
);
select ok(
  pg_catalog.has_function_privilege(
    'authenticated', 'public.refresh_routine_adherence()', 'EXECUTE'
  ),
  'authenticated may refresh only its own dated cache'
);
select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'private.recompute_routine_adherence(uuid,text,timestamptz)',
    'EXECUTE'
  ),
  'authenticated cannot supply an owner, timezone, or clock to the private writer'
);
select ok(
  not pg_catalog.has_function_privilege(
    'authenticated', 'public.recompute_streak(uuid)', 'EXECUTE'
  ),
  'authenticated cannot invoke the historical owner-parameterized recompute function'
);
select ok(
  not exists (
    select 1
      from pg_catalog.pg_policy as policy
     where policy.polrelid = 'public.routine_completions'::regclass
       and policy.polname = 'routine_completions_insert_own'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated', 'public.routine_completions', 'INSERT'
  ),
  'the current sync bridge removes direct completion policy and INSERT authority'
);
select ok(
  pg_catalog.pg_get_functiondef('public.validate_completion()'::regprocedure)
    ilike '%routine_adherence_reference_day%'
  and pg_catalog.pg_get_functiondef('public.validate_completion()'::regprocedure)
    ilike '%steps.routine_id = new.routine_id%'
  and pg_catalog.pg_get_functiondef('public.validate_completion()'::regprocedure)
    ilike '%v_reference_day + 1%'
  and pg_catalog.pg_get_functiondef('public.validate_completion()'::regprocedure)
    ilike '%v_reference_day - 2%'
  and pg_catalog.pg_get_functiondef('public.validate_completion()'::regprocedure)
    ilike '%_account_access_allowed(new.user_id)%'
  and pg_catalog.pg_get_functiondef('public.validate_completion()'::regprocedure)
    ilike '%isfinite(new.completed_at)%'
  and pg_catalog.pg_get_functiondef('public.validate_completion()'::regprocedure)
    ilike '%ROUTINE_COMPLETION_TIMESTAMP_INVALID%'
  and pg_catalog.pg_get_functiondef('public.validate_completion()'::regprocedure)
    ilike '%new.created_at := pg_catalog.statement_timestamp()%',
  'completion validation binds account access, exact local time, ownership, original-time bounds, the receipt clock, and the -2/+1 window'
);
select ok(
  pg_catalog.pg_get_functiondef(
    'public._guard_profile_health_write()'::regprocedure
  ) ilike '%ROUTINE_ADHERENCE_CACHE_SERVER_OWNED%',
  'the profile trigger rejects direct cache and timezone mutation'
);
select ok(
  pg_catalog.pg_get_functiondef(
    'private.guard_routine_adherence_freeze_write()'::regprocedure
  ) ilike '%ROUTINE_ADHERENCE_FREEZE_SERVER_OWNED%',
  'the freeze trigger admits only attested materialization and cleanup lanes'
);
select ok(
  pg_catalog.pg_get_functiondef(
    'private.recompute_routine_adherence(uuid,text,timestamptz)'::regprocedure
  ) ilike '%completions.step_id IS NULL%'
  and pg_catalog.pg_get_functiondef(
    'private.recompute_routine_adherence(uuid,text,timestamptz)'::regprocedure
  ) ilike '%JOIN public.routines AS routines%'
  and pg_catalog.pg_get_functiondef(
    'private.recompute_routine_adherence(uuid,text,timestamptz)'::regprocedure
  ) ilike '%routines.user_id = completions.user_id%'
  and pg_catalog.pg_get_functiondef(
    'private.recompute_routine_adherence(uuid,text,timestamptz)'::regprocedure
  ) ilike '%_assert_health_processing_active_locked%'
  and pg_catalog.pg_get_functiondef(
    'private.recompute_routine_adherence(uuid,text,timestamptz)'::regprocedure
  ) ilike '%_account_access_allowed%',
  'the writer uses only routine markers behind health, account, and Apple fences'
);
select ok(
  (
    select pg_catalog.pg_get_triggerdef(trigger.oid)
      ilike '%REFERENCING NEW TABLE AS inserted_routine_completions%'
      and trigger.tgfoid <> 0
      from pg_catalog.pg_trigger as trigger
     where trigger.tgrelid = 'public.routine_completions'::regclass
       and trigger.tgname = 'trg_completion_streak'
       and not trigger.tgisinternal
  ),
  'completion insertion recomputes once per statement through a transition table'
);
select ok(
  (
    select pg_catalog.pg_get_triggerdef(trigger.oid)
      ilike '%REFERENCING OLD TABLE AS deleted_routine_completions%'
      from pg_catalog.pg_trigger as trigger
     where trigger.tgrelid = 'public.routine_completions'::regclass
       and trigger.tgname = 'trg_completion_streak_delete'
       and not trigger.tgisinternal
  ),
  'completion deletion recomputes once per statement through a transition table'
);
select ok(
  pg_catalog.pg_get_functiondef(
    'private.clear_routine_adherence_on_withdrawal()'::regprocedure
  ) ilike '%adherence_timezone = NULL%'
  and pg_catalog.pg_get_functiondef(
    'private.clear_routine_adherence_on_withdrawal()'::regprocedure
  ) ilike '%streak_algorithm_version = 0%',
  'health withdrawal synchronously clears timezone and cache authority'
);
select ok(
  pg_catalog.pg_get_functiondef(
    'public._health_relational_data_exists(uuid)'::regprocedure
  ) ilike '%adherence_timezone IS NOT NULL%'
  and pg_catalog.pg_get_functiondef(
    'public._health_relational_data_exists(uuid)'::regprocedure
  ) ilike '%streak_reference_day IS NOT NULL%',
  'health zero-attestation includes every new adherence field'
);
select ok(
  pg_catalog.pg_get_functiondef(
    'public._assert_health_processing_epoch_locked(uuid,bigint)'::regprocedure
  ) ilike '%pg_try_advisory_xact_lock%'
  and pg_catalog.pg_get_functiondef(
    'private.recompute_routine_adherence(uuid,text,timestamptz)'::regprocedure
  ) ilike '%_assert_health_processing_active_locked%',
  'adherence shares the canonical fail-fast owner advisory lock'
);

-- Functional owner/RLS/trigger rehearsal.
grant select, insert, delete on public.profiles to authenticated;
grant update (display_name, avatar_path, locale, units)
  on public.profiles to authenticated;
grant select, insert, update, delete
  on public.routines, public.routine_steps, public.routine_completions
  to authenticated;
grant select on public.streak_freezes to authenticated;

insert into auth.users (id)
values ('68000000-0000-4000-8000-000000000001');
insert into auth.sessions (id, user_id)
values (
  '68100000-0000-4000-8000-000000000001',
  '68000000-0000-4000-8000-000000000001'
);

do $$
begin
  perform *
    from public.promote_health_consent_copy_for_release(
      'health_data_collection',
      'grant',
      'draft-v1-2026-07-10',
      '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd',
      'PGTAP-CORE05-REVIEW-2026-07-26',
      'pgtap.db-owner',
      repeat('a', 64)
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
 where user_id = '68000000-0000-4000-8000-000000000001';

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"68000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"68100000-0000-4000-8000-000000000001"}',
  true
);
select pg_catalog.set_config(
  'request.headers',
  '{"x-health-processing-epoch":"1"}',
  true
);

select lives_ok(
  $$select * from public.set_routine_adherence_timezone('America/Toronto')$$,
  'an exact-session active owner can configure its exact adherence timezone'
);
select pg_catalog.set_config(
  'test.routine_adherence_reference_day',
  (
    select streak_reference_day::text
      from public.profiles
     where id = '68000000-0000-4000-8000-000000000001'
  ),
  true
);
select pg_catalog.set_config(
  'app.routine_adherence_writer',
  '68000000-0000-4000-8000-000000000001',
  true
);
select throws_ok(
  $$update public.profiles
       set current_streak = 9,
           longest_streak = 9,
           adherence_timezone = 'Pacific/Kiritimati',
           streak_reference_day = '2099-01-01',
           streak_algorithm_version = 1
     where id = '68000000-0000-4000-8000-000000000001'$$,
  '42501',
  'permission denied for table profiles',
  'a matching caller-set GUC cannot forge any profile adherence column'
);
select pg_catalog.set_config('app.routine_adherence_writer', '', true);
select lives_ok(
  $$update public.profiles
       set display_name = 'Profile shell remains editable'
     where id = '68000000-0000-4000-8000-000000000001'$$,
  'the restricted privilege still permits a non-health profile-shell edit'
);
select throws_ok(
  $$insert into public.routines (id, user_id, type, name) values
      (
        '68200000-0000-4000-8000-000000000001',
        '68000000-0000-4000-8000-000000000001',
        'PM',
        'Authority rehearsal A'
      ),
      (
        '68200000-0000-4000-8000-000000000002',
        '68000000-0000-4000-8000-000000000001',
        'PM',
        'Authority rehearsal B'
      );
    insert into public.routine_steps (id, routine_id, step_order) values
      (
        '68300000-0000-4000-8000-000000000001',
        '68200000-0000-4000-8000-000000000001',
        1
      ),
      (
        '68300000-0000-4000-8000-000000000002',
        '68200000-0000-4000-8000-000000000002',
        1
  )$$,
  '42501',
  'new row violates row-level security policy for table "routines"',
  'the current sync bridge denies direct authenticated routine fixtures'
);
reset role;
insert into public.routines (id, user_id, type, name) values
  (
    '68200000-0000-4000-8000-000000000001',
    '68000000-0000-4000-8000-000000000001',
    'PM',
    'Authority rehearsal A'
  ),
  (
    '68200000-0000-4000-8000-000000000002',
    '68000000-0000-4000-8000-000000000001',
    'PM',
    'Authority rehearsal B'
  );
insert into public.routine_steps (id, routine_id, step_order) values
  (
    '68300000-0000-4000-8000-000000000001',
    '68200000-0000-4000-8000-000000000001',
    1
  ),
  (
    '68300000-0000-4000-8000-000000000002',
    '68200000-0000-4000-8000-000000000002',
    1
  );
select pg_catalog.set_config('request.headers', '{}', true);
select throws_ok(
  $$insert into public.routine_completions (
      user_id, routine_id, step_id, completed_date
    ) values (
      '68000000-0000-4000-8000-000000000001',
      '68200000-0000-4000-8000-000000000001',
      '68300000-0000-4000-8000-000000000001',
      pg_catalog.current_setting('test.routine_adherence_reference_day')::date - 1
    )$$,
  '55000',
  'HEALTH_PROCESSING_EPOCH_REQUIRED',
  'a same-routine step completion cannot bypass the required health epoch'
);
select pg_catalog.set_config(
  'request.headers',
  '{"x-health-processing-epoch":"2"}',
  true
);
select throws_ok(
  $$insert into public.routine_completions (
      user_id, routine_id, step_id, completed_date
    ) values (
      '68000000-0000-4000-8000-000000000001',
      '68200000-0000-4000-8000-000000000001',
      null,
      pg_catalog.current_setting('test.routine_adherence_reference_day')::date - 1
    )$$,
  '55000',
  'HEALTH_PROCESSING_EPOCH_STALE',
  'a same-routine marker cannot bypass a stale health epoch'
);
select pg_catalog.set_config(
  'request.headers',
  '{"x-health-processing-epoch":"1"}',
  true
);
select lives_ok(
  $$insert into public.routine_completions (
      user_id, routine_id, step_id, completed_date
    ) values (
      '68000000-0000-4000-8000-000000000001',
      '68200000-0000-4000-8000-000000000001',
      '68300000-0000-4000-8000-000000000001',
      pg_catalog.current_setting('test.routine_adherence_reference_day')::date
    )$$,
  'a partial step completion remains valid check-off evidence'
);
select results_eq(
  $$select current_streak, longest_streak
      from public.profiles
     where id = '68000000-0000-4000-8000-000000000001'$$,
  $$values (0::integer, 0::integer)$$,
  'a partial step completion cannot affect adherence'
);
select lives_ok(
  $$insert into public.routine_completions (
      user_id, routine_id, step_id, completed_date
    ) values (
      '68000000-0000-4000-8000-000000000001',
      '68200000-0000-4000-8000-000000000001',
      null,
      pg_catalog.current_setting('test.routine_adherence_reference_day')::date
    )$$,
  'one routine-level marker publishes one adherence day'
);
select results_eq(
  $$select current_streak, longest_streak
      from public.profiles
     where id = '68000000-0000-4000-8000-000000000001'$$,
  $$values (1::integer, 1::integer)$$,
  'the first marker materializes a one-day current and best cache'
);
select throws_ok(
  $$insert into public.routine_completions (
      user_id, routine_id, step_id, completed_date
    ) values (
      '68000000-0000-4000-8000-000000000001',
      '68200000-0000-4000-8000-000000000002',
      null,
      pg_catalog.current_setting('test.routine_adherence_reference_day')::date
    )$$,
  '23505',
  'duplicate key value violates unique constraint "routine_completions_user_id_step_id_completed_date_key"',
  'routine-level markers are idempotent across the owner and local day'
);
select lives_ok(
  $$insert into public.routine_completions (
      user_id, routine_id, step_id, completed_date
    ) values (
      '68000000-0000-4000-8000-000000000001',
      '68200000-0000-4000-8000-000000000001',
      null,
      pg_catalog.current_setting('test.routine_adherence_reference_day')::date - 2
    )$$,
  'the exact local -2 backfill boundary is accepted'
);
select results_eq(
  $$select
      (select current_streak from public.profiles
        where id = '68000000-0000-4000-8000-000000000001'),
      (select longest_streak from public.profiles
        where id = '68000000-0000-4000-8000-000000000001'),
      (select count(*)::integer from public.streak_freezes
        where user_id = '68000000-0000-4000-8000-000000000001')$$,
  $$values (2::integer, 2::integer, 1::integer)$$,
  'two markers around one miss materialize current, best, and one freeze'
);
select results_eq(
  $$select applied_for_date, source
      from public.streak_freezes
     where user_id = '68000000-0000-4000-8000-000000000001'$$,
  $$values (
      pg_catalog.current_setting('test.routine_adherence_reference_day')::date - 1,
      'auto'::text
    )$$,
  'the freeze projection contains the exact absorbed date and server source'
);
select throws_ok(
  $$insert into public.routine_completions (
      user_id, routine_id, step_id, completed_date, completed_at
    ) values (
      '68000000-0000-4000-8000-000000000001',
      '68200000-0000-4000-8000-000000000001',
      '68300000-0000-4000-8000-000000000001',
      pg_catalog.current_setting('test.routine_adherence_reference_day')::date + 1,
      'infinity'::timestamptz
    )$$,
  '22023',
  'ROUTINE_COMPLETION_TIMESTAMP_INVALID',
  'a non-finite original completion timestamp is rejected'
);
select pg_catalog.set_config(
  'test.routine_adherence_original_completed_at',
  (pg_catalog.statement_timestamp() - interval '1 hour')::text,
  true
);
select lives_ok(
  $$insert into public.routine_completions (
      user_id, routine_id, step_id, completed_date, source,
      completed_at, created_at
    ) values (
      '68000000-0000-4000-8000-000000000001',
      '68200000-0000-4000-8000-000000000001',
      '68300000-0000-4000-8000-000000000001',
      pg_catalog.current_setting('test.routine_adherence_reference_day')::date + 1,
      'backfilled',
      pg_catalog.current_setting(
        'test.routine_adherence_original_completed_at'
      )::timestamptz,
      '2000-01-01T00:00:00Z'
    )$$,
  'the exact local +1 travel/timezone tolerance boundary is accepted'
);
select results_eq(
  $$select source,
      (select current_streak from public.profiles
        where id = '68000000-0000-4000-8000-000000000001'),
      completed_at = pg_catalog.current_setting(
        'test.routine_adherence_original_completed_at'
      )::timestamptz,
      created_at <> '2000-01-01T00:00:00Z'::timestamptz
      from public.routine_completions
     where step_id = '68300000-0000-4000-8000-000000000001'
       and completed_date =
         pg_catalog.current_setting('test.routine_adherence_reference_day')::date + 1$$,
  $$values ('live'::text, 2::integer, true, true)$$,
  'the server preserves bounded original time, rewrites receipt/source, and future step evidence cannot inflate today'
);
select throws_ok(
  $$insert into public.routine_completions (
      user_id, routine_id, step_id, completed_date
    ) values (
      '68000000-0000-4000-8000-000000000001',
      '68200000-0000-4000-8000-000000000001',
      '68300000-0000-4000-8000-000000000001',
      pg_catalog.current_setting('test.routine_adherence_reference_day')::date - 3
    )$$,
  '22023',
  'ROUTINE_COMPLETION_BACKFILL_LIMIT',
  'the exact local -3 boundary is rejected'
);
select throws_ok(
  $$insert into public.routine_completions (
      user_id, routine_id, step_id, completed_date
    ) values (
      '68000000-0000-4000-8000-000000000001',
      '68200000-0000-4000-8000-000000000001',
      '68300000-0000-4000-8000-000000000001',
      pg_catalog.current_setting('test.routine_adherence_reference_day')::date + 2
    )$$,
  '22023',
  'ROUTINE_COMPLETION_FUTURE_LIMIT',
  'the exact local +2 boundary is rejected'
);
reset role;
select throws_ok(
  $$insert into public.routine_completions (
      user_id, routine_id, step_id, completed_date
    ) values (
      '68000000-0000-4000-8000-000000000001',
      '68200000-0000-4000-8000-000000000002',
      '68300000-0000-4000-8000-000000000001',
      pg_catalog.current_setting('test.routine_adherence_reference_day')::date - 1
    )$$,
  '23503',
  'ROUTINE_COMPLETION_STEP_ROUTINE_INVALID',
  'the trigger rejects a cross-routine step even for a privileged publisher'
);
set local role authenticated;
select throws_ok(
  $$insert into public.streak_freezes (
      user_id, applied_for_date, source
    ) values (
      '68000000-0000-4000-8000-000000000001',
      pg_catalog.current_setting('test.routine_adherence_reference_day')::date + 10,
      'auto'
    )$$,
  '42501',
  'permission denied for table streak_freezes',
  'an authenticated owner cannot directly insert a freeze'
);
reset role;
select lives_ok(
  $$delete from public.routines
     where id = '68200000-0000-4000-8000-000000000001'$$,
  'a privileged routine publisher deletion cascades marker deletion and recomputes once'
);
select results_eq(
  $$select
      (select current_streak from public.profiles
        where id = '68000000-0000-4000-8000-000000000001'),
      (select longest_streak from public.profiles
        where id = '68000000-0000-4000-8000-000000000001'),
      (select count(*)::integer from public.streak_freezes
        where user_id = '68000000-0000-4000-8000-000000000001')$$,
  $$values (0::integer, 2::integer, 0::integer)$$,
  'deletion clears current/freeze state without shrinking the personal best'
);
set local role authenticated;
select results_eq(
  $$select current_streak, longest_streak, adherence_timezone,
      reference_day, frozen_dates, algorithm_version
      from public.refresh_routine_adherence()$$,
  $$select 0::integer, 2::integer, 'America/Toronto'::text,
      pg_catalog.current_setting('test.routine_adherence_reference_day')::date,
      '{}'::date[], 1::smallint$$,
  'an idempotent refresh preserves the authoritative empty-current/best cache'
);
select throws_ok(
  $$select * from public.set_routine_adherence_timezone('america/toronto')$$,
  '22023',
  'ROUTINE_ADHERENCE_TIMEZONE_INVALID',
  'the owner RPC also fails closed on an inexact timezone'
);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"68000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"68100000-0000-4000-8000-000000000099"}',
  true
);
select throws_ok(
  $$select * from public.refresh_routine_adherence()$$,
  '28000',
  'HEALTH_CONSENT_SESSION_REJECTED',
  'a stale or forged exact-session claim cannot refresh adherence'
);

reset role;
update public.health_processing_states
   set state = 'unconsented',
       epoch = 0,
       consent_version = null,
       consent_text_hash = null,
       last_server_verified_at = null
 where user_id = '68000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"68000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"68100000-0000-4000-8000-000000000001"}',
  true
);
select throws_ok(
  $$select * from public.refresh_routine_adherence()$$,
  '55000',
  'HEALTH_PROCESSING_NOT_ACTIVE',
  'closed health processing cannot refresh or resurrect adherence'
);

reset role;
select * from finish();
rollback;
